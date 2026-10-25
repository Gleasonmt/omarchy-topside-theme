// Renders a sequence of frames of a live wallpaper shader to PNGs.
//   qml render-seq.qml -- <shader.frag.qsb> <out-dir> <width> <height> <start> <fps> <frames> [detail]
// Frames are <out-dir>/f0000.png ... (used by tools/make-gifs.sh).
import QtQuick
import QtQuick.Window

Window {
  id: win
  readonly property var args: Qt.application.arguments.slice(Qt.application.arguments.indexOf("--") + 1)
  readonly property real start: Number(args[4])
  readonly property real fps: Number(args[5])
  readonly property int frames: Number(args[6])
  property int frame: 0
  width: Number(args[2]); height: Number(args[3])
  visible: true
  color: "black"

  ShaderEffect {
    id: fx
    anchors.fill: parent
    property real time: win.start + win.frame / win.fps
    property size resolution: Qt.size(width, height)
    property rect viewport: Qt.rect(0, 0, 1, 1)
    property real detail: Number(win.args[7] || 0)
    fragmentShader: "file://" + win.args[0]
  }

  function pad(n) { var s = String(n); while (s.length < 4) s = "0" + s; return s }
  function next() {
    fx.grabToImage(function(r) {
      r.saveToFile(win.args[1] + "/f" + pad(win.frame) + ".png")
      if (win.frame + 1 >= win.frames) { Qt.quit(); return }
      win.frame += 1
      step.restart()
    })
  }
  Timer { id: step; interval: 30; onTriggered: win.next() }
  Timer { interval: 400; running: true; onTriggered: win.next() }
}
