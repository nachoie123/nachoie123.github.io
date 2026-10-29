// Drive · Going Nowhere Fast. First-person drive down a palm-lined Art Deco boulevard while the album plays.
// Everything is built in code (geometry, canvas textures, shaders): no downloaded models or textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search);
const AUTOSTART = qs.get('autostart') === '1'; // testing only: skips the overlay, audio muted
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// phones, small panes and weak CPUs: no post-processing, smaller shadows, fewer props
const LOW = qs.get('low') === '1' || matchMedia('(max-width: 759px), (pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const V3 = THREE.Vector3, D2R = Math.PI / 180;

/* ---------------- renderer ---------------- */
const host = $('drive');
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: LOW, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // updated once per frame, so the mirror render does not redo it
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8936a, 40, 520);
const FOV = 60;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 2600);
camera.rotation.order = 'YXZ';
scene.add(camera);

let composer = null, bloom = null, grain = null;
if (!LOW) {
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grain = new ShaderPass({ // 35mm grain on top of the tone-mapped image
    uniforms: { tDiffuse: { value: null }, t: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float t; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = fract(sin(dot(gl_FragCoord.xy + t * 61.7, vec2(12.9898, 78.233))) * 43758.5453); c.rgb += (n - 0.5) * 0.045; gl_FragColor = c; }',
  });
  composer.addPass(grain);
}

/* ---------------- helpers ---------------- */
const N = 8, CELL = 72, ROAD = 18, HALF = ROAD / 2, SIDE = 3, W = N * CELL;
let seed = 1994;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const dummy = new THREE.Object3D();
const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const paint = (g, c) => { const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let v = 0; v < a.length; v += 3) col.toArray(a, v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const flat = (g) => (g.index ? g.toNonIndexed() : g);
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, srgb = true, rep = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };

function instanced(geo, mat, items, place, { cast = true, receive = false } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  items.forEach((it, k) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); place(it, k); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix); });
  m.castShadow = cast; m.receiveShadow = receive;
  scene.add(m);
  return m;
}

// a smooth tube along points with a radius profile r(t) and a colour profile; the end closes when r reaches 0
function sweep(pts, rFn, { radial = 12, seg = 28, colFn, warp = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const pos = [], col = [], idx = [], p = new V3(), T = new V3(), nv = new V3(), B = new V3();
  const Nn = new V3().crossVectors(curve.getTangentAt(0), Math.abs(curve.getTangentAt(0).y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize();
  for (let i = 0; i <= seg; i++) {
    const t = 1 - Math.pow(1 - i / seg, warp);
    curve.getPointAt(t, p); curve.getTangentAt(t, T);
    Nn.addScaledVector(T, -Nn.dot(T)).normalize(); B.crossVectors(T, Nn);
    const r = rFn(t), c = colFn ? colFn(t) : [1, 1, 1];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      nv.copy(Nn).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(p.x + nv.x * r, p.y + nv.y * r, p.z + nv.z * r); col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal, s = new V3();
  for (let i = 0; i <= seg; i++) { // weld the seam
    const a = i * (radial + 1), b = a + radial;
    s.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, s.x, s.y, s.z); n.setXYZ(b, s.x, s.y, s.z);
  }
  return g;
}
function ellipsoid(c, ax, ay, az, rx, ry, rz, col = [1, 1, 1]) {
  const g = new THREE.SphereGeometry(1, 22, 16); g.deleteAttribute('uv');
  const z = az.clone().multiplyScalar(new V3().crossVectors(ax, ay).dot(az) < 0 ? -rz : rz); // keep the basis right-handed or the faces turn inside out
  g.applyMatrix4(new THREE.Matrix4().makeBasis(ax.clone().multiplyScalar(rx), ay.clone().multiplyScalar(ry), z).setPosition(c));
  return paint(g, new THREE.Color(...col));
}
// orient a unit-height mesh (y from 0 to 1) from a to b
const UP = new V3(0, 1, 0), _d = new V3();
function span(m, a, b, extra = 0) {
  _d.subVectors(b, a); const len = _d.length() + extra; _d.normalize();
  m.position.copy(a); m.quaternion.setFromUnitVectors(UP, _d); m.scale.set(1, len, 1);
}

/* ---------------- canvas textures ---------------- */
function noiseCanvas(size, base, amp, fn) {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size), d = img.data;
  for (let k = 0; k < size * size; k++) {
    const x = k % size, y = (k / size) | 0, v = (Math.random() - 0.5) * amp + (fn ? fn(x, y) : 0);
    d[k * 4] = base[0] + v; d[k * 4 + 1] = base[1] + v; d[k * 4 + 2] = base[2] + v; d[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return [c, g];
}
const asphalt = (() => {
  const blobs = Array.from({ length: 14 }, () => [Math.random() * 512, Math.random() * 512, 30 + Math.random() * 70, (Math.random() - 0.5) * 14]);
  const [c, g] = noiseCanvas(512, [58, 58, 61], 26, (x, y) => blobs.reduce((s, [bx, by, r, v]) => s + v * Math.max(0, 1 - Math.hypot(x - bx, y - by) / r), 0));
  g.strokeStyle = 'rgba(20,20,22,.55)'; g.lineWidth = 1.2;
  for (let k = 0; k < 6; k++) { g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  return tex(c);
})();
const concrete = (() => {
  const [c, g] = noiseCanvas(256, [168, 163, 154], 22);
  g.strokeStyle = 'rgba(70,66,60,.55)'; g.lineWidth = 2;
  for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  return tex(c);
})();
// facade: 4 windows x 4 floors per repeat. lit = night emissive map, rm = roughness (G) + metalness (B) map
function facade(kind) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = kind === 'lit' ? '#000' : kind === 'rm' ? 'rgb(0,220,0)' : '#efe9e0'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const x = k * 64 + 12, y = r * 64 + 16;
    if (kind === 'lit') { if (rnd() < 0.45) { g.fillStyle = pick(['#ffd27a', '#ffc35e', '#ffe3a8', '#f6a94e', '#bfd8ff']); g.fillRect(x, y, 40, 34); } }
    else if (kind === 'rm') { g.fillStyle = 'rgb(0,80,25)'; g.fillRect(x, y, 40, 34); }
    else {
      g.fillStyle = '#4f6273'; g.fillRect(x, y, 40, 34);
      g.fillStyle = '#7d93a6'; g.fillRect(x, y, 40, 8);
      g.fillStyle = '#d9d3c8'; g.fillRect(x - 3, y + 34, 46, 5); g.fillRect(x + 19, y, 2, 34);
    }
  }
  if (kind === 'map') { g.fillStyle = 'rgba(0,0,0,.08)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 64 + 58, 256, 6); }
  return tex(c, kind === 'map');
}
const frondTex = (() => {
  const [c, g] = canvas(128, 512);
  g.lineCap = 'round';
  for (let y = 500; y > 6; y -= 6) {
    const s = 1 - y / 512, len = 62 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.92)), 0.6);
    for (const side of [-1, 1]) {
      g.strokeStyle = pick(['#3e5a2a', '#4a6a2e', '#56763a', '#354e24', '#5d7a3c']);
      g.lineWidth = 3.4 - s * 1.6;
      g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + side * len * 0.6, y - len * 0.3, 64 + side * len, y - len * 0.75); g.stroke();
    }
  }
  g.strokeStyle = '#6b6a3c'; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 512); g.lineTo(64, 4); g.stroke();
  return tex(c, true, false);
})();
const glowTex = (() => {
  const [c, g] = canvas(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,205,130,1)'); gr.addColorStop(0.45, 'rgba(255,170,80,.45)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c, true, false);
})();

