/* ============================================================
   Gerard Gibson — Portfolio scripts
   Shared by index.html, blog/index.html and blog/post.html
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Nav ---------- */
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('navMenu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('active');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      menu.classList.remove('active');
      toggle.classList.remove('active');
      toggle.setAttribute('aria-expanded', 'false');
    }));
  }

  const onScroll = () => navbar && navbar.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight the nav link for the section in view (home page only)
  const sections = document.querySelectorAll('main section[id]');
  if (sections.length && 'IntersectionObserver' in window) {
    const links = menu ? menu.querySelectorAll('a[href^="#"]') : [];
    const spy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- Reveal on scroll ---------- */
  function observeReveals(root) {
    const items = (root || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(i => io.observe(i));
  }
  observeReveals();

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Helpers ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = d => new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  const cache = {
    get(k) { try { const v = JSON.parse(sessionStorage.getItem(k)); return v && Date.now() - v.t < 30 * 60 * 1000 ? v.d : null; } catch (e) { return null; } },
    set(k, d) { try { sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- GitHub repositories (live) ---------- */
  const LANG_COLORS = {
    'C#': '#178600', JavaScript: '#e3c23a', TypeScript: '#3178c6', Kotlin: '#a97bff', Dart: '#00b4ab',
    Java: '#b07219', HTML: '#e34c26', CSS: '#663399', Python: '#3572a5', 'C++': '#f34b7d'
  };
  // Repos to hide from the live list (this website itself, etc.)
  const HIDE_REPOS = ['alex_website', 'gibo-alt'];

  const repoGrid = document.getElementById('repoGrid');
  if (repoGrid) {
    const user = repoGrid.dataset.user;
    const render = repos => {
      const list = repos
        .filter(r => !r.fork && !r.archived && !HIDE_REPOS.includes(r.name.toLowerCase()))
        .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
        .slice(0, 6);
      if (!list.length) {
        repoGrid.innerHTML = `<p class="repo-note">No public repositories to show yet. <a class="link-arrow" href="https://github.com/${esc(user)}">Visit GitHub</a></p>`;
        return;
      }
      repoGrid.innerHTML = list.map(r => `
        <a class="repo reveal" href="${esc(r.html_url)}" target="_blank" rel="noopener">
          <span class="repo-name"><svg><use href="#i-repo"/></svg>${esc(r.name)}</span>
          <p class="repo-desc">${esc(r.description || 'No description yet.')}</p>
          <span class="repo-meta">
            ${r.language ? `<span><i class="lang-dot" style="background:${LANG_COLORS[r.language] || 'var(--sand-400)'}"></i>${esc(r.language)}</span>` : ''}
            ${r.stargazers_count ? `<span>★ ${r.stargazers_count}</span>` : ''}
            <span>Updated ${new Date(r.pushed_at).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}</span>
          </span>
        </a>`).join('');
      observeReveals(repoGrid);
    };
    const cached = cache.get('gh-repos-' + user);
    if (cached) render(cached);
    else {
      fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(data => { cache.set('gh-repos-' + user, data); render(data); })
        .catch(() => {
          repoGrid.innerHTML = `<p class="repo-note">Couldn't load repositories right now. <a class="link-arrow" href="https://github.com/${esc(user)}" target="_blank" rel="noopener">See them on GitHub ↗</a></p>`;
        });
    }
  }

  /* ---------- Blog ---------- */
  const GLYPHS = ['{ }', '</>', '#', '→', '∑', '◐'];

  // Bundled copy of the blog (blog/posts-data.js). Used when the site is opened
  // straight from disk (file://), where browsers block fetch().
  const bundles = {};
  function loadBundle(base) {
    if (window.BLOG_DATA) return Promise.resolve(window.BLOG_DATA);
    if (!bundles[base]) bundles[base] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = base + 'posts-data.js';
      s.onload = () => window.BLOG_DATA ? resolve(window.BLOG_DATA) : reject(new Error('empty bundle'));
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return bundles[base];
  }
  const fetchJSON = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  const fetchText = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });

  function loadPosts(base) {
    return fetchJSON(base + 'posts.json')
      .catch(() => loadBundle(base).then(d => d.posts))
      .then(posts => posts
        .filter(p => !p.draft)
        .sort((a, b) => new Date(b.date) - new Date(a.date)));
  }
  function loadBody(slug) {
    return fetchText('posts/' + encodeURIComponent(slug) + '.md')
      .catch(() => loadBundle('').then(d => {
        if (d.bodies[slug] == null) throw new Error('missing');
        return d.bodies[slug];
      }));
  }

  function postCard(p, base, i) {
    const cover = p.cover
      ? `<img src="${esc(base + p.cover)}" alt="" loading="lazy">`
      : `<span class="glyph">${GLYPHS[i % GLYPHS.length]}</span>`;
    return `
      <a class="post-card reveal" href="${esc(base)}post.html?slug=${encodeURIComponent(p.slug)}">
        <div class="post-cover">${cover}</div>
        <div class="post-body">
          <div class="post-meta"><span>${fmtDate(p.date)}</span><span>·</span><span>${esc(p.readTime || '')}</span></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.excerpt)}</p>
          <div class="tags" style="margin:6px 0 0">${(p.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        </div>
      </a>`;
  }

  const blogError = el => { el.innerHTML = '<p class="empty">Articles couldn\'t be loaded right now. Please refresh the page.</p>'; };

  // Home page: latest N posts
  const latest = document.getElementById('latestPosts');
  if (latest) {
    const base = latest.dataset.base || '';
    loadPosts(base).then(posts => {
      const n = parseInt(latest.dataset.limit || '3', 10);
      latest.innerHTML = posts.length ? posts.slice(0, n).map((p, i) => postCard(p, base, i)).join('') : '<p class="empty">First articles coming soon.</p>';
      observeReveals(latest);
    }).catch(() => blogError(latest));
  }

  // Blog index: all posts with tag filter + search
  const list = document.getElementById('postList');
  if (list) {
    const filters = document.getElementById('filters');
    const search = document.getElementById('search');
    let all = [], tag = 'All', q = '';
    const draw = () => {
      const shown = all.filter(p =>
        (tag === 'All' || (p.tags || []).includes(tag)) &&
        (!q || (p.title + ' ' + p.excerpt + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q)));
      list.innerHTML = shown.length ? shown.map((p, i) => postCard(p, '', i)).join('') : '<p class="empty">No articles match that yet.</p>';
      observeReveals(list);
    };
    loadPosts('').then(posts => {
      all = posts;
      const tags = ['All', ...new Set(posts.flatMap(p => p.tags || []))];
      filters.innerHTML = tags.map(t => `<button class="filter${t === 'All' ? ' active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
      filters.addEventListener('click', e => {
        const b = e.target.closest('.filter'); if (!b) return;
        tag = b.dataset.tag;
        filters.querySelectorAll('.filter').forEach(x => x.classList.toggle('active', x === b));
        draw();
      });
      if (search) search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); draw(); });
      draw();
    }).catch(() => blogError(list));
  }

  // Single article page
  const article = document.getElementById('article');
  if (article) {
    const slug = new URLSearchParams(location.search).get('slug');
    const notFound = () => { article.innerHTML = '<p class="empty">That article could not be found. <a class="link-arrow" href="./">Back to all articles</a></p>'; };
    if (!slug) notFound();
    else loadPosts('').then(posts => {
      const p = posts.find(x => x.slug === slug);
      if (!p) return notFound();
      document.title = p.title + ' | Gerard Gibson';
      const md = document.querySelector('meta[name="description"]');
      if (md) md.setAttribute('content', p.excerpt);
      return loadBody(p.slug)
        .then(text => {
          const html = window.marked ? window.marked.parse(text) : '<pre>' + esc(text) + '</pre>';
          const clean = window.DOMPurify ? window.DOMPurify.sanitize(html) : html;
          article.innerHTML = `
            <a class="link-arrow article-back" href="./">← All articles</a>
            <header>
              <div class="tags" style="margin:0">${(p.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
              <h1>${esc(p.title)}</h1>
              <div class="post-meta"><span>Gerard Gibson</span><span>·</span><span>${fmtDate(p.date)}</span><span>·</span><span>${esc(p.readTime || '')}</span></div>
            </header>
            ${p.cover ? `<img class="article-cover" src="${esc(p.cover)}" alt="">` : ''}
            <div class="prose">${clean}</div>
            <div class="article-foot">
              <img src="../Media/profile.jpg" alt="Gerard Gibson">
              <div><strong>Gerard Alexander Gibson</strong><p>Software developer in Gqeberha, building full-stack web, API and mobile apps. <a class="link-arrow" href="../#contact">Get in touch</a></p></div>
            </div>`;
          article.querySelectorAll('.prose a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
        });
    }).catch(() => blogError(article));
  }
})();
