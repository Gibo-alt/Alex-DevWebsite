# ALEX — developer portfolio (white + khaki space-opera interface)

Plain HTML, CSS and ES-module JavaScript with Three.js, GSAP and Lenis from CDNs (pinned versions). Hosted on GitHub Pages. Original design: no logos, fonts, characters, names or sounds from any film.

Run it through a local server (ES modules do not run from `file://`):

    python3 -m http.server 8080   # then visit http://localhost:8080/

URL options: `?lite` forces the light 3D scene (phones get it automatically); `?intro` replays the boot + crawl (otherwise they play once per browser session).

```
index.html            Home page: all real text lives in the HTML (SEO)
log.html              Mission Log reader: renders one article (?slug=...) in the same interface
build-logs.py         Regenerates the Mission Logs cards in index.html from blog/posts.json
css/styles.css        Tokens (white/khaki/blue), glass panels, HUD brackets, buttons, reticle, article prose
js/main.js            Home entry point: boot -> crawl -> hyperspace -> text effects
js/log.js             Article page: markdown -> sanitised HTML, code highlight + copy buttons, pager
js/logs.js            Keeps the home cards in sync with blog/posts.json
js/scene.js           Three.js holographic data core, floating code glyphs, gates, grid floor, jump streaks
js/codeRain.js        Faded khaki code rain behind the 3D scene
js/textScramble.js    Heading "decode" effect (Orbitron)
js/typewriter.js      Typewriter queue + blinking █ cursor (JetBrains Mono)
js/boot.js, crawl.js  Boot screen and opening crawl
js/cursor.js          Khaki targeting reticle (hidden on touch)
js/animations.js      Lenis + ScrollTrigger reveals, jump triggers, card tilt, magnetic buttons, ID-card scan
js/counters.js, ui.js Count-up stats; mobile nav + HUD
assets/               Pilot photo (WebP sizes + JPG fallback)
blog/posts.json       Article index (title, date, tags, excerpt, cover)
blog/posts/*.md       The articles, in Markdown
blog/images/          Cover images and figures
blog/admin.html       Editor to create, edit and delete articles (commits to GitHub)
build-blog-data.py    Rebuilds blog/posts-data.js (bundle used by the editor)
Media/                Original photos
```

## Mission Logs (articles)
- Articles are Markdown in `blog/posts/`, listed in `blog/posts.json`. The home page shows them as LOG.001, LOG.002... cards; each opens in `log.html?slug=<slug>`.
- To add or edit a post, use `blog/admin.html` (see below). The home page re-reads `blog/posts.json` on load, so new posts appear without a rebuild. Run `python3 build-logs.py` to refresh the static cards in `index.html` (the version search engines see).

## Blog editor (`/blog/admin.html`)
1. Create a GitHub fine-grained personal access token: Settings → Developer settings → Fine-grained tokens. Repository access: only this repo. Permissions: **Contents: Read and write**.
2. Open `/blog/admin.html`, paste the token and click Connect.
3. Create, edit, save as draft / publish or delete articles; images upload to `blog/images/`. Each save is a commit.

## Notes
- Any key or click skips the boot screen and the crawl together.
- `prefers-reduced-motion`: no boot or crawl, all text appears instantly, the camera stays still.
- The 3D scene lowers its own quality if frames get slow, pauses when the tab is hidden, and caps the pixel ratio at 2 (1.25 on phones).
- Colour contrast: pure khaki (#c3a46b) is decoration only. Small text uses #6b5630, secondary text #5a5650, blue text #1a6fd6 on #fbfaf7.
- Earlier scene variants (dark hologram, planet, alien desert) are in git history.
