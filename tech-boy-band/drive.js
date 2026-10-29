// Drive · Going Nowhere Fast. First-person drive through a low-poly town while the album plays.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const AUTOSTART = qs.get('autostart') === '1'; // testing only: skips the overlay, audio muted
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------- renderer ---------------- */
const host = $('drive');
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb9d8dc, 70, 340);
const camera = new THREE.PerspectiveCamera(66, 1, 0.1, 900);
camera.rotation.order = 'YXZ';
scene.add(camera);
new ResizeObserver(() => {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(host);

/* ---------------- city ---------------- */
const N = 8, CELL = 72, ROAD = 14, HALF = ROAD / 2, SIDE = 3, W = N * CELL;
let seed = 1994;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const dummy = new THREE.Object3D();
const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });

function instanced(geo, mat, items, place) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, k) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); place(it, k); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
  scene.add(m);
  return m;
}

// blocks: inner 8x8 are drivable around, an outer ring is scenery only
const blocks = [];
for (let i = -1; i <= N; i++) for (let j = -1; j <= N; j++) {
  const inner = i >= 0 && j >= 0 && i < N && j < N;
  blocks.push({ i, j, inner, x0: i * CELL + HALF, z0: j * CELL + HALF, s: CELL - ROAD, park: inner && rnd() < 0.12 && !(i === 4 && j === 3) });
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), lambert(0x3a3c41));
ground.rotation.x = -Math.PI / 2;
ground.position.set(W / 2, 0, W / 2);
scene.add(ground);

const box = new THREE.BoxGeometry(1, 1, 1);
instanced(box, lambert(0x8f8a80), blocks, (b) => { dummy.position.set(b.x0 + b.s / 2, 0.09, b.z0 + b.s / 2); dummy.scale.set(b.s, 0.18, b.s); });
const parks = blocks.filter((b) => b.park);
instanced(box, lambert(0x6f8d4e), parks, (b) => { dummy.position.set(b.x0 + b.s / 2, 0.2, b.z0 + b.s / 2); dummy.scale.set(b.s - 2 * SIDE, 0.06, b.s - 2 * SIDE); });

// lane dashes
const dashes = [];
for (let k = 0; k <= N; k++) for (let s = 0; s < W; s += 7) {
  const m = s % CELL;
  if (m < HALF + 2 || m > CELL - HALF - 5) continue;
  dashes.push([k * CELL, s + 1.5, 0], [s + 1.5, k * CELL, 1]);
}
instanced(new THREE.PlaneGeometry(0.22, 3).rotateX(-Math.PI / 2), lambert(0xd9c27e), dashes,
  ([x, z, t]) => { dummy.position.set(x, 0.02, z); dummy.rotation.y = t ? Math.PI / 2 : 0; });

