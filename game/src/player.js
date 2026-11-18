// player.js — Dario Venn: low-poly third-person character with limb-swing walk
// animation, plus on-foot movement + orbit camera control.
import * as THREE from 'three';
import { clamp, angleLerp } from './config.js';
import { MAT, mergeParts, blobShadow, blobHumanGeo } from './materials.js';

// Colour-blocked low-poly character. Each body region is ONE merged mesh
// with vertex colours: torso (shirt + accent chest band + belt), head
// (skin + cap/bandana/helmet cue), jointed limb pivots whose segments run
// sleeve→skin on arms and trouser→shoe on legs, an optional readable gun
// riding the right-arm pivot (the Player toggles its visibility with aim;
// enemies always brandish theirs), and a blob contact shadow.
export function makeHuman({ shirt = 0x2e6fd1, pants = 0x2b2b30, skin = 0xd9a066, hair = 0x201812, accent = 0xf2b035, style = 'cap', gun = false } = {}) {
  const g = new THREE.Group();
  const box = (arr, w, h, d, x, y, z, c, r) => arr.push({ geo: new THREE.BoxGeometry(w, h, d), p: [x, y, z], c, r });
  const cap3 = (arr, rad, len, x, y, z, c) => arr.push({ geo: new THREE.CapsuleGeometry(rad, len, 3, 8), p: [x, y, z], c });

  const torsoParts = [];
  box(torsoParts, 0.62, 0.78, 0.34, 0, 1.18, 0, shirt);
  box(torsoParts, 0.64, 0.15, 0.36, 0, 1.34, 0, accent);          // chest band / vest stripe
  box(torsoParts, 0.64, 0.1, 0.36, 0, 0.84, 0, 0x1c1c20);         // belt
  box(torsoParts, 0.2, 0.12, 0.36, -0.24, 1.53, 0, shirt);        // shoulder pads
  box(torsoParts, 0.2, 0.12, 0.36, 0.24, 1.53, 0, shirt);
  const torso = new THREE.Mesh(mergeParts(torsoParts), MAT.vc); torso.name = 'torso'; g.add(torso);

  const headParts = [];
  box(headParts, 0.4, 0.44, 0.4, 0, 1.82, 0, skin);
  box(headParts, 0.1, 0.08, 0.06, 0, 1.78, 0.22, skin);           // nose hint
  if (style === 'bandana') {
    box(headParts, 0.43, 0.17, 0.43, 0, 1.97, 0, accent);
    box(headParts, 0.12, 0.22, 0.05, 0.14, 1.82, -0.24, accent);  // knot tails
  } else if (style === 'helmet') {
    box(headParts, 0.47, 0.26, 0.47, 0, 1.99, 0, hair);
    box(headParts, 0.47, 0.07, 0.2, 0, 1.9, 0.26, hair);          // helmet brim
  } else { // cap
    box(headParts, 0.44, 0.14, 0.44, 0, 2.07, 0, hair);
    box(headParts, 0.4, 0.05, 0.26, 0, 2.02, 0.32, hair);         // cap brim
  }
  const head = new THREE.Mesh(mergeParts(headParts), MAT.vc); head.name = 'head'; g.add(head);

  function limb(x, y, parts) {
    // a pivot at the joint; the merged segment mesh hangs below it so a
    // single rotation.x swings the whole limb
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(mergeParts(parts), MAT.vc);
    pivot.add(m); g.add(pivot); return pivot;
  }
  const armParts = (sleeve) => {
    const p = [];
    cap3(p, 0.11, 0.26, 0, -0.2, 0, sleeve);                       // upper arm (sleeve)
    cap3(p, 0.095, 0.24, 0, -0.5, 0, skin);                        // forearm (skin)
    box(p, 0.13, 0.14, 0.13, 0, -0.72, 0, skin);                   // hand
    return p;
  };
  const legParts = [];
  cap3(legParts, 0.13, 0.3, 0, -0.2, 0, pants);                    // thigh
  cap3(legParts, 0.11, 0.28, 0, -0.55, 0, pants);                  // shin
  box(legParts, 0.2, 0.1, 0.34, 0, -0.8, 0.05, 0x17181c);          // shoe
  const armL = limb(-0.42, 1.52, armParts(shirt)), armR = limb(0.42, 1.52, armParts(shirt));
  const legL = limb(-0.17, 0.82, legParts), legR = limb(0.17, 0.82, legParts);
  armL.children[0].name = 'armL'; armR.children[0].name = 'armR';
  legL.children[0].name = 'legL'; legR.children[0].name = 'legR';

  let gunMesh = null;
  if (gun) {
    const gp = [];
    box(gp, 0.09, 0.15, 0.46, 0, 0, 0.05, 0x191c20);               // receiver
    box(gp, 0.055, 0.055, 0.3, 0, 0.03, 0.4, 0x2c3036);            // barrel
    box(gp, 0.08, 0.2, 0.1, 0, -0.14, -0.08, 0x191c20, [0.35, 0, 0]); // grip
    box(gp, 0.05, 0.12, 0.07, 0, -0.12, 0.14, 0x23262c);           // magazine
    gunMesh = new THREE.Mesh(mergeParts(gp), MAT.vc);
    gunMesh.name = 'gun'; gunMesh.position.set(0, -0.72, 0.1);
    armR.add(gunMesh);
  }
  const shadow = blobShadow(blobHumanGeo, 1.15, 1.15, 0.07); shadow.name = 'contactShadow'; g.add(shadow);
  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.head = head;
  g.userData.gun = gunMesh;
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makeHuman({ gun: true });
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
    if (this.mesh.userData.gun) this.mesh.userData.gun.visible = this.aiming;
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
