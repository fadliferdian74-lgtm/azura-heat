// police.js — Port Azura PD: pursuit cars that steer the road grid then close
// in directly, roadblocks at 3+ stars, and a helicopter with a searchlight
// that joins the hunt at 4+ stars.
import * as THREE from 'three';
import { clamp, dist2d, angleLerp, nearestRoad } from './config.js';
import { Vehicle } from './vehicles.js';

export class CopCar {
  constructor(scene, x, z) {
    this.car = new Vehicle(scene, x, z, 0, 0xf4f6f8, 'police');
    this.car.driver = 'police';
    this.flashT = Math.random() * 6;
    this.stuckT = 0;
    this.bestD = Infinity; this.watchT = 0; this.directT = 0;
  }
  get x() { return this.car.x; } get z() { return this.car.z; }
  update(dt, target) {
    const c = this.car;
    const d = dist2d(c.x, c.z, target.x, target.z);
    // progress watchdog: the road-grid waypoint logic can settle into a
    // limit cycle around a block for some spawn angles and never close
    // in. If the gap has not shrunk for 4 s, drop the waypoints and
    // pursue directly for 5 s (cops may cut across a block), then retry.
    if (d < this.bestD - 3) { this.bestD = d; this.watchT = 0; }
    this.watchT += dt;
    if (this.watchT > 4) { this.directT = 5; this.watchT = 0; this.bestD = d; }
    if (this.directT > 0) this.directT -= dt;
    let tx = target.x, tz = target.z;
    if (d > 55 && this.directT <= 0) {
      // road-grid steering: head to the road line nearest the target first
      if (Math.abs(c.x - target.x) > Math.abs(c.z - target.z)) tz = nearestRoad(c.z) + (c.z > target.z ? 6 : -6) * 0;
      else tx = nearestRoad(c.x);
      if (Math.abs(c.x - tx) < 8) tx = target.x;
      if (Math.abs(c.z - tz) < 8) tz = target.z;
    }
    const want = Math.atan2(-(tx - c.x), -(tz - c.z));
    const diff = ((want - c.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.steer = clamp(diff * 1.6, -1, 1);
    const chasing = Math.abs(diff) < 2.4;
    const speedWanted = d < 9 ? 0 : chasing ? 1 : -0.4;
    c.drive(dt, { throttle: speedWanted, steer: c.steer, brake: false, hand: false, nos: false });
    if (Math.abs(c.speed) < 1 && d > 14) { this.stuckT += dt; if (this.stuckT > 2.2) { c.heading += Math.PI; this.stuckT = 0; } }
    else this.stuckT = 0;
    // lightbar strobing (children: 0 base, 1 red, 2 blue, 3 red halo, 4 blue halo)
    this.flashT += dt * 9;
    const bar = c.mesh.userData.lightbar;
    if (bar) {
      const phase = Math.sin(this.flashT) > 0;
      bar.children[1].visible = phase; bar.children[3].visible = phase;
      bar.children[2].visible = !phase; bar.children[4].visible = !phase;
    }
    c.sync();
  }
  remove(scene) { this.car.remove(scene); }
}

export class Helicopter {
  constructor(scene) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x22303e, shininess: 60 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 6.4), bodyMat); g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 6), bodyMat); tail.position.set(0, 0.4, 5.6); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    rotor.position.y = 1.5; g.add(rotor);
    this.rotor = rotor;
    this.light = new THREE.SpotLight(0xfff2c0, 900, 160, 0.32, 0.45, 1.2);
    this.light.position.set(0, -1, 0);
    g.add(this.light); g.add(this.light.target);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.25;
    this.pool = pool; scene.add(pool);
    // visible searchlight cone from the belly down to the light pool, so the
    // beam reads in screenshots even against a bright sky
    const cone = new THREE.Mesh(new THREE.ConeGeometry(10.5, 37, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    cone.position.y = -19.5; g.add(cone); this.cone = cone;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false }));
    lamp.position.y = -1.2; g.add(lamp);
    this.mesh = g; this.active = false; this.t = 0;
    g.visible = false; scene.add(g);
  }
  update(dt, target) {
    if (!this.active) { this.mesh.visible = false; this.pool.visible = false; return; }
    this.mesh.visible = true; this.pool.visible = true;
    this.t += dt;
    const orbit = 16;
    const tx = target.x + Math.cos(this.t * 0.55) * orbit;
    const tz = target.z + Math.sin(this.t * 0.55) * orbit;
    this.mesh.position.x += (tx - this.mesh.position.x) * dt * 1.6;
    this.mesh.position.z += (tz - this.mesh.position.z) * dt * 1.6;
    this.mesh.position.y = 34 + Math.sin(this.t * 0.9) * 2;
    this.mesh.lookAt(target.x, 0, target.z);
    this.rotor.rotation.y += dt * 28;
    this.light.target.position.set(target.x - this.mesh.position.x, -40, target.z - this.mesh.position.z);
    this.pool.position.set(target.x, 0.25, target.z);
  }
  setActive(on, x = 0, z = 0) {
    if (on && !this.active) this.mesh.position.set(x + 40, 36, z + 40);
    this.active = on;
  }
}

