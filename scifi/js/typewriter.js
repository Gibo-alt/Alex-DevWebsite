/* ============================================================
   Typewriter effect with a blinking block cursor.
   - Elements marked [data-type] are typed one after another, once.
   - Layout never jumps: the not-yet-typed remainder stays in the
     flow as invisible text, so line wraps are final from the start.
   - Real text is kept in an sr-only copy for SEO + screen readers.
   ============================================================ */
import { REDUCED, rand } from './config.js';

export function prepareTypewriters(root = document) {
  const els = [...root.querySelectorAll('[data-type]')];
  els.forEach(el => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el._text = text;
    el.textContent = '';

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;

    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    const typed = document.createTextNode('');
    const rest = document.createElement('span');
    rest.className = 'tw-rest';
    rest.textContent = text;
    vis.append(typed, rest);

    el.append(sr, vis);
    el._tw = { typed, rest, vis };
  });
  return els;
}

export class TypeQueue {
  constructor() {
    this.items = [];
    this.running = false;
    this.started = false; // nothing types until the boot screen is gone
    this.cursor = document.createElement('span');
    this.cursor.className = 'tw-cursor';
    this.cursor.setAttribute('aria-hidden', 'true');
  }

  /** Queue elements (each is typed only once). */
  add(els) {
    els.forEach(el => { if (el._tw && !el._queued) { el._queued = true; this.items.push(el); } });
    if (this.started) this.pump();
  }

  start() { this.started = true; this.pump(); }

  async pump() {
    if (this.running) return;
    this.running = true;
    while (this.items.length) await this.type(this.items.shift());
    this.running = false;
  }

  type(el) {
    const { typed, rest, vis } = el._tw;
    const text = el._text;
    vis.insertBefore(this.cursor, rest); // cursor follows the active element

    if (REDUCED) { typed.nodeValue = text; rest.textContent = ''; this.cursor.remove(); return Promise.resolve(); }

    return new Promise(resolve => {
      // Speed up when a lot is waiting, and cap very long paragraphs
      const backlog = this.items.length;
      const speed = backlog > 8 ? 0.25 : backlog > 4 ? 0.5 : 1;
      const base = Math.min(1, 2200 / (text.length * 22));
      let i = 0;
      const step = () => {
        i++;
        typed.nodeValue = text.slice(0, i);
        rest.textContent = text.slice(i);
        if (i >= text.length) return resolve();
        const ch = text[i - 1];
        let d = rand(10, 36);                       // slightly random, like a real terminal
        if (/[.!?]/.test(ch)) d += 150;             // pause at sentence ends
        else if (/[,;:]/.test(ch)) d += 70;
        setTimeout(step, d * base * speed);
      };
      step();
    });
  }
}
