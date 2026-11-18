// wanted.js — the Port Azura PD wanted system: five stars, crime reports,
// line-of-sight tracking and decay while the player stays out of sight.
import { clamp } from './config.js';

export const CRIMES = {
  theft: 1, collision: 0.6, hitCar: 1, gunfire: 1, shotPerson: 2,
  killEnemy: 1, mission: 2, ram: 1, trespass: 1,
};

export class Wanted {
  constructor() {
    this.level = 0;          // 0..5 float heat
    this.sightT = 0;         // time since a cop last saw the player
    this.bustT = 0;          // time a cop has held the player stopped
    this.forced = 0;         // mission-forced minimum stars
  }
  get stars() { return Math.max(this.forced, Math.floor(this.level + 0.0001)); }
  report(kind, witnessed = true) {
    if (!witnessed) return;
    const v = CRIMES[kind] || 0.5;
    this.level = clamp(this.level + v, 0, 5.6);
  }
  setForced(n) { this.forced = n; if (this.level < n) this.level = n; }
  clearForced() { this.forced = 0; }
  clear() { this.level = 0; this.forced = 0; this.bustT = 0; }
  // seen: any cop currently has line of sight / proximity. dt seconds.
  update(dt, seen, playerSpeed) {
    if (seen) this.sightT = 0; else this.sightT += dt;
    if (this.stars > 0 && this.sightT > 9 && this.forced === 0) {
      this.level = Math.max(0, this.level - dt * 0.11);
    }
    if (this.stars > 0 && seen && playerSpeed < 1.2) this.bustT += dt;
    else this.bustT = Math.max(0, this.bustT - dt * 2);
  }
  get busted() { return this.bustT > 2.4; }
  get hidden() { return this.sightT > 2.5; }
}

// Star icons for the HUD ("★★★☆☆").
export function starString(wanted) {
  const s = wanted.stars;
  return '★'.repeat(s) + '☆'.repeat(5 - s);
}
