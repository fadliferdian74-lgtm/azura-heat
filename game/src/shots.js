// AZURA HEAT — screenshot scenes behind ?shot=cover|chase|mission|beach.
// Each scene poses the real game state deterministically (same seed, same
// frame): the simulation is frozen, but the HUD, minimap, dialogue and world
// are the live ones. main.js renders a few dozen frames, then sets
// window.__shotReady so the capture tool knows the frame is composed.
import * as THREE from 'three';
import { PLACES } from './config.js';
import { spawnEnemy } from './combat.js';
import { scarePeds } from './pedestrians.js';

function putCar(G, car, x, z, heading, speed = 0) {
  car.x = x; car.z = z; car.heading = heading; car.speed = speed;
  car.mesh.position.set(x, 0, z); car.mesh.rotation.y = heading;
}
function putPlayerCar(G, car) {
  G.player.inCar = car; car.isPlayer = true;
  G.player.mesh.visible = false;
  G.player.x = car.x; G.player.z = car.z;
}
function activateCop(G, i, x, z, heading) {
  const cop = G.police.units[i];
  cop.active = true; cop.x = x; cop.z = z; cop.heading = heading; cop.mesh.visible = true;
  cop.mesh.position.set(x, 0, z); cop.mesh.rotation.y = heading;
  return cop;
}

export function poseShot(name, G) {
  G.shotMode = true;
  G.mode = 'play';
  G.hud.els.startEl.style.display = 'none';
  const P = G.player;

  if (name === 'chase') {
    const car = G.spawnParked(0, 6, 88, 0); // red Comet on the central avenue
    putPlayerCar(G, car); car.speed = 34;
    G.wanted.level = 5; G.wanted.heat = 5;
    activateCop(G, 0, -13, 78, 0.15); activateCop(G, 1, 3, 44, 0);
    activateCop(G, 2, 14, 66, 0.3); activateCop(G, 3, -12, 60, -0.2);
    activateCop(G, 4, 2, 118, 0);
    // Roadblock ahead of the player.
    G.police.blocks.forEach((b, i) => {
      b.active = true; b.mesh.visible = true;
      b.x = -6 + i * 3.1; b.z = 55; b.mesh.position.set(b.x, 0, b.z); b.mesh.rotation.y = Math.PI / 2;
    });
    G.police.heli.visible = true; G.police.cone.visible = false; // the light pool alone reads cleaner
    G.police.heli.position.set(12, 20, 62);
    G.objectiveOverride = 'Escape the Port Azura PD — lose the heat!';
    G.camera.fov = 72; G.camera.updateProjectionMatrix();
    G.rig.yaw = 0; G.rig.pitch = 0.3; G.rig.dist = 11;
    return;
  }

  if (name === 'mission') {
    P.x = 192; P.z = -224; P.heading = -0.15; P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.heading;
    P.gunDrawn = true; P.mesh.userData.gun.visible = true;
    spawnEnemy(G.combat, 186, -236); spawnEnemy(G.combat, 203, -234); spawnEnemy(G.combat, 196, -243);
    for (const e of G.combat.enemies) { e.mesh.position.set(e.x, 0, e.z); e.mesh.rotation.y = Math.atan2(-(P.x - e.x), -(P.z - e.z)); }
    // A live tracer + muzzle flash from Dario's pistol toward the first man.
    const origin = new THREE.Vector3(P.x, 1.55, P.z);
    const target = new THREE.Vector3(187, 1.3, -235);
    const dir = target.clone().sub(origin).normalize();
    G.combat.cooldown = 0;
    G.playerShootAt(origin, dir);
    scarePeds(G.peds, P.x, P.z, 40);
    G.hud.showDialogue([['Primo Almeida', 'The ledger is in the terminal office, Dario. His men are between you and it.'], ['Dario Venn', 'Then they picked the wrong dock to die on.']]);
    G.objectiveOverride = "Dockside Diplomacy — clear out Halden's men (3 left)";
    G.wanted.level = 1; G.wanted.heat = 1;
    G.rig.yaw = P.heading + 0.35; G.rig.pitch = 0.24; G.rig.dist = 7.5;
    return;
  }

  if (name === 'beach') {
    const car = G.spawnParked(4, 9, 236, 0.5); // teal convertible
    P.x = 16; P.z = 243; P.heading = -Math.PI / 2 + 0.4;
    P.mesh.position.set(P.x, 0, P.z); P.mesh.rotation.y = P.heading;
    // Strollers on the strip, frozen mid-walk.
    const stroll = [[4, 250, 2.6], [26, 233, -0.6], [7, 230, 1.2]];
    G.peds.peds.forEach((ped, i) => {
      if (!stroll[i]) return;
      ped.x = stroll[i][0]; ped.z = stroll[i][1]; ped.heading = stroll[i][2];
      ped.mesh.position.set(ped.x, 0, ped.z); ped.mesh.rotation.y = ped.heading;
    });
    G.promptOverride = 'Press E to enter the convertible';
    G.objectiveOverride = 'Free roam — press M for the next mission: First Wheels';
    G.rig.yaw = 1.85; G.rig.pitch = 0.2; G.rig.dist = 8;
    void car;
    return;
  }

  // cover (default): downtown drive at golden hour, 2 stars, mission active.
  const car = G.spawnParked(1, 4, 58, 0); // yellow Comet
  putPlayerCar(G, car); car.speed = 18;
  G.wanted.level = 2; G.wanted.heat = 2;
  activateCop(G, 0, 10, 63, 0.12); // interceptor close behind, in frame
  // Ambient traffic posed around the player for a living street.
  const t = G.traffic.cars;
  if (t[0]) putCar(G, t[0], -4, 30, Math.PI);
  if (t[1]) putCar(G, t[1], 4, -6, 0);
  if (t[2]) putCar(G, t[2], -5, 84, Math.PI);
  G.objectiveOverride = "First Wheels — deliver the car to Primo's Chop Shop";
  G.markerOverride = { x: PLACES.chopShop.x, z: PLACES.chopShop.z };
  G.rig.yaw = 0; G.rig.pitch = 0.3; G.rig.dist = 13;
}
