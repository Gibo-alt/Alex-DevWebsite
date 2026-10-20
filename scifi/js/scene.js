/* ============================================================
   3D scene (Three.js): an alien desert wasteland, bright and hazy
   - Real dune terrain (displaced mesh, sand normal map, vertex colours)
   - Twin low suns -> long soft shadows (desktop) + hazy atmosphere
   - Sand buttes, scattered rocks, a crashed starship, monoliths
   - Sky dome with a ringed gas giant and a moon
   - Wind-blown dust; "hyperspace jump" = speed streaks + FOV kick
   - Camera glides low over the dunes as you scroll, eases toward the mouse
   - Pixel ratio capped at 2, pauses when hidden, lowers quality if slow
   ============================================================ */
import * as THREE from 'three';

const rand = THREE.MathUtils.randFloat;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

const HORIZON = 0xf0e2c2;         // fog + horizon haze colour
const SUN1_DIR = new THREE.Vector3(0.30, 0.21, -0.93).normalize();   // warm main sun
const SUN2_DIR = new THREE.Vector3(0.47, 0.15, -0.87).normalize();  // smaller, cooler sun

/* ---------- deterministic value noise (also used to place props on the ground) ---------- */
function h2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function n2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm2(x, z, oct) {
  let v = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { v += a * n2(x, z); x = x * 2.03 + 17.1; z = z * 2.03 + 9.7; a *= 0.5; }
  return v;
}

/** Ground height. A calm valley runs along the camera path; big dunes and ridges rise at the sides. */
function heightAt(x, z) {
  const wx = x + (n2(x * 0.02 + 13.1, z * 0.02) - 0.5) * 42;               // domain warp = wind-swept shapes
  const large = fbm2(x * 0.008, z * 0.008, 4);
  const dunes = 1 - Math.abs(2 * fbm2(wx * 0.028, z * 0.04, 3) - 1);        // ridged: sharp crests
  const side = smooth(6, 58, Math.abs(x));
  const amp = lerp(0.4, 1, side);
  return (large * 7 + Math.pow(dunes, 1.7) * 7) * amp + side * side * large * large * 18;
}

/* ---------- sky dome ---------- */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(HORIZON) }, uMid: { value: new THREE.Color(0xeadfca) }, uZenith: { value: new THREE.Color(0xc9dbd8) },
      uSun1: { value: SUN1_DIR }, uSun2: { value: SUN2_DIR }
    },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith; uniform vec3 uSun1; uniform vec3 uSun2; varying vec3 vDir;
      void main() {
        float e = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, e));
        col = mix(col, uZenith, smoothstep(0.18, 0.95, e));
        float s1 = max(dot(vDir, normalize(uSun1)), 0.0), s2 = max(dot(vDir, normalize(uSun2)), 0.0);
        col += vec3(1.0, 0.82, 0.52) * (pow(s1, 90.0) * 0.8 + pow(s1, 10.0) * 0.28);     // warm glow around sun 1
        col += vec3(0.80, 0.90, 1.0) * (pow(s2, 120.0) * 0.6 + pow(s2, 14.0) * 0.16);    // cool glow around sun 2
        col += vec3(1.0, 0.9, 0.7) * pow(1.0 - e, 6.0) * 0.12;                           // dusty horizon band
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), mat);
  dome.renderOrder = -10;
  return dome;
}

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
function sunSprite(tex, scale, dir, dist = 400) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.setScalar(scale);
  s.position.copy(dir).multiplyScalar(dist);
  return s;
}

/* ---------- gas giant + rings + moon (sky bodies) ---------- */
const NOISE = /* glsl */`
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }`;

