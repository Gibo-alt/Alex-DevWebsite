/* ============================================================
   3D background (Three.js)
   - Holographic wireframe core (edges + fresnel shell + gyro rings)
   - Deep particle starfield (custom shader, twinkle)
   - Gates / floating polyhedra along the camera path
   - Glowing grid floor + wireframe planet at the end of the path
   - Selective bloom (desktop only)
   - Camera: follows a spline as you scroll, eases toward the mouse
   - Adaptive quality: drops bloom / pixel ratio if frames get slow
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CYAN = new THREE.Color(0x00f0ff);
const MAG = new THREE.Color(0xff2bd6);
const BG = 0x05070d;
const rand = THREE.MathUtils.randFloat;

/* ---------- helpers ---------- */
const additive = (color, opacity = 0.9) =>
  new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

const edges = (geo, color, opacity) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), additive(color, opacity));

function circle(radius, segments, color, opacity) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), additive(color, opacity));
}

/* ---------- starfield ---------- */
function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = 7 + Math.pow(Math.random(), 0.65) * 75;       // keep a clear tunnel around the camera path
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.75, rand(-150, 22)], i * 3);
    const roll = Math.random();
    c.set(roll < 0.7 ? 0xcfe8ff : roll < 0.88 ? 0x00f0ff : 0xff2bd6);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 0.5 + Math.pow(Math.random(), 3) * 2.6;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uPR;
      varying vec3 vColor; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.65 + 0.35 * sin(uTime * 1.5 + aPhase * 6.2831);
        vA = tw * smoothstep(0.0, 5.0, -mv.z);              // fade stars that pass the camera
        vColor = aColor;
        gl_PointSize = clamp(aSize * uPR * (150.0 / -mv.z), 1.0, 26.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d); a *= a;
        gl_FragColor = vec4(vColor, a * vA);
      }`
  });
  return new THREE.Points(geo, mat);
}

/* ---------- hologram shell (fresnel + moving scanbands) ---------- */
function makeShell(radius, detail) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uC1: { value: CYAN }, uC2: { value: MAG } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uC1; uniform vec3 uC2;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float scan = 0.55 + 0.45 * sin(vY * 22.0 - uTime * 2.2);
        vec3 c = mix(uC1, uC2, smoothstep(-2.0, 2.2, vY));
        gl_FragColor = vec4(c, f * 0.6 * scan + 0.025);
      }`
  });
  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), mat);
}

