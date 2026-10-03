// Lo que comparten todas las partes: movimiento reducido, scroll suave y un solo bucle de animación
// al que cada parte se apunta solo mientras está en pantalla (fuera de pantalla no gasta).
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const root = document.documentElement;

// Lenis mueve el scroll nativo, así que sticky, fixed y scrollY siguen funcionando igual
export const lenis = new Lenis({ smoothWheel: !reduce });
gsap.registerPlugin(ScrollTrigger);
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// enlaces internos (#about, #work…) con el mismo scroll suave
addEventListener('click', e => {
  const a = e.target.closest?.('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  const id = a.getAttribute('href');
  e.preventDefault();
  lenis.scrollTo(id === '#top' || id === '#' ? 0 : id, { duration: 1.6 });
});

const ticks = new Set();
requestAnimationFrame(function loop(t) { ticks.forEach(f => f(t)); requestAnimationFrame(loop); });
export function whileVisible(el, f, margin = '0px') {
  new IntersectionObserver(([e]) => e.isIntersecting ? ticks.add(f) : ticks.delete(f), { rootMargin: margin }).observe(el);
}
