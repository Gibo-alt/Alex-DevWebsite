/* ============================================================
   Custom khaki targeting reticle. Follows the mouse with easing,
   grows (and turns blue) over clickable items, hidden on touch devices.
   ============================================================ */
import { COARSE } from './config.js';

const HOT = 'a, button, [data-hover], [data-tilt]';

export function initCursor() {
  const el = document.getElementById('reticle');
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
    cx += (x - cx) * 0.25; cy += (y - cy) * 0.25;               // eased follow
    el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;     // transform only: cheap
    requestAnimationFrame(loop);
  };
  loop();
}
