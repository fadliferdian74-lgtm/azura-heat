// audio.js — all sound is synthesized with WebAudio: three radio stations of
// generative music plus engine, skid, siren, gunshot and UI effects. No files.
export const STATIONS = [
  { name: 'Azura Wave FM', scale: [0, 3, 5, 7, 10], base: 196, tempo: 0.24, wave: 'sawtooth' },
  { name: 'Radio Sol', scale: [0, 2, 4, 7, 9], base: 220, tempo: 0.19, wave: 'triangle' },
  { name: 'Palma Chill', scale: [0, 2, 5, 7, 9], base: 164.8, tempo: 0.34, wave: 'sine' },
];

export class AudioSys {
  constructor() {
    this.ctx = null; this.station = 0; this.musicOn = false;
    this.step = 0; this.nextNote = 0; this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.skidGain = null; this.skidSrc = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    // engine: sawtooth whose pitch follows speed
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
    // siren: slow LFO'd triangle, only audible near cops
    this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 760;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master); this.sirenOsc.start();
    // skid: filtered noise loop
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.skidSrc = this.ctx.createBufferSource(); this.skidSrc.buffer = buf; this.skidSrc.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900;
    this.skidGain = this.ctx.createGain(); this.skidGain.gain.value = 0;
    this.skidSrc.connect(bp); bp.connect(this.skidGain); this.skidGain.connect(this.master); this.skidSrc.start();
    this.musicOn = true; this.nextNote = this.ctx.currentTime + 0.1;
  }
  note(freq, t, dur, type, vol, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  update(dt, G) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // generative radio while driving
    const st = STATIONS[this.station];
    if (G.player.car && G.state === 'playing') {
      while (this.nextNote < t + 0.15) {
        const deg = st.scale[Math.floor(Math.abs(Math.sin(this.step * 1.7)) * st.scale.length) % st.scale.length];
        const f = st.base * Math.pow(2, deg / 12) * (this.step % 8 === 0 ? 0.5 : 1);
        this.note(f, this.nextNote, st.tempo * 1.8, st.wave, 0.05);
        if (this.step % 4 === 0) this.note(st.base / 2, this.nextNote, st.tempo * 3.4, 'sine', 0.07);
        this.nextNote += st.tempo; this.step++;
      }
    } else this.nextNote = Math.max(this.nextNote, t + 0.05);
    // engine pitch from speed
    const spd = G.player.car ? Math.abs(G.player.car.speed) : 0;
    this.engineGain.gain.value += ((G.player.car ? 0.05 + spd * 0.0016 : 0) - this.engineGain.gain.value) * 0.2;
    this.engineOsc.frequency.value = 55 + spd * 4.4;
    // siren volume from nearest cop
    let siren = 0;
    if (G.copPositions && G.copPositions.length) {
      let bd = 1e9; const p = G.player.pos;
      for (const c of G.copPositions) bd = Math.min(bd, Math.hypot(c.x - p.x, c.z - p.z));
      siren = Math.max(0, 0.10 - bd * 0.0011);
    }
    this.sirenGain.gain.value = siren;
    this.sirenOsc.frequency.value = 720 + Math.sin(t * 5.2) * 160;
    const skid = G.player.car && G.player.car.drifting ? 0.06 : 0;
    this.skidGain.gain.value += (skid - this.skidGain.gain.value) * 0.3;
  }
  cycleStation(G) {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    if (G) G.hud.flashRadio(STATIONS[this.station].name);
  }
  blip(freq = 660, dur = 0.09, vol = 0.12, type = 'square') {
    if (!this.ctx) return;
    this.note(freq, this.ctx.currentTime, dur, type, vol);
  }
  shot(enemy) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(enemy ? 0.10 : 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    src.connect(hp); hp.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.15);
  }
  pickup() { this.blip(880, 0.1, 0.14); setTimeout(() => this.blip(1320, 0.14, 0.14), 70); }
  sting(win) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 0.13, 'triangle'), i * 120));
  }
  crash() { this.blip(90, 0.25, 0.25, 'sawtooth'); }
}

// Short cash-register style arpeggio used when a mission pays out.
export function paySound(audio) {
  if (!audio.ctx) return;
  [1046, 1318, 1568].forEach((f, i) => setTimeout(() => audio.blip(f, 0.12, 0.12, 'square'), i * 60));
}
