// WORK: una píldora roja que se abre en filas de W O R K mientras cruzan las fichas de los proyectos.
// De ~/Projects/wodniack-imitacion (timeline de GSAP de wodniack.dev portado a mano). Cambios al coserla:
// los vídeos no se descargan hasta que la sección se acerca, y el lienzo se repinta al cambiar de color.
import { root, lenis, whileVisible } from './shared.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pow = k => ({ in: t => t ** k, out: t => 1 - (1 - t) ** k, io: t => t < .5 ? (2 * t) ** k / 2 : 1 - (2 - 2 * t) ** k / 2 });
const [p1, p3, p4] = [pow(2), pow(4), pow(5)];          // gsap power1, power3, power4
const slowMo = t => {                                     // gsap slow(0.15, 0.6): entra rápido, se arrastra por el centro, sale rápido
  const r = t + (.5 - t) * .6;
  return t < .425 ? r - (1 - t / .425) ** 4 * r : t > .575 ? r + (t - r) * ((t - .575) / .425) ** 4 : r;
};

function Work(el) {
  const inner = el.querySelector('.work__inner'), scene = el.querySelector('.work__scene'), canvas = el.querySelector('.work__canvas');
  const mask = el.querySelector('.work__mask'), ruler = el.querySelector('.work__ruler'), ctx = canvas.getContext('2d');
  const [pIn, pOut, pLines] = ['in', 'out', 'lines'].map(k => mask.querySelector('.p-' + k));
  const rows = [...el.querySelectorAll('.work__col>span')].map(e => ({ el: e, ghosts: [] }));
  // todas las fichas al mismo tamaño (antes --size era aleatorio .5–1), una abajo y otra arriba para que no se pisen
  const cards = [...el.querySelectorAll('.work__card')].map((c, i) => {
    c.style.setProperty('--y', i % 2 ? -1 : 1);
    return { el: c, video: c.querySelector('video'), on: false };
  });
  el.style.setProperty('--height', cards.length * 50 + 'lvh');
  // línea de tiempo, en segundos de gsap: abre 0–.75, una ficha cada .25 desde .75, cierra en el último segundo
  const cardsEnd = .75 + (cards.length - 1) * .25 + .5, D = .75 + cardsEnd, closeAt = D - 1;
  const seg = (t, a, d) => clamp((t - a) / d);
  let W, H, maxScale, speed, points = [], t = null, sp = null, last = 0, drawn = '';

  function pill(x, y, w, h) { const r = w / 2; return `M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} Z`; }
  function render() {
    const close = t >= closeAt, a = seg(t, 0, .75), b = seg(t, closeAt, .75);
    const state = close ? 1 - p4.io(b) : p4.in(a);
    mask.style.transform = `scale(${close ? lerp(maxScale, 1, p4.io(b)) : lerp(1, maxScale, p4.in(a))})`;
    scene.style.transform = `scale(${close ? lerp(1, .75, p3.io(b)) : lerp(.75, 1, p3.in(a))})`;
    inner.style.clipPath = `inset(0 ${close ? p3.io(b) : 1 - p3.in(a)}rem)`;
    scene.style.setProperty('--state', state); inner.style.setProperty('--state', state);
    cards.forEach((c, i) => {
      const p = lerp(1, -1, slowMo(seg(t, .75 + i * .25, .5))), on = p > -1 && p < 1;
      c.el.style.setProperty('--progress', p);
      if (on !== c.on && c.video) on ? c.video.play().catch(() => {}) : c.video.pause();
      c.on = on;
    });
    // cada fila va a su velocidad; la copia que sale por la izquierda vuelve a entrar por la derecha
    const anim = 1e4 * p1.out(seg(t, .75, cardsEnd));
    rows.forEach(r => {
      const n = speed * r.freq;
      r.ghosts.forEach((g, i) => g.style.setProperty('--progress', ((anim % n / n + i / r.ghosts.length) % 1) / .7 - .15));
    });
    // rejilla de puntos: un 20 % hacia el centro mientras está cerrada, fluye a la izquierda con el scroll
    const pp = close ? 1 - p4.io(seg(t, closeAt, 1)) : p4.io(seg(t, 0, 1)), flow = anim * -.05 % 24, key = pp.toFixed(2) + flow.toFixed(1);
    if (key !== drawn) {
      drawn = key; ctx.clearRect(0, 0, W, H); ctx.beginPath();
      points.forEach(q => ctx.rect(q.x + q.dx * (1 - pp) * .2 + flow, q.y + q.dy * (1 - pp) * .2, .5, .5));
      ctx.stroke();
    }
  }
  return {
    resize() {
      W = innerWidth; H = innerHeight; speed = Math.hypot(W, H) * 4;
      // máscara: hoja roja con un agujero en forma de píldora, otra píldora 16 px dentro, y la rejilla fuera del agujero
      const mw = mask.clientWidth, mh = mask.clientHeight, s = el.getBoundingClientRect(), r = ruler.getBoundingClientRect();
      const x = r.left - s.left, y = r.top - s.top, d = W > 767 ? 16 : 8, sheet = `M -1 0 L ${mw + 2} 0 L ${mw + 2} ${mh} L -1 ${mh} Z`;
      const outer = `${sheet} ${pill(x, y, r.width, r.height)}`;
      maxScale = W / (r.width / 2);
      pOut.setAttribute('d', outer);
      pIn.setAttribute('d', `${sheet} ${pill(x + d, y + d, r.width - 2 * d, r.height - 2 * d)}`);
      const cols = W > 767 ? 12 : 8, rowH = mh * .1; let lines = '';
      for (let i = 1; i < cols; i++) lines += `M ${mw / cols * i} 0 L ${mw / cols * i} ${mh} `;
      for (let i = 0; i < Math.ceil(mh / rowH); i++) lines += `M 0 ${rowH * i} L ${mw} ${rowH * i} `;
      pLines.setAttribute('d', lines);
      pLines.style.clipPath = `path(evenodd, '${outer}')`;
      // letras: cada letra del título escondido se vuelve una fila de copias apiladas; --state las despliega
      const box = inner.getBoundingClientRect();
      rows.forEach((row, ri) => {
        row.ghosts.forEach(g => g.remove());
        const lr = row.el.getBoundingClientRect(), total = Math.round(W / lr.width * (W > 767 ? .75 : .5)) + 2;
        row.freq ??= 1 + Math.random();
        row.ghosts = Array.from({ length: total }, (_, i) => {
          const g = document.createElement('span');
          g.className = 'work__ghost'; g.textContent = g.dataset.letter = row.el.textContent; g.setAttribute('aria-hidden', 'true');
          g.style.cssText = `top:${lr.top - box.top}px;left:${lr.left - box.left}px;--iy:${((ri + 1) / (rows.length + 1) - .5) * 2}`;
          g.style.zIndex = 1;   // siempre detrás: delante tapaban el título de los paneles
          scene.append(g); return g;
        });
      });
      canvas.width = W; canvas.height = H; ctx.strokeStyle = getComputedStyle(root).getPropertyValue('--red');
      const g = 24, nx = Math.ceil(W * 1.2 / g), ny = Math.ceil(H * 1.2 / g), ox = (W - nx * g) / 2, oy = (H - ny * g) / 2;
      points = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const px = i * g + ox, py = j * g + oy; points.push({ x: px, y: py, dx: W / 2 - px, dy: H / 2 - py }); }
      drawn = ''; if (t !== null) render();
    },
    tick(now) {
      const r = el.getBoundingClientRect(), vh = innerHeight;
      const s = -clamp(r.top / vh) + 1 - clamp(r.bottom / vh);          // -1 entrando, 0 dentro, 1 saliendo
      if (s !== sp) el.style.setProperty('--sp', sp = s);
      const target = clamp((vh * .25 - r.top) / (r.height - vh * .5)) * D;
      const dt = Math.min(now - last, 100); last = now;
      if (t === null) t = target;
      else if (Math.abs(target - t) < 1e-5) return;
      else t += (target - t) * (1 - Math.exp(-dt / 250));   // scrub: ~1 s para alcanzar el scroll
      render();
    }
  };
}

