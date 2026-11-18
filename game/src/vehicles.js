// vehicles.js — stylised car factory + arcade vehicle physics (shared by the
// player, traffic, police, racers and the convoy van).
import * as THREE from 'three';
import { clamp } from './config.js';
import { MAT, paintMaterial, mergeParts, blobShadow, blobCarGeo } from './materials.js';

// Slant a box's top vertices backward — sloped glasshouse and nose profiles
// instead of upright refrigerator boxes.
function slant(geo, topZ, topShrink = 0.92) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) + topZ); p.setX(i, p.getX(i) * topShrink); }
  }
  geo.computeVertexNormals();
  return geo;
}

// One wheel: tyre + rim + hub merged with vertex colours, spins as a unit
// (shared by every car in Port Azura — one geometry, four meshes per car).
const wheelGeo = mergeParts([
  { geo: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), r: [0, 0, Math.PI / 2], c: 0x14161a },
  { geo: new THREE.CylinderGeometry(0.235, 0.235, 0.32, 10), r: [0, 0, Math.PI / 2], c: 0xc9ced4 },
  { geo: new THREE.CylinderGeometry(0.09, 0.09, 0.34, 8), r: [0, 0, Math.PI / 2], c: 0x565d66 },
]);
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
  const paint = paintMaterial(color);
  const L = kind === 'van' ? 6.4 : kind === 'sport' ? 4.6 : 4.9;
  const W = kind === 'van' ? 2.5 : kind === 'sport' ? 2.15 : 2.1;
  // Authored form, silhouette first: every car is three merged meshes —
  // paint (bodyPrimary), vertex-coloured trim (bodySecondary / trim /
  // interior) and lights (emissiveSignal) — plus glass, wheels, lightbar.
  const paintParts = [], vcParts = [], lightParts = [];
  const B = (arr, w, h, d, x, y, z, o = {}) => arr.push({ geo: new THREE.BoxGeometry(w, h, d), p: [x, y, z], r: o.r, c: o.c });
  if (kind === 'van') {
    B(paintParts, W, 1.85, L, 0, 1.28, 0);                                   // cargo box
    B(paintParts, W - 0.1, 0.7, 0.85, 0, 0.68, -L / 2 - 0.2, { r: [-0.06, 0, 0] }); // sloped nose
    B(vcParts, W + 0.05, 0.13, L - 0.4, 0, 0.42, 0, { c: 0x23262c });        // skirt band
    B(vcParts, 0.03, 1.5, 1.3, W / 2 + 0.01, 1.2, 0.4, { c: 0x23262c });     // sliding-door seam
    B(vcParts, 1.9, 1.7, 0.03, 0, 1.28, L / 2 + 0.02, { c: 0x23262c });      // rear door seam
    const glassGeo = mergeParts([
      { geo: slant(new THREE.BoxGeometry(W - 0.34, 0.66, 0.08), 0.2), p: [0, 1.52, -L / 2 - 0.38] },
      { geo: new THREE.BoxGeometry(W + 0.03, 0.52, 1.15), p: [0, 1.8, -L / 2 + 1.05] },
    ]);
    const glass = new THREE.Mesh(glassGeo, MAT.glass); glass.name = 'cabGlass'; g.add(glass);
  } else {
    B(paintParts, W, 0.62, L, 0, 0.62, 0);                                   // lower body
    B(paintParts, W - 0.08, 0.3, 1.2, 0, 0.97, -L / 2 + 0.66, { r: [-0.09, 0, 0] }); // drooped hood
    B(paintParts, W - 0.08, 0.26, 0.95, 0, 0.96, L / 2 - 0.52, { r: [0.05, 0, 0] }); // rear deck
    B(vcParts, W + 0.05, 0.13, L - 0.5, 0, 0.42, 0, { c: 0x23262c });        // trim band / skirts
    B(vcParts, W - 0.7, 0.2, 0.06, 0, 0.62, -L / 2 - 0.02, { c: 0x14161a }); // grille
    B(vcParts, W + 0.04, 0.26, 0.22, 0, 0.4, -L / 2 + 0.02, { c: 0x1e2126 }); // front bumper
    B(vcParts, W + 0.04, 0.26, 0.22, 0, 0.4, L / 2 - 0.02, { c: 0x1e2126 });  // rear bumper
    if (kind === 'convertible') {
      B(vcParts, W - 0.34, 0.34, L * 0.46, 0, 1.0, 0.1, { c: 0x2a2320 });    // interior tub
      B(vcParts, 0.52, 0.42, 0.16, -0.48, 1.16, 0.62, { c: 0x6e4a2f });      // tan seats
      B(vcParts, 0.52, 0.42, 0.16, 0.48, 1.16, 0.62, { c: 0x6e4a2f });
      const shield = new THREE.Mesh(slant(new THREE.BoxGeometry(W - 0.3, 0.5, 0.07), 0.22), MAT.glass);
      shield.name = 'windshield'; shield.position.set(0, 1.24, -L * 0.26); g.add(shield);
    } else {
      const cabinZ = kind === 'sport' ? 0.1 : -0.05;
      const cabin = new THREE.Mesh(slant(new THREE.BoxGeometry(W - 0.42, 0.62, L * 0.44), 0.3), MAT.glass);
      cabin.name = 'cabinGlass'; cabin.position.set(0, 1.3, cabinZ); g.add(cabin);
      B(paintParts, W - 0.52, 0.09, L * 0.3, 0, 1.65, cabinZ + 0.15);        // roof panel
    }
    if (kind === 'sport') {
      B(vcParts, W + 0.06, 0.1, L - 1.4, 0, 0.78, 0, { c: 0xf5f2ea });       // side stripe
      B(vcParts, 0.52, 0.035, 1.15, 0, 1.13, -L / 2 + 0.66, { c: 0xf5f2ea }); // racing stripes
      B(vcParts, 0.52, 0.03, L * 0.3, 0, 1.71, 0.25, { c: 0xf5f2ea });
      B(vcParts, 0.52, 0.035, 0.9, 0, 1.11, L / 2 - 0.52, { c: 0xf5f2ea });
      B(paintParts, 0.09, 0.24, 0.09, -W / 2 + 0.4, 1.16, L / 2 - 0.42);     // spoiler struts
      B(paintParts, 0.09, 0.24, 0.09, W / 2 - 0.4, 1.16, L / 2 - 0.42);
      B(paintParts, W + 0.18, 0.09, 0.55, 0, 1.3, L / 2 - 0.42);             // spoiler wing
    }
    if (kind === 'police') {
      B(vcParts, 0.04, 0.5, 1.7, -(W / 2 + 0.01), 0.68, 0.1, { c: 0x1c2733 }); // dark door panels
      B(vcParts, 0.04, 0.5, 1.7, W / 2 + 0.01, 0.68, 0.1, { c: 0x1c2733 });
      B(vcParts, W + 0.06, 0.09, L - 1.2, 0, 0.52, 0, { c: 0xd8a03c });      // gold waist stripe
      B(vcParts, 1.2, 0.34, 0.12, 0, 0.5, -L / 2 - 0.14, { c: 0x14161a });   // push bar
    }
  }
  const body = new THREE.Mesh(mergeParts(paintParts), paint); body.name = 'body'; g.add(body);
  const trimMesh = new THREE.Mesh(mergeParts(vcParts), MAT.vc); trimMesh.name = 'trim'; g.add(trimMesh);
  // emissive-signal lights: headlights + amber indicators + taillights
  const headZ = kind === 'van' ? -L / 2 - 0.63 : -L / 2 - 0.03;
  for (const s of [-1, 1]) {
    B(lightParts, 0.42, 0.17, 0.06, s * (W / 2 - 0.36), 0.82, headZ, { c: 0xfff3c4 });
    B(lightParts, 0.18, 0.12, 0.06, s * (W / 2 - 0.12), 0.82, headZ, { c: 0xffa02e });
  }
  if (kind === 'sport') B(lightParts, W - 0.5, 0.12, 0.06, 0, 0.92, L / 2 + 0.03, { c: 0xff352e });
  else for (const s of [-1, 1]) B(lightParts, 0.44, 0.15, 0.06, s * (W / 2 - 0.36), 0.88, L / 2 + 0.03, { c: 0xff352e });
  const lights = new THREE.Mesh(mergeParts(lightParts), MAT.vcBasic); lights.name = 'lights'; g.add(lights);
  const shadow = blobShadow(blobCarGeo, W * 0.88, L * 0.6); shadow.name = 'contactShadow'; g.add(shadow);
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
    bar.position.y = 1.76; g.add(bar); g.userData.lightbar = bar;
    // red/blue light spill on the road under the cruiser
    const spill = new THREE.Mesh(new THREE.CircleGeometry(3.4, 18),
      new THREE.MeshBasicMaterial({ color: 0x8855ff, transparent: true, opacity: 0.16, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.y = 0.16; g.add(spill);
  }
  const wheels = [];
  const wheelNames = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'];
  [[-W / 2, -L / 2 + 0.9], [W / 2, -L / 2 + 0.9], [-W / 2, L / 2 - 0.9], [W / 2, L / 2 - 0.9]].forEach(([wx, wz], i) => {
    const w = new THREE.Mesh(wheelGeo, MAT.vc);
    w.name = wheelNames[i]; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  });
  g.userData.wheels = wheels;
  g.userData.paint = paint;
  g.userData.body = body;
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
