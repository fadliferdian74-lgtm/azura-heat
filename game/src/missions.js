// missions.js — Selene's eight jobs for Dario: story missions with dialogue,
// markers, timers, shootouts, a checkpoint race, a convoy hit and the finale.
// Free roam in between; the next job's marker appears when one completes.
import { PLACES, dist2d } from './config.js';
import { Vehicle } from './vehicles.js';
import { Enemy } from './combat.js';
import { paySound } from './audio.js';

const S = 'Selene', D = 'Dario', P = 'Primo', V = 'Viktor';
export const MISSIONS = [
  {
    name: 'First Wheels', reward: 600, start: PLACES.safehouse,
    intro: [[S, 'Dario. Fresh start, empty pockets. Primo needs a sports car — there is one parked by the beach strip. Take it.'],
            [D, 'Steal a car in broad sunset. Subtle.'], [S, 'Deliver it to the chop shop by the docks. Do not scratch it.']],
    steps: [
      { type: 'steal', at: { x: -70, z: -238 }, label: 'Steal the parked sports car at the beach' },
      { type: 'deliver', at: PLACES.chopShop, label: "Deliver the car to Primo's chop shop" },
    ],
    outro: [[P, 'Clean lines, clean lift. You drive for me now, eh?']],
  },
  {
    name: 'Package Run', reward: 750, start: PLACES.marina,
    intro: [[S, 'A package waits at the marina. Timer starts when you grab it — the buyer at Palm Hills hates waiting.']],
    steps: [
      { type: 'goto', at: PLACES.marina, radius: 9, label: 'Pick up the package at the marina' },
      { type: 'goto', at: { x: -238, z: -175 }, radius: 12, timed: 95, inCar: true, label: 'Deliver the package to Palm Hills — fast!' },
    ],
    outro: [[S, 'On time. The buyer sends his regards, and his cash.']],
  },
  {
    name: 'Heat Check', reward: 800, start: PLACES.chopShop,
    intro: [[S, 'Halden tipped the PAPD about your last run. They are coming — three stars of them. Lose the heat.']],
    steps: [{ type: 'escape', stars: 3, label: 'Lose the 3-star wanted level' }],
    outro: [[S, 'Gone like a ghost. Halden is running out of friends in uniform.']],
  },
  {
    name: 'Dockside Diplomacy', reward: 1200, start: PLACES.docks,
    intro: [[S, "Halden's men hold the docks. Take his ledger — it lists every bribe he ever paid."], [V, 'You are on my port, wheelman. Bad choice.']],
    steps: [
      { type: 'shootout', at: { x: 0, z: 252 }, count: 4, label: "Clear out Halden's men at the docks" },
      { type: 'goto', at: { x: 24, z: 268 }, radius: 6, onFoot: true, label: 'Grab the ledger' },
    ],
    outro: [[S, 'This ledger ends Halden. Carefully — he knows it is gone.']],
  },
  {
    name: 'Palm Street Grand Prix', reward: 1000, start: { x: -238, z: -70 },
    intro: [[S, 'Two street racers think they own Palm Street. Six checkpoints. Prove them wrong.']],
    steps: [{ type: 'race', label: 'Win the Palm Street Grand Prix' }],
    outro: [[S, 'First place. The whole strip saw it.']],
  },
  {
    name: 'Convoy Hit', reward: 1500, start: PLACES.docks,
    intro: [[S, "Halden moves cash in an armored van. Ram it until it stops, take the case, and vanish."]],
    steps: [
      { type: 'ram', label: 'Ram the armored van until it stops' },
      { type: 'gotoVan', label: 'Take the cash case from the van' },
      { type: 'escape', stars: 3, label: 'Escape with the cash — lose the heat' },
    ],
    outro: [[S, 'That was his payroll. He will feel that one.']],
  },
  {
    name: 'Skyline Run', reward: 1800, start: PLACES.marina,
    intro: [[S, 'A collector car, one careful owner, and every cop on the island awake. Marina to the safehouse. Do NOT dent it.']],
    steps: [
      { type: 'stealFragile', at: { x: 238, z: -140 }, label: 'Take the collector car at the marina' },
      { type: 'deliverFragile', at: PLACES.safehouse, label: 'Deliver it to the safehouse — gently, under fire' },
    ],
    outro: [[S, 'Not a scratch. You are wasted on crime, Dario.']],
  },
  {
    name: 'The Last Job', reward: 4000, start: PLACES.marina,
    intro: [[S, "Halden's vault sits under the marina office. Crack it, grab everything, and get home. Five stars, Dario. Come back alive."],
            [V, 'Take one step on my dock tonight and you swim home.']],
    steps: [
      { type: 'goto', at: { x: 252, z: -88 }, radius: 8, onFoot: true, label: 'Reach the marina vault on foot' },
      { type: 'vault', at: { x: 252, z: -88 }, hold: 6, label: 'Crack the vault — stay close' },
      { type: 'escapeTo', at: PLACES.safehouse, stars: 5, label: 'Escape to the safehouse!' },
    ],
    outro: [[S, 'It is over. Halden is finished, and Port Azura is ours. Enjoy the sunset, partner.']],
  },
];

