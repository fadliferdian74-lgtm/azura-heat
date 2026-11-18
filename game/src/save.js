// AZURA HEAT — persistence: cash, story progress and player position are kept
// in localStorage, written at the safehouse and on every mission completion.
const KEY = 'azura-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch { return null; }
}
export function writeSave(data) {
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: session-only progress */ }
}
export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function hasSave() { return loadSave() !== null; }
