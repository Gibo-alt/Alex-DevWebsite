/* ============================================================
   Boot-up loading screen: typed title + log lines + progress bar.
   The bar waits (at ~94%) for real assets (fonts + 3D scene).
   Any key / click skips ahead.
   ============================================================ */
import { REDUCED, sleep, rand } from './config.js';

const LOG = [
  'KERNEL ........... loaded',
  'RENDER CORE ...... three.js online',
  'STARFIELD ........ 4000 objects mapped',
  'UPLINK ........... Gqeberha, ZA · 33.96°S 25.60°E',
  'PILOT ............ Gerard Gibson · authenticated',
  'ALL SYSTEMS NOMINAL'
];

/** @param {Promise} assets resolves when fonts + scene are ready  @param {boolean} quick shorter run for repeat visits */
export async function runBoot({ assets, quick = false }) {
  const el = document.getElementById('boot');
  const html = document.documentElement;
  if (!el || REDUCED) { el && el.remove(); return; }

  const title = document.getElementById('bootTitle');
  const log = document.getElementById('bootLog');
  const bar = document.getElementById('bootBar');
  const pct = document.getElementById('bootPct');
  const minTime = quick ? 1300 : 3200;

  let skip = false, assetsReady = false;
  const onSkip = () => { skip = true; };
  window.addEventListener('keydown', onSkip);
  window.addEventListener('pointerdown', onSkip);
  assets.then(() => { assetsReady = true; });

  const typeInto = async (node, text, speed) => {
    for (let i = 1; i <= text.length && !skip; i++) { node.textContent = text.slice(0, i); await sleep(rand(speed * .6, speed * 1.4)); }
    node.textContent = text;
  };

  // Progress: time-based, held back until assets are actually ready
  const t0 = performance.now();
  let shown = 0, done = false, lastT = performance.now();
  const tick = now => {
    const dt = Math.min(0.25, (now - lastT) / 1000 || 0); lastT = now;
    const timeP = Math.min(1, (now - t0) / minTime);
    const cap = assetsReady ? 1 : 0.94;
    const target = skip ? cap : Math.min(timeP, cap);
    shown += (target - shown) * (1 - Math.exp(-dt * 9));   // frame-rate independent easing
    const v = Math.min(1, shown + (target >= 0.999 ? 0.02 : 0));
    bar.style.width = (v * 100).toFixed(1) + '%';
    pct.textContent = Math.round(v * 100) + '%';
    if (!done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  await typeInto(title, 'INITIALIZING SYSTEM...', quick ? 12 : 36);
  for (const line of quick ? LOG.slice(-2) : LOG) {
    if (skip) break;
    const li = document.createElement('li');
    log.append(li);
    await typeInto(li, line, quick ? 5 : 11);
    await sleep(quick ? 60 : 170);
  }
  // finish once assets are ready and the minimum time has passed (independent of frame rate)
  while (!(assetsReady && (performance.now() - t0 >= minTime || skip))) await sleep(40);
  await sleep(120); // let the bar visibly reach the end

  done = true;
  bar.style.width = '100%'; pct.textContent = '100%';
  title.textContent = 'ACCESS GRANTED';
  await sleep(skip ? 120 : 450);

  window.removeEventListener('keydown', onSkip);
  window.removeEventListener('pointerdown', onSkip);
  el.classList.add('out');
  html.classList.remove('booting');
  await sleep(950);
  el.classList.add('gone');
  el.remove();
}
