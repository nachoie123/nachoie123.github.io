// Música de fondo al estilo bruno-simon.com. Pieza suelta: <script src="radio.js"></script> y una carpeta musica/.
// Temas de Kounine para folio-2025 de Bruno Simon, licencia CC0 (musica/LICENSE-CC0.md).
// - El tema lo elige el reloj y cambia cada 3 min: quien entra a la vez oye lo mismo, como una emisora.
// - Siempre empieza encendida e intenta sonar nada más cargar (Chrome lo deja a quien ya ha visitado la web);
//   si el navegador lo bloquea, arranca con el primer gesto en cualquier parte, también al agarrar el coche.
// - El volumen va por Web Audio y no por audio.volume, porque el iPhone ignora audio.volume y sonaría al 100 %.
(() => {
  const TRACKS = ['Baguira', 'Sudo'];
  const VOL = 0.16;
  const url = n => `musica/${TRACKS[n]}.mp3`;
  let i = Math.floor(Date.now() / 180000) % TRACKS.length;
  let muted = false, heard = false; // el silencio ya no se recuerda entre visitas: cada visita empieza con música

  const audio = new Audio();
  audio.preload = 'none';
  let ctx, gain;

  document.head.insertAdjacentHTML('beforeend', `<style>
.radio{position:fixed;right:calc(var(--frame,1rem) + .75rem);bottom:calc(var(--frame,1rem) + .75rem);z-index:50;display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;border:1px solid var(--ink,#160000);background:var(--red,#f40c3f);color:var(--ink,#160000);font:400 10px/1 var(--mono,monospace);letter-spacing:.18em;text-transform:uppercase;cursor:pointer;transition:background .3s,color .3s}
.radio:hover{background:var(--ink,#160000);color:var(--red,#f40c3f)}
.radio:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.radio__bars{display:flex;align-items:flex-end;gap:2px;height:10px}
.radio__bars i{width:2px;height:100%;background:currentColor;transform:scaleY(.2);transform-origin:bottom;transition:transform .3s}
.radio.is-playing .radio__bars i{animation:radio-eq .8s ease-in-out infinite alternate}
.radio.is-playing .radio__bars i:nth-child(2){animation-delay:-.27s}
.radio.is-playing .radio__bars i:nth-child(3){animation-delay:-.53s}
@keyframes radio-eq{to{transform:scaleY(1)}}
.radio-toast{position:fixed;right:calc(var(--frame,1rem) + .75rem);bottom:calc(var(--frame,1rem) + 3.6rem);z-index:50;padding:.6rem .85rem;background:var(--ink,#160000);color:var(--red,#f40c3f);font:400 10px/1 var(--mono,monospace);letter-spacing:.18em;text-transform:uppercase;opacity:0;transform:translateY(.5rem);transition:opacity .4s,transform .6s var(--expo-out,ease-out);pointer-events:none}
.radio-toast.is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.radio.is-playing .radio__bars i{animation:none;transform:scaleY(.6)}}
@media (max-width:600px){.radio__label{display:none}}
</style>`);
  const btn = document.createElement('button');
  btn.className = 'radio';
  btn.setAttribute('aria-label', 'Background music');
  btn.innerHTML = '<span class="radio__bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="radio__label"></span>';
  const toast = document.createElement('p');
  toast.className = 'radio-toast';
  toast.setAttribute('aria-live', 'polite');
  document.body.append(audio, toast, btn);

  const render = () => {
    const on = !!ctx && !muted;
    btn.setAttribute('aria-pressed', on);
    btn.lastChild.textContent = on ? 'Sound on' : 'Sound off';
  };

  const ramp = (to, s) => {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(to, t + s);
  };

  const show = text => {
    toast.textContent = text;
    toast.classList.add('is-in');
    clearTimeout(show.t);
    show.t = setTimeout(() => toast.classList.remove('is-in'), 5000);
  };

  // "cla-clac" de cambiador de CD, sintetizado: el sonido de Bruno no está en la carpeta CC0.
  const clack = () => {
    const len = ctx.sampleRate * 0.05 | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len) ** 4;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.connect(gain); // pasa por el volumen de la música, así respeta el silencio
    for (const at of [0, 0.13]) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(bp);
      src.start(ctx.currentTime + at);
    }
  };

  const next = () => {
    i = (i + 1) % TRACKS.length;
    audio.src = url(i);
    if (!muted) audio.play().catch(() => {});
  };

  // Sin permiso, resume() se queda esperando y el tema no se pide hasta que el audio puede sonar de verdad.
  // Con permiso (o al llegar el gesto) suena, y la subida de volumen arranca justo entonces.
  const go = () => ctx.resume().then(() => {
    if (!muted && audio.paused && !audio.ended) audio.play().catch(() => {});
  });

  // Primer gesto válido en cualquier parte de la página. Se queda escuchando hasta que suena de verdad
  // (un Tab, un Escape o el inicio de un toque no cuentan como permiso para el navegador).
  const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'];
  const kick = e => {
    if (!muted && !btn.contains(e.target)) go();
  };
  GESTURES.forEach(t => addEventListener(t, kick, true));

  audio.addEventListener('playing', () => {
    heard = true;
    GESTURES.forEach(t => removeEventListener(t, kick, true));
    btn.classList.add('is-playing');
    if (audio.currentTime < 1) show(`Now playing — ${TRACKS[i]} · Kounine`);
  });
  audio.addEventListener('pause', () => btn.classList.remove('is-playing'));
  audio.addEventListener('ended', () => {
    clack();
    setTimeout(next, 3000);
  });

  btn.addEventListener('click', () => {
    if (!heard) return go(); // si aún no ha sonado nunca, el botón la pone en vez de silenciarla
    muted = !muted;
    render();
    if (muted) {
      ramp(0, 0.4);
      setTimeout(() => muted && audio.pause(), 400);
    } else {
      ctx.resume();
      ramp(VOL, 1);
      if (!audio.ended) audio.play().catch(() => {}); // si está en la pausa entre temas, el temporizador pone el siguiente
    }
  });

  ctx = new AudioContext();
  gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
  audio.src = url(i);
  ramp(VOL, 4); // fundido de entrada; con el audio bloqueado el reloj no corre, así que empieza cuando suena
  render();
  go();
})();
