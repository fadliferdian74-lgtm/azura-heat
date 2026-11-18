// AZURA HEAT — the story: eight missions chained through Selene Marchetti's
// phone calls and Primo Almeida's chop shop, against Viktor Halden's port
// empire. Each mission is a small state machine (start / update / objective)
// driven by main.js; free-roam continues between missions, and the next
// mission's marker appears as soon as the previous one pays out.
import { PLACES, dist2d } from './config.js';
import { spawnEnemy, enemiesAlive, clearEnemies } from './combat.js';
import { forceWanted, clearForced } from './wanted.js';
import { CAR_STYLES } from './vehicles.js';

const near = (ctx, x, z, r) => dist2d(ctx.player.x, ctx.player.z, x, z) < r;
const nearCar = (ctx, car, x, z, r) => car && dist2d(car.x, car.z, x, z) < r;

export const MISSION_DEFS = [
  { title: 'First Wheels', from: 'Selene Marchetti', reward: 450 },
  { title: 'Package Run', from: 'Selene Marchetti', reward: 600 },
  { title: 'Heat Check', from: 'Selene Marchetti', reward: 550 },
  { title: 'Dockside Diplomacy', from: 'Primo Almeida', reward: 900 },
  { title: 'Palm Street Grand Prix', from: 'Primo Almeida', reward: 1200 },
  { title: 'Convoy Hit', from: 'Selene Marchetti', reward: 1400 },
  { title: 'Skyline Run', from: 'Selene Marchetti', reward: 1800 },
  { title: 'The Last Job', from: 'Selene Marchetti', reward: 3000 },
];

function m1() {
  let step = 0, car = null;
  return {
    start(ctx) {
      car = ctx.spawnCar(CAR_STYLES[1], 84, 236, Math.PI / 2); car.missionCar = true;
      ctx.dialogue([['Selene', 'Dario. There is a yellow Comet parked by the beach strip, keys in, owner careless.'], ['Selene', 'Take it to Primo at the chop shop, north-east port side. Try not to gift-wrap it around a palm.']]);
    },
    objective: () => step === 0 ? 'Steal the yellow sports car on the beach strip' : "Deliver the car to Primo's Chop Shop",
    marker(ctx) { return step === 0 ? { x: car.x, z: car.z } : { x: PLACES.chopShop.x, z: PLACES.chopShop.z }; },
    update(ctx) {
      if (step === 0 && ctx.player.inCar === car) { step = 1; ctx.crime('theft'); ctx.dialogue([['Primo', 'You are in? Good. Bring her home, paisano.']]); }
      else if (step === 1 && nearCar(ctx, car, PLACES.chopShop.x, PLACES.chopShop.z, 10)) { ctx.removeCar(car); return 'done'; }
    },
  };
}

function m2() {
  let step = 0, timer = 0;
  return {
    start(ctx) { ctx.dialogue([['Selene', 'A package waits at Marina Azul, west docks. Then it crosses town to Old Town — fast. Halden\'s people are counting the minutes too.']]); },
    objective: () => step === 0 ? 'Pick up the package at Marina Azul' : `Deliver the package to Old Town — ${Math.max(0, Math.ceil(timer))}s`,
    marker: () => step === 0 ? { x: PLACES.marina.x, z: PLACES.marina.z } : { x: 120, z: 120 },
    update(ctx, dt) {
      if (step === 0 && near(ctx, PLACES.marina.x, PLACES.marina.z, 9)) { step = 1; timer = 150; ctx.sfx('pickup'); ctx.dialogue([['Selene', 'Got it? Move. Clock is running.']]); }
      else if (step === 1) {
        timer -= dt; ctx.setTimer(timer);
        if (near(ctx, 120, 120, 10)) return 'done';
        if (timer <= 0) return 'fail';
      }
    },
  };
}

function m3() {
  let started = false;
  return {
    start(ctx) { ctx.dialogue([['Selene', 'The PD wants to make an example of the new wheelman. Let them chase. Then disappear — lose the heat completely.']]); },
    objective: () => 'Lose the cops — get your wanted level to zero',
    marker: () => null,
    update(ctx) {
      if (!started) { started = true; forceWanted(ctx.wanted, 3); ctx.crime('mission'); }
      if (started && ctx.wanted.level === 0 && ctx.wanted.heat < 0.4) { clearForced(ctx.wanted); return 'done'; }
      if (ctx.wanted.level > 0) ctx.wanted.forced = 0; // decay allowed; force was only the kick
    },
  };
}