// Police director: keeps the number of pursuit units matched to the wanted
// level, spawns them just out of view, despawns them when the heat dies.
export class PoliceDirector {
  constructor(scene) {
    this.scene = scene;
    this.cops = [];
    this.heli = new Helicopter(scene);
    this.blocks = [];       // roadblock vehicles
    this.spawnT = 0;
  }
  desired(stars) { return stars <= 0 ? 0 : [0, 2, 3, 4, 5, 6][stars] || 0; }
  update(dt, G) {
    const stars = G.wanted.stars;
    const target = G.player.pos;
    this.spawnT -= dt;
    const want = this.desired(stars);
    if (this.cops.length < want && this.spawnT <= 0) {
      this.spawnT = 2.2;
      const a = Math.random() * Math.PI * 2, r = 95 + Math.random() * 40;
      const cop = new CopCar(this.scene, target.x + Math.cos(a) * r, target.z + Math.sin(a) * r);
      this.cops.push(cop);
    }
    let seen = false;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (cop.car.dead || (stars === 0 && dist2d(cop.x, cop.z, target.x, target.z) > 160)) {
        cop.remove(this.scene); this.cops.splice(i, 1); continue;
      }
      cop.update(dt, { x: target.x, z: target.z });
      if (dist2d(cop.x, cop.z, target.x, target.z) < 55) seen = true;
      // ramming damage both ways
      const pv = G.player.car;
      if (pv && dist2d(cop.x, cop.z, pv.x, pv.z) < 4.4 && Math.abs(pv.speed) + Math.abs(cop.car.speed) > 8) {
        cop.car.damage(dt * 22); pv.damage(dt * 9);
      }
    }
    // roadblocks at 3+ stars: two parked cruisers across a road ahead
    if (stars >= 3 && this.blocks.length === 0 && G.player.car) {
      const pv = G.player.car;
      const fx = -Math.sin(pv.heading), fz = -Math.cos(pv.heading);
      const bx = pv.x + fx * 85, bz = pv.z + fz * 85;
      for (const off of [-4, 4]) {
        const b = new Vehicle(this.scene, bx + off * fz, bz - off * fx, pv.heading + Math.PI / 2, 0xf4f6f8, 'police');
        b.driver = 'roadblock'; this.blocks.push(b);
      }
    }
    if (stars < 3) { for (const b of this.blocks) b.remove(this.scene); this.blocks = []; }
    this.heli.setActive(stars >= 4, target.x, target.z);
    this.heli.update(dt, { x: target.x, z: target.z });
    if (this.heli.active) seen = true;
    G.policeSeen = seen;
    G.copPositions = this.cops.map(c => ({ x: c.x, z: c.z }));
  }
}
export { angleLerp };
