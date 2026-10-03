// Cochecito 3D que te acompaña al hacer scroll: el todoterreno de bruno-simon.com.
// Modelo: static/vehicle/default.glb de github.com/brunosimon/folio-2025, MIT, Copyright (c) 2025 Bruno Simon
// (coche/LICENSE-MIT-BrunoSimon.txt). Sus materiales van en TSL/WebGPU; aquí se rehacen para WebGL con los mismos colores.
// - Su sitio en la franja de abajo es cuánto llevas de página: arriba del todo a la izquierda, al final a la derecha.
// - Si lo agarras, conduce hacia el puntero; al soltarlo vuelve conduciendo a la franja y aparca.
// - Con el scroll todo son muelles; arrastrado, un modelo de conducción de juego (sin motor de física).
// - Solo dibuja mientras algo se mueve; parado no gasta batería.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const EL = 0.8;     // inclinación de la cámara (~46°): se ven el techo, la baca y las luces como en la de Bruno
const REST = 0.7;   // parado gira el morro ~40° hacia ti: la vista 3/4 del coche de Bruno
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// el lienzo cubre la pantalla para poder llevar el coche a cualquier sitio, pero no recoge clics
const canvas = document.createElement('canvas');
canvas.setAttribute('aria-hidden', 'true');
canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:40;pointer-events:none;opacity:0;transition:opacity .8s';
document.body.append(canvas);
document.head.insertAdjacentHTML('beforeend', `<style>
html.car-grab,html.car-grab *{cursor:grab!important}
html.car-grabbing,html.car-grabbing *{cursor:grabbing!important}
.car-hint{position:fixed;left:0;top:0;z-index:40;pointer-events:none;padding:.25rem .45rem;background:var(--ink,#160000);color:var(--red,#f40c3f);font:400 8px/1 var(--mono,monospace);letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;opacity:0;transition:opacity .5s}
</style>`);

// notita bajo el coche para que se sepa que se puede agarrar; se va tras el primer arrastre
const hint = document.createElement('p');
hint.className = 'car-hint';
hint.textContent = 'Grab me & drag';
document.body.append(hint);
let learned = reduce; // con movimiento reducido no se arrastra, así que no se enseña
const box = new THREE.Box3(), corner = new THREE.Vector3();
function placeHint() {
  box.makeEmpty();
  for (const w of wheels) box.expandByObject(w); // las ruedas marcan el borde de abajo (el halo de los faros engordaría la caja)
  let l = Infinity, r = -Infinity, b = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    const px = (corner.x + 1) / 2 * W, py = (1 - corner.y) / 2 * H;
    l = Math.min(l, px); r = Math.max(r, px); b = Math.max(b, py);
  }
  // centrada bajo el coche, pero sin salirse de la pantalla (arriba del todo el coche va pegado al borde izquierdo)
  const hw = hint.offsetWidth, hh = hint.offsetHeight;
  const hx = Math.min(Math.max((l + r) / 2 - hw / 2, 8), W - hw - 8), hy = Math.min(b + 3, H - hh - 3);
  hint.style.transform = `translate(${hx}px,${hy}px)`;
  hint.style.opacity = learned || mode === 'drag' ? 0 : 1;
}

// a pantalla completa y con retina el antialias multiplica la memoria; con 2x de densidad ya no hace falta
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: devicePixelRatio < 2 });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

// Cámara ortográfica en píxeles CSS: el centro de la pantalla mira al origen del suelo.
// Los puntos de pantalla se pasan al suelo (y=0) con un rayo, así da igual cómo esté inclinada.
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
camera.position.set(0, Math.sin(EL) * 2000, Math.cos(EL) * 2000);
camera.lookAt(0, 0, 0);
camera.near = 1;
camera.far = 5000;
camera.updateMatrixWorld();
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aim = p => (ndc.set(p.clientX / W * 2 - 1, 1 - p.clientY / H * 2), ray.setFromCamera(ndc, camera), ray);
const toGround = (p, out) => aim(p).ray.intersectPlane(floor, out);

scene.add(new THREE.HemisphereLight(0xfff4ee, 0x7a1030, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.normalBias = 0.6;
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 900 });
scene.add(sun, sun.target);

// sombra: un trozo de suelo que va con el coche (uno a pantalla completa pintaría todos los píxeles)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: 0x160000, opacity: 0.3 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const car = new THREE.Group();
scene.add(car);
let chassis, wheels = [];

