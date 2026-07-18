// WebAudio 8-bit synth: SFX + a small chiptune loop. Context unlocks on first input (iOS rule).

class AudioSys {
  constructor() {
    try { this.musicMuted = localStorage.getItem('wedge-muted') === '1'; } catch (e) { this.musicMuted = false; }
    this.musicWanted = false;
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    try { localStorage.setItem('wedge-muted', this.musicMuted ? '1' : '0'); } catch (e) { /* private mode */ }
    if (this.musicMuted) this._halt();
    else if (this.musicWanted) this._begin();
  }

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.userPaused) this.ctx.resume();
  }

  pauseAll() {
    this.userPaused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }
  resumeAll() {
    this.userPaused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(f, dur, { type = 'square', vol = 0.12, delay = 0, slide = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  blip() { this.tone(880, 0.05, { vol: 0.08 }); }
  select() { this.tone(523, 0.05); this.tone(784, 0.08, { delay: 0.05 }); }
  tick() { this.tone(1200, 0.03, { vol: 0.07 }); }
  duckDive() { this.tone(300, 0.15, { type: 'sine', slide: -200, vol: 0.15 }); this.noise(0.12, { vol: 0.08 }); }
  bump() { this.tone(160, 0.12, { slide: -80, vol: 0.15 }); }
  splash() { this.noise(0.25, { vol: 0.15 }); }
  crash() { this.noise(0.6, { vol: 0.3 }); this.tone(110, 0.5, { type: 'sawtooth', slide: -70, vol: 0.12 }); }
  trick(n = 1) { this.tone(660 + n * 110, 0.08); this.tone(880 + n * 110, 0.1, { delay: 0.07 }); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.1 })); }
  sad() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.16, { delay: i * 0.13, type: 'triangle', vol: 0.15 })); }

  startMusic() {
    this.musicWanted = true;
    if (!this.musicMuted) this._begin();
  }
  _begin() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    this.noteI = 0;
    this.nextNote = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 90);
  }
  schedule() {
    if (!this.musicOn) return;
    const MEL = [392, 494, 587, 494, 659, 587, 494, 392, 349, 440, 523, 440, 587, 523, 440, 349];
    const BASS = [98, 98, 131, 131, 110, 110, 87, 87];
    while (this.nextNote < this.ctx.currentTime + 0.3) {
      const d = this.nextNote - this.ctx.currentTime;
      const i = this.noteI;
      this.tone(MEL[i % 16], 0.13, { vol: 0.04, delay: d });
      if (i % 2 === 0) this.tone(BASS[(i / 2) % 8], 0.24, { type: 'triangle', vol: 0.06, delay: d });
      this.noteI++;
      this.nextNote += 0.15;
    }
  }
  stopMusic() { this.musicWanted = false; this._halt(); }
  _halt() { this.musicOn = false; clearInterval(this.timer); }
}

export const audio = new AudioSys();
