/* ============================================================
   Entry point: wires every module together.
   Order: prepare text -> start 3D -> boot screen -> reveal page.
   ============================================================ */
import { REDUCED, MOBILE } from './config.js';
import { createScene } from './scene.js';
import { prepareScramble, observeScramble, playScramble, replayOnHover } from './scramble.js';
import { prepareTypewriters, TypeQueue } from './typewriter.js';
import { runBoot } from './boot.js';
import { initCounters } from './counters.js';
import { initMotion } from './motion.js';
import { initCursor, initTilt, initMagnetic, initGlitchLabels, initNav, initHud } from './interactions.js';

// ?lite in the URL forces the lighter 3D scene (no bloom, fewer particles)
const LITE = new URLSearchParams(location.search).has('lite');
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

async function main() {
  const html = document.documentElement;
  if (!REDUCED) html.classList.add('booting');

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* 1. Prepare text effects (real text stays in the DOM) */
  const headings = $$('[data-scramble]');
  headings.forEach(prepareScramble);
  const typed = prepareTypewriters();
  const queue = new TypeQueue();

  /* 2. 3D scene (null if WebGL is unavailable) */
  let scene = null;
  try { scene = createScene(document.getElementById('scene'), { mobile: MOBILE || LITE, reduced: REDUCED }); }
  catch (err) { console.warn('3D scene disabled:', err); }

  if (!scene) html.classList.add('no-webgl'); // CSS horizon replaces the 3D grid

  /* 3. Smooth scroll + reveals; scroll progress drives the camera */
  const hudScroll = initHud();
  const motion = initMotion({ onScroll: p => { scene && scene.setProgress(p); hudScroll(p); } });
  motion.lock();

  window.addEventListener('pointermove', e => {
    if (scene) scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
  }, { passive: true });

  /* 4. Interactions */
  initGlitchLabels();
  initCursor();
  initTilt($$('[data-tilt]'));
  initMagnetic($$('[data-magnetic]'));
  initNav();

  /* 5. Boot screen (waits for fonts + scene) */
  const fonts = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3500))])
    : Promise.resolve();
  let seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; sessionStorage.setItem('booted', '1'); } catch (e) { /* storage unavailable */ }
  await runBoot({ assets: fonts, quick: seen });

  /* 6. Page is live: unlock scroll, then start the text effects */
  motion.unlock();
  motion.refresh();

  // Typewriter: each section queues its elements when it comes into view (once)
  const sections = $$('[data-section]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      queue.add($$('[data-type]', e.target).filter(el => typed.includes(el)));
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  sections.forEach(s => io.observe(s));
  queue.start();

  // Scramble: plays now (hero) and whenever a heading re-enters view
  if (REDUCED) headings.forEach(h => h.classList.remove('sc-pre'));
  else observeScramble(headings);
  $$('[data-scramble-hover]').forEach(replayOnHover);

  initCounters($$('[data-count]'));

  // Fonts can change heading widths; make sure triggers are measured correctly
  window.addEventListener('load', () => motion.refresh());
}

main().catch(err => {
  // Never leave the visitor stuck behind the boot screen
  console.error(err);
  document.documentElement.classList.add('boot-timeout');
  document.documentElement.classList.remove('booting');
  document.querySelectorAll('.sc-pre').forEach(el => el.classList.remove('sc-pre'));
});