// Bruno pinta en TSL degradados a partir de las UV; aquí se hornean los mismos en colores de vértice.
// glow: luces de su createEmissiveGradient (radial, normalizado por luminancia; lo que pasa de 1 satura a amarillo)
function bake(geo, a, b, glow) {
  const uv = geo.attributes.uv, ca = new THREE.Color(a), cb = new THREE.Color(b), c = new THREE.Color(), out = [];
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    c.lerpColors(ca, cb, glow ? Math.min(1, 2 * Math.hypot(u - 0.5, v - 0.5)) : v);
    if (glow) c.multiplyScalar(glow / (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b));
    out.push(Math.min(1, c.r), Math.min(1, c.g), Math.min(1, c.b));
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out, 3));
}

let W = 0, H = 0, s = 27, half = 40, stripY = 0, xMin = 0, xMax = 0;
let mode = 'scroll';   // 'scroll' sigue la página, 'drag' sigue el puntero, 'back' vuelve a la franja
let x = null, z = 0, v = 0, dir = 1, yaw = Math.PI / 2 - REST, yawV = 0;
let sp = 0, steer = 0, rev = false, pitch = 0, pitchV = 0, roll = 0, rollV = 0, y = 0, vy = 0;
const strip = new THREE.Vector3(), goal = new THREE.Vector3(), grab = new THREE.Vector3(), tmp = new THREE.Vector3();

function resize() {
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  s = Math.min(27, Math.max(20, W / 53)); // px por unidad del modelo: ~85 px de coche en escritorio, ~60 en móvil
  half = 1.6 * s;
  const radio = document.querySelector('.radio')?.getBoundingClientRect();
  xMin = 24 + half;
  xMax = (radio ? radio.left - 16 : W - 24) - half; // aparca justo antes del botón de música
  stripY = (radio ? radio.bottom : H - 28) - 0.95 * s; // ruedas de delante a ras del botón
  Object.assign(camera, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
  camera.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  car.scale.setScalar(s);
  wake();
}

const progress = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  return reduce || max <= 0 ? 0 : Math.min(1, Math.max(0, scrollY / max));
};
const clamp = (n, a) => Math.max(-a, Math.min(a, n));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const parked = () => dir * (Math.PI / 2 - REST * Math.max(0, 1 - Math.abs(v) / 150));

// Conducción de juego hacia t: gira en proporción a su velocidad (parado no puede) y frena al llegar.
// Si el destino queda detrás y cerca, va marcha atrás hasta él; si queda detrás y lejos, o tan pegado al lado
// que no le da el giro, hace la maniobra de tres puntos: atrás girando hasta encararlo, y luego adelante.
function drive(t, dt) {
  const dx = t.x - x, dz = t.z - z, dist = Math.hypot(dx, dz), near = dist < 0.6 * s, R = 2 * s; // R: radio de giro
  const a = wrap(Math.atan2(dx, dz) - yaw); // dónde está el destino respecto al morro
  const side = Math.abs(Math.sin(a)) * dist - R, ahead = Math.cos(a) * dist;
  const inside = side * side + ahead * ahead < R * R; // dentro de su círculo de giro: hacia delante no llega
  if (rev ? Math.abs(a) < 1.2 && !inside : Math.abs(a) > 2 || inside) rev = !rev;
  const tail = rev && !inside && dist < 4 * s; // marcha atrás apuntando con la cola
  const to = tail ? wrap(a + Math.PI) : a;
  const want = near ? 0 : (rev ? -0.6 : 1) * Math.min(25 * s, Math.sqrt(50 * s * dist), 6 * dist) * Math.max(0.3, Math.cos(to));
  sp += clamp(want - sp, 40 * s * dt);
  steer += ((near ? 0 : !rev ? clamp(2 * a, 1) : tail ? -clamp(2 * to, 1) : -Math.sign(a)) - steer) * Math.min(1, 8 * dt);
  yaw += sp * steer * dt / R;
  x += Math.sin(yaw) * sp * dt;
  z += Math.cos(yaw) * sp * dt;
  return near && Math.abs(sp) < 5;
}

let raf = 0, last = 0;
function wake() {
  if (raf || !chassis) return;
  last = 0;
  raf = requestAnimationFrame(tick);
}

