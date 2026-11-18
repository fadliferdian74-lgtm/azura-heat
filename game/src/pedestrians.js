// AZURA HEAT — pedestrians: Port Azura citizens strolling the sidewalks and
// the beach strip. They amble between waypoints with swinging limbs, and they
// flee — arms up, full sprint — from fast cars, gunfire and explosions nearby.
import { ROADS, ISLAND, clamp } from './config.js';
import { buildCharacterMesh } from './player.js';

const rand = (() => { let s = 192837465; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; })();
const SHIRTS = [0x3e7ac2, 0xf2e6d0, 0x37b8a2, 0xe2a03e, 0xb84a6e, 0x6e8a3e, 0xf5f5f5, 0x8a5fc0];
const PANTS = [0x2c3550, 0x5a4632, 0x303030, 0x74584a, 0x3a5a78];

export function createPedestrians(scene, count = 26) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildCharacterMesh(SHIRTS[i % SHIRTS.length], PANTS[i % PANTS.length], 0xc98d5a + (i % 3) * 0x080402);
    mesh.scale.setScalar(0.94 + (i % 5) * 0.03);
    scene.add(mesh);
    const ped = {
      mesh, x: 0, z: 0, heading: rand() * Math.PI * 2, speed: 1.6 + rand() * 1.4,
      phase: rand() * 9, fleeT: 0, tx: 0, tz: 0, hasTarget: false,
    };
    respawn(ped, true);
    peds.push(ped);
  }
  return { peds };
}

/** Sidewalk waypoint: beside a random road, or along the beach. */
function pickWaypoint(ped) {
  if (Math.random() < 0.25) { ped.tx = (Math.random() * 2 - 1) * (ISLAND - 20); ped.tz = 232 + Math.random() * 40; }
  else {
    const road = ROADS[Math.floor(Math.random() * ROADS.length)];
    const along = (Math.random() * 2 - 1) * (ISLAND - 16);
    const side = Math.random() > 0.5 ? 10.5 : -10.5;
    if (Math.random() > 0.5) { ped.tx = along; ped.tz = road + side; } else { ped.tx = road + side; ped.tz = along; }
  }
  ped.hasTarget = true;
}
function respawn(ped, anywhere = false) {
  pickWaypoint(ped);
  ped.x = ped.tx; ped.z = ped.tz;
  pickWaypoint(ped);
  if (anywhere) { ped.x = (Math.random() * 2 - 1) * ISLAND * 0.8; ped.z = (Math.random() * 2 - 1) * ISLAND * 0.8; }
}

/** Scare every pedestrian within radius of (x, z): they run from the point. */
export function scarePeds(peds, x, z, radius = 16) {
  for (const ped of peds.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.fleeT = 2.6;
  }
}

export function updatePedestrians(peds, dt, threats) {
  for (const ped of peds.peds) {
    // Fast or close threats trigger flight even without a scare event.
    if (ped.fleeT <= 0) {
      for (const t of threats) {
        if (Math.abs(t.speed || 0) > 16 && Math.hypot(ped.x - t.x, ped.z - t.z) < 9) { ped.fleeT = 2.2; break; }
      }
    }
    let speed = ped.speed, tx = ped.tx, tz = ped.tz;
    if (ped.fleeT > 0) {
      ped.fleeT -= dt; speed = 6.4;
      let ax = 0, az = 0;
      for (const t of threats) { ax += ped.x - t.x; az += ped.z - t.z; }
      tx = ped.x + ax; tz = ped.z + az;
    } else if (!ped.hasTarget || Math.hypot(ped.x - tx, ped.z - tz) < 2) pickWaypoint(ped);
    const dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz);
    if (d > 0.2) {
      ped.heading = Math.atan2(-dx / d, -dz / d);
      ped.x += (dx / d) * speed * dt; ped.z += (dz / d) * speed * dt;
      ped.phase += dt * speed * 2.1;
    }
    ped.x = clamp(ped.x, -ISLAND - 30, ISLAND + 30); ped.z = clamp(ped.z, -ISLAND - 30, ISLAND + 44);
    const swing = Math.sin(ped.phase) * (ped.fleeT > 0 ? 0.95 : 0.5);
    const u = ped.mesh.userData;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = ped.fleeT > 0 ? -2.6 : -swing; u.armR.rotation.x = ped.fleeT > 0 ? -2.6 : swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}
