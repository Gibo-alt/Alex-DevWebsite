# ALEX — space-opera control interface (white + khaki, 3D)

Original design: no logos, fonts, characters, names or sounds from any film.
The main site (`../index.html`) is untouched.

Run it through a local server (ES modules do not run from `file://`):

    python3 -m http.server 8080   # then visit http://localhost:8080/scifi/

URL options: `?lite` forces the light 3D scene (phones get it automatically); `?intro` replays the boot + crawl (they otherwise play once per browser session).

```
index.html            Real, SEO-friendly content (all text lives in the HTML)
build-logs.py         Regenerates the Mission Logs cards from ../blog/posts.json
assets/               Pilot photo (WebP sizes + JPG fallback)
css/styles.css        Tokens (white/khaki/blue), glass panels, HUD brackets, buttons, reticle
js/main.js            Entry point: boot -> crawl -> hyperspace -> text effects
js/scene.js           Three.js holographic data core, floating code glyphs, gates, grid floor, dust, jump streaks, camera path
js/codeRain.js        Faded khaki code rain behind the 3D scene (2D canvas)
js/textScramble.js    TextScramble class: heading decode effect (Orbitron)
js/typewriter.js      Typewriter queue + blinking █ cursor (JetBrains Mono)
js/boot.js            Boot screen (waits for fonts + 3D scene)
js/crawl.js           Opening crawl in CSS 3D perspective, then a hyperspace jump
js/cursor.js          Khaki targeting reticle cursor (hidden on touch)
js/animations.js      Lenis + GSAP ScrollTrigger reveals, jump triggers, card tilt, magnetic buttons, ID-card scan
js/counters.js        Stats that count up with a scramble effect
js/ui.js              Mobile nav, active link, HUD readout
js/config.js          Shared constants, helpers, intro-skip flag
```

## Notes
- Libraries load from CDNs at pinned versions: three.js 0.160.0, GSAP + ScrollTrigger 3.12.5, Lenis 1.1.13.
- Background (chosen for a developer portfolio): faded code rain + a khaki/blue holographic wireframe core with orbiting code glyphs. It reads as "software" at a glance, stays light, and keeps text readable. The previous alien-desert scene is in git history (commit 1ab65b4).
- Any key or click skips the boot screen and the crawl together.
- `prefers-reduced-motion`: no boot or crawl, all text appears instantly, the camera stays still.
- The scene lowers its own quality (pixel ratio, then shadows, then dust) if frames get slow, pauses when the tab is hidden, and caps the pixel ratio at 2 (1.25 on phones).
- Mission Logs are real HTML generated from `../blog/posts.json`. After adding a post, run `python3 scifi/build-logs.py`.
- Colour contrast: pure khaki (#c3a46b) is decoration only. Small text uses #7a6338 (5.5:1), secondary text #5a5650 (7:1), blue text #1a6fd6 (4.7:1) on #fbfaf7.
