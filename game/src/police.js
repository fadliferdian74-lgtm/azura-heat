// AZURA HEAT — Port Azura PD: interceptor cars that hunt on the road grid and
// cut corners off it, roadblocks from three stars, and — from four stars — a
// police helicopter whose searchlight pins the player to the map.
import * as THREE from 'three';
import { ROADS, ISLAND, WANTED, clamp, dist2d } from './config.js';
import { buildPoliceMesh, stepCar, steerToward, headingTo } from './vehicles.js';
import { copsWanted } from './wanted.js';

function makeCopCar(scene) {
  const mesh = buildPoliceMesh(); scene.add(mesh);
  return { mesh, x: 0, z: 0, heading: 0, speed: 0, steerVis: 0, health: 100, radius: 2.2, style: { top: 49 }, nos: 100, active: false, smoke: null, smokeT: 0 };
}

export function createPolice(scene) {
  const units = [];
  for (let i = 0; i < 8; i++) units.push(makeCopCar(scene));
  // Helicopter: body, tail, spinning rotors and a real spotlight.
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x14406e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.2), bodyMat); heli.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat); tail.position.set(0, 0.3, 4.4); heli.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.25; heli.add(rotor);
  const skid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 3.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  skid.position.y = -1.15; heli.add(skid);
  heli.visible = false; scene.add(heli);
  const spot = new THREE.SpotLight(0xfff6cc, 0, 160, 0.32, 0.5, 0.6);
  scene.add(spot); scene.add(spot.target);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 34, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide }));
  cone.visible = false; scene.add(cone);
  // Roadblock barriers.
  const blocks = [];
  const blockMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xd8642c });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.5), blockMat); base.position.y = 0.5; b.add(base);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.3, 0.52), stripeMat); stripe.position.y = 0.62; b.add(stripe);
    b.visible = false; scene.add(b); blocks.push({ mesh: b, x: 0, z: 0, active: false });
  }
  return { units, heli, rotor, spot, cone, blocks, blockT: 0, seenPlayer: false, flashT: 0 };
}

function spawnPos(player) {
  // On a road, 70–100 units away, never inside the player's view bubble.
  const road = ROADS[Math.floor(Math.random() * ROADS.length)];
  const along = clamp(player.z + (Math.random() > 0.5 ? 80 : -80), -ISLAND + 10, ISLAND - 10);
  if (Math.random() > 0.5) return { x: road, z: along };
  return { x: clamp(player.x + (Math.random() > 0.5 ? 80 : -80), -ISLAND + 10, ISLAND - 10), z: road };
}

/**
 * Drive the whole PD response for one frame. player: {x, z, speed, inCar}.
 * Returns nothing; read police.seenPlayer for the wanted system's decay.
 */
export function updatePolice(police, wanted, player, dt, city) {
  const want = copsWanted(wanted);
  let seen = false;
  police.flashT += dt;
  const flash = Math.sin(police.flashT * 11) > 0;
  police.units.forEach((cop, i) => {
    if (i < want && !cop.active) {
      const p = spawnPos(player);
      cop.x = p.x; cop.z = p.z; cop.speed = 0; cop.health = 100; cop.active = true; cop.mesh.visible = true;
    }
    if (i >= want) { cop.active = false; cop.mesh.visible = false; return; }
    if (!cop.active) return;
    const d = dist2d(cop.x, cop.z, player.x, player.z);
    if (d < WANTED.sightRange + 22) seen = true;
    if (d > 190) { const p = spawnPos(player); cop.x = p.x; cop.z = p.z; }
    // Pursuit: aim a little ahead of the player so intercepts actually happen.
    const lead = clamp(d / 30, 0, 1.4);
    const tx = player.x - Math.sin(player.heading || 0) * (player.speed || 0) * lead * 0.4;
    const tz = player.z - Math.cos(player.heading || 0) * (player.speed || 0) * lead * 0.4;
    const target = headingTo(cop.x, cop.z, tx, tz);
    const off = steerToward(cop, target, dt, 2.6);
    const throttle = off > 2.2 ? -0.6 : 1;
    stepCar(cop, { throttle, steer: 0, handbrake: off > 1.2 && d < 12, nos: d > 55 }, dt);
    if (cop.speed > 49) cop.speed = 49;
    const fixed = city.collide(cop.x, cop.z, cop.radius);
    if (city.hitsCollider(cop.x, cop.z, cop.radius)) cop.speed *= 0.55;
    cop.x = fixed.x; cop.z = fixed.z;
    cop.mesh.position.set(cop.x, 0, cop.z); cop.mesh.rotation.y = cop.heading;
    // Light bar strobes.
    const lb = cop.mesh.userData.lightBar;
    if (lb) { lb.red.material.emissiveIntensity = flash ? 2.4 : 0.15; lb.blue.material.emissiveIntensity = flash ? 0.15 : 2.4; }
  });
  police.seenPlayer = seen;

  // Roadblocks from three stars: parked pairs across the road ahead.
  police.blockT -= dt;
  const wantBlocks = wanted.level >= 3;
  if (wantBlocks && police.blockT <= 0) {
    police.blockT = 14;
    const ahead = 55;
    const bx = player.x - Math.sin(player.heading || 0) * ahead;
    const bz = player.z - Math.cos(player.heading || 0) * ahead;
    police.blocks.forEach((b, i) => {
      b.active = true; b.mesh.visible = true;
      const side = (i - 2.5) * 3.1;
      b.x = bx + Math.cos(player.heading || 0) * side; b.z = bz - Math.sin(player.heading || 0) * side;
      b.mesh.position.set(b.x, 0, b.z); b.mesh.rotation.y = (player.heading || 0) + Math.PI / 2;
    });
  }
  if (!wantBlocks) police.blocks.forEach(b => { b.active = false; b.mesh.visible = false; });

  // Helicopter from four stars.
  const heliUp = wanted.level >= 4;
  police.heli.visible = heliUp; police.cone.visible = heliUp;
  police.spot.intensity = heliUp ? 380 : 0;
  if (heliUp) {
    const hx = player.x + Math.sin(performance.now() * 0.0004) * 16;
    const hz = player.z + Math.cos(performance.now() * 0.0004) * 16;
    police.heli.position.set(hx, 30, hz);
    police.heli.rotation.y = Math.atan2(player.x - hx, player.z - hz);
    police.rotor.rotation.y += dt * 28;
    police.spot.position.set(hx, 30, hz);
    police.spot.target.position.set(player.x, 0, player.z);
    police.cone.position.set((hx + player.x) / 2, 15, (hz + player.z) / 2);
    police.cone.lookAt(player.x, 0, player.z);
    police.cone.rotateX(Math.PI / 2);
    if (dist2d(hx, hz, player.x, player.z) < 60) police.seenPlayer = true;
  }
}
