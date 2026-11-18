// pedestrians.js — citizens strolling the sidewalks. They amble along roads,
// cross at corners, and flee in panic from fast cars and gunfire.
import * as THREE from 'three';
import { ROADS, rng, dist2d, angleLerp } from './config.js';
import { makeHuman } from './player.js';

const OUTFITS = [
  { shirt: 0xe67e22, pants: 0x34495e }, { shirt: 0xecf0f1, pants: 0x7f8c8d },
  { shirt: 0x1abc9c, pants: 0x2c3e50 }, { shirt: 0xe84393, pants: 0x2d3436 },
  { shirt: 0xf1c40f, pants: 0x6c5ce7 }, { shirt: 0x00b894, pants: 0x636e72 },
];

export class Pedestrian {
  constructor(scene, rand) {
    const o = OUTFITS[Math.floor(rand() * OUTFITS.length)];
    this.mesh = makeHuman({ shirt: o.shirt, pants: o.pants, skin: 0xc98d5a + Math.floor(rand() * 0x201008) });
    this.axis = rand() < 0.5 ? 'x' : 'z';
    this.dir = rand() < 0.5 ? 1 : -1;
    this.road = ROADS[Math.floor(rand() * ROADS.length)];
    this.side = (rand() < 0.5 ? -1 : 1) * 12.6;
    const along = -300 + rand() * 600;
    this.mesh.position.set(this.axis === 'x' ? along : this.road + this.side, 0, this.axis === 'x' ? this.road + this.side : along);
    scene.add(this.mesh);
    this.walkT = rand() * 9; this.panic = 0; this.speed = 1.6 + rand() * 1.2;
    this.rand = rand; this.heading = 0;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  scare(x, z, radius = 26) {
    if (dist2d(this.x, this.z, x, z) < radius) this.panic = 2.6;
  }
  update(dt, threats) {
    for (const t of threats) {
      if (t.speed > 16 && dist2d(this.x, this.z, t.x, t.z) < 15) this.panic = Math.max(this.panic, 1.6);
    }
    this.panic = Math.max(0, this.panic - dt);
    let mx = 0, mz = 0;
    if (this.panic > 0) {
      // run directly away from the nearest threat / city danger point
      let bx = 0, bz = 0, bd = 1e9;
      for (const t of threats) { const d = dist2d(this.x, this.z, t.x, t.z); if (d < bd) { bd = d; bx = t.x; bz = t.z; } }
      mx = this.x - bx; mz = this.z - bz;
      const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
      const sp = 6.4;
      this.mesh.position.x += mx * sp * dt; this.mesh.position.z += mz * sp * dt;
      this.walkT += dt * 13;
    } else {
      if (this.axis === 'x') this.mesh.position.x += this.dir * this.speed * dt;
      else this.mesh.position.z += this.dir * this.speed * dt;
      // turn around at the city edge or randomly at junctions
      const along = this.axis === 'x' ? this.x : this.z;
      if (Math.abs(along) > 305 || this.rand() < 0.0015) this.dir *= -1;
      this.walkT += dt * 7;
      mx = this.axis === 'x' ? this.dir : 0; mz = this.axis === 'z' ? this.dir : 0;
    }
    if (mx || mz) {
      const target = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, target, Math.min(1, dt * 10));
      this.mesh.rotation.y = this.heading;
    }
    const { armL, armR, legL, legR } = this.mesh.userData.limbs;
    const sw = Math.sin(this.walkT) * (this.panic > 0 ? 0.95 : 0.55);
    legL.rotation.x = sw; legR.rotation.x = -sw; armL.rotation.x = -sw; armR.rotation.x = sw;
  }
}

export function spawnPedestrians(scene, count = 22) {
  const rand = rng(555);
  const list = [];
  for (let i = 0; i < count; i++) list.push(new Pedestrian(scene, rand));
  return list;
}
export function scarePeds(peds, x, z, radius) { for (const p of peds) p.scare(x, z, radius); }

// Frighten every pedestrian inside a radius (gunfire, explosions, near misses).
export function panicAt(peds, x, z, radius = 30) {
  let n = 0;
  for (const p of peds) if (Math.hypot(p.x - x, p.z - z) < radius) { p.panic = Math.max(p.panic, 2.4); n++; }
  return n;
}
