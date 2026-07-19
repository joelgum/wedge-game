// Game scenes. v2 loop: TITLE → SURF (one continuous view: watch → commit → tube ride)
// → WIPEOUT on mistakes → GAMEOVER. No paddle-out; you start in the lineup.
import { input } from './input.js?v=4';
import { audio } from './audio.js?v=4';
import { drawMap, drawHeart, MAPS } from './sprites.js?v=3';
import { loadScores, saveScore, qualifies } from './score.js?v=3';
import { mulberry32, hashStr } from './rng.js?v=1';

const W = 256, H = 240;

// ---- Daily Wave helpers (Phase 2) --------------------------------------------
// One seeded 10-wave run per UTC day, shareable as an emoji grid.
const DAILY_EPOCH = Date.UTC(2026, 6, 1);   // 2026-07-01 = DAILY #1
function dailyKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
function dailyNum() {
  const d = new Date();
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((today - DAILY_EPOCH) / 86400000) + 1;
}
function loadDaily() { try { return JSON.parse(localStorage.getItem('wedge-daily') || 'null'); } catch { return null; } }
function saveDaily(rec) { try { localStorage.setItem('wedge-daily', JSON.stringify(rec)); } catch { /* private mode */ } }
// per-wave outcome codes → share emoji + on-canvas swatch colour
const GRID_EMOJI = { slot: '🟩', clean: '🟦', late: '🟨', wipe: '🟥', waste: '⬜', good: '🧠' };
const GRID_COLOR = { slot: '#4cc94c', clean: '#4c9cf8', late: '#f8d848', wipe: '#f85838', waste: '#e8e8f0', good: '#b8a8f8' };
function shareText(num, score, grid) {
  return `WEDGE! DAILY #${num}  ${score.toLocaleString()}\n${grid.map((c) => GRID_EMOJI[c] || '').join('')}`;
}
function newDailyRand() { return mulberry32(hashStr(dailyKey())); }

// Preloaded background art (Midjourney-derived, served from ./assets/ by serve.py).
// Scenes draw these when loaded and fall back to procedural rendering until then.
const IMG = {};
function loadImg(key, file) { const i = new Image(); i.src = './assets/' + file + '?v=15'; IMG[key] = i; }
function imgReady(key) { const i = IMG[key]; return i && i.complete && i.naturalWidth > 0; }
loadImg('title', 'title.png');
loadImg('select', 'select.png');
loadImg('gameover', 'gameover.png');
// day-progression backdrops for the surf scene, indexed by game.stage (see PALETTES)
loadImg('bg_dawn', 'bg_dawn.png');
loadImg('bg_morning', 'bg_morning.png');
loadImg('bg_afternoon', 'bg_afternoon.png');
loadImg('bg_sunset', 'bg_sunset.png');
const BG_KEYS = ['bg_dawn', 'bg_morning', 'bg_afternoon', 'bg_sunset'];
// Gemini rider art (transparent, already facing travel direction). Poses per rider:
//   boarder — sit (lineup), paddle (prone), drop (pitching in), ride;
//   surfer  — tread (lineup), prone (paddle+ride), drop (diving in).
loadImg('sp_b_sit', 'spr_b_sit.png');
loadImg('sp_b_paddle', 'spr_b_paddle.png');
loadImg('sp_b_drop', 'spr_b_drop.png');
loadImg('sp_b_ride', 'spr_b_ride.png');
loadImg('sp_s_tread', 'spr_s_tread.png');
loadImg('sp_s_prone', 'spr_s_prone.png');
loadImg('sp_s_drop', 'spr_s_drop.png');
loadImg('sp_s_spin', 'spr_s_spin.png');   // arms-out "U" — the ragdoll toss on a pitched wipeout
const RIDER_ART = {
  boarder: { sit: 'sp_b_sit', paddle: 'sp_b_paddle', drop: 'sp_b_drop', ride: 'sp_b_ride' },
  surfer: { sit: 'sp_s_tread', paddle: 'sp_s_prone', drop: 'sp_s_drop', ride: 'sp_s_prone' },
};
// Phase 3 rider identity: the sponger holds a wider pocket for steady points; the
// bodysurfer works a tighter pocket but scores harder in the tube and off the exit.
// band/tube/exit are multipliers on the base pocket width, tube scoring, and exit bonus.
const RIDER_STATS = {
  boarder: { band: 1.25, tube: 1.0, exit: 1.0 },
  surfer: { band: 0.85, tube: 1.4, exit: 1.25 },
};

// Draw a rider-art frame centered at (cx, cy) with optional rotation, crisp (no smoothing).
// Returns false if the image isn't loaded yet so callers can fall back to procedural sprites.
function drawRiderImg(ctx, key, cx, cy, rot = 0, dy = 0, scale = 1) {
  const img = IMG[key];
  if (!(img && img.complete && img.naturalWidth > 0)) return false;
  const w = img.naturalWidth, h = img.naturalHeight;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(cx), Math.round(cy + dy));
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2));
  ctx.restore();
  return true;
}

// Day progression palettes: dawn → morning → afternoon → maxing sunset.
const PALETTES = [
  { name: 'DAWN PATROL', skyTop: '#f8b8d8', skyBot: '#f8d8b8', sea: '#88c8d0', seaD: '#5aa0b0', foam: '#f8f8f0', sand: '#e8c878', text: '#402048' },
  { name: 'MID-MORNING', skyTop: '#58b8f8', skyBot: '#b8e0f8', sea: '#2888c8', seaD: '#1868a8', foam: '#ffffff', sand: '#f0d080', text: '#083058' },
  { name: 'AFTERNOON', skyTop: '#3078d8', skyBot: '#88b8e8', sea: '#1858a0', seaD: '#0f4080', foam: '#e8f0f8', sand: '#d8b868', text: '#082848' },
  { name: 'MAXING SUNSET', skyTop: '#f86820', skyBot: '#f8b040', sea: '#284878', seaD: '#182858', foam: '#f8e0c0', sand: '#b88850', text: '#401810' },
];

const SURFACE = 170; // wave/ride waterline (bottom of the face)
const LINEUP_Y = 132; // where the waiting pack sits — out in the water, off the sand

