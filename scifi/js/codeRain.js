/* ============================================================
   Code rain: faded khaki columns of code tokens falling behind the page.
   2D canvas, ~30fps, strongest at the screen edges (CSS mask) so the
   content stays readable. Pauses when the tab is hidden; reduced motion
   draws a single still frame.
   ============================================================ */
import { REDUCED, MOBILE, rand, pick } from './config.js';

const TOKENS = ['{', '}', '</>', '=>', '()', ';', '[]', '0', '1', '#', 'if', 'var', 'int', 'API', 'GET', '200', 'git', 'C#', 'null', '&&', '//', 'fn', 'JWT', 'SQL', 'npm', 'async', 'await', 'POST', '404', 'main'];
const CELL = 24, TRAIL = 12, LINE = 17;

export function initCodeRain() {
  const cv = document.getElementById('codeRain');
  const ctx = cv && cv.getContext('2d');
  if (!ctx) return;

  let w = 0, h = 0, cols = [], raf = 0, last = 0;
  const color = '138,115,70';                                    // khaki-d as r,g,b
  const maxA = MOBILE ? 0.3 : 0.4;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Array.from({ length: Math.ceil(w / CELL) }, (_, i) => ({
      x: i * CELL + 4, y: rand(-h, h), v: rand(14, 36), on: Math.random() < 0.55,
      chars: Array.from({ length: TRAIL }, () => pick(TOKENS))
    }));
    draw(0);
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '13px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    for (const c of cols) {
      if (!c.on) { if (!REDUCED && Math.random() < 0.004) c.on = true; continue; }
      c.y += c.v * dt;
      if (c.y - TRAIL * LINE > h) { c.y = rand(-h * 0.6, 0); c.v = rand(14, 36); c.on = Math.random() < 0.7; continue; }
      for (let i = 0; i < TRAIL; i++) {
        const y = c.y - i * LINE;
        if (y < -LINE || y > h) continue;
        const f = 1 - i / TRAIL;
        ctx.fillStyle = `rgba(${color},${(f * f * maxA).toFixed(3)})`;      // trail fades out
        ctx.fillText(c.chars[i], c.x, y);
      }
      if (!REDUCED && Math.random() < dt * 3) { c.chars.pop(); c.chars.unshift(pick(TOKENS)); }
    }
  }

  const loop = ts => {
    if (ts - last >= 33) { draw(Math.min(0.1, (ts - last) / 1000 || 0.033)); last = ts; }
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (!REDUCED && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  resize();
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
}
