/* ============================================================
   Motion: Lenis smooth scroll + GSAP ScrollTrigger reveals
   (slight 3D rotation). Degrades gracefully: if a library fails
   to load or motion is reduced, content simply shows.
   ============================================================ */
import { REDUCED } from './config.js';

export function initMotion({ onScroll }) {
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const revealEls = [...document.querySelectorAll('[data-reveal]')];
  let lenis = null;

  const docProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };

  if (REDUCED || !gsap || !ST) {
    // Plain native scrolling, no reveal animation
    window.addEventListener('scroll', () => onScroll(docProgress()), { passive: true });
    onScroll(docProgress());
    return { lock() {}, unlock() {}, refresh() {}, scrollTo: t => t.scrollIntoView() };
  }

  gsap.registerPlugin(ST);

  /* Smooth scrolling */
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on('scroll', e => { ST.update(); onScroll(Math.min(1, Math.max(0, e.progress || 0))); });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      lenis.scrollTo(t, { offset: a.getAttribute('href') === '#hero' ? 0 : -40, duration: 1.6 });
    }));
  } else {
    window.addEventListener('scroll', () => onScroll(docProgress()), { passive: true });
  }

  /* Scroll reveals with a slight 3D rotation, staggered per batch */
  gsap.set(revealEls, { autoAlpha: 0, y: 70, rotationX: -14, transformPerspective: 900, transformOrigin: '50% 100%' });
  ST.batch(revealEls, {
    start: 'top 90%',
    once: true,
    onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.15, ease: 'power3.out', stagger: 0.12, overwrite: true, clearProps: 'transform' })
  });

  return {
    lock() { lenis && lenis.stop(); },
    unlock() { lenis && lenis.start(); },
    refresh() { ST.refresh(); },
    scrollTo(t) { lenis ? lenis.scrollTo(t) : t.scrollIntoView(); }
  };
}
