// AZURA HEAT — vehicles: stylised box-body car meshes and arcade driving physics.
// Several body styles (sport, sedan, convertible, van, police) share one builder;
// the physics is a single-heading arcade model with drift, NOS and damage smoke.
import * as THREE from 'three';
import { CAR, clamp, angleDelta } from './config.js';

export const CAR_STYLES = [
  { kind: 'sport', color: 0xe2543e, top: 50 },
  { kind: 'sport', color: 0xffc93e, top: 50 },
  { kind: 'sedan', color: 0x3e7ac2, top: 42 },
  { kind: 'sedan', color: 0xd8d8d8, top: 42 },
  { kind: 'convertible', color: 0x37b8a2, top: 44 },
  { kind: 'sedan', color: 0x7a4fa3, top: 42 },
  { kind: 'van', color: 0x8a8f96, top: 36 },
];

function box(w, h, d, color, x, y, z, parent, emissive = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: emissive ? 1 : 0 }));
  m.position.set(x, y, z); parent.add(m); return m;
}

/** Build a car mesh. Forward is -Z. Returns the group; wheels spin via userData. */
export function buildCarMesh(style, colorOverride) {
  const g = new THREE.Group();
  const color = colorOverride ?? style.color;
  const van = style.kind === 'van';
  const bodyH = van ? 1.5 : 0.72;
  box(2.1, bodyH, van ? 5.4 : 4.4, color, 0, 0.55 + bodyH / 2, 0, g);
  if (style.kind === 'sport') { box(1.9, 0.34, 1.1, color, 0, 0.78, -1.9, g); box(2.0, 0.1, 0.5, 0x222222, 0, 1.28, 2.0, g); }
  if (style.kind !== 'convertible' && !van) box(1.8, 0.62, 2.1, 0x1c2733, 0, 1.32, 0.25, g);
  if (van) box(1.9, 0.7, 0.9, 0x1c2733, 0, 1.55, -2.2, g);
  if (style.kind === 'convertible') box(1.8, 0.3, 1.6, 0x6b4a2f, 0, 1.05, 0.5, g);
  // Headlights + tail lights (emissive so they read at golden hour).
  box(0.42, 0.2, 0.08, 0xfff2b0, -0.72, 0.82, -2.21, g, 0xffe98a);
  box(0.42, 0.2, 0.08, 0xfff2b0, 0.72, 0.82, -2.21, g, 0xffe98a);
  box(0.42, 0.18, 0.08, 0xff3b30, -0.72, 0.86, 2.21, g, 0xff2a20);
  box(0.42, 0.18, 0.08, 0xff3b30, 0.72, 0.86, 2.21, g, 0xff2a20);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
  const wheels = [];
  for (const [wx, wz] of [[-1.02, -1.45], [1.02, -1.45], [-1.02, 1.45], [1.02, 1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  // NOS flame (hidden until boosting) and damage smoke anchor.
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.7, 8),
    new THREE.MeshBasicMaterial({ color: 0x54c8ff, transparent: true, opacity: 0.9 }));
  flame.rotation.x = Math.PI / 2; flame.position.set(0, 0.62, 3.0); flame.visible = false; g.add(flame);
  g.userData = { wheels, flame };
  return g;
}

/** Build the Port Azura PD interceptor: white body, livery stripe, light bar. */
export function buildPoliceMesh() {
  const g = buildCarMesh({ kind: 'sedan', color: 0xf2f3f5 });
  box(2.14, 0.3, 4.0, 0x14406e, 0, 0.86, 0, g);
  const bar = new THREE.Group();
  const red = box(0.55, 0.24, 0.5, 0xff2222, -0.3, 0, 0, bar, 0xff2222);
  const blue = box(0.55, 0.24, 0.5, 0x2255ff, 0.3, 0, 0, bar, 0x2255ff);
  bar.position.set(0, 1.78, 0.2); g.add(bar);
  g.userData.lightBar = { red, blue };
  return g;
}

/** A drivable car entity: mesh + arcade state. */
export function createCar(style, x, z, heading = 0, colorOverride) {
  const mesh = buildCarMesh(style, colorOverride);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  return {
    mesh, style, x, z, heading, speed: 0, steerVis: 0,
    health: 100, nos: 100, radius: 2.2, isPlayer: false, dead: false,
    smoke: null, smokeT: 0,
  };
}

/**
 * Advance one car by dt. input: {throttle -1..1, steer -1..1, handbrake, nos}.
 * Collisions with the city are resolved by the caller through city.collide.
 */
export function stepCar(car, input, dt) {
  const top = input.nos && car.nos > 0 ? CAR.nosMaxSpeed : (car.style.top || CAR.maxSpeed);
  if (input.throttle > 0) car.speed += CAR.accel * input.throttle * dt * (input.nos && car.nos > 0 ? 1.5 : 1);
  else if (input.throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverse) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  if (input.nos && input.throttle > 0 && car.nos > 0) car.nos = Math.max(0, car.nos - 26 * dt);
  else car.nos = Math.min(100, car.nos + 7 * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, top + (car.speed > top ? -8 * dt * 10 : 0));
  if (car.speed > top) car.speed = Math.max(top, car.speed - 22 * dt);
  const steerTarget = input.steer * CAR.steer * clamp(car.speed / 12, -1, 1) * (input.handbrake ? 1.5 : 1);
  car.heading += steerTarget * dt * (input.handbrake ? 1.35 : 1) * clamp(Math.abs(car.speed) / 10, 0, 1) * Math.sign(car.speed || 1);
  const drift = input.handbrake ? 0.86 : 0.985;
  car.x += -Math.sin(car.heading) * car.speed * dt;
  car.z += -Math.cos(car.heading) * car.speed * dt;
  car.speed *= Math.pow(drift, dt * 60 * 0.12);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.2;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  if (car.mesh.userData.wheels[0]) {
    car.steerVis = clamp(input.steer, -1, 1) * 0.45;
    car.mesh.userData.wheels[0].rotation.y = car.steerVis;
    car.mesh.userData.wheels[1].rotation.y = car.steerVis;
  }
  car.mesh.userData.flame.visible = !!(input.nos && input.throttle > 0 && car.nos > 0);
  car.mesh.userData.flame.scale.y = 0.8 + Math.random() * 0.5;
}

/** Simple circle repulsion between two cars; returns impact speed or 0. */
export function collideCars(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz), min = a.radius + b.radius;
  if (d === 0 || d >= min) return 0;
  const push = (min - d) / 2, nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
  const impact = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7; b.speed = avg * 0.7;
  a.mesh.position.set(a.x, 0, a.z); b.mesh.position.set(b.x, 0, b.z);
  return impact;
}

/** Damage smoke: a small dark sprite that puffs while the car is hurt. */
export function updateSmoke(scene, car, dt) {
  car.smokeT -= dt;
  if (car.health < 45 && car.smokeT <= 0) {
    car.smokeT = 0.12;
    if (!car.smoke) {
      car.smoke = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.55 }));
      scene.add(car.smoke);
    }
    car.smoke.visible = true;
    car.smoke.position.set(car.x + (Math.random() - 0.5), 1.6 + Math.random() * 0.4, car.z + (Math.random() - 0.5));
    car.smoke.scale.setScalar(0.7 + Math.random() * (45 - car.health) / 22);
  } else if (car.smoke) car.smoke.visible = car.health < 45;
}

export function headingTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}
export function steerToward(car, targetHeading, dt, sharp = 3.2) {
  const d = angleDelta(car.heading, targetHeading);
  car.heading += clamp(d, -sharp * dt, sharp * dt);
  return Math.abs(d);
}
