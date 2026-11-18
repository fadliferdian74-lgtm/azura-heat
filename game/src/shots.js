// shots.js — deterministic screenshot scenes for ?shot=<name>&seed=1.
// Each pose arranges cars, cops, HUD state and the camera, then flags
// window.__shotReady so the capture tool knows the frame is composed.
import { Vehicle } from './vehicles.js';
import { Enemy } from './combat.js';

function placePlayerCar(G, x, z, heading, color = 0xd64541, kind = 'sport') {
  const car = new Vehicle(G.scene, x, z, heading, color, kind);
  car.driver = 'player'; G.cars.push(car);
  G.player.car = car; G.player.mesh.visible = false;
  return car;
}
function addCop(G, x, z, heading) {
  const cop = new Vehicle(G.scene, x, z, heading, 0xf4f6f8, 'police');
  cop.driver = 'police'; G.cars.push(cop);
  G.copPositions.push({ x, z });
  return cop;
}

export function poseShot(G, name) {
  G.state = 'playing';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  if (name === 'cover') {
    const car = placePlayerCar(G, 6, 40, Math.PI, 0xd64541, 'sport');
    car.speed = 18;
    addCop(G, 10, 74, Math.PI);
    G.wanted.level = 2;
    G.missionIndex = 0;
    G.hud.setObjective('First Wheels — steal the sports car, deliver it to Primo');
    G.marker = { x: -70, z: -238 };
    G.camYaw = Math.PI; G.camDist = 13; G.camPitch = 0.24;
    G.shotCamPos = { x: 16, y: 5.5, z: 62 };
    G.shotCamLook = { x: 0, y: 1.5, z: 20 };
  } else if (name === 'chase') {
    const car = placePlayerCar(G, 0, -20, 0, 0x3f7fd1, 'sport');
    car.speed = 24;
    addCop(G, -7, 8, 0); addCop(G, 8, 14, 0); addCop(G, -3, 30, 0.2);
    for (const off of [-5, 5]) { // roadblock ahead
      const b = new Vehicle(G.scene, off, -78, Math.PI / 2, 0xf4f6f8, 'police');
      b.driver = 'roadblock'; G.cars.push(b);
    }
    G.director.heli.setActive(true, 0, -20);
    G.director.heli.update(0.5, { x: 0, z: -20 });
    G.wanted.level = 5;
    G.hud.setObjective('Lose the heat!');
    G.shotCamPos = { x: 13, y: 6, z: 8 };
    G.shotCamLook = { x: 0, y: 1.5, z: -30 };
  } else if (name === 'mission') {
    G.player.mesh.position.set(-14, 0, 238);
    G.player.heading = Math.PI * 0.8;
    G.player.mesh.rotation.y = G.player.heading;
    G.player.aiming = true;
    const e1 = new Enemy(G.scene, 6, 256); const e2 = new Enemy(G.scene, -4, 262);
    G.enemies.push(e1, e2);
    G.fx.tracer(-13.4, 1.45, 238.6, 4, 1.2, 254, 0xffe08a);
    G.fx.spark(4, 1.2, 254);
    G.hud.dialogue('Selene', "Halden's men hold the docks. Take the ledger.");
    G.hud.setObjective("Dockside Diplomacy — clear out Halden's men");
    G.marker = { x: 0, z: 252 };
    G.shotCamPos = { x: -22, y: 4.5, z: 224 };
    G.shotCamLook = { x: 2, y: 2, z: 256 };
  } else if (name === 'beach') {
    G.player.mesh.position.set(-58, 0, -252);
    G.player.heading = 2.4; G.player.mesh.rotation.y = 2.4;
    const conv = new Vehicle(G.scene, -48, -246, 2.2, 0xf2b035, 'convertible');
    conv.driver = 'parked'; G.cars.push(conv);
    G.hud.setPrompt('Press E to enter the convertible');
    G.hud.setObjective('Free roam — the beach strip, Port Azura');
    G.shotCamPos = { x: -72, y: 4, z: -232 };
    G.shotCamLook = { x: -50, y: 1.5, z: -250 };
  }
  G.shotMode = true;
  // let a couple of frames render with the posed camera before flagging ready
  let frames = 0;
  const iv = setInterval(() => {
    if (++frames >= 6) { clearInterval(iv); window.__shotReady = true; }
  }, 90);
}

// The four scene names the screenshot pipeline knows about.
export const SHOT_SCENES = ['cover', 'chase', 'mission', 'beach'];