/* ---------------- town ---------------- */
const blocks = [];
for (let i = -1; i <= N; i++) for (let j = -1; j <= N; j++) {
  const inner = i >= 0 && j >= 0 && i < N && j < N;
  blocks.push({ i, j, inner, x0: i * CELL + HALF, z0: j * CELL + HALF, s: CELL - ROAD, park: inner && (i === 4 || (rnd() < 0.1 && i !== 3)) }); // i = 4: open palm promenade east of the start road
}
asphalt.repeat.set(500, 500);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), std(0xffffff, { map: asphalt, roughness: 0.82 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, W / 2); ground.receiveShadow = true;
scene.add(ground);

const box = new THREE.BoxGeometry(1, 1, 1);
concrete.repeat.set(30, 30);
instanced(box, std(0xffffff, { map: concrete, roughness: 0.9 }), blocks, (b) => { dummy.position.set(b.x0 + b.s / 2, 0.09, b.z0 + b.s / 2); dummy.scale.set(b.s, 0.18, b.s); }, { cast: false, receive: true });
const parks = blocks.filter((b) => b.park);
instanced(box, std(0x5f8a45, { roughness: 1 }), parks, (b) => { dummy.position.set(b.x0 + b.s / 2, 0.2, b.z0 + b.s / 2); dummy.scale.set(b.s - 2 * SIDE, 0.06, b.s - 2 * SIDE); }, { cast: false, receive: true });

// road paint: double yellow centre, white parking-lane lines, crosswalks
const yellow = [], white = [];
for (let k = 0; k <= N; k++) for (let j = 0; j < N; j++) {
  const a = j * CELL + HALF + 3.5, len = CELL - ROAD - 7, mid = a + len / 2;
  for (const o of [-0.17, 0.17]) { yellow.push([k * CELL + o, mid, 0.13, len, 0], [mid, k * CELL + o, 0.13, len, 1]); }
  for (const o of [-5.8, 5.8]) { white.push([k * CELL + o, mid, 0.14, len, 0], [mid, k * CELL + o, 0.14, len, 1]); }
}
for (let a = 0; a <= N; a++) for (let b = 0; b <= N; b++) for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let s = -7; s <= 7; s += 1.75) {
  const d = HALF + 1.8;
  white.push(sx ? [a * CELL + sx * d, b * CELL + s, 0.55, 3, 1] : [a * CELL + s, b * CELL + sz * d, 0.55, 3, 0]);
}
const stripe = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const placeStripe = ([x, z, w, l, t]) => { dummy.position.set(x, 0.015, z); dummy.rotation.y = t ? Math.PI / 2 : 0; dummy.scale.set(w, 1, l); };
const paintMat = (c) => std(c, { roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
instanced(stripe, paintMat(0xd9a92e), yellow, placeStripe, { cast: false, receive: true });
instanced(stripe, paintMat(0xe8e6df), white, placeStripe, { cast: false, receive: true });

// buildings: pastel Art Deco low-rises with ledges near the street, a few concrete mid-rises in the middle
const PASTEL = ['#8fd0c6', '#f0b3bd', '#f2dfc0', '#b9dfe6', '#f4c9a0', '#cbb8e0', '#9cc9a8', '#f7d6d0', '#a8d8d0', '#f5e6a8'].map((c) => new THREE.Color(c));
const TOWER = ['#9aa5ad', '#b9b2a6', '#7f8d99', '#c7c2b8', '#8a96a0', '#a9a39a'].map((c) => new THREE.Color(c));
const TW = 12.8, TH = 14, WALL = [0.01, 0.01];
function facadeBox(w, h, d, x, y, z, col, ou, plain) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, cols = new Float32Array(72), c = new THREE.Color();
  for (let v = 0; v < 24; v++) {
    const f = v >> 2;
    if (plain || f === 2 || f === 3) uv.setXY(v, ...WALL);
    else uv.setXY(v, uv.getX(v) * (f < 2 ? d : w) / TW + ou, uv.getY(v) * h / TH);
    const yy = g.attributes.position.getY(v) + h / 2 + y - h / 2; // world height of this vertex
    c.copy(col).multiplyScalar(0.78 + 0.22 * Math.min(1, yy / 10)).toArray(cols, v * 3); // ground-level occlusion
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g.translate(x, y, z);
}
const parts = [];
for (const b of blocks) {
  if (b.park) continue;
  const inX = b.x0 + SIDE, inZ = b.z0 + SIDE, inS = b.s - 2 * SIDE;
  const down = Math.max(0, 1 - Math.hypot((b.i + 0.5) * CELL - W / 2, (b.j + 0.5) * CELL - W / 2) / (W * 0.42));
  const nx = 1 + Math.floor(rnd() * 3), nz = 1 + Math.floor(rnd() * 3), lw = inS / nx, ld = inS / nz;
  for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
    const w = lw - 1 - rnd() * 2.5, d = ld - 1 - rnd() * 2.5, cx = inX + lw * (a + 0.5), cz = inZ + ld * (c + 0.5);
    const tall = rnd() < 0.06 + down * 0.3, floors = tall ? 6 + Math.floor(rnd() * (4 + down * 8)) : 2 + Math.floor(rnd() * 3), h = floors * 3.5;
    const col = (tall ? pick(TOWER) : pick(PASTEL)).clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.05), ou = Math.floor(rnd() * 4) / 4;
    parts.push(facadeBox(w, h, d, cx, h / 2, cz, col, ou));
    const trim = col.clone().lerp(new THREE.Color('#f6f3ec'), 0.7);
    if (!tall) {
      for (let f = 1; f <= floors; f++) parts.push(facadeBox(w + 0.8, 0.22, d + 0.8, cx, f * 3.5 - 0.05, cz, trim, 0, true));
      parts.push(facadeBox(w * 0.5, 1.8, d * 0.35, cx, h + 0.9, cz, col.clone().multiplyScalar(0.92), 0, true)); // stepped parapet
      if (rnd() < 0.5) parts.push(facadeBox(0.5, h * 0.75 + 3, 1.6, cx + (w / 2 + 0.25) * (rnd() < 0.5 ? 1 : -1), h * 0.375 + 1.5, cz, trim, 0, true)); // vertical fin
    } else parts.push(facadeBox(w * 0.7, 3, d * 0.7, cx, h + 1.5, cz, col.clone().multiplyScalar(0.9), 0, true));
  }
}
const winMat = new THREE.MeshStandardMaterial({ map: facade('map'), emissiveMap: facade('lit'), emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: facade('rm'), metalnessMap: facade('rm'), roughness: 1, metalness: 1, vertexColors: true });
const buildings = new THREE.Mesh(mergeGeometries(parts), winMat);
buildings.castShadow = buildings.receiveShadow = true;
scene.add(buildings);
parts.forEach((g) => g.dispose());

