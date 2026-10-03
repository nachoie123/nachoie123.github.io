// PRIMERA PARTE: la portada roja (clon del hero de wodniack.dev, de ~/Projects/waves-hero).
// Ya no tiene pantalla de carga propia: la entrada son los anillos (intro.js), que llaman a play() al salir.
import { reduce, root, whileVisible } from './shared.js';

const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
const QUINT = 'cubic-bezier(0.86, 0, 0.07, 1)';
const QUART_IO = 'cubic-bezier(0.76, 0, 0.24, 1)';
const EXPO_IO = 'cubic-bezier(0.87, 0, 0.13, 1)';
const hero = document.querySelector('.hero');
const waves = hero.querySelector('.waves');
const svg = waves.querySelector('svg');
const dot = waves.querySelector('.dot');
const title = hero.querySelector('.title');
const titleIn = title.querySelector('.title-in');
const star = title.querySelector('.star');

// --- Ruido de Perlin 2D: un "mapa del viento" suave que dobla las líneas ---
const perm = new Uint8Array(512);
{
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
const GRAD = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const dot2 = (h, x, y) => { const g = GRAD[h % 12]; return g[0] * x + g[1] * y; };
function noise(x, y) {
  let X = Math.floor(x), Y = Math.floor(y);
  x -= X; y -= Y; X &= 255; Y &= 255;
  const u = fade(x);
  return lerp(
    lerp(dot2(perm[X + perm[Y]], x, y), dot2(perm[X + 1 + perm[Y]], x - 1, y), u),
    lerp(dot2(perm[X + perm[Y + 1]], x, y - 1), dot2(perm[X + 1 + perm[Y + 1]], x - 1, y - 1), u),
    fade(y));
}

// --- Líneas: columnas cada 10px, un punto cada 32px; cada punto es un muelle ---
// box.top va en coordenadas de página (no de pantalla): la portada ya no es fija, se va con el scroll
let box = { left: 0, top: 0, width: 0, height: 0 }, lines = [], paths = [], interactive = false, flipping = false;
const mouse = { x: 0, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, vs: 0, a: 0, set: false };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function setLines() {
  const r = waves.getBoundingClientRect();
  box = { left: r.left, top: r.top + scrollY, width: r.width, height: r.height };
  const { width: W, height: H } = box;
  const gx = 10, gy = 32;
  const cols = Math.ceil((W + 200) / gx), rows = Math.ceil((H + 30) / gy);
  const ox = (W - gx * cols) / 2, oy = (H - gy * rows) / 2;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  lines = []; paths = [];
  for (let c = 0; c <= cols; c++) {
    const pts = [];
    for (let r = 0; r <= rows; r++) pts.push({ x: ox + gx * c, y: oy + gy * r, wx: 0, wy: 0, cx: 0, cy: 0, vx: 0, vy: 0 });
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('pathLength', '1');
    svg.append(path);
    paths.push(path); lines.push(pts);
  }
}

function movePoints(t) {
  const { sx, sy, vs, a } = mouse;
  const reach = Math.max(175, vs), ca = Math.cos(a), sa = Math.sin(a);
  for (const pts of lines) for (const p of pts) {
    const ang = noise((p.x + t * 0.0125) * 0.002, (p.y + t * 0.005) * 0.0015) * 12;
    p.wx = Math.cos(ang) * 32;
    p.wy = Math.sin(ang) * 16;
    if (!interactive) continue;
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d < reach) {
      const f = Math.cos(d * 0.001) * (1 - d / reach) * reach * vs * 0.00065;
      p.vx += ca * f; p.vy += sa * f;
    }
    p.vx = (p.vx - p.cx * 0.005) * 0.925;   // muelle hacia casa + rozamiento
    p.vy = (p.vy - p.cy * 0.005) * 0.925;
    p.cx = clamp(p.cx + p.vx * 2, -100, 100);
    p.cy = clamp(p.cy + p.vy * 2, -100, 100);
  }
}

