/* ============================================================
   3D scene (Three.js) — soft, bright, built for a white background
   - Desert planet (procedural dunes, two-sun lighting) + warm atmosphere + moon
   - Twin suns glowing on the horizon
   - Khaki starfield with depth + slowly drifting dust
   - "Hyperspace jump": the same stars stretch into streaking lines, then settle
   - Glowing khaki grid floor toward the horizon at the end of the scroll
   - Camera: follows a spline as you scroll and eases toward the mouse
   - No heavy bloom. Pixel ratio capped at 2. Pauses when the tab is hidden.
   - Adaptive quality: drops pixel ratio / particles if frames get slow
   The canvas is transparent, so the CSS white + grid shows through.
   ============================================================ */
import * as THREE from 'three';

const KHAKI_D = new THREE.Color(0x8a7346);
const AMBER = new THREE.Color(0xff9a1f);
const BLUE = new THREE.Color(0x2f8cff);
const rand = THREE.MathUtils.randFloat;

/* ---------- soft radial glow texture (suns) ---------- */
function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function sun(texture, scale, x, y, z) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
  s.scale.setScalar(scale);
  s.position.set(x, y, z);
  return s;
}

/* ---------- desert planet ---------- */
const NOISE = /* glsl */`
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }`;

function planetMaterial(sun1, sun2, seed) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun1: { value: sun1 }, uSun2: { value: sun2 }, uSeed: { value: seed } },
    vertexShader: /* glsl */`
      varying vec3 vObj; varying vec3 vNW;
      void main() { vObj = position; vNW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun1; uniform vec3 uSun2; uniform float uSeed;
      varying vec3 vObj; varying vec3 vNW;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObj) * 2.2 + uSeed;
        float dunes = fbm(p * 1.6 + fbm(p * 3.0) * 1.4);              // large dune fields
        float bands = 0.5 + 0.5 * sin(p.y * 9.0 + fbm(p * 2.0) * 5.0); // wind-carved bands
        float rocks = smoothstep(0.62, 0.82, fbm(p * 6.0));            // darker rocky patches
        vec3 sand  = vec3(0.80, 0.70, 0.52);
        vec3 khaki = vec3(0.66, 0.55, 0.36);
        vec3 deep  = vec3(0.44, 0.35, 0.21);
        vec3 col = mix(sand, khaki, dunes);
        col = mix(col, deep, rocks * 0.55);
        col = mix(col, col * 0.88, bands * 0.35);
        vec3 n = normalize(vNW);
        float l1 = max(dot(n, normalize(uSun1)), 0.0);
        float l2 = max(dot(n, normalize(uSun2)), 0.0);
        vec3 light = vec3(1.0, 0.92, 0.78) * l1 * 0.85 + vec3(0.78, 0.86, 1.0) * l2 * 0.4 + vec3(0.46, 0.43, 0.39);
        gl_FragColor = vec4(col * light, 1.0);
      }`
  });
}

function atmosphereMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false,
    vertexShader: /* glsl */`varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vN;
      void main() {
        // Back faces: the view-space normal's z runs 0 (outer rim) to about -0.5 (planet edge).
        float a = pow(clamp(-vN.z / 0.5, 0.0, 1.0), 1.8);              // soft falloff away from the planet
        vec3 c = mix(vec3(0.62, 0.80, 1.0), vec3(1.0, 0.72, 0.30), a);  // blue haze outside, amber near the surface
        gl_FragColor = vec4(c, a * 0.55);
      }`
  });
}

