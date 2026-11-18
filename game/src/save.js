// save.js — safehouse saves in localStorage: cash, mission progress, the
// player's position and current car colour survive a reload.
const KEY = 'azura-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.mission !== 'number') return null;
    return s;
  } catch { return null; }
}
export function writeSave(G) {
  try {
    const p = G.player.pos;
    localStorage.setItem(KEY, JSON.stringify({
      cash: G.cash, mission: G.missionIndex,
      x: Math.round(p.x), z: Math.round(p.z),
      color: G.player.car ? G.player.car.mesh.userData.paint.color.getHex() : null,
    }));
    return true;
  } catch { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }
export function hasSave() { return !!loadSave(); }

// A brand-new game state, used by the start screen's New Game button.
export function freshState() {
  return { cash: 250, mission: 0, x: -200, z: -160, color: null };
}