export const RACE_CHECKPOINTS = [
  { x: -238, z: -70 }, { x: -140, z: -70 }, { x: -140, z: 70 }, { x: 0, z: 70 },
  { x: 0, z: -70 }, { x: 70, z: -140 }, { x: -70, z: -238 }, { x: -238, z: -238 },
];

export class MissionManager {
  constructor(G) {
    this.G = G; this.active = null; this.stepIdx = 0;
    this.targetCar = null; this.van = null; this.racers = [];
    this.raceIdx = 0; this.stepT = 0; this.holdT = 0; this.cleanup = [];
  }
  get current() { return this.active ? this.active.steps[this.stepIdx] : null; }
  pointToStart() {
    const G = this.G;
    if (G.missionIndex >= MISSIONS.length) {
      G.marker = null; G.hud.setObjective('Free roam — Port Azura is yours. Visit the safehouse to save.');
      return;
    }
    const m = MISSIONS[G.missionIndex];
    G.marker = { x: m.start.x, z: m.start.z };
    G.hud.setObjective('Next job: "' + m.name + '" — head to the gold marker');
  }
  tryStart() {
    const G = this.G;
    if (this.active || G.missionIndex >= MISSIONS.length) return false;
    const m = MISSIONS[G.missionIndex];
    if (dist2d(G.player.pos.x, G.player.pos.z, m.start.x, m.start.z) > 14) return false;
    this.active = m; this.stepIdx = 0; this.stepT = 0;
    for (const [n, t] of m.intro) G.hud.dialogue(n, t);
    G.hud.banner(m.name, 'Mission started');
    G.audio.blip(520, 0.15, 0.12, 'triangle');
    this.beginStep();
    return true;
  }
  track(obj) { this.cleanup.push(obj); return obj; }
  beginStep() {
    const G = this.G, st = this.current;
    if (!st) return;
    this.stepT = 0; this.holdT = 0;
    G.missionTimer = st.timed || 0;
    if (st.type === 'steal' || st.type === 'stealFragile') {
      const car = new Vehicle(G.scene, st.at.x, st.at.z, Math.PI / 2, st.type === 'stealFragile' ? 0xf5eeda : 0xd64541, 'sport');
      car.driver = 'mission'; this.targetCar = car; G.cars.push(car); this.track(car);
      G.marker = { x: st.at.x, z: st.at.z };
    } else if (st.type === 'escape' || st.type === 'escapeTo') {
      G.wanted.setForced(st.stars || 3);
      G.marker = st.at ? { x: st.at.x, z: st.at.z } : null;
    } else if (st.type === 'shootout') {
      for (let i = 0; i < st.count; i++) {
        const e = new Enemy(G.scene, st.at.x + (i - 1.5) * 9, st.at.z + (i % 2) * 10 - 5);
        G.enemies.push(e); this.track(e);
      }
      G.marker = { x: st.at.x, z: st.at.z };
    } else if (st.type === 'race') {
      this.raceIdx = 0;
      for (let i = 0; i < 2; i++) {
        const r = new Vehicle(G.scene, -238 + (i + 1) * 7, -52, Math.PI, i ? 0x3f7fd1 : 0xf2b035, 'sport');
        r.driver = 'racer'; r.userData = { cp: 0 };
        this.racers.push(r); G.cars.push(r); this.track(r);
      }
      G.marker = RACE_CHECKPOINTS[0];
      G.missionTimer = 150;
    } else if (st.type === 'ram') {
      const van = new Vehicle(G.scene, 70, 210, 0, 0x707880, 'van');
      van.driver = 'convoy'; van.health = 260; van.userData = { wp: 0 };
      this.van = van; G.cars.push(van); this.track(van);
      G.marker = null;
    } else if (st.type === 'gotoVan') {
      G.marker = this.van ? { x: this.van.x, z: this.van.z } : null;
    } else {
      G.marker = st.at ? { x: st.at.x, z: st.at.z } : null;
    }
    G.hud.setObjective(st.label || '');
  }
  advance() {
    const G = this.G;
    this.stepIdx++;
    if (this.stepIdx >= this.active.steps.length) return this.complete();
    G.audio.pickup();
    this.beginStep();
  }
  complete() {
    const G = this.G, m = this.active;
    G.cash += m.reward;
    for (const [n, t] of m.outro) G.hud.dialogue(n, t);
    G.hud.banner('MISSION COMPLETE', m.name + '  +$' + m.reward);
    G.audio.sting(true); paySound(G.audio);
    G.wanted.clearForced();
    this.endMission();
    G.missionIndex++;
    this.pointToStart();
  }
  fail(reason) {
    const G = this.G;
    if (!this.active) return;
    G.hud.banner('MISSION FAILED', reason);
    G.audio.sting(false);
    G.wanted.clearForced(); G.missionTimer = 0;
    this.endMission();
    this.pointToStart();
  }
  endMission() {
    const G = this.G;
    for (const o of this.cleanup) {
      if (o instanceof Vehicle) { o.remove(G.scene); const i = G.cars.indexOf(o); if (i >= 0) G.cars.splice(i, 1); }
      else if (o instanceof Enemy) { o.remove(G.scene); const i = G.enemies.indexOf(o); if (i >= 0) G.enemies.splice(i, 1); }
    }
    this.cleanup = []; this.racers = []; this.targetCar = null; this.van = null;
    this.active = null; G.missionTimer = 0;
  }
  onPlayerEnterCar(car) {
    const st = this.current;
    if (!st) return;
    if ((st.type === 'steal' || st.type === 'stealFragile') && car === this.targetCar) {
      if (st.type === 'stealFragile') this.G.wanted.setForced(5);
      this.advance();
    }
  }
  onRam(van, amount) {
    const st = this.current;
    if (st && st.type === 'ram' && van === this.van) {
      van.damage(amount);
      this.G.wanted.report('ram', true);
      if (van.health <= 0) { van.dead = false; van.health = 1; this.advance(); }
    }
  }