/* ---------- glowing grid floor ---------- */
function makeGrid() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uC1: { value: CYAN }, uC2: { value: MAG } },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uReveal; uniform vec3 uC1; uniform vec3 uC2;
      varying vec3 vW;
      float grid(vec2 p, float s) {
        vec2 q = p / s;
        vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        vec2 p = vec2(vW.x, vW.z + uTime * 2.5);             // lines drift toward the camera
        float lines = grid(p, 2.0) * 0.35 + grid(p, 10.0) * 0.8;
        float d = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(25.0, 130.0, d);
        vec3 c = mix(uC1, uC2, smoothstep(0.0, 1.0, (-vW.z - 40.0) / 110.0));
        gl_FragColor = vec4(c, lines * fade * uReveal);
      }`
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -6, -95);
  return mesh;
}

/* ============================================================ */
export function createScene(canvas, { mobile = false, reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  } catch (err) {
    return null; // WebGL unavailable: the CSS gradient behind the canvas takes over
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.011);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  /* ----- holographic core ----- */
  const core = new THREE.Group();
  const detail = mobile ? 1 : 2;
  const outer = edges(new THREE.IcosahedronGeometry(2.1, 1), CYAN, 0.85);
  const inner = edges(new THREE.OctahedronGeometry(1.15, 0), MAG, 0.9);
  const shell = makeShell(2.12, detail);
  const nodes = new THREE.Points(new THREE.IcosahedronGeometry(2.1, 1),
    new THREE.PointsMaterial({ color: 0xbaf8ff, size: 0.075, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const ringA = circle(3.1, 128, CYAN, 0.55);
  const ringB = circle(2.65, 96, MAG, 0.5); ringB.rotation.x = Math.PI / 2.4;
  const ringC = circle(3.5, 160, CYAN, 0.25); ringC.rotation.y = Math.PI / 2.8;
  core.add(outer, inner, shell, nodes, ringA, ringB, ringC);
  scene.add(core);

  /* ----- starfield ----- */
  const stars = makeStars(mobile ? 1400 : 4200);
  scene.add(stars);

  /* ----- gates along the path ----- */
  const gates = [-15, -30, -46].map((z, i) => {
    const g = new THREE.Group();
    g.add(circle(8.5, 6, i % 2 ? MAG : CYAN, 0.7), circle(9.4, 64, i % 2 ? CYAN : MAG, 0.25));
    g.position.set(0, 0, z);
    scene.add(g);
    return g;
  });

  /* ----- floating polyhedra ----- */
  const shapes = [];
  const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.BoxGeometry(1.4, 1.4, 1.4)];
  for (let i = 0; i < (mobile ? 8 : 16); i++) {
    const m = edges(geos[i % geos.length], i % 3 ? CYAN : MAG, 0.55);
    const side = Math.random() < 0.5 ? -1 : 1;
    m.position.set(side * rand(5, 15), rand(-5, 6), rand(-8, -70));
    m.scale.setScalar(rand(0.5, 1.8));
    m.userData.spin = new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.2, 0.2));
    scene.add(m); shapes.push(m);
  }

  /* ----- grid floor + planet (the "horizon") ----- */
  const grid = makeGrid();
  scene.add(grid);
  const planet = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(26, mobile ? 24 : 40, mobile ? 16 : 26)), additive(MAG, 0.35));
  planet.position.set(26, -10, -138);
  scene.add(planet);

  /* ----- camera path ----- */
  const pathPos = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.6, 10), new THREE.Vector3(-0.6, 1.0, 7), new THREE.Vector3(-2.5, 0.6, -6),
    new THREE.Vector3(2.5, -0.2, -20), new THREE.Vector3(-1.5, -0.8, -34), new THREE.Vector3(0, -2.6, -50)
  ]);
  const pathLook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.4, 0, 0), new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(0, -1, -32), new THREE.Vector3(0, -2, -50), new THREE.Vector3(0, -2.4, -90)
  ]);

  /* ----- post-processing (desktop only) ----- */
  let composer = null, bloom = null;
  if (!mobile) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.22);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* ----- state ----- */
  let targetProgress = 0, progress = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let w = 1, h = 1, pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
  let bloomOn = !!bloom;

  function layout() {
    // Desktop: core sits to the right of the hero copy. Narrow screens: centred behind it.
    const narrow = w / h < 1 || w < 900;
    core.position.set(narrow ? 0 : 3.1, narrow ? 2.6 : 0, narrow ? -4 : 0);
    core.scale.setScalar(narrow ? 0.62 : 1);
  }

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    stars.material.uniforms.uPR.value = pr;
    layout();
    if (reduced) renderFrame(0);
  }

  function updateCamera(dt) {
    progress += (targetProgress - progress) * (1 - Math.exp(-dt * 3.2));
    const t = Math.min(0.999, Math.max(0, progress));
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    pathPos.getPoint(t, camera.position);
    camera.position.x += pointer.sx * 0.9;
    camera.position.y += pointer.sy * 0.55;
    const look = pathLook.getPoint(t);
    camera.lookAt(look);
    grid.material.uniforms.uReveal.value = THREE.MathUtils.smoothstep(t, 0.5, 0.88);
  }

  let time = 0;
  function renderFrame(dt) {
    time += dt;
    if (!reduced) {
      updateCamera(dt);
      core.rotation.y += dt * 0.16;
      core.rotation.x = Math.sin(time * 0.3) * 0.12 + pointer.sy * 0.25;
      core.rotation.z = pointer.sx * 0.1;
      inner.rotation.y -= dt * 0.5; inner.rotation.x += dt * 0.25;
      ringA.rotation.z += dt * 0.22; ringB.rotation.y += dt * 0.3; ringC.rotation.x -= dt * 0.15;
      gates.forEach((g, i) => { g.rotation.z += dt * (i % 2 ? -0.12 : 0.1); });
      shapes.forEach(m => { m.rotation.x += m.userData.spin.x * dt; m.rotation.y += m.userData.spin.y * dt; m.rotation.z += m.userData.spin.z * dt; });
      planet.rotation.y += dt * 0.02;
    } else {
      camera.position.set(0, 0.6, 10);
      camera.lookAt(1.4, 0, 0);
    }
    stars.material.uniforms.uTime.value = time;
    shell.material.uniforms.uTime.value = time;
    grid.material.uniforms.uTime.value = time;
    if (composer && bloomOn) composer.render(); else renderer.render(scene, camera);
  }

  /* ----- adaptive quality: step down if the frame rate struggles ----- */
  let slowFor = 0, step = 0;
  function adapt(dt) {
    if (dt > 1 / 28) slowFor += dt; else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (slowFor > 2 && step < 3) {
      slowFor = 0; step++;
      if (step === 1) { bloomOn = false; }
      else if (step === 2) { pr = 1; resize(); }
      else { stars.geometry.setDrawRange(0, Math.floor(stars.geometry.attributes.position.count * 0.5)); }
    }
  }

  /* ----- loop ----- */
  let last = performance.now(), running = false, rafId = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    renderFrame(dt);
    adapt(dt);
    rafId = requestAnimationFrame(loop);
  }
  function start() { if (!running && !reduced) { running = true; last = performance.now(); rafId = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  window.addEventListener('resize', resize);
  resize();
  renderFrame(0.016);
  start();

  return {
    /** 0..1 page scroll progress */
    setProgress(p) { targetProgress = p; },
    /** normalised pointer position, -1..1 */
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    dispose() { stop(); renderer.dispose(); }
  };
}
