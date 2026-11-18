// AZURA HEAT — combat: hitscan pistol and SMG with muzzle flash, tracers and
// hit sparks; Halden's men as armed enemies who shoot back; floating health.
// Shooting is loud: every shot is a reportable crime and scares pedestrians.
import * as THREE from 'three';
import { WEAPONS, clamp } from './config.js';
import { buildCharacterMesh, damagePlayer } from './player.js';

export function createCombat(scene) {
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9 });
  const flash = new THREE.PointLight(0xffc46b, 0, 16);
  scene.add(flash);
  const sparkGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const sparks = [];
  return { scene, tracers, tracerMat, flash, sparks, sparkGeo, enemies: [], cooldown: 0, muzzleT: 0 };
}

/** Spawn one of Halden's men (dark suit, armed) at a mission spot. */
export function spawnEnemy(combat, x, z) {
  const mesh = buildCharacterMesh(0x23262e, 0x14161a, 0xb98a5e);
  mesh.userData.gun.visible = true;
  mesh.userData.armR.rotation.x = -1.35;
  combat.scene.add(mesh);
  const e = { mesh, x, z, heading: Math.PI, health: 60, phase: Math.random() * 6, shootT: 1 + Math.random(), dead: false, isEnemy: true, radius: 0.9 };
  combat.enemies.push(e);
  return e;
}
export function clearEnemies(combat) {
  for (const e of combat.enemies) combat.scene.remove(e.mesh);
  combat.enemies = [];
}

function spawnTracer(combat, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, combat.tracerMat.clone());
  combat.scene.add(line);
  combat.tracers.push({ line, life: 0.07 });
}
function spawnSpark(combat, at) {
  const m = new THREE.Mesh(combat.sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffb84d }));
  m.position.copy(at); combat.scene.add(m);
  combat.sparks.push({ m, life: 0.22 });
}

/**
 * Fire the player's weapon toward aimDir (unit Vector3) from origin.
 * Targets: enemies, police units, traffic cars and pedestrians are all
 * hittable; returns 'enemy' | 'cop' | 'ped' | 'car' | null for wanted reports.
 */
export function playerShoot(combat, origin, aimDir, weaponKey, world) {
  if (combat.cooldown > 0) return null;
  const w = WEAPONS[weaponKey];
  combat.cooldown = w.rate;
  combat.muzzleT = 0.05;
  combat.flash.position.copy(origin).addScaledVector(aimDir, 1.2);
  combat.flash.intensity = 26;
  const dir = aimDir.clone();
  dir.x += (Math.random() - 0.5) * w.spread * 2; dir.y += (Math.random() - 0.5) * w.spread; dir.normalize();
  const end = origin.clone().addScaledVector(dir, w.range);
  let bestT = w.range, hitKind = null, hitEnt = null;
  const test = (ent, kind, radius, height) => {
    // Cheap cylinder ray test in the horizontal plane + height band.
    const ox = ent.x - origin.x, oz = ent.z - origin.z;
    const t = ox * dir.x + oz * dir.z;
    if (t < 1 || t > bestT) return;
    const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
    if (Math.hypot(ent.x - px, ent.z - pz) > radius) return;
    const y = origin.y + dir.y * t;
    if (y < -0.4 || y > height) return;
    bestT = t; hitKind = kind; hitEnt = ent;
  };
  for (const e of combat.enemies) if (!e.dead) test(e, 'enemy', 0.85, 2.3);
  for (const c of world.policeUnits) if (c.active) test(c, 'cop', 2.1, 1.9);
  for (const c of world.trafficCars) test(c, 'car', 2.1, 1.9);
  for (const p of world.peds) test(p, 'ped', 0.8, 2.2);
  const hitPoint = origin.clone().addScaledVector(dir, bestT);
  spawnTracer(combat, origin.clone().addScaledVector(dir, 0.7), hitPoint);
  if (hitEnt) {
    spawnSpark(combat, hitPoint);
    if (hitKind === 'enemy') { hitEnt.health -= w.damage; if (hitEnt.health <= 0) killEnemy(combat, hitEnt); }
    else if (hitKind === 'cop' || hitKind === 'car') hitEnt.health = Math.max(5, (hitEnt.health ?? 100) - w.damage * 0.4);
    else if (hitKind === 'ped') hitEnt.fleeT = 3;
  }
  return hitKind;
}

function killEnemy(combat, e) {
  e.dead = true;
  e.mesh.rotation.x = -Math.PI / 2; e.mesh.position.y = 0.25;
}
export function enemiesAlive(combat) { return combat.enemies.filter(e => !e.dead).length; }

/** Enemy fire + animation + effect lifetimes. Enemies shoot the player when close. */
export function updateCombat(combat, dt, player, onPlayerHit) {
  combat.cooldown = Math.max(0, combat.cooldown - dt);
  combat.muzzleT = Math.max(0, combat.muzzleT - dt);
  if (combat.muzzleT <= 0) combat.flash.intensity = 0;
  for (let i = combat.tracers.length - 1; i >= 0; i--) {
    const t = combat.tracers[i]; t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
    if (t.life <= 0) { combat.scene.remove(t.line); combat.tracers.splice(i, 1); }
  }
  for (let i = combat.sparks.length - 1; i >= 0; i--) {
    const s = combat.sparks[i]; s.life -= dt; s.m.scale.setScalar(1 + (0.22 - s.life) * 5);
    if (s.life <= 0) { combat.scene.remove(s.m); combat.sparks.splice(i, 1); }
  }
  for (const e of combat.enemies) {
    if (e.dead) continue;
    const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz);
    e.heading = Math.atan2(-dx, -dz);
    e.phase += dt * 4;
    if (d > 13) { e.x += (dx / d) * 2.6 * dt; e.z += (dz / d) * 2.6 * dt; }
    const swing = Math.sin(e.phase) * 0.5;
    e.mesh.userData.legL.rotation.x = d > 13 ? swing : 0;
    e.mesh.userData.legR.rotation.x = d > 13 ? -swing : 0;
    e.mesh.position.set(e.x, 0, e.z); e.mesh.rotation.y = e.heading;
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 34) {
      e.shootT = 0.9 + Math.random() * 0.8;
      const from = new THREE.Vector3(e.x, 1.55, e.z);
      const to = new THREE.Vector3(player.x + (Math.random() - 0.5) * 1.6, 1.3, player.z + (Math.random() - 0.5) * 1.6);
      spawnTracer(combat, from, to);
      combat.flash.position.copy(from); combat.flash.intensity = 14; combat.muzzleT = 0.04;
      if (Math.random() < 0.55) { damagePlayer(player, 4 + Math.random() * 5); onPlayerHit && onPlayerHit(); }
    }
  }
}
export { clamp };
