/* ============================================================
   TextScramble — heading "decode" effect.
   Each letter cycles through random symbols (khaki) and locks into
   the real character (charcoal) one by one, left to right.
   ~0.8–1.5s per heading, driven by requestAnimationFrame.
   Real text stays in the DOM (sr-only copy) for SEO + screen readers.
   ============================================================ */
import { REDUCED, GLYPHS, pick, rand } from './config.js';

export class TextScramble {
  /** @param {HTMLElement} el heading element */
  constructor(el) {
    this.el = el;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    this.text = text;
    el.textContent = '';

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;

    const vis = document.createElement('span');
    vis.className = 'sc';
    vis.setAttribute('aria-hidden', 'true');
    text.split(' ').forEach((word, i, words) => {
      const w = document.createElement('span');
      w.className = 'sc-word';                       // keeps words unbroken while scrambling
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

    this.chars = [...vis.querySelectorAll('.ch')];
    this.token = 0;
    this.locked = false;
    this.lastPlay = 0;
    if (!REDUCED) el.classList.add('sc-pre');        // hidden until its first play
  }

  /** Freeze each glyph's width (in em) so random symbols can't reflow the heading. */
  lockWidths() {
    if (this.locked) return;
    const widths = this.chars.map(s => s.getBoundingClientRect().width);
    this.chars.forEach((s, i) => {
      const fs = parseFloat(getComputedStyle(s).fontSize) || 16;
      if (widths[i]) s.style.width = (widths[i] / fs) + 'em';
    });
    this.locked = true;
  }

  /** Run the effect. Resolves when every letter has locked. */
  play() {
    this.el.classList.remove('sc-pre');
    this.lastPlay = performance.now();
    if (REDUCED) return Promise.resolve();
    this.lockWidths();

    const token = ++this.token;
    const chars = this.chars, n = chars.length;
    const total = Math.min(1500, Math.max(800, 500 + n * 55));    // 0.8–1.5s overall
    const stagger = (total - 350) / Math.max(1, n);
    const lockAt = chars.map((_, i) => 350 + i * stagger + rand(0, 90));
    const nextSwap = chars.map(() => 0);
    const t0 = performance.now();

    return new Promise(resolve => {
      const frame = now => {
        if (this.token !== token) return resolve();                // a newer run took over
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

  /** Replay each time the heading scrolls into view (with a small cooldown). */
  static observe(instances) {
    const map = new Map(instances.map(s => [s.el, s]));
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const s = map.get(e.target);
        if (e.isIntersecting) {
          if (!s.inView && performance.now() - s.lastPlay > 1500) s.play();
          s.inView = true;
        } else s.inView = false;
      });
    }, { threshold: 0.4 });
    instances.forEach(s => io.observe(s.el));
  }

  /** Replay on hover (used for the hero title). */
  replayOnHover() {
    this.el.addEventListener('pointerenter', () => { if (performance.now() - this.lastPlay > 900) this.play(); });
  }
}
