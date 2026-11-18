// materials.js — the shared AZURA HEAT material kit: procedural canvas
// textures (facades, asphalt, sand, corrugation, signs…), named shared
// material roles reused across vehicles / props / characters, a vertex-
// colour geometry merger (many authored parts, one draw call) and blob
// contact shadows. Everything is generated in code from the seeded RNG —
// no external assets.
import * as THREE from 'three';
import { rng } from './config.js';

// ---------------------------------------------------------------------------
// canvas texture helper — every texture in the game is painted here
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
function speckle(g, rand, w, h, n, cols, s0 = 1, s1 = 3) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(rand() * cols.length)];
    g.globalAlpha = 0.05 + rand() * 0.12;
    const s = s0 + rand() * (s1 - s0);
    g.fillRect(rand() * w, rand() * h, s, s);
  }
  g.globalAlpha = 1;
}

// Building facade: light plaster (the per-building tint comes from vertex
// colours) with a window grid, a cornice band, a storefront ground floor,
// grime streaks under sills and a few broken / boarded windows.
export function facadeTexture(seed, variant) {
  const rand = rng(seed);
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = ['#ddd8d0', '#d5d9dc', '#e2d9c8', '#d8cfc4'][variant % 4]; g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, 500, ['#000000', '#ffffff', '#8a7a5f']);
    // vertical weather streaks
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(60,50,40,0.10)';
      g.fillRect(rand() * w, rand() * 40, 2 + rand() * 4, 60 + rand() * 150);
    }
    // cornice + mid trim bands
    g.fillStyle = 'rgba(40,36,32,0.35)'; g.fillRect(0, 0, w, 9);
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(0, 9, w, 3);
    const bandY = 90 + variant * 22;
    g.fillStyle = 'rgba(120,60,40,0.30)'; g.fillRect(0, bandY, w, 6);
    // window grid
    const cols = 5 + (variant % 2), rows = 11;
    const cw = w / cols, ch = (h - 52) / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw + cw * 0.24, py = 16 + y * ch + ch * 0.2, pw = cw * 0.52, ph = ch * 0.58;
      const r = rand();
      if (r < 0.06) { g.fillStyle = '#3a332a'; g.fillRect(px, py, pw, ph); // boarded
        g.fillStyle = 'rgba(140,100,60,0.8)'; g.fillRect(px, py + ph * 0.4, pw, 2); continue; }
      g.fillStyle = r < 0.52 ? (rand() < 0.5 ? '#ffd98a' : '#ffedb8') : '#26303d';
      g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px, py, pw, 2);           // frame top
      g.fillStyle = 'rgba(30,25,20,0.28)'; g.fillRect(px, py + ph, pw + 2, 3);    // sill grime
      if (rand() < 0.3) { g.fillStyle = 'rgba(20,26,34,0.55)'; g.fillRect(px, py + ph * 0.5, pw, 2); } // blind line
    }
    // storefront ground floor: darker band, wide glass, door
    g.fillStyle = 'rgba(38,34,30,0.88)'; g.fillRect(0, h - 34, w, 34);
    for (let x = 6; x < w - 20; x += 26) {
      g.fillStyle = rand() < 0.6 ? '#cfe6ef' : '#ffe1a0'; g.fillRect(x, h - 28, 19, 17);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x, h - 28, 19, 3);
    }
    g.fillStyle = '#14100c'; g.fillRect(w - 14, h - 30, 9, 30);
  }, { repeat: true });
}

export function asphaltTexture() {
  const rand = rng(101);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#43484f'; g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, 2600, ['#2e3238', '#596068', '#6d7276', '#22252a'], 1, 2.6);
    for (let i = 0; i < 7; i++) { // worn patches / repairs
      g.fillStyle = 'rgba(20,22,26,0.16)';
      g.beginPath(); g.ellipse(rand() * w, rand() * h, 18 + rand() * 42, 10 + rand() * 26, rand() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(18,20,24,0.5)'; g.lineWidth = 1.4; // cracks
    for (let i = 0; i < 6; i++) {
      g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (rand() - 0.5) * 44; y += (rand() - 0.5) * 44; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: true });
}

export function sidewalkTexture() {
  const rand = rng(202);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#a9adb0'; g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, 900, ['#8b9094', '#c2c6c9', '#6f7478'], 1, 2.2);
    g.strokeStyle = 'rgba(52,56,60,0.65)'; g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.fillStyle = 'rgba(70,74,78,0.20)'; g.fillRect(0, h - 10, w, 10); // kerb-side grime
  }, { repeat: true });
}

