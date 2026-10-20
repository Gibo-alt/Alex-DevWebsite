/* Stats: count up with a scramble effect (digits resolve left to right). */
import { REDUCED, GLYPHS, pick } from './config.js';

function runCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const suffix = el.dataset.suffix || '';
  const group = el.dataset.group !== '0';
  const fmt = n => (group ? n.toLocaleString('en-US') : String(n));
  const finalText = fmt(target) + suffix;
  if (REDUCED) { el.textContent = finalText; return; }

  const len = fmt(target).length;
  const dur = 2000;
  const t0 = performance.now();
  el.style.minWidth = finalText.length + 'ch';

  const frame = now => {
    const p = Math.min(1, (now - t0) / dur);
    if (p >= 1) { el.textContent = finalText; return; }
    const eased = 1 - Math.pow(1 - p, 3);
    const cur = fmt(Math.round(target * eased)).padStart(len, '0');
    let out = '';
    for (let i = 0; i < len; i++) {
      const lockPoint = 0.35 + 0.6 * (i / len);       // leftmost digits settle first
      out += p >= lockPoint ? cur[i] : (Math.random() < 0.4 ? pick(GLYPHS) : cur[i]);
    }
    el.textContent = out + suffix;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function initCounters(els) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { runCounter(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.6 });
  els.forEach(el => io.observe(el));
}