// far skyline: backlit towers and a ridge, fading into haze at the bottom
const skyUniforms = { sil: { value: new THREE.Color() }, haze: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new V3() }, night: { value: 0 }, win: { value: facade('lit') } };
const skylineMat = (fade) => new THREE.ShaderMaterial({
  uniforms: { ...skyUniforms, fade: { value: fade } },
  vertexShader: 'varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform vec3 sil, haze, glow, sunDir; uniform float night, fade; uniform sampler2D win; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
    void main(){
      float h = clamp(vW.y / 170.0, 0.0, 1.0);
      vec3 c = mix(haze, sil, (0.35 + 0.65 * smoothstep(0.0, 0.6, h)) * (1.0 - fade));
      c += glow * max(dot(vN, sunDir), 0.0) * 0.4 * (1.0 - fade);
      c += vec3(1.0, 0.78, 0.45) * texture2D(win, vUv).r * smoothstep(0.4, 1.0, night) * 0.55 * (1.0 - fade);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
{
  const towers = [], add = (x, z, h) => {
    const w = 14 + rnd() * 26, d = 14 + rnd() * 22, g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let v = 0; v < 24; v++) uv.setXY(v, uv.getX(v) * w / 9, uv.getY(v) * h / 12);
    towers.push(g.translate(x, h / 2, z));
    if (rnd() < 0.4) towers.push(new THREE.BoxGeometry(w * 0.55, h * 0.18, d * 0.55).translate(x, h + h * 0.09, z));
  };
  for (let k = 0; k < 70; k++) { const dx = (rnd() - 0.5) * 2, x = W / 2 + 40 + dx * 300, z = -470 + (rnd() - 0.5) * 220; add(x, z, 60 + (1 - Math.abs(dx)) * 170 * rnd() + rnd() * 40); }
  for (let k = 0; k < 110; k++) { const a = rnd() * Math.PI * 2, r = 560 + rnd() * 300; add(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r, 25 + rnd() * rnd() * 140); }
  const sky = new THREE.Mesh(mergeGeometries(towers), skylineMat(0)); sky.frustumCulled = false; scene.add(sky);
  const ridge = new THREE.CylinderGeometry(1500, 1500, 1, 160, 1, true), p = ridge.attributes.position;
  for (let v = 0; v < p.count; v++) if (p.getY(v) > 0) { const a = Math.atan2(p.getZ(v), p.getX(v)); p.setY(v, 40 + 70 * Math.abs(Math.sin(a * 3.1) + 0.6 * Math.sin(a * 7.3 + 1) + 0.3 * Math.sin(a * 17.9))); } else p.setY(v, -5);
  ridge.computeVertexNormals(); ridge.translate(W / 2, 0, W / 2);
  const rm = new THREE.Mesh(ridge, skylineMat(0.55)); rm.material.side = THREE.BackSide; rm.frustumCulled = false; scene.add(rm);
}

// palms: three tall curved variants, frond crowns from a leaf texture
const trunkMat = std(0x7a6450, { roughness: 0.95 });
const frondMat = std(0xffffff, { map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
function palmGeos(H, bend, n) {
  const top = new V3(bend, H, 0);
  const trunk = sweep([new V3(0, 0, 0), new V3(bend * 0.12, H * 0.35, 0), new V3(bend * 0.45, H * 0.7, 0), top], (t) => 0.26 * (1 - 0.38 * t) * (1 + 0.06 * Math.sin(t * 90)), { radial: 7, seg: 14 });
  const boot = new THREE.SphereGeometry(0.42, 8, 6); boot.deleteAttribute('uv'); paint(boot.translate(top.x, top.y - 0.2, 0), 0x9c8a62);
  const fronds = [];
  for (let k = 0; k < n; k++) {
    const L = 3.6 + rnd() * 1.6, pos = [], uv = [], idx = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10, x = s * L, y = L * (0.32 * s - 0.78 * s * s), f = 0.16 * Math.sin(Math.PI * s);
      pos.push(x, y + f, -0.85, x, y, 0, x, y + f, 0.85); uv.push(0, s, 0.5, s, 1, s);
      if (i < 10) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    g.rotateZ(-0.25 + rnd() * 0.6).rotateY((k / n) * Math.PI * 2 + rnd() * 0.3).translate(top.x, top.y, 0);
    fronds.push(g);
  }
  return [mergeGeometries([trunk, boot]), mergeGeometries(fronds)];
}
const palmSpots = [];
for (const b of blocks) {
  if (!b.inner) continue;
  for (let e = 0; e < 4; e++) for (let s = 6; s < b.s - 6; s += 13) {
    if (rnd() > (LOW ? 0.4 : 0.7)) continue;
    const t = s + rnd() * 2;
    palmSpots.push([[b.x0 + t, b.z0 + 1.6], [b.x0 + t, b.z0 + b.s - 1.6], [b.x0 + 2, b.z0 + t], [b.x0 + b.s - 1.6, b.z0 + t]][e]);
  }
  if (b.park) for (let k = 0; k < 7; k++) palmSpots.push([b.x0 + 8 + rnd() * (b.s - 16), b.z0 + 8 + rnd() * (b.s - 16)]);
}
[[11, 1.3, 11], [14, 2.2, 12], [17, 0.9, 12]].forEach(([H, bend, n], v) => {
  const [tg, fg] = palmGeos(H, bend, n), spots = palmSpots.filter((_, k) => k % 3 === v);
  const place = ([x, z], k) => { const f = (Math.sin(k * 12.9898 + v) * 43758.5453) % 1; dummy.position.set(x, 0.18, z); dummy.rotation.y = Math.abs(f) * 6.28; dummy.scale.setScalar(0.85 + Math.abs(f) * 0.3); };
  instanced(tg, trunkMat, spots, place); instanced(fg, frondMat, spots, place);
});

// streetlights at block corners: pole + arm, glowing head, light pool on the road at night
const lamps = [];
for (const b of blocks) {
  if (!b.inner) continue;
  for (const [cx, ox] of [[b.x0 + 1.2, -1], [b.x0 + b.s - 1.2, 1]]) for (const [cz, oz] of [[b.z0 + 1.2, -1], [b.z0 + b.s - 1.2, 1]]) lamps.push({ x: cx, z: cz, ox: ox * Math.SQRT1_2, oz: oz * Math.SQRT1_2 });
}
const metal = std(0x3a3f45, { roughness: 0.5, metalness: 0.6 });
const placeLamp = (l) => { dummy.position.set(l.x, 0.18, l.z); dummy.rotation.y = Math.atan2(-l.oz, l.ox); };
instanced(mergeGeometries([new THREE.CylinderGeometry(0.09, 0.14, 8.4, 6).translate(0, 4.2, 0), new THREE.BoxGeometry(2.8, 0.12, 0.12).translate(1.4, 8.2, 0)]), metal, lamps, placeLamp);
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x55575c });
instanced(new THREE.BoxGeometry(0.9, 0.2, 0.45).translate(2.7, 8.1, 0), lampHeadMat, lamps, placeLamp, { cast: false });
const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
instanced(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), poolMat, lamps, (l) => dummy.position.set(l.x + l.ox * 3.6, 0.21, l.z + l.oz * 3.6), { cast: false });

// wooden power poles with sagging wires along the east side of every north-south road
const poles = [], wire = [];
for (let k = 0; k <= N; k++) {
  let prev = null;
  for (let j = -1; j <= N; j++) for (const o of [8, 27, 46]) {
    const p = new V3(k * CELL + HALF + 0.6, 0, j * CELL + HALF + o); poles.push(p);
    if (prev) for (const dx of [-1, 0, 1]) for (let s = 0; s < 8; s++) {
      const y = (t) => 9.7 - 0.7 * Math.sin(Math.PI * t) - (dx === 0 ? 0.35 : 0);
      const t0 = s / 8, t1 = (s + 1) / 8;
      wire.push(p.x + dx, y(t0), prev.z + (p.z - prev.z) * t0, p.x + dx, y(t1), prev.z + (p.z - prev.z) * t1);
    }
    prev = p;
  }
}
instanced(mergeGeometries([new THREE.CylinderGeometry(0.12, 0.16, 10.4, 6).translate(0, 5.2, 0), new THREE.BoxGeometry(2.4, 0.14, 0.14).translate(0, 9.8, 0), new THREE.BoxGeometry(1.6, 0.12, 0.12).translate(0, 9.1, 0)]), std(0x5a4a3c, { roughness: 1 }), poles, (p) => dummy.position.copy(p));
{
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x15161a })));
}

// overhead green signs on a few boulevards
const signTex = (() => {
  const [c, g] = canvas(1024, 512);
  const sign = (y, big, small) => {
    g.fillStyle = '#12613a'; g.fillRect(0, y, 1024, 256);
    g.strokeStyle = '#f2f2ec'; g.lineWidth = 10; g.strokeRect(14, y + 14, 996, 228);
    g.fillStyle = '#f2f2ec'; g.textAlign = 'center';
    g.font = 'bold 96px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.fillText(big, 512, y + 128);
    g.font = 'bold 54px "Helvetica Neue", Helvetica, Arial, sans-serif'; g.fillText(small, 512, y + 210);
  };
  sign(0, 'Slow Light Ave', 'NEXT EXIT  ↑');
  sign(256, 'Screen Door Blvd', '1/2 MILE');
  return tex(c, true, false);
})();
const signMat = std(0xffffff, { map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0, roughness: 0.55 });
{
  const frame = [], panels = [], back = [];
  for (const [k, j] of [[4, 2], [4, 0], [4, 5], [1, 3], [7, 1], [6, 6], [2, 6]]) {
    const X = k * CELL, Z = j * CELL + CELL / 2;
    for (const s of [-1, 1]) frame.push(new THREE.CylinderGeometry(0.2, 0.24, 8.6, 8).translate(X + s * 9.8, 4.3, Z));
    frame.push(new THREE.BoxGeometry(20, 0.45, 0.45).translate(X, 8.2, Z), new THREE.BoxGeometry(20, 0.25, 0.25).translate(X, 7.1, Z));
    for (const [s, v0] of [[1, 0.5], [-1, 0]]) {
      const p = new THREE.PlaneGeometry(5.4, 2.7), uv = p.attributes.uv;
      for (let v = 0; v < 4; v++) uv.setY(v, v0 + uv.getY(v) * 0.5);
      if (s < 0) p.rotateY(Math.PI);
      panels.push(p.translate(X + s * 3.6, 7.7, Z + s * 0.32));
      back.push(new THREE.BoxGeometry(5.6, 2.9, 0.12).translate(X + s * 3.6, 7.7, Z + s * 0.22));
    }
  }
  const fm = new THREE.Mesh(mergeGeometries([...frame, ...back].map(flat)), std(0x8d949b, { roughness: 0.45, metalness: 0.7 }));
  const pm = new THREE.Mesh(mergeGeometries(panels), signMat);
  fm.castShadow = pm.castShadow = true;
  scene.add(fm, pm);
}

