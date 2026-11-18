// combat.js — hitscan gunplay: pistol + SMG, muzzle flash, tracers, hit
// sparks, and hostile gunmen who shoot back.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { makeHuman } from './player.js';

export class Enemy {
  constructor(scene, x, z, opts = {}) {
    this.mesh = makeHuman({ shirt: opts.shirt || 0x30303a, pants: 0x1c1c22, skin: 0xb9825e });
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.health = opts.health || 60;
    this.dead = false; this.shootT = 1 + Math.random() * 1.6;
    this.walkT = Math.random() * 8;
  }
  get x() { return this.mesh.position.x; } get z() { return this.mesh.position.z; }
  hurt(n) {
    this.health -= n;
    if (this.health <= 0 && !this.dead) { this.dead = true; this.mesh.rotation.x = Math.PI / 2; this.mesh.position.y = 0.3; }
  }
  update(dt, G) {
    if (this.dead) return;
    const p = G.player.pos;
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    this.mesh.rotation.y = Math.atan2(dx, dz);
    const { armL, armR, legL, legR } = this.mesh.userData.limbs;
    armR.rotation.x = -1.45; armL.rotation.x = -1.2;
    if (d > 16) { // close in
      this.mesh.position.x += (dx / d) * 3.4 * dt;
      this.mesh.position.z += (dz / d) * 3.4 * dt;
      this.walkT += dt * 9;
      const sw = Math.sin(this.walkT) * 0.6; legL.rotation.x = sw; legR.rotation.x = -sw;
    }
    this.shootT -= dt;
    if (this.shootT <= 0 && d < 42) {
      this.shootT = 1.1 + Math.random() * 1.1;
      G.fx.tracer(this.x, 1.5, this.z, p.x, 1.2, p.z, 0xff8844);
      G.audio.shot(true);
      if (Math.random() < 0.42) { G.player.hurt(5 + Math.random() * 5); G.hud.flashDamage(); }
    }
  }
  remove(scene) { scene.remove(this.mesh); }
}

export class Combat {
  constructor(G) {
    this.G = G; this.cool = 0; this.mouseDown = false;
    this.flash = new THREE.PointLight(0xffc46b, 0, 18);
    G.scene.add(this.flash);
    this.flashT = 0;
  }
  tryShoot(dt) {
    const G = this.G;
    this.cool -= dt;
    this.flashT -= dt;
    if (this.flashT <= 0) this.flash.intensity = 0;
    const w = WEAPONS[G.player.weapon];
    const wantFire = w.auto ? this.mouseDown : this.justClicked;
    this.justClicked = false;
    if (!wantFire || this.cool > 0 || G.player.car || G.state !== 'playing') return;
    this.cool = w.rate;
    const p = G.player;
    const dir = G.aimDir; // {x,z} unit vector from camera/player facing
    if (!dir) return;
    G.audio.shot(false);
    G.wanted.report('gunfire', G.anyWitnessNear(30));
    G.scarePeds(p.x, p.z, 30);
    // muzzle flash at the player's hand
    this.flash.position.set(p.x + dir.x * 0.7, 1.5, p.z + dir.z * 0.7);
    this.flash.intensity = 26; this.flashT = 0.05;
    const spread = () => (Math.random() - 0.5) * 2 * w.spread;
    const dx = dir.x + spread(), dz = dir.z + spread();
    // nearest enemy along the ray
    let best = null, bestT = w.range;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const ex = e.x - p.x, ez = e.z - p.z;
      const t = ex * dx + ez * dz;
      if (t < 2 || t > bestT) continue;
      const side = Math.abs(ex * dz - ez * dx);
      if (side < 1.1) { best = e; bestT = t; }
    }
    const endX = p.x + dx * bestT, endZ = p.z + dz * bestT;
    G.fx.tracer(p.x + dir.x * 0.6, 1.45, p.z + dir.z * 0.6, endX, 1.2, endZ, 0xffe08a);
    if (best) {
      best.hurt(w.damage);
      G.fx.spark(endX, 1.2, endZ);
      if (best.dead) { G.wanted.report('killEnemy', G.anyWitnessNear(34)); G.hud.toast('Target down'); }
    } else {
      // vehicle hits
      for (const v of G.allVehicles()) {
        if (v === p.car) continue;
        const d = Math.hypot(v.x - endX, v.z - endZ);
        if (d < 2.6) { v.damage(w.damage * 0.7); G.fx.spark(endX, 1, endZ); break; }
      }
    }
  }
}

// Shared visual FX: tracer lines, hit sparks and NOS flames, all pooled and
// short-lived so the loop never allocates per frame for long.
export class FX {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.sparkMat = new THREE.PointsMaterial({ color: 0xffcc55, size: 0.35 });
  }
  add(obj, life) { this.scene.add(obj); this.items.push({ obj, life }); }
  tracer(x1, y1, z1, x2, y2, z2, color = 0xffe08a) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    this.add(line, 0.07);
  }
  spark(x, y, z) {
    const n = 10, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = x + (Math.random() - 0.5) * 0.6; pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.8; pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.add(new THREE.Points(geo, this.sparkMat), 0.16);
  }
  flame(car) {
    const back = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.7, 8),
      new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x53b6ff : 0xff9a3c, transparent: true, opacity: 0.85 }));
    const L = car.mesh.userData.len || 4.8;
    back.position.set(car.x + Math.sin(car.heading) * (L / 2 + 0.7), 0.65, car.z + Math.cos(car.heading) * (L / 2 + 0.7));
    back.rotation.x = Math.PI / 2;
    back.rotation.y = car.heading;
    this.add(back, 0.09);
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.obj.material && 'opacity' in it.obj.material) it.obj.material.opacity = Math.max(0, it.life * 8);
      if (it.life <= 0) { this.scene.remove(it.obj); this.items.splice(i, 1); }
    }
  }
}
