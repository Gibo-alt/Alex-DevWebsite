/* ============================================================
   Mission Log reader (log.html?slug=...): renders one article from
   blog/posts/<slug>.md inside the same sci-fi shell as the home page.
   Markdown is parsed with marked and sanitised with DOMPurify.
   Code blocks get syntax highlighting + copy buttons.
   ============================================================ */
import { REDUCED, MOBILE, LITE } from './config.js';
import { createScene } from './scene.js';
import { TextScramble } from './textScramble.js';
import { initCodeRain } from './codeRain.js';
import { initCursor } from './cursor.js';
import { initNav } from './ui.js';
import { initMotion } from './animations.js';
import { numbered } from './logs.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
const article = document.getElementById('article');

/* ---------- shell: background, scroll, cursor, nav ---------- */
const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
initCodeRain();
let scene = null;
try { scene = createScene(document.getElementById('scene'), { mobile: MOBILE || LITE, reduced: REDUCED }); } catch (e) { console.warn('3D scene disabled:', e); }
if (!scene) document.documentElement.classList.add('no-webgl');
initMotion({ onScroll: p => scene && scene.setProgress(p) });
window.addEventListener('pointermove', e => { if (scene) scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)); }, { passive: true });
initCursor();
initNav();

/* ---------- code blocks: highlight + copy ---------- */
function copy(text, btn) {
  const done = () => { btn.textContent = 'COPIED'; setTimeout(() => { btn.textContent = 'COPY'; }, 1500); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => {});
  else { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } t.remove(); }
}
function loadHljs() {
  if (window.hljs) return Promise.resolve(window.hljs);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    s.onload = () => res(window.hljs); s.onerror = rej;
    document.head.appendChild(s);
  });
}
function enhanceCode(prose) {
  prose.querySelectorAll('pre').forEach(pre => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'copy-code'; b.textContent = 'COPY';
    b.addEventListener('click', () => copy((pre.querySelector('code') || pre).textContent.replace(/\n$/, ''), b));
    pre.appendChild(b);
  });
  loadHljs().then(h => prose.querySelectorAll('pre code').forEach(c => { try { h.highlightElement(c); } catch (e) { /* leave plain */ } })).catch(() => { /* offline: plain code */ });
}

/* ---------- load + render the article ---------- */
function notFound() {
  article.innerHTML = `<p class="sys">SYS.05 // MISSION LOG</p><h1 class="title h2">Log not found</h1>
    <p>That mission log could not be found. <a class="read" href="./#logs">← Back to Mission Logs</a></p>`;
}

async function main() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) return notFound();

  let posts;
  try { posts = numbered(await (await fetch('blog/posts.json', { cache: 'no-cache' })).json()); } catch (e) { return notFound(); }
  const idx = posts.findIndex(p => p.slug === slug);
  if (idx < 0) return notFound();
  const p = posts[idx];

  let md;
  try {
    const r = await fetch('blog/posts/' + encodeURIComponent(slug) + '.md', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    md = await r.text();
  } catch (e) { return notFound(); }

  document.title = `${p.title} | ALEX`;
  const setMeta = (sel, v) => { const m = document.querySelector(sel); if (m) m.setAttribute('content', v); };
  setMeta('meta[name="description"]', p.excerpt);
  setMeta('meta[property="og:title"]', p.title);

  const html = window.marked ? window.marked.parse(md) : '<pre>' + esc(md) + '</pre>';
  const clean = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
  const label = 'LOG.' + String(p.n).padStart(3, '0');
  const newer = posts[idx - 1], older = posts[idx + 1];       // list is newest first

  article.innerHTML = `
    <a class="read back" href="./#logs">← MISSION LOGS</a>
    <header class="log-head">
      <p class="sys">${label} &nbsp;//&nbsp; <time datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time> &nbsp;//&nbsp; ${esc(p.readTime || '')}</p>
      <h1 class="title log-title" id="logTitle" data-scramble>${esc(p.title)}</h1>
      <p class="tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</p>
    </header>
    ${p.cover ? `<figure class="log-cover"><img src="blog/${esc(p.cover)}" alt="" width="1200" height="630" decoding="async"></figure>` : ''}
    <div class="panel log-body"><div class="prose">${clean}</div></div>
    <nav class="log-pager" aria-label="More mission logs">
      ${older ? `<a class="btn" data-magnetic href="log.html?slug=${encodeURIComponent(older.slug)}"><span>← LOG.${String(older.n).padStart(3, '0')}</span></a>` : '<span></span>'}
      <a class="btn" data-magnetic href="./#logs"><span>ALL LOGS</span></a>
      ${newer ? `<a class="btn btn-primary" data-magnetic href="log.html?slug=${encodeURIComponent(newer.slug)}"><span>LOG.${String(newer.n).padStart(3, '0')} →</span></a>` : '<span></span>'}
    </nav>`;

  const prose = article.querySelector('.prose');
  prose.querySelectorAll('img').forEach(img => {                  // article images are relative to blog/
    const src = img.getAttribute('src') || '';
    if (!/^(https?:|\/|data:)/.test(src)) img.setAttribute('src', 'blog/' + src);
    img.loading = 'lazy';
  });
  prose.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  enhanceCode(prose);

  const title = new TextScramble(document.getElementById('logTitle'));
  title.play();
  article.classList.add('ready');
  const fadeIn = [...article.querySelectorAll('.log-body, .log-cover, .log-pager')];
  if (window.gsap && !REDUCED && fadeIn.length) window.gsap.from(fadeIn, { opacity: 0, y: 40, duration: 0.9, ease: 'power3.out', stagger: 0.12 });
  if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
}

main().catch(err => { console.error(err); notFound(); });
