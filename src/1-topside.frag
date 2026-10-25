// Topside: a ruined city under a dusty sky. A giant four-legged machine paces
// along the horizon, its red eye pulsing and a searchlight sweeping through
// the dust; a raider with a pack sits on a dune, cloth snapping in the wind.
// Drawn as layered silhouettes with aerial perspective.
// still: 64
// detail: -.74 -.33 -.28 .2    the walker's eye and searchlight
// detail: -1.2 -.44 1.2 -.08   both dune crests end to end: blowing sand, and the raider's scarf and whip

const vec3 SUN_COL = vec3(1., .62, .3);
const vec3 SIGNAL = vec3(.95, .55, .07);   // #f2c14e, linear
const vec3 RED = vec3(1., .05, .02);
const float HORIZON = -.06;

float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
// coverage of a shape from its distance, antialiased to about a pixel
float fill(float d) { return clamp(.5 - d * resolution.y, 0., 1.); }

vec2 SUN = vec2(.52, .17);

vec3 skyCol(vec2 p) {
  float h = p.y - HORIZON;
  vec3 top = srgb(vec3(.2, .11, .08)), mid = srgb(vec3(.72, .38, .18)), low = srgb(vec3(.98, .74, .45));
  vec3 col = mix(low, mid, smoothstep(0., .18, h));
  col = mix(col, top, smoothstep(.12, .6, h));
  // sun: a soft disc in the haze, with a wide glow
  float d = length(p - SUN);
  col += SUN_COL * (smoothstep(.052, .045, d) * 2.2 + exp(-d * 9.) * .7 + exp(-d * 2.5) * .25);
  // dust clouds, slowly drifting
  vec2 q = p * vec2(1.6, 5.) + vec2(ST * .006, 0.);
  float c = fbm(q + fbm(q * 1.7 + ST * .01) * .8);
  float band = smoothstep(.0, .1, h) * smoothstep(.55, .15, h);
  col = mix(col, mix(srgb(vec3(.45, .22, .12)), SUN_COL * 1.2, exp(-d * 4.)), smoothstep(.45, .85, c) * band * .7);
  return col;
}

// Light shafts from the sun, broken up by the clouds (cheap: noise by angle).
float shafts(vec2 p) {
  vec2 v = p - SUN;
  float ang = atan(v.y, v.x);
  float n = fbm(vec2(ang * 9., ST * .03)) * fbm(vec2(ang * 23. + 4., -ST * .02));
  return n * exp(-length(v) * 2.2) * smoothstep(.0, .1, -v.y + .15);
}

// A row of ruined buildings: height at x, with broken tops and empty windows.
float ruins(vec2 p, float scale, float seed, float minH, float maxH, out float windows) {
  float x = p.x / scale;
  float i = floor(x), f = fract(x);
  float r = hash11(i * 3.7 + seed), r2 = hash11(i * 9.1 + seed * 2.);
  float gap = step(.62, r2);                            // empty lots
  float w0 = .08 + .1 * r, w1 = .92 - .1 * r2;
  float inside = step(w0, f) * step(f, w1) * (1. - gap);
  float h = minH + (maxH - minH) * pow(r, 1.4);
  // collapsed tops: a slanted break plus jagged rubble
  float slant = (hash11(i + seed * 5.) - .5) * .7 * step(.4, r2);
  h += slant * (f - .5) * scale - abs(noise1(p.x * 140. + seed) - .5) * .012 * step(.3, r2);
  // antennas and cranes on a few
  float mast = step(.9, r) * (1. - gap) * step(abs(f - .3), .012) * step(p.y, HORIZON + h + .06 * scale / .1) * step(HORIZON, p.y);
  float body = inside * step(p.y, HORIZON + h) * step(HORIZON - .03, p.y);
  // gutted floors: horizontal slots right through some buildings
  float gut = step(.55, hash11(i * 5.3 + seed)) * step(.6, fract((p.y - HORIZON) / scale * 7.)) * step(.25, f) * step(f, .75)
            * step(p.y, HORIZON + h - .2 * scale) * step(HORIZON + .3 * scale, p.y);
  body *= 1. - gut;
  // windows: a grid of holes, some blown out wider
  vec2 wp = vec2((f - w0) / (w1 - w0) * 6., (p.y - HORIZON) / scale * 18.);
  float hole = step(.25, fract(wp.x)) * step(fract(wp.x), .75) * step(.3, fract(wp.y)) * step(fract(wp.y), .8);
  hole *= step(.72, hash21(floor(wp) + i * 7.)) * step(p.y, HORIZON + h - .01 * scale / .1) * step(.6, wp.x) * step(wp.x, 5.4) * step(.6, r);
  windows = body * hole;
  return max(body, mast);
}

float dune(float x, float base, float amp, float seed) {
  return base + amp * (sin(x * 2.1 + seed) * .6 + fbm1(x * 3. + seed) - .5);
}

