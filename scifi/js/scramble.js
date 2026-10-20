/* ============================================================
   Scramble ("decoding") text effect for headings.
   Each letter cycles through random symbols and locks into the
   real character one by one, left to right.
   Real text stays in the DOM (sr-only copy) for SEO + screen readers.
   ============================================================ */
import { REDUCED, GLYPHS, pick, rand } from './config.js';

/** Split a heading into per-character spans (keeps words unbroken). */
export function prepareScramble(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el._text = text;
  el.textContent = '';

  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;

  const vis = document.createElement('span');
  vis.className = 'sc';
  vis.setAttribute('aria-hidden', 'true');
  text.split(' ').forEach((word, i, words) => {
    const w = document.createElement('span');
    w.className = 'sc-word';
    [...word].forEach(c => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      s.dataset.c = c;
      w.append(s);
    });
    vis.append(w);
    if (i < words.length - 1) vis.append(' ');
  });
  el.append(sr, vis);
  el._chars = [...vis.querySelectorAll('.ch')];
  if (!REDUCED) el.classList.add('sc-pre'); // hidden until its first play
}

/** Freeze each glyph's width (in em) so random symbols can't reflow the heading. */
function lockWidths(el) {
  if (el._locked) return;
  const widths = el._chars.map(s => s.getBoundingClientRect().width);
  el._chars.forEach((s, i) => {
    const fs = parseFloat(getComputedStyle(s).fontSize) || 16;
    if (widths[i]) s.style.width = (widths[i] / fs) + 'em';
  });
  el._locked = true;
}

/** Play the decode animation. Resolves when every letter has locked. */
export function playScramble(el) {
  if (!el._chars) return Promise.resolve();
  el.classList.remove('sc-pre');
  if (REDUCED) return Promise.resolve();
  lockWidths(el);

  const token = (el._tok = (el._tok || 0) + 1);
  const chars = el._chars;
  const stagger = Math.min(60, 1000 / chars.length);
  const t0 = performance.now();
  const lockAt = chars.map((_, i) => 260 + i * stagger + rand(0, 160));
  const nextSwap = chars.map(() => 0);

  return new Promise(resolve => {
    const frame = now => {
      if (el._tok !== token) return resolve(); // a newer run took over
      const t = now - t0;
      let pending = 0;
      chars.forEach((s, i) => {
        if (t >= lockAt[i]) {
          if (s.textContent !== s.dataset.c) { s.textContent = s.dataset.c; s.classList.remove('scr'); }
        } else {
          pending++;
          if (now >= nextSwap[i]) { s.textContent = pick(GLYPHS); s.classList.add('scr'); nextSwap[i] = now + rand(40, 90); }
        }
      });
      if (pending) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/** Replay whenever a heading scrolls into view (with a small cooldown). */
export function observeScramble(els) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const el = e.target;
      if (e.isIntersecting) {
        if (!el._in && performance.now() - (el._last || 0) > 1500) { el._last = performance.now(); playScramble(el); }
        el._in = true;
      } else el._in = false;
    });
  }, { threshold: 0.4 });
  els.forEach(el => io.observe(el));
}

/** Replay on hover (used for the main title). */
export function replayOnHover(el) {
  el.addEventListener('pointerenter', () => {
    if (performance.now() - (el._last || 0) > 900) { el._last = performance.now(); playScramble(el); }
  });
}
