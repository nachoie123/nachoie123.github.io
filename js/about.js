// SEGUNDA PARTE: las letras del manifiesto caen con el scroll (Matter.js) y dejan paso a About me.
// De ~/Projects/letras-que-caen, con los colores de la portada. Cambio: si cambia el ancho, rehace la física
// en vez de recargar la página (recargar repetiría la entrada de los anillos).
import { whileVisible } from './shared.js';

const { Engine, Bodies, Body, Composite } = Matter;
const LINES = [['Half finance,', 0], ['half code.', 0], ['I build tools', 1], ['people actually', 1], ['use.', 0]];
const sec = document.getElementById('manifesto'), stage = sec.querySelector('.mstage');
const t = stage.querySelector('.mtext'), meta = stage.querySelector('.meta'), cue = stage.querySelector('.cue'), about = stage.querySelector('.about');

// Cada línea que sube lleva su retraso (--d) para que entren escalonadas
about.querySelectorAll('.ln > span').forEach((s, i) => s.style.setProperty('--d', i));
t.innerHTML = LINES.map(([s, dim]) =>
  `<span class="l${dim ? ' dim' : ''}" aria-hidden="true">` + [...s].map(ch => ch === ' ' ? ' ' : `<span class="c">${ch}</span>`).join('') + '</span>'
).join('');

const clamp01 = v => Math.max(0, Math.min(1, v));
const clamp = (v, m) => Math.max(-m, Math.min(m, v));
const range = () => sec.offsetHeight - stage.offsetHeight;
const progress = () => clamp01(-sec.getBoundingClientRect().top / range());
const ease = x => x * x * (3 - 2 * x);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

let engine = null, letters = [], H = 0, assembling = null;
// Todas caen de golpe al llegar aquí (justo antes de que el montón se hunda); al volver por debajo se rehacen despacio
const DROP = .45, REBUILD_MS = 1800;

// Mide las letras en su sitio y monta un bloque de física por letra (quietas hasta que les toca caer)
function build() {
  t.style.transform = '';
  t.querySelectorAll('.c').forEach(el => { el.style.transform = ''; });
  const S = stage.getBoundingClientRect();
  t.style.fontSize = '10px';   // pequeño a propósito: a 100px desborda en móvil y el navegador aleja el zoom
  const r0 = t.getBoundingClientRect();
  const lineW = Math.max(...[...t.children].map(e => e.getBoundingClientRect().width));
  t.style.fontSize = 10 * Math.min((S.right - r0.left - 16) / lineW, S.height * .66 / r0.height) + 'px';

  engine = Engine.create({ gravity: { y: 1.8 }, positionIterations: 10, velocityIterations: 8 });
  let floorY = 0;
  letters = [...t.querySelectorAll('.c')].map(el => {
    const r = el.getBoundingClientRect();
    const small = /[.,]/.test(el.textContent);       // punto y coma: bloque pequeño abajo, no una columna alta
    const w = r.width, h = small ? r.width : r.height;
    const ox = w / 2, oy = r.height - h / 2;
    floorY = Math.max(floorY, r.bottom - S.top);
    el.style.transformOrigin = `${ox}px ${oy}px`;
    const home = { x: r.left - S.left + ox, y: r.top - S.top + oy };
    const body = Bodies.rectangle(home.x, home.y, w, h, { friction: .3, restitution: .2, chamfer: { radius: Math.min(w, h) * .08 } });
    Body.setStatic(body, true);
    return { el, body, home, down: false };
  });

  const W = S.width, T = 200;
  H = S.height;
  Composite.add(engine.world, [
    ...letters.map(l => l.body),
    Bodies.rectangle(W / 2, floorY + T / 2, W * 3, T, { isStatic: true }),
    Bodies.rectangle(-T / 2, H / 2, T, H * 6, { isStatic: true }),
    Bodies.rectangle(W + T / 2, H / 2, T, H * 6, { isStatic: true }),
  ]);
  assembling = null;
}

function drop(l) {
  l.down = true;
  Body.setStatic(l.body, false);
  Body.setVelocity(l.body, { x: (Math.random() - .5) * 5, y: -Math.random() * 2 });
  Body.setAngularVelocity(l.body, (Math.random() - .5) * .15);
}