function m4() {
  let step = 0;
  return {
    start(ctx) { ctx.dialogue([['Primo', 'Halden keeps a ledger at his port terminal — who he pays, who he buries. His men guard it.'], ['Primo', 'Take the ledger, Dario. Leave the rest to me.']]); },
    objective: (ctx) => step === 0 ? 'Drive to the Halden Port Terminal' : step === 1 ? `Clear out Halden's men (${ctx.enemiesLeft()} left)` : 'Grab the ledger',
    marker: () => ({ x: PLACES.port.x, z: PLACES.port.z }),
    update(ctx) {
      if (step === 0 && near(ctx, PLACES.port.x, PLACES.port.z, 16)) {
        step = 1;
        for (const [x, z] of [[186, -236], [204, -232], [196, -242], [214, -238]]) spawnEnemy(ctx.combat, x, z);
        ctx.dialogue([['Halden Man', 'Wrong dock, friend. Walk away or fall down.']]);
      } else if (step === 1 && ctx.enemiesLeft() === 0) { step = 2; ctx.sfx('pickup'); }
      else if (step === 2 && near(ctx, PLACES.port.x, PLACES.port.z, 6)) { clearEnemies(ctx.combat); ctx.crime('mission'); return 'done'; }
    },
  };
}

function m5() {
  const ROUTE = [[80, 240], [160, 160], [80, 80], [160, 0], [80, -80], [0, -160], [-80, -80], [-160, 0], [-80, 80], [0, 160], [80, 236]];
  let cp = 0, racers = [], playerDone = false;
  return {
    start(ctx) {
      racers = ROUTE.map(() => 0); // progress per AI racer, driven by main's traffic-style stepper via ctx.raceAi
      ctx.raceSetup(ROUTE);
      ctx.dialogue([['Primo', 'Grand Prix, Palm Street rules: hit every checkpoint, finish first. My money is on you, so do not embarrass us both.']]);
    },
    objective: (ctx) => `Grand Prix — checkpoint ${Math.min(cp + 1, ROUTE.length)}/${ROUTE.length}${ctx.racePosition ? ` • position ${ctx.racePosition()}` : ''}`,
    marker: () => ROUTE[Math.min(cp, ROUTE.length - 1)] ? { x: ROUTE[Math.min(cp, ROUTE.length - 1)][0], z: ROUTE[Math.min(cp, ROUTE.length - 1)][1] } : null,
    update(ctx) {
      const target = ROUTE[cp];
      if (!target) return playerDone ? 'done' : 'fail';
      const inCar = ctx.player.inCar;
      if (inCar && dist2d(inCar.x, inCar.z, target[0], target[1]) < 13) { cp++; ctx.sfx('pickup'); if (cp >= ROUTE.length) { playerDone = true; return ctx.racePosition() <= 1 ? 'done' : 'fail'; } }
      if (ctx.raceAiFinished && ctx.raceAiFinished()) return 'fail';
    },
    cleanup(ctx) { ctx.raceTeardown(); },
  };
}

function m6() {
  let step = 0, van = null;
  return {
    start(ctx) {
      van = ctx.spawnCar({ kind: 'van', color: 0x3a3f46, top: 30 }, 160, -160, Math.PI);
      van.health = 260; van.missionVan = true;
      ctx.vanDriver = van;
      ctx.dialogue([['Selene', 'Halden moves cash in an armored van on the north loop. Ram it until it stops, take the case, then lose the three stars that follow.']]);
    },
    objective: () => step === 0 ? `Ram the armored van until it stops (${Math.max(0, Math.ceil(van ? van.health : 0))} integrity)` : step === 1 ? 'Take the cash case' : 'Escape — lose the cops',
    marker: () => van ? { x: van.x, z: van.z } : null,
    update(ctx) {
      if (!van) return 'fail';
      if (step === 0 && van.health <= 0) { step = 1; van.speed = 0; ctx.vanDriver = null; ctx.dialogue([['Selene', 'It stopped! Grab the case, go!']]); }
      else if (step === 1 && near(ctx, van.x, van.z, 5)) { step = 2; ctx.sfx('cash'); forceWanted(ctx.wanted, 3); }
      else if (step === 2) { ctx.wanted.forced = 0; if (ctx.wanted.level === 0) { clearForced(ctx.wanted); ctx.removeCar(van); return 'done'; } }
    },
    cleanup(ctx) { ctx.vanDriver = null; },
  };
}

