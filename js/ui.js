/* Small UI pieces: mobile nav + active link, HUD readout. */
import { COARSE } from './config.js';

/** Mobile menu toggle + active-section highlighting. */
export function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    const set = open => { links.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
    toggle.addEventListener('click', () => set(!links.classList.contains('open')));
    links.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }
  const anchors = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) anchors.forEach(a => {
        const on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => io.observe(s));
}

/** HUD readout: pointer coordinates, scroll %, uptime clock. Returns a scroll-progress setter. */
export function initHud() {
  const coords = document.getElementById('hudCoords');
  const scroll = document.getElementById('hudScroll');
  const clock = document.getElementById('hudClock');
  const pad = (n, l = 4) => String(Math.round(n)).padStart(l, '0');
  if (coords && !COARSE) {
    let raf = 0, px = 0, py = 0;
    window.addEventListener('pointermove', e => {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; coords.textContent = `X ${pad(px)} · Y ${pad(py)}`; });
    }, { passive: true });
  }
  const t0 = performance.now();
  if (clock) setInterval(() => {
    const s = Math.floor((performance.now() - t0) / 1000);
    clock.textContent = `T+${pad(s / 60 | 0, 2)}:${pad(s % 60, 2)}`;
  }, 1000);
  return progress => { if (scroll) scroll.textContent = `SECTOR 7G · ${pad(progress * 100, 3)}%`; };
}