// window textures: a 4x4 grid of windows, one floor per row. lit version is the night emissive map.
function windowTex(lit) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = lit ? '#000' : '#ece6dc'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const x = k * 64 + 14, y = r * 64 + 18;
    if (lit) { if (rnd() < 0.45) { g.fillStyle = pick(['#ffd27a', '#ffc35e', '#ffe3a8', '#f6a94e']); g.fillRect(x, y, 36, 32); } }
    else { g.fillStyle = '#2b3442'; g.fillRect(x, y, 36, 32); g.fillStyle = '#56606f'; g.fillRect(x, y, 36, 5); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const PALETTE = ['#c98a6b', '#d9b36c', '#7fa7a3', '#b8a48a', '#a65a46', '#c7928f', '#8e9aa0', '#9cc3b0', '#d6b48c', '#6f8f9a'].map((c) => new THREE.Color(c));
const TW = 12.8, TH = 14; // one texture repeat = 4 windows wide, 4 floors tall
const parts = [];
for (const b of blocks) {
  if (b.park) continue;
  const inX = b.x0 + SIDE, inZ = b.z0 + SIDE, inS = b.s - 2 * SIDE;
  const down = Math.max(0, 1 - Math.hypot((b.i + 0.5) * CELL - W / 2, (b.j + 0.5) * CELL - W / 2) / (W * 0.42));
  const nx = 1 + Math.floor(rnd() * 3), nz = 1 + Math.floor(rnd() * 3), lw = inS / nx, ld = inS / nz;
  for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
    const w = lw - 1.5 - rnd() * 3, d = ld - 1.5 - rnd() * 3, h = (2 + Math.floor(rnd() * (3 + down * 11))) * 3.5;
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, ou = Math.floor(rnd() * 4) / 4;
    for (let v = 0; v < 24; v++) {
      const f = v >> 2;
      if (f === 2 || f === 3) uv.setXY(v, 0.02, 0.02); // roof/floor: plain wall texel
      else uv.setXY(v, uv.getX(v) * (f < 2 ? d : w) / TW + ou, uv.getY(v) * h / TH);
    }
    const col = pick(PALETTE).clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06), cols = new Float32Array(72);
    for (let v = 0; v < 24; v++) col.toArray(cols, v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.translate(inX + lw * (a + 0.5), h / 2, inZ + ld * (c + 0.5));
    parts.push(g);
  }
}
const winMat = new THREE.MeshLambertMaterial({ map: windowTex(false), emissiveMap: windowTex(true), emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
scene.add(new THREE.Mesh(mergeGeometries(parts), winMat));
parts.forEach((g) => g.dispose());

// palms: along sidewalks + inside parks
const palms = [];
for (const b of blocks) {
  if (!b.inner) continue;
  for (let e = 0; e < 4; e++) for (let s = 8; s < b.s - 8; s += 15) {
    if (rnd() > 0.5) continue;
    const t = s + rnd() * 3, edge = [[b.x0 + t, b.z0 + 1.4], [b.x0 + t, b.z0 + b.s - 1.4], [b.x0 + 1.4, b.z0 + t], [b.x0 + b.s - 1.4, b.z0 + t]][e];
    palms.push(edge);
  }
  if (b.park) for (let k = 0; k < 7; k++) palms.push([b.x0 + 8 + rnd() * (b.s - 16), b.z0 + 8 + rnd() * (b.s - 16)]);
}
const fronds = [];
for (let k = 0; k < 7; k++) fronds.push(new THREE.BoxGeometry(0.75, 0.06, 3.4).translate(0, 0, 1.7).rotateX(0.5).rotateY(k * Math.PI * 2 / 7).translate(0, 8, 0));
const placePalm = ([x, z], k) => {
  const r = Math.sin(k * 12.9898) * 43758.5453, f = r - Math.floor(r);
  dummy.position.set(x, 0.18, z);
  dummy.rotation.set((f - 0.5) * 0.22, f * 6.28, (0.5 - ((f * 7) % 1)) * 0.22);
  dummy.scale.setScalar(0.85 + f * 0.4);
};
instanced(new THREE.CylinderGeometry(0.16, 0.28, 8, 6).translate(0, 4, 0), lambert(0x7a5a3e), palms, placePalm);
instanced(mergeGeometries(fronds), lambert(0x4f7d4a), palms, placePalm);

// streetlights at every inner block corner: pole + arm, glowing head, light pool on the road
const lamps = [];
for (const b of blocks) {
  if (!b.inner) continue;
  for (const [cx, ox] of [[b.x0 + 1.2, -1], [b.x0 + b.s - 1.2, 1]]) for (const [cz, oz] of [[b.z0 + 1.2, -1], [b.z0 + b.s - 1.2, 1]]) lamps.push({ x: cx, z: cz, ox: ox * Math.SQRT1_2, oz: oz * Math.SQRT1_2 });
}
const placeLamp = (l) => { dummy.position.set(l.x, 0.18, l.z); dummy.rotation.y = Math.atan2(-l.oz, l.ox); };
instanced(mergeGeometries([new THREE.CylinderGeometry(0.08, 0.11, 6.6, 5).translate(0, 3.3, 0), new THREE.BoxGeometry(1.8, 0.1, 0.1).translate(0.9, 6.5, 0)]), lambert(0x2c3036), lamps, placeLamp);
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x55575c });
instanced(new THREE.BoxGeometry(0.8, 0.18, 0.45).translate(1.7, 6.4, 0), lampHeadMat, lamps, placeLamp);
const poolTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,205,130,1)'); gr.addColorStop(0.45, 'rgba(255,170,80,.45)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
instanced(new THREE.PlaneGeometry(15, 15).rotateX(-Math.PI / 2), poolMat, lamps, (l) => dummy.position.set(l.x + l.ox * 3.6, 0.21, l.z + l.oz * 3.6));

