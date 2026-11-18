// shots.js — deterministic screenshot scenes for ?shot=<name>&seed=1.
// v2 staging: every scene is composed for the contact sheet — a clear
// camera→subject corridor, the subject large in frame, pursuit/FX elements
// placed INSIDE the frustum, and extra traffic + pedestrians clustered
// around the focal point so no frame reads empty. main.js freezes the
// world in shot mode, so what is posed here is exactly what is captured.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { Enemy } from './combat.js';
import { makeHuman } from './player.js';
import { containerTexture } from './materials.js';

// staged cover crates wear the same corrugated container skin as the port
const crateMat = new THREE.MeshLambertMaterial({ map: containerTexture(), color: 0xffffff });

function car(G, x, z, heading, color, kind, driver = 'parked') {
  const v = new Vehicle(G.scene, x, z, heading, color, kind);
  v.driver = driver; G.cars.push(v);
  return v;
}
function cop(G, x, z, heading) {
  const v = car(G, x, z, heading, 0xf4f6f8, 'police', 'police');
  G.copPositions.push({ x, z });
  return v;
}
function ped(G, x, z, heading, shirt, pants = 0x2c3e50) {
  const m = makeHuman({ shirt, pants, skin: 0xc98d5a, accent: pants });
  m.position.set(x, 0, z); m.rotation.y = heading;
  G.scene.add(m);
  return m;
}
function crate(G, x, z, color, y = 2.2) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(11, 4.4, 4.6),
    crateMat.clone());
  c.material.color.setHex(color);
  c.position.set(x, y, z); G.scene.add(c);
  return c;
}
function glow(G, x, y, z, color, r = 0.4, opacity = 0.95) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, fog: false }));
  s.position.set(x, y, z); G.scene.add(s);
  return s;
}
function beam(G, x1, y1, z1, x2, y2, z2, color, opacity = 0.95) {
  const geo = new THREE.BufferGeometry().setFromPoints(
    [new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  G.scene.add(l);
  return l;
}
// translucent searchlight cone stretched between two points (apex at `from`);
// the chase scene aims one from the helicopter onto the player car
function lightCone(G, fx, fy, fz, tx, ty, tz, radius = 8.5) {
  const from = new THREE.Vector3(fx, fy, fz), to = new THREE.Vector3(tx, ty, tz);
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, len, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  cone.position.copy(from).addScaledVector(dir, 0.5);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize().negate());
  G.scene.add(cone);
  return cone;
}
// persistent NOS flames + tyre smoke for a staged car (FX-pool flames die
// in 90 ms, far too fast to guarantee they appear in the captured frame)
function boostFx(G, veh) {
  const L = veh.mesh.userData.len || 4.6;
  for (const s of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.1, 8),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0x53b6ff : 0xff9a3c, transparent: true, opacity: 0.9, fog: false }));
    flame.rotation.x = Math.PI / 2;
    flame.position.set(s * 0.55, 0.62, L / 2 + 0.95);
    veh.mesh.add(flame);
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3, depthWrite: false }));
    smoke.position.set(s * 0.95, 0.35, L / 2 + 0.75);
    veh.mesh.add(smoke);
  }
}
function aimArms(mesh) {
  const { armL, armR } = mesh.userData.limbs;
  armR.rotation.x = -1.45; armL.rotation.x = -1.2;
}