// Cursor: la velocidad sale de la pantalla (hacer scroll no cuenta como mover el ratón)
let mx = -1e4, my = -1e4, pmx = mx, pmy = my, vx = 0, vy = 0, sink = 0;
addEventListener('pointermove', e => {
  if (mx < -1e3) { pmx = e.clientX; pmy = e.clientY; }
  mx = e.clientX; my = e.clientY;
});
document.addEventListener('pointerleave', () => { mx = my = pmx = pmy = -1e4; });

// Solo empuja letras que ya han caído; las que siguen en su sitio no se tocan
function poke() {
  const sp = Math.hypot(vx, vy);
  if (sp < 1.5) return;
  const st = stage.getBoundingClientRect(), lx = mx - st.left, ly = my - st.top - sink;
  for (const { body: b, down } of letters) {
    if (!down) continue;
    const dx = b.position.x - lx, dy = b.position.y - ly, d = Math.hypot(dx, dy) || 1;
    const R = Math.max(b.bounds.max.x - b.bounds.min.x, b.bounds.max.y - b.bounds.min.y) / 2 + 40;
    if (d > R) continue;
    const f = 1 - d / R, s = Math.min(sp, 50);
    Body.setVelocity(b, {
      x: clamp(b.velocity.x + vx * .6 * f + dx / d * s * .3 * f, 45),
      y: clamp(b.velocity.y + vy * .6 * f + dy / d * s * .3 * f - s * .15 * f, 45),
    });
    Body.setAngularVelocity(b, clamp(b.angularVelocity + (dx > 0 ? 1 : -1) * vy * .006 * f + (Math.random() - .5) * .04, .4));
  }
}

// Volver por encima del punto de caída = las letras regresan a su sitio
function rearm() {
  for (const l of letters) {
    l.down = false;
    Body.setStatic(l.body, true);
    l.from = { x: l.body.position.x, y: l.body.position.y, a: wrap(l.body.angle) };
  }
  assembling = performance.now();
}

const STEP = 1000 / 60;
let last = 0, acc = 0;
function frame(now) {
  const dt = Math.min(now - last, 100) || STEP; last = now; acc += dt;
  vx = (mx - pmx) * STEP / dt; vy = (my - pmy) * STEP / dt; pmx = mx; pmy = my;
  const p = progress();

  if (assembling !== null && p >= DROP) { assembling = null; letters.forEach(drop); }   // se puede cortar a medias
  if (assembling !== null) {
    let done = true;
    letters.forEach((l, i) => {
      const k = Math.min(Math.max((now - assembling - i * 4) / REBUILD_MS, 0), 1);
      const e = k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      if (k < 1) done = false;
      Body.setPosition(l.body, { x: l.from.x + (l.home.x - l.from.x) * e, y: l.from.y + (l.home.y - l.from.y) * e });
      Body.setAngle(l.body, l.from.a * (1 - e));
    });
    if (done) assembling = null;
  } else {
    if (p >= DROP && !letters.some(l => l.down)) letters.forEach(drop);
    if (p < DROP - .05 && letters.some(l => l.down)) rearm();
    poke();
  }

  // Salida: el montón se hunde por abajo, la cabecera se apaga y entra About me
  sink = H * 1.1 * ease(clamp01((p - .6) / .35));
  t.style.transform = `translateY(${sink}px)`;
  meta.style.opacity = 1 - clamp01((p - .56) / .08);
  cue.classList.toggle('off', p > .005);
  if (p > .66) about.classList.add('in');
  else if (p < .62) about.classList.remove('in');

  // ponytail: paso fijo de 60 Hz para que en pantallas de 120 Hz no vaya al doble de rápido
  while (acc >= STEP) { if (sink < H) Engine.update(engine, STEP); acc -= STEP; }
  for (const { el, body: b, home } of letters)
    el.style.transform = `translate(${b.position.x - home.x}px,${b.position.y - home.y}px) rotate(${b.angle}rad)`;
}

// medir con la fuente buena: con la de reserva el texto se sale
document.fonts.load('700 100px "Sofia Sans Condensed"').then(() => {
  build();
  // corre también media pantalla antes de verse: así al volver desde arriba ya están recolocadas
  whileVisible(sec, frame, '50% 0px');
  // si cambia el ancho se rehace la física; el alto no (en móvil la barra del navegador lo cambia al hacer scroll)
  let w0 = stage.clientWidth, rt;
  new ResizeObserver(() => {
    if (stage.clientWidth === w0) return;
    w0 = stage.clientWidth;
    clearTimeout(rt); rt = setTimeout(build, 300);
  }).observe(stage);
});