/* ---------------- cars: sedans, SUVs and pickups ---------------- */
function carGeo(L, Wd, lower, cabin, roof, tailTall) {
  const ext = (pts, depth, z0, c) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
    g.deleteAttribute('uv'); return paint(g.translate(0, 0, z0), c);
  };
  const body = [ext(lower, Wd - 0.12, -(Wd - 0.12) / 2, 0xffffff), ext(cabin, Wd - 0.4, -(Wd - 0.4) / 2, 0x0b0d10)];
  const rf = new THREE.BoxGeometry(roof[1], 0.06, Wd - 0.36); rf.deleteAttribute('uv'); body.push(paint(flat(rf).translate(roof[0], roof[2], 0), 0xffffff));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 14).rotateX(Math.PI / 2); t.deleteAttribute('uv');
    const h = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10).rotateX(Math.PI / 2); h.deleteAttribute('uv');
    body.push(paint(flat(t).translate(sx * (L / 2 - 0.85), 0.37, sz * (Wd / 2 - 0.1)), 0x101012), paint(flat(h).translate(sx * (L / 2 - 0.85), 0.37, sz * (Wd / 2 - 0.08)), 0x8a8a8a));
  }
  const lights = [];
  for (const sz of [-1, 1]) {
    const hl = new THREE.BoxGeometry(0.06, 0.15, 0.44); hl.deleteAttribute('uv');
    const tl = new THREE.BoxGeometry(0.06, tailTall ? 0.42 : 0.17, tailTall ? 0.16 : 0.42); tl.deleteAttribute('uv');
    lights.push(paint(flat(hl).translate(L / 2 + 0.05, lower[2][1] - 0.08, sz * (Wd / 2 - 0.32)), '#fff1d0'), paint(flat(tl).translate(-L / 2 - 0.05, lower[lower.length - 2][1] - (tailTall ? 0.3 : 0.12), sz * (Wd / 2 - 0.22)), '#ff2216'));
  }
  return [mergeGeometries(body).rotateY(Math.PI / 2), mergeGeometries(lights).rotateY(Math.PI / 2)]; // front ends up at -z
}
const CAR_TYPES = [
  carGeo(4.6, 1.85, [[-2.3, 0.32], [2.25, 0.32], [2.32, 0.62], [2.2, 0.9], [0.85, 1.0], [-1.55, 1.0], [-2.28, 0.97], [-2.33, 0.6]], [[0.85, 0.96], [0.05, 1.42], [-0.95, 1.42], [-1.6, 0.96]], [-0.45, 1.0, 1.44]),
  carGeo(4.8, 1.95, [[-2.4, 0.42], [2.35, 0.42], [2.42, 0.8], [2.3, 1.1], [1.2, 1.2], [-2.36, 1.2], [-2.42, 0.8]], [[1.2, 1.16], [0.5, 1.8], [-2.25, 1.82], [-2.33, 1.16]], [-0.88, 2.7, 1.84], true),
  carGeo(5.3, 1.95, [[-2.65, 0.45], [2.6, 0.45], [2.68, 0.85], [2.55, 1.12], [1.25, 1.2], [-2.62, 1.2], [-2.67, 0.85]], [[1.25, 1.16], [0.62, 1.74], [-0.5, 1.76], [-0.6, 1.16]], [0.05, 1.1, 1.78], true),
];
const carPaint = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.07 });
const carLightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const CAR_COLORS = ['#8c1c13', '#d8d4cc', '#1f2a36', '#232325', '#6b7a80', '#b59a6a', '#3d5c4a', '#a8b3b9', '#c9c4b8', '#5a2a2a'].map((c) => new THREE.Color(c));
const NC = LOW ? 34 : 54, cars = [], parked = [];
for (let k = 0; k < NC; k++) {
  const axis = k % 2, road = Math.floor(rnd() * (N + 1)), dir = rnd() < 0.5 ? 1 : -1;
  cars.push({ axis, road, dir, s: rnd() * W, speed: 8 + ((axis * 31 + road * 7 + (dir > 0 ? 3 : 0)) % 5) * 1.6, x: 0, z: 0, type: Math.floor(rnd() * 3) });
}
for (let k = 0; k <= N; k++) for (let j = 0; j < N; j++) for (const side of [-1, 1]) for (const axis of [0, 1]) for (let s = j * CELL + HALF + 6; s < (j + 1) * CELL - HALF - 6; s += 6.5) {
  if (rnd() > (LOW ? 0.12 : 0.22)) continue;
  const off = k * CELL + side * 7.6;
  parked.push({ axis, x: axis ? s : off, z: axis ? off : s, rot: axis ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? 0 : Math.PI), type: Math.floor(rnd() * 3) });
}
const fleet = CAR_TYPES.map(([bg, lg], t) => {
  const list = [...cars, ...parked].filter((c) => c.type === t);
  list.forEach((c, k) => (c.slot = k));
  const body = new THREE.InstancedMesh(bg, carPaint, list.length), lights = new THREE.InstancedMesh(lg, carLightMat, list.length);
  list.forEach((c, k) => body.setColorAt(k, CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]));
  body.castShadow = true; body.receiveShadow = true;
  for (const m of [body, lights]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
  return { body, lights };
});
function setCar(c, x, z, rot) {
  dummy.position.set(x, 0, z); dummy.rotation.set(0, rot, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
  fleet[c.type].body.setMatrixAt(c.slot, dummy.matrix); fleet[c.type].lights.setMatrixAt(c.slot, dummy.matrix);
}
parked.forEach((c) => setCar(c, c.x, c.z, c.rot));
function moveTraffic(dt) {
  const L = W + 40;
  for (const c of cars) {
    c.s = ((c.s + c.dir * c.speed * dt + 20) % L + L) % L - 20;
    if (c.axis === 0) { c.x = c.road * CELL - c.dir * 3.5; c.z = c.s; setCar(c, c.x, c.z, c.dir < 0 ? 0 : Math.PI); }
    else { c.x = c.s; c.z = c.road * CELL + c.dir * 3.5; setCar(c, c.x, c.z, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2); }
  }
  for (const f of fleet) f.body.instanceMatrix.needsUpdate = f.lights.instanceMatrix.needsUpdate = true;
}

/* ---------------- sky: gradient, sun glow, lit clouds, stars ---------------- */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: Object.fromEntries([['discGain', { value: 1 }]].concat(['top', 'mid', 'hor', 'glow', 'disc', 'cLit', 'cDark'].map((k) => [k, { value: new THREE.Color() }]).concat([['sunDir', { value: new V3(0, 1, 0) }], ['discS', { value: 0.03 }], ['cov', { value: 0.5 }], ['night', { value: 0 }], ['time', { value: 0 }]]))),
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 top, mid, hor, glow, disc, cLit, cDark, sunDir; uniform float discS, cov, night, time, discGain; varying vec3 vP;
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * vn(p); p = p * 2.03 + vec2(3.1, 1.7); a *= 0.5; } return v; }
    void main(){
      vec3 d = normalize(vP); float y = d.y, h = max(y, 0.0);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h));
      c = mix(c, top, smoothstep(0.16, 0.7, h));
      if (y < 0.0) c = mix(hor, hor * 0.7, clamp(-y * 6.0, 0.0, 1.0));
      float s = max(dot(d, sunDir), 0.0);
      c += glow * (pow(s, 5.0) * 0.6 + pow(s, 60.0) * 1.6) * (1.0 - 0.6 * h);
      c += disc * smoothstep(cos(discS), cos(discS * 0.8), dot(d, sunDir)) * mix(12.0, 2.0, night) * discGain;
      float m = 0.0;
      if (y > 0.0) {
        vec2 uv = d.xz / (y + 0.1) * vec2(0.3, 1.1) + vec2(time * 0.004, 0.0); // streaks along the horizon
        float n = fbm(uv * 1.4), sh = fbm(uv * 1.4 + sunDir.xz * 0.16);
        m = smoothstep(cov, cov + 0.14, n) * smoothstep(0.0, 0.1, y);
        float lit = clamp(0.5 + (n - sh) * 3.0, 0.0, 1.0);
        vec3 cc = mix(cDark, cLit * 1.3, lit * lit) + glow * pow(s, 3.0) * 2.0 * lit + cLit * m * (1.0 - m) * 1.6; // bright fringes
        c = mix(c, cc, m * 0.95);
        float st = step(0.997, h21(floor(d.xz / (y + 0.4) * 300.0))) * smoothstep(0.5, 1.0, night) * smoothstep(0.08, 0.3, y);
        c += vec3(st * 1.4 * (1.0 - m));
      }
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const skyGeo = new THREE.SphereGeometry(2000, 48, 24);
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.renderOrder = -1; sky.frustumCulled = false;
scene.add(sky);
const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(skyGeo, skyMat));
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function refreshEnv() { const old = envRT; skyMat.uniforms.discGain.value = 0; envRT = pmrem.fromScene(envScene, 0.02, 1, 3000); skyMat.uniforms.discGain.value = 1; scene.environment = envRT.texture; old?.dispose(); }

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 800 }); sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);
const head = new THREE.SpotLight(0xfff0d0, 0, 90, 0.5, 0.6, 1.1);
head.position.set(0.37, -0.55, -2.2); // at the bumper, ahead of the cabin so it never lights the dash
head.target.position.set(0.37, -2.2, -22);
camera.add(head, head.target);

