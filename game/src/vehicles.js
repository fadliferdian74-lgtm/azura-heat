// vehicles.js — stylised car factory + arcade vehicle physics (shared by the
// player, traffic, police, racers and the convoy van).
import * as THREE from 'three';
import { clamp } from './config.js';

const glassMat = new THREE.MeshPhongMaterial({ color: 0x1c2a38, shininess: 90 });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
const smokeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  gr.addColorStop(0, 'rgba(200,200,200,0.85)'); gr.addColorStop(1, 'rgba(200,200,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhongMaterial({ color, shininess: 70 });
  const L = kind === 'van' ? 6.4 : kind === 'sport' ? 4.6 : 4.9;
  const W = kind === 'van' ? 2.5 : 2.1, H = kind === 'van' ? 2.5 : 0.85;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), paint);
  body.position.y = 0.75; g.add(body);
  if (kind === 'van') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.8, 1.4), paint);
    cab.position.set(0, 1.15, -L / 2 + 0.7); g.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.6, 0.1), glassMat);
    shield.position.set(0, 1.35, -L / 2 - 0.02); g.add(shield);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(W - 0.35, 0.62, L * 0.45), glassMat);
    cabin.position.set(0, 1.42, kind === 'sport' ? 0.15 : -0.1); g.add(cabin);
    if (kind === 'convertible') cabin.visible = false;
    if (kind === 'sport') {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.12, 0.5), paint);
      wing.position.set(0, 1.35, L / 2 - 0.3); g.add(wing);
    }
  }
  if (kind === 'police') {
    // chunky lightbar: dark base, bright red/blue blocks and translucent
    // halo boxes so the strobes read at distance and in screenshots.
    const bar = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.58), new THREE.MeshLambertMaterial({ color: 0x14161c }));
    bar.add(base);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.3, 0.54), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.3, 0.54), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    red.position.set(-0.37, 0.2, 0); blue.position.set(0.37, 0.2, 0);
    const redGlow = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.6, 0.85),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.32, depthWrite: false }));
    const blueGlow = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.6, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.32, depthWrite: false }));
    redGlow.position.copy(red.position); blueGlow.position.copy(blue.position);
    bar.add(red, blue, redGlow, blueGlow);
    bar.position.y = 1.8; g.add(bar); g.userData.lightbar = bar;
    // red/blue light spill on the road under the cruiser
    const spill = new THREE.Mesh(new THREE.CircleGeometry(3.4, 18),
      new THREE.MeshBasicMaterial({ color: 0x8855ff, transparent: true, opacity: 0.16, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.y = 0.16; g.add(spill);
  }
  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  for (const [wx, wz] of [[-W / 2, -L / 2 + 0.9], [W / 2, -L / 2 + 0.9], [-W / 2, L / 2 - 0.9], [W / 2, L / 2 - 0.9]]) {
    const w = new THREE.Mesh(wg, tyreMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    hl.position.set(s * (W / 2 - 0.35), 0.85, -L / 2 - 0.03); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    tl.position.set(s * (W / 2 - 0.35), 0.9, L / 2 + 0.03); g.add(tl);
  }
  g.userData.wheels = wheels;
  g.userData.paint = paint;
  g.userData.len = L;
  return g;
}

let VID = 1;
export class Vehicle {
  constructor(scene, x, z, heading, color, kind = 'sedan') {
    this.id = VID++;
    this.kind = kind;
    this.mesh = makeCarMesh(color, kind);
    this.mesh.position.set(x, 0, z);
    this.heading = heading; this.speed = 0;
    this.steer = 0; this.health = 100; this.dead = false;
    this.driver = 'parked'; this.nos = 1; this.drifting = false;
    this.smoke = null; this.smokeT = 0;
    scene.add(this.mesh);
    this.sync();
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  sync() {
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * 0.06;
  }
  // input: {throttle -1..1, steer -1..1, brake, hand, nos}
  drive(dt, input, fx) {
    const maxF = this.kind === 'sport' ? 46 : this.kind === 'van' ? 30 : 38;
    const maxR = 13;
    if (input.nos && this.nos > 0 && this.speed > 4) {
      this.speed += 34 * dt; this.nos = Math.max(0, this.nos - dt * 0.55);
      if (fx) fx.flame(this);
    } else this.nos = Math.min(1, this.nos + dt * 0.07);
    if (input.throttle > 0) this.speed += (this.speed < 0 ? 34 : 21) * dt * input.throttle;
    else if (input.throttle < 0) this.speed -= (this.speed > 0 ? 34 : 15) * dt * -input.throttle;
    if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 40 * dt);
    const drag = input.hand ? 0.4 : 1.1;
    this.speed -= this.speed * drag * dt * 0.32;
    this.speed = clamp(this.speed, -maxR, maxF + (input.nos ? 14 : 0));
    this.steer = lerpSteer(this.steer, input.steer || 0, dt * 7);
    const grip = input.hand ? 0.55 : 1;
    this.heading -= this.steer * dt * (this.speed / 9) * 0.42 * grip * (this.speed < 0 ? -1 : 1);
    this.drifting = !!input.hand && Math.abs(this.speed) > 12;
    this.mesh.position.x -= Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z -= Math.cos(this.heading) * this.speed * dt;
    this.sync();
    this.updateSmoke(dt);
  }
  // simple forward motion for AI drivers (heading pre-steered by caller)
  cruise(dt, targetSpeed) {
    const accel = this.speed < targetSpeed ? 11 : 26;
    this.speed += clamp(targetSpeed - this.speed, -accel * dt, accel * dt);
    this.mesh.position.x -= Math.sin(this.heading) * this.speed * dt;
    this.mesh.position.z -= Math.cos(this.heading) * this.speed * dt;
    this.sync();
    this.updateSmoke(dt);
  }
  updateSmoke(dt) {
    if (this.health < 45 && !this.dead) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.09;
        if (!this.smoke) {
          this.smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0.6, depthWrite: false }));
          this.mesh.add(this.smoke);
        }
        this.smoke.position.set((Math.random() - 0.5), 1.6 + Math.random() * 0.6, -1.4);
        this.smoke.scale.setScalar(1 + Math.random() * 1.4);
      }
    } else if (this.smoke) { this.mesh.remove(this.smoke); this.smoke = null; }
  }
  damage(n) {
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) this.dead = true;
  }
  remove(scene) { scene.remove(this.mesh); }
}
function lerpSteer(a, b, t) { return a + (b - a) * Math.min(1, t); }

// Parked cars dotted around the city (stealable). Deterministic placement.
import { ROADS, rng } from './config.js';
export const CAR_COLORS = [0xd64541, 0x3f7fd1, 0xf2b035, 0xeeeeee, 0x22262c, 0x53b06a, 0xb053c9, 0xe67e22, 0x16a3a3];
const KINDS = ['sedan', 'sedan', 'sport', 'convertible', 'sedan', 'sport'];
export function spawnParkedCars(scene, count = 16) {
  const rand = rng(777);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const alongX = rand() < 0.5;
    const road = ROADS[Math.floor(rand() * ROADS.length)];
    const along = -300 + rand() * 600;
    const side = rand() < 0.5 ? -1 : 1;
    const x = alongX ? along : road + side * 13.5;
    const z = alongX ? road + side * 13.5 : along;
    const heading = alongX ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0);
    const car = new Vehicle(scene, x, z, heading, CAR_COLORS[i % CAR_COLORS.length], KINDS[i % KINDS.length]);
    cars.push(car);
  }
  return cars;
}