export function sandTexture() {
  const rand = rng(303);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ecd39e'; g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, 1500, ['#d9ba76', '#f7e7ba', '#c4a35e', '#fff6d8'], 1, 2);
    for (let i = 0; i < 12; i++) { // ripple shading
      g.fillStyle = 'rgba(190,155,90,0.13)';
      g.beginPath(); g.ellipse(rand() * w, rand() * h, 14 + rand() * 22, 3 + rand() * 4, 0, 0, 7); g.fill();
    }
  }, { repeat: true });
}

export function waterTexture() {
  const rand = rng(404);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#cfe4ea'; g.fillRect(0, 0, w, h);
    speckle(g, rand, w, h, 700, ['#9fc4d4', '#e8f4f6', '#7fb0c6'], 1, 3);
    for (let i = 0; i < 260; i++) { // sun sparkle flecks
      g.fillStyle = 'rgba(255,246,200,0.85)';
      g.fillRect(rand() * w, rand() * h, 1.6, 1.1);
    }
  }, { repeat: true });
}

// alpha streak for the sun-glitter path on the water (used as alphaMap):
// speckles cluster on the centre line and thin out toward the edges
export function glitterTexture() {
  const rand = rng(505);
  const t = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = w / 2 + (rand() + rand() - 1) * w * 0.42;
      const y = rand() * h;
      const fade = 1 - Math.abs(x - w / 2) / (w * 0.55);
      g.fillStyle = `rgba(255,255,255,${(0.25 + rand() * 0.75) * fade})`;
      g.fillRect(x, y, 1 + rand() * 3.2, 1.1);
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// shipping-container skin: corrugation ribs, frame rails, rust weep —
// greyscale so the per-container vertex tint supplies the colour
export function containerTexture() {
  const rand = rng(606);
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      g.fillStyle = 'rgba(255,255,255,0.34)'; g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x + 5, 0, 3, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
    for (let i = 0; i < 8; i++) { // rust weep from the top rail
      g.fillStyle = 'rgba(122,66,28,0.30)';
      g.fillRect(rand() * w, 4, 2.4, 8 + rand() * 22);
    }
    speckle(g, rand, w, h, 260, ['#5a5a5a', '#ffffff']);
    g.fillStyle = 'rgba(20,20,20,0.55)'; g.fillRect(w - 34, 10, 24, 12); // stencil plate
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(w - 31, 14, 18, 2); g.fillRect(w - 31, 18, 13, 2);
  });
}

export function woodTexture() {
  const rand = rng(707);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b0824f'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = 'rgba(60,36,16,0.55)'; g.fillRect(0, y, w, 2.4);
      for (let i = 0; i < 22; i++) { // grain
        g.strokeStyle = `rgba(90,58,26,${0.12 + rand() * 0.2})`; g.lineWidth = 1;
        const gy = y + 3 + rand() * 27;
        g.beginPath(); g.moveTo(0, gy); g.bezierCurveTo(w * 0.3, gy + 2, w * 0.7, gy - 2, w, gy); g.stroke();
      }
    }
    speckle(g, rand, w, h, 200, ['#7d5a30', '#cfa06a']);
  }, { repeat: true });
}

// striped awning cloth — white + shaded stripes, tinted per shop
export function awningTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,30,36,0.34)';
    for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 8, h);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, h - 9, w, 9);
  }, { repeat: true });
}

// diagonal hazard stripes for road barriers
export function hazardTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e86a1e';
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  }, { repeat: true });
}

// shop sign: painted board, cream border, bold lettering, small sub-line
export function signTexture(text, sub, bg, fg = '#ffe9b8') {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(9, 9, w - 18, h - 18);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 58;
    g.font = `900 ${size}px Arial, sans-serif`;
    while (g.measureText(text).width > w - 56 && size > 26) { size -= 4; g.font = `900 ${size}px Arial, sans-serif`; }
    g.fillText(text, w / 2, sub ? h / 2 - 13 : h / 2 + 2);
    if (sub) { g.font = '700 25px Arial, sans-serif'; g.globalAlpha = 0.85; g.fillText(sub, w / 2, h - 32); g.globalAlpha = 1; }
  });
}