// traffic: boxes driving straight lines, wrapping at the town edge
const NC = 40, cars = [];
for (let k = 0; k < NC; k++) {
  const axis = k % 2, road = Math.floor(rnd() * (N + 1)), dir = rnd() < 0.5 ? 1 : -1;
  cars.push({ axis, road, dir, s: rnd() * W, speed: 8 + ((axis * 31 + road * 7 + (dir > 0 ? 3 : 0)) % 5) * 1.6, x: 0, z: 0 });
}
const carBody = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.9, 4.4).translate(0, 0.75, 0), lambert(0xffffff), NC);
const carTop = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.65, 2.2).translate(0, 1.52, 0.2), lambert(0x1d2630), NC);
const lightParts = [new THREE.BoxGeometry(1.6, 0.18, 0.05).translate(0, 0.85, -2.22), new THREE.BoxGeometry(1.6, 0.18, 0.05).translate(0, 0.85, 2.22)];
const lightCols = (g, c) => { const a = new Float32Array(g.attributes.position.count * 3); for (let v = 0; v < a.length; v += 3) new THREE.Color(c).toArray(a, v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const carLightMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x666666 });
const carLights = new THREE.InstancedMesh(mergeGeometries([lightCols(lightParts[0], '#fff2cf'), lightCols(lightParts[1], '#ff3b2a')]), carLightMat, NC);
const CAR_COLORS = ['#b23a2e', '#e1d6c2', '#2f5d7c', '#d9a441', '#46705c', '#7b4b8a', '#c56a3b', '#3d4a5c'];
cars.forEach((c, k) => carBody.setColorAt(k, new THREE.Color(CAR_COLORS[k % CAR_COLORS.length])));
for (const m of [carBody, carTop, carLights]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
function moveTraffic(dt) {
  const L = W + 40;
  cars.forEach((c, k) => {
    c.s = ((c.s + c.dir * c.speed * dt + 20) % L + L) % L - 20;
    if (c.axis === 0) { c.x = c.road * CELL - c.dir * 3.5; c.z = c.s; dummy.rotation.set(0, c.dir < 0 ? 0 : Math.PI, 0); }
    else { c.x = c.s; c.z = c.road * CELL + c.dir * 3.5; dummy.rotation.set(0, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0); }
    dummy.position.set(c.x, 0, c.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    carBody.setMatrixAt(k, dummy.matrix); carTop.setMatrixAt(k, dummy.matrix); carLights.setMatrixAt(k, dummy.matrix);
  });
  carBody.instanceMatrix.needsUpdate = carTop.instanceMatrix.needsUpdate = carLights.instanceMatrix.needsUpdate = true;
}

/* ---------------- sky + lights ---------------- */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = clamp(vP.y * 1.8, 0.0, 1.0); gl_FragColor = vec4(mix(hor, top, pow(h, 0.65)), 1.0);\n#include <colorspace_fragment>\n}',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), skyMat);
sky.renderOrder = -1;
scene.add(sky);
const discMat = new THREE.MeshBasicMaterial({ fog: false, transparent: true, depthWrite: false });
const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), discMat);
scene.add(disc);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
const sun = new THREE.DirectionalLight(0xffffff, 2);
scene.add(hemi, sun, sun.target);
const head = new THREE.SpotLight(0xfff0d0, 0, 90, 0.48, 0.6, 1.1);
head.position.set(0, -0.4, 0.5);
head.target.position.set(0, -2.2, -20);
camera.add(head, head.target);

