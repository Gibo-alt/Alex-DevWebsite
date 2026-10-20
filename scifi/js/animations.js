/* ============================================================
   Animations: Lenis smooth scroll, GSAP ScrollTrigger reveals (slight
   3D rotation), hyperspace-jump triggers, 3D card tilt with a moving
   light reflection, magnetic buttons, and the pilot ID card scan.
   Degrades gracefully if a library fails to load or motion is reduced.
   ============================================================ */
import { REDUCED, COARSE, clamp, sleep } from './config.js';

/* ---------- smooth scroll + reveals ---------- */
export function initMotion({ onScroll }) {
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const revealEls = [...document.querySelectorAll('[data-reveal]')];
  let lenis = null;

  const docProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? clamp(scrollY / max, 0, 1) : 0;
  };

  if (REDUCED || !gsap || !ST) {
    window.addEventListener('scroll', () => onScroll(docProgress()), { passive: true });
    onScroll(docProgress());
    return { lock() {}, unlock() {}, refresh() {}, ST: null };
  }
  gsap.registerPlugin(ST);

  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.on('scroll', e => { ST.update(); onScroll(clamp(e.progress || 0, 0, 1)); });
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

  // Fade in with a slight 3D rotation (transform + opacity only), staggered per batch
  gsap.set(revealEls, { autoAlpha: 0, y: 70, rotationX: -14, transformPerspective: 900, transformOrigin: '50% 100%' });
  ST.batch(revealEls, {
    start: 'top 90%', once: true,
    onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.15, ease: 'power3.out', stagger: 0.12, overwrite: true, clearProps: 'transform' })
  });

  return { lock() { lenis && lenis.stop(); }, unlock() { lenis && lenis.start(); }, refresh() { ST.refresh(); }, ST };
}

/** Trigger a hyperspace jump as the visitor crosses into these sections. */
export function initJumpTriggers(scene, motion) {
  if (!scene || REDUCED) return;
  const ids = ['about', 'projects', 'stats'];
  if (motion.ST) {
    ids.forEach(id => motion.ST.create({ trigger: '#' + id, start: 'top 65%', onEnter: () => scene.jump(1.6), onEnterBack: () => scene.jump(1.4) }));
  } else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) scene.jump(1.6); }), { rootMargin: '-40% 0px -55% 0px' });
    ids.forEach(id => { const el = document.getElementById(id); el && io.observe(el); });
  }
}

/* ---------- 3D card tilt + moving light reflection ---------- */
export function initTilt(els) {
  if (COARSE || REDUCED) return;
  const MAX = 7;
  els.forEach(el => {
    let raf = 0, tx = 0, ty = 0;
    const apply = () => { raf = 0; el.style.transform = `perspective(900px) rotateX(${tx}deg) rotateY(${ty}deg) translateZ(0)`; };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      ty = (px - 0.5) * 2 * MAX; tx = -(py - 0.5) * 2 * MAX;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');   // light reflection follows the pointer
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    el.addEventListener('pointerenter', () => { el.style.transition = 'transform .08s linear'; });
    el.addEventListener('pointerleave', () => {
      tx = ty = 0;
      el.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1)';
      apply();
      setTimeout(() => { el.style.transition = ''; }, 520);
    });
  });
}

/* ---------- magnetic buttons ---------- */
export function initMagnetic(els) {
  if (COARSE || REDUCED) return;
  els.forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      el.style.transition = 'transform .12s linear';
      el.style.transform = `translate(${clamp(dx * 0.32, -22, 22)}px, ${clamp(dy * 0.32, -14, 14)}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .6s cubic-bezier(.2,1.4,.3,1)';
      el.style.transform = '';
    });
  });
}

/* ---------- pilot ID card: scan line sweep + pixelated -> sharp photo ---------- */
export function initIdCard(card) {
  if (!card) return;
  const wrap = card.querySelector('.id-photo');
  const img = card.querySelector('img');
  if (!wrap || !img) return;

  // Real <img> stays in the HTML (SEO / no-JS). A canvas covers it until the scan plays.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.insertBefore(canvas, wrap.querySelector('.id-scan'));
  const ctx = canvas.getContext('2d');
  const size = () => { canvas.width = wrap.clientWidth || 300; canvas.height = wrap.clientHeight || 400; };
  size();
  ctx.fillStyle = '#efe8d8'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const draw = (k) => {                                  // k = fraction of full resolution
    size();
    const w = Math.max(2, Math.round(canvas.width * k)), h = Math.max(2, Math.round(canvas.height * k));
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    off.getContext('2d').drawImage(img, 0, 0, w, h);      // image is 3:4, same ratio as the frame
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
  };

  const play = async () => {
    card.classList.add('scanning');
    if (REDUCED) { canvas.remove(); return; }
    try { img.loading = 'eager'; await img.decode(); } catch (e) { canvas.remove(); return; }
    for (const k of [0.025, 0.04, 0.065, 0.1, 0.16, 0.26, 0.42, 0.7]) { draw(k); await sleep(150); }
    canvas.style.opacity = '0';
    await sleep(400);
    canvas.remove();
  };

  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.45 });
  io.observe(card);
}