function bodyMaterial(kind) {
  // kind 0: banded gas giant, kind 1: cratered rocky moon
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uSun: { value: new THREE.Vector3(-0.55, 0.45, 0.7) }, uKind: { value: kind } },   // lit from the viewer's side
    vertexShader: /* glsl */`varying vec3 vObj; varying vec3 vNW; void main() { vObj = position; vNW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; uniform float uKind; varying vec3 vObj; varying vec3 vNW;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObj);
        vec3 col;
        if (uKind < 0.5) {
          float turb = fbm(p * 3.0 + 4.0);
          float bands = 0.5 + 0.5 * sin(p.y * 16.0 + turb * 3.5);
          col = mix(vec3(0.93, 0.84, 0.66), vec3(0.74, 0.62, 0.43), bands);
          col = mix(col, vec3(0.68, 0.80, 0.78), smoothstep(0.62, 0.9, fbm(p * 2.2 + 9.0)) * 0.55);   // pale teal storms
        } else {
          float cr = fbm(p * 5.0 + 2.0);
          col = mix(vec3(0.80, 0.74, 0.64), vec3(0.58, 0.52, 0.43), smoothstep(0.35, 0.75, cr));
        }
        float l = max(dot(normalize(vNW), normalize(uSun)), 0.0);
        gl_FragColor = vec4(col * (0.34 + 0.9 * l), 1.0);
      }`
  });
}