/* ---------------- cockpit: dash, gauges, mirror, wheel, hands ---------------- */
const rig = new THREE.Group();
camera.add(rig);
const WX = -0.035; // wheel sits a touch left of the eye
const cab = (g, m) => { const o = new THREE.Mesh(g, m); rig.add(o); return o; };
const cabinEnv = 0.3; // the roof shades the cabin
const dashMat = std(0x0c0d0f, { roughness: 0.82, envMapIntensity: cabinEnv });
const trimMat = std(0x08090a, { roughness: 0.45, envMapIntensity: cabinEnv });
const extrudeX = (pts, x0, x1, bevel = 0) => { // profile in (z, y), extruded across x
  const s = new THREE.Shape(); s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) p.length === 4 ? s.quadraticCurveTo(...p) : s.lineTo(...p);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
  return g.translate(0, 0, -(x1 - x0) / 2).rotateY(-Math.PI / 2).translate((x0 + x1) / 2, 0, 0);
};
cab(extrudeX([[-1.45, -0.19], [-1.0, -0.222], [-0.87, -0.232, -0.86, -0.29], [-0.84, -0.95], [-1.45, -0.95]], -1.8, 1.8), dashMat);
cab(extrudeX([[-1.0, -0.224], [-0.86, -0.19, -0.765, -0.208], [-0.74, -0.218, -0.75, -0.25], [-0.85, -0.28], [-1.0, -0.26]], WX - 0.25, WX + 0.25, 0.012), dashMat);
cab(new THREE.BoxGeometry(3.6, 0.012, 0.03).translate(0, -0.19, -1.44), trimMat); // windshield seal
// gauges
const [gaugeCv, gctx] = canvas(512, 192), gaugeTex = tex(gaugeCv, true, false);
let lastGauge = '';
function drawGauge(mph, rpm) {
  const key = mph + '|' + rpm.toFixed(1);
  if (key === lastGauge) return; lastGauge = key;
  const g = gctx;
  g.fillStyle = '#050608'; g.fillRect(0, 0, 512, 192);
  const dial = (cx, max, val, step, red) => {
    g.save(); g.translate(cx, 98);
    g.fillStyle = '#0c0e12'; g.beginPath(); g.arc(0, 0, 84, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a3f48'; g.lineWidth = 2; g.stroke();
    for (let k = 0; k <= max + 1e-6; k += step / 2) {
      const a = (135 + 270 * k / max) * D2R, major = Math.abs(k / step - Math.round(k / step)) < 1e-6;
      g.strokeStyle = red && k >= red ? '#ff4a3a' : '#e9e6df'; g.lineWidth = major ? 3 : 1.5;
      g.beginPath(); g.moveTo(Math.cos(a) * (major ? 64 : 70), Math.sin(a) * (major ? 64 : 70)); g.lineTo(Math.cos(a) * 78, Math.sin(a) * 78); g.stroke();
      if (major) { g.fillStyle = '#e9e6df'; g.font = '600 15px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.round(k), Math.cos(a) * 50, Math.sin(a) * 50); }
    }
    const a = (135 + 270 * Math.min(val, max) / max) * D2R;
    g.strokeStyle = '#ff7a2e'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(-Math.cos(a) * 10, -Math.sin(a) * 10); g.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); g.stroke();
    g.fillStyle = '#1b1d22'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  dial(104, 140, mph, 20); dial(408, 8, rpm, 1, 6.5);
  g.fillStyle = '#f2efe8'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '700 50px Arial, sans-serif'; g.fillText(mph, 256, 138);
  g.font = '600 15px Arial, sans-serif'; g.fillStyle = '#ff9a4a'; g.fillText('MPH', 256, 160);
  gaugeTex.needsUpdate = true;
}
drawGauge(0, 0.8);
const gaugeMat = new THREE.MeshBasicMaterial({ map: gaugeTex, toneMapped: false });
const gauge = cab(new THREE.PlaneGeometry(0.36, 0.135), gaugeMat);
const faceEye = (o) => o.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new V3(), o.position, UP)); // +z towards the driver's eye
gauge.position.set(WX, -0.3, -0.83); faceEye(gauge);
// roof, header and A-pillar
const roofMat = std(0x0a0a0c, { roughness: 0.95, envMapIntensity: cabinEnv });
cab(new THREE.PlaneGeometry(4, 1.6).rotateX(Math.PI / 2).translate(0, 0.43, -0.3), roofMat);
cab(extrudeX([[-1.12, 0.43], [-1.0, 0.43], [-1.03, 0.41, -1.1, 0.405]], -2, 2), roofMat);
const pillarL = cab(new THREE.BoxGeometry(0.075, 1, 0.06).translate(0, 0.5, 0), roofMat);
const pillarR = cab(new THREE.BoxGeometry(0.1, 1, 0.07).translate(0, 0.5, 0), roofMat);
// rear-view mirror: a second camera renders the road behind on desktop
const mirror = new THREE.Group(); rig.add(mirror);
mirror.add(new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.07, 0.03, 3, 0.02), trimMat));
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 6).translate(0, 0.06, -0.02), trimMat); mirror.add(stem);
let mirrorRT = null, mirrorCam = null;
const glassMat = LOW ? new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.05, metalness: 1 }) : new THREE.MeshBasicMaterial();
if (!LOW) {
  mirrorRT = new THREE.WebGLRenderTarget(320, 96, { type: THREE.HalfFloatType });
  glassMat.map = mirrorRT.texture; mirrorRT.texture.repeat.x = -1; mirrorRT.texture.offset.x = 1; mirrorRT.texture.wrapS = THREE.RepeatWrapping;
  mirrorCam = new THREE.PerspectiveCamera(26, 320 / 96, 1.5, 2600); mirrorCam.rotation.order = 'YXZ';
}
const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.222, 0.056), glassMat); glass.position.z = 0.016; mirror.add(glass);
// night glow from the gauges and radio
const cabinLight = new THREE.PointLight(0xffc08a, 0, 1.6, 2); cabinLight.position.set(WX, -0.22, -0.5); rig.add(cabinLight);

// steering wheel
const RW = 0.19, RT = 0.017;
const leather = std(0x0e0e10, { roughness: 0.55, envMapIntensity: cabinEnv });
const wheelTilt = new THREE.Group(), wheel = new THREE.Group();
rig.add(wheelTilt); wheelTilt.add(wheel);
wheelTilt.rotation.x = -0.34;
wheel.add(new THREE.Mesh(new THREE.TorusGeometry(RW, RT, 20, 110), leather));
const spokeMat = std(0x141518, { roughness: 0.5, metalness: 0.2, envMapIntensity: cabinEnv });
for (const s of [-1, 1]) {
  const sp = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.04, 0.02, 2, 0.008), spokeMat); sp.position.set(s * 0.115, -0.012, -0.008); sp.rotation.z = s * 0.12; wheel.add(sp);
}
{ const sp = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.14, 0.02, 2, 0.008), spokeMat); sp.position.set(0, -0.11, -0.008); wheel.add(sp); }
const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.05, 40).rotateX(Math.PI / 2), spokeMat); hub.position.z = 0.004; wheel.add(hub);
const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.066, 0.02, 40).rotateX(Math.PI / 2), leather); pad.position.z = 0.03; wheel.add(pad);
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.0028, 8, 48), std(0x7a7f86, { metalness: 1, roughness: 0.35, envMapIntensity: 0.25 })); ring.position.z = 0.03; wheel.add(ring);
wheelTilt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 16).rotateX(Math.PI / 2).translate(0, 0, -0.16), trimMat));