/* ---------- starfield: points + matching streak lines for the jump ---------- */
function makeStars(count) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count), len = new Float32Array(count);
  const c = new THREE.Color();
  const dark = new THREE.Color(0x1a1a1f);
  for (let i = 0; i < count; i++) {
    const r = 7 + Math.pow(Math.random(), 0.7) * 80;                 // clear tunnel around the camera path
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.75, rand(-160, 24)], i * 3);
    c.copy(Math.random() < 0.18 ? BLUE : KHAKI_D).lerp(dark, Math.random() * 0.25);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 1.2 + Math.pow(Math.random(), 3) * 2.8;
    phase[i] = Math.random();
    len[i] = rand(8, 40);
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pointsGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  pointsGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  pointsGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const points = new THREE.Points(pointsGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uJump: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uPR; uniform float uJump;
      varying vec3 vColor; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.7 + 0.3 * sin(uTime * 1.4 + aPhase * 6.2831);
        vA = 0.7 * tw * smoothstep(0.0, 6.0, -mv.z) * (1.0 - uJump * 0.8);
        vColor = aColor;
        gl_PointSize = clamp(aSize * uPR * (130.0 / -mv.z), 1.2, 16.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vA;
      void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d); gl_FragColor = vec4(vColor, a * vA); }`
  }));

  // Streaks: each star becomes a segment whose far end stretches with uStreak
  const lp = new Float32Array(count * 6), lc = new Float32Array(count * 6), le = new Float32Array(count * 2), ll = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 2; k++) {
      lp.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], (i * 2 + k) * 3);
      lc.set([col[i * 3], col[i * 3 + 1], col[i * 3 + 2]], (i * 2 + k) * 3);
      le[i * 2 + k] = k; ll[i * 2 + k] = len[i];
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lineGeo.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
  lineGeo.setAttribute('aEnd', new THREE.BufferAttribute(le, 1));
  lineGeo.setAttribute('aLen', new THREE.BufferAttribute(ll, 1));
  const lines = new THREE.LineSegments(lineGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uStreak: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aEnd; attribute float aLen;
      uniform float uStreak; varying vec3 vColor; varying float vA;
      void main() {
        vec3 p = position; p.z += aEnd * uStreak * aLen;                   // stretch toward the viewer
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vColor = aColor; vA = (1.0 - aEnd * 0.85) * smoothstep(0.0, 4.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`varying vec3 vColor; varying float vA; uniform float uStreak; void main() { gl_FragColor = vec4(vColor, vA * min(1.0, uStreak * 1.6) * 0.85); }`
  }));
  lines.visible = false;
  lines.frustumCulled = false;
  return { points, lines };
}

/* ---------- drifting dust ---------- */
function makeDust(count) {
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set([rand(-14, 14), rand(-8, 8), rand(-75, 14)], i * 3);
    vel.set([rand(-0.25, 0.25), rand(-0.12, 0.12), 0], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  return new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aVel; uniform float uTime; uniform float uPR; varying float vA;
      void main() {
        vec3 p = position;
        p.xy = mod(p.xy + aVel.xy * uTime + vec2(14.0, 8.0), vec2(28.0, 16.0)) - vec2(14.0, 8.0);   // wrap + drift
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.5 * smoothstep(0.5, 4.0, -mv.z) * (1.0 - smoothstep(30.0, 60.0, -mv.z));
        gl_PointSize = clamp(uPR * 28.0 / -mv.z, 1.0, 7.0);
      }`,
    fragmentShader: /* glsl */`varying float vA; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.76, 0.64, 0.42, smoothstep(0.5, 0.0, d) * vA); }`
  }));
}

