// main.js — AZURA HEAT boot + game loop. Assembles Port Azura from the module
// systems (city, vehicles, traffic, pedestrians, police, combat, missions,
// hud, audio, save) and runs the frame update: on foot or driving, wanted
// heat, collisions, economy zones, camera and the start/pause/end screens.
import * as THREE from 'three';
import { ISLAND_R, PLACES, clamp, dist2d, districtAt } from './config.js';
import { buildCity, resolveCollisions } from './city.js';
import { Vehicle, spawnParkedCars } from './vehicles.js';
import { Player } from './player.js';
import { spawnTraffic, pruneTraffic } from './traffic.js';
import { spawnPedestrians, scarePeds } from './pedestrians.js';
import { Wanted } from './wanted.js';
import { PoliceDirector } from './police.js';
import { Combat, FX } from './combat.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { loadSave, writeSave, clearSave, freshState } from './save.js';
import { poseShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf2a56e, 230, 1250);
// golden-hour sky dome: dusk blue up top melting through peach to a warm
// horizon glow in every direction (replaces the old flat orange backdrop)
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(1650, 28, 14),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec3 vP;',
      'void main(){',
      '  float h = normalize(vP).y;',
      '  vec3 top = vec3(0.13, 0.26, 0.52);',
      '  vec3 mid = vec3(0.97, 0.52, 0.30);',
      '  vec3 hor = vec3(1.00, 0.83, 0.55);',
      '  vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.72, h))',
      '                    : mix(hor, mid, smoothstep(-0.03, 0.22, h));',
      // warm sun glow centred on the sun disc's azimuth (west-northwest)
      '  vec3 sd = normalize(vec3(-0.82, 0.10, -0.50));',
      '  float g = pow(max(dot(normalize(vP), sd), 0.0), 18.0);',
      '  c += vec3(1.0, 0.62, 0.25) * g * 0.55;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}',
    ].join('\n'),
  }));
scene.add(skyDome);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
camera.position.set(-200, 8, -120);