// hands: built as a right hand gripping a straight bar along x, then bent onto the rim at 2 o'clock;
// the left hand is its mirror image at 10 o'clock
const skin = new THREE.MeshPhysicalMaterial({ color: 0x93705a, roughness: 0.56, envMapIntensity: 0.5, sheen: 0.25, sheenColor: new THREE.Color(0xffb8a0), sheenRoughness: 0.5, clearcoat: 0.06, clearcoatRoughness: 0.6, vertexColors: true });
// canonical hand: bar along x (index side +x), back of the hand +y, fingers curl from +y over +z
const HAND_TH = 36 * D2R, PHI = 100 * D2R, GPHI = 70 * D2R;
const hu = new V3(Math.cos(HAND_TH), Math.sin(HAND_TH), 0), htg = new V3(-Math.sin(HAND_TH), Math.cos(HAND_TH), 0), hn = new V3(0, 0, 1);
const HX = htg.clone().negate(); // index finger points down the rim, the thumb sits below
const HY = hu.clone().multiplyScalar(Math.cos(PHI)).addScaledVector(hn, Math.sin(PHI)), HZ = new V3().crossVectors(HX, HY), HP = hu.clone().multiplyScalar(RW);
const ZAX = new V3(0, 0, 1);
function bendPoint(v, out = new V3()) { // canonical hand space -> wheel space; x runs along the rim
  out.copy(HP).addScaledVector(HY, v.y).addScaledVector(HZ, v.z);
  return out.applyAxisAngle(ZAX, -v.x / RW);
}
function bendGeo(g) {
  const p = g.attributes.position, n = g.attributes.normal, v = new V3(), o = new V3(), nn = new V3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k); bendPoint(v, o); p.setXYZ(k, o.x, o.y, o.z);
    nn.set(0, 0, 0).addScaledVector(HX, n.getX(k)).addScaledVector(HY, n.getY(k)).addScaledVector(HZ, n.getZ(k)).applyAxisAngle(ZAX, -v.x / RW).normalize();
    n.setXYZ(k, nn.x, nn.y, nn.z);
  }
  return g;
}
const HM = new V3(0, 0.029, -0.006), HWR = new V3(0.02, 0.0, -0.09);
const ha = HM.clone().sub(HWR).normalize(), hx = new V3(1, 0, 0), hd = new V3().crossVectors(ha, hx).normalize(); // hand axis, dorsal normal
const handParts = [];
const gauss = (t, c, w = 0.05) => Math.exp(-(((t - c) / w) ** 2));
for (const f of [{ o: 0.026, r: 0.0094, L: 0.93, dz: 0 }, { o: 0.0085, r: 0.0099, L: 1, dz: 0.003 }, { o: -0.0095, r: 0.0094, L: 0.95, dz: 0.001 }, { o: -0.0262, r: 0.0082, L: 0.78, dz: -0.006, dy: -0.003 }]) {
  const mcp = new V3(f.o, HM.y + (f.dy || 0), HM.z + f.dz), rr = RT + f.r + 0.003;
  const p0 = mcp.clone().addScaledVector(ha, -0.03);
  const psi0 = Math.atan2(mcp.z, mcp.y), lens = [0.046, 0.027, 0.021].map((l) => (l * f.L) / rr);
  const at = (psi, x) => new V3(x, Math.cos(psi) * rr, Math.sin(psi) * rr);
  const pip = at(psi0 + lens[0], f.o), dip = at(psi0 + lens[0] + lens[1], f.o), tip = at(psi0 + lens[0] + lens[1] + lens[2], f.o * 0.97);
  const pts = [p0, mcp, pip, dip, tip], cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
  const tj = cum.map((c) => c / cum[4]), c0 = 1 - (1.15 * f.r) / cum[4];
  handParts.push(sweep(pts, (t) => f.r * (1 - 0.15 * t) * (1 + 0.16 * gauss(t, tj[1], 0.06) + 0.09 * gauss(t, tj[2]) + 0.05 * gauss(t, tj[3])) * (t > c0 ? Math.sqrt(Math.max(0, 1 - ((t - c0) / (1 - c0)) ** 2)) : 1),
    { radial: 14, seg: 34, warp: 1.35, colFn: (t) => { const k = 0.08 * gauss(t, tj[1], 0.06) + 0.06 * Math.max(0, (t - 0.85) / 0.15), crease = 0.16 * (gauss(t, tj[2] + 0.02, 0.018) + gauss(t, tj[3] + 0.015, 0.015)); return [1 - crease, 1 - k - crease * 1.1, 1 - k * 1.2 - crease * 1.2]; } }));
}
{ // thumb along the driver side of the rim, pointing towards 12 o'clock
  const pts = [new V3(0.024, 0.0, -0.058), new V3(0.04, 0.014, -0.026), new V3(0.054, 0.022, 0.014), new V3(0.066, 0.012, 0.027)];
  handParts.push(sweep(pts, (t) => 0.0122 * (1 - 0.2 * t) * (1 + 0.1 * gauss(t, 0.45)) * (t > 0.86 ? Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.14) ** 2)) : 1), { radial: 14, seg: 30, warp: 1.3, colFn: (t) => [1, 1 - 0.08 * Math.max(0, (t - 0.8) / 0.2), 0.98 - 0.1 * Math.max(0, (t - 0.8) / 0.2)] }));
  const tipDir = pts[3].clone().sub(pts[2]).normalize(), out = new V3(0, pts[3].y, pts[3].z).normalize(), side = new V3().crossVectors(tipDir, out).normalize();
  handParts.push(ellipsoid(pts[3].clone().addScaledVector(tipDir, -0.007).addScaledVector(out, 0.0085), side, tipDir, out, 0.0068, 0.0085, 0.0018, [1.18, 1.05, 1.02])); // thumbnail
}
const palmC = HM.clone().add(HWR).multiplyScalar(0.5).addScaledVector(hd, 0.002);
handParts.push(ellipsoid(palmC, hx, ha, hd, 0.043, 0.052, 0.0165));
handParts.push(ellipsoid(new V3(0.022, 0.0, -0.062), hx, ha, hd, 0.017, 0.03, 0.016, [1, 0.97, 0.95])); // thumb muscle
handParts.push(ellipsoid(new V3(-0.029, -0.004, -0.058), hx, ha, hd, 0.012, 0.034, 0.012));
handParts.push(ellipsoid(HWR.clone().addScaledVector(ha, 0.006), hx, ha, hd, 0.031, 0.022, 0.02)); // wrist
const handGeo = bendGeo(mergeGeometries(handParts));
let wristW = bendPoint(HWR.clone().addScaledVector(ha, -0.004));
const handR = new THREE.Mesh(handGeo, skin), handL = new THREE.Mesh(handGeo, skin);
handL.scale.x = -1;
wheel.add(handR, handL);
// watch on the left forearm, just above the wrist
const watch = new THREE.Group(); rig.add(watch);
watch.add(new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.006, 8, 32), std(0x141416, { roughness: 0.6, envMapIntensity: 0.3 })));
{
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 32), new THREE.MeshPhysicalMaterial({ color: 0x0d1014, metalness: 0.2, roughness: 0.3, clearcoat: 0.4, envMapIntensity: 0.15 }));
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0022, 8, 32).rotateX(Math.PI / 2), std(0xc2c6cc, { metalness: 1, roughness: 0.25, envMapIntensity: 0.6 }));
  face.position.y = bezel.position.y = 0.033; bezel.position.y = 0.0375;
  watch.add(face, bezel);
}
// Real hands: the WebXR "generic-hand" skinned mesh (MIT licence, immersive-web/webxr-input-profiles assets),
// loaded from jsDelivr. Its joints are siblings, so the grip is posed here with a small forward-kinematics pass.
// The procedural hands above stay as the fallback while it loads or if the CDN is unreachable.
const HAND_URL = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/right.glb';
// flexion in degrees per joint (metacarpal, knuckle, middle joint, last joint); each finger a little different
const GRIP = {
  'index-finger': [0, 52, 72, 44], 'middle-finger': [0, 56, 78, 48], 'ring-finger': [2, 60, 80, 50], 'pinky-finger': [4, 66, 82, 50],
  thumb: [0, 18, 28],
};
const JOINTS = (f) => f === 'thumb' ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
  : [`${f}-metacarpal`, `${f}-phalanx-proximal`, `${f}-phalanx-intermediate`, `${f}-phalanx-distal`, `${f}-tip`];
