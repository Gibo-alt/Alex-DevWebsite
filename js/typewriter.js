/* ============================================================
   Typewriter effect with a blinking █ cursor (ship-terminal feel).
   - [data-type] elements type one after another, once, ~15–30ms/char.
   - Layout never jumps: the not-yet-typed remainder stays in the flow as
     invisible text, so line wraps are final from the first character.
   - The shared cursor fades out ~3s after typing finishes.
     [data-keep-cursor] elements (hero subtitle) keep a blinking cursor.
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

const makeCursor = cls => {
  const c = document.createElement('span');
  c.className = 'tw-cursor' + (cls ? ' ' + cls : '');
  c.setAttribute('aria-hidden', 'true');
  return c;
};

export class TypeQueue {
  constructor() {
    this.items = [];
    this.running = false;
    this.started = false;           // nothing types until the intro is over
    this.cursor = makeCursor();
    this.fadeTimer = 0;
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
    // idle: let the shared cursor fade out after a few seconds
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => this.cursor.classList.add('fade'), 3000);
  }

  type(el) {
    const { typed, rest, vis } = el._tw;
    const text = el._text;
    clearTimeout(this.fadeTimer);
    this.cursor.classList.remove('fade');
    vis.insertBefore(this.cursor, rest);                 // the cursor follows the active element

    const finish = () => {
      if (el.hasAttribute('data-keep-cursor')) {         // this one keeps blinking for good
        const keep = makeCursor('keep');
        vis.insertBefore(keep, rest);
        this.cursor.remove();
      }
    };

    if (REDUCED) { typed.nodeValue = text; rest.textContent = ''; this.cursor.remove(); return Promise.resolve(); }

    return new Promise(resolve => {
      const backlog = this.items.length;                 // speed up when a lot is waiting
      const speed = backlog > 8 ? 0.3 : backlog > 4 ? 0.55 : 1;
      const base = Math.min(1, 3000 / (text.length * 25)); // cap very long paragraphs at ~3s
      let i = 0;
      const step = () => {
        i++;
        typed.nodeValue = text.slice(0, i);
        rest.textContent = text.slice(i);
        if (i >= text.length) { finish(); return resolve(); }
        const ch = text[i - 1];
        let d = rand(15, 30);                            // slightly random, like a real terminal
        if (/[.!?]/.test(ch)) d += 130; else if (/[,;:]/.test(ch)) d += 60;
        setTimeout(step, d * base * speed);
      };
      step();
    });
  }
}