// golden-hour light rig
const sun = new THREE.DirectionalLight(0xffc98a, 2.6);
sun.position.set(-260, 190, -320); scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffd9b0, 0x33506b, 1.05));
const fill = new THREE.DirectionalLight(0x7fb2ff, 0.35);
fill.position.set(200, 120, 260); scene.add(fill);
// low sun disc on the horizon, west-northwest over the water
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(64, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
sunDisc.position.set(-880, 95, -540); sunDisc.lookAt(0, 40, 0); scene.add(sunDisc);
const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(150, 24), new THREE.MeshBasicMaterial({ color: 0xffbe78, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
sunHalo.position.set(-885, 95, -545); sunHalo.lookAt(0, 40, 0); scene.add(sunHalo);

const city = buildCity(scene);

const G = {
  scene, camera, renderer,
  state: 'menu',           // menu | playing | paused | ended
  keys: {}, cash: 250, missionIndex: 0, missionTimer: 0,
  marker: null, policeSeen: false, copPositions: [],
  enemies: [], cars: [], traffic: [], peds: [],
  camYaw: 0.6, camPitch: 0.32, camDist: 10,
  aimDir: { x: 0, z: 1 }, shotMode: false, endKind: null,
  time: 0,
};
G.fx = new FX(scene);
G.wanted = new Wanted();
G.player = new Player(scene, -200, -160);
G.cars = spawnParkedCars(scene, 16);
G.traffic = spawnTraffic(scene, 11);
G.peds = spawnPedestrians(scene, 22);
G.director = new PoliceDirector(scene);
G.audio = new AudioSys();
G.hud = new HUD(G);
G.missions = new MissionManager(G);
G.combat = new Combat(G);
G.scarePeds = (x, z, r) => scarePeds(G.peds, x, z, r);
G.anyWitnessNear = r => {
  const p = G.player.pos;
  return G.peds.some(pd => dist2d(pd.x, pd.z, p.x, p.z) < r) || G.copPositions.length > 0;
};
G.allVehicles = () => [...G.cars, ...G.traffic.map(t => t.car), ...G.director.cops.map(c => c.car), ...G.director.blocks];

// objective beacon: a column of gold light at the current marker
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 60, 14, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
beacon.visible = false; scene.add(beacon);

// --- input -------------------------------------------------------------------
let mouseDown = false, pointerLocked = false;
window.addEventListener('keydown', e => {
  G.keys[e.code] = true;
  if (G.state === 'playing') {
    if (e.code === 'KeyE') tryEnterExit();
    if (e.code === 'Digit1') G.player.weapon = 'pistol';
    if (e.code === 'Digit2') G.player.weapon = 'smg';
    if (e.code === 'KeyR' && G.player.car) G.audio.cycleStation(G);
    if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
  } else if (G.state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) resumeGame();
});
window.addEventListener('keyup', e => { G.keys[e.code] = false; });
canvas.addEventListener('mousedown', e => {
  mouseDown = true; G.combat.justClicked = true; G.combat.mouseDown = true;
  if (G.state === 'playing' && !pointerLocked) canvas.requestPointerLock();
});
window.addEventListener('mouseup', () => { mouseDown = false; G.combat.mouseDown = false; });
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', e => {
  if (!pointerLocked || G.state !== 'playing') return;
  G.camYaw -= e.movementX * 0.0032;
  G.camPitch = clamp(G.camPitch + e.movementY * 0.0026, 0.04, 1.15);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- entering / exiting cars ---------------------------------------------------
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const v of G.allVehicles()) {
    const d = dist2d(G.player.x, G.player.z, v.x, v.z);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
function tryEnterExit() {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    p.car = null; car.driver = 'parked';
    p.mesh.position.set(car.x + Math.cos(car.heading) * 2.4, 0, car.z - Math.sin(car.heading) * 2.4);
    p.syncToCar();
    G.hud.setPrompt('');
    return;
  }
  const car = nearestCar(4.6);
  if (!car) return;
  const wasParked = car.driver === 'parked' || car.driver === 'mission';
  // pull a traffic driver out: the car becomes ours, the driver vanishes into the crowd
  const ti = G.traffic.findIndex(t => t.car === car);
  if (ti >= 0) G.traffic.splice(ti, 1);
  const ci = G.director.cops.findIndex(c => c.car === car);
  if (ci >= 0) { G.director.cops[ci].remove(scene); G.director.cops.splice(ci, 1); }
  if (!G.cars.includes(car)) G.cars.push(car);
  car.driver = 'player';
  p.car = car; p.syncToCar();
  if (wasParked && car.kind === 'sport') G.wanted.report('theft', G.anyWitnessNear(34));
  else if (!wasParked) G.wanted.report('theft', true);
  G.missions.onPlayerEnterCar(car);
  G.audio.blip(300, 0.08, 0.1, 'square');
}

// --- driving -------------------------------------------------------------------
let skidCooldown = 0;
function drivePlayer(dt) {
  const car = G.player.car;
  const input = {
    throttle: (G.keys['KeyW'] ? 1 : 0) + (G.keys['KeyS'] ? -1 : 0),
    steer: (G.keys['KeyA'] ? 1 : 0) + (G.keys['KeyD'] ? -1 : 0),
    brake: false, hand: !!G.keys['Space'],
    nos: !!(G.keys['ShiftLeft'] || G.keys['ShiftRight']),
  };
  const prevSpeed = car.speed;
  car.drive(dt, input, G.fx);
  // collisions with buildings/props
  let [nx, nz] = resolveCollisions(city.colliders, car.x, car.z, 2.4);
  if (nx !== car.x || nz !== car.z) {
    if (Math.abs(car.speed) > 9) { car.damage(Math.abs(car.speed) * 0.55); G.audio.crash(); G.wanted.report('collision', G.anyWitnessNear(30)); }
    car.speed *= -0.25;
    car.mesh.position.x = nx; car.mesh.position.z = nz;
  }
  keepOnIsland(car.mesh.position, 2);
  // vehicle-vs-vehicle bumps
  for (const v of G.allVehicles()) {
    if (v === car) continue;
    const d = dist2d(car.x, car.z, v.x, v.z);
    if (d < 4.3) {
      const rel = Math.abs(car.speed - v.speed) + Math.abs(car.speed) * 0.4;
      if (rel > 6) {
        v.damage(rel * 1.1); car.damage(rel * 0.4);
        G.audio.crash();
        G.wanted.report('hitCar', G.anyWitnessNear(32));
        G.missions.onRam(v, rel * 2.2);
        scarePeds(G.peds, car.x, car.z, 18);
      }
      // push the other car a little
      const push = (4.3 - d) * 0.5;
      v.mesh.position.x += (v.x - car.x) / (d || 1) * push;
      v.mesh.position.z += (v.z - car.z) / (d || 1) * push;
      v.sync();
    }
  }
  // running down a pedestrian is a serious crime (they usually dive away)
  for (const pd of G.peds) {
    if (Math.abs(car.speed) > 6 && dist2d(car.x, car.z, pd.x, pd.z) < 2.1) {
      pd.panic = 3; pd.mesh.position.x += (pd.x - car.x) * 1.4; pd.mesh.position.z += (pd.z - car.z) * 1.4;
      G.wanted.report('hitCar', true);
    }
  }
  if (car.drifting && skidCooldown <= 0) { skidCooldown = 0.4; }
  skidCooldown -= dt;
  if (car.dead) { G.player.hurt(dt * 12); }
  void prevSpeed;
}

function keepOnIsland(pos, r) {
  const d = Math.hypot(pos.x, pos.z);
  const max = ISLAND_R - 6 - r;
  if (d > max) { pos.x *= max / d; pos.z *= max / d; }
}

// --- paint shop + safehouse -----------------------------------------------------
let paintCooldown = 0;
function checkZones(dt) {
  paintCooldown -= dt;
  const p = G.player.pos;
  if (G.player.car && dist2d(p.x, p.z, PLACES.paintShop.x, PLACES.paintShop.z) < 11 && Math.abs(G.player.car.speed) < 2 && paintCooldown <= 0) {
    const cost = G.player.car.health < 99 ? 150 : 100;
    if (G.cash >= cost) {
      G.cash -= cost; paintCooldown = 3;
      G.player.car.health = 100; G.player.car.dead = false;
      const palette = [0xd64541, 0x3f7fd1, 0xf2b035, 0x53b06a, 0xb053c9, 0x16a3a3, 0xeeeeee];
      G.player.car.mesh.userData.paint.color.setHex(palette[Math.floor(Math.random() * palette.length)]);
      G.wanted.clear();
      G.hud.toast('Azura Paint & Repair: fixed, resprayed, heat gone — $' + cost);
      G.audio.pickup();
    } else G.hud.toast('Paint shop needs $' + cost + ' — you have $' + Math.floor(G.cash));
  }
  if (!G.player.car && dist2d(p.x, p.z, PLACES.safehouse.x, PLACES.safehouse.z) < 10) {
    if (writeSave(G)) { if (paintCooldown <= 0) { G.hud.toast('Game saved at the safehouse'); paintCooldown = 4; } }
  }
}

// --- game state flow --------------------------------------------------------------
function startGame(save) {
  const s = save || freshState();
  G.cash = s.cash; G.missionIndex = s.mission;
  G.player.health = 100; G.player.dead = false;
  if (G.player.car) { G.player.car = null; G.player.syncToCar(); }
  G.player.mesh.position.set(s.x, 0, s.z);
  G.wanted.clear();
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('end-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  G.state = 'playing';
  G.audio.init();
  G.missions.pointToStart();
  if (!save) {
    G.hud.dialogue('Selene', 'Welcome back to Port Azura, Dario. Your first job is marked in gold.');
    G.hud.banner('AZURA HEAT', 'Port Azura — golden hour');
  } else G.hud.toast('Welcome back, Dario');
}
function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  document.getElementById('pause-screen').style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() {
  G.state = 'playing';
  document.getElementById('pause-screen').style.display = 'none';
}
function endGame(kind) {
  G.state = 'ended'; G.endKind = kind;
  const t = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  if (kind === 'wasted') {
    t.textContent = 'WASTED'; t.style.color = '#e74c3c';
    const fine = Math.min(300, Math.floor(G.cash * 0.15));
    G.cash -= fine;
    sub.textContent = 'Azura General patched you up. Hospital bill: $' + fine + '.';
  } else {
    t.textContent = 'BUSTED'; t.style.color = '#7fb2ff';
    const fine = Math.min(400, Math.floor(G.cash * 0.2));
    G.cash -= fine;
    sub.textContent = 'The PAPD impounded your ride and fined you $' + fine + '.';
    if (G.player.car) { const c = G.player.car; G.player.car = null; c.driver = 'parked'; G.player.syncToCar(); }
  }
  if (G.missions.active) G.missions.fail(kind === 'wasted' ? 'You went down.' : 'The cops got you.');
  G.wanted.clear();
  document.getElementById('end-screen').style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
  G.audio.sting(false);
}
function respawn() {
  G.player.health = 100; G.player.dead = false;
  G.player.mesh.position.set(PLACES.hospital.x + 8, 0, PLACES.hospital.z + 8);
  document.getElementById('end-screen').style.display = 'none';
  G.state = 'playing';
}

document.getElementById('btn-new').addEventListener('click', () => { clearSave(); startGame(null); });
document.getElementById('btn-continue').addEventListener('click', () => startGame(loadSave() || freshState()));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  document.getElementById('pause-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  G.state = 'menu';
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
if (!loadSave()) document.getElementById('btn-continue').style.opacity = 0.45;

// --- per-frame update --------------------------------------------------------------
const clock = new THREE.Clock();
let promptCheck = 0;
let lastDistrict = '';
// announce each district the first time the player rolls into it
function checkDistrict() {
  const p = G.player.pos;
  const d = districtAt(p.x, p.z);
  if (d !== lastDistrict) {
    if (lastDistrict) G.hud.toast('— ' + d + ' —');
    lastDistrict = d;
  }
}

function updateCamera(dt) {
  if (G.shotMode && G.shotCamPos) {
    camera.position.set(G.shotCamPos.x, G.shotCamPos.y, G.shotCamPos.z);
    camera.lookAt(G.shotCamLook.x, G.shotCamLook.y, G.shotCamLook.z);
    return;
  }
  const target = G.player.pos;
  const dist = G.player.car ? 12.5 : 8.5;
  const cx = target.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cz = target.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * dist;
  const cy = target.y + 2 + Math.sin(G.camPitch) * dist;
  camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 7);
  camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 7);
  camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 7);
  camera.lookAt(target.x, target.y + 1.6, target.z);
  // aim direction = from player toward camera forward on the ground plane
  G.aimDir = { x: -Math.sin(G.camYaw), z: -Math.cos(G.camYaw) };
  if (!G.player.car) G.player.aiming = mouseDown;
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  G.time += dt;
  city.update(dt);
  if (G.state === 'playing' && G.shotMode) {
    // screenshot staging: the posed scene is frozen exactly as arranged in
    // shots.js — only the HUD (stars, minimap, dialogue timers) animates.
    if (G.marker) {
      beacon.visible = true;
      beacon.position.set(G.marker.x, 30, G.marker.z);
      beacon.material.opacity = 0.3 + Math.sin(G.time * 3) * 0.12;
    } else beacon.visible = false;
    G.hud.update(dt);
  } else if (G.state === 'playing') {
    // player locomotion
    if (G.player.car) drivePlayer(dt);
    else {
      G.player.move(dt, G.keys, G.camYaw);
      let [nx, nz] = resolveCollisions(city.colliders, G.player.x, G.player.z, 0.7);
      G.player.mesh.position.x = nx; G.player.mesh.position.z = nz;
      keepOnIsland(G.player.mesh.position, 1);
    }
    G.player.heal(dt);
    // world actors
    const obstacles = [...G.allVehicles(), { x: G.player.pos.x, z: G.player.pos.z, speed: 0 }];
    for (const t of G.traffic) t.update(dt, obstacles);
    pruneTraffic(scene, G.traffic);
    const threats = G.allVehicles().map(v => ({ x: v.x, z: v.z, speed: Math.abs(v.speed) }));
    for (const pd of G.peds) pd.update(dt, threats);
    for (const e of G.enemies) e.update(dt, G);
    G.director.update(dt, G);
    // wanted bookkeeping
    const pSpeed = G.player.car ? Math.abs(G.player.car.speed) : G.player.speedNow;
    G.wanted.update(dt, G.policeSeen, pSpeed);
    if (G.wanted.busted) endGame('busted');
    if (G.player.dead) endGame('wasted');
    // combat + missions + zones
    G.combat.tryShoot(dt);
    G.missions.update(dt);
    if (!G.missions.active) G.missions.tryStart();
    checkZones(dt);
    checkDistrict();
    // interaction prompt
    promptCheck -= dt;
    if (promptCheck <= 0) {
      promptCheck = 0.15;
      if (G.player.car) G.hud.setPrompt('');
      else {
        const near = nearestCar(4.6);
        const p = G.player.pos;
        if (near) G.hud.setPrompt('Press E to enter ' + (near.kind === 'sport' ? 'the sports car' : 'the car'));
        else if (dist2d(p.x, p.z, PLACES.safehouse.x, PLACES.safehouse.z) < 10) G.hud.setPrompt('Safehouse — game saved');
        else if (dist2d(p.x, p.z, PLACES.paintShop.x, PLACES.paintShop.z) < 11) G.hud.setPrompt('Azura Paint & Repair — drive in to repair + respray');
        else G.hud.setPrompt('');
      }
    }
    // marker beacon follows the objective
    if (G.marker) {
      beacon.visible = true;
      beacon.position.set(G.marker.x, 30, G.marker.z);
      beacon.material.opacity = 0.3 + Math.sin(G.time * 3) * 0.12;
    } else beacon.visible = false;
    G.hud.update(dt);
  }
  G.fx.update(dt);
  G.audio.update(dt, G);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// screenshot mode: ?shot=<scene> boots straight into a posed scene
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  G.cash = 1450;
  G.hud.setObjective('');
  poseShot(G, shotName);
  G.hud.update(0.1);
}
frame();
