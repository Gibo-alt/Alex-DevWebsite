/* ============================================================
   Boot screen: typed log lines + khaki progress bar.
   The bar holds at ~94% until real assets (fonts + 3D scene) are ready.
   Any key / click sets intro.skipped and speeds it up.
   ============================================================ */
import { REDUCED, intro, sleep, rand } from './config.js';

const LOG = [
  'LOADING NAV COMPUTER ...... OK',
  'STAR CHARTS ............... SECTOR 7G',
  'TARGETING DISPLAY ......... CALIBRATED',
  'UPLINK .................... Gqeberha, ZA · 33.96°S 25.60°E',
  'PILOT ..................... ALEX · authenticated',
  'HYPERDRIVE: READY'
];

/** @param {Promise} assets resolves when fonts + scene are ready  @param {boolean} quick shorter run for repeat visits */
export async function runBoot({ assets, quick = false }) {
  const el = document.getElementById('boot');
  if (!el || REDUCED) { el && el.remove(); return; }

  const title = document.getElementById('bootTitle');
  const log = document.getElementById('bootLog');
  const bar = document.getElementById('bootBar');
  const pct = document.getElementById('bootPct');
  const minTime = quick ? 1200 : 3000;

  let assetsReady = false;
  assets.then(() => { assetsReady = true; });

  const typeInto = async (node, text, speed) => {
    for (let i = 1; i <= text.length && !intro.skipped; i++) { node.textContent = text.slice(0, i); await sleep(rand(speed * .6, speed * 1.4)); }
    node.textContent = text;
  };

  // Progress is time-based (independent of frame rate) and held back until assets are ready
  const t0 = performance.now();
  let shown = 0, done = false, lastT = t0;
  const tick = now => {
    const dt = Math.min(0.25, (now - lastT) / 1000 || 0); lastT = now;
    const cap = assetsReady ? 1 : 0.94;
    const target = intro.skipped ? cap : Math.min(Math.min(1, (now - t0) / minTime), cap);
    shown += (target - shown) * (1 - Math.exp(-dt * 9));
    const v = Math.min(1, shown + (target >= 0.999 ? 0.02 : 0));
    bar.style.width = (v * 100).toFixed(1) + '%';
    pct.textContent = Math.round(v * 100) + '%';
    if (!done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  await typeInto(title, 'INITIALIZING SYSTEM...', quick ? 12 : 34);
  for (const line of quick ? LOG.slice(-2) : LOG) {
    if (intro.skipped) break;
    const li = document.createElement('li');
    log.append(li);
    await typeInto(li, line, quick ? 5 : 10);
    await sleep(quick ? 50 : 150);
  }
  // finish once assets are ready and the minimum time has passed
  while (!(assetsReady && (performance.now() - t0 >= minTime || intro.skipped))) await sleep(40);
  await sleep(120);

  done = true;
  bar.style.width = '100%'; pct.textContent = '100%';
  title.textContent = 'ACCESS GRANTED';
  await sleep(intro.skipped ? 100 : 420);

  el.classList.add('out');
  await sleep(650);
  el.remove();
}
