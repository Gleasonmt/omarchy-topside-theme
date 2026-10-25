#!/bin/bash
# Rebuild this theme's live wallpaper from its source in src/:
#   tools/build.sh           shader (live/*.frag.qsb), its patch list (live/*.json),
#                            the still (backgrounds/*.png) and preview.jpg
#   tools/build.sh --media   also the animated previews in media/ (a few minutes)
# Needs qt6-shadertools, qt6-declarative, ImageMagick (and ffmpeg for --media).
# src/<name>.frag holds the scene; `// still: <seconds>` picks the frame used as
# the still, and `// detail: x0 y0 x1 y1` lines list the patches that move in Lite.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
QSB=/usr/lib/qt6/bin/qsb QML=/usr/lib/qt6/bin/qml
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
render() { QT_QPA_PLATFORM=offscreen QT_QUICK_BACKEND=rhi QSG_RHI_BACKEND=opengl "$QML" "$@" 2>/dev/null; }

src=$(ls "$ROOT"/src/*.frag | head -1)
name=$(basename "$src" .frag)
t=$(sed -n 's|^// still: *\([0-9.]*\).*|\1|p' "$src" | head -1); t=${t:-20}
{ grep '^#version' "$ROOT/src/common.glsl"; echo "#define STILL_TIME $t"; grep -v '^#version' "$ROOT/src/common.glsl"; cat "$src"; } >"$TMP/$name.frag"
mkdir -p "$ROOT/live" "$ROOT/backgrounds"
"$QSB" --qt6 -o "$ROOT/live/$name.frag.qsb" "$TMP/$name.frag"
sed -n 's|^// detail: *\([-0-9. ]*[0-9]\).*|\1|p' "$src" \
  | jq -Rn --argjson still "$t" '{still: $still, details: [inputs | split(" ") | map(select(. != "") | tonumber)]}' >"$ROOT/live/$name.json"
render "$ROOT/tools/render.qml" -- "$ROOT/live/$name.frag.qsb" "$TMP/still.png" 3440 1440 "$t" 1
magick "$TMP/still.png" -alpha off -strip "$ROOT/backgrounds/$name.png"
magick "$ROOT/backgrounds/$name.png" -resize x1012 -gravity center -crop 1800x1012+0+0 +repage -quality 90 "$ROOT/preview.jpg"
echo "built $name (still at ${t}s)"

[[ ${1:-} == --media ]] || exit 0
slug=$(basename "$ROOT"); slug=${slug#omarchy-}; slug=${slug%-theme}
mkdir -p "$ROOT/media"
clip() {  # clip <out> <w> <h> <fps> <quality> <detail>
  local n=$(($4 * 7)) k=$(($4 * 3 / 4)) j a
  rm -rf "$TMP/f" "$TMP/l"; mkdir -p "$TMP/f" "$TMP/l"
  render "$ROOT/tools/render-seq.qml" -- "$ROOT/live/$name.frag.qsb" "$TMP/f" "$2" "$3" "$t" "$4" "$((n + k))" "$6"
  for ((j = 0; j < n; j++)); do   # the first frames cross-fade from the extra tail: a seamless loop
    a=$(printf '%s/f%04d.png' "$TMP/f" "$j")
    if ((j < k)); then magick "$(printf '%s/f%04d.png' "$TMP/f" "$((n + j))")" "$a" -compose blend -define compose:args="$((100 * j / k))" -composite "$(printf '%s/l/f%04d.png' "$TMP" "$j")"
    else cp "$a" "$(printf '%s/l/f%04d.png' "$TMP" "$j")"; fi
  done
  ffmpeg -v error -y -framerate "$4" -i "$TMP/l/f%04d.png" -c:v libwebp_anim -quality "$5" -loop 0 "$1"
  echo "$(basename "$1"): $(du -h "$1" | cut -f1)"
}
# `// media: <width> <height> <fps> <quality>` in the source overrides the
# full-motion clip's size (a busy scene compresses worse)
read -r mw mh mf mq < <(sed -n 's|^// media: *||p' "$src" | head -1; echo)
clip "$ROOT/media/$slug.webp" "${mw:-1280}" "${mh:-534}" "${mf:-15}" "${mq:-72}" 0
clip "$ROOT/media/$slug-lite.webp" 960 400 12 72 1