function curl(chain, deg) { // bend each joint about its own x axis, carrying the rest of the finger with it
  const P = chain.map((b) => b.position.clone()), Q = chain.map((b) => b.quaternion.clone());
  const D = new THREE.Quaternion(), pos = P[0].clone(), step = new THREE.Quaternion();
  chain.forEach((b, k) => {
    if (k) pos.add(P[k].clone().sub(P[k - 1]).applyQuaternion(D));
    if (deg[k]) D.premultiply(step.setFromAxisAngle(new V3(1, 0, 0).applyQuaternion(Q[k]).applyQuaternion(D), -deg[k] * D2R));
    b.position.copy(pos); b.quaternion.copy(D).multiply(Q[k]);
  });
}
const circumcenter = (a, b, c) => { // centre of the circle through three points
  const ab = b.clone().sub(a), ac = c.clone().sub(a), n = new V3().crossVectors(ab, ac);
  const t = new V3().crossVectors(n, ab).multiplyScalar(ac.lengthSq()).add(new V3().crossVectors(ac, n).multiplyScalar(ab.lengthSq()));
  return a.clone().add(t.divideScalar(2 * n.lengthSq()));
};
const skinTex = (() => { // fine pores and creases for the bump map
  const [c] = noiseCanvas(256, [128, 128, 128], 60);
  return tex(c, false);
})();
const realSkin = new THREE.MeshPhysicalMaterial({
  color: 0x9c7860, roughness: 0.55, roughnessMap: skinTex, bumpMap: skinTex, bumpScale: 0.35,
  sheen: 0.4, sheenColor: new THREE.Color(0xd8a088), sheenRoughness: 0.45, clearcoat: 0.08, clearcoatRoughness: 0.5, envMapIntensity: 0.5,
});
skinTex.repeat.set(3, 3);
function loadHands() {
  const loader = new GLTFLoader();
  Promise.all([loader.loadAsync(HAND_URL), loader.loadAsync(HAND_URL)]).then(([gr, gl]) => {
    let place = null, wrist = null;
    const roots = [gr.scene, gl.scene].map((root) => {
      const bones = {};
      root.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
        if (o.isSkinnedMesh) { o.material = realSkin; o.frustumCulled = false; }
      });
      for (const f in GRIP) curl(JOINTS(f).map((n) => bones[n]), GRIP[f]);
      if (!place) { // fit the rim inside the middle finger's curl, then map that grip onto the hand frame used above
        const p = (n) => bones[n].position;
        const C = circumcenter(p('middle-finger-phalanx-proximal'), p('middle-finger-phalanx-intermediate'), p('middle-finger-phalanx-distal'));
        const cx = p('index-finger-phalanx-proximal').clone().sub(p('pinky-finger-phalanx-proximal')).normalize();
        const cy = p('middle-finger-phalanx-proximal').clone().sub(C); cy.addScaledVector(cx, -cy.dot(cx)).normalize();
        const cz = new V3().crossVectors(cx, cy);
        const grip = new THREE.Matrix4().makeBasis(cx, cy, cz).setPosition(C).invert();
        // back of the hand up towards the eye, fingers rolling over the rim's outer edge, wrist low and inside
        const gX = htg.clone(), gY = hu.clone().multiplyScalar(Math.cos(GPHI)).addScaledVector(hn, Math.sin(GPHI)), gZ = new V3().crossVectors(gX, gY);
        place = new THREE.Matrix4().makeBasis(gX, gY, gZ).setPosition(HP).multiply(grip);
        wrist = p('wrist').clone();
      }
      return root;
    });
    const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
    roots.forEach((root, k) => { (k ? mirror.clone().multiply(place) : place).decompose(root.position, root.quaternion, root.scale); wheel.add(root); });
    handR.visible = handL.visible = false;
    arms[1].hand = roots[0]; arms[0].hand = roots[1];
    wristW = wrist;
  }).catch(() => {}); // offline: keep the procedural hands
}
loadHands();
// cool sky fill from the rear window so the hands are not lit by the sunset alone
const fill = new THREE.PointLight(0x9db4ff, 0.12, 1.6, 2); fill.position.set(0, 0.25, 0.25); rig.add(fill);

// forearms and jacket sleeves, re-aimed every frame from the wrists to fixed elbows
const sleeveMat = std(0x1b2029, { roughness: 0.95, envMapIntensity: cabinEnv });
const armGeo = paint(new THREE.CylinderGeometry(0.043, 0.027, 1, 20, 1, true).translate(0, 0.5, 0), 0xffffff);
const sleeveGeo = new THREE.CylinderGeometry(0.066, 0.05, 1, 22, 1, true).translate(0, 0.5, 0);
const cuffGeo = new THREE.TorusGeometry(0.05, 0.009, 10, 28);
const arms = [-1, 1].map((s) => {
  const arm = cab(armGeo, skin), sleeve = cab(sleeveGeo, sleeveMat), cuff = cab(cuffGeo, sleeveMat);
  return { s, arm, sleeve, cuff, hand: s > 0 ? handR : handL, elbow: new V3(s * 0.36, -0.78, 0.02) };
});
const _w = new V3(), _c = new V3();
function aimArms() {
  wheelTilt.updateMatrix(); wheel.updateMatrix();
  for (const a of arms) {
    a.hand.updateMatrix();
    _w.copy(wristW).applyMatrix4(a.hand.matrix).applyMatrix4(wheel.matrix).applyMatrix4(wheelTilt.matrix);
    span(a.arm, _w, a.elbow, 0.2);
    _c.subVectors(a.elbow, _w).normalize().multiplyScalar(0.075).add(_w);
    span(a.sleeve, _c, a.elbow, 0.4);
    a.cuff.position.copy(_c); a.cuff.quaternion.setFromUnitVectors(ZAX, _d.subVectors(a.elbow, _c).normalize());
    if (a.s < 0) { // face of the watch turned towards the eye
      const f = _w.clone().negate().normalize(); f.addScaledVector(_d, -f.dot(_d)).normalize();
      watch.position.copy(_w).addScaledVector(_d, 0.045);
      watch.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3().crossVectors(f, _d), f, _d));
    }
  }
}
const pillar = (m, a, b) => span(m, a, b);
function layoutCockpit(aspect) {
  const hw = (z) => Math.abs(z) * Math.tan((FOV / 2) * D2R) * aspect, narrow = aspect < 0.95;
  wheelTilt.position.set(WX, narrow ? -0.335 : -0.372, narrow ? -0.63 : -0.6);
  pillar(pillarL, new V3(-hw(1.3) * 1.04, -0.22, -1.3), new V3(-hw(1.0) * 0.86, 0.43, -1.0));
  pillar(pillarR, new V3(hw(1.3) * 1.5, -0.22, -1.3), new V3(hw(1.0) * 1.35, 0.43, -1.0));
  mirror.position.set(Math.min(0.3, hw(0.72) * 0.62), 0.3, -0.72);
  faceEye(mirror);
}

layoutCockpit(1);
new ResizeObserver(() => {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  layoutCockpit(camera.aspect);
}).observe(host);

