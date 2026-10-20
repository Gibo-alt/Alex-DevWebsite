/* ============================================================
   Opening crawl: original intro text in khaki scrolls upward and
   recedes into space (CSS 3D perspective), then a hyperspace jump
   carries us into the hero. Any key / click skips it.
   ============================================================ */
import { REDUCED, intro, clamp, sleep } from './config.js';

/** @param {{jump: Function}|null} scene used for the hyperspace streak at the end */
export async function runCrawl(scene) {
  const el = document.getElementById('crawl');
  const text = document.getElementById('crawlText');
  if (!el || !text || REDUCED || intro.skipped) { el && el.remove(); return; }

  el.classList.add('on');
  const stage = el.querySelector('.crawl-stage');
  const H = text.offsetHeight, S = stage.clientHeight;
  const distance = H + S;
  const duration = clamp(distance / 80, 9, 16) * 1000;               // short: 9–16 seconds

  // starts just below the stage and ends beyond the top, shrinking in perspective
  const anim = text.animate([
    { transform: `rotateX(28deg) translateY(${H}px)` },
    { transform: `rotateX(28deg) translateY(${-S * 1.15}px)` }
  ], { duration, easing: 'linear', fill: 'forwards' });

  const skipNow = () => anim.finish();
  const check = setInterval(() => { if (intro.skipped) skipNow(); }, 60);
  await anim.finished.catch(() => {});
  clearInterval(check);

  // hyperspace streak into the hero while the crawl fades out
  if (scene) scene.jump(intro.skipped ? 1.1 : 2.2);
  el.classList.add('out');
  await sleep(intro.skipped ? 250 : 800);
  el.remove();
}