const PRESETS = {
  afternoon: { top: '#4f97bd', hor: '#bcdadc', fogNear: 80, fogFar: 360, sun: '#fff2d8', sunI: 2.3, dir: [0.35, 1, 0.25], hemiS: '#d8eef0', hemiG: '#5d5c4e', hemiI: 1.15, night: 0, disc: '#fff6dc', discS: 0 },
  golden:    { top: '#9b5f86', hor: '#f3a06a', fogNear: 50, fogFar: 300, sun: '#ffa955', sunI: 2.7, dir: [-0.25, 0.14, -1], hemiS: '#f7b48a', hemiG: '#4a2c38', hemiI: 0.85, night: 0.12, disc: '#ffd48f', discS: 26 },
  night:     { top: '#040917', hor: '#15233b', fogNear: 25, fogFar: 230, sun: '#7d93c8', sunI: 0.35, dir: [0.3, 0.75, -0.6], hemiS: '#2c3f6a', hemiG: '#090a12', hemiI: 0.5, night: 1, disc: '#e8ecf5', discS: 9 },
};
const toState = (p) => ({ ...p, top: new THREE.Color(p.top), hor: new THREE.Color(p.hor), sun: new THREE.Color(p.sun), hemiS: new THREE.Color(p.hemiS), hemiG: new THREE.Color(p.hemiG), disc: new THREE.Color(p.disc), dir: new THREE.Vector3(...p.dir).normalize() });
const STATES = Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, toState(p)]));
const cloneState = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.clone ? v.clone() : v]));
const cur = cloneState(STATES.afternoon);
let from = cloneState(cur), to = STATES.afternoon, lt = 1;
function setLight(name) { from = cloneState(cur); to = STATES[name]; lt = 0; }
function stepLight(dt) {
  if (lt < 1) {
    lt = Math.min(1, lt + dt / 2);
    const e = lt * lt * (3 - 2 * lt);
    for (const k in cur) {
      if (cur[k].isColor) cur[k].lerpColors(from[k], to[k], e);
      else if (cur[k].isVector3) cur[k].lerpVectors(from[k], to[k], e).normalize();
      else cur[k] = from[k] + (to[k] - from[k]) * e;
    }
  }
  scene.background = cur.hor;
  scene.fog.color.copy(cur.hor); scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
  skyMat.uniforms.top.value.copy(cur.top); skyMat.uniforms.hor.value.copy(cur.hor);
  sun.color.copy(cur.sun); sun.intensity = cur.sunI;
  sun.target.position.copy(camera.position); sun.position.copy(camera.position).addScaledVector(cur.dir, 100);
  hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI;
  disc.visible = cur.discS > 0.5;
  disc.position.copy(camera.position).addScaledVector(cur.dir, 420); disc.lookAt(camera.position); disc.scale.setScalar(cur.discS);
  discMat.color.copy(cur.disc);
  const n = cur.night;
  winMat.emissiveIntensity = n * 1.1;
  poolMat.opacity = n * 0.55;
  lampHeadMat.color.setRGB(0.33 + 0.67 * n, 0.33 + 0.5 * n, 0.35 + 0.2 * n);
  carLightMat.color.setScalar(0.35 + 0.65 * n);
  head.intensity = n * 70;
  sky.position.copy(camera.position);
}

/* ---------------- driving ---------------- */
const car = { x: 4 * CELL + 3.5, z: 3 * CELL + CELL * 0.75, h: 0, v: 0, steer: 0 };
const keys = { up: false, down: false, left: false, right: false };
const R = 1.1;
function blocked(x, z) {
  if (x < -HALF + R || x > W + HALF - R || z < -HALF + R || z > W + HALF - R) return true;
  const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const lx = x - i * CELL, lz = z - j * CELL;
  return lx > HALF - R && lx < CELL - HALF + R && lz > HALF - R && lz < CELL - HALF + R;
}
function drive(dt) {
  const MAXF = 26, MAXR = 7;
  if (keys.up) car.v += (car.v < 0 ? 22 : 11 * (1 - car.v / (MAXF * 1.15))) * dt;
  if (keys.down) car.v -= (car.v > 0.3 ? 24 : 7) * dt;
  if (!keys.up && !keys.down) car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 3.5 * dt);
  car.v = Math.max(-MAXR, Math.min(MAXF, car.v));
  const target = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
  car.steer += (target - car.steer) * Math.min(1, dt * 6);
  car.h += car.steer * 1.4 * Math.max(-1, Math.min(1, car.v / 6)) * (1 - Math.min(1, Math.abs(car.v) / MAXF) * 0.45) * dt;

  const nx = car.x - Math.sin(car.h) * car.v * dt, nz = car.z - Math.cos(car.h) * car.v * dt;
  let hit = false;
  if (!blocked(nx, car.z)) car.x = nx; else hit = true;
  if (!blocked(car.x, nz)) car.z = nz; else hit = true;
  for (const c of cars) {
    const dx = car.x - c.x, dz = car.z - c.z, lim = c.axis === 0 ? [2.1, 3.3] : [3.3, 2.1];
    if (Math.abs(dx) < lim[0] && Math.abs(dz) < lim[1]) {
      car.v *= 0.92; // traffic nudges you aside instead of throwing you backwards
      const d = Math.hypot(dx, dz) || 1;
      const px = car.x + (dx / d) * 0.6, pz = car.z + (dz / d) * 0.6;
      if (!blocked(px, pz)) { car.x = px; car.z = pz; }
    }
  }
  if (hit) car.v *= -0.3;

  camera.position.set(car.x, 1.25, car.z);
  camera.rotation.set(-0.035, car.h, -car.steer * Math.min(1, Math.abs(car.v) / 26) * 0.03);
}

