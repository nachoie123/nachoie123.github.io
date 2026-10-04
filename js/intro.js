// ENTRADA: dos anillos de texto en 3D (imitación del loader de olhalazarieva.com, de ~/Projects/text-ring-loader).
// Solo los anillos: el revelado "Creative Developer" de la original se ha quitado. Fondo = color con el que arranca la web.
// Al salir, los anillos caen y la portada (hero.js) arranca su propia entrada.
import * as THREE from 'three';
import { reduce, lenis } from './shared.js';
import { play } from './hero.js';

const RING_BIG = 'CODE THAT CHANGES THE WORLD'.split(' ');
const RING_SMALL = ['AUTOMATION', 'QUANT FINANCE', 'AI AGENTS', 'WEB DESIGN', 'DEVELOPMENT'];
const INK = '#160000';
const PAPER = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();   // el fondo de la web al cargar (crema)

const el = document.querySelector('.intro'), counter = el.querySelector('.intro__count');
history.scrollRestoration = 'manual';   // la web siempre empieza arriba: la entrada no tiene sentido a mitad de página
scrollTo(0, 0);

if (reduce) el.remove();
else { lenis.stop(); start(); }

async function start() {
  // el texto del lienzo necesita las fuentes buenas, no las de reserva (y no esperar más de 2,5 s a la página)
  if (document.readyState !== 'complete') await Promise.race([
    new Promise(r => addEventListener('load', r, { once: true })), new Promise(r => setTimeout(r, 2500))]);
  await Promise.all([document.fonts.load('700 150px "Sofia Sans Condensed"'), document.fonts.load('400 30px "IBM Plex Mono"')]);

  const renderer = new THREE.WebGLRenderer({ canvas: el.querySelector('canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
  camera.position.set(0, 0, 6);
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  resize();
  addEventListener('resize', resize);

  // Banda de texto en el ecuador de una textura de 2048x1024 → envuelve una esfera como un cinturón
  function ringTexture(font, parts, spacing = '0px') {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 1024;
    const g = c.getContext('2d');
    g.font = font; g.letterSpacing = spacing; g.fillStyle = INK;
    const w = parts.map(p => g.measureText(p).width);
    const gap = (2048 - w.reduce((a, b) => a + b)) / parts.length; // el hueco de la costura también cuenta: no se ve el corte
    const cap = g.measureText('H').actualBoundingBoxAscent;
    let x = gap / 2;
    parts.forEach((p, i) => { g.fillText(p, x, 512 + cap / 2); x += w[i] + gap; });
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }
  // tira los píxeles casi transparentes y suaviza el borde: letras nítidas y las dos caras visibles
  const material = map => new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < .05) discard;
        float a = smoothstep(.05, .1, c.a);
        gl_FragColor = vec4(c.rgb * a, c.a * a);
      }`,
    transparent: true, side: THREE.DoubleSide,
  });

  const geo = new THREE.SphereGeometry(1, 64, 64);
  const big = new THREE.Mesh(geo, material(ringTexture('700 150px "Sofia Sans Condensed"', RING_BIG, '-2px')));
  const small = new THREE.Mesh(geo, material(ringTexture('400 30px "IBM Plex Mono"', RING_SMALL.flatMap(s => [s, '•']))));
  const wobble = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = innerWidth > 768 ? -.6 : 0;
  wobble.add(big, small); tilt.add(wobble); scene.add(tilt);
  big.position.y = small.position.y = -8;

  // en escritorio la cámara orbita los anillos siguiendo al ratón (en reposo los mira de lado)
  const orbit = innerWidth > 1100, mouse = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  const onMove = e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; };
  addEventListener('mousemove', onMove);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta(), t = clock.elapsedTime;
    big.rotation.y -= .3 * dt;
    small.rotation.y -= .5 * dt;
    wobble.rotation.x = .4 + .05 * Math.sin(.2 * t);
    wobble.rotation.z = .2 + .05 * Math.cos(.25 * t);
    wobble.position.y = .05 * Math.sin(.3 * t);
    if (orbit) {
      look.x += .05 * (.6 * mouse.y - look.x);
      look.y += .05 * (.6 * mouse.x - look.y);
      const th = Math.PI / 2 - look.x, ph = look.y + Math.PI;
      camera.position.set(6 * Math.sin(th) * Math.cos(ph), 6 * Math.cos(th), 6 * Math.sin(th) * Math.sin(ph));
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  });

  // 1. los anillos suben desde abajo
  gsap.timeline()
    .to(big.position, { y: .18, duration: 2, delay: .6, ease: 'power4.out' })
    .to(small.position, { y: -.18, duration: 1.6, ease: 'power4.out' }, '-=1.6');

  // 2. contador 0 → 100 %, y 3. salida
  const progress = { v: 0 };
  gsap.timeline()
    .to(counter, { opacity: 1, duration: .5, delay: 1.5 })
    .to(progress, { v: 100, duration: 2.4, delay: .3, ease: 'power3.out', onUpdate: () => { counter.textContent = Math.round(progress.v) + '%'; } }, '-=0.3')
    .to(counter, { opacity: 0, duration: .3, onComplete: exit });

  function exit() {
    gsap.timeline()
      .to(small.position, { y: -10, duration: 1.2, ease: 'power4.in' })
      .to(big.position, { y: -10, duration: 1.2, ease: 'power4.in' }, '-=1.1');
    gsap.delayedCall(.6, play);   // la portada empieza a dibujarse mientras caen
    gsap.to(el, { opacity: 0, delay: 1, duration: .5, ease: 'power4.out', onComplete: () => {
      renderer.setAnimationLoop(null); renderer.dispose();
      removeEventListener('resize', resize); removeEventListener('mousemove', onMove);
      el.remove(); lenis.start();
    } });
  }
}
