// config.js — shared constants, seeded RNG and small math helpers for AZURA HEAT.
// Everything procedural in Port Azura derives from one seed so the island is
// identical on every load (important for screenshots and mission tuning).
export const SEED = 1337;

// Road layout: a square grid. Roads run along these coordinates on both axes.
export const ROADS = [-280, -210, -140, -70, 0, 70, 140, 210, 280];
export const ROAD_W = 20;          // asphalt width
export const ISLAND_R = 470;       // playable island radius
export const CITY_HALF = 330;      // city ground extent

export const COLORS = {
  sky: 0xffb36b, fog: 0xf7a56b, sun: 0xffd9a0,
  asphalt: 0x3a3f46, sidewalk: 0x9aa0a3, sand: 0xe8cf9a,
  water: 0x2e7fa8, waterDeep: 0x1d5f86, grass: 0x77a75a,
  palmTrunk: 0x8a6b46, palmLeaf: 0x3f9e4d,
};

// mulberry32 — tiny deterministic PRNG.
export function rng(seed = SEED) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
// Snap a value to the nearest road centre line (used by AI steering).
export function nearestRoad(v) {
  let best = ROADS[0], bd = Infinity;
  for (const r of ROADS) { const d = Math.abs(r - v); if (d < bd) { bd = d; best = r; } }
  return best;
}
export function districtAt(x, z) {
  if (z > 190) return 'Port Azura Docks';
  if (x < -190 && z < -120) return 'Palm Hills';
  if (z < -200) return 'Azura Beach';
  if (x > 170 && z < -60) return 'The Marina';
  if (Math.abs(x) < 110 && Math.abs(z) < 110) return 'Downtown';
  if (x < -120) return 'Old Town';
  return 'Beach Strip';
}

// Key locations around Port Azura, shared by missions, HUD and the paint shop.
export const PLACES = {
  safehouse: { x: -238, z: -238, label: 'Safehouse — Palm Hills' },
  chopShop: { x: 238, z: 238, label: "Primo's Chop Shop" },
  paintShop: { x: -35, z: 105, label: 'Azura Paint & Repair' },
  marina: { x: 245, z: -105, label: 'Azura Marina' },
  docks: { x: 0, z: 262, label: 'Port Azura Docks' },
  beach: { x: -70, z: -262, label: 'Azura Beach' },
  hospital: { x: 35, z: -35, label: 'Azura General' },
};
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, range: 90, spread: 0.012, auto: false },
  smg: { name: 'SMG', damage: 16, rate: 0.085, range: 75, spread: 0.035, auto: true },
};
