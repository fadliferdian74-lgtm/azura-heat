// AZURA HEAT — all sound is synthesised with WebAudio; there are no audio files.
// Three radio stations run as tiny step-sequenced loops (bass + arpeggio +
// hats), and every effect — engine, skid, siren, gunshot, pickup, mission
// sting, UI click — is an oscillator or filtered noise burst shaped live.
export function createAudio() {
  let ctx = null, master = null, radioGain = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  let station = 0, step = 0, seqTimer = null;
  const STATIONS = [
    { name: 'Azura Wave FM', root: 110, scale: [0, 3, 5, 7, 10], tempo: 0.21, wave: 'sawtooth', arp: [0, 2, 4, 2] },
    { name: 'Radio Sol', root: 98, scale: [0, 2, 4, 7, 9], tempo: 0.19, wave: 'square', arp: [0, 1, 2, 3] },
    { name: 'Palma Chill', root: 87.3, scale: [0, 3, 7, 10, 12], tempo: 0.27, wave: 'triangle', arp: [4, 2, 0, 2] },
  ];
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      radioGain = ctx.createGain(); radioGain.gain.value = 0.16; radioGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      return true;
    } catch { return false; }
  }
  function tone(freq, t, dur, type, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, freq) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  function radioStep() {
    if (!ctx) return;
    const st = STATIONS[station], t = ctx.currentTime + 0.03;
    const bar = Math.floor(step / 8) % 4;
    const bassNote = st.root * Math.pow(2, st.scale[bar % st.scale.length] / 12);
    if (step % 2 === 0) tone(bassNote, t, 0.22, 'sine', 0.5, radioGain);
    const arpNote = st.root * 2 * Math.pow(2, st.scale[st.arp[step % 4]] / 12) * (bar % 2 ? 1.5 : 1);
    tone(arpNote, t, 0.16, st.wave, 0.12, radioGain);
    if (step % 2 === 1) noise(t, 0.03, 0.05, 6000);
    step++;
    seqTimer = setTimeout(radioStep, st.tempo * 1000);
  }
  return {
    ensure,
    stationName: () => STATIONS[station].name,
    startRadio() { if (!ensure()) return; if (seqTimer) return; step = 0; radioStep(); },
    stopRadio() { if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; } },
    cycleStation() { station = (station + 1) % STATIONS.length; this.click(); return STATIONS[station].name; },
    setEngine(on, speedRatio, nos) {
      if (!ctx) return;
      engineGain.gain.value = on ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
      engineOsc.frequency.value = 50 + Math.abs(speedRatio) * 130 + (nos ? 40 : 0);
    },
    setSiren(on, t) {
      if (!ctx) return;
      sirenGain.gain.value = on ? 0.018 : 0;
      if (on) sirenOsc.frequency.value = 660 + Math.sin(t * 5.2) * 190;
    },
    shot(auto) { if (ensure()) { noise(ctx.currentTime, auto ? 0.09 : 0.14, 0.5, 900); tone(140, ctx.currentTime, 0.08, 'square', 0.2); } },
    skid() { if (ctx) noise(ctx.currentTime, 0.12, 0.08, 2400); },
    pickup() { if (ensure()) { tone(660, ctx.currentTime, 0.1, 'sine', 0.3); tone(990, ctx.currentTime + 0.09, 0.16, 'sine', 0.3); } },
    cash() { if (ensure()) { tone(1240, ctx.currentTime, 0.07, 'square', 0.16); tone(1560, ctx.currentTime + 0.06, 0.12, 'square', 0.16); } },
    sting(win) {
      if (!ensure()) return;
      const notes = win ? [523, 659, 784, 1046] : [392, 330, 262, 196];
      notes.forEach((n, i) => tone(n, ctx.currentTime + i * 0.13, 0.24, 'triangle', 0.3));
    },
    click() { if (ctx) tone(880, ctx.currentTime, 0.05, 'sine', 0.15); },
    crash() { if (ctx) { noise(ctx.currentTime, 0.25, 0.5, 300); tone(70, ctx.currentTime, 0.2, 'sine', 0.4); } },
  };
}
