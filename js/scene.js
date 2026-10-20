/* ============================================================
   3D scene (Three.js): a holographic "data core" for a developer
   - Wireframe core: edge lines + vertex nodes + fresnel shell + gyro rings
   - Floating code glyphs ({ } </> => git API ...) drifting around it
   - Gates and polyhedra along the camera path; a khaki grid floor at the end
   - Wind of dust specks; "hyperspace jump" = speed streaks + FOV kick
   - Camera follows a spline as you scroll and eases toward the mouse
   - Transparent canvas: the white page, khaki grid and code rain show through
   - Pixel ratio capped at 2, pauses when hidden, lowers quality if slow
   ============================================================ */
import * as THREE from 'three';

const KHAKI = new THREE.Color(0xc3a46b);
const KHAKI_D = new THREE.Color(0x8a7346);
const BLUE = new THREE.Color(0x2f8cff);
const INK = new THREE.Color(0x1a1a1f);
const AMBER = new THREE.Color(0xff9a1f);
const rand = THREE.MathUtils.randFloat;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

/* ---------- helpers ---------- */
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
const edges = (geo, color, opacity) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color, opacity));
function circle(radius, segments, color, opacity) {
  const pts = [];
  for (let i = 0; i < segments; i++) { const a = (i / segments) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0)); }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity));
}

/** A small sprite showing a code token, drawn once on a canvas. */
function glyphSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '700 64px "JetBrains Mono", ui-monospace, Menlo, monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 128, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false }));
  s.scale.set(1.7, 0.85, 1);
  return s;
}

/* ---------- hologram shell: fresnel rim + moving scan bands (blue -> khaki) ---------- */
function makeShell(radius, detail) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uC1: { value: BLUE }, uC2: { value: KHAKI } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uC1; uniform vec3 uC2; varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        float scan = 0.55 + 0.45 * sin(vY * 20.0 - uTime * 2.0);
        vec3 c = mix(uC1, uC2, smoothstep(-2.0, 2.2, vY));
        gl_FragColor = vec4(c, f * 0.5 * scan + 0.02);
      }`
  });
  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), mat);
}

/* ---------- khaki grid floor (end of the journey) ---------- */
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
        float lines = grid(p, 2.0, 1.0) * 0.4 + grid(p, 10.0, 1.0) * 0.9 + grid(p, 10.0, 5.0) * 0.25;
        float d = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(30.0, 140.0, d);
        vec3 c = mix(uK, uA, smoothstep(60.0, 140.0, d) * 0.8);
        gl_FragColor = vec4(c, lines * fade * uReveal * 0.8);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -6, -95);
  return mesh;
}

/* ---------- drifting dust specks (follow the camera) ---------- */
function makeDust(count) {
  const pos = new Float32Array(count * 3), spd = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos.set([rand(-30, 30), rand(-12, 12), rand(-80, 12)], i * 3); spd[i] = rand(0.4, 1.6); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSpd; uniform float uTime; uniform float uPR; varying float vA;
      void main() {
        vec3 p = position; p.x = mod(p.x + aSpd * uTime + 30.0, 60.0) - 30.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vA = 0.6 * smoothstep(0.5, 5.0, -mv.z) * (1.0 - smoothstep(30.0, 80.0, -mv.z));
        gl_PointSize = clamp(uPR * 30.0 / -mv.z, 1.0, 6.0);
      }`,
    fragmentShader: /* glsl */`varying float vA; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.54, 0.45, 0.27, smoothstep(0.5, 0.0, d) * vA); }`
  }));
  pts.frustumCulled = false;
  return pts;
}