  update(dt) {
    const G = this.G, st = this.current;
    if (!st) return;
    this.stepT += dt;
    const p = G.player.pos;
    if (st.timed || st.type === 'race') {
      G.missionTimer -= dt;
      if (G.missionTimer <= 0) return this.fail(st.type === 'race' ? 'Out of time.' : 'The buyer gave up waiting.');
    }
    switch (st.type) {
      case 'goto': {
        if (st.inCar && !G.player.car) break;
        if (st.onFoot && G.player.car) break;
        if (dist2d(p.x, p.z, st.at.x, st.at.z) < (st.radius || 10)) this.advance();
        break;
      }
      case 'deliver': case 'deliverFragile': {
        if (G.player.car === this.targetCar && dist2d(p.x, p.z, st.at.x, st.at.z) < 13) {
          if (st.type === 'deliverFragile') G.wanted.clear();
          const car = this.targetCar;
          this.advance();
          if (car && G.player.car === car) { /* player keeps the car */ }
        }
        break;
      }
      case 'escape': {
        if (G.wanted.sightT > 4.5 && this.stepT > 3) { G.wanted.clear(); this.advance(); }
        break;
      }
      case 'escapeTo': {
        if (dist2d(p.x, p.z, st.at.x, st.at.z) < 14 && G.wanted.sightT > 2) { G.wanted.clear(); this.advance(); }
        break;
      }
      case 'shootout': {
        if (G.enemies.every(e => e.dead)) this.advance();
        break;
      }
      case 'race': {
        // AI racers chase the same checkpoints
        for (const r of this.racers) {
          const cp = RACE_CHECKPOINTS[r.userData.cp % RACE_CHECKPOINTS.length];
          const want = Math.atan2(-(cp.x - r.x), -(cp.z - r.z));
          r.heading += (((want - r.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2.4);
          r.cruise(dt, 26);
          if (dist2d(r.x, r.z, cp.x, cp.z) < 13) r.userData.cp++;
        }
        const cp = RACE_CHECKPOINTS[this.raceIdx];
        if (cp && G.player.car && dist2d(p.x, p.z, cp.x, cp.z) < 15) {
          this.raceIdx++; G.audio.pickup();
          if (this.raceIdx >= RACE_CHECKPOINTS.length) { this.advance(); break; }
          G.marker = RACE_CHECKPOINTS[this.raceIdx];
          G.hud.setObjective('Checkpoint ' + (this.raceIdx + 1) + ' of ' + RACE_CHECKPOINTS.length);
        }
        break;
      }
      case 'ram': {
        const van = this.van;
        if (van) {
          const WPS = [{ x: 70, z: 210 }, { x: 210, z: 210 }, { x: 210, z: 70 }, { x: 70, z: 70 }];
          const wp = WPS[van.userData.wp % WPS.length];
          const want = Math.atan2(-(wp.x - van.x), -(wp.z - van.z));
          van.heading += (((want - van.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2);
          van.cruise(dt, 17);
          if (dist2d(van.x, van.z, wp.x, wp.z) < 14) van.userData.wp++;
          G.marker = { x: van.x, z: van.z };
        }
        break;
      }
      case 'gotoVan': {
        if (this.van) {
          G.marker = { x: this.van.x, z: this.van.z };
          if (!G.player.car && dist2d(p.x, p.z, this.van.x, this.van.z) < 5) {
            G.hud.dialogue(P, 'Got the case. Now RUN.');
            this.advance();
          }
        }
        break;
      }
      case 'vault': {
        if (!G.player.car && dist2d(p.x, p.z, st.at.x, st.at.z) < (st.radius || 9)) {
          this.holdT += dt;
          G.hud.setObjective('Cracking the vault… ' + Math.floor(this.holdT) + ' / ' + st.hold + 's');
          if (this.holdT === dt || Math.floor(this.holdT) === 2) G.wanted.report('trespass', false);
          if (this.holdT >= st.hold) { G.audio.pickup(); this.advance(); }
        } else this.holdT = Math.max(0, this.holdT - dt * 0.5);
        break;
      }
    }
  }
}