/* ---------------- HUD refs ---------------- */
const ui = {
  speed: $('speed'), wheel: $('wheel'), where: $('where'), icon: $('icon'), ledTitle: $('ledTitle'), ledSub: $('ledSub'),
  play: $('play'), playIcon: $('playIcon'), mute: $('mute'), muteIcon: $('muteIcon'), vinyl: $('vinyl'), vnum: $('vnum'),
  title: $('title'), meta: $('meta'), soon: $('soon'), lyrics: $('lyrics'), start: $('start'), game: $('game'),
};
const LOOK = { afternoon: ['#a9cbd0', '#13232a'], golden: ['#e39a52', '#24130a'], night: ['#1f3a5f', '#f2a945'] };
const pad = (n) => String(n).padStart(2, '0');
const fmt = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

/* ---------------- radio ---------------- */
const S = { i: Math.max(0, Math.min(9, (+qs.get('track') || 1) - 1)), playing: false, muted: AUTOSTART, started: false, audio: null, sim: false, simT: 0 };
let actx = null, noise = null, lines = [], curLine = -1, lastSub = '';
const track = () => TRACKS[S.i];
const dur = () => {
  const a = S.audio;
  return !S.sim && a && isFinite(a.duration) && a.duration > 0 ? a.duration : toSeconds(track().len);
};
const now = () => (S.sim || !S.audio ? S.simT : S.audio.currentTime);
const progress = () => Math.min(1, now() / dur());

function staticBurst() {
  if (!actx || S.muted) return;
  if (!noise) {
    const len = Math.floor(actx.sampleRate * 0.3);
    noise = actx.createBuffer(1, len, actx.sampleRate);
    const d = noise.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len) * (0.6 + 0.4 * Math.sin(k / 90));
  }
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.6; g.gain.value = 0.07;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
}
function goSim(a) {
  if (a !== S.audio || S.sim) return;
  S.sim = true; S.simT = Math.min(a.currentTime || 0, toSeconds(track().len));
  ui.soon.hidden = false;
}
function startAudio(a) {
  a.play().catch((err) => { if (err.name !== 'AbortError') goSim(a); });
}
function loadTrack(i) {
  if (S.audio) { S.audio.pause(); S.audio.removeAttribute('src'); S.audio.load(); }
  S.i = (i + TRACKS.length) % TRACKS.length;
  const t = track(), a = new Audio();
  S.audio = a; S.sim = false; S.simT = 0; ui.soon.hidden = true;
  a.preload = 'auto'; a.volume = 0.6; a.muted = S.muted;
  a.addEventListener('error', () => goSim(a));
  a.addEventListener('ended', () => { if (a === S.audio) loadTrack(S.i + 1); });
  a.src = audioSrc(t);
  if (ui.soon.dataset.n != t.n) { ui.soon.dataset.n = t.n; ui.soon.src = embedSrc(t); }
  renderTrack(t);
  setLight(t.light);
  if (S.playing) {
    staticBurst();
    setTimeout(() => { if (a === S.audio && S.playing && !S.sim) startAudio(a); }, 260);
  }
}
function setPlaying(on) {
  S.playing = on;
  if (on && !S.sim) startAudio(S.audio);
  if (!on) S.audio.pause();
  playUi(on);
}
function playUi(on) {
  ui.vinyl.classList.toggle('on', on);
  ui.play.setAttribute('aria-pressed', on);
  ui.play.setAttribute('aria-label', on ? 'Pause (Space)' : 'Play (Space)');
  ui.playIcon.setAttribute('d', on ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M7 5v14l12-7z');
}
function setMuted(m) {
  S.muted = m;
  if (S.audio) S.audio.muted = m;
  ui.mute.setAttribute('aria-pressed', m);
  ui.mute.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
  ui.muteIcon.setAttribute('d', m ? 'M15.5 9l5 6m0-6l-5 6' : 'M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12');
}

function renderTrack(t) {
  const [bg, fg] = LOOK[t.light];
  for (const el of [ui.icon, ui.vinyl]) { el.style.setProperty('--icon-bg', bg); el.style.setProperty('--icon-fg', fg); }
  ui.icon.textContent = pad(t.n);
  ui.vnum.textContent = pad(t.n);
  ui.ledTitle.textContent = `${pad(t.n)}  ${t.title}`;
  ui.title.textContent = t.title;
  ui.meta.textContent = `${t.type} · ${t.len} · ${LIGHTS[t.light].label}`;
  ui.where.textContent = `${LIGHTS[t.light].label} · ${LIGHTS[t.light].range}`;
  lastSub = '';
  const box = ui.lyrics, p = (cls, text) => { const e = document.createElement('p'); e.className = cls; e.textContent = text; return e; };
  box.replaceChildren();
  lines = []; curLine = -1;
  if (t.lyrics) {
    for (const raw of t.lyrics.split('\n')) {
      const s = raw.trim();
      if (!s) box.append(p('gap', ''));
      else if (s.startsWith('[')) box.append(p('hd', s.replace(/^\[|\]$/g, '')));
      else { const e = p('ln', s); box.append(e); lines.push(e); }
    }
  } else box.append(p('hd', 'Instrumental'), p('note', t.notes));
  box.scrollTop = 0;
}
function updateLyrics() {
  if (!lines.length) return;
  const k = Math.min(lines.length - 1, Math.floor(progress() * lines.length));
  if (k === curLine) return;
  lines[curLine]?.classList.remove('now');
  lines[k].classList.add('now');
  curLine = k;
  const el = lines[k], box = ui.lyrics;
  box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2, behavior: reduced.matches ? 'auto' : 'smooth' });
}
function updateHud() {
  const mph = String(Math.round(Math.abs(car.v) * 2.237));
  if (ui.speed.textContent !== mph) ui.speed.textContent = mph;
  ui.wheel.style.transform = `rotate(${-car.steer * 120}deg)`;
  const t = track(), sub = `Side ${t.n <= 5 ? 'A' : 'B'} · ${fmt(now())} / ${fmt(dur())}`;
  if (sub !== lastSub) { ui.ledSub.textContent = sub; lastSub = sub; }
}

