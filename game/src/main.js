// AZURA HEAT — boot and the game loop. Wires every system together: the city,
// Dario on foot and behind the wheel, traffic, pedestrians, the Port Azura PD,
// combat, the eight-mission story, the economy, radio and saves. Modes:
// menu, play, pause, end (wasted/busted) — plus a frozen shot mode used by
// ?shot=<scene> to compose the store screenshots.
import * as THREE from 'three';
import { PLACES, PLAYER, WANTED, clamp, angleDelta, dist2d } from './config.js';
import { createCity } from './city.js';
import { createPlayer, stepPlayer, damagePlayer, createCameraRig, updateCamera, setGunDrawn } from './player.js';
import { CAR_STYLES, createCar, stepCar, collideCars, updateSmoke, steerToward, headingTo } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians, scarePeds } from './pedestrians.js';
import { createWanted, reportCrime, updateWanted, clearWanted } from './wanted.js';
import { createPolice, updatePolice } from './police.js';
import { createCombat, playerShoot, updateCombat, enemiesAlive } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { poseShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const city = createCity(scene);
const player = createPlayer(scene);
const traffic = createTraffic(scene, 14);
const peds = createPedestrians(scene, 26);
const police = createPolice(scene);
const combat = createCombat(scene);
const wanted = createWanted();
const hud = createHud();
const audio = createAudio();
const missions = createMissions();
const rig = createCameraRig();
const markerMesh = city.makeMarker();
const markerMesh2 = city.makeMarker(0x54c8ff);

const G = {
  mode: 'menu', cash: 250, time: 0, shotMode: false, shotName,
  player, wanted, police, combat, peds, hud, rig, camera, traffic,
  objectiveOverride: null, markerOverride: null, promptOverride: null,
  timerText: '', vanDriver: null, race: null, betweenT: 2,
  spawnParked(styleIdx, x, z, heading) {
    const car = createCar(CAR_STYLES[styleIdx % CAR_STYLES.length], x, z, heading);
    scene.add(car.mesh); parkedCars.push(car); return car;
  },
  playerShootAt(origin, dir) {
    return playerShoot(combat, origin, dir, player.weapon, combatWorld());
  },
};
function combatWorld() {
  return { policeUnits: police.units, trafficCars: traffic.cars, peds: peds.peds };
}

// Parked, enterable cars dotted around the city (deterministic spots).
const parkedCars = [];
const PARKED_SPOTS = [
  [1, 30, 246, -Math.PI / 2], [2, -30, 120, 0], [3, 88, -30, Math.PI / 2], [5, -88, 30, -Math.PI / 2],
  [0, 170, 88, 0], [2, -170, -88, Math.PI], [4, 40, -170, Math.PI / 2], [3, -40, 170, 0],
  [1, 236, 30, -Math.PI / 2], [5, -236, -30, Math.PI / 2],
];
for (const [style, x, z, h] of PARKED_SPOTS) G.spawnParked(style, x, z, h);

function removeCar(car) {
  const i = parkedCars.indexOf(car);
  if (i >= 0) parkedCars.splice(i, 1);
  scene.remove(car.mesh);
  if (player.inCar === car) exitCar(true);
}
function spawnMissionCar(style, x, z, heading) {
  const car = createCar(style, x, z, heading);
  scene.add(car.mesh); parkedCars.push(car); return car;
}

// ---- mission context: everything missions.js is allowed to touch ----------
const ctx = {
  player, wanted, combat, hud,
  dialogue: lines => hud.showDialogue(lines),
  sfx: name => { if (audio[name]) audio[name](); },
  crime: kind => reportCrime(wanted, kind, witnessed(), G.time),
  setTimer: sec => { G.timerText = sec > 0 ? Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0') : ''; },
  enemiesLeft: () => enemiesAlive(combat),
  spawnCar: spawnMissionCar,
  removeCar,
  get vanDriver() { return G.vanDriver; }, set vanDriver(v) { G.vanDriver = v; },
  raceSetup(route) {
    const racers = [];
    for (let i = 0; i < 2; i++) {
      const car = spawnMissionCar(CAR_STYLES[i === 0 ? 3 : 5], -14 + i * 7, 252, 0);
      racers.push({ car, cp: 0, finished: false });
    }
    G.race = { route, racers, playerCp: 0 };
  },
  racePosition() {
    if (!G.race) return 1;
    const score = (cp, x, z) => {
      const t = G.race.route[Math.min(cp, G.race.route.length - 1)];
      return cp * 10000 - dist2d(x, z, t[0], t[1]);
    };
    const mine = score(G.race.playerCp, player.x, player.z);
    let pos = 1;
    for (const r of G.race.racers) if (score(r.cp, r.car.x, r.car.z) > mine) pos++;
    return pos;
  },
  raceAiFinished() { return !!(G.race && G.race.racers.some(r => r.finished)); },
  raceTeardown() {
    if (!G.race) return;
    for (const r of G.race.racers) if (r.car !== player.inCar) removeCar(r.car);
    G.race = null;
  },
};
function witnessed() {
  if (police.units.some(c => c.active && dist2d(c.x, c.z, player.x, player.z) < 55)) return true;
  return peds.peds.some(p => dist2d(p.x, p.z, player.x, player.z) < 26);
}

// ---- input -----------------------------------------------------------------
const keys = {};
let mouseDown = false;
window.addEventListener('keydown', e => {
  if (e.repeat) return; keys[e.code] = true;
  if (G.mode === 'play') {
    if (e.code === 'KeyE') tryInteract();
    if (e.code === 'Digit1') { player.weapon = 'pistol'; setGunDrawn(player, true); }
    if (e.code === 'Digit2') { player.weapon = 'smg'; setGunDrawn(player, true); }
    if (e.code === 'KeyR' && player.inCar) hud.flashRadio(audio.cycleStation());
    if (e.code === 'KeyM' && !missions.state && !missions.done) missions.start(ctx);
    if (e.code === 'KeyF') tryPaint();
    if (e.code === 'KeyP' || e.code === 'Escape') setMode('pause');
  } else if (G.mode === 'pause' && (e.code === 'KeyP' || e.code === 'Escape')) setMode('play');
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('mousedown', e => {
  audio.ensure();
  if (G.mode !== 'play') return;
  mouseDown = true;
  if (!player.inCar && e.button === 0) tryShoot();
  if (canvas.requestPointerLock && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch { /* headless */ } }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || G.mode !== 'play') return;
  rig.yaw -= e.movementX * 0.0032;
  rig.pitch = clamp(rig.pitch + e.movementY * 0.0024, 0.03, 1.15);
});

function tryShoot() {
  if (!player.gunDrawn) setGunDrawn(player, true);
  const origin = new THREE.Vector3(player.x, 1.55, player.z);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = G.playerShootAt(origin, dir);
  audio.shot(player.weapon === 'smg');
  reportCrime(wanted, 'shotFired', witnessed(), G.time);
  scarePeds(peds, player.x, player.z, 18);
  if (hit === 'enemy') reportCrime(wanted, 'killEnemy', witnessed(), G.time);
  if (hit === 'cop') reportCrime(wanted, 'hitCop', true, G.time);
  if (hit === 'ped') reportCrime(wanted, 'hitPed', witnessed(), G.time);
}

function nearestEnterableCar() {
  let best = null, bestD = 4.4;
  for (const car of [...parkedCars, ...traffic.cars]) {
    const d = dist2d(car.x, car.z, player.x, player.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
function tryInteract() {
  if (player.inCar) { exitCar(false); return; }
  const car = nearestEnterableCar();
  if (!car) return;
  const ti = traffic.cars.indexOf(car);
  if (ti >= 0) { traffic.cars.splice(ti, 1); parkedCars.push(car); reportCrime(wanted, 'theft', witnessed(), G.time); }
  player.inCar = car; car.isPlayer = true;
  player.mesh.visible = false;
  audio.startRadio(); hud.flashRadio(audio.stationName());
}
function exitCar(silent) {
  const car = player.inCar; if (!car) return;
  player.inCar = null; car.isPlayer = false;
  player.x = car.x + Math.cos(car.heading) * 2.6; player.z = car.z - Math.sin(car.heading) * 2.6;
  const fixed = city.collide(player.x, player.z, player.radius);
  player.x = fixed.x; player.z = fixed.z;
  player.mesh.visible = true;
  audio.stopRadio(); audio.setEngine(false, 0, false);
  if (!silent) audio.click();
}
function tryPaint() {
  const car = player.inCar; if (!car) return;
  if (dist2d(car.x, car.z, PLACES.paintShop.x, PLACES.paintShop.z) > 10) return;
  if (G.cash < 150) { hud.showBanner('NOT ENOUGH CASH', 'Azura Paint & Body charges $150', 2); return; }
  G.cash -= 150; car.health = 100;
  const colors = [0xe2543e, 0xffc93e, 0x3e7ac2, 0x37b8a2, 0x7a4fa3, 0xf2f2f2, 0x22262e];
  car.mesh.children[0].material.color.set(colors[Math.floor(Math.random() * colors.length)]);
  audio.cash(); hud.showBanner('RESPRAYED', 'Azura Paint & Body — good as new', 2);
}

// ---- modes -------------------------------------------------------------------
function setMode(mode) {
  G.mode = mode;
  hud.els.startEl.classList.toggle('show', mode === 'menu');
  hud.els.pauseEl.classList.toggle('show', mode === 'pause');
  hud.els.endEl.classList.toggle('show', mode === 'end');
  if (document.pointerLockElement && mode !== 'play') document.exitPointerLock();
}
hud.els.newBtn.addEventListener('click', () => { audio.ensure(); clearSave(); resetStory(true); setMode('play'); });
hud.els.contBtn.addEventListener('click', () => { audio.ensure(); resetStory(false); setMode('play'); });
hud.els.resumeBtn.addEventListener('click', () => setMode('play'));
hud.els.restartBtn.addEventListener('click', () => { clearSave(); resetStory(true); setMode('play'); });
hud.els.endBtn.addEventListener('click', () => { respawn(); setMode('play'); });
hud.els.contBtn.style.display = loadSave() ? '' : 'none';

function resetStory(fresh) {
  const save = fresh ? null : loadSave();
  G.cash = save ? save.cash : 250;
  missions.index = save ? Math.min(save.mission, missions.total) : 0;
  missions.state = null; missions.active = null;
  clearWanted(wanted);
  player.health = PLAYER.maxHealth; player.dead = false;
  if (player.inCar) exitCar(true);
  player.x = save && save.x !== undefined ? save.x : PLAYER.start.x;
  player.z = save && save.z !== undefined ? save.z : PLAYER.start.z;
  G.betweenT = 1.2;
  hud.showDialogue([['Selene Marchetti', 'Dario Venn, back in Port Azura. I have work lined up — check your map and keep the PD bored.']]);
}
function saveGame() {
  writeSave({ cash: Math.floor(G.cash), mission: missions.index, x: Math.round(player.x), z: Math.round(player.z) });
}
function endRun(kind) {
  setMode('end');
  hud.els.endTitle.textContent = kind === 'wasted' ? 'WASTED' : 'BUSTED';
  hud.els.endTitle.style.color = kind === 'wasted' ? '#e2543e' : '#54a8ff';
  hud.els.endSub.textContent = kind === 'wasted'
    ? 'You wake up at Port Azura General. The city keeps your money as a tip.'
    : 'Port Azura PD walks you out of the safehouse. Fines are not optional.';
  audio.sting(false);
  if (document.pointerLockElement) document.exitPointerLock();
}
function respawn() {
  const wastedRun = hud.els.endTitle.textContent === 'WASTED';
  const spot = wastedRun ? PLACES.hospital : PLACES.safehouse;
  const fine = Math.max(25, Math.floor(G.cash * 0.1));
  G.cash = Math.max(0, G.cash - fine);
  if (player.inCar) exitCar(true);
  player.x = spot.x; player.z = spot.z; player.health = PLAYER.maxHealth; player.dead = false;
  clearWanted(wanted);
  hud.showBanner(wastedRun ? 'DISCHARGED' : 'RELEASED', `-$${fine} in fines and fees`, 2.6);
}

// ---- AI drivers for missions: racers and the convoy van ----------------------
const VAN_LOOP = [[160, -160], [168, 80], [-80, 168], [-168, -80]];
let vanWp = 0;
function driveAiCar(car, tx, tz, cruise, dt) {
  const target = headingTo(car.x, car.z, tx, tz);
  const off = steerToward(car, target, dt, 2.4);
  stepCar(car, { throttle: off > 2.0 ? -0.5 : (car.speed < cruise ? 1 : 0), steer: 0, handbrake: false, nos: false }, dt);
  const fixed = city.collide(car.x, car.z, car.radius);
  car.x = fixed.x; car.z = fixed.z;
  car.mesh.position.set(car.x, 0, car.z);
}
function updateRace(dt) {
  if (!G.race) return;
  const route = G.race.route;
  // Mirror the player's checkpoint progress for the position readout.
  const pc = route[Math.min(G.race.playerCp, route.length - 1)];
  if (player.inCar && pc && dist2d(player.inCar.x, player.inCar.z, pc[0], pc[1]) < 13) G.race.playerCp++;
  for (const r of G.race.racers) {
    if (r.finished) continue;
    const t = route[r.cp];
    if (!t) { r.finished = true; continue; }
    driveAiCar(r.car, t[0], t[1], 21, dt);
    if (dist2d(r.car.x, r.car.z, t[0], t[1]) < 13) { r.cp++; if (r.cp >= route.length) r.finished = true; }
  }
}
function updateVan(dt) {
  const van = G.vanDriver;
  if (!van) return;
  if (van.health <= 0) { van.speed = Math.max(0, van.speed - 20 * dt); van.mesh.position.set(van.x, 0, van.z); return; }
  const t = VAN_LOOP[vanWp];
  driveAiCar(van, t[0], t[1], 15, dt);
  if (dist2d(van.x, van.z, t[0], t[1]) < 14) vanWp = (vanWp + 1) % VAN_LOOP.length;
}

// ---- per-frame simulation ------------------------------------------------------
let savePromptT = 0;
function updatePlay(dt) {
  G.time += dt;
  const driving = !!player.inCar;
  // Movement.
  if (driving) {
    const car = player.inCar;
    const input = {
      throttle: (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -1 : 0),
      steer: (keys.KeyA || keys.ArrowLeft ? 1 : 0) + (keys.KeyD || keys.ArrowRight ? -1 : 0),
      handbrake: !!keys.Space, nos: !!(keys.ShiftLeft || keys.ShiftRight),
    };
    const preX = car.x, preZ = car.z, preSpeed = car.speed;
    stepCar(car, input, dt);
    if (city.hitsCollider(car.x, car.z, car.radius)) {
      const impact = Math.abs(preSpeed);
      if (impact > 9) { car.health -= impact * 0.8; damagePlayer(player, impact * 0.22); audio.crash(); scarePeds(peds, car.x, car.z, 14); }
      const fixed = city.collide(car.x, car.z, car.radius);
      car.x = fixed.x; car.z = fixed.z; car.speed = -preSpeed * 0.18;
      car.mesh.position.set(car.x, 0, car.z);
      void preX; void preZ;
    }
    player.x = car.x; player.z = car.z; player.heading = car.heading; player.speedNow = car.speed;
    rig.yaw += angleDelta(rig.yaw, car.heading) * Math.min(1, dt * 5);
    rig.pitch += (0.3 - rig.pitch) * Math.min(1, dt * 3);
    rig.dist += (10.5 - rig.dist) * Math.min(1, dt * 3);
    audio.setEngine(true, car.speed / 50, input.nos);
    if (input.handbrake && Math.abs(car.speed) > 12) audio.skid();
  } else {
    const sin = Math.sin(rig.yaw), cos = Math.cos(rig.yaw);
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -1 : 0);
    const str = (keys.KeyD || keys.ArrowRight ? 1 : 0) + (keys.KeyA || keys.ArrowLeft ? -1 : 0);
    const mx = (-sin * fwd) + (cos * str), mz = (-cos * fwd) + (-sin * str);
    stepPlayer(player, mx, mz, !!(keys.ShiftLeft || keys.ShiftRight), dt);
    const fixed = city.collide(player.x, player.z, player.radius);
    player.x = fixed.x; player.z = fixed.z;
    player.mesh.position.set(player.x, 0, player.z);
    rig.dist += (8 - rig.dist) * Math.min(1, dt * 3);
    audio.setEngine(false, 0, false);
    if (mouseDown && player.weapon === 'smg') tryShoot();
  }
  // World systems.
  const allCars = [...parkedCars, ...traffic.cars, ...police.units.filter(c => c.active)];
  updateTraffic(traffic, dt, [...allCars, { x: player.x, z: player.z, speed: player.speedNow }]);
  updatePolice(police, wanted, player, dt, city);
  updateWanted(wanted, dt, police.seenPlayer);
  updatePedestrians(peds, dt, allCars);
  updateCombat(combat, dt, player, null);
  updateRace(dt);
  updateVan(dt);
  for (const car of allCars) updateSmoke(scene, car, dt);
  // Car-to-car impacts (crimes, convoy damage, player harm).
  for (let i = 0; i < allCars.length; i++) for (let j = i + 1; j < allCars.length; j++) {
    const impact = collideCars(allCars[i], allCars[j]);
    if (impact > 7) {
      const a = allCars[i], b = allCars[j];
      a.health -= impact * 0.5; b.health -= impact * 0.5;
      if (a === player.inCar || b === player.inCar) {
        audio.crash();
        if (impact > 13) damagePlayer(player, impact * 0.35);
        reportCrime(wanted, 'hitCar', witnessed(), G.time);
        const van = a.missionVan ? a : (b.missionVan ? b : null);
        if (van && G.vanDriver === van) { van.health -= impact * 3.2; reportCrime(wanted, 'ram', witnessed(), G.time); }
      }
      scarePeds(peds, a.x, a.z, 12);
    }
  }
  // Running over a pedestrian is a serious crime.
  if (driving && Math.abs(player.inCar.speed) > 6) {
    for (const p of peds.peds) {
      if (dist2d(p.x, p.z, player.x, player.z) < 2.4 && p.fleeT < 2.9) {
        p.fleeT = 3; reportCrime(wanted, 'hitPed', true, G.time); damagePlayer(player, 0);
        hud.showBanner('PEDESTRIAN DOWN', 'Port Azura PD has been notified', 1.6);
      }
    }
  }
  // Busted: held stopped by an officer.
  if (wanted.level > 0) {
    const held = police.units.some(c => c.active && dist2d(c.x, c.z, player.x, player.z) < WANTED.bustedRange)
      && Math.abs(player.speedNow) < 1.3;
    wanted.bustedT = held ? wanted.bustedT + dt : Math.max(0, wanted.bustedT - dt * 2);
    if (wanted.bustedT >= WANTED.bustedTime) { endRun('busted'); return; }
  }
  if (player.health <= 0 || player.dead) { endRun('wasted'); return; }
  // Missions.
  if (!missions.state && !missions.done) {
    G.betweenT -= dt;
    if (G.betweenT <= 0) missions.start(ctx);
  }
  const result = missions.update(ctx, dt);
  if (result && result.done) {
    G.cash += result.reward; G.timerText = '';
    audio.sting(true); audio.cash();
    hud.showBanner('MISSION COMPLETE', `+$${result.reward} — ${missions.done ? 'Story complete!' : 'Next: ' + (missions.nextTitle() || '')}`, 3.6);
    if (missions.done) hud.showDialogue([['Selene Marchetti', 'Port Azura is yours, Dario. Halden is finished. Free roam — the city keeps turning.']]);
    saveGame(); G.betweenT = 2.5;
  } else if (result && result.fail) {
    G.timerText = '';
    audio.sting(false);
    hud.showBanner('MISSION FAILED', 'Restarting the job…', 2.6);
    G.betweenT = 2.5; missions.index = missions.index; // retry same mission
    missions.state = null;
  }
  // Shops and safehouse.
  savePromptT -= dt;
  let prompt = '';
  if (driving && dist2d(player.x, player.z, PLACES.paintShop.x, PLACES.paintShop.z) < 10) prompt = 'Press F — Azura Paint & Body: repair + respray $150';
  if (!driving) {
    const nearCar = nearestEnterableCar();
    if (nearCar) prompt = 'Press E to enter vehicle';
    if (dist2d(player.x, player.z, PLACES.safehouse.x, PLACES.safehouse.z) < 9) {
      prompt = 'Casa Venn — progress saved';
      if (savePromptT <= 0) { saveGame(); player.health = PLAYER.maxHealth; savePromptT = 6; }
    }
  }
  hud.setPrompt(G.promptOverride || prompt);
  // Objective marker.
  const marker = G.markerOverride || (missions.state ? missions.marker(ctx) : null);
  if (marker) {
    markerMesh.visible = true; markerMesh.position.set(marker.x, 23, marker.z);
    markerMesh.rotation.y += dt;
  } else markerMesh.visible = false;
  const objective = G.objectiveOverride || (missions.state ? missions.objective(ctx)
    : missions.done ? 'Free roam — Port Azura is yours. Steal, race, outrun the PD.'
    : `Free roam — next job: ${missions.nextTitle()} (starts shortly, or press M)`);
  // Audio: sirens when the PD is close and hot.
  const copNear = police.units.some(c => c.active && dist2d(c.x, c.z, player.x, player.z) < 65);
  audio.setSiren(wanted.level > 0 && copNear, G.time);
  hud.update(dt, {
    cash: G.cash, wanted: wanted.level, health: player.health, driving,
    speed: driving ? player.inCar.speed : 0, nos: driving ? player.inCar.nos : 0,
    objective, timerText: G.timerText,
    traffic: traffic.cars, police: police.units, marker, player,
  });
  // Camera.
  const target = driving ? player.inCar : player;
  updateCamera(camera, rig, target.x, 1.1, target.z, dt);
}

// ---- shot mode: frozen posed scenes ------------------------------------------
let shotFrames = 0;
function updateShot(dt) {
  G.time += dt;
  city.update(dt);
  // Keep the police light bars strobing and the helicopter alive in stills.
  const flash = Math.sin(G.time * 11) > 0;
  for (const cop of police.units) {
    const lb = cop.mesh.userData.lightBar;
    if (lb && cop.active) { lb.red.material.emissiveIntensity = flash ? 2.4 : 0.15; lb.blue.material.emissiveIntensity = flash ? 0.15 : 2.4; }
  }
  if (police.heli.visible) {
    police.rotor.rotation.y += dt * 28;
    const p = police.heli.position;
    police.spot.position.set(p.x, p.y, p.z); police.spot.intensity = 260;
    police.spot.target.position.set(player.x, 0, player.z);
    police.cone.position.set((p.x + player.x) / 2, 15, (p.z + player.z) / 2);
    police.cone.lookAt(player.x, 0, player.z); police.cone.rotateX(Math.PI / 2);
  }
  if (G.shotName === 'mission') { combat.flash.intensity = 9; combat.flash.position.set(player.x, 1.6, player.z); }
  const marker = G.markerOverride;
  if (marker) { markerMesh.visible = true; markerMesh.position.set(marker.x, 23, marker.z); }
  const driving = !!player.inCar;
  const target = driving ? player.inCar : player;
  if (target && target.mesh && target.mesh.userData.wheels) {
    for (const w of target.mesh.userData.wheels) w.rotation.x += dt * 6;
  }
  updateCamera(camera, rig, target.x, 1.1, target.z, dt);
  hud.update(dt, {
    cash: G.cash, wanted: wanted.level, health: player.health, driving,
    speed: driving ? player.inCar.speed : 0, nos: 80,
    objective: G.objectiveOverride || '', timerText: '',
    traffic: traffic.cars, police: police.units, marker, player,
  });
  hud.setPrompt(G.promptOverride || '');
  shotFrames++;
  if (shotFrames > 42) window.__shotReady = true;
}

// ---- main loop -------------------------------------------------------------------
if (shotName) {
  poseShot(shotName, G);
  setMode('play');
  hud.els.startEl.style.display = 'none';
} else {
  setMode('menu');
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.shotMode) { updateShot(dt); }
  else if (G.mode === 'play') { city.update(dt); updatePlay(dt); }
  else if (G.mode === 'menu') {
    city.update(dt);
    const t = now * 0.00005;
    camera.position.set(Math.sin(t) * 150, 46, Math.cos(t) * 150);
    camera.lookAt(0, 8, 0);
    updateTraffic(traffic, dt, parkedCars);
    updatePedestrians(peds, dt, traffic.cars);
  } else {
    // Paused / end screens: hold the last frame's world still.
    const target = player.inCar || player;
    updateCamera(camera, rig, target.x, 1.1, target.z, dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