function drawLines() {
  lines.forEach((pts, i) => {
    const last = pts.length - 1;
    let d = '';
    pts.forEach((p, j) => {
      const pushed = j > 0 && j < last;   // los extremos no los empuja el ratón
      const x = p.x + p.wx + (pushed ? p.cx : 0), y = p.y + p.wy + (pushed ? p.cy : 0);
      d += `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    paths[i].setAttribute('d', d);
  });
}

addEventListener('pointermove', e => {
  if (!box.width) return;
  mouse.x = e.clientX - box.left;
  mouse.y = e.clientY - box.top + scrollY;
  if (!mouse.set) {
    Object.assign(mouse, { sx: mouse.x, sy: mouse.y, lx: mouse.x, ly: mouse.y, set: true });
    dot.classList.add('on');
  }
}, { passive: true });

// --- Título: partir en letras ---
const chars = [];
title.querySelectorAll('.word').forEach(w => {
  w.innerHTML = [...w.textContent.trim()].map(ch => ch === ' '
    ? '<span class="sp"></span>'
    : `<span class="char"><span class="ci" data-l="${ch}">${ch}</span></span>`).join('');
  chars.push(...w.querySelectorAll('.char'));
});

function fitTitle() {
  titleIn.style.fontSize = '100px';
  const avail = title.clientWidth - 48;
  const byWidth = 100 * avail / titleIn.offsetWidth;
  titleIn.style.fontSize = `${Math.min(byWidth, innerHeight * 0.3 / 1.1)}px`;
}

function flipTitle() {
  if (!flipping || Math.random() > 0.01) return;
  const c = chars[Math.random() * chars.length | 0];
  if (c.dataset.dir) return;
  const dir = 'to-' + ['top', 'right', 'bottom', 'left'][Math.random() * 4 | 0];
  c.dataset.dir = dir;
  c.classList.add(dir);
  setTimeout(() => { c.classList.remove(dir); delete c.dataset.dir; }, 2000);
}

// --- Tiras binarias ---
const bitOf = () => (Math.random() > 0.5 ? 1 : 0);
hero.querySelectorAll('.sep').forEach(sep => {
  const groups = innerWidth > 767 ? +sep.dataset.groups : 2;
  const parts = ['<i class="tri"></i>'];
  for (let g = 0; g < groups; g++) {
    parts.push(`<span class="bits">${Array.from({ length: +sep.dataset.bits }, () => `<b>${bitOf()}</b>`).join('')}</span>`);
    if (g < groups - 1) parts.push(`<span class="stripes">${'/'.repeat(300)}</span>`);
  }
  parts.push('<i class="tri"></i>');
  sep.firstElementChild.innerHTML = parts.join('');
});
const bits = [...hero.querySelectorAll('.sep b')];
const flipBits = () => bits.forEach(b => { if (Math.random() < 0.1) b.textContent = bitOf(); });

// --- Consola: escribe frases a máquina; pausa en comas, puntos y "…" ---
const MESSAGES = ['Preparing for inevitable debugging', 'Compiling designer dreams…into developer nightmares', 'Please wait while I overthink this', 'Optimizing… but nothing’s perfect', 'Configuring the next minor inconvenience', 'Fetching assets… contemplating the futility of it all', 'Re-routing your expectations… expect delays', 'Trying to animate enthusiasm… it’s not going well', 'Stuck in an infinite loop', 'Loading… still pointless', 'Simulating progress… sort of', 'This will probably break soon', 'Simulating something useful', 'Progress bar full of lies', 'Finding meaning in the code', 'Calculating failure probabilities', 'Please wait… indefinitely', 'Loading… almost there!', 'Animating pixels with love', 'Integrating magic and code', 'Optimizing creativity… stand by', 'Design and code handshake', 'Fetching creativity… almost done!', 'Preparing awesomeness', 'Simulating brilliance… probably', 'Everything is under control', 'Loading coolness… almost ready', 'Calibrating designer dreams', 'Fusing design and animation', 'Running creativity protocols', 'Crafting magic… please wait', 'Making things pretty… hold on', 'Loading… this might take a bit', 'Animating pixels… somewhat precisely', 'Integrating code and reality', 'Halfway done… maybe', 'Optimizing… cautiously hopeful', 'Design meets code… fingers crossed', 'Fetching some interesting stuff', 'Preparing… slowly but surely', 'Aligning pixels… carefully', 'Calibrating… what exactly? Good question', 'Waiting… patience is key', 'Simulating… something, probably', 'Loading… feel free to blink', 'Running some clever algorithms', 'Almost there… give or take', 'Integrating… like a pro', 'Crafting… without breaking anything', 'Adjusting fonts… nearly invisible', 'Piecing it together… stay tuned', 'Loading… nothing to see yet', 'Running final checks… hopefully', 'Almost ready… trust me', 'Building… it’s getting there', 'Loading… but why rush?', 'Please wait… or don’t, whatever', 'Initializing… prepare for bugs', 'Optimizing… but who cares?', 'Deploying… probably not broken', 'Making things work… hopefully', 'Running… but not too fast', 'Testing patience… stay calm', 'Initializing… no promises', 'Loading… but who’s counting?', 'Loading… could be worse'];
const consoleText = hero.querySelector('.console-text');
const con = { msg: '', last: '', lineBreak: false, lastType: 0, delay: 0, on: false };
function updateConsole(t) {
  if (!con.on || t - con.lastType < con.delay) return;
  if (con.msg === '') {
    let m;
    do m = MESSAGES[Math.random() * MESSAGES.length | 0]; while (m === con.last);
    con.msg = con.last = m;
    con.delay = 2000;
  } else {
    if (con.msg === con.last || con.lineBreak) consoleText.textContent += '\n';
    const ch = con.msg[0];
    con.msg = con.msg.slice(1);
    con.delay = ch === ',' || ch === ' ' ? 100 : ch === '…' || ch === '.' ? 400 : 20;
    consoleText.textContent += ch;
    con.lineBreak = ch === '…';
  }
  consoleText.textContent = consoleText.textContent.split('\n').slice(-5).join('\n');
  con.lastType = t;
}

// --- Cambio de color de TODA la web: rojo ↔ crema. Una cortina roja barre la pantalla ---
// Las demás partes solo leen --red; work.js escucha "themechange" para repintar su lienzo.
const mask = document.querySelector('.contrast-mask');
const setTheme = light => { root.classList.toggle('theme-light', light); dispatchEvent(new Event('themechange')); };
let sweeping = false;
hero.querySelector('.contrast').addEventListener('click', () => {
  if (sweeping) return;
  const toLight = !root.classList.contains('theme-light');
  if (reduce) return setTheme(toLight);
  sweeping = true;
  if (toLight) setTheme(true);
  const sweep = mask.animate(
    [{ transform: toLight ? 'none' : 'translateX(-100%)' }, { transform: toLight ? 'translateX(-100%)' : 'none' }],
    { duration: 1000, easing: EXPO_IO, fill: 'forwards' });
  sweep.finished.then(() => {
    if (!toLight) setTheme(false);
    sweep.cancel();
    sweeping = false;
  });
});

// --- Bucle (solo mientras la portada está en pantalla) ---
function tick(t) {
  const m = mouse;
  m.sx += (m.x - m.sx) * 0.1;
  m.sy += (m.y - m.sy) * 0.1;
  const dx = m.x - m.lx, dy = m.y - m.ly;
  m.vs = Math.min(100, m.vs + (Math.hypot(dx, dy) - m.vs) * 0.1);
  m.lx = m.x; m.ly = m.y;
  m.a = Math.atan2(dy, dx);
  dot.style.transform = `translate(${m.sx}px, ${m.sy}px)`;
  movePoints(t);
  drawLines();
  flipTitle();
  flipBits();
  updateConsole(t);
}

// --- Entrada: las líneas se dibujan de abajo arriba, primero los bordes ---
const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
function intro() {
  root.classList.remove('pre');
  // la franja oscura se encoge hasta ser una raya, sube, y vuelve a bajar destapando el título
  const slab = hero.querySelector('.slab'), content = hero.querySelector('.content');
  const up = `translateY(-${content.offsetHeight}px) scaleY(.025)`;
  slab.animate([{ transform: 'none', easing: EXPO_IO }, { transform: up, offset: 0.5, easing: EXPO_IO }, { transform: 'none' }], { duration: 2000 });
  content.animate([{ clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }, { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }],
    { duration: 1000, delay: 1000, easing: EXPO_IO, fill: 'backwards' });
  waves.classList.add('drawing');
  const n = paths.length;
  paths.forEach((p, i) => {
    const edge = Math.abs((i / (n - 1)) * 2 - 1);
    p.animate([{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }],
      { duration: 3000, delay: 500 + easeInOutCubic(1 - edge) * 500, easing: EXPO, fill: 'backwards' });
  });
  svg.animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 1350, easing: EXPO });
  chars.forEach((c, i) => c.firstChild.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }],
    { duration: 2000, delay: 450 + i * 20, easing: QUINT, fill: 'backwards' }));
  star.animate([{ transform: 'rotate(90deg)' }, { transform: 'none' }], { duration: 2000, delay: 1500, easing: EXPO, fill: 'backwards' });
  hero.querySelectorAll('.sep-in').forEach((s, i) => s.animate(
    [{ transform: `translateY(${i % 2 ? 100 : -100}%)` }, { transform: 'none' }],
    { duration: 1500, delay: 750, easing: QUINT, fill: 'backwards' }));
  setTimeout(() => { interactive = true; }, 2500);
  setTimeout(() => { flipping = true; }, 3000);
  setTimeout(() => waves.classList.remove('drawing'), 4100);
}

// --- Cabecera: baja desde arriba y luego cada casilla deja caer su contenido ---
function headIntro() {
  const head = hero.querySelector('.head');
  head.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 1500, delay: 1000, easing: EXPO_IO, fill: 'backwards' });
  head.querySelectorAll('.logo span, .menu a, .socials a, .contrast-in, .avail > * > *').forEach((el, i) => el.animate(
    [{ transform: 'translateY(-100%)' }, { transform: 'none' }],
    { duration: 1500, delay: 1500 + i * 100, easing: EXPO, fill: 'backwards' }));
  setTimeout(() => { con.on = true; }, 1500);
}

// --- El marco oscuro de la página crece desde los bordes (antes lo hacía la carga "NSB") ---
function frameIn() {
  const bars = document.querySelector('.frame-in');
  const grow = [...bars.children].map(b => b.animate([{ transform: 'none' }], { duration: 2000, easing: QUART_IO, fill: 'forwards' }));
  Promise.all(grow.map(a => a.finished)).then(() => { root.classList.remove('is-loading'); bars.remove(); });
}

// Esperar a la fuente del título: su tamaño decide cuánto alto les queda a las líneas
const fontsReady = document.fonts.load('100px Anton').finally(() => {
  fitTitle();
  setLines();
  addEventListener('resize', fitTitle);
  // El hueco de las líneas cambia con la ventana y con el título: rehacerlas cuando cambie
  let lastSize = `${box.width}x${box.height}`;
  new ResizeObserver(([e]) => {
    const size = `${e.contentRect.width}x${e.contentRect.height}`;
    if (size === lastSize) return;
    lastSize = size;
    setLines();
    if (reduce) { movePoints(0); drawLines(); }
  }).observe(waves);
  if (reduce) { movePoints(0); drawLines(); }
});

if (reduce) {
  root.classList.remove('pre', 'is-loading');
  document.querySelector('.frame-in').remove();
  consoleText.textContent = 'Loading… but why rush?';
}

// Lo llama intro.js cuando los anillos empiezan a caer
let played = false;
export async function play() {
  if (played || reduce) return;
  played = true;
  await fontsReady;
  frameIn();
  intro();
  headIntro();
  whileVisible(hero, tick);
}
