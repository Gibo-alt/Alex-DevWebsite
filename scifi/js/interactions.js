/* ============================================================
   Pointer + UI interactions: crosshair cursor, 3D card tilt,
   magnetic buttons, HUD readout, nav, glitch labels.
   Pointer effects are skipped on touch devices / reduced motion.
   ============================================================ */
import { REDUCED, COARSE, clamp } from './config.js';

const HOT = 'a, button, [data-hover], [data-tilt]';

/** Custom crosshair cursor that grows over clickable things. */
export function initCursor() {
  const el = document.getElementById('cursor');
  if (!el || COARSE) return;
  document.documentElement.classList.add('has-cursor');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    el.classList.remove('hide');
    el.classList.toggle('hot', !!e.target.closest(HOT));
  }, { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('down'));
  window.addEventListener('pointerup', () => el.classList.remove('down'));
  document.addEventListener('pointerleave', () => el.classList.add('hide'));
  const loop = () => {
    cx += (x - cx) * 0.28; cy += (y - cy) * 0.28;
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/** Cards tilt in 3D toward the pointer and light up under it. */
export function initTilt(els) {
  if (COARSE || REDUCED) return;
  const MAX = 7;
  els.forEach(el => {
    let raf = 0, tx = 0, ty = 0;
    const apply = () => { raf = 0; el.style.transform = `perspective(900px) rotateX(${tx}deg) rotateY(${ty}deg) translateZ(0)`; };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ty = (px - 0.5) * 2 * MAX; tx = -(py - 0.5) * 2 * MAX;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerleave', () => {
      tx = ty = 0;
      el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
      apply();
      setTimeout(() => { el.style.transition = ''; }, 520);
    });
    el.addEventListener('pointerenter', () => { el.style.transition = 'transform .08s linear'; });
  });
}

/** Buttons are gently pulled toward the pointer. */
export function initMagnetic(els) {
  if (COARSE || REDUCED) return;
  els.forEach(el => {
    const strength = 0.32, reach = 70;
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = 'transform .12s linear';
      el.style.transform = `translate(${clamp(dx * strength, -reach, reach)}px, ${clamp(dy * strength, -reach, reach)}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .6s cubic-bezier(.2,1.4,.3,1)';
      el.style.transform = '';
    });
  });
}

/** RGB-split hover needs each label copied into data-text. */
export function initGlitchLabels() {
  document.querySelectorAll('.glitch').forEach(el => { el.dataset.text = el.textContent.trim(); });
}

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
      if (e.isIntersecting) anchors.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => io.observe(s));
}

/** Little HUD readout: pointer coordinates, scroll %, uptime clock. */
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
  return progress => { if (scroll) scroll.textContent = `SCROLL ${pad(progress * 100, 3)}%`; };
}
