// AZURA HEAT — HUD and menus: every 2D layer over the 3D world. A canvas
// minimap (roads, water, player arrow, traffic/police blips, mission marker),
// wanted stars, health, cash, speedometer, objective line, dialogue box,
// interaction prompts, banners, and the start / pause / wasted / busted /
// mission-complete screens. All DOM is built here; main.js feeds it state.
import { ROADS, ISLAND } from './config.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  (parent || document.body).appendChild(e);
  return e;
}

export function createHud() {
  const root = el('div', 'hud');
  const minimap = el('canvas', 'minimap', root);
  minimap.width = 190; minimap.height = 190;
  const cashEl = el('div', 'cash', root, '$0');
  const starsEl = el('div', 'stars', root, '');
  const healthWrap = el('div', 'healthwrap', root);
  const healthBar = el('div', 'healthbar', healthWrap);
  const speedEl = el('div', 'speed', root, '');
  const nosWrap = el('div', 'noswrap', root); const nosBar = el('div', 'nosbar', nosWrap);
  const objectiveEl = el('div', 'objective', root, '');
  const timerEl = el('div', 'timer', root, '');
  const radioEl = el('div', 'radio', root, '');
  const promptEl = el('div', 'prompt', root, '');
  const dialogueEl = el('div', 'dialogue', root);
  const dlgName = el('div', 'dlg-name', dialogueEl);
  const dlgText = el('div', 'dlg-text', dialogueEl);
  dialogueEl.style.display = 'none';
  const bannerEl = el('div', 'banner', root, '');
  const subBannerEl = el('div', 'subbanner', root, '');

  // Full-screen overlays.
  const startEl = el('div', 'overlay start');
  el('h1', 'game-title', startEl, 'AZURA HEAT');
  el('p', 'blurb', startEl, 'Port Azura, golden hour. Dario Venn came home with empty pockets and a borrowed name. Selene Marchetti has work, Primo Almeida has a chop shop, and Viktor Halden owns the port — for now. Drive, run, shoot, and stay ahead of the Port Azura PD.');
  const controls = el('div', 'controls', startEl);
  controls.innerHTML = 'WASD move / drive &nbsp;•&nbsp; Mouse aim &nbsp;•&nbsp; Click shoot &nbsp;•&nbsp; E enter / exit car &nbsp;•&nbsp; Shift sprint / NOS<br>Space handbrake &nbsp;•&nbsp; 1 / 2 pistol / SMG &nbsp;•&nbsp; R radio &nbsp;•&nbsp; M next mission &nbsp;•&nbsp; Esc / P pause';
  const btnRow = el('div', 'btnrow', startEl);
  const newBtn = el('button', 'menubtn', btnRow, 'NEW GAME');
  const contBtn = el('button', 'menubtn', btnRow, 'CONTINUE');
  const pauseEl = el('div', 'overlay pause');
  el('h2', '', pauseEl, 'PAUSED');
  const resumeBtn = el('button', 'menubtn', pauseEl, 'RESUME');
  const restartBtn = el('button', 'menubtn', pauseEl, 'RESTART STORY');
  const endEl = el('div', 'overlay end');
  const endTitle = el('h1', 'end-title', endEl, '');
  const endSub = el('p', 'blurb', endEl, '');
  const endBtn = el('button', 'menubtn', endEl, 'RESPAWN');

  let bannerT = 0, radioT = 0, dlgQueue = [], dlgT = 0;

  function showDialogue(lines) { dlgQueue = lines.slice(); dlgT = 0; nextDialogue(); }
  function nextDialogue() {
    const line = dlgQueue.shift();
    if (!line) { dialogueEl.style.display = 'none'; return; }
    dlgName.textContent = line[0]; dlgText.textContent = line[1];
    dialogueEl.style.display = 'block'; dlgT = 3.8;
  }
  function showBanner(text, sub = '', seconds = 3.2) {
    bannerEl.textContent = text; subBannerEl.textContent = sub;
    bannerEl.style.opacity = '1'; subBannerEl.style.opacity = '1'; bannerT = seconds;
  }
  function flashRadio(name) { radioEl.textContent = '♪ ' + name; radioEl.style.opacity = '1'; radioT = 2.6; }

  function drawMinimap(state) {
    const g = minimap.getContext('2d');
    const S = 190, half = S / 2, scale = S / (ISLAND * 2 + 80);
    const px = (x) => half + x * scale, pz = (z) => half + z * scale;
    g.fillStyle = '#175d7a'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#79a86b'; g.fillRect(px(-ISLAND), pz(-ISLAND), ISLAND * 2 * scale, ISLAND * 2 * scale);
    g.fillStyle = '#f2ddab'; g.fillRect(px(-ISLAND), pz(ISLAND - 6), ISLAND * 2 * scale, 20);
    g.strokeStyle = '#3c3f45'; g.lineWidth = 3;
    for (const r of ROADS) {
      g.beginPath(); g.moveTo(px(-ISLAND), pz(r)); g.lineTo(px(ISLAND), pz(r)); g.stroke();
      g.beginPath(); g.moveTo(px(r), pz(-ISLAND)); g.lineTo(px(r), pz(ISLAND)); g.stroke();
    }
    const blip = (x, z, color, size = 3) => { g.fillStyle = color; g.beginPath(); g.arc(px(x), pz(z), size, 0, 7); g.fill(); };
    for (const c of state.traffic) blip(c.x, c.z, '#e8e8e8', 2);
    for (const c of state.police) if (c.active) blip(c.x, c.z, (performance.now() % 500 < 250) ? '#ff4444' : '#4477ff', 3);
    if (state.marker) {
      g.strokeStyle = '#ffd23e'; g.lineWidth = 2;
      g.beginPath(); g.arc(px(state.marker.x), pz(state.marker.z), 6 + Math.sin(performance.now() * 0.006) * 2, 0, 7); g.stroke();
      blip(state.marker.x, state.marker.z, '#ffd23e', 3);
    }
    // Player arrow.
    g.save(); g.translate(px(state.player.x), pz(state.player.z)); g.rotate(-state.player.heading);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore();
  }

  return {
    els: { startEl, pauseEl, endEl, newBtn, contBtn, resumeBtn, restartBtn, endBtn, endTitle, endSub, minimap },
    showDialogue, showBanner, flashRadio,
    setPrompt(t) { promptEl.textContent = t || ''; promptEl.style.opacity = t ? '1' : '0'; },
    update(dt, state) {
      cashEl.textContent = '$' + Math.floor(state.cash).toLocaleString('en-US');
      starsEl.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      starsEl.style.color = state.wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
      healthBar.style.width = Math.max(0, state.health) + '%';
      healthBar.style.background = state.health > 30 ? '#53d769' : '#e2543e';
      speedEl.textContent = state.driving ? Math.round(Math.abs(state.speed) * 2.4) + ' km/h' : '';
      nosWrap.style.opacity = state.driving ? '1' : '0';
      nosBar.style.width = (state.nos || 0) + '%';
      objectiveEl.textContent = state.objective || '';
      objectiveEl.style.opacity = state.objective ? '1' : '0';
      timerEl.textContent = state.timerText || '';
      bannerT -= dt; if (bannerT <= 0) { bannerEl.style.opacity = '0'; subBannerEl.style.opacity = '0'; }
      radioT -= dt; if (radioT <= 0) radioEl.style.opacity = '0';
      if (dlgT > 0) { dlgT -= dt; if (dlgT <= 0 && dlgQueue.length) nextDialogue(); else if (dlgT <= 0) dialogueEl.style.display = 'none'; }
      drawMinimap(state);
    },
  };
}