/* ---------- speed streaks for the hyperspace jump (follow the camera) ---------- */
function makeStreaks(count) {
  const lp = new Float32Array(count * 6), lc = new Float32Array(count * 6), le = new Float32Array(count * 2), ll = new Float32Array(count * 2);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 2 + Math.pow(Math.random(), 0.6) * 38, a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.7, z = rand(-130, 10), len = rand(8, 40);
    c.copy(Math.random() < 0.25 ? BLUE : Math.random() < 0.5 ? KHAKI_D : INK);
    for (let k = 0; k < 2; k++) { lp.set([x, y, z], (i * 2 + k) * 3); lc.set([c.r, c.g, c.b], (i * 2 + k) * 3); le[i * 2 + k] = k; ll[i * 2 + k] = len; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(le, 1));
  geo.setAttribute('aLen', new THREE.BufferAttribute(ll, 1));
  const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uStreak: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aEnd; attribute float aLen; uniform float uStreak; varying vec3 vColor; varying float vA;
      void main() {
        vec3 p = position; p.z += aEnd * uStreak * aLen;                         // stretch toward the viewer
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        vColor = aColor; vA = (1.0 - aEnd * 0.85) * smoothstep(0.0, 4.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`varying vec3 vColor; varying float vA; uniform float uStreak; void main() { gl_FragColor = vec4(vColor, vA * min(1.0, uStreak * 1.6) * 0.8); }`
  }));
  lines.visible = false; lines.frustumCulled = false;
  return lines;
}

