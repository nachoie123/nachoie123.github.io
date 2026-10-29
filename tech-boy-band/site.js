// Shared nav, footer, scroll reveal, bag and toast for every page
const PAGES = [['index.html', 'Home'], ['album.html', 'Album'], ['band.html', 'Band'], ['index.html#drive', 'Drive'], ['merch.html', 'Merch']];
const here = location.pathname.split('/').pop() || 'index.html';

document.body.insertAdjacentHTML('afterbegin', `
<nav class="nav" aria-label="Main">
  <a class="logo" href="index.html">Screen Door</a>
  <ul>${PAGES.map(([href, name]) =>
    `<li><a href="${href}"${href === here ? ' aria-current="page"' : ''}>${name}${name === 'Merch' ? '<span class="bag-count" aria-label="items in bag"></span>' : ''}</a></li>`).join('')}
  </ul>
</nav>`);

document.body.insertAdjacentHTML('beforeend', `
<footer><div class="wrap">
  <span>Screen Door · <strong>Going Nowhere Fast</strong> · 10 tracks · ~25 min</span>
  <span>A fictional band made for Tech Impact, IE University</span>
</div></footer>
<div class="toast" role="status" aria-live="polite"></div>`);

function toast(msg) {
  const t = document.querySelector('.toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// bag lives in sessionStorage so the count survives moving between pages
const bag = {
  get: () => { try { return JSON.parse(sessionStorage.getItem('bag')) || []; } catch { return []; } },
  add(item) { const b = bag.get(); b.push(item); try { sessionStorage.setItem('bag', JSON.stringify(b)); } catch {} bag.paint(); },
  paint() { const n = bag.get().length; document.querySelectorAll('.bag-count').forEach(el => el.textContent = n ? `(${n})` : ''); },
};
bag.paint();

const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

// sections can declare data-light: the page background follows the light while scrolling
const lit = document.querySelectorAll('[data-light-section]');
if (lit.length) {
  const lio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) document.body.dataset.light = e.target.dataset.lightSection;
  }), { rootMargin: '-45% 0px -45% 0px' });
  lit.forEach(el => lio.observe(el));
}
