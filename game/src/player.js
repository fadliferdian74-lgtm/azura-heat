// player.js — Dario Venn: low-poly third-person character with limb-swing walk
// animation, plus on-foot movement + orbit camera control.
import * as THREE from 'three';
import { clamp, angleLerp } from './config.js';

export function makeHuman({ shirt = 0x2e6fd1, pants = 0x2b2b30, skin = 0xd9a066, hair = 0x201812 } = {}) {
  const g = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: shirt });
  const pm = new THREE.MeshLambertMaterial({ color: pants });
  const km = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), sm); torso.position.y = 1.18; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.44, 0.4), km); head.position.y = 1.82; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: hair }));
  cap.position.y = 2.06; g.add(cap);
  function limb(mat, x, y, len, r = 0.11) {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
    m.position.y = -len / 2; pivot.add(m); g.add(pivot); return pivot;
  }
  const armL = limb(sm, -0.42, 1.52, 0.62), armR = limb(sm, 0.42, 1.52, 0.62);
  const legL = limb(pm, -0.17, 0.82, 0.74, 0.13), legR = limb(pm, 0.17, 0.82, 0.74, 0.13);
  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.head = head;
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makeHuman({});
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = 0; this.walkT = 0; this.speedNow = 0;
    this.health = 100; this.dead = false;
    this.car = null;            // Vehicle when driving
    this.weapon = 'pistol';
    this.aiming = false;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  get pos() { return this.car ? this.car.mesh.position : this.mesh.position; }
  hurt(n) {
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) this.dead = true;
  }
  heal(dt) { if (!this.dead) this.health = Math.min(100, this.health + dt * 4.5); }
  // WASD relative to camera yaw; sprint with shift. Returns true if moving.
  move(dt, keys, camYaw) {
    let ix = 0, iz = 0;
    if (keys['KeyW']) iz -= 1; if (keys['KeyS']) iz += 1;
    if (keys['KeyA']) ix -= 1; if (keys['KeyD']) ix += 1;
    const moving = ix !== 0 || iz !== 0;
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = sprint ? 11.5 : 6.4;
    if (moving) {
      const len = Math.hypot(ix, iz); ix /= len; iz /= len;
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const wx = ix * cos - iz * sin, wz = ix * sin + iz * cos;
      this.mesh.position.x += wx * speed * dt;
      this.mesh.position.z += wz * speed * dt;
      const target = Math.atan2(wx, wz);
      this.heading = angleLerp(this.heading, target, Math.min(1, dt * 12));
      this.walkT += dt * (sprint ? 13 : 9);
      this.speedNow = speed;
    } else { this.walkT = 0; this.speedNow = 0; }
    this.mesh.rotation.y = this.heading;
    const { armL, armR, legL, legR } = this.mesh.userData.limbs;
    const sw = moving ? Math.sin(this.walkT) * 0.75 : 0;
    legL.rotation.x = sw; legR.rotation.x = -sw;
    if (this.aiming) { armR.rotation.x = -1.45; armL.rotation.x = -1.2; }
    else { armL.rotation.x = -sw; armR.rotation.x = sw; }
    this.mesh.position.y = moving ? Math.abs(Math.sin(this.walkT)) * 0.07 : 0;
    return moving;
  }
  syncToCar() {
    if (this.car) { this.mesh.visible = false; }
    else this.mesh.visible = true;
  }
}
export { clamp };

// Face the character toward a world point (used while aiming / in dialogue).
export function faceToward(player, x, z) {
  player.heading = Math.atan2(x - player.x, z - player.z);
  player.mesh.rotation.y = player.heading;
}
