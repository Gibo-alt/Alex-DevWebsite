/* Shared constants, helpers and the intro skip flag */
export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const COARSE = window.matchMedia('(pointer: coarse)').matches;
export const MOBILE = COARSE || window.innerWidth < 768;
/** ?lite forces the light 3D scene; ?intro replays the boot + crawl even in the same session */
const params = new URLSearchParams(location.search);
export const LITE = params.has('lite');
export const FORCE_INTRO = params.has('intro');
export const GLYPHS = [...'!<>-_\\/[]{}=+*^?#01ΔΣΩ'];

/** Set to true by any key / click while the boot screen or crawl is playing */
export const intro = { skipped: false };

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