/* ---------------- input ---------------- */
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (!S.started || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = KEYMAP[e.code];
  if (k) { keys[k] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  const onButton = e.target instanceof HTMLButtonElement;
  if (e.code === 'Space' && !onButton) { e.preventDefault(); setPlaying(!S.playing); }
  else if (e.code === 'KeyQ') loadTrack(S.i - 1);
  else if (e.code === 'KeyE') loadTrack(S.i + 1);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  setTimeout(() => { if (document.activeElement === ui.soon) ui.game.focus(); }, 0);
});

$('prev').addEventListener('click', () => loadTrack(S.i - 1));
$('next').addEventListener('click', () => loadTrack(S.i + 1));
ui.play.addEventListener('click', () => setPlaying(!S.playing));
ui.mute.addEventListener('click', () => setMuted(!S.muted));

if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) {
  $('touch').hidden = false;
  for (const b of document.querySelectorAll('.tbtn')) {
    const k = b.dataset.key, set = (on) => { keys[k] = on; b.classList.toggle('on', on); };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => set(false));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

function begin() {
  if (S.started) return;
  S.started = true;
  ui.start.hidden = true;
  ui.game.removeAttribute('inert');
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; }
  S.playing = true;
  loadTrack(S.i);
  playUi(true);
}
$('go').addEventListener('click', begin);

/* ---------------- loop ---------------- */
let last = performance.now(), raf = 0, idleH = 0;
function frame(t) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  // idle: only the camera pans, the car keeps facing down the road
  if (S.started) drive(dt); else { idleH += dt * 0.04; camera.position.set(car.x, 1.25, car.z); camera.rotation.set(-0.035, car.h + Math.sin(idleH) * 0.6, 0); }
  moveTraffic(dt);
  stepLight(dt);
  if (S.playing && S.sim) { S.simT += dt; if (S.simT >= dur()) loadTrack(S.i + 1); }
  updateLyrics();
  updateHud();
  renderer.render(scene, camera);
}
// rAF already pauses itself in hidden tabs, so the loop always starts

setMuted(S.muted);
loadTrack(S.i);
lt = 1; Object.assign(cur, cloneState(STATES[track().light])); // first paint: no fade
if (AUTOSTART) begin(); else ui.game.setAttribute('inert', '');
raf = requestAnimationFrame(frame);
