// About me: la pantalla se para (.scene) y entonces se destapan la foto y el texto; al volver arriba se recogen y repiten.
// CV: cada bloque entra una vez, al asomar en pantalla.
import './shared.js';

for (const s of document.querySelectorAll('.about, .cv'))
  s.querySelectorAll('.ln > span').forEach((el, i) => el.style.setProperty('--d', i));

// con la sección ya casi en su sitio: si salta antes, se destapa debajo de la portada y no se ve (fallo del 24/11/2026)
const scene = document.querySelector('.scene'), col = scene.querySelector('.col'), label = scene.querySelector('.label');
ScrollTrigger.create({ trigger: scene, start: 'top 85%', onEnter: () => label.classList.add('in'), onLeaveBack: () => label.classList.remove('in') });
// en el móvil la foto y el texto van arriba del todo y se ven nada más asomar: esperar al 30 % dejaba la pantalla vacía
const narrow = () => innerWidth <= 700;
ScrollTrigger.create({ trigger: scene, start: () => narrow() ? 'top 65%' : 'top 30%', onEnter: () => col.classList.add('in') });
ScrollTrigger.create({ trigger: scene, start: () => narrow() ? 'top 85%' : 'top 70%', onLeaveBack: () => col.classList.remove('in') });
// con la pantalla parada la foto se sigue acercando con el scroll (--k va de 0 a 1)
ScrollTrigger.create({ trigger: scene, start: 'top top', end: 'bottom top', onUpdate: t => col.style.setProperty('--k', t.progress.toFixed(3)) });

const seen = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.cv .rv').forEach(el => seen.observe(el));