// ---- the walker: armoured hull, sensor head, four high-kneed legs ----
float sdTrap(vec2 p, float r1, float r2, float he) {   // trapezoid, bottom half-width r1, top r2
  vec2 k1 = vec2(r2, he), k2 = vec2(r2 - r1, 2. * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0., 1.);
  float s = (cb.x < 0. && ca.y < 0.) ? -1. : 1.;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float walker(vec2 p, vec2 at, float s, out float eye, out vec2 eyePos) {
  vec2 q = (p - at) / s;
  float t = ST * .5;
  float bob = .012 * sin(t * 2.);
  vec2 hull = vec2(0., .5 + bob);
  float d = sdTrap(q - hull, .13, .2, .055) - .01;                         // armoured body
  d = min(d, sdTrap(q - hull - vec2(-.02, .08), .16, .1, .03));            // top plate
  d = min(d, sdBox2(q - hull - vec2(-.05, -.075), vec2(.08, .02)));        // belly
  d = min(d, sdSeg(q, hull + vec2(-.12, .1), hull + vec2(-.16, .22)) - .005);   // antenna
  d = min(d, sdSeg(q, hull + vec2(-.08, .1), hull + vec2(-.09, .17)) - .004);
  vec2 head = hull + vec2(.24, -.04);
  d = min(d, sdBox2(q - head, vec2(.05, .035)) - .015);                   // sensor head
  d = min(d, sdSeg(q, hull + vec2(.15, -.01), head) - .025);               // neck
  eyePos = at + (head + vec2(.055, -.005)) * s;
  eye = length(q - head - vec2(.055, -.005)) * s;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float side = i < 2 ? -1. : 1.;
    float ph = t + fi * 1.57 + (i == 1 || i == 3 ? 3.14 : 0.);
    float lift = max(sin(ph), 0.) * .05;
    vec2 hip = hull + vec2(side * (.1 + .02 * fi), .0);
    vec2 foot = vec2(side * (.42 + .06 * mod(fi, 2.)) + .05 * cos(ph), lift);
    vec2 knee = vec2(side * (.3 + .04 * mod(fi, 2.)) + .02 * cos(ph), .78 + lift * .5);
    float w = .016 - .005 * mod(fi, 2.);
    d = min(d, sdSeg(q, hip, knee) - w);
    d = min(d, sdSeg(q, knee, foot) - w * .75);
    d = min(d, length(q - knee) - w * 1.6);
    d = min(d, sdSeg(q, foot, foot + vec2(side * .03, -.01)) - w * .6);   // claw
  }
  return d * s;
}

// ---- the raider, sitting, side-on, facing left towards the machine ----
float raider(vec2 p, vec2 at, float s, out float cloth) {
  vec2 q = (p - at) / s;
  float d = sdSeg(q, vec2(0, .07), vec2(-.05, .4)) - .085;                // torso, leaning forward
  d = smin(d, length(q - vec2(-.08, .55)) - .065, .03);                    // hooded head
  d = min(d, sdSeg(q, vec2(-.11, .6), vec2(-.15, .58)) - .02);             // hood peak
  d = min(d, sdBox2(q - vec2(.12, .32), vec2(.08, .14)) - .025);           // pack
  d = min(d, sdBox2(q - vec2(.12, .5), vec2(.05, .03)) - .01);             // bedroll
  float calm = mix(1., .45, detail);   // Lite: a gentler breeze
  float sway = .02 * sin(time * 1.7 * calm) + .01 * sin(time * 4.3 * calm);
  d = min(d, sdSeg(q, vec2(.15, .45), vec2(.2 + sway, .85)) - .004);       // radio whip
  d = min(d, sdSeg(q, vec2(0, .05), vec2(-.25, .12)) - .045);              // thigh
  d = min(d, sdSeg(q, vec2(-.25, .12), vec2(-.27, -.12)) - .035);          // shin
  d = min(d, sdBox2(q - vec2(-.3, -.13), vec2(.05, .02)));                 // boot
  d = min(d, sdSeg(q, vec2(-.02, .36), vec2(-.2, .2)) - .03);              // arm on knee
  d = min(d, sdSeg(q, vec2(-.32, .32), vec2(.05, .02)) - .012);            // rifle
  // scarf tail streaming out behind, snapping in gusts
  float gust = (.5 + .5 * sin(time * .7 * calm)) * mix(1., .6, detail);
  float cd = 1e9;
  for (int i = 0; i < 5; i++) {
    float u = float(i) / 5., u2 = float(i + 1) / 5.;
    vec2 a = vec2(-.02 + u * .32, .47 - u * .05 + .03 * sin(time * 9. * calm - u * 8.) * u * (1. + gust));
    vec2 b = vec2(-.02 + u2 * .32, .47 - u2 * .05 + .03 * sin(time * 9. * calm - u2 * 8.) * u2 * (1. + gust));
    cd = min(cd, sdSeg(q, a, b) - .018 * (1. - u * .6));
  }
  cloth = cd * s;
  return min(d, cd) * s;
}

