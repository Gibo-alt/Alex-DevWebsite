/* ============================================================
   Mission Logs sync: the cards in index.html are generated at build time
   (build-logs.py) for SEO. On load we compare them with blog/posts.json and
   re-render if posts were added, edited or removed in the blog editor.
   Must run BEFORE the text effects are prepared.
   ============================================================ */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const logCard = (p, n) => `
          <li class="card" data-reveal><article class="panel log" data-tilt>
            <p class="panel-label">LOG.${String(n).padStart(3, '0')} &nbsp;//&nbsp; <time datetime="${esc(p.date)}">${esc(p.date)}</time> &nbsp;//&nbsp; ${esc(p.readTime || '')}</p>
            <h3 data-scramble>${esc(p.title)}</h3>
            <p data-type>${esc(p.excerpt)}</p>
            <p class="tags">${(p.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</p>
            <a class="read glitch" href="log.html?slug=${encodeURIComponent(p.slug)}" aria-label="Read log ${String(n).padStart(3, '0')}: ${esc(p.title)}">READ →</a>
          </article></li>`;

/** Published posts, newest first, each with its log number (LOG.001 = oldest). */
export function numbered(posts) {
  const pub = posts.filter(p => !p.draft).sort((a, b) => new Date(a.date) - new Date(b.date));
  return pub.map((p, i) => ({ ...p, n: i + 1 })).reverse();
}

export async function syncLogs() {
  const grid = document.querySelector('#logs ul.grid');
  if (!grid) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('blog/posts.json', { cache: 'no-cache', signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const posts = numbered(await res.json());
    const have = [...grid.querySelectorAll('a.read')].map(a => new URL(a.href).searchParams.get('slug')).join(',');
    if (have === posts.map(p => p.slug).join(',')) return;      // already up to date
    grid.innerHTML = posts.map(p => logCard(p, p.n)).join('');
  } catch (e) { /* keep the static cards */ }
}
