// Shared by every live wallpaper shader (prepended by tools/build-live.sh,
// which also defines STILL_TIME, the moment the still background shows).
#version 440
layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;
layout(std140, binding = 0) uniform buf {
  mat4 qt_Matrix;
  float qt_Opacity;
  float time;       // seconds; the plugin wraps it every couple of hours
  vec2 resolution;  // pixels of the whole screen
  vec4 viewport;    // the part of the screen drawn here (x, y, w, h; 0-1 from top left)
  float detail;     // 1 in Details mode: only small patches are drawn over the still
};
#ifndef STILL_TIME
#define STILL_TIME 20.
#endif
// Scene time: what the camera and anything big follow. In Details mode it
// stays at the still's moment so the patches match the picture around them;
// small local effects (lights, cloth, beams) keep using `time`.
#define ST (detail > .5 ? STILL_TIME : time)

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise1(float x) { float i = floor(x), f = fract(x); return mix(hash11(i), hash11(i + 1.), f * f * (3. - 2. * f)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
float fbm1(float x) { float a = .5, s = 0.; for (int i = 0; i < 6; i++) { s += a * noise1(x); x = x * 2.1 + 3.7; a *= .5; } return s; }

vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }   // colour picked as sRGB -> linear
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }

vec2 screenUV() { vec2 u = viewport.xy + qt_TexCoord0 * viewport.zw; return vec2(u.x, 1. - u.y); }
// Scene coordinates: y from -0.5 (bottom) to 0.5 (top), x scaled to match.
// Keep anything important within |x| < 0.78 so 16:10 screens still show it.
vec2 sceneP() { return (screenUV() - .5) * vec2(resolution.x / resolution.y, 1.); }

// Linear HDR colour in; tone-mapped, vignetted, grained sRGB out.
vec4 finish(vec3 col) {
  // Vignette in scene coordinates (as framed on a 21:9 screen), so a Details
  // patch shades exactly like the still around it on any screen shape.
  vec2 uv = screenUV(), q = sceneP() * vec2(1. / 2.389, 1.25);
  col *= 1. - .6 * dot(q, q);
  col = pow(aces(col), vec3(1. / 2.2));
  col += (hash21(floor(uv * resolution) + fract(ST) * 91.) - .5) / 110.;  // grain, hides banding
  // a patch fades out over its last few pixels into the still around it
  vec2 edge = min(qt_TexCoord0, 1. - qt_TexCoord0) * viewport.zw * resolution;
  float a = detail > .5 ? smoothstep(0., 14., min(edge.x, edge.y)) : 1.;
  return vec4(col * a, a) * qt_Opacity;
}
