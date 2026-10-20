/* ============================================================
   Gerard Gibson — developer experience layer
   Theme toggle, scroll progress, command palette (Ctrl/⌘+K),
   interactive terminal, article code tools. Shared by all pages.
   ============================================================ */
(function () {
  'use strict';

  const root = document.documentElement;
  const inBlog = /\/blog(\/|$)/.test(location.pathname);
  const base = inBlog ? '../' : '';
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl';

  const EMAIL = 'gagibson959@gmail.com';
  const GITHUB_USER = 'Gibo-alt';
  const LINKS = {
    github: 'https://github.com/Gibo-alt',
    linkedin: 'https://www.linkedin.com/in/gerardalexander-gibson-347953288',
    source: 'https://github.com/Gibo-alt/Alex-DevWebsite'
  };

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }
  function copy(text, msg) {
    const done = () => toast(msg || 'Copied to clipboard');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => toast('Copy failed'));
    else {
      const t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed'); }
      t.remove();
    }
  }

  /* ---------- Theme ---------- */
  const setTheme = (t, persist) => {
    root.setAttribute('data-theme', t);
    if (persist) store.set('theme', t);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#12100d' : '#fbf8f2');
  };
  const toggleTheme = () => {
    root.classList.add('theme-anim');
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    setTimeout(() => root.classList.remove('theme-anim'), 450);
  };
  if (!store.get('theme') && window.matchMedia) {
    // follow the OS setting until the visitor picks one
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => setTheme(e.matches ? 'dark' : 'light', false));
  }

  /* ---------- Nav tools (palette + theme) ---------- */
  const navContainer = document.querySelector('.navbar .container');
  if (navContainer) {
    const tools = document.createElement('div');
    tools.className = 'nav-tools';
    tools.innerHTML = `
      <button class="tool-btn" id="cmdkOpen" type="button" aria-label="Open command palette" title="Command palette (${MOD}+K)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><kbd>${MOD}K</kbd>
      </button>
      <button class="tool-btn theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode" title="Toggle theme">
        <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
      </button>`;
    navContainer.appendChild(tools);
    tools.querySelector('#themeToggle').addEventListener('click', toggleTheme);
    tools.querySelector('#cmdkOpen').addEventListener('click', () => palette.open());
  }

  /* ---------- Scroll progress ---------- */
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.prepend(bar);
  let ticking = false;
  const updateBar = () => {
    const h = root.scrollHeight - root.clientHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateBar); } }, { passive: true });
  updateBar();

  /* ---------- Skip link ---------- */
  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.id = mainEl.id || 'main';
    const skip = document.createElement('a');
    skip.className = 'skip-link'; skip.href = '#' + mainEl.id; skip.textContent = 'Skip to content';
    document.body.prepend(skip);
  }

  /* ---------- Command palette ---------- */
  const palette = (function () {
    const el = document.createElement('div');
    el.className = 'cmdk';
    el.innerHTML = `
      <div class="cmdk-box" role="dialog" aria-modal="true" aria-label="Command palette">
        <input class="cmdk-input" type="text" placeholder="Type a command or search… (try “projects”)" aria-label="Search commands" autocomplete="off" spellcheck="false">
        <ul class="cmdk-list" role="listbox"></ul>
        <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>esc</kbd> close</span></div>
      </div>`;
    document.body.appendChild(el);
    const input = el.querySelector('input');
    const list = el.querySelector('ul');
    let items = [], shown = [], sel = 0, lastFocus = null, posts = [];

    const go = href => () => { location.href = href; };
    const ext = href => () => window.open(href, '_blank', 'noopener');
    const goSection = id => () => {
      const t = document.getElementById(id);
      if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); else location.href = base + '#' + id;
    };

    function build() {
      items = [
        { g: 'Navigate', t: 'About', k: 'about bio', run: goSection('about') },
        { g: 'Navigate', t: 'Experience', k: 'work education timeline', run: goSection('experience') },
        { g: 'Navigate', t: 'Projects', k: 'work portfolio reggy', run: goSection('projects') },
        { g: 'Navigate', t: 'Skills', k: 'stack tech', run: goSection('skills') },
        { g: 'Navigate', t: 'Terminal', k: 'shell cli try', run: goSection('terminal') },
        { g: 'Navigate', t: 'Blog', h: 'all articles', k: 'articles writing posts', run: go(base + 'blog/') },
        { g: 'Navigate', t: 'Contact', k: 'hire email reach', run: goSection('contact') },
        ...posts.map(p => ({ g: 'Articles', t: p.title, h: (p.tags || [])[0] || '', k: (p.tags || []).join(' ') + ' ' + p.excerpt, run: go(base + 'blog/post.html?slug=' + encodeURIComponent(p.slug)) })),
        { g: 'Actions', t: 'Copy email address', h: EMAIL, k: 'mail contact', run: () => copy(EMAIL, 'Email copied') },
        { g: 'Actions', t: 'Toggle dark / light theme', h: 'theme', k: 'dark light mode', run: toggleTheme },
        { g: 'Actions', t: 'Open GitHub profile', h: '@' + GITHUB_USER, k: 'code repos', run: ext(LINKS.github) },
        { g: 'Actions', t: 'Open LinkedIn', k: 'social', run: ext(LINKS.linkedin) },
        { g: 'Actions', t: 'View this site’s source', h: 'Alex-DevWebsite', k: 'github repo code', run: ext(LINKS.source) }
      ];
    }

    function render() {
      const q = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      shown = items.filter(i => { const hay = (i.t + ' ' + (i.k || '') + ' ' + (i.h || '') + ' ' + i.g).toLowerCase(); return q.every(w => hay.includes(w)); });
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      let html = '', lastG = '';
      shown.forEach((i, n) => {
        if (i.g !== lastG) { html += `<li class="cmdk-group" role="presentation">${esc(i.g)}</li>`; lastG = i.g; }
        html += `<li class="cmdk-item${n === sel ? ' sel' : ''}" role="option" aria-selected="${n === sel}" data-n="${n}"><span>${esc(i.t)}</span>${i.h ? `<small>${esc(i.h)}</small>` : ''}</li>`;
      });
      list.innerHTML = html || '<li class="cmdk-empty">No matches. Try “projects” or “blog”.</li>';
      const s = list.querySelector('.sel'); if (s) s.scrollIntoView({ block: 'nearest' });
    }
    function run(n) { const i = shown[n]; if (!i) return; close(); setTimeout(i.run, 30); }
    function open() {
      if (el.classList.contains('open')) return;
      lastFocus = document.activeElement;
      build(); input.value = ''; sel = 0; render();
      el.classList.add('open');
      input.focus();
      if (!posts.length) {
        fetch(base + 'blog/posts.json').then(r => r.ok ? r.json() : []).then(p => {
          posts = p.filter(x => !x.draft).sort((a, b) => new Date(b.date) - new Date(a.date));
          if (el.classList.contains('open')) { build(); render(); }
        }).catch(() => { /* palette still works without articles */ });
      }
    }
    function close() { el.classList.remove('open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

    input.addEventListener('input', () => { sel = 0; render(); });
    list.addEventListener('click', e => { const li = e.target.closest('.cmdk-item'); if (li) run(+li.dataset.n); });
    list.addEventListener('mousemove', e => { const li = e.target.closest('.cmdk-item'); if (li && +li.dataset.n !== sel) { sel = +li.dataset.n; render(); } });
    el.addEventListener('mousedown', e => { if (e.target === el) close(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); el.classList.contains('open') ? close() : open(); }
      else if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName) && !el.classList.contains('open')) { e.preventDefault(); open(); }
    });
    return { open, close };
  })();

  /* ---------- Hero hint ---------- */
  document.querySelectorAll('[data-mod]').forEach(n => { n.textContent = MOD; });

  /* ---------- Interactive terminal (home page) ---------- */
  const termEl = document.getElementById('term');
  if (termEl) initTerminal(termEl);

  function initTerminal(term) {
    const body = term.querySelector('.term-body');
    const input = term.querySelector('.term-input');
    const prompt = '<span class="term-prompt">guest<span class="at">@</span>gerard<span class="at">:</span><span class="path">~</span>$</span>';
    const history = []; let hIdx = 0, busy = false;

    const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
    const text = n => (n ? n.textContent.trim().replace(/\s+/g, ' ') : '');
    const line = (html, cls) => { const p = document.createElement('p'); p.className = 'term-line' + (cls ? ' ' + cls : ''); p.innerHTML = html; body.appendChild(p); body.scrollTop = body.scrollHeight; return p; };
    const out = (...ls) => ls.forEach(l => line(l));
    const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));

    const FILES = {
      'about.md': () => $$('#about .about-text p').slice(1, 4).map(p => esc(text(p))),
      'skills.json': () => skillsOut(),
      'contact.txt': () => contactOut(),
      'resume.pdf': () => ['<span class="err">Binary file.</span> Ask nicely instead: <a href="#contact">get in touch</a>.']
    };

    function skillsOut() {
      return $$('.skill-group').map(g => `<span class="acc">${esc(pad(text(g.querySelector('h4')), 14))}</span>${esc($$('.chip', g).map(c => text(c)).join(', '))}`);
    }
    function contactOut() {
      return [
        `<span class="acc">email   </span><a href="mailto:${EMAIL}">${EMAIL}</a>`,
        `<span class="acc">github  </span><a href="${LINKS.github}" target="_blank" rel="noopener">github.com/${GITHUB_USER}</a>`,
        `<span class="acc">linkedin</span> <a href="${LINKS.linkedin}" target="_blank" rel="noopener">Gerard Alexander Gibson</a>`
      ];
    }

    const cmds = {
      help() {
        const rows = [
          ['whoami', 'who is this?'], ['about', 'short bio'], ['experience', 'work & education'], ['projects', 'what I have built'],
          ['skills', 'the toolkit'], ['github', 'latest repos (live from the API)'], ['blog', 'recent articles'], ['contact', 'get in touch'],
          ['ls / cat <file>', 'poke around'], ['theme [dark|light]', 'switch theme'], ['neofetch', 'system info, developer edition'], ['clear', 'clear the screen']
        ];
        return ['<span class="dim">Available commands:</span>', ...rows.map(r => `  <span class="acc">${esc(pad(r[0], 22))}</span><span class="dim">${esc(r[1])}</span>`), '<span class="dim">Tip: Tab completes, ↑/↓ browses history.</span>'];
      },
      whoami() { return ['<b>Gerard Alexander Gibson</b> — software developer, Gqeberha, South Africa.', 'Final-year BCIS Application Development student at Emeris. Team Lead on REGGY.', '<span class="ok">● open to graduate &amp; junior software roles</span>']; },
      about() { return FILES['about.md'](); },
      experience() {
        return $$('.tl-item').map(t => `<span class="acc">${esc(text(t.querySelector('.tl-when')).replace(/(Emeris|Completed|Expected completion).*$/, '').trim())}</span>\n  ${esc(text(t.querySelector('h3')))}`);
      },
      projects() {
        const feat = text(document.querySelector('.featured h3'));
        const cards = $$('.project-card').map(c => `  ${esc(pad(text(c.querySelector('h3')), 14))}<span class="dim">${esc(text(c.querySelector('.project-sub')))}</span>`);
        return [`<span class="acc">★ ${esc(feat)}</span>`, ...cards, '<span class="dim">Scroll to <a href="#projects">#projects</a> for the full write-ups.</span>'];
      },
      skills() { return skillsOut(); },
      contact() { return contactOut(); },
      blog() {
        return fetch(base + 'blog/posts.json').then(r => r.json()).then(ps => {
          const l = ps.filter(p => !p.draft).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
          return l.map(p => `<span class="dim">${esc(p.date)}</span>  <a href="${base}blog/post.html?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a>`).concat(['<span class="dim">More at <a href="blog/">/blog</a></span>']);
        }).catch(() => ['<span class="err">Could not load articles.</span> Try <a href="blog/">/blog</a>.']);
      },
      github() {
        const render = repos => repos.filter(r => !r.fork && !r.archived && !/^(alex[_-]|gibo-alt$)/i.test(r.name)).sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 6)
          .map(r => `<a href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(pad(r.name, 22))}</a><span class="dim">${esc(r.language || '—')}${r.description ? ' · ' + esc(r.description.slice(0, 48)) : ''}</span>`);
        try { const c = JSON.parse(sessionStorage.getItem('gh-repos-' + GITHUB_USER)); if (c && c.d) return render(c.d); } catch (e) { /* no cache */ }
        line('<span class="dim">GET api.github.com/users/' + GITHUB_USER + '/repos …</span>');
        return fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(render)
          .catch(() => ['<span class="err">GitHub API unavailable (rate limited?).</span> Visit <a href="' + LINKS.github + '" target="_blank" rel="noopener">github.com/' + GITHUB_USER + '</a>']);
      },
      ls() { return [Object.keys(FILES).map(f => `<span class="acc">${f}</span>`).join('   ')]; },
      cat(args) {
        const f = args[0];
        if (!f) return ['usage: cat &lt;file&gt;'];
        return FILES[f] ? FILES[f]() : [`cat: ${esc(f)}: No such file or directory`];
      },
      theme(args) {
        const t = args[0];
        if (t === 'dark' || t === 'light') setTheme(t, true); else toggleTheme();
        return [`<span class="ok">theme → ${root.getAttribute('data-theme')}</span>`];
      },
      neofetch() {
        return [
          '<span class="acc">guest@gerard</span>', '<span class="dim">---------------</span>',
          '<span class="acc">Role     </span>Software developer', '<span class="acc">Stack    </span>C# · ASP.NET Core · React · Node · Kotlin · Flutter',
          '<span class="acc">Location </span>Gqeberha, ZA', '<span class="acc">Editor   </span>VS Code', '<span class="acc">Shell    </span>zsh (and this one)',
          '<span class="acc">Uptime   </span>' + Math.max(1, new Date().getFullYear() - 2023) + ' years coding', '<span class="acc">Status   </span><span class="ok">open to work</span>'
        ];
      },
      echo(args) { return [esc(args.join(' '))]; },
      date() { return [new Date().toString()]; },
      open(args) {
        const id = (args[0] || '').replace('#', '');
        const t = id && document.getElementById(id);
        if (!t) return ['usage: open &lt;about|experience|projects|skills|contact&gt;'];
        t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); return [`<span class="ok">→ #${esc(id)}</span>`];
      },
      curl(args) {
        if (!args.join(' ').includes('gerard')) return ['usage: curl api.gerard.dev/hire'];
        return [JSON.stringify({ name: 'Gerard Gibson', status: 200, available: true, roles: ['graduate software engineer', 'junior developer'], location: 'Gqeberha, ZA', contact: EMAIL }, null, 2).replace(/</g, '&lt;')];
      },
      sudo(args) {
        const s = args.join(' ');
        if (/hire/.test(s)) return ['<span class="ok">[sudo] permission granted.</span> Great call. Email me: <a href="mailto:' + EMAIL + '">' + EMAIL + '</a>'];
        return ['guest is not in the sudoers file. This incident will be reported.'];
      },
      rm() { return ['<span class="err">nice try.</span> This is a read-only filesystem.']; },
      exit() { return ['There is no escape. Try <span class="acc">help</span>.']; }
    };
    cmds.hire = () => cmds.sudo(['hire']);
    cmds['?'] = cmds.help;
    cmds.ll = cmds.ls;

    async function exec(raw) {
      const v = raw.trim();
      line(prompt + ' ' + esc(v));
      if (!v) return;
      history.push(v); hIdx = history.length;
      const [c, ...args] = v.split(/\s+/);
      if (c === 'clear') { body.innerHTML = ''; return; }
      const fn = cmds[c.toLowerCase()];
      if (!fn) { out(`<span class="err">command not found:</span> ${esc(c)}. Try <span class="acc">help</span>.`); return; }
      busy = true;
      try { const res = await fn(args); out(...(res || [])); } catch (e) { out('<span class="err">Something went wrong.</span>'); }
      busy = false;
      body.scrollTop = body.scrollHeight;
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { if (busy) return; const v = input.value; input.value = ''; exec(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (hIdx > 0) input.value = history[--hIdx]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); input.value = hIdx < history.length - 1 ? history[++hIdx] : (hIdx = history.length, ''); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const w = input.value.trim().toLowerCase(); if (!w || w.includes(' ')) return;
        const m = Object.keys(cmds).filter(k => k.startsWith(w) && k !== '?');
        if (m.length === 1) input.value = m[0] + ' ';
        else if (m.length > 1) out(prompt + ' ' + esc(w), m.map(x => `<span class="acc">${x}</span>`).join('  '));
      } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); body.innerHTML = ''; }
    });
    term.addEventListener('click', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
    document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => { exec(b.dataset.cmd); input.focus({ preventScroll: true }); }));

    // Intro: type "whoami" once when the terminal scrolls into view.
    let started = false;
    const intro = () => {
      if (started) return; started = true;
      line('<span class="dim">Welcome. This terminal is real: type <span class="acc">help</span> or tap a shortcut below.</span>');
      const cmd = 'whoami';
      const row = line(prompt + ' ');
      if (reduceMotion) { row.remove(); exec(cmd); return; }
      let i = 0;
      const tick = () => { row.innerHTML = prompt + ' ' + cmd.slice(0, ++i) + '<span class="caret"></span>'; if (i < cmd.length) setTimeout(tick, 90); else setTimeout(() => { row.remove(); exec(cmd); }, 350); };
      setTimeout(tick, 300);
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { intro(); io.disconnect(); } }, { threshold: 0.35 });
      io.observe(term);
    } else intro();
  }

  /* ---------- Article extras (code highlight, copy buttons, anchors) ---------- */
  const articleEl = document.getElementById('article');
  if (articleEl) {
    let hljsLoading = null;
    const loadHljs = () => {
      if (window.hljs) return Promise.resolve(window.hljs);
      if (!hljsLoading) hljsLoading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
        s.onload = () => res(window.hljs); s.onerror = rej;
        document.head.appendChild(s);
      });
      return hljsLoading;
    };
    const enhance = () => {
      const prose = articleEl.querySelector('.prose');
      if (!prose || prose.dataset.enhanced) return;
      prose.dataset.enhanced = '1';

      prose.querySelectorAll('pre').forEach(pre => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'copy-code'; b.textContent = 'Copy';
        b.addEventListener('click', () => { const c = pre.querySelector('code'); copy((c || pre).textContent.replace(/\n$/, ''), 'Code copied'); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1500); });
        pre.appendChild(b);
      });
      loadHljs().then(h => prose.querySelectorAll('pre code').forEach(c => { try { h.highlightElement(c); } catch (e) { /* leave plain */ } })).catch(() => { /* offline: plain code is fine */ });

      const used = new Set();
      prose.querySelectorAll('h2, h3').forEach(h => {
        let id = h.textContent.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
        while (used.has(id)) id += '-x';
        used.add(id); h.id = id;
        const a = document.createElement('a');
        a.className = 'anchor'; a.href = '#' + id; a.setAttribute('aria-label', 'Link to this section'); a.textContent = '#';
        a.addEventListener('click', () => copy(location.href.split('#')[0] + '#' + id, 'Section link copied'));
        h.prepend(a);
      });
      if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }

      const hdr = articleEl.querySelector('header');
      if (hdr && !hdr.querySelector('.article-actions')) {
        const row = document.createElement('div');
        row.className = 'article-actions';
        row.innerHTML = '<button class="tool-btn" type="button">Copy link</button><button class="tool-btn" type="button" data-share hidden>Share</button>';
        const [cl, sh] = row.querySelectorAll('button');
        cl.addEventListener('click', () => copy(location.href, 'Article link copied'));
        if (navigator.share) { sh.hidden = false; sh.addEventListener('click', () => navigator.share({ title: document.title, url: location.href }).catch(() => {})); }
        hdr.appendChild(row);
      }
    };
    new MutationObserver(enhance).observe(articleEl, { childList: true });
    enhance();
  }

  /* ---------- Code background (faded falling code + drifting symbols) ---------- */
  (function codeBackground() {
    const cv = document.createElement('canvas');
    cv.className = 'code-bg';
    cv.setAttribute('aria-hidden', 'true');
    document.body.prepend(cv);
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const TOKENS = ['{', '}', '</>', '=>', '()', ';', '[]', '0', '1', '#', 'if', 'var', 'int', 'API', 'GET', '200', 'git', 'C#', 'null', '&&', '//', 'fn', 'JWT', 'SQL', 'npm'];
    const BIG = ['{ }', '</>', '=>', '[ ]', '0x1F', '#!', '&&', '//', 'λ', '::'];
    const CELL = 22, TRAIL = 14, FONT = '13px "JetBrains Mono", ui-monospace, Menlo, monospace';
    let w = 0, h = 0, cols = [], floaters = [], color = '#8f7547', maxA = .3, raf = 0, last = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];

    const readColors = () => {
      const dark = root.getAttribute('data-theme') === 'dark';
      color = getComputedStyle(root).getPropertyValue('--sand-600').trim() || '#8f7547';
      maxA = dark ? .5 : .45;
      if (reduceMotion) draw(0);
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.ceil(w / CELL);
      cols = Array.from({ length: n }, (_, i) => ({
        x: i * CELL + 4, y: rnd(-h, h), v: rnd(14, 38),
        chars: Array.from({ length: TRAIL }, () => pick(TOKENS)), on: Math.random() < .55
      }));
      floaters = Array.from({ length: Math.max(5, Math.round(w / 220)) }, () => ({
        x: rnd(0, w), y: rnd(0, h), vx: rnd(-6, 6), vy: rnd(-8, -2), s: rnd(40, 96), t: pick(BIG), a: rnd(.07, .15), r: rnd(-.3, .3)
      }));
      if (reduceMotion) draw(0);
    }

    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.font = FONT;
      ctx.textBaseline = 'top';
      for (const c of cols) {
        if (!c.on) { if (!reduceMotion && Math.random() < .004) c.on = true; continue; }
        c.y += c.v * dt;
        if (c.y - TRAIL * 16 > h) { c.y = rnd(-h * .6, 0); c.v = rnd(14, 38); c.on = Math.random() < .7; c.chars[0] = pick(TOKENS); continue; }
        for (let i = 0; i < TRAIL; i++) {
          const y = c.y - i * 16;
          if (y < -16 || y > h) continue;
          ctx.globalAlpha = (1 - i / TRAIL) * (1 - i / TRAIL) * maxA;
          ctx.fillText(c.chars[i], c.x, y);
        }
        if (!reduceMotion && Math.random() < dt * 3) { c.chars.pop(); c.chars.unshift(pick(TOKENS)); }
      }
      for (const f of floaters) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.y < -f.s) { f.y = h + f.s; f.x = rnd(0, w); }
        if (f.x < -f.s * 3) f.x = w + f.s; else if (f.x > w + f.s * 3) f.x = -f.s;
        ctx.save();
        ctx.globalAlpha = f.a;
        ctx.translate(f.x, f.y); ctx.rotate(f.r);
        ctx.font = `600 ${f.s}px "JetBrains Mono", ui-monospace, Menlo, monospace`;
        ctx.fillText(f.t, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    const loop = ts => {
      const dt = Math.min(.05, (ts - last) / 1000 || 0);
      if (ts - last >= 33) { last = ts; draw(dt || .033); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!reduceMotion && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    resize(); readColors();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (reduceMotion) draw(0); });
    start();
  })();

  /* ---------- Console greeting ---------- */
  try {
    console.log('%cHey, fellow dev 👋', 'font:600 18px Georgia,serif;color:#8f7547');
    console.log('Curious how this is built? Plain HTML/CSS/JS, no framework: ' + LINKS.source + '\nHiring? ' + EMAIL + ' · Press ' + MOD + '+K on the page for the command palette.');
  } catch (e) { /* console unavailable */ }
})();