function makeRing(inner, outer) {
  return new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uIn: { value: inner / outer } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uIn; varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float t = (r - uIn) / (1.0 - uIn);
        float bands = 0.55 + 0.45 * sin(t * 70.0) * sin(t * 23.0 + 1.0);
        float gap = smoothstep(0.52, 0.56, t) * (1.0 - smoothstep(0.58, 0.62, t));
        float a = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t)) * bands * (1.0 - gap * 0.9);
        gl_FragColor = vec4(vec3(0.86, 0.78, 0.62), a * 0.75);
      }`
  }));
}

/* ---------- sand ripple normal map (tileable, generated once) ---------- */
function sandNormalMap() {
  const N = 256, hgt = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const ripple = Math.sin(Math.PI * 2 * (v * 16 + 0.35 * Math.sin(Math.PI * 2 * u * 3) + 0.2 * Math.sin(Math.PI * 2 * u * 7 + 1)));
    hgt[y * N + x] = ripple * 0.6 + (h2(x, y) - 0.5) * 0.35;           // ripples + fine grain
  }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const at = (x, y) => hgt[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * 0.6, dy = (at(x, y - 1) - at(x, y + 1)) * 0.6;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    img.data[i] = (dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------- dune terrain ---------- */
function makeTerrain({ segX, segZ, width, length, zCenter }) {
  const geo = new THREE.PlaneGeometry(width, length, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, zCenter);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  // Vertex colours: pale sand on flats, darker on slopes, rocky on steep faces, warmer with altitude
  const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3);
  const light = new THREE.Color(0xf0e3c0), dark = new THREE.Color(0xc2a875), rock = new THREE.Color(0x8d7650), warm = new THREE.Color(0xc79b63), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm.getY(i), y = pos.getY(i);
    c.copy(light).lerp(dark, clamp((0.985 - ny) / 0.1, 0, 1)).lerp(rock, clamp((0.9 - ny) / 0.15, 0, 1));
    c.lerp(warm, clamp(y / 36, 0, 1) * 0.45);
    const tint = 0.94 + h2(i, 7) * 0.1;
    col.set([c.r * tint, c.g * tint, c.b * tint], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const nm = sandNormalMap();
  nm.repeat.set(width / 7, length / 7);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7) }));
  mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

/* ---------- rocks (instanced) ---------- */
function makeRocks(count, zMin, zMax) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {                      // lumpy, flat-bottomed
    v.fromBufferAttribute(p, i);
    const k = 0.72 + h2(Math.round(v.x * 40), Math.round(v.z * 40 + v.y * 17)) * 0.55;
    v.multiplyScalar(k); v.y *= 0.72; if (v.y < -0.3) v.y = -0.3;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * rand(14, 110);                       // keep the flight corridor clear
    const z = rand(zMax, zMin);
    const sc = Math.pow(Math.random(), 2.4) * 5 + 0.5;
    pos.set(x, heightAt(x, z) + sc * 0.12, z);
    e.set(rand(-0.2, 0.2), rand(0, 6.28), rand(-0.2, 0.2)); q.setFromEuler(e);
    s.set(sc * rand(0.9, 1.6), sc * rand(0.8, 1.2), sc * rand(0.9, 1.6));
    m.compose(pos, q, s); mesh.setMatrixAt(i, m);
    c.setHSL(0.09 + Math.random() * 0.03, 0.28 + Math.random() * 0.12, 0.42 + Math.random() * 0.12); mesh.setColorAt(i, c);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

/* ---------- sandstone buttes ---------- */
function makeButte(rTop, rBottom, h, seed) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 16, 10, false);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3(), c = new THREE.Color();
  const bands = [0xcfb27e, 0xb8985f, 0xdcc391, 0xa88a58, 0xc4a773];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), t = (v.y + h / 2) / h;
    const wob = 1 + (n2(Math.cos(a) * 2 + seed, Math.sin(a) * 2 + t * 4) - 0.5) * 0.45;   // craggy sides
    if (v.y < h / 2 - 0.01) { v.x *= wob; v.z *= wob; }
    p.setXYZ(i, v.x, v.y, v.z);
    c.setHex(bands[Math.floor(t * 9 + n2(a * 3, seed) * 2) % bands.length]);              // strata
    if (t > 0.985) c.setHex(0xe2cf9f);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- crashed starship (white hull panels, khaki trim, amber vents) ---------- */
function makeWreck() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0xf3f0e8, roughness: 0.55, metalness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xa88a58, roughness: 0.8, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6f8aa0, roughness: 0.15, metalness: 0.6 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xff9a1f });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
  };

  add(new THREE.CylinderGeometry(1.7, 2.7, 16, 10), hull, 0, 0, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.8);
  add(new THREE.ConeGeometry(1.7, 6, 10), hull, -11, 0, 0, 0, 0, Math.PI / 2).scale.set(1, 1, 0.8);
  add(new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, -5.5, 1.6, 0).scale.set(1.6, 0.9, 1);
  add(new THREE.BoxGeometry(7, 0.35, 9), hull, 1.5, -0.4, 6.4, 0, -0.25, 0.08);
  add(new THREE.BoxGeometry(5, 0.35, 8), hull, 2.5, 0.6, -5.2, 0.1, 0.35, -0.3);              // snapped, bent wing
  add(new THREE.BoxGeometry(14, 0.12, 2.6), trim, 0, 2.15, 0).scale.set(1, 1, 0.55);
  add(new THREE.BoxGeometry(3.4, 4.2, 0.3), trim, 7.2, 2.6, 0, 0, 0, -0.2);
  [-1, 1].forEach(s => {
    add(new THREE.CylinderGeometry(1.1, 1.3, 3, 12), trim, 9.2, 0.2, s * 1.9, 0, 0, Math.PI / 2);
    const vent = add(new THREE.CircleGeometry(0.85, 14), glow, 10.75, 0.2, s * 1.9, 0, Math.PI / 2, 0); vent.castShadow = false;
  });
  return g;
}

/* ---------- monoliths with beacon lights ---------- */
function makeMonoliths(beaconTex) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x7e6a46, roughness: 0.9, flatShading: true });
  [[-16, -52, 13], [-22, -58, 18], [-12, -66, 10], [17, -92, 15], [24, -98, 21]].forEach(([x, z, h]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.1), mat);
    m.position.set(x, heightAt(x, z) + h / 2 - 0.6, z); m.rotation.set(rand(-0.05, 0.05), rand(0, 3), rand(-0.07, 0.07));
    m.castShadow = m.receiveShadow = true; g.add(m);
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: beaconTex, transparent: true, depthWrite: false, fog: false }));
    b.scale.setScalar(3.2); b.position.set(x, m.position.y + h / 2 + 0.7, z); b.userData.beacon = true; g.add(b);
  });
  return g;
}

/* ---------- wind-blown dust (follows the camera) ---------- */
function makeDust(count) {
  const pos = new Float32Array(count * 3), spd = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos.set([rand(-45, 45), rand(-3.5, 7), rand(-90, 12)], i * 3); spd[i] = rand(2.5, 8); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSpd; uniform float uTime; uniform float uPR; varying float vA;
      void main() {
        vec3 p = position;
        p.x = mod(p.x + aSpd * uTime + 45.0, 90.0) - 45.0;                       // blown sideways by the wind
        p.y += sin(uTime * 0.6 + position.z) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.55 * smoothstep(0.5, 5.0, -mv.z) * (1.0 - smoothstep(35.0, 85.0, -mv.z));
        gl_PointSize = clamp(uPR * 34.0 / -mv.z, 1.0, 8.0);
      }`,
    fragmentShader: /* glsl */`varying float vA; void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.80, 0.68, 0.46, smoothstep(0.5, 0.0, d) * vA); }`
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
    c.setHex(Math.random() < 0.25 ? 0x2f8cff : Math.random() < 0.5 ? 0x8a7346 : 0x1a1a1f);
    for (let k = 0; k < 2; k++) { lp.set([x, y, z], (i * 2 + k) * 3); lc.set([c.r, c.g, c.b], (i * 2 + k) * 3); le[i * 2 + k] = k; ll[i * 2 + k] = len; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(le, 1));
  geo.setAttribute('aLen', new THREE.BufferAttribute(ll, 1));
  const lines = new THREE.LineSegments(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uStreak: { value: 0 } },
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
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  } catch (err) {
    return null; // WebGL unavailable: the CSS background takes over
  }
  const shadows = !mobile;
  renderer.setClearColor(HORIZON, 1);
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HORIZON, 0.0072);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1000);
  let baseFov = 55;

  /* ----- lights: low twin suns ----- */
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0xc4a875, 1.25);
  const key = new THREE.DirectionalLight(0xfff0d6, 2.7);
  const fill = new THREE.DirectionalLight(0xcfe2ff, 0.9);
  fill.position.copy(SUN2_DIR).multiplyScalar(100);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 320 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  }
  scene.add(hemi, key, key.target, fill);

  /* ----- sky: dome, suns, gas giant, moon (all follow the camera, so they stay at infinity) ----- */
  const sky = new THREE.Group();
  sky.add(makeSky());
  const sunTexA = glowTexture([[0, 'rgba(255,246,222,1)'], [0.1, 'rgba(255,214,140,.95)'], [0.35, 'rgba(255,170,70,.28)'], [1, 'rgba(255,170,70,0)']]);
  const sunTexB = glowTexture([[0, 'rgba(255,255,250,1)'], [0.12, 'rgba(235,244,255,.9)'], [0.4, 'rgba(170,205,255,.28)'], [1, 'rgba(170,205,255,0)']]);
  const suns = new THREE.Group();
  suns.add(sunSprite(sunTexA, 150, SUN1_DIR), sunSprite(sunTexB, 84, SUN2_DIR));
  const giant = new THREE.Group();
  const giantDir = new THREE.Vector3(0.7, 0.3, -0.65).normalize();
  const giantMesh = new THREE.Mesh(new THREE.SphereGeometry(52, 48, 32), bodyMaterial(0));
  const ring = makeRing(76, 118); ring.rotation.set(-1.25, 0.15, -0.28);
  giant.add(giantMesh, ring); giant.position.copy(giantDir).multiplyScalar(390);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(15, 32, 20), bodyMaterial(1));
  moon.position.set(-0.15, 0.42, -0.89).normalize().multiplyScalar(385);
  const bodies = new THREE.Group(); bodies.add(giant, moon);
  sky.add(suns, bodies);
  scene.add(sky);

  /* ----- ground ----- */
  const terrain = makeTerrain(mobile
    ? { segX: 110, segZ: 220, width: 420, length: 380, zCenter: -150 }
    : { segX: 210, segZ: 400, width: 420, length: 380, zCenter: -150 });
  scene.add(terrain);
  scene.add(makeRocks(mobile ? 70 : 170, 30, -290));

  const buttes = new THREE.Group();
  [[-62, -30, 12, 20, 30], [-88, -75, 16, 26, 38], [70, -48, 10, 17, 26], [96, -105, 14, 24, 34], [-52, -120, 9, 15, 22], [58, -150, 12, 19, 30], [-110, -160, 18, 30, 40]].forEach(([x, z, rt, rb, h], i) => {
    const b = makeButte(rt, rb, h, i * 3.7); b.position.set(x, heightAt(x, z) + h / 2 - 2, z); buttes.add(b);
  });
  scene.add(buttes);

  const wreck = makeWreck();
  { const x = 30, z = -46; wreck.position.set(x, heightAt(x, z) + 0.8, z); wreck.rotation.set(0.05, 2.6, 0.14); wreck.scale.setScalar(1.7); }
  scene.add(wreck);
  const beaconTex = glowTexture([[0, 'rgba(255,200,120,1)'], [0.3, 'rgba(255,154,31,.7)'], [1, 'rgba(255,154,31,0)']]);
  const monoliths = makeMonoliths(beaconTex);
  scene.add(monoliths);

  /* ----- dust + jump streaks follow the camera ----- */
  const follow = new THREE.Group();
  const dust = makeDust(mobile ? 220 : 650);
  const streaks = makeStreaks(mobile ? 700 : 1800);
  follow.add(dust, streaks);
  scene.add(follow);

  /* ----- camera path: low over the dunes, always above the ground ----- */
  const waypoints = [[0, 14], [-1.5, 2], [3, -24], [-3, -52], [0.5, -84], [2, -118]];
  const clearance = (x, z) => { let m = -1e9; for (let dx = -8; dx <= 8; dx += 4) for (let dz = -10; dz <= 10; dz += 5) m = Math.max(m, heightAt(x + dx, z + dz)); return m; };
  const pathPos = new THREE.CatmullRomCurve3(waypoints.map(([x, z]) => new THREE.Vector3(x, clearance(x, z) + 4.6, z)));

  /* ----- state ----- */
  let targetProgress = 0, progress = 0, time = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let w = 1, h = 1, pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2);
  const jumpState = { t: 0, dur: 0, active: false, last: -10 };
  const root = document.documentElement;
  const look = new THREE.Vector3(), nextP = new THREE.Vector3();
  let heroYaw = 0.3;

  function layout() {
    const narrow = w / h < 1 || w < 900;
    baseFov = narrow ? 72 : 55;
    heroYaw = narrow ? 0 : 0.3;                 // desktop: glance right so the suns sit centre-right
    bodies.rotation.y = narrow ? 0.75 : 0;      // portrait: bring the giant planet into frame
    suns.rotation.y = narrow ? 0.3 : 0;
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

  function aim(yaw, pitch) {
    look.set(camera.position.x + Math.sin(yaw) * Math.cos(pitch) * 30, camera.position.y + Math.sin(pitch) * 30, camera.position.z - Math.cos(yaw) * Math.cos(pitch) * 30);
    camera.lookAt(look);
  }

  function updateCamera(dt) {
    progress += (targetProgress - progress) * (1 - Math.exp(-dt * 3.2));
    const t = clamp(progress, 0, 0.998);
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));       // eased mouse parallax
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    pathPos.getPoint(t, camera.position);
    camera.position.x += pointer.sx * 1.1;
    camera.position.y += pointer.sy * 0.6;
    // Aim along the path with a slight upward pitch so the horizon sits low and the sky fills the top
    pathPos.getPoint(Math.min(0.999, t + 0.06), nextP);
    aim(Math.atan2(nextP.x - camera.position.x, -(nextP.z - camera.position.z)) + heroYaw * (1 - smooth(0, 0.2, t)), lerp(0.1, 0.035, t));
  }

  function updateShadowRig() {
    if (!shadows) return;
    const tx = Math.round(camera.position.x / 2) * 2, tz = Math.round((camera.position.z - 28) / 2) * 2;   // snapped: no shadow shimmer
    key.target.position.set(tx, 0, tz);
    key.position.set(tx + SUN1_DIR.x * 130, SUN1_DIR.y * 130 + 10, tz + SUN1_DIR.z * 130);
    key.target.updateMatrixWorld();
  }

  function renderFrame(dt) {
    time += dt;
    if (!reduced) { updateCamera(dt); updateJump(dt); }
    else { camera.position.copy(pathPos.getPoint(0)); aim(heroYaw, 0.1); }
    sky.position.copy(camera.position);
    follow.position.copy(camera.position);
    updateShadowRig();
    monoliths.children.forEach(m => { if (m.userData.beacon) m.material.opacity = 0.55 + 0.45 * Math.sin(time * 2 + m.position.x); });
    dust.material.uniforms.uTime.value = time;
    renderer.render(scene, camera);
  }

  /* ----- adaptive quality ----- */
  let slowFor = 0, step = 0;
  function adapt(dt) {
    if (dt > 1 / 28) slowFor += dt; else slowFor = Math.max(0, slowFor - dt * 0.5);
    if (slowFor > 2 && step < 3) {
      slowFor = 0; step++;
      if (step === 1) { pr = 1; resize(); }
      else if (step === 2 && shadows) { renderer.shadowMap.enabled = false; key.castShadow = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
      else { dust.geometry.setDrawRange(0, 160); }
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
