// AZURA HEAT — shared configuration for the island city of Port Azura.
// Everything the other modules agree on lives here: the road grid, the district
// layout, the tuning numbers for driving / wanted / combat, and the seeded
// random generator that makes the city identical on every load.

export const TITLE = 'AZURA HEAT';
export const CITY_SEED = 20261118;

/** Half-extent of the island in world units; water takes over past the sand. */
export const ISLAND = 300;
/** Road centre-lines on both axes. Blocks between neighbouring roads hold buildings. */
export const ROADS = [-240, -160, -80, 0, 80, 160, 240];
export const ROAD_W = 15;
export const LANE = 3.8;

export const PLAYER = {
  walkSpeed: 7, runSpeed: 12, radius: 0.9, maxHealth: 100,
  start: { x: 12, z: 196 }, // Beach strip, facing the city.
};
export const CAR = {
  accel: 26, brake: 34, reverse: 12, maxSpeed: 46, maxReverse: 14,
  steer: 1.9, grip: 7.5, nosBoost: 30, nosMaxSpeed: 68,
};
export const WANTED = {
  sightRange: 55, hideTime: 7, bustedRange: 4.5, bustedTime: 2.4,
  copCounts: [0, 2, 3, 5, 6, 8],
};
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, range: 90, spread: 0.012, auto: false },
  smg: { name: 'SMG', damage: 20, rate: 0.09, range: 75, spread: 0.03, auto: true },
};

/** Named places the story and the HUD refer to. */
export const PLACES = {
  safehouse: { x: -196, z: 196, label: 'Safehouse — Casa Venn' },
  hospital: { x: 96, z: -16, label: 'Port Azura General' },
  chopShop: { x: 196, z: -196, label: "Primo's Chop Shop" },
  paintShop: { x: -196, z: -84, label: 'Azura Paint & Body' },
  marina: { x: -252, z: 60, label: 'Marina Azul' },
  vault: { x: -238, z: 44, label: 'Marina Vault' },
  port: { x: 200, z: -234, label: 'Halden Port Terminal' },
  palmHills: { x: -216, z: -216, label: 'Palm Hills overlook' },
};

/** District flavour by city quadrant, used for building heights and colours. */
export function districtAt(x, z) {
  if (z > 205) return 'beach';
  if (x < -185 && z > -40) return 'marina';
  if (x > 150 && z < -150) return 'port';
  if (x < -150 && z < -150) return 'hills';
  if (Math.abs(x) < 95 && Math.abs(z) < 95) return 'downtown';
  if (x > 60 && z > 40) return 'oldtown';
  return 'midtown';
}

/** A tiny deterministic PRNG (mulberry32) so the city never changes between loads. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Shortest signed turn from angle a to angle b. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** Nearest point on the road network to (x, z): used by AI drivers and spawns. */
export function nearestRoadPoint(x, z) {
  let best = null, bestD = Infinity;
  for (const r of ROADS) {
    const dV = Math.abs(x - r); if (dV < bestD) { bestD = dV; best = { x: r, z }; }
    const dH = Math.abs(z - r); if (dH < bestD) { bestD = dH; best = { x, z: r }; }
  }
  return best;
}
export function isOnRoad(x, z) {
  return ROADS.some(r => Math.abs(x - r) < ROAD_W / 2 + 1) || ROADS.some(r => Math.abs(z - r) < ROAD_W / 2 + 1);
}