void main() {
  vec2 p = sceneP();
  vec3 col = skyCol(p);
  vec3 hazeNear = srgb(vec3(.93, .62, .36));

  // far ruins, faint in the haze
  float win;
  float far = ruins(p + vec2(ST * .0008, 0), .045, 1., .015, .08, win);
  col = mix(col, mix(hazeNear, srgb(vec3(.55, .3, .18)), .45), far * (1. - win * .7));

  // the desert floor out to the horizon
  col = mix(col, mix(hazeNear, srgb(vec3(.5, .28, .16)), smoothstep(0., -.15, p.y - HORIZON)), step(p.y, HORIZON - .002));

  // the walker on the horizon, a bit nearer than the far ruins
  float eye; vec2 eyePos;
  float wx = -.62 + mod(ST * .0025 + .25, 1.6) - .25;
  float wd = walker(p, vec2(wx, HORIZON - .01), .36, eye, eyePos);
  vec3 walkerCol = mix(hazeNear, srgb(vec3(.3, .16, .11)), .62);
  col = mix(col, walkerCol, fill(wd));
  // the eye and its pulse
  float pulse = .65 + .35 * sin(time * 1.6);
  col += RED * (smoothstep(.006, .002, eye) * 3. + exp(-eye * 90.) * .6 * pulse + exp(-eye * 25.) * .12 * pulse);
  // searchlight sweeping down through the dust
  float sweep = -2.1 + .35 * sin(time * .21) + .12 * sin(time * .53);
  vec2 v = p - eyePos;
  float a = atan(v.y, v.x);
  float cone = smoothstep(.06, .0, abs(a - sweep)) * smoothstep(.0, .05, length(v)) * exp(-length(v) * 3.);
  float dust = .55 + .45 * fbm(p * 14. + vec2(time * .15, 0.));
  col += srgb(vec3(1., .5, .4)) * cone * dust * .55 * (1. - far * .5);

  // nearer ruins, darker
  float mid = ruins(p + vec2(ST * .002, 0) + vec2(3.7, 0), .09, 7., .02, .15, win);
  vec3 midCol = mix(hazeNear, srgb(vec3(.22, .12, .08)), .72);
  col = mix(col, mix(midCol, hazeNear * .9, win * .8), mid);
  // the searchlight catches the dust in front of them too
  col += srgb(vec3(1., .5, .4)) * cone * dust * .25 * mid;

  // sun shafts over everything in the distance
  col += SUN_COL * shafts(p) * .22;

  // dunes: a middle ridge and the near one the raider sits on
  float d1 = dune(p.x + 1.3, HORIZON - .11, .07, 2.);
  col = mix(col, mix(srgb(vec3(.4, .22, .13)), srgb(vec3(.3, .16, .1)), smoothstep(0., -.1, p.y - d1)), fill(p.y - d1));
  float d2 = dune(p.x, -.31, .1, 0.);
  float onNear = fill(p.y - d2);
  // sand texture with ripples, lit along the crest from the sun side
  float rip = .5 + .5 * sin((p.x * 90. + p.y * 260.) + fbm(p * 30.) * 6.);
  vec3 sand = mix(srgb(vec3(.15, .08, .05)), srgb(vec3(.24, .13, .08)), rip * .5 + fbm(p * 8.) * .5);
  float crest = exp(-max(d2 - p.y, 0.) * 70.);
  sand += SUN_COL * crest * .35 * smoothstep(-.4, .5, p.x);
  col = mix(col, sand, onNear);
  // sand blowing off the crests
  for (int k = 0; k < 2; k++) {
    float base = k == 0 ? d1 : d2;
    float above = p.y - base;
    float streak = fbm(vec2((p.x - time * (.07 + .05 * float(k))) * 9., above * 70.));
    col += srgb(vec3(1., .72, .45)) * smoothstep(.5, .85, streak) * exp(-max(above, 0.) * 60.) * step(0., above) * (.06 + .16 * float(k));
  }

  // the raider on the near dune, facing the machine
  float rx = .42;
  float cloth;
  float rd = raider(p, vec2(rx, dune(rx, -.31, .1, 0.) - .008), .26, cloth);
  vec3 figure = srgb(vec3(.05, .03, .025));
  col = mix(col, figure, fill(rd));
  // rim light on the edge facing the sun (right)
  float tmp;
  float inner = raider(p + vec2(.0018, -.0008), vec2(rx, dune(rx, -.31, .1, 0.) - .008), .26, tmp);
  col += SUN_COL * fill(rd) * (1. - fill(inner)) * .45;
  col = mix(col, srgb(vec3(.55, .2, .08)) * .5, fill(cloth) * .6);   // the scarf: faded rust

  // dust motes drifting past in the foreground
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 mp = p * (6. + fi * 3.) + vec2(ST * (.25 + fi * .1), sin(ST * .3 + fi) * .3);
    vec2 cell = floor(mp), f = fract(mp) - .5;
    float h = hash21(cell + fi * 13.);
    if (h > .95) col += srgb(vec3(1., .8, .55)) * smoothstep(.05, .0, length(f - (vec2(hash21(cell + 1.), hash21(cell + 2.)) - .5) * .6)) * (h - .95) * 6.;
  }
  // overall haze and a warm grade
  col = mix(col, hazeNear, .06);
  fragColor = finish(col * .95);
}
