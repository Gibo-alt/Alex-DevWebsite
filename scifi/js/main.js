/* ============================================================
   Entry point: wires every module together.
   Order: prepare text -> start 3D -> boot -> opening crawl ->
          hyperspace jump into the hero -> text effects begin.
   Any key / click during the intro skips it.
   ============================================================ */
import { REDUCED, MOBILE, LITE, FORCE_INTRO, intro } from './config.js';
import { createScene } from './scene.js';
import { TextScramble } from './textScramble.js';
import { prepareTypewriters, TypeQueue } from './typewriter.js';
import { runBoot } from './boot.js';
import { runCrawl } from './crawl.js';
import { initCounters } from './counters.js';
import { initMotion, initJumpTriggers, initTilt, initMagnetic, initIdCard } from './animations.js';
import { initCursor } from './cursor.js';
import { initNav, initHud } from './ui.js';

const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

async function main() {
  const html = document.documentElement;

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Repeat visits in the same session get a short boot and no crawl (?intro replays everything)
  let seen = false;
  try { seen = !FORCE_INTRO && sessionStorage.getItem('alex-intro') === '1'; sessionStorage.setItem('alex-intro', '1'); } catch (e) { /* storage unavailable */ }
  const showIntro = !REDUCED;
  if (REDUCED) { const c = document.getElementById('crawl'); c && c.remove(); }
  if (showIntro) html.classList.add('intro-lock');

  /* 1. Prepare text effects (real text stays in the DOM) */
  const scrambles = $$('[data-scramble]').map(el => new TextScramble(el));
  const typed = prepareTypewriters();
  const queue = new TypeQueue();

  /* 2. 3D scene (null if WebGL is unavailable) */
  let scene = null;
  try { scene = createScene(document.getElementById('scene'), { mobile: MOBILE || LITE, reduced: REDUCED }); }
  catch (err) { console.warn('3D scene disabled:', err); }
  if (!scene) html.classList.add('no-webgl');

  /* 3. Smooth scroll + reveals; scroll progress drives the camera */
  const hudScroll = initHud();
  const motion = initMotion({ onScroll: p => { scene && scene.setProgress(p); hudScroll(p); } });
  motion.lock();
  window.addEventListener('pointermove', e => {
    if (scene) scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  }, { passive: true });

  /* 4. Interactions */
  initCursor();
  initTilt($$('[data-tilt]'));
  initMagnetic($$('[data-magnetic]'));
  initNav();
  initIdCard(document.getElementById('idCard'));

  /* 5. Boot screen (waits for fonts + scene), then the opening crawl. Any key/click skips both. */
  const skip = () => { intro.skipped = true; };
  if (showIntro) { window.addEventListener('keydown', skip); window.addEventListener('pointerdown', skip); }
  const fonts = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3500))])
    : Promise.resolve();
  const assets = Promise.all([fonts, scene ? scene.ready : Promise.resolve()]);

  await runBoot({ assets, quick: seen });
  if (showIntro && !seen) await runCrawl(scene); else if (scene && showIntro) scene.jump(1.4);
  window.removeEventListener('keydown', skip);
  window.removeEventListener('pointerdown', skip);

  /* 6. Page is live: unlock scroll, then start the text effects */
  html.classList.remove('intro-lock');
  motion.unlock();
  motion.refresh();
  initJumpTriggers(scene, motion);

  // Typewriter: each section queues its elements when it comes into view (once)
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      queue.add($$('[data-type]', e.target).filter(el => typed.includes(el)));
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  $$('[data-section]').forEach(s => io.observe(s));
  queue.start();
  if (REDUCED) queue.add(typed);   // reduced motion: all text appears instantly

  // Scramble: plays now (hero) and whenever a heading re-enters view; hero title also on hover
  if (REDUCED) scrambles.forEach(s => s.el.classList.remove('sc-pre'));
  else TextScramble.observe(scrambles);
  scrambles.filter(s => s.el.hasAttribute('data-scramble-hover')).forEach(s => s.replayOnHover());

  initCounters($$('[data-count]'));
  window.addEventListener('load', () => motion.refresh());
}

main().catch(err => {
  // Never leave the visitor stuck behind the intro layers
  console.error(err);
  const html = document.documentElement;
  html.classList.add('intro-timeout');
  html.classList.remove('intro-lock');
  document.querySelectorAll('.sc-pre').forEach(el => el.classList.remove('sc-pre'));
});