// ---------------------------------------------------------------------------
// geometry merger — authored multi-part shapes at one draw call each.
// parts: { geo, p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], c:hexTint, uv:[su,sv] }
// ---------------------------------------------------------------------------
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sv = new THREE.Vector3();
export function mergeParts(parts) {
  const pos = [], nor = [], uv = [], col = [];
  for (const part of parts) {
    let g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    _e.set(part.r ? part.r[0] : 0, part.r ? part.r[1] : 0, part.r ? part.r[2] : 0);
    _q.setFromEuler(_e);
    _v.set(part.p ? part.p[0] : 0, part.p ? part.p[1] : 0, part.p ? part.p[2] : 0);
    _sv.set(part.s ? part.s[0] : 1, part.s ? part.s[1] : 1, part.s ? part.s[2] : 1);
    g.applyMatrix4(new THREE.Matrix4().compose(_v, _q, _sv));
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const c = new THREE.Color(part.c !== undefined ? part.c : 0xffffff);
    const su = part.uv ? part.uv[0] : 1, sv = part.uv ? part.uv[1] : 1;
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
      uv.push(ua ? ua.getX(i) * su : 0, ua ? ua.getY(i) * sv : 0);
      col.push(c.r, c.g, c.b);
    }
    if (g !== part.geo) g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

// A bucket collects transformed parts in world space and builds ONE mesh —
// the whole static city dressing costs a handful of draw calls.
export class Bucket {
  constructor() { this.parts = []; }
  add(geo, x, y, z, opts = {}) {
    this.parts.push({ geo, p: [x, y, z], r: opts.r, s: opts.s, c: opts.c, uv: opts.uv });
    return this;
  }
  box(w, h, d, x, y, z, opts = {}) { return this.add(new THREE.BoxGeometry(w, h, d), x, y, z, opts); }
  build(material) {
    if (!this.parts.length) return null;
    const m = new THREE.Mesh(mergeParts(this.parts), material);
    m.matrixAutoUpdate = false;
    return m;
  }
}

// ---------------------------------------------------------------------------
// named shared material roles — one instance each, reused everywhere
// ---------------------------------------------------------------------------
export const MAT = {
  glass: new THREE.MeshPhongMaterial({ color: 0x18242f, shininess: 130, specular: 0xaad4f5 }),
  trim: new THREE.MeshLambertMaterial({ color: 0x1e2126 }),                    // bumpers, skirts, dark metal trim
  chrome: new THREE.MeshPhongMaterial({ color: 0xb9c1c9, shininess: 95, specular: 0xffffff }),
  vc: new THREE.MeshLambertMaterial({ vertexColors: true }),                    // merged vertex-coloured parts
  vcBasic: new THREE.MeshBasicMaterial({ vertexColors: true }),                // emissive-look merged parts (lights)
  headlight: new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),                  // emissiveSignal
  taillight: new THREE.MeshBasicMaterial({ color: 0xff352e }),                  // emissiveSignal
  groundContact: new THREE.MeshBasicMaterial({ color: 0x06070a, transparent: true, opacity: 0.38, depthWrite: false }),
  gun: new THREE.MeshLambertMaterial({ color: 0x191c20 }),
};

// car paint: glossy standard material, cached per colour so every red car
// in Port Azura shares one program + one uniform set
const paintCache = new Map();
export function paintMaterial(color) {
  if (!paintCache.has(color)) {
    paintCache.set(color, new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.34 }));
  }
  return paintCache.get(color);
}

// blob contact shadows — shared geometry + material, scaled per actor
export const blobCarGeo = new THREE.CircleGeometry(1, 20); blobCarGeo.rotateX(-Math.PI / 2);
export const blobHumanGeo = new THREE.CircleGeometry(0.62, 14); blobHumanGeo.rotateX(-Math.PI / 2);
export function blobShadow(geo, sx, sz, y = 0.14) {
  const m = new THREE.Mesh(geo, MAT.groundContact);
  m.scale.set(sx, 1, sz); m.position.y = y; m.renderOrder = 1;
  return m;
}
