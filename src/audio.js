// WebAudio 8-bit synth: SFX + a small chiptune loop. Context unlocks on first input (iOS rule).
//
// On top of the synth there's a real-audio layer — voice callouts, an ocean bed and water
// impacts, in assets/audio/ (built by execution/wedge_game_audio.py). It is strictly
// additive: every clip is optional, and if a file fails to load or decode the game falls
// straight back to the chiptune version of that cue. Nothing waits on the network.
//
// Three buses so a voice line can duck the music without ducking itself:
//   musicBus — the chiptune loop only
//   sfxBus   — synth SFX + one-shot samples (voices, whistle, crashes)
//   ambBus   — the looping ocean bed, whose level tracks the wave

// name → file stem in assets/audio/. To replace a placeholder voice with a real recording,
// drop the file at the same path; nothing here knows or cares how it was made.
const CLIPS = {
  outdaback: 'voice_outdaback',
  hey: 'voice_hey',
  overthefalls: 'voice_overthefalls',
  hoot: 'voice_hoot',
  whistle: 'sfx_whistle',
  crash: 'sfx_crash',
  wash: 'sfx_wash',
  ocean: 'amb_ocean',
};

// Per-clip trim, so levels can be balanced without re-rendering the files.
const CLIP_VOL = {
  outdaback: 0.9, hey: 0.85, overthefalls: 0.9, hoot: 0.7,
  whistle: 0.5, crash: 0.55, wash: 0.4, ocean: 1,
};

const VOICES = ['outdaback', 'hey', 'overthefalls', 'hoot'];

class AudioSys {
  constructor() {
    try { this.musicMuted = localStorage.getItem('wedge-muted') === '1'; } catch (e) { this.musicMuted = false; }
    try { this.mutedAll = localStorage.getItem('wedge-muted-all') === '1'; } catch (e) { this.mutedAll = false; }
    this.musicWanted = false;
    this.buf = {};          // name → AudioBuffer, populated as each clip decodes
    this.ambWant = 0;       // where the ocean bed should sit right now (0 = off)
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    try { localStorage.setItem('wedge-muted', this.musicMuted ? '1' : '0'); } catch (e) { /* private mode */ }
    if (this.musicMuted) this._halt();
    else if (this.musicWanted && !this.mutedAll) this._begin();
  }

