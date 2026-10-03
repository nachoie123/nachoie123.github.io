// PARTE FINAL: contacto + pie (imitación de olhalazarieva.com, de ~/Projects/titular-por-letras), en rojo.
// Cambio al coserla: el formulario abre el correo con el mensaje ya escrito (la web no tiene servidor).
import './shared.js';   // registra ScrollTrigger y lo sincroniza con el scroll suave

const MAIL = 'ignaciosanbenitop@gmail.com';

// Trocea cada titular en palabras y letras, y deja caer las letras con el scroll
document.querySelectorAll('.animation-title').forEach(title => {
  const words = title.textContent.trim().split(' ');
  title.setAttribute('aria-label', title.textContent.trim());
  title.textContent = '';
  words.forEach((w, i) => {
    const word = document.createElement('span');
    word.className = 'word';
    word.setAttribute('aria-hidden', 'true');
    for (const ch of w) {
      const l = document.createElement('span');
      l.className = 'letter';
      l.textContent = ch;
      word.appendChild(l);
    }
    title.appendChild(word);
    if (i < words.length - 1) title.append(' ');
  });

  // Valores calcados de la original: caen desde -120 %, del centro hacia fuera,
  // atadas al scroll (scrub) entre "asoma por abajo" y "ya va por el 30 % de pantalla"
  gsap.fromTo(title.querySelectorAll('.letter'), { y: '-120%' }, {
    y: 0, duration: 1, ease: 'power3.out',
    stagger: { each: 0.05, from: 'center' },
    scrollTrigger: { trigger: title, start: 'top 100%', end: 'bottom 30%', scrub: 1 }
  });
});

gsap.fromTo('.form form', { opacity: 0 }, {
  opacity: 1, duration: 1.5, ease: 'power3.out',
  scrollTrigger: { trigger: '.form', start: 'top 85%' }
});

// Enviar = abrir el programa de correo con todo rellenado
document.querySelector('.form form').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const body = `${f.message}\n\n${f.name}${f.phone ? ' · ' + f.phone : ''}\n${f.email}`;
  location.href = `mailto:${MAIL}?subject=${encodeURIComponent('Project: ' + f.name)}&body=${encodeURIComponent(body)}`;
});

// ---------- Pie ----------
const split = (el, text) => [...text].map(ch => {
  const s = document.createElement('span');
  s.textContent = ch === ' ' ? '\u00a0' : ch;
  el.appendChild(s);
  return s;
});

// Nombre gigante: una letra por span; se ajusta para llenar el ancho justo
const title = document.querySelector('.footer-title');
const name = title.textContent; title.textContent = '';
title.setAttribute('aria-label', name);
const nameLetters = split(title, name);
nameLetters.filter(l => l.textContent === '\u00a0').forEach(l => l.className = 'sp');
function fitTitle() {
  nameLetters.forEach(l => l.style.fontSize = l.style.letterSpacing = '');
  const ratio = title.clientWidth / title.scrollWidth;
  const cs = getComputedStyle(nameLetters[0]);
  const fs = parseFloat(cs.fontSize) * ratio * 0.995, ls = parseFloat(cs.letterSpacing) * ratio;
  nameLetters.forEach(l => { l.style.fontSize = fs + 'px'; l.style.letterSpacing = ls + 'px'; });
}
// Valores de la original: suben desde 150 % por debajo, del centro hacia fuera, con scrub 5 (va muy "pesado")
gsap.fromTo(nameLetters, { yPercent: 150 }, {
  yPercent: 0, ease: 'power2.out', stagger: { each: 0.03, from: 'center' },
  scrollTrigger: { trigger: '.footer', start: 'clamp(top 30%)', end: 'clamp(bottom bottom)', scrub: 5 }
});
gsap.to('.footer-brackets', { opacity: 1, duration: 1.5, scrollTrigger: { trigger: '.footer', start: 'clamp(top 30%)' } });
gsap.to('.footer-reserved', { opacity: 1, delay: .8, duration: 1.5, scrollTrigger: { trigger: '.footer', start: 'clamp(top 30%)' } });

// [ BOTE ]: texto original + copia debajo; al entrar el ratón ruedan las dos hacia arriba letra a letra
document.querySelectorAll('.footer-brackets .link').forEach(a => {
  const text = a.textContent; a.textContent = '';
  a.setAttribute('aria-label', text);
  const orig = document.createElement('span'), clone = document.createElement('span');
  orig.className = 'original'; clone.className = 'clone'; clone.setAttribute('aria-hidden', 'true');
  const o = split(orig, text), c = split(clone, text);
  a.append(orig, clone);
  const roll = (yo, yc) => () => {
    if (innerWidth <= 1100) return;
    const opts = { stagger: { each: .02, from: 'end' }, duration: .5, ease: 'power3.out' };
    gsap.to(o, { yPercent: yo, ...opts });
    gsap.to(c, { yPercent: yc, ...opts });
  };
  a.addEventListener('mouseenter', roll(-100, -100));
  a.addEventListener('mouseleave', roll(0, 100));
});

// Reloj de Madrid en directo, con su desfase horario real (GMT+1 en invierno, GMT+2 en verano)
const clock = document.getElementById('clock');
const tick = () => {
  const now = new Date();
  const time = now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });
  const gmt = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' })
    .formatToParts(now).find(p => p.type === 'timeZoneName').value;
  clock.textContent = `(${gmt}) ${time}`;
};
tick(); setInterval(tick, 1000);

// Pinchar el mail lo copia y enseña "Copied" pegado al ratón (se abre de izquierda a derecha)
const tip = document.querySelector('.copy-tooltip');
let tipAnim, mouse = { x: 0, y: 0 };
addEventListener('mousemove', e => {
  mouse = { x: e.clientX + 40, y: e.clientY };
  gsap.to(tip, { x: mouse.x, y: mouse.y, duration: .4, ease: 'power2.out', overwrite: 'auto' });
});
document.querySelector('.footer-email').addEventListener('click', e => {
  if (!navigator.clipboard || matchMedia('(hover: none)').matches) return;   // en el móvil, abrir el correo
  e.preventDefault();
  navigator.clipboard.writeText(MAIL).catch(() => {});
  gsap.set(tip, { x: mouse.x, y: mouse.y });
  tipAnim?.kill();
  tipAnim = gsap.timeline()
    .fromTo(tip, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .5, ease: 'power3.out' })
    .to(tip, { clipPath: 'inset(0 0 0 100%)', duration: .5, ease: 'power3.out' }, '+=1.2');
});

// medir con la fuente buena y recolocar los disparadores (Work fija su altura por JS)
Promise.all([document.fonts.load('700 100px "Sofia Sans Condensed"'), document.fonts.ready]).then(() => { fitTitle(); ScrollTrigger.refresh(); });
addEventListener('resize', fitTitle);
