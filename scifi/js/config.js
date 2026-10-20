/* Shared constants and small helpers */
export const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const COARSE = window.matchMedia('(pointer: coarse)').matches;
export const MOBILE = COARSE || window.innerWidth < 768;
export const GLYPHS = [...'!<>-_\\/[]{}=+*^?#01ΔΣΩ'];

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
