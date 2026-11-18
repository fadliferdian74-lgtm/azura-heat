// hud.js — every 2D overlay: minimap, wanted stars, health, cash, speedo,
// objective line, dialogue box, prompts, banners and the radio flash.
import { ROADS, CITY_HALF, districtAt } from './config.js';
import { starString } from './wanted.js';

const $ = id => document.getElementById(id);

export class HUD {
  constructor(G) {
    this.G = G;
    this.els = {
      stars: $('stars'), cash: $('cash'), health: $('health-fill'),
      speed: $('speedo'), objective: $('objective'), prompt: $('prompt'),
      dialogue: $('dialogue'), dName: $('dialogue-name'), dText: $('dialogue-text'),
      toast: $('toast'), radio: $('radio-flash'), banner: $('banner'),
      bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
      minimap: $('minimap'), district: $('district'), weapon: $('weapon-name'),
      timer: $('mission-timer'), dmg: $('damage-flash'),
    };
    this.ctx = this.els.minimap.getContext('2d');
    this.toastT = 0; this.radioT = 0; this.bannerT = 0; this.dmgT = 0;
    this.dialogueQueue = [];
  }
  toast(msg, secs = 2.6) { this.els.toast.textContent = msg; this.els.toast.style.opacity = 1; this.toastT = secs; }
  flashRadio(name) { this.els.radio.textContent = '♪ ' + name; this.els.radio.style.opacity = 1; this.radioT = 2.4; }
  flashDamage() { this.dmgT = 0.5; }
  banner(title, sub = '', secs = 3.4) {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub;
    this.els.banner.style.opacity = 1; this.bannerT = secs;
  }
  dialogue(name, text) { this.dialogueQueue.push({ name, text }); }
  showDialogueNow(name, text) {
    this.els.dName.textContent = name; this.els.dText.textContent = text;
    this.els.dialogue.style.opacity = 1;
  }
  hideDialogue() { this.els.dialogue.style.opacity = 0; }
  setPrompt(text) {
    if (text) { this.els.prompt.textContent = text; this.els.prompt.style.opacity = 1; }
    else this.els.prompt.style.opacity = 0;
  }
  setObjective(text) { this.els.objective.textContent = text || ''; }
  update(dt) {
    const G = this.G;
    this.els.stars.textContent = starString(G.wanted);
    this.els.stars.style.color = G.wanted.stars > 0 && Math.floor(performance.now() / 400) % 2 ? '#ffd34d' : '#fff';
    this.els.cash.textContent = '$' + Math.floor(G.cash).toLocaleString('en-US');
    this.els.health.style.width = Math.max(0, G.player.health) + '%';
    this.els.health.style.background = G.player.health < 30 ? '#e74c3c' : '#2ecc71';
    const p = G.player.pos;
    this.els.district.textContent = districtAt(p.x, p.z);
    if (G.player.car) {
      this.els.speed.style.opacity = 1;
      this.els.speed.textContent = Math.round(Math.abs(G.player.car.speed) * 3.6) + ' km/h';
      this.els.weapon.textContent = '';
    } else {
      this.els.speed.style.opacity = 0;
      this.els.weapon.textContent = G.state === 'playing' ? (G.player.weapon === 'smg' ? 'SMG [2]' : 'PISTOL [1]') : '';
    }
    if (G.missionTimer > 0) {
      this.els.timer.style.opacity = 1;
      this.els.timer.textContent = '⏱ ' + Math.max(0, G.missionTimer).toFixed(1);
    } else this.els.timer.style.opacity = 0;
    // dialogue queue: each line holds ~3.4s
    if (this.dialogueQueue.length && !this._dlgT) {
      const d = this.dialogueQueue.shift();
      this.showDialogueNow(d.name, d.text); this._dlgT = 3.4;
    }
    if (this._dlgT) { this._dlgT -= dt; if (this._dlgT <= 0) { this._dlgT = 0; if (!this.dialogueQueue.length) this.hideDialogue(); } }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.els.toast.style.opacity = 0; }
    if (this.radioT > 0) { this.radioT -= dt; if (this.radioT <= 0) this.els.radio.style.opacity = 0; }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.els.banner.style.opacity = 0; }
    if (this.dmgT > 0) { this.dmgT -= dt; this.els.dmg.style.opacity = Math.max(0, this.dmgT); }
    this.drawMinimap();
  }
  drawMinimap() {
    const G = this.G, ctx = this.ctx, S = 176, half = S / 2;
    const scale = S / (CITY_HALF * 2 + 160);
    const px = v => half + v * scale;
    ctx.fillStyle = '#1d5f86'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#c9b183';
    ctx.beginPath(); ctx.arc(half, half, 470 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#565d63';
    for (const r of ROADS) {
      ctx.fillRect(px(r) - 3, px(-CITY_HALF), 6, CITY_HALF * 2 * scale);
      ctx.fillRect(px(-CITY_HALF), px(r) - 3, CITY_HALF * 2 * scale, 6);
    }
    const dot = (x, z, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(x), px(z), r, 0, Math.PI * 2); ctx.fill(); };
    for (const t of G.traffic || []) dot(t.car.x, t.car.z, '#dddddd', 2);
    for (const c of G.copPositions || []) dot(c.x, c.z, (Math.floor(performance.now() / 300) % 2 ? '#ff4444' : '#4488ff'), 3);
    for (const e of G.enemies || []) if (!e.dead) dot(e.x, e.z, '#ff2222', 2.5);
    if (G.marker) { dot(G.marker.x, G.marker.z, '#ffd34d', 4.5); }
    // player arrow
    const p = G.player.pos;
    const h = G.player.car ? G.player.car.heading : G.player.heading;
    ctx.save(); ctx.translate(px(p.x), px(p.z)); ctx.rotate(-h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// Convenience: big centred announcements used by the wasted/busted flow.
export function announce(hud, title, sub) { hud.banner(title, sub, 4.2); }
