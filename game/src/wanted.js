// AZURA HEAT — the wanted system: Port Azura PD attention, in five stars.
// Crimes witnessed by police, pedestrians or cameras raise the heat; the star
// level is the ceiling of the heat. Staying out of every officer's sight lets
// the heat cool until the level drops. Busted and wasted live in main.js, but
// the timers that lead to them are tracked here.
import { WANTED } from './config.js';

export function createWanted() {
  return {
    level: 0,        // 0..5 stars currently shown
    heat: 0,         // fractional pressure toward the next star / decay pool
    hiddenT: 0,      // seconds since any officer last saw the player
    bustedT: 0,      // seconds a cop has held the player stopped
    forced: 0,       // mission-forced minimum level (Skyline Run, Last Job)
    lastCrimeT: -99,
  };
}

const CRIME_HEAT = {
  theft: 1.1, hitCar: 0.55, hitPed: 1.2, shotFired: 0.8, killEnemy: 0.7,
  hitCop: 1.4, mission: 1.0, ram: 0.3, vault: 2.2,
};

/** Report a crime. witnessed=false crimes only count at half pressure. */
export function reportCrime(wanted, kind, witnessed = true, now = 0) {
  const base = CRIME_HEAT[kind] ?? 0.5;
  wanted.heat += base * (witnessed ? 1 : 0.45);
  wanted.lastCrimeT = now;
  const target = Math.min(5, Math.max(wanted.forced, Math.floor(wanted.heat + 0.001)));
  if (target > wanted.level) wanted.level = target;
  if (wanted.level === 0 && wanted.heat >= 1) wanted.level = 1;
}

/** Raise the mission-forced floor (and the level to match). */
export function forceWanted(wanted, stars) {
  wanted.forced = Math.max(wanted.forced, stars);
  wanted.level = Math.max(wanted.level, stars);
  wanted.heat = Math.max(wanted.heat, stars);
}
export function clearForced(wanted) { wanted.forced = 0; }

/**
 * Per-frame update. seenByCop: any officer currently has eyes on the player.
 * When unseen long enough the heat cools; a full star of cooling drops a star.
 */
export function updateWanted(wanted, dt, seenByCop) {
  if (seenByCop) wanted.hiddenT = 0; else wanted.hiddenT += dt;
  if (wanted.level > 0 && wanted.hiddenT > WANTED.hideTime && wanted.forced === 0) {
    wanted.heat -= dt * 0.22;
    const cooled = Math.max(0, Math.ceil(wanted.heat - 0.001));
    if (cooled < wanted.level) wanted.level = cooled;
    if (wanted.heat <= 0) { wanted.heat = 0; wanted.level = 0; }
  }
  if (wanted.forced > 0) { wanted.level = Math.max(wanted.level, wanted.forced); wanted.heat = Math.max(wanted.heat, wanted.forced); }
}

export function clearWanted(wanted) {
  wanted.level = 0; wanted.heat = 0; wanted.hiddenT = 0; wanted.bustedT = 0; wanted.forced = 0;
}
export function copsWanted(wanted) { return WANTED.copCounts[wanted.level] || 0; }