/* ---------- glowing grid floor ---------- */
function makeGrid() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uK: { value: KHAKI_D }, uA: { value: AMBER } },
    vertexShader: /* glsl */`varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uReveal; uniform vec3 uK; uniform vec3 uA; varying vec3 vW;
      float grid(vec2 p, float s, float w) { vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / (fwidth(q) * w); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main() {
        vec2 p = vec2(vW.x, vW.z + uTime * 1.6);
        float fine = grid(p, 2.0, 1.0) * 0.45;
        float major = grid(p, 10.0, 1.0) * 0.9;
        float glow = grid(p, 10.0, 5.0) * 0.28;                                 // soft glow around major lines
        float d = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(30.0, 140.0, d);
        float horizon = smoothstep(60.0, 140.0, d);                              // lines warm up toward the horizon
        vec3 c = mix(uK, uA, horizon * 0.8);
        gl_FragColor = vec4(c, (fine + major + glow) * fade * uReveal * 0.8);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -6, -95);
  return mesh;
}

/* ============================================================ */
export function createScene(canvas, { mobile = false, reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    return null; // WebGL unavailable: the CSS white + grid takes over
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  const BASE_FOV = 55;

  /* ----- twin suns ----- */
  const sunTexA = glowTexture([[0, 'rgba(255,214,120,1)'], [0.16, 'rgba(255,190,80,.9)'], [0.42, 'rgba(255,154,31,.28)'], [1, 'rgba(255,154,31,0)']]);
  const sunTexB = glowTexture([[0, 'rgba(255,236,190,1)'], [0.16, 'rgba(255,214,140,.85)'], [0.46, 'rgba(160,200,255,.3)'], [1, 'rgba(160,200,255,0)']]);
  const sun1 = sun(sunTexA, 15, -15, 8.5, -34);
  const sun2 = sun(sunTexB, 9, -8.5, 6.2, -34);
  const horizonSun = sun(sunTexA, 70, 0, -2, -160);
  scene.add(sun1, sun2, horizonSun);

  /* ----- planet, atmosphere, moon ----- */
  const planetGroup = new THREE.Group();
  const sunDir1 = new THREE.Vector3(-1.0, 0.7, 0.45), sunDir2 = new THREE.Vector3(-0.6, 0.5, 0.7);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(3, mobile ? 40 : 72, mobile ? 28 : 48), planetMaterial(sunDir1, sunDir2, 1.7));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(3.45, 48, 32), atmosphereMaterial());
  const orbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => { const a = i / 160 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 5.4, 0, Math.sin(a) * 5.4); })),
    new THREE.LineBasicMaterial({ color: KHAKI_D, transparent: true, opacity: 0.28 }));
  orbit.rotation.set(0.35, 0, 0.18);
  const moonPivot = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), planetMaterial(sunDir1, sunDir2, 7.3));
  moon.position.set(5.4, 0, 0);
  moonPivot.add(moon); moonPivot.rotation.copy(orbit.rotation);
  planetGroup.add(planet, atmo, orbit, moonPivot);
  scene.add(planetGroup);

  /* ----- starfield, streaks, dust ----- */
  const { points: stars, lines: streaks } = makeStars(mobile ? 900 : 2400);
  const dust = makeDust(mobile ? 160 : 420);
  scene.add(stars, streaks, dust);

  /* ----- grid floor (end of the journey) ----- */
  const grid = makeGrid();
  scene.add(grid);

  /* ----- camera path: past the planet, through the stars, over the grid ----- */
  const pathPos = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.4, 11), new THREE.Vector3(-2, 1.2, 6.5), new THREE.Vector3(-6.5, 0.8, -3), new THREE.Vector3(-3, 0.2, -16),
    new THREE.Vector3(2, -0.5, -30), new THREE.Vector3(0, -1.8, -46), new THREE.Vector3(0, -3.4, -62)
  ]);
  const pathLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.8, 0, 0), new THREE.Vector3(1, 0, -2), new THREE.Vector3(2, 0, -6), new THREE.Vector3(0, 0, -22),
    new THREE.Vector3(0, -1, -40), new THREE.Vector3(0, -2.5, -65), new THREE.Vector3(0, -3, -120)
  ]);

  /* ----- state ----- */
  let targetProgress = 0, progress = 0, time = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let w = 1, h = 1, pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
  const jumpState = { t: 0, dur: 0, active: false, last: -10 };
  const root = document.documentElement;

  function layout() {
    const narrow = w / h < 1 || w < 900;
    planetGroup.position.set(narrow ? 1.9 : 3.4, narrow ? 2.7 : -0.2, narrow ? -5 : -2);
    planetGroup.scale.setScalar(narrow ? 0.68 : 1);
  }

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    stars.material.uniforms.uPR.value = pr;
    dust.material.uniforms.uPR.value = pr;
    layout();
    if (reduced) renderFrame(0);
  }

  /** Hyperspace jump: stars stretch into streaks, then settle again. */
  function jump(duration = 1.6) {
    if (reduced || jumpState.active || time - jumpState.last < 2.5) return;
    jumpState.active = true; jumpState.t = 0; jumpState.dur = duration; jumpState.last = time;
    streaks.visible = true;
  }

  function updateJump(dt) {
    let k = 0;
    if (jumpState.active) {
      jumpState.t += dt;
      const u = Math.min(1, jumpState.t / jumpState.dur);
      k = Math.pow(Math.sin(Math.PI * u), 1.3);               // ramp up fast, ease back down
      if (u >= 1) { jumpState.active = false; streaks.visible = false; k = 0; }
      root.style.setProperty('--warp', k.toFixed(3));
    }
    streaks.material.uniforms.uStreak.value = k;
    stars.material.uniforms.uJump.value = k;
    camera.fov = BASE_FOV + 26 * k;
    camera.updateProjectionMatrix();
  }

  function updateCamera(dt) {
    progress += (targetProgress - progress) * (1 - Math.exp(-dt * 3.2));
    const t = Math.min(0.999, Math.max(0, progress));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));      // eased mouse parallax
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    pathPos.getPoint(t, camera.position);
    camera.position.x += pointer.sx * 0.9;
    camera.position.y += pointer.sy * 0.55;
    camera.lookAt(pathLook.getPoint(t));
    grid.material.uniforms.uReveal.value = THREE.MathUtils.smoothstep(t, 0.55, 0.9);
  }

  function renderFrame(dt) {
    time += dt;
    if (!reduced) {
      updateCamera(dt);
      updateJump(dt);
      planet.rotation.y += dt * 0.05;
      atmo.rotation.y = planet.rotation.y;
      moonPivot.rotation.y += dt * 0.12;
      moon.rotation.y += dt * 0.2;
    } else {
      camera.position.set(0, 0.4, 11);
      camera.lookAt(1.8, 0, 0);
    }
    stars.material.uniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;
    grid.material.uniforms.uTime.value = time;
    renderer.render(scene, camera);
  }

  /* ----- adaptive quality ----- */
  let slowFor = 0, step = 0;
  function adapt(dt) {
    if (dt > 1 / 28) slowFor += dt; else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (slowFor > 2 && step < 3) {
      slowFor = 0; step++;
      if (step === 1) { pr = 1; resize(); }
      else if (step === 2) { stars.geometry.setDrawRange(0, Math.floor(stars.geometry.attributes.position.count * 0.5)); dust.geometry.setDrawRange(0, 120); }
      else { atmo.visible = false; }
    }
  }

  /* ----- loop (paused when the tab is hidden) ----- */
  let last = performance.now(), running = false, rafId = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    renderFrame(dt);
    adapt(dt);
    rafId = requestAnimationFrame(loop);
  }
  const start = () => { if (!running && !reduced) { running = true; last = performance.now(); rafId = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(rafId); };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  window.addEventListener('resize', resize);
  resize();
  renderFrame(0.016);
  start();

  return {
    /** resolves once the first frames have been drawn */
    ready: new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
    /** 0..1 page scroll progress */
    setProgress(p) { targetProgress = p; },
    /** normalised pointer position, -1..1 */
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    jump,
    dispose() { stop(); renderer.dispose(); }
  };
}
