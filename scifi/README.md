# Sci-fi control interface (3D version)

Open `scifi/index.html` through a local server (ES modules do not run from `file://`):

    python3 -m http.server 8080   # then visit http://localhost:8080/scifi/

```
index.html            Real, SEO-friendly content (all text lives in the HTML)
css/styles.css        Design tokens, HUD panels, glitch, cursor, responsive rules
js/main.js            Entry point that wires everything together
js/scene.js           Three.js scene: hologram core, starfield, grid floor, bloom, camera path
js/scramble.js        Heading "decode" effect (Orbitron)
js/typewriter.js      Typewriter queue with blinking cursor (JetBrains Mono)
js/counters.js        Stats that count up with scramble
js/boot.js            Boot-up loading screen
js/motion.js          Lenis smooth scroll + GSAP ScrollTrigger reveals
js/interactions.js    Crosshair cursor, card tilt, magnetic buttons, nav, HUD
```

Notes
- `?lite` in the URL forces the light 3D scene (no bloom, fewer particles). Phones get it automatically.
- `prefers-reduced-motion`: boot screen skipped, text appears instantly, camera stays still.
- The scene lowers its own quality (bloom, pixel ratio, particles) if frames get slow.
- Libraries load from CDNs: three.js, GSAP + ScrollTrigger, Lenis.