function m7() {
  let car = null;
  return {
    start(ctx) {
      car = ctx.spawnCar(CAR_STYLES[0], 232, -168, Math.PI / 2); car.missionCar = true; car.fragile = true;
      forceWanted(ctx.wanted, 5);
      ctx.dialogue([['Selene', 'A client\'s Comet sits at the port — and the whole PD is already looking for it. Five stars, helicopter, everything.'], ['Selene', 'Deliver it to the Palm Hills overlook without a scratch more than a whisper.']]);
    },
    objective: () => 'Deliver the Comet to Palm Hills — keep it in one piece',
    marker: () => ({ x: PLACES.palmHills.x, z: PLACES.palmHills.z }),
    update(ctx) {
      if (car.health < 35) return 'fail';
      if (ctx.player.inCar === car && nearCar(ctx, car, PLACES.palmHills.x, PLACES.palmHills.z, 11)) {
        clearForced(ctx.wanted); ctx.wanted.level = 0; ctx.wanted.heat = 0; ctx.removeCar(car); return 'done';
      }
    },
    cleanup(ctx) { clearForced(ctx.wanted); },
  };
}

function m8() {
  let step = 0, hold = 0;
  return {
    start(ctx) { ctx.dialogue([['Selene', 'Last job, Dario. The marina vault, west docks. Crack it, and the whole PD comes down on you — five stars.'], ['Selene', 'Then get home. Casa Venn. End it where it started.']]); },
    objective: () => step === 0 ? 'Reach the Marina Vault' : step === 1 ? `Cracking the vault… ${Math.ceil(5 - hold)}s — hold your ground` : 'Escape to the Safehouse — Casa Venn',
    marker: () => step < 2 ? { x: PLACES.vault.x, z: PLACES.vault.z } : { x: PLACES.safehouse.x, z: PLACES.safehouse.z },
    update(ctx, dt) {
      if (step === 0 && !ctx.player.inCar && near(ctx, PLACES.vault.x, PLACES.vault.z, 6)) step = 1;
      else if (step === 1) {
        if (near(ctx, PLACES.vault.x, PLACES.vault.z, 7)) { hold += dt; if (hold >= 5) { step = 2; ctx.crime('vault'); forceWanted(ctx.wanted, 5); ctx.sfx('cash'); ctx.dialogue([['Selene', 'That\'s it! GO. Home, Dario — get home!']]); } }
        else hold = Math.max(0, hold - dt * 2);
      } else if (step === 2 && near(ctx, PLACES.safehouse.x, PLACES.safehouse.z, 10)) { clearForced(ctx.wanted); ctx.wanted.level = 0; ctx.wanted.heat = 0; return 'done'; }
    },
    cleanup(ctx) { clearForced(ctx.wanted); },
  };
}

const BUILDERS = [m1, m2, m3, m4, m5, m6, m7, m8];

export function createMissions() {
  return {
    index: 0, active: null, state: null, betweenT: 0,
    get total() { return BUILDERS.length; },
    get done() { return this.index >= BUILDERS.length; },
    start(ctx) {
      if (this.done) return;
      this.state = BUILDERS[this.index]();
      this.active = MISSION_DEFS[this.index];
      this.state.start(ctx);
      ctx.hud.showBanner('MISSION: ' + this.active.title, 'For ' + this.active.from, 3.4);
    },
    update(ctx, dt) {
      if (!this.state) return null;
      const result = this.state.update(ctx, dt);
      if (result === 'done') {
        const reward = this.active.reward;
        if (this.state.cleanup) this.state.cleanup(ctx);
        this.state = null; this.active = null; this.index++;
        return { done: true, reward };
      }
      if (result === 'fail') {
        if (this.state.cleanup) this.state.cleanup(ctx);
        this.state = null;
        return { fail: true };
      }
      return null;
    },
    retry(ctx) { if (!this.done && !this.state) this.start(ctx); },
    objective(ctx) { return this.state ? this.state.objective(ctx) : null; },
    marker(ctx) { return this.state ? this.state.marker(ctx) : (this.done ? null : { x: PLACES.safehouse.x, z: PLACES.safehouse.z }); },
    nextTitle() { return this.done ? null : MISSION_DEFS[this.index].title; },
  };
}
export { enemiesAlive };