function tick(now) {
  // el primer fotograma cuenta como 1/60 s: la hora de rAF puede ser anterior a la del evento que lo despertó,
  // y un dt negativo deshacía el salto del claxon
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  toGround({ clientX: xMin + progress() * (xMax - xMin), clientY: stripY }, strip);
  if (x === null || reduce) ({ x, z } = strip);
  const sp0 = sp, yaw0 = yaw;

  if (mode === 'scroll') {
    // avance: muelle sin rebote hacia su sitio, con velocidad máxima de coche de juguete
    v = clamp(v + (40 * (strip.x - x) - 12.6 * v) * dt, 1400);
    x += v * dt;
    z += (strip.z - z) * Math.min(1, 10 * dt);
    if (Math.abs(v) > 20) dir = Math.sign(v);
    // media vuelta al cambiar de sentido, algo blanda para que se vea el volantazo
    yawV += (70 * (parked() - yaw) - 10 * yawV) * dt;
    yaw += yawV * dt;
    sp = v * Math.sin(yaw);
    steer -= steer * Math.min(1, 10 * dt);
  } else if (drive(mode === 'drag' ? goal : strip, dt) && mode === 'back') {
    // ya en la franja: vuelve a mandar el scroll y el muelle lo deja de lado, aparcado
    mode = 'scroll';
    v = 0;
    dir = Math.sin(yaw) < 0 ? -1 : 1;
    yaw = parked() + wrap(yaw - parked());
    yawV = 0;
  }

  // suspensión: acelera → morro arriba, frena → morro abajo; en las curvas la carrocería se va hacia fuera
  pitchV += (180 * (clamp((sp - sp0) / dt * 0.00008, 0.16) - pitch) - 9 * pitchV) * dt;
  pitch += pitchV * dt;
  rollV += (180 * (clamp(sp * wrap(yaw - yaw0) / dt * 0.0002, 0.08) - roll) - 16 * rollV) * dt;
  roll += rollV * dt;

  // saltito al pitar
  if (y > 0 || vy > 0) {
    vy -= 1800 * dt;
    y += vy * dt;
    if (y <= 0) { y = 0; vy = 0; pitchV -= 3; }
  }

  const spin = (sp * dt) / (0.43 * s); // radio de la rueda: 0,43
  wheels.forEach((w, i) => {
    w.userData.cylinder.rotation.z += i % 2 ? -spin : spin;
    if (i < 2) w.rotation.y = (i ? 0 : Math.PI) + steer * 0.5;
  });
  car.position.set(x, y, z);
  car.rotation.y = yaw;
  chassis.rotation.set(roll, 0, pitch);
  ground.position.set(x, 0, z);
  sun.position.set(x - 150, 400, z + 250);
  sun.target.position.set(x, 0, z);
  renderer.render(scene, camera);
  placeHint();

  const still = mode !== 'back' && Math.abs(sp) < 0.5 && Math.abs(steer) < 0.002 && Math.abs(pitch) < 0.002 &&
    Math.abs(pitchV) < 0.01 && Math.abs(roll) < 0.002 && Math.abs(rollV) < 0.01 && y === 0 &&
    (mode === 'drag' || (Math.abs(strip.x - x) < 0.3 && Math.abs(strip.z - z) < 0.3 && Math.abs(v) < 2 &&
      Math.abs(parked() - yaw) < 0.002 && Math.abs(yawV) < 0.01));
  raf = still ? 0 : requestAnimationFrame(tick);
}

// claxon: dos notas a la vez, dos toques cortos
let actx;
function honk() {
  actx ??= new AudioContext();
  const t = actx.currentTime;
  const out = actx.createGain();
  const lp = actx.createBiquadFilter();
  lp.frequency.value = 1600;
  lp.connect(out).connect(actx.destination);
  out.gain.value = 0.0001;
  for (const at of [0, 0.18]) {
    out.gain.setValueAtTime(0.0001, t + at);
    out.gain.exponentialRampToValueAtTime(0.1, t + at + 0.015);
    out.gain.setValueAtTime(0.1, t + at + 0.11);
    out.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.14);
  }
  for (const f of [392, 494]) {
    const o = actx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + 0.35);
  }
}

// El lienzo no recoge clics (no tapa la web), así que el coche se busca a mano con un rayo.
// Clic corto: pita y salta. Pulsar y mover: conduce hacia el puntero. Soltar: vuelve a la franja.
const over = p => !!chassis && aim(p).intersectObject(car, true).length > 0;
let press = null, swallow = 0;
const cursor = c => {
  document.documentElement.classList.toggle('car-grab', c === 'grab');
  document.documentElement.classList.toggle('car-grabbing', c === 'grabbing');
};

addEventListener('pointerdown', e => {
  if (e.button || !over(e)) return;
  e.preventDefault(); // sin seleccionar texto mientras arrastras
  press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  grab.set(x, 0, z).sub(toGround(e, tmp)); // dónde lo has cogido: si no, al agarrarlo por el techo daría un tirón
  if (!reduce) cursor('grabbing');
});

