// About me y CV: cada bloque entra una vez, al asomar en pantalla.
for (const s of document.querySelectorAll('.about, .cv'))
  s.querySelectorAll('.ln > span').forEach((el, i) => el.style.setProperty('--d', i));

const seen = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.about .label, .about .col, .cv .rv').forEach(el => seen.observe(el));