  // master mute — the on-screen button on mobile (M-key only toggles music). Silences
  // music AND sfx by gating tone()/noise() below and halting the music scheduler.
  toggleMute() {
    this.mutedAll = !this.mutedAll;
    try { localStorage.setItem('wedge-muted-all', this.mutedAll ? '1' : '0'); } catch (e) { /* private mode */ }
    if (this.mutedAll) this._halt();
    else if (this.musicWanted && !this.musicMuted) this._begin();
    this._applyAmb();
  }

  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
      if (this.ctx) {
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.ambBus = this.ctx.createGain();
        this.ambBus.gain.value = 0;
        for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(this.ctx.destination);
        this._loadClips();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.userPaused) this.ctx.resume();
  }

  // Fire-and-forget. A clip that 404s or fails to decode simply never appears in this.buf,
  // and every caller already has a chiptune fallback for that case.
  _loadClips() {
    if (this.loading) return;
    this.loading = true;
    for (const name in CLIPS) {
      fetch(`./assets/audio/${CLIPS[name]}.mp3?v=1`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((b) => {
          this.buf[name] = b;
          if (name === 'ocean') this._applyAmb();   // bed may have been wanted before it landed
        })
        .catch(() => { /* stay on the synth for this cue */ });
    }
  }

  pauseAll() {
    this.userPaused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }
  resumeAll() {
    this.userPaused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(f, dur, { type = 'square', vol = 0.12, delay = 0, slide = 0, bus = 'sfx' } = {}) {
    if (!this.ctx || this.mutedAll) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(bus === 'music' ? this.musicBus : this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, delay = 0 } = {}) {
    if (!this.ctx || this.mutedAll) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(this.sfxBus);
    src.start(t);
  }

  // ---------------- real audio

  loaded(name) { return !!this.buf[name]; }

  // One-shot sample. Returns false if the clip isn't available, which is how every caller
  // decides whether to fall back to the synth. Voice lines duck the music for their length.
  play(name, { vol = 1, rate = 1, delay = 0 } = {}) {
    if (!this.ctx || this.mutedAll || !this.buf[name]) return false;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buf[name];
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol * (CLIP_VOL[name] || 1);
    src.connect(g).connect(this.sfxBus);
    src.start(t);
    if (VOICES.includes(name)) this._duck(delay, this.buf[name].duration / rate);
    return true;
  }

  // Pull the chiptune down under a callout and let it back up after — the melody sits in
  // the same range as the shouts, and without this you hear that somebody spoke rather
  // than what they said.
  _duck(delay, dur) {
    if (!this.musicBus) return;
    const g = this.musicBus.gain, t = this.ctx.currentTime + Math.max(0, delay);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.35, t, 0.04);
    g.setTargetAtTime(1, t + dur + 0.12, 0.18);
  }

  // Speak a line, falling back to the given chiptune cue if the clip never loaded.
  say(name, fallback) {
    if (!this.play(name)) fallback && fallback();
  }

  // ---------------- ocean bed
  //
  // One looping source for the whole session, started on the first unlock and left running;
  // only its gain moves. Restarting a loop per wave costs a fade-in every time and, on iOS,
  // occasionally just doesn't.
  ambient(level) {
    if (Math.abs(level - this.ambWant) < 0.005) return;   // called every frame; most are no-ops
    this.ambWant = level;
    this._applyAmb();
  }

  _applyAmb() {
    if (!this.ctx || !this.ambBus) return;
    const want = this.mutedAll ? 0 : this.ambWant;
    if (want > 0 && !this.ambSrc && this.buf.ocean) {
      this.ambSrc = this.ctx.createBufferSource();
      this.ambSrc.buffer = this.buf.ocean;
      this.ambSrc.loop = true;
      this.ambSrc.connect(this.ambBus);
      this.ambSrc.start();
    }
    // slow ramp: the bed should swell with the wave, never step
    this.ambBus.gain.setTargetAtTime(want, this.ctx.currentTime, 0.35);
  }

  blip() { this.tone(880, 0.05, { vol: 0.08 }); }
  select() { this.tone(523, 0.05); this.tone(784, 0.08, { delay: 0.05 }); }
  tick() { this.tone(1200, 0.03, { vol: 0.07 }); }
  duckDive() { this.tone(300, 0.15, { type: 'sine', slide: -200, vol: 0.15 }); this.noise(0.12, { vol: 0.08 }); }
  bump() { this.tone(160, 0.12, { slide: -80, vol: 0.15 }); }
  splash() { if (!this.play('wash', { vol: 0.7, rate: 1.5 })) this.noise(0.25, { vol: 0.15 }); }
  // real water where there was a noise burst; the low tone stays underneath either way
  crash() {
    if (!this.play('crash')) this.noise(0.6, { vol: 0.3 });
    this.tone(110, 0.5, { type: 'sawtooth', slide: -70, vol: 0.12 });
  }
  wash(opts) { return this.play('wash', opts); }
  trick(n = 1) { this.tone(660 + n * 110, 0.08); this.tone(880 + n * 110, 0.1, { delay: 0.07 }); }
  jingle() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { delay: i * 0.1 })); }
  sad() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.16, { delay: i * 0.13, type: 'triangle', vol: 0.15 })); }

  startMusic() {
    this.musicWanted = true;
    if (!this.musicMuted && !this.mutedAll) this._begin();
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
      this.tone(MEL[i % 16], 0.13, { vol: 0.04, delay: d, bus: 'music' });
      if (i % 2 === 0) this.tone(BASS[(i / 2) % 8], 0.24, { type: 'triangle', vol: 0.06, delay: d, bus: 'music' });
      this.noteI++;
      this.nextNote += 0.15;
    }
  }
  stopMusic() { this.musicWanted = false; this._halt(); }
  _halt() { this.musicOn = false; clearInterval(this.timer); }
}

export const audio = new AudioSys();
