// AZURA HEAT — Dario Venn on foot: a low-poly box-and-capsule character with
// swinging-limb walk/run animation, a third-person orbit camera rig, sprinting,
// health with slow regeneration, and the enter/exit-car handoff.
import * as THREE from 'three';
import { PLAYER, clamp } from './config.js';

function limb(w, h, d, color, x, y, z, parent) {
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); parent.add(m); return m;
}

/** Build the character. Forward is -Z; limbs hang from pivot groups. */
export function buildCharacterMesh(shirt = 0xe2543e, pants = 0x2c3550, skin = 0xd9a066) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.85, 0.42),
    new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.32; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 2.02; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.16, 10),
    new THREE.MeshLambertMaterial({ color: 0x22262e }));
  cap.position.y = 2.22; g.add(cap);
  const armL = limb(0.22, 0.78, 0.22, shirt, -0.52, 1.72, 0, g);
  const armR = limb(0.22, 0.78, 0.22, shirt, 0.52, 1.72, 0, g);
  const legL = limb(0.26, 0.92, 0.26, pants, -0.2, 0.92, 0, g);
  const legR = limb(0.26, 0.92, 0.26, pants, 0.2, 0.92, 0, g);
  // The held weapon sits in the right hand and appears when a gun is drawn.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.52),
    new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0, -0.78, -0.2); gun.visible = false; armR.add(gun);
  g.userData = { armL, armR, legL, legR, gun };
  return g;
}

export function createPlayer(scene) {
  const mesh = buildCharacterMesh();
  scene.add(mesh);
  return {
    mesh, x: PLAYER.start.x, z: PLAYER.start.z, heading: 0, // heading 0 faces -Z: north, into the city
    health: PLAYER.maxHealth, radius: PLAYER.radius, speedNow: 0,
    inCar: null, walkPhase: 0, regenT: 0, dead: false, weapon: 'pistol', gunDrawn: false,
  };
}

/**
 * Move the player on foot. moveX/moveZ are camera-relative wish directions,
 * sprint multiplies speed; limbs swing with distance travelled.
 */
export function stepPlayer(player, moveX, moveZ, sprint, dt) {
  const mag = Math.hypot(moveX, moveZ);
  if (mag > 0.05) {
    const speed = sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = moveX / mag, nz = moveZ / mag;
    player.x += nx * speed * dt; player.z += nz * speed * dt;
    player.heading = Math.atan2(-nx, -nz);
    player.speedNow = speed;
    player.walkPhase += dt * speed * 1.6;
  } else player.speedNow = 0;
  const swing = Math.sin(player.walkPhase) * (player.speedNow > 8 ? 0.85 : 0.55) * (mag > 0.05 ? 1 : 0);
  const u = player.mesh.userData;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  if (player.gunDrawn) { u.armR.rotation.x = -1.35; u.armL.rotation.x = swing * 0.4; }
  else { u.armL.rotation.x = -swing; u.armR.rotation.x = swing; }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  // Health regeneration after a quiet moment.
  player.regenT -= dt;
  if (player.regenT <= 0 && player.health > 0) player.health = Math.min(PLAYER.maxHealth, player.health + 2.4 * dt);
}

export function damagePlayer(player, amount) {
  player.health = Math.max(0, player.health - amount);
  player.regenT = 5;
  if (player.health <= 0) player.dead = true;
}

/** Third-person camera: orbit yaw/pitch around a target, smoothed. */
export function createCameraRig() {
  return { yaw: 0, pitch: 0.32, dist: 8.5, cur: null };
}
export function updateCamera(camera, rig, tx, ty, tz, dt) {
  // Place the camera behind the yaw direction, above the shoulder line.
  const px = tx + Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
  const pz = tz + Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
  const py = ty + Math.sin(rig.pitch) * rig.dist + 1.2;
  if (!rig.cur) rig.cur = new THREE.Vector3(px, py, pz);
  const k = 1 - Math.pow(0.0001, dt);
  rig.cur.x += (px - rig.cur.x) * k; rig.cur.y += (py - rig.cur.y) * k; rig.cur.z += (pz - rig.cur.z) * k;
  camera.position.copy(rig.cur);
  camera.lookAt(tx, ty + 1.4, tz);
}
export function setGunDrawn(player, drawn) {
  player.gunDrawn = drawn;
  player.mesh.userData.gun.visible = drawn;
}
export { clamp };