const el = document.querySelector('.work');
const work = Work(el);
work.resize();
document.fonts.load('1em Anton').then(work.resize);   // las filas de letras se miden con Anton
addEventListener('resize', work.resize);
addEventListener('themechange', work.resize);         // el lienzo pinta con --red: hay que repintarlo
whileVisible(el, work.tick);

// WORK también se recorre de lado: el desplazamiento horizontal (trackpad, dedo) se convierte en scroll de la
// sección. La rueda vertical sigue valiendo porque un ratón normal no tiene eje X. Fuera de WORK, el lado no hace nada.
function range() {   // tramo de scroll en el que WORK está fijado y avanzan las fichas (el mismo que usa tick)
  const r = el.getBoundingClientRect(), vh = innerHeight, top = scrollY + r.top;
  return r.top < vh * .25 && r.bottom > vh * .75 ? [top - vh * .25, top + r.height - vh * .75] : null;
}
let goal = 0, at = 0;   // a dónde va el scroll suave: lenis.targetScroll no acumula los empujones de scrollTo
const slide = (dx, smooth) => {
  const rg = range(); if (!rg) return false;
  const from = smooth && performance.now() - at < 400 ? goal : scrollY, to = clamp(from + dx, rg[0], rg[1]);
  if (to === from) return false;
  lenis.scrollTo(goal = to, { immediate: !smooth }); at = performance.now();
  return true;
};
addEventListener('wheel', e => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && slide(e.deltaX, true)) { e.preventDefault(); e.stopPropagation(); }
}, { passive: false, capture: true });
let touch = null;
addEventListener('touchstart', e => { const p = e.touches[0]; touch = { x: p.clientX, y: p.clientY, side: null }; }, { passive: true });
addEventListener('touchmove', e => {
  if (!touch || e.touches.length > 1) return;
  const p = e.touches[0], dx = touch.x - p.clientX, dy = touch.y - p.clientY;
  touch.side ??= Math.hypot(dx, dy) > 8 ? Math.abs(dx) > Math.abs(dy) : null;   // decide una vez: de lado o de arriba abajo
  if (!touch.side) return;
  touch.x = p.clientX;
  if (slide(dx * 1.5, false)) e.preventDefault();
}, { passive: false });

// los vídeos de las fichas se piden cuando Work está a una pantalla y media, no durante la entrada
new IntersectionObserver(([e], io) => {
  if (!e.isIntersecting) return;
  io.disconnect();
  el.querySelectorAll('video').forEach(v => { v.preload = 'auto'; v.load(); });
}, { rootMargin: '150% 0px' }).observe(el);