addEventListener('pointermove', e => {
  if (press?.id === e.pointerId) {
    if (!press.moved && !reduce && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 4) {
      press.moved = true;
      learned = true;
      if (mode === 'scroll') { sp = v * Math.sin(yaw); rev = false; }
      mode = 'drag';
    }
    if (press.moved) { toGround(e, goal).add(grab); wake(); }
  } else if (!press && e.pointerType === 'mouse' && !reduce) cursor(over(e) ? 'grab' : '');
});

function release(e) {
  if (press?.id !== e.pointerId) return;
  if (press.moved) mode = 'back';
  else if (e.type === 'pointerup') {
    honk();
    if (!reduce && y === 0) vy = 420;
  }
  cursor(press.moved || reduce || e.pointerType !== 'mouse' ? '' : 'grab'); // si se va conduciendo, ya no está debajo
  press = null;
  swallow = e.timeStamp + 500; // el clic que viene detrás era para el coche, no para un enlace de debajo
  wake();
}
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('click', e => {
  if (e.timeStamp > swallow) return;
  swallow = 0;
  e.preventDefault();
  e.stopPropagation();
}, true);
// en el móvil, el dedo que empieza sobre el coche lo arrastra en vez de mover la página
addEventListener('touchstart', e => { if (!reduce && e.touches.length === 1 && over(e.touches[0])) e.preventDefault(); }, { passive: false });

addEventListener('scroll', wake, { passive: true });
addEventListener('resize', resize);

new GLTFLoader().load('coche/default.glb', ({ scene: glb }) => {
  chassis = glb.getObjectByName('chassis001');
  const wheel = glb.getObjectByName('wheelContainer001');
  // luces que en su juego solo se encienden al frenar o con el intermitente; la suspensión, en reposo, mide 0
  for (const n of ['blinkerLeft001', 'blinkerRight001', 'stopLights001']) chassis.getObjectByName(n).visible = false;
  wheel.getObjectByName('wheelSuspension002').visible = false;

  const meshes = [];
  glb.traverse(o => o.isMesh && meshes.push(o));
  const paint = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const light = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // contorno en tinta (la misma pieza algo mayor, vista por dentro): el coche rojo se lee sobre el rojo de la web;
  // sobre las zonas oscuras el contorno no se ve, pero ahí ya destaca la chapa roja
  const edge = new THREE.MeshBasicMaterial({ color: 0x160000, side: THREE.BackSide });
  for (const o of meshes) {
    const m = o.material, g = o.geometry;
    if (m.name === 'redGradient') bake(g, '#ff3a3a', '#721551');
    else if (m.name === 'emissiveOrangeRadialGradient') bake(g, o.name === 'backLights' ? '#ffffff' : '#ff8641', o.name === 'backLights' ? '#ffffff' : '#ff3e00', 2.6);
    else if (m.name === 'emissivePurpleRadialGradient') bake(g, '#454bbc', '#ff2eb4', 1.7);
    o.material = m.name === 'palette' ? new THREE.MeshLambertMaterial({ map: m.map, side: THREE.DoubleSide })
      : m.name === 'darkGray' ? new THREE.MeshLambertMaterial({ color: m.color, side: THREE.DoubleSide })
      : m.name === 'redGradient' ? paint : light;
    o.castShadow = true;
    const hull = new THREE.Mesh(g, edge);
    hull.scale.setScalar(1.07);
    o.add(hull);
  }

  // Bruno lo modeló mirando a +x; aquí el morro va en +z. Una sola rueda en el archivo: se clona a las cuatro esquinas.
  const model = new THREE.Group();
  model.rotation.y = -Math.PI / 2;
  model.add(chassis);
  wheels = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([fx, fz]) => {
    const w = wheel.clone();
    w.position.set(0.9 * fx, 0.43, 0.75 * fz);
    if (fz > 0) w.rotation.y = Math.PI; // la rueda del archivo es la del lado izquierdo
    w.userData.cylinder = w.getObjectByName('wheelCylinder001');
    model.add(w);
    return w;
  });
  // halo de los faros: WebGL no trae el bloom de Bruno, así que un degradado suma luz por encima de la web
  const halo = document.createElement('canvas');
  halo.width = halo.height = 64;
  const hx = halo.getContext('2d'), hg = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
  hg.addColorStop(0, 'rgba(255,214,80,.9)');
  hg.addColorStop(1, 'rgba(255,120,0,0)');
  hx.fillStyle = hg;
  hx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(halo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(1.5, 0, 0);
  glow.scale.set(2, 1, 1);
  chassis.add(glow);
  car.add(model);
  resize();
  canvas.style.opacity = 1;
});