/* ---------------- light presets per track ---------------- */
const PRESETS = {
  afternoon: { top: '#2a66a8', mid: '#69a1cf', hor: '#cfe1e4', fog: '#bfd3da', fogNear: 90, fogFar: 760, glow: '#fff1d8', disc: '#fff8ea', discS: 0.022, cLit: '#ffffff', cDark: '#aebdcc', cov: 0.32,
    sun: '#fff0da', sunI: 3.2, dir: [0.45, 0.85, 0.3], hemiS: '#cfe6f2', hemiG: '#6b6450', hemiI: 0.55, sil: '#91a6b8', haze: '#cfe1e4', night: 0, bloomS: 0.22, bloomT: 0.95, exposure: 0.95, tail: 1.1 },
  golden: { top: '#272a63', mid: '#c95f86', hor: '#ff9f55', fog: '#e7956c', fogNear: 35, fogFar: 560, glow: '#ff8f35', disc: '#fff0c8', discS: 0.032, cLit: '#ff9a68', cDark: '#4a2e5c', cov: 0.27,
    sun: '#ffa65c', sunI: 4.2, dir: [0.34, 0.075, -1], hemiS: '#f2a088', hemiG: '#3a2433', hemiI: 0.5, sil: '#4f3762', haze: '#f0a070', night: 0.12, bloomS: 0.38, bloomT: 0.86, exposure: 1.0, tail: 2.4 },
  night: { top: '#03060f', mid: '#0a1328', hor: '#1a2640', fog: '#131c30', fogNear: 25, fogFar: 460, glow: '#40527c', disc: '#e8ecf5', discS: 0.02, cLit: '#2a3550', cDark: '#0a0f1c', cov: 0.33,
    sun: '#8da3d8', sunI: 0.4, dir: [0.35, 0.3, -1], hemiS: '#2c3f6a', hemiG: '#090a12', hemiI: 0.4, sil: '#0b1020', haze: '#1a2640', night: 1, bloomS: 0.62, bloomT: 0.78, exposure: 1.0, tail: 4 },
};
const COLOR_KEYS = ['top', 'mid', 'hor', 'fog', 'glow', 'disc', 'cLit', 'cDark', 'sun', 'hemiS', 'hemiG', 'sil', 'haze'];
const toState = (p) => { const s = { ...p, dir: new V3(...p.dir).normalize() }; for (const k of COLOR_KEYS) s[k] = new THREE.Color(p[k]); return s; };
const STATES = Object.fromEntries(Object.entries(PRESETS).map(([k, p]) => [k, toState(p)]));
const cloneState = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.clone ? v.clone() : v]));
const cur = cloneState(STATES.golden);
let from = cloneState(cur), to = STATES.golden, lt = 1, envT = 0, envDirty = true;
function setLight(name) { from = cloneState(cur); to = STATES[name]; lt = 0; }
const fwd = new V3();
function stepLight(dt) {
  if (lt < 1) {
    lt = Math.min(1, lt + dt / 2);
    const e = lt * lt * (3 - 2 * lt);
    for (const k in cur) {
      if (cur[k].isColor) cur[k].lerpColors(from[k], to[k], e);
      else if (cur[k].isVector3) cur[k].lerpVectors(from[k], to[k], e).normalize();
      else cur[k] = from[k] + (to[k] - from[k]) * e;
    }
    envT += dt; if (envT > 0.4 || lt === 1) envDirty = true;
  }
  const u = skyMat.uniforms;
  for (const k of ['top', 'mid', 'hor', 'glow', 'disc', 'cLit', 'cDark']) u[k].value.copy(cur[k]);
  u.sunDir.value.copy(cur.dir); u.discS.value = cur.discS; u.cov.value = cur.cov; u.night.value = cur.night;
  scene.fog.color.copy(cur.fog); scene.fog.near = cur.fogNear; scene.fog.far = cur.fogFar;
  skyUniforms.sil.value.copy(cur.sil); skyUniforms.haze.value.copy(cur.haze); skyUniforms.glow.value.copy(cur.glow); skyUniforms.sunDir.value.copy(cur.dir); skyUniforms.night.value = cur.night;
  sun.color.copy(cur.sun); sun.intensity = cur.sunI;
  fwd.set(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y));
  sun.target.position.copy(camera.position).addScaledVector(fwd, 30); sun.target.position.y = 0;
  sun.position.copy(sun.target.position).addScaledVector(cur.dir, 400);
  hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemiI;
  renderer.toneMappingExposure = cur.exposure;
  if (bloom) { bloom.strength = cur.bloomS; bloom.threshold = cur.bloomT; bloom.radius = 0.55; }
  const n = cur.night;
  winMat.emissiveIntensity = n * 1.15;
  signMat.emissiveIntensity = n * 0.35;
  poolMat.opacity = n * 0.6;
  lampHeadMat.color.setRGB(0.35 + 3 * n, 0.35 + 2.2 * n, 0.37 + 1.2 * n);
  carLightMat.color.setScalar(cur.tail);
  gaugeMat.color.setScalar(0.75 + 0.25 * n);
  cabinLight.intensity = 0.03 + n * 0.03; // light bounced off the dash, plus the gauges at night
  head.intensity = n * 45;
  sky.position.copy(camera.position);
  if (envDirty) { refreshEnv(); envDirty = false; envT = 0; }
}

/* ---------------- driving ---------------- */
const car = { x: 4 * CELL + 3.5, z: 3 * CELL + CELL * 0.75, h: 0, v: 0, steer: 0 };
if (AUTOSTART) { window.__car = car; window.__dbg = { wheelTilt }; } // read by the headless check
const keys = { up: false, down: false, left: false, right: false };
const R = 1.1;
function blocked(x, z) {
  if (x < -HALF + R || x > W + HALF - R || z < -HALF + R || z > W + HALF - R) return true;
  const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
  if (i < 0 || j < 0 || i >= N || j >= N) return false;
  const lx = x - i * CELL, lz = z - j * CELL;
  return lx > HALF - R && lx < CELL - HALF + R && lz > HALF - R && lz < CELL - HALF + R;
}
let bobT = 0;
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
  for (const c of cars.concat(parked)) {
    const dx = car.x - c.x, dz = car.z - c.z, lim = c.axis === 0 ? [2.1, 3.4] : [3.4, 2.1];
    if (Math.abs(dx) < lim[0] && Math.abs(dz) < lim[1]) {
      car.v *= 0.92; // cars nudge you aside instead of throwing you backwards
      const d = Math.hypot(dx, dz) || 1;
      const px = car.x + (dx / d) * 0.6, pz = car.z + (dz / d) * 0.6;
      if (!blocked(px, pz)) { car.x = px; car.z = pz; }
    }
  }
  if (hit) car.v *= -0.3;
  pose(dt);
}
// camera: head bob, road shake and a wider lens with speed (all off with reduced motion)
function pose(dt) {
  const sp = Math.min(1, Math.abs(car.v) / 26), m = reduced.matches ? 0 : 1;
  bobT += dt * (1 + Math.abs(car.v) * 0.45);
  const shake = m * sp * (Math.sin(bobT * 7.3) * 0.5 + Math.sin(bobT * 12.1) * 0.3 + Math.sin(bobT * 19.7) * 0.2);
  camera.position.set(car.x, 1.22 + m * Math.sin(bobT * 1.9) * 0.006 * sp + shake * 0.0035, car.z);
  camera.rotation.set(-0.05 + shake * 0.0018, car.h, -car.steer * sp * 0.03 + m * Math.sin(bobT * 1.1) * 0.0025 * sp);
  const fov = FOV + m * sp * 7;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  wheel.rotation.z = car.steer * 1.75;
  wheelTilt.position.y += (shake * 0.0012) - (wheelTilt.userData.sh || 0); wheelTilt.userData.sh = shake * 0.0012;
}

/* ---------------- HUD refs ---------------- */
const ui = {
  speed: $('speed'), where: $('where'), icon: $('icon'), ledTitle: $('ledTitle'), ledSub: $('ledSub'),
  play: $('play'), playIcon: $('playIcon'), mute: $('mute'), muteIcon: $('muteIcon'), vinyl: $('vinyl'), vnum: $('vnum'),
  title: $('title'), meta: $('meta'), soon: $('soon'), lyrics: $('lyrics'), start: $('start'), game: $('game'),
};
const LOOK = { afternoon: ['#a9cbd0', '#13232a'], golden: ['#e39a52', '#24130a'], night: ['#1f3a5f', '#f2a945'] };
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

/* ---------------- radio ---------------- */
// golden hour is the first look: without ?track the drive starts on track 4
const S = { i: Math.max(0, Math.min(9, (+qs.get('track') || 4) - 1)), playing: false, muted: AUTOSTART, started: false, audio: null, sim: false, simT: 0 };
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
  ui.icon.textContent = pad2(t.n);
  ui.vnum.textContent = pad2(t.n);
  ui.ledTitle.textContent = `${pad2(t.n)}  ${t.title}`;
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
  const mph = Math.round(Math.abs(car.v) * 2.237);
  if (ui.speed.textContent !== String(mph)) ui.speed.textContent = mph;
  const gear = Math.abs(car.v) / 26;
  drawGauge(mph, 0.8 + ((gear * 4) % 1) * 4.6 + gear * 1.2);
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
let last = performance.now(), idleH = 0, frameN = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  // idle: only the camera pans, the car keeps facing down the road
  if (S.started) drive(dt);
  else { idleH += dt * 0.04; pose(0); camera.rotation.y = car.h + Math.sin(idleH) * 0.6; }
  aimArms();
  moveTraffic(dt);
  stepLight(dt);
  skyMat.uniforms.time.value = t / 1000;
  if (S.playing && S.sim) { S.simT += dt; if (S.simT >= dur()) loadTrack(S.i + 1); }
  updateLyrics();
  updateHud();
  renderer.shadowMap.needsUpdate = true;
  if (composer) { grain.uniforms.t.value = (t / 1000) % 100; composer.render(); } else renderer.render(scene, camera);
  if (mirrorCam && (frameN++ & 1) === 0) { // the road behind, every other frame
    mirrorCam.position.copy(camera.position); mirrorCam.position.y += 0.1;
    mirrorCam.rotation.set(-0.02, car.h + Math.PI, 0);
    rig.visible = false;
    renderer.setRenderTarget(mirrorRT); renderer.render(scene, mirrorCam); renderer.setRenderTarget(null);
    rig.visible = true;
  }
}
// rAF already pauses itself in hidden tabs, so the loop always starts

setMuted(S.muted);
loadTrack(S.i);
lt = 1; Object.assign(cur, cloneState(STATES[track().light])); envDirty = true; // first paint: no fade
if (AUTOSTART) begin(); else ui.game.setAttribute('inert', '');
requestAnimationFrame(frame);