export function poseShot(G, name) {
  G.state = 'playing';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  if (name === 'cover') {
    // Hero shot on the downtown boulevard (road x=0): low camera on the
    // asphalt, red sports car angled large in frame, Dario beside it, a
    // cruiser with its lightbar on behind, traffic + peds filling the street.
    const hero = car(G, 0, 26, -0.55, 0xd64541, 'sport');
    hero.speed = 0;
    G.ringCar = hero;
    G.player.mesh.position.set(-4.4, 0, 29.8);
    G.player.heading = 0.55; G.player.mesh.rotation.y = 0.55;
    cop(G, -6.5, 3, Math.PI);
    car(G, -5.5, -17, 0, 0x3f7fd1, 'sedan', 'traffic');
    car(G, 5.5, -36, Math.PI, 0xf2b035, 'sedan', 'traffic');
    car(G, -5.5, 58, 0, 0xeeeeee, 'sedan', 'traffic');
    ped(G, 13, 34, Math.PI, 0xe67e22); ped(G, -13, 19, 0, 0x1abc9c);
    ped(G, 13, 11, Math.PI, 0xe84393); ped(G, -13, 40, 0.4, 0xf1c40f);
    ped(G, 12.5, -4, Math.PI, 0xecf0f1);
    G.wanted.level = 2;
    G.missionIndex = 0;
    G.hud.setObjective('First Wheels — steal the sports car, deliver it to Primo');
    G.marker = { x: 238, z: 238 };
    G.shotCamPos = { x: 6.5, y: 1.9, z: 34.5 };
    G.shotCamLook = { x: -0.5, y: 1.1, z: 24.5 };
  } else if (name === 'chase') {
    // Pursuit down the same boulevard: camera low behind the player car,
    // two cruisers flanking IN FRAME, a roadblock readable ahead, the
    // helicopter up-frame with its searchlight cone on the player car.
    const pc = car(G, 0, -20, 0, 0x3f7fd1, 'sport', 'player');
    pc.speed = 26;
    G.player.car = pc; G.player.mesh.visible = false;
    boostFx(G, pc);
    cop(G, -5.5, -10, 0.15); cop(G, 8, -16, -0.12); cop(G, 8.5, -27, 0);
    cop(G, -5, -52, Math.PI / 2); cop(G, 5, -52, -Math.PI / 2);
    car(G, 4, -42, 0, 0xe67e22, 'sedan', 'traffic');
    const heli = G.director.heli;
    heli.setActive(true, 0, -20);
    heli.mesh.visible = true;   // director is frozen in shot mode; force on
    heli.mesh.position.set(-8, 21, -46);
    heli.mesh.rotation.set(0.15, 0.46, 0);
    heli.pool.position.set(0, 0.25, -20); heli.pool.visible = true;
    if (heli.cone) heli.cone.visible = false;   // replaced by the aimed cone
    lightCone(G, -8, 19.6, -46, 0, 0.6, -20, 7);
    G.wanted.level = 5;
    G.hud.setObjective('Lose the heat!');
    G.shotCamPos = { x: 6.5, y: 5.2, z: 2 };
    G.shotCamLook = { x: -0.5, y: 1.0, z: -30 };
  } else if (name === 'mission') {
    // Dockside shootout staged in the clear x=0 road lane just south of
    // the container yard (procedural containers start at z=252 and would
    // swallow the cast): Dario foreground-left firing, four of Halden's
    // men mid-frame using staged containers as cover, cranes behind.
    G.player.mesh.position.set(1.5, 0, 224);
    G.player.heading = 0.12; G.player.mesh.rotation.y = 0.12;
    G.player.aiming = true; aimArms(G.player.mesh);
    crate(G, -10.5, 237, 0xc94f4f); crate(G, 11, 243, 0x4f7dc9);
    crate(G, 11, 243, 0x3a63a8, 6.6); crate(G, -10.5, 249, 0x4fc97d);
    crate(G, 12, 255, 0xc9b44f);
    const spots = [[-4.2, 239], [5.2, 242], [-4.5, 247], [5.6, 250]];
    for (const [ex, ez] of spots) {
      const e = new Enemy(G.scene, ex, ez);
      e.mesh.rotation.y = Math.atan2(1.5 - ex, 224 - ez);
      aimArms(e.mesh);
      G.enemies.push(e);
    }
    // persistent tracer + muzzle/impact glow so the captured instant
    // always shows live fire, plus a looping FX cycle for sparkle
    beam(G, 2.1, 1.45, 224.8, 5.0, 1.25, 241.6, 0xffe08a);
    beam(G, 2.1, 1.45, 224.8, 4.6, 1.05, 240.8, 0xffc46b, 0.6);
    beam(G, -3.9, 1.5, 238.4, 2.5, 1.1, 226.2, 0xff8844, 0.85);
    glow(G, 2.15, 1.45, 224.9, 0xffd27a, 0.42);
    glow(G, 5.0, 1.25, 241.6, 0xffaa33, 0.32);
    glow(G, -3.9, 1.5, 238.4, 0xff9950, 0.3);
    const loopFx = () => {
      G.fx.tracer(2.1, 1.45, 224.8, 5.0, 1.25, 241.6, 0xffe08a);
      G.fx.spark(5.0, 1.25, 241.6);
      G.fx.tracer(-3.9, 1.5, 238.4, 2.5, 1.1, 226.2, 0xff8844);
      G.fx.spark(1.5, 1.2, 226);
    };
    loopFx();
    setInterval(loopFx, 620);
    G.wanted.level = 1;
    G.hud.dialogue('Selene', "Halden's men hold the docks. Take the ledger.");
    G.hud.setObjective("Dockside Diplomacy — clear out Halden's men");
    G.marker = { x: 20, z: 252 };
    G.shotCamPos = { x: -6.5, y: 2.7, z: 213 };
    G.shotCamLook = { x: 2, y: 1.5, z: 240 };
  } else if (name === 'beach') {
    // Golden hour on the south shore: camera east of the subject looking
    // west along the shoreline — ocean + boats + low sun on the right,
    // boardwalk, palms, umbrellas and the vendor cart on the left.
    G.player.mesh.position.set(-40, 0, -382);
    G.player.heading = 2.09; G.player.mesh.rotation.y = 2.09;
    const conv = car(G, -46, -386, -2.0, 0xf2b035, 'convertible');
    conv.driver = 'parked';
    G.ringCar = conv;
    car(G, -16, -348, -Math.PI / 2 + 0.1, 0xeeeeee, 'sedan');
    car(G, -104, -349, Math.PI / 2, 0x53b06a, 'sedan');
    ped(G, -30, -353, -Math.PI / 2, 0xe67e22); ped(G, -64, -350, Math.PI / 2, 0xecf0f1);
    ped(G, -100, -355, -Math.PI / 2, 0x1abc9c); ped(G, -58, -392, 0.8, 0xe84393);
    ped(G, -20, -388, -2.2, 0xf1c40f); ped(G, -78, -368, 2.6, 0x00b894);
    G.hud.setPrompt('Press E to enter the convertible');
    G.hud.setObjective('Free roam — the beach strip, Port Azura');
    G.shotCamPos = { x: -24, y: 2.2, z: -388 };
    G.shotCamLook = { x: -43, y: 1.0, z: -383 };
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