/* ============================================================ */
export function createScene(canvas, { mobile = false, reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    return null; // WebGL unavailable: the CSS page + code rain remain
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  let baseFov = 55;

  /* ----- the data core ----- */
  const core = new THREE.Group();
  const outer = edges(new THREE.IcosahedronGeometry(2.1, 1), KHAKI_D, 0.9);
  const inner = edges(new THREE.OctahedronGeometry(1.15, 0), BLUE, 0.95);
  const shell = makeShell(2.14, mobile ? 1 : 2);
  const nodes = new THREE.Points(new THREE.IcosahedronGeometry(2.1, 1), new THREE.PointsMaterial({ color: 0x1a1a1f, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
  const ringA = circle(3.1, 128, KHAKI_D, 0.6);
  const ringB = circle(2.65, 96, BLUE, 0.55); ringB.rotation.x = Math.PI / 2.4;
  const ringC = circle(3.5, 160, KHAKI, 0.5); ringC.rotation.y = Math.PI / 2.8;
  core.add(outer, inner, shell, nodes, ringA, ringB, ringC);

  /* code glyphs orbiting the core */
  const glyphs = ['{ }', '</>', '=>', 'git', 'API', '[ ]', '0x1F', '&&', 'JWT', 'C#', '//', 'SQL'].slice(0, mobile ? 7 : 12).map((t, i, arr) => {
    const s = glyphSprite(t, i % 3 === 0 ? '#2f8cff' : '#6b5630');
    const a = (i / arr.length) * Math.PI * 2, r = rand(3.6, 5);
    s.userData = { a, r, y: rand(-2.6, 2.6), spd: rand(0.06, 0.16) * (i % 2 ? 1 : -1) };
    core.add(s);
    return s;
  });
  scene.add(core);

  /* ----- gates and floating polyhedra along the path ----- */
  const gates = [-15, -30, -46].map((z, i) => {
    const g = new THREE.Group();
    g.add(circle(8.5, 6, i % 2 ? BLUE : KHAKI_D, 0.6), circle(9.4, 64, KHAKI, 0.45));
    g.position.set(0, 0, z);
    scene.add(g);
    return g;
  });
  const shapes = [];
  const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.BoxGeometry(1.4, 1.4, 1.4)];
  for (let i = 0; i < (mobile ? 8 : 16); i++) {
    const m = edges(geos[i % geos.length], i % 3 ? KHAKI_D : BLUE, 0.6);
    const side = Math.random() < 0.5 ? -1 : 1;
    m.position.set(side * rand(5, 15), rand(-5, 6), rand(-8, -70));
    m.scale.setScalar(rand(0.5, 1.8));
    m.userData.spin = new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.2, 0.2));
    scene.add(m); shapes.push(m);
  }

  const grid = makeGrid();
  scene.add(grid);

  /* ----- dust + jump streaks follow the camera ----- */
  const follow = new THREE.Group();
  const dust = makeDust(mobile ? 180 : 420);
  const streaks = makeStreaks(mobile ? 700 : 1800);
  follow.add(dust, streaks);
  scene.add(follow);

  /* ----- camera path ----- */
  const pathPos = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.6, 10), new THREE.Vector3(-0.6, 1.0, 7), new THREE.Vector3(-2.5, 0.6, -6),
    new THREE.Vector3(2.5, -0.2, -20), new THREE.Vector3(-1.5, -0.8, -34), new THREE.Vector3(0, -2.6, -50)
  ]);
  const pathLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.4, 0, 0), new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(0, -1, -32), new THREE.Vector3(0, -2, -50), new THREE.Vector3(0, -2.4, -90)
  ]);

  /* ----- state ----- */
  let targetProgress = 0, progress = 0, time = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let w = 1, h = 1, pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
  const jumpState = { t: 0, dur: 0, active: false, last: -10 };
  const root = document.documentElement;

  function layout() {
    const narrow = w / h < 1 || w < 900;
    baseFov = narrow ? 70 : 55;
    core.position.set(narrow ? 0 : 3.1, narrow ? 2.4 : 0, narrow ? -3 : 0);   // desktop: right of the hero copy
    core.scale.setScalar(narrow ? 0.62 : 1);
  }

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layout();
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    dust.material.uniforms.uPR.value = pr;
    if (reduced) renderFrame(0);
  }

  /** Hyperspace jump: speed streaks + FOV kick, then calm again. */
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
      k = Math.pow(Math.sin(Math.PI * u), 1.3);
      if (u >= 1) { jumpState.active = false; streaks.visible = false; k = 0; }
      root.style.setProperty('--warp', k.toFixed(3));
    }
    streaks.material.uniforms.uStreak.value = k;
    camera.fov = baseFov + 24 * k;
    camera.updateProjectionMatrix();
  }

  function updateCamera(dt) {
    progress += (targetProgress - progress) * (1 - Math.exp(-dt * 3.2));
    const t = clamp(progress, 0, 0.999);
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));       // eased mouse parallax
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    pathPos.getPoint(t, camera.position);
    camera.position.x += pointer.sx * 0.9;
    camera.position.y += pointer.sy * 0.55;
    camera.lookAt(pathLook.getPoint(t));
    grid.material.uniforms.uReveal.value = smooth(0.55, 0.9, t);
  }

  function renderFrame(dt) {
    time += dt;
    if (!reduced) {
      updateCamera(dt); updateJump(dt);
      core.rotation.y += dt * 0.16;
      core.rotation.x = Math.sin(time * 0.3) * 0.12 + pointer.sy * 0.25;
      inner.rotation.y -= dt * 0.5; inner.rotation.x += dt * 0.25;
      ringA.rotation.z += dt * 0.22; ringB.rotation.y += dt * 0.3; ringC.rotation.x -= dt * 0.15;
      gates.forEach((g, i) => { g.rotation.z += dt * (i % 2 ? -0.12 : 0.1); });
      shapes.forEach(m => { const s = m.userData.spin; m.rotation.x += s.x * dt; m.rotation.y += s.y * dt; m.rotation.z += s.z * dt; });
      glyphs.forEach(s => { const d = s.userData; d.a += d.spd * dt; s.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(time * 0.5 + d.a) * 0.25, Math.sin(d.a) * d.r); });
    } else {
      camera.position.set(0, 0.6, 10); camera.lookAt(1.4, 0, 0);
      glyphs.forEach(s => { const d = s.userData; s.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r); });
    }
    follow.position.copy(camera.position);
    shell.material.uniforms.uTime.value = time;
    grid.material.uniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;
    renderer.render(scene, camera);
  }

  /* ----- adaptive quality ----- */
  let slowFor = 0, step = 0;
  function adapt(dt) {
    if (dt > 1 / 28) slowFor += dt; else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (slowFor > 2 && step < 2) {
      slowFor = 0; step++;
      if (step === 1) { pr = 1; resize(); } else { dust.geometry.setDrawRange(0, 120); shapes.forEach((m, i) => { m.visible = i < 6; }); }
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
    setProgress(p) { targetProgress = p; },
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    jump,
    dispose() { stop(); renderer.dispose(); }
  };
}