function text(ctx, s, x, y, size = 8, color = '#fff', align = 'left') {
  ctx.font = `bold ${size}px 'Courier New', monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.fillText(s, Math.round(x), Math.round(y));
}

function skyAndSea(ctx, pal) {
  ctx.fillStyle = pal.skyTop; ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = pal.skyBot; ctx.fillRect(0, 64, W, 46);
  ctx.fillStyle = pal.sea; ctx.fillRect(0, 110, W, SURFACE - 110);
  ctx.fillStyle = pal.seaD; ctx.fillRect(0, SURFACE, W, H - SURFACE);
}

export function makeScenes(game) {
  const pal = () => PALETTES[game.stage];

  // player sprite set keyed by the chosen rider (see select scene / PLAN.md §5)
  const SPR = {
    boarder: { paddleA: MAPS.paddleA, paddleB: MAPS.paddleB, ride: MAPS.trim },
    surfer: { paddleA: MAPS.surfPaddleA, paddleB: MAPS.surfPaddleB, ride: MAPS.surfTrim },
  };
  const spr = () => SPR[game.rider] || SPR.boarder;
  const riderKey = (pose) => (RIDER_ART[game.rider] || RIDER_ART.boarder)[pose];
  const stat = () => RIDER_STATS[game.rider] || RIDER_STATS.boarder;

  // score multiplier from the current streak: 1 → 1.5 → 2 … capped at 4×
  const streakMult = () => Math.min(4, 1 + game.streak * 0.5);
  const multFmt = (m) => m.toFixed(1).replace(/\.0$/, '');

  function hud(ctx) {
    for (let i = 0; i < 3; i++) drawHeart(ctx, 6 + i * 10, 5, i < game.lives);
    text(ctx, String(Math.floor(game.score)).padStart(6, '0'), W - 6, 5, 8, '#fff', 'right');
    if (game.streak > 0) text(ctx, `x${multFmt(streakMult())}`, W - 6, 15, 8, '#f8d848', 'right');
    else if (audio.musicMuted) text(ctx, '♪ OFF', W - 6, 15, 7, '#a8a8b8', 'right');
    const label = game.daily ? `DAILY ${game.wave}/10` : `WAVE ${game.wave}`;
    text(ctx, `${label} · ${pal().name}`, W / 2, 5, 7, '#fff', 'center');
  }

  // ---------------------------------------------------------------- TITLE
  const title = {
    t: 0,
    enter() { this.t = 0; this.menu = 0; audio.stopMusic(); },
    // ARCADE = endless seeded-by-Math.random run; DAILY WAVE = today's shared 10-wave seed
    startMode(pick) {
      audio.ensure(); audio.select();
      if (pick === 0) {                       // ARCADE
        game.daily = false; game.rand = Math.random;
        game.goto('select');
      } else {                                // DAILY WAVE
        const rec = loadDaily();
        if (rec && rec.date === dailyKey()) { // already played today — show the locked result
          game.goto('dailyresult', { stored: rec, dayNum: dailyNum() });
        } else {
          game.daily = true; game.rand = newDailyRand(); game.dailyGrid = [];
          game.goto('select');
        }
      }
    },
    update(dt) {
      this.t += dt;
      if (input.pressed('left') && this.menu !== 0) { this.menu = 0; audio.blip(); }
      if (input.pressed('right') && this.menu !== 1) { this.menu = 1; audio.blip(); }
      if (input.pressed('up') || input.pressed('down')) { this.menu = this.menu ? 0 : 1; audio.blip(); }
      if (input.pressed('start') || input.pressed('a')) {
        let pick = this.menu;
        if (input.usedTouch && input.touch.x) pick = input.touch.x < W / 2 ? 0 : 1;
        this.menu = pick;
        this.startMode(pick);
      }
    },
    draw(ctx) {
      const p = PALETTES[Math.floor(this.t / 5) % 4];
      if (imgReady('title')) {
        ctx.drawImage(IMG.title, 0, 0, W, H);   // "WEDGE!" + subtitle are baked into the art
      } else {                                    // procedural fallback until the art loads
        skyAndSea(ctx, p);
        ctx.fillStyle = p.foam;
        for (let x = 0; x < W; x += 2) {
          const y = 150 + Math.sin(x * 0.06 + this.t * 3) * 6;
          ctx.fillRect(x, Math.round(y), 2, 3);
        }
        drawMap(ctx, MAPS.gull, 40 + Math.sin(this.t) * 20, 30);
        drawMap(ctx, MAPS.gull, 190 - Math.sin(this.t * 0.7) * 16, 44);
        text(ctx, 'WEDGE!', W / 2 + 3, 63, 44, '#181820', 'center');
        text(ctx, 'WEDGE!', W / 2, 60, 44, '#f8f8f8', 'center');
      }
      // dynamic prompts on a legibility strip along the bottom (works over art or fallback)
      ctx.fillStyle = 'rgba(8,8,24,0.62)'; ctx.fillRect(0, 164, W, H - 164);
      // mode menu: ARCADE (left) / DAILY WAVE (right)
      const blink = Math.floor(this.t * 3) % 2 === 0;
      const mk = (s, x, on) => text(ctx, on && blink ? `▸${s}◂` : s, x, 168, 9, on ? '#f8f848' : '#c8c8d8', 'center');
      mk('ARCADE', W / 2 - 58, this.menu === 0);
      mk('DAILY WAVE', W / 2 + 52, this.menu === 1);
      text(ctx, input.usedTouch ? 'TAP A MODE TO START' : '←→ CHOOSE · X START', W / 2, 182, 7, '#fff', 'center');
      text(ctx, 'KEYS: ←→ MOVE · X GO · ↑↓ TUBE · P PAUSE · M MUSIC', W / 2, 198, 7, '#e8e8e8', 'center');
      text(ctx, 'TOUCH: DRAG TO MOVE · TAP TO GO', W / 2, 207, 7, '#e8e8e8', 'center');
      const hs = loadScores();
      text(ctx, `HI ${String(hs.length ? hs[0].score : 0).padStart(6, '0')} ${hs.length ? hs[0].initials : '---'}`, W / 2, 216, 8, '#f8d848', 'center');
      if (audio.musicMuted) text(ctx, '♪ OFF', W - 6, 5, 7, '#a8a8b8', 'right');
    },
  };

  // ---------------------------------------------------------------- SELECT (choose your rider)
  const RIDERS = [
    { id: 'boarder', name: 'WEDGE SPONGER', lines: ['WEDGE SPONGER'], stat: ['WIDER POCKET', 'STEADY POINTS'] },
    { id: 'surfer', name: 'WEDGE BODYSURF CHARGER', lines: ['WEDGE BODYSURF', 'CHARGER'], stat: ['TIGHT POCKET', 'BIG POINTS'] },
  ];  // boarder = left panel, surfer = right
  const SEL_PANELS = [{ x: 4, w: 122 }, { x: 130, w: 122 }];
  const SEL_PY = 41, SEL_PH = 195, CONF_DUR = 0.9;  // confirm beat before dropping in
  const select = {
    enter() { this.t = 0; this.sel = game.rider === 'surfer' ? 1 : 0; this.confirming = false; this.confT = 0; this.pick = 0; },
    update(dt) {
      this.t += dt;
      if (this.confirming) {                 // locked-in beat: hold, then drop in
        this.confT -= dt;
        if (this.confT <= 0) {
          game.rider = RIDERS[this.pick].id;
          game.reset();
          game.goto('surf');
        }
        return;
      }
      if (input.pressed('left') && this.sel !== 0) { this.sel = 0; audio.blip(); }
      if (input.pressed('right') && this.sel !== 1) { this.sel = 1; audio.blip(); }
      if (input.pressed('a') || input.pressed('start')) {
        // touch: the tapped side picks directly; keyboard: the cursor's side
        let pick = this.sel;
        if (input.usedTouch && input.touch.x) pick = input.touch.x < W / 2 ? 0 : 1;
        this.pick = pick; this.sel = pick;
        this.confirming = true; this.confT = CONF_DUR;
        audio.ensure(); audio.select();      // confirmation sound
      }
    },
    draw(ctx) {
      if (imgReady('select')) {
        ctx.drawImage(IMG.select, 0, 0, W, H);
      } else {                        // fallback until the art loads
        skyAndSea(ctx, PALETTES[0]);
        text(ctx, 'SELECT YOUR RIDER', W / 2, 22, 12, '#f8f8f8', 'center');
      }
      if (this.confirming) {
        // punch-zoom the chosen rider forward against a dimmed screen — the "movement"
        const b = SEL_PANELS[this.pick];
        const prog = 1 - this.confT / CONF_DUR;                 // 0 → 1
        const zoom = 1 + 0.22 * Math.sin(Math.min(1, prog * 2.4) * Math.PI * 0.5);
        const cx = b.x + b.w / 2, cy = SEL_PY + SEL_PH / 2;
        const dw = b.w * zoom, dh = SEL_PH * zoom;
        ctx.fillStyle = 'rgba(6,6,18,0.58)'; ctx.fillRect(0, 0, W, H);
        if (imgReady('select')) ctx.drawImage(IMG.select, b.x, SEL_PY, b.w, SEL_PH, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.strokeStyle = Math.floor(this.t * 14) % 2 === 0 ? '#ffffff' : '#f8f848';
        ctx.lineWidth = 3; ctx.strokeRect(cx - dw / 2, cy - dh / 2, dw, dh);
        text(ctx, RIDERS[this.pick].name, W / 2, 22, 11, '#f8f848', 'center');
        text(ctx, 'DROPPING IN...', W / 2, H - 18, 9, '#fff', 'center');
        return;
      }
      // selection over the two panels baked into the art (boarder left, surfer right)
      for (let i = 0; i < 2; i++) {
        const b = SEL_PANELS[i];
        if (i === this.sel) {
          ctx.strokeStyle = '#f8f848'; ctx.lineWidth = 2;
          ctx.strokeRect(b.x, SEL_PY, b.w, SEL_PH);
        } else {
          ctx.fillStyle = 'rgba(8,8,24,0.4)';   // dim the unchosen side
          ctx.fillRect(b.x, SEL_PY, b.w, SEL_PH);
        }
        // rider name on a strip at the bottom of each panel
        const lines = RIDERS[i].lines, cx = b.x + b.w / 2, ly = SEL_PY + SEL_PH - 18 - lines.length * 9;
        // stat line sits just above the name strip (Phase 3 rider identity)
        const stats = RIDERS[i].stat || [], sYy = ly - 6 - stats.length * 8;
        ctx.fillStyle = 'rgba(8,8,24,0.6)'; ctx.fillRect(b.x, sYy - 2, b.w, stats.length * 8 + 4);
        stats.forEach((ln, j) => text(ctx, ln, cx, sYy + j * 8, 7, i === this.sel ? '#8ce8a0' : '#9cb4a4', 'center'));
        ctx.fillStyle = 'rgba(8,8,24,0.66)'; ctx.fillRect(b.x, ly - 2, b.w, lines.length * 9 + 4);
        lines.forEach((ln, j) => text(ctx, ln, cx, ly + j * 9, 8, i === this.sel ? '#f8f848' : '#dcdce4', 'center'));
      }
      if (Math.floor(this.t * 2) % 2 === 0) {
        const hint = input.usedTouch ? 'TAP A RIDER TO START' : '← → CHOOSE · X TO START';
        ctx.fillStyle = 'rgba(8,8,24,0.72)'; ctx.fillRect(0, H - 15, W, 15);
        text(ctx, hint, W / 2, H - 12, 8, '#fff', 'center');
      }
    },
  };

  // ---------------------------------------------------------------- SURF (watch + ride, one view)
  const surf = {
    enter() {
      this.px = 128;
      this.animT = 0;
      this.mode = 'watch';
      this.msg = null; this.msgSub = null; this.msgT = 0;
      this.floaters = [];
      this.riders = [
        { x: 40, ph: 0 }, { x: 74, ph: 2.1 }, { x: 120, ph: 4.2 },
      ];
      this.newWave();
      audio.ensure(); audio.startMusic();
    },

    say(msg, sub, secs = 1.8) { this.msg = msg; this.msgSub = sub; this.msgT = secs; },

    newWave() {
      game.wave++;
      // Daily ramps the stage on a fixed cadence (every 3 waves) so the run is identical
      // for everyone; arcade ramps on makes (see updateRide). rand is seeded in daily.
      if (game.daily) game.stage = Math.min(3, Math.floor((game.wave - 1) / 3));
      const st = game.stage;
      const rand = game.rand || Math.random;
      this.wv = {
        t: 0,
        T: Math.max(6.5, 10 - st),                       // build-up time: room to read + position
        A: Math.min(116, 78 + st * 12 + rand() * 16),    // face height — most of the screen by sunset
        peak: 50 + rand() * 120,
        drift: (rand() < 0.5 ? -1 : 1) * (8 + rand() * 12 + st * 5),
        // stage 2+: the wedge backwash flips the peak's direction once mid-build
        flipAt: st >= 2 ? (Math.max(6.5, 10 - st)) * (0.55 + rand() * 0.25) : 0,
        sigma: 62,
        makeable: rand() > 0.32 + st * 0.08,
      };
      // rare trap: a makeable-LOOKING wave that's simply too big to make. It feathers
      // like a catchable one, but it's abnormally tall — the size is the only tell.
      // Commit and you're pitched over the falls; read it and let it go for a bonus.
      if (this.wv.makeable && rand() < 0.1) {
        this.wv.monster = true;
        this.wv.A = Math.min(158, 128 + st * 8 + rand() * 18);
        // Phase 4 — the clip moment: the first monster at stage ≥ 2 in an arcade session
        // is a makeable BOMB. Same feathering tell, but it rumbles early (see updateWatch).
        if (!game.daily && st >= 2 && !game.bombUsed) {
          this.wv.rideable = true;
          game.bombUsed = true;
        }
      }
      this.committed = false;
      this.rumbled = false;
      this.holdT = 0;   // brief peak-drift freeze while a teaching callout is up (Phase 1)
      this.moveT = 0;           // >0 while repositioning, so the rider shows prone (not sitting)
      this.isBomb = false;      // set true when you commit to a monster — drives the instant replay
      this.recording = false; this.recBuf = null;
      this.mode = 'watch';
    },

    peakX() { return this.wv.peak; },
    sweetX() { return Math.min(226, this.peakX() + 26); }, // shoulder side of the peak
    q() { return Math.min(1, this.wv.t / this.wv.T); },
    waveH(x, q) {
      const w = this.wv;
      let g = Math.exp(-(((x - this.peakX()) / w.sigma) ** 2));
      if (!w.makeable) g = Math.min(1, g * 1.7);          // squared-off wall = closeout
      return w.A * Math.pow(q, 1.4) * g;
    },

    // ---------------- update
    update(dt) {
      this.animT += dt;
      if (this.msgT > 0) this.msgT -= dt;
      for (const f of this.floaters) { f.t -= dt; f.y -= 14 * dt; }
      this.floaters = this.floaters.filter((f) => f.t > 0);
      if (this.mode === 'replayPrompt') { this.updateReplayPrompt(dt); return; }
      if (this.mode === 'replay') { this.updateReplay(dt); return; }
      const m = this.mode;
      if (m === 'watch') this.updateWatch(dt);
      else if (m === 'ride') this.updateRide(dt);
      else if (m === 'exit') this.updateExit(dt);
      else this.updatePitch(dt);
      // record the bomb's drop+ride frame-by-frame (only while still in that phase, so the
      // completing frame that flips to exit/wipeout isn't captured) — see startReplayPrompt
      if (this.recording && this.mode === m && (m === 'ride' || m === 'pitch')) this.recSnap(m);
    },

    updateWatch(dt) {
      const w = this.wv;
      // committing breaks the wave NOW: the build fast-forwards, the peak stops
      // wandering, and your grade was sealed the instant you pressed
      w.t += this.committed ? dt * 6 : dt;
      // Phase 1 — teach the tell: the first makeable and first closeout of a session
      // (waves 1–2) each pause the drift for a beat and point at the feathering.
      if (this.holdT > 0) this.holdT -= dt;
      if (!game.daily && !this.committed && this.q() > 0.5 && game.wave <= 2) {
        if (w.makeable && !w.monster && !game.taughtMakeable) {
          game.taughtMakeable = true;
          this.say('WATCH THE SPRAY', 'FEATHERS AT THE PEAK = RIDEABLE', 1.8);
          this.holdT = 1.5;
        } else if (!w.makeable && !game.taughtCloseout) {
          game.taughtCloseout = true;
          this.say('FEATHERS EVERYWHERE = WALL', 'LET IT GO', 1.8);
          this.holdT = 1.5;
        }
      }
      if (!this.committed && this.holdT <= 0) {
        // the peak wanders and bounces off the edges instead of pinning there
        w.peak += w.drift * dt;
        if (w.peak < 34 || w.peak > 198) {
          w.drift = -w.drift;
          w.peak = Math.max(34, Math.min(198, w.peak));
        }
        if (w.flipAt && w.t >= w.flipAt) { w.drift = -w.drift; w.flipAt = 0; }
      }
      // the ocean announces the wave standing up — a rideable BOMB rumbles early (Phase 4),
      // the learnable tell that this monster is on rather than a trap
      if (!this.rumbled && this.q() > (w.rideable ? 0.55 : 0.75)) {
        this.rumbled = true;
        audio.tone(55, 0.9, { type: 'triangle', vol: 0.1, slide: 30 });
        audio.noise(0.7, { vol: 0.05 });
      }
      if (!this.committed) {
        const prevPx = this.px;
        if (input.held('left')) this.px -= 85 * dt;
        if (input.held('right')) this.px += 85 * dt;
        // relative slide: the rider moves by how far you slide, never jumps to the finger
        if (input.touch.active && input.touch.dragging) this.px += input.touch.dx * 1.5;
        input.touch.dx = 0;
        this.px = Math.max(24, Math.min(232, this.px));
        // paddling to reposition: any left/right movement drops the rider prone (a short
        // linger holds the pose through tiny pauses) before the auto-paddle at stand-up
        this.moveT = Math.abs(this.px - prevPx) > 0.05 ? 0.35 : Math.max(0, (this.moveT || 0) - dt);
        // commit = catch THIS wave, right where you are, right now
        if (input.pressed('a') && this.q() > 0.25) {
          this.committed = true;
          this.commitD = Math.abs(this.px - this.sweetX());
          audio.select();
        }
      }
      if (w.t < w.T) return;

      // the wave arrives — judgement was sealed at the commit instant
      const tol = Math.max(9, 16 - game.stage * 2);
      const d = this.committed ? this.commitD : 0;
      const mult = streakMult();
      if (!this.committed) {
        // letting waves go never touches the streak (GOOD CALL / WAVE WASTED)
        if (w.monster) { game.score += 150; this.say('GOOD CALL', 'TOO BIG — LET IT GO  +150'); audio.select(); this.recordAndAdvance('good'); }
        else if (w.makeable) { this.say('WAVE WASTED', 'THAT ONE WAS A RUNNER'); this.recordAndAdvance('waste'); }
        else { game.score += 150; this.say('GOOD CALL', 'CLOSEOUT — LET IT GO  +150'); audio.select(); this.recordAndAdvance('good'); }
      } else if (w.monster) {
        // committing to a bomb — the clip moment. Record the drop+ride so we can offer an
        // instant replay whether it's a made ride or a pitched wipeout (see updateExit/Pitch).
        this.isBomb = true;
        if (w.rideable && d <= tol) { this.rideBomb(); this.beginRecord('ride'); }
        else { this.startPitch(); this.beginRecord('pitch'); }   // off-slot bomb / trap monster — over the falls
      } else if (!w.makeable) {
        game.goto('wipeout', { reason: 'CLOSED OUT!', detail: 'THAT WAVE WAS A WALL — NO EXIT',
          mark: { px: this.px, wall: true } });
      } else if (d <= tol * 0.5) {
        this.awardDrop(800, mult, 'IN THE SLOT!');
        this.startRide(false, 'slot');
      } else if (d <= tol) {
        this.awardDrop(500, mult, 'CLEAN DROP');
        this.startRide(false, 'clean');
      } else if (d <= tol * 1.9) {
        this.awardDrop(150, mult, 'LATE DROP!', 'HANG ON...');
        game.streak = 0;   // a late drop breaks the combo
        this.startRide(true, 'late');
      } else {
        game.goto('wipeout', { reason: 'PITCHED!', detail: 'TOO FAR FROM THE PEAK',
          mark: { px: this.px, sweet: this.sweetX(), tol, off: d } });
      }
    },

    // Phase 4 — ride the bomb: flat +2000, a bigger, gnarlier pocket, doubled exit bonus.
    rideBomb() {
      game.score += 2000;
      this.say('BOMB! +2000', 'RIDE OF THE DAY', 2.4);
      this.floaters.push({ txt: '+2000', x: this.px, y: 116, t: 1.8 });
      this.startRide(false, 'slot');
      this.pAmp *= 1.5;          // wilder pocket swings on the bomb
      this.bombRide = true;      // doubles the exit trick bonus (see updateExit)
      // distinct triumphant sting so the make reads instantly
      audio.crash();
      audio.tone(220, 0.16, { type: 'square', vol: 0.12 });
      audio.tone(330, 0.16, { type: 'square', vol: 0.12, delay: 0.13 });
      audio.tone(440, 0.4, { type: 'square', vol: 0.12, slide: 160, delay: 0.26 });
    },

    // award a multiplied drop bonus, flash the total + combo, and float a popup
    awardDrop(base, mult, label, sub = 'DROPPING IN...') {
      const b = Math.round(base * mult);
      game.score += b;
      const tag = mult > 1 ? ` x${multFmt(mult)}` : '';
      this.say(`${label} +${b}${tag}`, sub, 1.8);
      this.floaters.push({ txt: `+${b}${tag}`, x: this.px, y: 116, t: 1.4 });
    },

    // Daily: log the wave outcome and end the run after wave 10; otherwise roll on.
    recordAndAdvance(code) {
      if (game.daily) {
        game.dailyGrid.push(code);
        if (game.wave >= 10) { game.goto('dailyresult', { dateKey: dailyKey(), dayNum: dailyNum() }); return; }
      }
      this.newWave();
    },

    startRide(late, tier) {
      this.mode = 'ride';
      this.rt = 0;
      this.dropDur = 2.8;             // the drop: long hang at the lip, then the bottom falls out
      this.dropT = this.dropDur;
      this.late = late;
      this.dropTier = tier;          // 'slot' | 'clean' | 'late' — drives streak + daily grid
      // camera travels with the rider: foam edge holds frame-left, textures carry the speed
      this.foamX = Math.min(this.peakX(), 80);
      this.peel = 34 + game.stage * 7;
      // pocket gets bigger swings and faster rhythm as the day builds;
      // a late drop adds extra chaos that settles after ~1.5s (the "hang on" window)
      this.pAmp = 12 + game.stage * 3.5;
      this.lateAmp = late ? 8 : 0;
      this.pFreq = 2.0 + game.stage * 0.25;
      this.dropY0 = SURFACE - this.wv.A + 2;   // on the lip, top of the face
      this.py = this.dropY0;
      input.touch.dx = 0; input.touch.dy = 0;   // don't inherit a stale swipe from the lineup
      // falling whoosh, timed to when the bottom drops out
      audio.tone(900, 1.1, { type: 'sawtooth', slide: -760, vol: 0.09, delay: 1.0 });
      audio.noise(0.4, { vol: 0.06, delay: 1.3 });
      this.pocketPh = Math.random() * 6;
      this.buried = 0;
      this.tubeTime = 0;
      this.rideLen = 3.0 + Math.random() * 1.6;
      this.band = 15 * stat().band;   // per-rider pocket width (Phase 3)
      this.spinT = 0;                 // remaining spin-trick time
      this.spinCd = 0;                // spin cooldown — max one per second
      this.bombRide = false;          // set true by rideBomb() — doubles the exit bonus
    },

    // ---- PITCH: committed to a bomb. A slow, dramatic beat — he drops in, hangs at
    //      the lip, gets thrown over the falls (slow-mo), the wave lands (screen shake)
    //      and buries him, then WIPEOUT. Phase timings below. (monster waves only)
    pitchPhase() { return { HANG: 1.0, DROP: 2.0, TOSS: 4.4, END: 5.6 }; },
    startPitch() {
      this.mode = 'pitch';
      this.pT = 0;
      this.pDur = this.pitchPhase().END;
      this.lipX = this.peakX();
      this.takeX = Math.min(206, this.sweetX());          // where he committed / drops in
      this.pSpin = (Math.random() < 0.5 ? -1 : 1);
      this.pSmashed = false;
      this.pThrown = false;
      this.shake = 0;
      this.msgT = 0;   // drawPitch owns the on-screen headline; clear any lingering message
      audio.tone(58, 1.4, { type: 'triangle', vol: 0.1, slide: 22 });   // low rumble jacking up
    },

    updatePitch(dt) {
      this.pT += dt;
      const ph = this.pitchPhase();
      if (!this.pThrown && this.pT >= ph.DROP) {          // thrown over the falls
        this.pThrown = true;
        audio.tone(760, 1.3, { type: 'sawtooth', slide: -640, vol: 0.08 });
      }
      if (!this.pSmashed && this.pT >= ph.TOSS) {          // the wave lands on him
        this.pSmashed = true;
        this.shake = 6;
        audio.crash();
        audio.noise(0.8, { vol: 0.17 });
      }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 9);
      if (this.pT >= this.pDur) {
        if (this.isBomb) { this.startReplayPrompt(() => game.goto('wipeout', { reason: 'OVER THE FALLS!', detail: 'TOO BIG — YOU GOT PITCHED' })); return; }
        game.goto('wipeout', { reason: 'OVER THE FALLS!', detail: 'TOO BIG — YOU GOT PITCHED' });
      }
    },

    drawPitch(ctx, p) {
      const w = this.wv;
      const ph = this.pitchPhase();
      const crestY = SURFACE - w.A;
      // the towering wall, peaking where the lip throws
      for (let x = 0; x < W; x += 2) {
        const g = Math.exp(-(((x - this.lipX) / 74) ** 2));
        const h = w.A * g * 1.02;
        if (h < 2) continue;
        const top = SURFACE - h;
        ctx.fillStyle = p.seaD; ctx.fillRect(x, Math.round(top), 2, H - Math.round(top));
        ctx.fillStyle = p.sea;  ctx.fillRect(x, Math.round(top + h * 0.4), 2, Math.round(h * 0.6));
        // crest feathers menacingly while it stands and he drops in
        if (this.pT < ph.DROP && Math.abs(x - this.lipX) < 42 && (x + Math.floor(this.animT * 10)) % 4 < 2) {
          ctx.fillStyle = p.foam; ctx.fillRect(x, Math.round(top) - 2, 2, 4);
        }
      }
      // the lip pitches over once the drop fails — churning curtain, grows through the toss
      const fall = Math.max(0, Math.min(1, (this.pT - ph.DROP) / 1.2));
      if (fall > 0) {
        for (let x = Math.round(this.lipX - 46); x < this.lipX + 52; x += 2) {
          if (x < 0 || x >= W) continue;
          const col = (x - this.lipX) / 50;
          const jag = 1 + Math.sin(x * 0.5 + this.pT * 12) * 0.12 + ((x * 7) % 5) * 0.03;
          const len = Math.max(2, (w.A * 0.85) * fall * (1 - Math.abs(col) * 0.42) * jag);
          ctx.fillStyle = 'rgba(232,240,248,0.72)';
          ctx.fillRect(x, Math.round(crestY), 2, Math.round(len));
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(crestY + len - 5), 2, 5);
          ctx.fillRect(x + (((x + Math.floor(this.pT * 20)) % 6) - 3), Math.round(crestY + len), 3, 3);
        }
      }
      // spray bursting off the detonation
      if (this.pT > ph.TOSS - 0.5) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const rr = (this.pT - (ph.TOSS - 0.5)) * 130;
        for (let i = 0; i < 26; i++) {
          const a = i * 0.62;
          ctx.fillRect(Math.round(this.lipX + Math.cos(a) * rr), Math.round((crestY + 12) + Math.sin(a) * rr * 0.55), 2, 2);
        }
      }

      // ---- the rider, per phase (bigger/closer than a normal ride so the toss reads) ----
      let rx, ry, rot, key, scale;
      if (this.pT < ph.HANG) {
        // HANG: poised at the lip, teetering — the "oh no" beat
        rx = this.takeX;
        ry = crestY + 7 + Math.sin(this.pT * 5) * 2;
        rot = 0.12 + (this.pT / ph.HANG) * 0.12;
        key = riderKey('drop');
        scale = 1.3;
        if (Math.floor(this.pT * 5) % 2) text(ctx, 'HANG ON!', W / 2, 30, 11, '#f8f890', 'center');
      } else if (this.pT < ph.DROP) {
        // DROP: he goes for it — dropping down the huge face, accelerating, nose-down
        const dp = (this.pT - ph.HANG) / (ph.DROP - ph.HANG);
        rx = this.takeX + dp * 12;
        ry = crestY + 7 + dp * dp * (w.A * 0.5);
        rot = 0.24 + dp * 0.5;
        key = riderKey('drop');
        scale = 1.3 + dp * 0.15;
        text(ctx, 'TOO BIG!', W / 2, 30, 11, '#f8f890', 'center');
      } else if (this.pT < ph.TOSS) {
        // TOSS: pitched over the falls — slow-mo ragdoll tumble, thrown up and over
        const tp = (this.pT - ph.DROP) / (ph.TOSS - ph.DROP);
        const rx0 = this.takeX + 12, ry0 = crestY + 7 + w.A * 0.5;
        rx = rx0 + tp * 24;
        ry = ry0 - Math.sin(tp * Math.PI * 0.8) * 42 + tp * 34;   // up over the falls, then down
        rot = this.pSpin * (0.5 + tp * Math.PI * 1.3);            // slow, helpless ~3/4 turn
        key = game.rider === 'surfer' ? 'sp_s_spin' : riderKey('ride');
        scale = 1.5 + tp * 0.35;                                  // grows toward the camera
        text(ctx, 'TOO BIG!', W / 2, 30, 11, '#f8f890', 'center');
      } else {
        // SMASH: buried where the lip landed
        rx = this.takeX + 34; ry = SURFACE - 22;
        rot = this.pSpin * 2.0;
        key = game.rider === 'surfer' ? 'sp_s_spin' : riderKey('ride');
        scale = 1.45;
      }
      if (!drawRiderImg(ctx, key, rx, ry, rot, 0, scale)) {
        ctx.save();
        ctx.translate(rx, ry); ctx.rotate(rot); ctx.scale(scale, scale);
        drawMap(ctx, game.rider === 'surfer' ? MAPS.surfT : spr().ride, -15, -6, 2);
        ctx.restore();
      }

      // the wave lands: bury him in churning whitewater
      if (this.pSmashed) {
        ctx.fillStyle = p.foam;
        for (let i = 0; i < 54; i++) {
          const fx = rx - 32 + ((i * 37) % 64);
          const fy = ry - 28 + ((i * 29) % 52) + Math.sin(this.pT * 20 + i) * 2;
          ctx.fillRect(Math.round(fx), Math.round(fy), 4, 4);
        }
        text(ctx, 'SMASHED!', W / 2, 42, 13, '#f85838', 'center');
      }
    },

    pocketX() { return Math.min(226, this.foamX + 18); },
    pocketY() {
      const amp = this.pAmp + this.lateAmp * Math.max(0, 1 - this.rt / 1.2);
      return 134 + Math.sin(this.rt * this.pFreq + this.pocketPh) * amp;
    },

    updateRide(dt) {
      if (this.dropT > 0) {
        // the drop: accelerating fall from the lip into the pocket, no bury risk yet
        this.dropT -= dt;
        this.foamX += this.peel * dt * 0.3;
        const k = Math.min(1, 1 - this.dropT / this.dropDur);
        // cubic ease-in: real hang time at the lip, then freefall
        this.py = this.dropY0 + (this.pocketY() - this.dropY0) * k * k * k
          + Math.sin(this.animT * 26) * (1 - k) * 1.5;  // teetering wobble while hanging
        if (this.dropT <= 0) {
          audio.splash();
          this.say('HOLD THE POCKET', input.usedTouch ? 'SLIDE ↑↓ ANYWHERE — STAY BETWEEN THE LINES' : '↑↓ STAY BETWEEN THE LINES', 2.6);
        }
        return;
      }
      this.rt += dt;
      // slow creep only — the foam never overruns the frame; speed reads via the streaming face
      this.foamX = Math.min(108, this.foamX + this.peel * dt * 0.4);

      // spin trick (Phase 3): X kicks off a ~0.6s spin. You can't steer while spinning —
      // the pocket keeps drifting, so a greedy spin can bury you. Max one per second.
      if (this.spinCd > 0) this.spinCd -= dt;
      if (this.spinT > 0) {
        this.spinT -= dt;
        if (this.spinT <= 0) {
          const b = Math.round(250 * streakMult());
          game.score += b;
          this.floaters.push({ txt: `SPIN +${b}`, x: this.pocketX(), y: this.py - 22, t: 1.4 });
          audio.trick();
        }
      } else {
        if (input.pressed('a') && this.spinCd <= 0) {
          this.spinT = 0.6; this.spinCd = 1.0;
          audio.tone(520, 0.4, { type: 'square', slide: 320, vol: 0.08 });
        }
        // steering only when not spinning
        if (input.held('up')) this.py -= 75 * dt;
        if (input.held('down')) this.py += 90 * dt;
        if (input.touch.active) this.py += input.touch.dy * 1.4;
      }
      this.py += 20 * dt;   // passive drift always applies — the spin's risk
      input.touch.dy = 0;
      this.py = Math.max(104, Math.min(166, this.py));

      const off = Math.abs(this.py - this.pocketY());
      const band = this.band;   // per-rider pocket width (Phase 3)
      if (off > band) this.buried += dt * (off > band + 12 ? 2.2 : 1);
      else this.buried = Math.max(0, this.buried - dt * 1.6);

      if (this.rt > 0.6) {
        this.tubeTime += dt;
        game.score += 60 * dt * stat().tube * (off <= band ? 1 : 0);
      }

      if (this.buried > 0.95) {
        if (this.isBomb) { this.startReplayPrompt(() => game.goto('wipeout', { reason: 'BURIED!', detail: 'YOU LOST THE POCKET' })); return; }
        game.goto('wipeout', { reason: 'BURIED!', detail: 'YOU LOST THE POCKET' });
        return;
      }
      if (this.rt >= this.rideLen) {
        // made it all the way through — big tube bonus, plus a trick bonus on landing
        const bonus = Math.round((500 + Math.round(this.tubeTime * 150)) * streakMult());
        game.score += bonus;
        game.made++;
        // a slot/clean ride made in full extends the streak; late drops already zeroed it
        if (this.dropTier !== 'late') game.streak++;
        if (game.daily) game.dailyGrid.push(this.dropTier);   // 🟩/🟦/🟨
        else if (game.made % 2 === 0) game.stage = Math.min(3, game.stage + 1);
        this.say('SPIT OUT!', `TUBE ${this.tubeTime.toFixed(1)}s  +${bonus}`, 2.6);
        this.floaters.push({ txt: `+${bonus}`, x: this.pocketX(), y: this.py - 20, t: 1.4 });
        // exit cinematic: race ahead of the closing wall, then land the finishing trick
        this.mode = 'exit';
        this.exT = 0;
        this.exX = this.pocketX() + 6;
        this.exY = this.py;
        this.exRot = 0;
        this.exRoll = 0;
        this.trickDone = false;
        this.exSplashed = false;
        this.closeSweep = this.foamX;   // closeout curtain starts behind him, sweeps right
        audio.noise(0.5, { vol: 0.22 });
        audio.tone(280, 0.5, { type: 'square', slide: 520, vol: 0.1 });
      }
    },

    updateExit(dt) {
      this.exT += dt;
      // the closeout curtain sweeps left → right; the whole wave shuts down by the end
      this.closeSweep += 70 * dt;
      if (this.exT < 0.9) {
        // race ahead of the closing wall along the open shoulder
        this.exX = Math.min(198, this.exX + 150 * dt);
        this.exY += (150 - this.exY) * Math.min(1, dt * 3);
        this.exRot = 0;
      } else {
        // the finishing trick, per rider
        const u = Math.min(1, (this.exT - 0.9) / 1.25);
        if (game.rider === 'boarder') {
          // re-entry: ride up the face, off the lip, back down, land it
          this.exY = 150 - Math.sin(u * Math.PI) * 64;
          this.exRot = -0.45 * Math.sin(u * Math.PI * 2);  // nose up climbing, nose down dropping, level on land
          this.exX = Math.min(212, this.exX + 16 * dt);
        } else {
          // lengthwise barrel roll: one slow 360 about the body's long axis, small hop
          this.exRoll = u * Math.PI * 2;    // 0..2π, faked in draw by a vertical flip/squash
          this.exRot = 0;
          this.exY = 146 - Math.sin(u * Math.PI) * 20;
          this.exX = Math.min(212, this.exX + 20 * dt);
        }
        if (u >= 1 && !this.trickDone) {
          this.trickDone = true;
          const tb = Math.round(750 * stat().exit * (this.bombRide ? 2 : 1));   // 1.25× surfer, 2× on a bomb
          game.score += tb;
          this.floaters.push({ txt: `TRICK +${tb}`, x: Math.min(196, this.exX), y: this.exY - 26, t: 1.8 });
          audio.trick();
        }
      }
      if (!this.exSplashed && this.exT > 0.9) { this.exSplashed = true; audio.crash(); }
      if (this.exT >= 2.9) {
        audio.jingle();
        // a made bomb ran the full drop+ride — offer the instant replay before rolling on
        if (this.isBomb) { this.startReplayPrompt(() => this.newWave()); return; }
        // daily grid was already recorded at ride completion; just end after wave 10
        if (game.daily && game.wave >= 10) game.goto('dailyresult', { dateKey: dailyKey(), dayNum: dailyNum() });
        else this.newWave();
      }
    },

    // ---------------- instant replay (bomb waves) -------------------------------
    // We record the drop+ride frame-by-frame as tiny numeric snapshots (not pixels), then
    // re-drive the existing drawRide/drawPitch off those snapshots at half speed. The wave's
    // constants (which don't change during the ride) are captured once in recConst.
    beginRecord(mode) {
      this.recMode = mode;
      this.recording = true;
      this.recBuf = [];
      this.recConst = mode === 'ride'
        ? { wv: this.wv, dropDur: this.dropDur, dropY0: this.dropY0, band: this.band,
            pAmp: this.pAmp, lateAmp: this.lateAmp, pFreq: this.pFreq, pocketPh: this.pocketPh,
            stage: game.stage }
        : { wv: this.wv, lipX: this.lipX, takeX: this.takeX, pSpin: this.pSpin, stage: game.stage };
    },
    recSnap(mode) {
      if (this.recBuf.length > 900) return;   // ~15s cap — a bomb never runs this long
      this.recBuf.push(mode === 'ride'
        ? { foamX: this.foamX, animT: this.animT, rt: this.rt, py: this.py,
            dropT: this.dropT, spinT: this.spinT, buried: this.buried, tubeTime: this.tubeTime }
        : { pT: this.pT, animT: this.animT, shake: this.shake, pSmashed: this.pSmashed });
    },
    // Offer the replay. `next` is the normal flow (newWave / goto wipeout) run once we're done.
    startReplayPrompt(next) {
      this.recording = false;
      this.replayNext = next;
      if (!this.recBuf || this.recBuf.length < 4) { next(); return; }   // nothing worth showing
      this._liveStage = game.stage;   // restored when the replay ends
      this.mode = 'replayPrompt';
      this.promptT = 0;
      audio.select();
    },
    updateReplayPrompt(dt) {
      this.promptT += dt;
      if (this.promptT < 0.35) return;   // brief guard so a lingering tap/press isn't consumed
      if (input.pressed('a')) { this.startReplay(); return; }
      if (input.pressed('b') || input.pressed('down') || input.pressed('start') || this.promptT > 8) {
        this.finishReplay();
      }
    },
    startReplay() {
      this.mode = 'replay';
      this.rpi = 0;    // frame index into recBuf, advanced at half real-time
      this.rpT = 0;    // wall-clock since replay started (gates the skip)
      game.stage = this.recConst.stage;
    },
    updateReplay(dt) {
      this.rpT += dt;
      this.rpi += 60 * dt * 0.5;   // 0.5× playback
      if (this.rpi >= this.recBuf.length - 1) { this.finishReplay(); return; }
      if (this.rpT > 0.4 && (input.pressed('a') || input.pressed('b') || input.pressed('start'))) {
        this.finishReplay();
      }
    },
    finishReplay() {
      if (this._liveStage !== undefined) game.stage = this._liveStage;
      this._liveStage = undefined;
      this.recBuf = null; this.recording = false; this.isBomb = false;
      const next = this.replayNext; this.replayNext = null;
      this.mode = 'watch';   // placeholder; next() sets the real destination
      if (next) next();
    },
    // Redraw a recorded frame by restoring its state onto `this` and calling the live draw fn.
    drawReplay(ctx) {
      const buf = this.recBuf;
      const idx = this.mode === 'replayPrompt' ? buf.length - 1 : Math.min(Math.floor(this.rpi), buf.length - 1);
      const c = this.recConst;
      const p = PALETTES[c.stage];
      const bgKey = BG_KEYS[c.stage];
      if (imgReady(bgKey)) ctx.drawImage(IMG[bgKey], 0, 0, W, H);
      else skyAndSea(ctx, p);
      Object.assign(this, c);            // wave constants
      Object.assign(this, buf[idx]);     // this frame's animated state
      if (this.recMode === 'pitch' && this.shake > 0) {
        ctx.save();
        ctx.translate(Math.round((Math.random() * 2 - 1) * this.shake), Math.round((Math.random() * 2 - 1) * this.shake));
        if (imgReady(bgKey)) ctx.drawImage(IMG[bgKey], -8, -8, W + 16, H + 16);
        this.drawPitch(ctx, p);
        ctx.restore();
      } else if (this.recMode === 'ride') {
        this.drawRide(ctx, p);
      } else {
        this.drawPitch(ctx, p);
      }
      // replay chrome: letterbox + label, and the prompt when we're waiting on the player
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, 16); ctx.fillRect(0, H - 16, W, 16);
      const blink = Math.floor(Date.now() / 250) % 2 === 0;   // wall-clock: snapshot animT is frozen on the prompt
      if (blink) text(ctx, '▶▶ INSTANT REPLAY  0.5×', W / 2, 5, 8, '#f8f890', 'center');
      if (this.mode === 'replayPrompt') {
        ctx.fillStyle = 'rgba(8,8,32,0.72)';
        ctx.fillRect(20, 100, W - 40, 42);
        text(ctx, 'WATCH THE REPLAY?', W / 2, 106, 11, '#f8f8f8', 'center');
        text(ctx, input.usedTouch ? 'TAP = YES        (WAIT = SKIP)' : 'X = YES        ↓ = SKIP', W / 2, 124, 8, '#f8d848', 'center');
      } else {
        text(ctx, input.usedTouch ? 'TAP TO SKIP' : 'X TO SKIP', W / 2, H - 13, 7, '#c8c8d8', 'center');
      }
    },

    // ---------------- draw
    draw(ctx) {
      if (this.mode === 'replay' || this.mode === 'replayPrompt') { this.drawReplay(ctx); return; }
      const p = pal();
      // screen shake when the wave lands on a pitched wipeout — jitter the world layer,
      // overscan the backdrop so no black edge shows, keep the HUD steady
      const shk = (this.mode === 'pitch' && this.shake > 0) ? this.shake : 0;
      if (shk) { ctx.save(); ctx.translate(Math.round((Math.random() * 2 - 1) * shk), Math.round((Math.random() * 2 - 1) * shk)); }
      const bgKey = BG_KEYS[game.stage];
      if (imgReady(bgKey)) {
        if (shk) ctx.drawImage(IMG[bgKey], -8, -8, W + 16, H + 16);   // overscan hides shake edges
        else ctx.drawImage(IMG[bgKey], 0, 0, W, H);                   // photo backdrop provides sky + sea
      } else {
        skyAndSea(ctx, p);
      }
      if (this.mode === 'watch') this.drawWatch(ctx, p);
      else if (this.mode === 'ride') this.drawRide(ctx, p);
      else if (this.mode === 'exit') this.drawExit(ctx, p);
      else this.drawPitch(ctx, p);
      for (const f of this.floaters) text(ctx, f.txt, f.x, f.y, 8, '#f8f890', 'center');
      if (shk) ctx.restore();
      // finger position feedback while dragging
      if (input.touch.active && input.touch.dragging) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.strokeRect(Math.round(input.touch.x) - 7, Math.round(input.touch.y) - 7, 14, 14);
      }
      hud(ctx);
      if (this.msgT > 0 && this.msg) {
        ctx.fillStyle = 'rgba(8,8,32,0.55)';
        ctx.fillRect(28, 52, 200, this.msgSub ? 30 : 20);
        text(ctx, this.msg, W / 2, 55, 12, '#f8f890', 'center');
        if (this.msgSub) text(ctx, this.msgSub, W / 2, 70, 8, '#fff', 'center');
      }
    },

    drawWatch(ctx, p) {
      const q = this.q();
      const w = this.wv;
      const peak = this.peakX();
      // wave builds from the horizon and marches toward the lineup
      const baseY = 116 + q * (SURFACE - 116);
      // more swell rolling in behind this wave (parallax lines drifting right)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 2; i++) {
        const sx = ((this.animT * (16 + i * 10)) % (W + 80)) - 40;
        ctx.fillRect(0, 112 + i * 4, W, 1);
        ctx.fillRect(Math.round(sx), 111 + i * 4, 30, 2);
      }
      for (let x = 0; x < W; x += 2) {
        const h = this.waveH(x, q);
        if (h < 2) continue;
        const top = baseY - h;
        ctx.fillStyle = p.seaD;
        ctx.fillRect(x, Math.round(top), 2, Math.round(h));
        // open face catches light on the shoulder (right of peak)
        if (x > peak) {
          ctx.fillStyle = p.sea;
          ctx.fillRect(x, Math.round(top + h * 0.35), 2, Math.round(h * 0.65));
        }
        // surface texture flowing rightward with the wave — this sells the travel
        if (h > 10) {
          const ph = (((x - w.t * 55) % 30) + 30) % 30;
          if (ph < 4) {
            ctx.fillStyle = x > peak ? 'rgba(255,255,255,0.18)' : 'rgba(8,16,48,0.16)';
            ctx.fillRect(x, Math.round(top + h * 0.25), 2, Math.round(h * 0.5));
          }
        }
        // crest feathering is THE tell:
        // makeable = feathers only near the peak; closeout = feathers all the way across
        const feather = w.makeable ? Math.abs(x - peak) < 26 : h > w.A * q * 0.55;
        if (q > 0.5 && feather && (x + (Math.floor(this.animT * 10) % 4)) % 4 < 2) {
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(top) - 2, 2, 4);
        }
        // lip starts to throw at the peak right before it arrives
        if (q > 0.82 && Math.abs(x - peak) < 16) {
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(top) - 1, 2, 6);
        }
      }
      // takeoff marker: appears on makeable waves once the wave shows its hand
      if (w.makeable && q > 0.5) {
        const sx = Math.round(this.sweetX());
        // guide line + landing zone on the water, so "under the marker" is literal
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let yy = 104; yy < SURFACE + 2; yy += 8) ctx.fillRect(sx, yy, 1, 4);
        const tol = Math.max(9, 16 - game.stage * 2);
        ctx.fillStyle = 'rgba(248,248,144,0.45)';
        ctx.fillRect(sx - tol, SURFACE + 9, tol * 2, 3);
        if (Math.floor(this.animT * 3) % 2 === 0) {
          ctx.fillStyle = '#f8f890';
          ctx.fillRect(sx - 1, 84, 3, 10);
          ctx.fillRect(sx - 4, 94, 9, 3);
          ctx.fillRect(sx - 2, 97, 5, 3);
          ctx.fillRect(sx, 100, 1, 2);
        }
      }
      // spray streaming off the lip as it stands up
      if (q > 0.45) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        const ctop = baseY - this.waveH(peak, q);
        for (let i = 0; i < 6; i++) {
          const sx = peak + 10 + i * 7 + ((this.animT * 70) % 14);
          ctx.fillRect(Math.round(sx), Math.round(ctop + 2 - i * 1.5), 3, 2);
        }
      }
      // once the wave stands up (~60% built) the whole lineup drops prone and paddles
      // for it — the go/no-go window. Committing keeps you paddling.
      const paddling = this.committed || q > 0.55;
      // the other riders in the lineup — the swell lifts them as it rolls through
      for (const r of this.riders) {
        const ry = LINEUP_Y + Math.sin(this.animT * 2 + r.ph) * 2 - this.waveH(r.x, q) * 0.25 * q * q;
        if (!drawRiderImg(ctx, paddling ? 'sp_b_paddle' : 'sp_b_sit', r.x, ry - 4, 0, 0)) drawMap(ctx, MAPS.paddleA, r.x - 16, ry - 6, 2, true);
      }
      // player — lifted too as the wave arrives under you. Sitting in the lineup;
      // drops to a paddle/swim stance once the wave stands up.
      const py = LINEUP_Y + Math.sin(this.animT * 2.6) * 2 - this.waveH(this.px, q) * 0.25 * q * q;
      // prone the moment you slide to reposition; otherwise sit/tread until the wave stands up
      const prone = paddling || this.moveT > 0;
      if (!drawRiderImg(ctx, riderKey(prone ? 'paddle' : 'sit'), this.px, py - 4, 0, 0)) {
        drawMap(ctx, prone && this.animT % 0.3 < 0.15 ? spr().paddleB : spr().paddleA, this.px - 16, py - 6, 2, true);
      }
      ctx.fillStyle = '#f8f890';
      ctx.fillRect(this.px - 1, py + 10, 3, 2); // you-marker under the player
      if (this.committed) {
        const r = 10 + ((this.animT * 18) % 8);
        ctx.strokeStyle = 'rgba(72,208,72,0.8)';
        ctx.strokeRect(this.px - r, py - r / 2 + 2, r * 2, r);
        text(ctx, 'COMMITTED!', this.px, py - 24, 9, '#48d048', 'center');
      } else if (input.usedTouch && w.makeable && q > 0.5 && Math.floor(this.animT * 3) % 2 === 0) {
        // touch players get a big unmissable prompt — the whole screen is the button
        text(ctx, 'TAP TO GO!', W / 2, 40, 16, '#48d048', 'center');
      }
      // coaching line + arrival meter
      const goHint = this.committed
        ? 'COMMITTED — HERE IT COMES!'
        : (input.usedTouch ? 'SLIDE ←→ TO MOVE · TAP WHEN ▼ IS OVER YOU' : '←→ UNDER THE MARKER · X WHEN IT\'S OVER YOU');
      text(ctx, w.makeable || q < 0.5 ? goHint : 'FEATHERING EVERYWHERE = CLOSEOUT. DON\'T GO', W / 2, 224, 7, q > 0.5 && !w.makeable ? '#f85838' : '#fff', 'center');
      text(ctx, 'SET', 6, 22, 7, '#fff');
      ctx.fillStyle = '#181828'; ctx.fillRect(30, 23, 60, 5);
      ctx.fillStyle = q > 0.8 ? '#f85838' : '#f8d848';
      ctx.fillRect(30, 23, Math.round(q * 60), 5);
    },

    drawRide(ctx, p) {
      const foamX = this.foamX;
      const pkX = this.pocketX();
      const w = this.wv;
      // full standing wave: broken behind the foam edge, open face ahead of it
      for (let x = 0; x < W; x += 2) {
        const taper = x > foamX ? Math.max(0.55, 1 - ((x - foamX) / W) * 0.9) : 1;
        const h = w.A * taper;
        const top = SURFACE - h;
        if (x < foamX) {
          // whitewash — already broken
          ctx.fillStyle = p.foam;
          const jy = Math.round(top + Math.sin(x * 0.3 + this.animT * 14) * 4);
          ctx.fillRect(x, jy, 2, H - jy);
        } else {
          ctx.fillStyle = p.seaD;
          ctx.fillRect(x, Math.round(top), 2, H - Math.round(top));
          ctx.fillStyle = p.sea;
          const my = Math.round(top + h * 0.5);
          ctx.fillRect(x, my, 2, H - my);
        }
      }
      // motion: face texture and trough foam streaming past the rider
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 9; i++) {
        const sx = ((((i * 34 - this.rt * 160) % (W + 20)) + W + 20) % (W + 20)) - 10;
        if (sx > foamX + 4) {
          const tp = Math.max(0.55, 1 - ((sx - foamX) / W) * 0.9);
          const hh = w.A * tp;
          ctx.fillRect(Math.round(sx), Math.round(SURFACE - hh + 8), 2, Math.round(hh * 0.5));
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 10; i++) {
        const sx = ((((i * 29 - this.rt * 220) % (W + 30)) + W + 30) % (W + 30)) - 15;
        ctx.fillRect(Math.round(sx), SURFACE + 6 + (i % 3) * 6, 8, 2);
      }
      // exit glow down the line — the reward you're driving toward
      const grad = ctx.createLinearGradient(pkX + 40, 0, W, 0);
      grad.addColorStop(0, 'rgba(255,250,200,0)');
      grad.addColorStop(1, 'rgba(255,250,200,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(pkX + 40, SURFACE - w.A, W - pkX - 40, H - (SURFACE - w.A));
      // the tube: cavity + lip curling overhead from the foam edge past the rider
      const tubeR = pkX + 34;
      ctx.fillStyle = 'rgba(8,16,48,0.42)';
      ctx.fillRect(Math.round(foamX - 6), Math.round(SURFACE - w.A + 8), Math.round(tubeR - foamX + 6), Math.round(w.A + 14));
      ctx.fillStyle = p.foam;
      for (let x = Math.round(foamX - 6); x < tubeR; x += 2) {
        const frac = (x - foamX + 6) / (tubeR - foamX + 6);
        const thick = Math.round(14 - frac * 10);
        const lipY = SURFACE - w.A - 4 + Math.round(frac * frac * 10);
        ctx.fillRect(x, lipY, 2, thick);
      }
      // falling curtain drips at the tube mouth
      for (let i = 0; i < 4; i++) {
        const dx = tubeR - 4 + i * 3;
        const len = 10 + Math.round(Math.sin(this.animT * 10 + i * 2) * 6) + i * 4;
        ctx.fillRect(dx, SURFACE - w.A + 6, 2, len);
      }
      // pocket band — where you need to be (width is per-rider, Phase 3)
      const pyT = this.pocketY();
      const bnd = this.band || 15;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(pkX - 8, Math.round(pyT - bnd), 26, 1);
      ctx.fillRect(pkX - 8, Math.round(pyT + bnd), 26, 1);
      // rider — sometimes swallowed by the curtain, riding through it
      const deep = Math.sin(this.rt * 1.7 + this.pocketPh) > 0.15;
      if (this.dropT > 0) {
        // nose-down freefall with a spray trail up the face
        // level while teetering on the lip, pitching steeper as the fall takes over
        const dk = Math.min(1, 1 - this.dropT / this.dropDur);
        // the drop art already has a strong dive angle baked in, so add only a light
        // extra tilt as the fall steepens — enough to read, short of a headfirst nosedive
        const rot = 0.05 + dk * 0.32;
        if (!drawRiderImg(ctx, riderKey('drop'), pkX + 6, this.py, rot)) {
          ctx.save();
          ctx.translate(pkX + 6, Math.round(this.py));
          ctx.rotate(rot);
          drawMap(ctx, spr().ride, -16, -5, 2, true);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 1; i <= 6; i++) {
          ctx.fillRect(pkX - 6 + (i % 2) * 6, Math.round(this.py) - i * 9, 3, 5);
        }
      } else if (this.spinT > 0) {
        // spinning: surfer uses the arms-out frame, boarder just rotates the ride frame
        const rot = (1 - this.spinT / 0.6) * Math.PI * 2;
        const key = game.rider === 'surfer' ? 'sp_s_spin' : riderKey('ride');
        if (!drawRiderImg(ctx, key, pkX, this.py, rot)) {
          ctx.save();
          ctx.translate(pkX, Math.round(this.py));
          ctx.rotate(rot);
          drawMap(ctx, spr().ride, -16, -5, 2, true);
          ctx.restore();
        }
      } else if (!drawRiderImg(ctx, riderKey('ride'), pkX, this.py)) {
        drawMap(ctx, spr().ride, pkX - 10, this.py - 6, 2, true);
      }
      if (deep && this.rt > 0.6) {
        ctx.fillStyle = 'rgba(248,248,240,0.6)';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(pkX - 12 + i * 6, SURFACE - w.A + 10 + ((i * 13) % 8), 3, w.A - 8);
        }
      }
      // spray off the bottom turn
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(pkX - 18 - i * 3, Math.round(this.py) + 8 + (i % 2) * 2, 3, 3);
      }
      // meters
      text(ctx, 'TUBE', 6, 18, 7, '#fff');
      text(ctx, `${this.tubeTime.toFixed(1)}s`, 38, 18, 7, '#f8f890');
      if (this.buried > 0.05) {
        text(ctx, 'BURIED', 6, 30, 7, '#f85838');
        ctx.fillStyle = '#181828'; ctx.fillRect(44, 31, 40, 5);
        ctx.fillStyle = '#f85838';
        ctx.fillRect(44, 31, Math.round(Math.min(1, this.buried / 0.95) * 40), 5);
      }
      if (this.spinT > 0) text(ctx, 'SPIN!', W / 2, 40, 13, '#8ce8a0', 'center');
      if (this.rt < 3) text(ctx, input.usedTouch ? 'SLIDE ↑↓ ANYWHERE TO STEER' : '↑↓ STAY BETWEEN THE LINES', W / 2, 224, 8, '#f8f890', 'center');
      else if (this.buried > 0.3 && Math.floor(this.animT * 4) % 2) {
        text(ctx, this.py > pyT ? 'GO UP ↑' : 'GO DOWN ↓', W / 2, 224, 9, '#f85838', 'center');
      } else if (Math.floor(this.animT * 2) % 2) {
        text(ctx, input.usedTouch ? 'TAP = SPIN TRICK' : 'X = SPIN TRICK', W / 2, 224, 8, '#8ce8a0', 'center');
      }
    },

    drawExit(ctx, p) {
      const w = this.wv;
      // everything LEFT of the sweep has closed out (foam); it marches right until the
      // entire wave has shut down. Ahead of the sweep is open clean face — open air.
      const sweep = this.closeSweep;
      for (let x = 0; x < W; x += 2) {
        const closed = x < sweep;
        const h = w.A * (closed ? 1 : Math.max(0.4, 1 - ((x - sweep) / W) * 1.05));
        const top = SURFACE - h;
        if (closed) {
          ctx.fillStyle = p.foam;
          const jy = Math.round(top + Math.sin(x * 0.3 + this.animT * 14) * 4);
          ctx.fillRect(x, jy, 2, H - jy);
        } else {
          ctx.fillStyle = p.seaD;
          ctx.fillRect(x, Math.round(top), 2, H - Math.round(top));
          ctx.fillStyle = p.sea;
          const my = Math.round(top + h * 0.5);
          ctx.fillRect(x, my, 2, H - my);
        }
      }
      // the pitching lip curtain falling at the sweep edge — the closeout moving L→R
      if (sweep < W + 8) {
        ctx.fillStyle = p.foam;
        for (let x = Math.max(0, Math.round(sweep) - 6); x < Math.min(W, sweep + 4); x += 2) {
          ctx.fillRect(x, SURFACE - w.A - 3, 2, 12);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(Math.round(sweep) - 4 + i * 2, SURFACE - w.A - 8 - (i % 3) * 3, 2, 3);
        }
      }
      // trough foam still streaming past
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 10; i++) {
        const sx = ((((i * 29 - (this.rideLen + this.exT) * 220) % (W + 30)) + W + 30) % (W + 30)) - 15;
        ctx.fillRect(Math.round(sx), SURFACE + 6 + (i % 3) * 6, 8, 2);
      }
      // rider + finishing trick (rotated around the rider)
      const rolling = game.rider === 'surfer' && this.exT > 0.9;
      if (rolling) {
        // lengthwise barrel roll: prone bodysurfer rotating about his long axis, faked
        // by flipping/squashing vertically — full at top/underside, thin edge-on at the sides
        const roll = this.exRoll || 0;
        const img = IMG['sp_s_prone'];
        if (img && img.complete && img.naturalWidth > 0) {
          const w = img.naturalWidth, h = img.naturalHeight;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.translate(Math.round(this.exX), Math.round(this.exY));
          ctx.scale(1, Math.cos(roll));            // + top, 0 edge-on, − underside
          ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2));
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(this.exX, this.exY);
          ctx.rotate(roll);
          drawMap(ctx, MAPS.surfT, -15, -6, 2);   // procedural fallback until art loads
          ctx.restore();
        }
      } else if (!drawRiderImg(ctx, riderKey('ride'), this.exX, this.exY, this.exRot || 0)) {
        ctx.save();
        ctx.translate(this.exX, this.exY);
        ctx.rotate(this.exRot || 0);
        drawMap(ctx, spr().ride, -16, -6, 2, true);
        ctx.restore();
      }
      // banner
      if (this.trickDone) {
        text(ctx, game.rider === 'boarder' ? 'RE-ENTRY — STOMPED IT!' : 'BARREL ROLL — STOMPED IT!', W / 2, 40, 8, '#f8f890', 'center');
      } else if (this.exT > 0.9) {
        text(ctx, game.rider === 'boarder' ? 'OFF THE LIP!' : 'ROLL!', W / 2, 40, 9, '#f8f890', 'center');
      }
    },
  };

  // ---------------------------------------------------------------- WIPEOUT
  const wipeout = {
    enter(g, opts = {}) {
      this.t = 0;
      this.reason = opts.reason || 'PITCHED!';
      this.detail = opts.detail || '';
      this.mark = opts.mark || null;   // mini wave-strip data (PITCHED / CLOSED OUT)
      game.streak = 0;                 // any wipeout breaks the combo
      if (game.daily) game.dailyGrid.push('wipe');   // 🟥 — no free ones in daily
      // Phase 1 — first early wipeout of an arcade session is free: watch, don't pay for it.
      this.free = !game.daily && game.wave <= 3 && !game.freeFallUsed;
      if (this.free) game.freeFallUsed = true;
      else game.lives--;
      audio.crash();
    },
    update(dt) {
      this.t += dt;
      if (this.t > 2.4) {
        if (game.daily) {
          // daily ends on the last life or after the 10th wave; otherwise ride on
          if (game.lives <= 0 || game.wave >= 10) game.goto('dailyresult', { dateKey: dailyKey(), dayNum: dailyNum() });
          else game.goto('surf');
        } else if (game.lives > 0) game.goto('surf');
        else game.goto('gameover');
      }
    },
    draw(ctx) {
      const p = pal();
      skyAndSea(ctx, p);
      // the wave crashes down on him — a foam curtain collapses from the top in the first beat
      const crash = Math.min(1, this.t / 0.55);
      ctx.fillStyle = p.foam;
      for (let x = 0; x < W; x += 2) {
        const h = Math.round((SURFACE + 20) * crash + Math.sin(x * 0.25 + this.t * 18) * 6);
        ctx.fillRect(x, 0, 2, h);
      }
      ctx.fillStyle = 'rgba(8,8,32,0.15)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = p.foam;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const r = this.t * 90 + (i % 5) * 8;
        ctx.fillRect(128 + Math.cos(a) * r, 150 + Math.sin(a) * r * 0.5, 6, 6);
      }
      const ty = 150 - Math.sin(Math.min(Math.PI, this.t * 2.4)) * 90;
      ctx.save();
      ctx.translate(128 + this.t * 30, ty);
      ctx.rotate(this.t * 12);
      drawMap(ctx, MAPS.tumble, -8, -5, 2);
      ctx.restore();
      const shake = Math.sin(this.t * 40) * (this.t < 0.5 ? 3 : 0);
      text(ctx, this.reason, W / 2 + shake, 70, 24, '#f85838', 'center');
      if (this.detail) text(ctx, this.detail, W / 2, 104, 8, '#fff', 'center');
      // Phase 1 — the "why" strip: shows where the slot was vs. where you took off
      if (this.mark && this.t > 0.9) this.drawMark(ctx);
      if (this.t > 1.2) {
        const line = this.free ? 'FREE ONE — WATCH THE PEAK'
          : (game.lives > 0 ? `LIVES LEFT: ${game.lives}` : 'THAT WAS YOUR LAST ONE');
        text(ctx, line, W / 2, 200, 9, this.free ? '#58e058' : '#fff', 'center');
      }
      hud(ctx);
    },
    // Mini wave-face strip: yellow slot + tolerance band vs. red you-marker (PITCHED),
    // or a red wall the whole way across (CLOSED OUT). Teaches the miss at a glance.
    drawMark(ctx) {
      const m = this.mark, sy = 136, sh = 28;
      ctx.fillStyle = 'rgba(16,32,72,0.9)'; ctx.fillRect(0, sy, W, sh);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, sy, W, 1);   // crest line
      if (m.wall) {
        ctx.fillStyle = 'rgba(248,88,56,0.5)';
        for (let x = 0; x < W; x += 6) ctx.fillRect(x, sy, 3, sh);
        text(ctx, 'THE WHOLE WAVE WAS A WALL', W / 2, 118, 9, '#f85838', 'center');
      } else {
        ctx.fillStyle = 'rgba(248,216,72,0.45)';
        ctx.fillRect(Math.round(m.sweet - m.tol), sy, Math.round(m.tol * 2), sh);
        ctx.fillStyle = '#f8d848';
        ctx.fillRect(Math.round(m.sweet) - 1, sy - 3, 3, sh + 6);
        text(ctx, 'SLOT', Math.round(m.sweet), sy + sh + 1, 6, '#f8d848', 'center');
        text(ctx, `YOU WERE ${Math.round(m.off)}px OFF THE SLOT`, W / 2, 118, 9, '#fff', 'center');
      }
      ctx.fillStyle = '#f85838';
      ctx.fillRect(Math.round(m.px) - 1, sy - 3, 3, sh + 6);
      text(ctx, 'YOU', Math.round(m.px), sy + sh + 1, 6, '#f85838', 'center');
    },
  };

  // ---------------------------------------------------------------- GAME OVER
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const gameover = {
    enter() {
      this.t = 0;
      audio.stopMusic();
      audio.sad();
      this.mode = qualifies(game.score) ? 'entry' : 'table';
      this.initials = [0, 0, 0];
      this.slot = 0;
    },
    update(dt) {
      this.t += dt;
      if (this.t < 0.8) return;
      if (this.mode === 'entry') {
        if (input.touch.active && input.touch.dragging) {
          // touch: the letter follows a vertical drag, tap advances the slot
          this.initials[this.slot] = Math.max(0, Math.min(25, Math.floor((input.touch.y - 70) / 5)));
        }
        if (input.pressed('up')) { this.initials[this.slot] = (this.initials[this.slot] + 25) % 26; audio.blip(); }
        if (input.pressed('down')) { this.initials[this.slot] = (this.initials[this.slot] + 1) % 26; audio.blip(); }
        if (input.pressed('left')) this.slot = Math.max(0, this.slot - 1);
        if (input.pressed('right')) this.slot = Math.min(2, this.slot + 1);
        if (input.pressed('a') || input.pressed('start')) {
          if (this.slot < 2) { this.slot++; audio.tick(); }
          else {
            saveScore(this.initials.map((i) => ALPHA[i]).join(''), Math.floor(game.score));
            this.mode = 'table';
            audio.select();
          }
        }
      } else if (input.pressed('a') || input.pressed('start')) {
        game.goto('title');
      }
    },
    draw(ctx) {
      if (imgReady('gameover')) {
        ctx.drawImage(IMG.gameover, 0, 0, W, H);   // "GAME OVER" is baked into the art
      } else {
        ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, W, H);
        text(ctx, 'GAME OVER', W / 2, 20, 22, '#f85838', 'center');
      }
      // shadowed text stays legible directly over the busy art, so the game-over scene
      // (wave, jetty, crowd) shows through a light scrim instead of a heavy blackout panel
      const st = (s, x, y, size, color) => {
        text(ctx, s, x + 1, y + 1, size, 'rgba(0,0,0,0.8)', 'center');
        text(ctx, s, x, y, size, color, 'center');
      };
      if (this.mode === 'entry') {
        ctx.fillStyle = 'rgba(12,10,26,0.4)'; ctx.fillRect(40, 42, W - 80, 116);
        st(`SCORE ${Math.floor(game.score)}`, W / 2, 50, 10, '#f8d848');
        st('RADICAL! ENTER YOUR INITIALS', W / 2, 68, 8, '#fff');
        for (let i = 0; i < 3; i++) {
          const x = W / 2 - 30 + i * 30;
          const hot = i === this.slot && Math.floor(this.t * 3) % 2 === 0;
          st(ALPHA[this.initials[i]], x, 90, 20, hot ? '#f8f890' : '#fff');
          ctx.fillStyle = i === this.slot ? '#f8f890' : '#585868';
          ctx.fillRect(x - 9, 116, 18, 2);
        }
        st(input.usedTouch ? 'DRAG ↑↓ LETTER · TAP = NEXT' : '↑↓ LETTER · ←→ SLOT · X CONFIRM', W / 2, 146, 7, '#c8c8d8');
      } else {
        // slim, light scrim only behind the score column — jetty (left) and tube (right) stay visible
        ctx.fillStyle = 'rgba(12,10,26,0.3)'; ctx.fillRect(40, 42, W - 80, 158);
        st(`SCORE ${Math.floor(game.score)}`, W / 2, 50, 10, '#f8d848');
        st('— TODAY AT THE WEDGE —', W / 2, 68, 8, '#e8e8f0');
        const hs = loadScores();
        if (!hs.length) st('NO RIDES LOGGED YET', W / 2, 104, 8, '#fff');
        hs.slice(0, 8).forEach((h, i) => {
          st(`${String(i + 1).padStart(2, ' ')}. ${h.initials}  ${String(h.score).padStart(6, '0')}`, W / 2, 82 + i * 12, 8, i === 0 ? '#f8d848' : '#fff');
        });
        // prompt sits inside the scrim, clear of the "GAME OVER!" text baked into the art below
        if (Math.floor(this.t * 2) % 2) st('PRESS X FOR ONE MORE WAVE', W / 2, 186, 8, '#58e058');
      }
    },
  };

  // ---------------------------------------------------------------- DAILY RESULT
  // Replaces the arcade game-over for daily runs: score + shareable emoji grid.
  const dailyresult = {
    enter(g, opts = {}) {
      this.t = 0;
      audio.stopMusic();
      this.dayNum = opts.dayNum || dailyNum();
      this.copied = 0; this.copyMsg = ''; this.copiedOnce = false;
      if (opts.stored) {                       // opened from the title for an already-played day
        this.grid = opts.stored.grid || [];
        this.score = opts.stored.score || 0;
      } else {                                 // fresh finish — record the one attempt for today
        this.grid = (game.dailyGrid || []).slice();
        this.score = Math.floor(game.score);
        saveDaily({ date: opts.dateKey || dailyKey(), grid: this.grid, score: this.score });
      }
      audio.jingle();
    },
    copy() {
      this.copiedOnce = true;
      const txt = shareText(this.dayNum, this.score, this.grid);
      const done = (ok) => { this.copied = 1.8; this.copyMsg = ok ? 'COPIED!' : 'SCREENSHOT TO SHARE'; };
      try { navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); }
      catch { done(false); }
      audio.select();
    },
    update(dt) {
      this.t += dt;
      this.copied = Math.max(0, this.copied - dt);
      if (this.t < 0.5) return;
      if (input.pressed('a') || input.pressed('start')) {
        if (!this.copiedOnce) this.copy();     // first press copies the result
        else game.goto('title');               // then returns to the menu
      }
    },
    draw(ctx) {
      skyAndSea(ctx, PALETTES[3]);             // maxing-sunset backdrop
      ctx.fillStyle = 'rgba(8,8,28,0.6)'; ctx.fillRect(18, 28, W - 36, 184);
      text(ctx, `WEDGE! DAILY #${this.dayNum}`, W / 2, 42, 12, '#f8d848', 'center');
      text(ctx, `SCORE ${this.score.toLocaleString()}`, W / 2, 66, 10, '#fff', 'center');
      // per-wave grid of swatches (colours mirror the copied emoji)
      const n = this.grid.length, sz = 16, gap = 3, tot = n * sz + Math.max(0, n - 1) * gap;
      const gx = Math.round(W / 2 - tot / 2), gy = 92;
      for (let i = 0; i < n; i++) {
        const x = gx + i * (sz + gap);
        ctx.fillStyle = GRID_COLOR[this.grid[i]] || '#888';
        ctx.fillRect(x, gy, sz, sz);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, gy + 0.5, sz - 1, sz - 1);
      }
      text(ctx, 'GREEN SLOT · BLUE CLEAN · YELLOW LATE', W / 2, 120, 6, '#c8c8d8', 'center');
      text(ctx, 'RED WIPE · WHITE PASS · PURPLE GOOD CALL', W / 2, 128, 6, '#c8c8d8', 'center');
      if (this.copied > 0) {
        text(ctx, this.copyMsg, W / 2, 152, 10, this.copyMsg === 'COPIED!' ? '#58e058' : '#f8d848', 'center');
      } else if (Math.floor(this.t * 2) % 2) {
        text(ctx, input.usedTouch ? 'TAP TO COPY RESULT' : 'X = COPY RESULT', W / 2, 152, 9, '#fff', 'center');
      }
      if (this.copiedOnce && Math.floor(this.t * 2) % 2) {
        text(ctx, input.usedTouch ? 'TAP AGAIN FOR MENU' : 'X AGAIN FOR MENU', W / 2, 172, 8, '#c8c8d8', 'center');
      }
      text(ctx, 'ONE WAVE A DAY · SAME FOR EVERYONE', W / 2, 196, 7, '#e8e8f0', 'center');
    },
  };

  return { title, select, surf, wipeout, gameover, dailyresult };
}
