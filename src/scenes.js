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
function loadImg(key, file) { const i = new Image(); i.src = './assets/' + file + '?v=18'; IMG[key] = i; }
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
// Trick art (Phase 5) — the dedicated poses, generated from the prompts in
// SPRITE_PROMPTS.md and cut down to house scale by execution/pixelate_sprite.py.
// drawRide picks these up automatically (see trickArt); comment a line back out and
// the move falls back to its transformed stand-in frame.
loadImg('sp_b_spin', 'spr_b_spin.png');       // boarder — flat 360 on the face
loadImg('sp_b_air', 'spr_b_air.png');         // boarder — airborne, rail grab
loadImg('sp_b_knee', 'spr_b_knee.png');       // boarder — knee drop + hand drag
loadImg('sp_s_layback', 'spr_s_layback.png'); // bodysurfer — lay-back, arm spread
loadImg('sp_s_roll', 'spr_s_roll.png');       // bodysurfer — PRONE 360 ROLL, arms up by the head
loadImg('sp_s_tube', 'spr_s_tube.png');       // bodysurfer — coming out of the barrel
const TRICK_ART = {
  boarder: { spin: 'sp_b_spin', air: 'sp_b_air', stance: 'sp_b_knee' },
  // no air for the bodysurfer — he stays on the water. His 360 is a PRONE ROLL about his
  // long axis (not a flat cartwheel), so the stand-in is the prone frame flipped through
  // cos(roll), never the arms-out ragdoll toss (sp_s_spin).
  surfer: { spin: 'sp_s_roll', tube: 'sp_s_tube', stance: 'sp_s_layback' },
};
// The three NPC identities per rider type, matching the table in SPRITE_PROMPTS.md.
// `rules` recolour the shared pose frames (hue windows below are measured off the art);
// `id` also names that identity's own generated lineup frame — `spr_b_sit_n1.png` loads
// as `sp_b_sit_n1` and takes over the sit pose the moment it exists.
// Hue windows measured off the actual frames. The lower bound on `trunks` matters: sea
// spray in the newer sprites sits at 190-203°, so a window that starts at 190 recolours
// the spray along with the shorts.
const HUE = {
  board: [40, 65],      // the yellow bodyboard
  top: [70, 150],       // the green tank (old frames sit at 85, the new ones at 127)
  trunks: [206, 255],   // blue trunks — the boarder's, and the OLD bodysurfer frames'
  teal: [160, 189],     // the new bodysurfer's teal trunks
};
const DARK = { sat: 0.06, mul: 0.38 };     // "black" gear: drained and dropped, not rehued
// The bodysurfer's poses aren't all the same character yet: paddle/ride are the new
// teal-trunked frames while sit/drop are still the old blue-and-green striped ones. So a
// surfer identity sweeps ALL THREE gear windows to one target — that's what makes a
// striped short read as a solid colour instead of a half-recoloured mess, and it keeps an
// identity looking like itself across poses. Once spr_s_tread / spr_s_drop are
// regenerated the blue and green windows simply stop matching.
const surferGear = (to, sat) => [HUE.teal, HUE.trunks, HUE.top].map((from) => ({ from, to, sat }));
const NPC_LOOKS = {
  boarder: [
    // the grom — red board, black trunks, no tank (the green is retinted to bare skin)
    { id: 'n1', rules: [{ from: HUE.board, to: 2, sat: 0.74 }, { from: HUE.top, to: 18, sat: 0.42 }, { from: HUE.trunks, to: 0, ...DARK }] },
    // the veteran — faded orange board, black wetsuit vest, black trunks
    { id: 'n2', rules: [{ from: HUE.board, to: 26, sat: 0.62 }, { from: HUE.top, to: 0, ...DARK }, { from: HUE.trunks, to: 0, ...DARK }] },
    // her wave — purple board, teal one-piece
    { id: 'n3', rules: [{ from: HUE.board, to: 282, sat: 0.52 }, { from: HUE.top, to: 176, sat: 0.55 }, { from: HUE.trunks, to: 176, sat: 0.55 }] },
  ],
  surfer: [
    { id: 'n1', rules: surferGear(28, 0.85) },    // orange trunks
    { id: 'n2', rules: surferGear(322, 0.68) },   // magenta one-piece
    { id: 'n3', rules: surferGear(0, 0.05) },     // grey trunks
  ],
};
// Generated NPC lineup frames. Each carries its identity's build and gear, so the sit
// pose uses the art directly and skips the recolour (see localKey). The other three poses
// are still the shared frame recoloured to match.
loadImg('sp_b_sit_n1', 'spr_b_sit_n1.png');
loadImg('sp_b_sit_n2', 'spr_b_sit_n2.png');
loadImg('sp_b_sit_n3', 'spr_b_sit_n3.png');
loadImg('sp_s_tread_n1', 'spr_s_tread_n1.png');
loadImg('sp_s_tread_n2', 'spr_s_tread_n2.png');
loadImg('sp_s_tread_n3', 'spr_s_tread_n3.png');

// Phase 3 rider identity: the sponger holds a wider pocket for steady points; the
// bodysurfer works a tighter pocket but scores harder in the tube and off the exit.
// band/tube/exit are multipliers on the base pocket width, tube scoring, and exit bonus.
const RIDER_STATS = {
  boarder: { band: 1.25, tube: 1.0, exit: 1.0 },
  surfer: { band: 0.85, tube: 1.4, exit: 1.25 },
};
// Phase 5 tricks: ONE button, and where you sit in the pocket band picks the move.
//   top of the band (up by the lip) → AIR / TUBE · boarder launches off the lip; the
//                                     bodysurfer pulls up under the curtain and gets spat out
//   middle of the band             → SPIN   · boarder spins flat, bodysurfer rolls prone
//   bottom of the band (trough)    → STANCE · HOLD it: knee-drop hand-drag / lay-back
// Both riders have three moves. The bodysurfer never leaves the water, so where the
// boarder goes airborne he goes INTO the wave instead — same risk shape (he's out of
// your hands for a beat and the channel wanders), different move.
const TRICKS = {
  boarder: { air: 'AIR!', spin: '360 SPIN!', stance: 'KNEE DROP' },
  surfer: { tube: 'SPAT OUT!', spin: '360 ROLL!', stance: 'LAY-BACK' },
};
// Every trick but the air runs 25% longer than it used to — the move draws out, and the
// break eats that time back in ground (see foamCreep in updateRide).
const TRICK_SLOW = 1.25;
// Committing isn't quite final: press again inside this many seconds and you pull back
// off the wave. Works on every wave — snakes, closeouts, bombs, and ones you simply had
// second thoughts about (see startPullback).
const PULL_WIN = 1.5;
const PULL_BEAT = 1.9;   // length of the over-the-back cinematic

// ---- NPC recolouring -------------------------------------------------------------
// The locals used to be three clones of whatever the player picked. Each one now carries
// an identity (see NPC_LOOKS) whose gear colours are swapped onto the shared pose frames
// at load, so the lineup reads as a crowd without four generated frames per person.
//
// Only GEAR is swapped — board, top, trunks. Hair, skin, fins and the outline all sit in
// the same near-black / near-brown bands in the older frames and can't be separated by
// hue, so those stay put here and are carried instead by the identity's own generated
// lineup frame (spr_b_sit_nN / spr_s_tread_nN).
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
// rules: [{ from: [hMin, hMax], to: hue, sat }] — a pixel whose hue falls in the window
// (and which is colourful and bright enough to be gear rather than outline) is rehued,
// keeping its own lightness so the shading survives. Returns a canvas that quacks like an
// Image, so drawRiderImg/imgReady need no changes.
function recolourImg(srcKey, dstKey, rules) {
  const src = IMG[srcKey];
  if (!(src && src.complete && src.naturalWidth > 0)) return false;
  const w = src.naturalWidth, h = src.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(src, 0, 0);
  const d = c.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 128) continue;
    const [hu, sa, li] = rgbToHsl(p[i], p[i + 1], p[i + 2]);
    if (sa < 0.25 || li < 0.16 || li > 0.94) continue;      // outline, shadow, spray
    for (const r of rules) {
      const inWin = r.from[0] <= r.from[1]
        ? (hu >= r.from[0] && hu <= r.from[1])
        : (hu >= r.from[0] || hu <= r.from[1]);             // window wrapping through 0°
      if (!inWin) continue;
      const [nr, ng, nb] = hslToRgb(r.to, r.sat === undefined ? sa : r.sat,
                                    r.mul === undefined ? li : li * r.mul);
      p[i] = nr; p[i + 1] = ng; p[i + 2] = nb;
      break;
    }
  }
  c.putImageData(d, 0, 0);
  cv.complete = true; cv.naturalWidth = w; cv.naturalHeight = h;
  IMG[dstKey] = cv;
  return true;
}

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

// A LENGTHWISE roll — the body turning about its own long axis, not a flat cartwheel.
// Faked by scaling vertically through cos(roll): full height on top, a thin edge at 90°,
// inverted underneath. This is the bodysurfer's 360 (and his kick-out roll), so both
// read the same way. Returns false if the art hasn't loaded, same contract as above.
function drawRollImg(ctx, key, cx, cy, roll, scale = 1) {
  const img = IMG[key];
  if (!(img && img.complete && img.naturalWidth > 0)) return false;
  const w = img.naturalWidth, h = img.naturalHeight;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.scale(scale, Math.cos(roll) * scale);
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

// Lighten (amt>0) or darken (amt<0) a '#rrggbb' colour — for looser, gradient-shaded
// wave faces that roll from a dark pocket under the lip to a glassy lit base.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 1 + amt : 1, add = amt > 0 ? amt * 255 : 0;
  r = Math.max(0, Math.min(255, Math.round(r * f + add)));
  g = Math.max(0, Math.min(255, Math.round(g * f + add)));
  b = Math.max(0, Math.min(255, Math.round(b * f + add)));
  return `rgb(${r},${g},${b})`;
}
// Vertical face gradient from the crest line down to the waterline: dark in the pocket
// under the pitching lip, glassy and lit toward the base.
function faceGradient(ctx, topY, botY, pal) {
  const g = ctx.createLinearGradient(0, topY, 0, botY + 4);
  g.addColorStop(0, shade(pal.seaD, -0.28));
  g.addColorStop(0.42, pal.seaD);
  g.addColorStop(0.78, pal.sea);
  g.addColorStop(1, shade(pal.sea, 0.14));
  return g;
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
  // same lookup for an NPC local, whose type is his own — not the player's. `look` is his
  // identity index: prefer that identity's own generated frame, else recolour the shared
  // one (built once, on first use, since the base image may still be loading), else the
  // shared frame as-is.
  const localKey = (type, pose, look) => {
    const base = (RIDER_ART[type] || RIDER_ART.boarder)[pose];
    const L = look == null ? null : (NPC_LOOKS[type] || [])[look];
    if (!L) return base;
    const gen = base + '_' + L.id;
    if (imgReady(gen)) return gen;
    const key = base + '~' + L.id;
    if (!IMG[key]) recolourImg(base, key, L.rules);
    return imgReady(key) ? key : base;
  };
  // dedicated trick frame if its art has loaded, otherwise the transformed stand-in
  const trickArt = (kind, fallback) => {
    const k = (TRICK_ART[game.rider] || TRICK_ART.boarder)[kind];
    return imgReady(k) ? k : fallback;
  };
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
      // The lineup is a mixed crowd — spongers and bodysurfers side by side, whichever
      // one you picked. Each local rolls his type once at the start of the run and keeps
      // it, so the crowd around you stays the same faces wave to wave.
      // …and each also rolls an identity (NPC_LOOKS) — different gear, and its own
      // lineup frame once that art exists. Looks are dealt without replacement per type,
      // so two locals of the same kind are never the same person.
      const localType = () => (Math.random() < 0.5 ? 'boarder' : 'surfer');
      const bag = { boarder: [0, 1, 2], surfer: [0, 1, 2] };
      const localLook = (type) => {
        const b = bag[type];
        return b.length ? b.splice(Math.floor(Math.random() * b.length), 1)[0] : 0;
      };
      this.riders = [{ x: 40, ph: 0 }, { x: 74, ph: 2.1 }, { x: 120, ph: 4.2 }]
        .map((r) => { r.type = localType(); r.look = localLook(r.type); return r; });
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
      // Right-of-way wave (~1 in 5): one of the locals is deeper than you and going. Surf
      // etiquette gives the wave to whoever is closest to the peak — here that's him, on
      // your left. You can still take off, but that's snaking, and it ends badly. Never on
      // a monster (that beat owns its own drama), never on a closeout, and not while the
      // first two waves are still teaching the basic read.
      this.snake = (this.wv.makeable && !this.wv.monster && game.wave >= 3 && rand() < 0.2)
        ? { idx: Math.min(2, Math.floor(rand() * 3)), x: null, called: false, yielded: false }
        : null;
      if (this.snake) this.snake.x = this.riders[this.snake.idx].x;
      this.committed = false;
      this.pullT = 0;           // seconds left to change your mind (see startPullback)
      this.pendingAward = 0;    // points banked on this wave that a pull back gives back
      this.rumbled = false;
      this.holdT = 0;   // brief peak-drift freeze while a teaching callout is up (Phase 1)
      this.moveT = 0;           // >0 while repositioning, so the rider shows prone (not sitting)
      this.isBomb = false;      // set true when you commit to a monster — drives the instant replay
      this.recording = false; this.recBuf = null;
      this.mode = 'watch';
      // interstitial NPC beat (~1 in 3, arcade only, after the teaching waves): one of
      // the pack takes a quick extra wave while you watch — a walled one pitches and
      // smashes them, a small one runs clean. Free wave-reading lessons between turns.
      // Skipped in daily (fixed 10-wave cadence) and ahead of the bomb (its intro owns
      // the drama). Your wave's clock (wv.t = 0) doesn't start until the beat ends.
      if (!game.daily && game.wave >= 3 && !this.wv.rideable && !this.snake && Math.random() < 0.33) this.startNpc();
    },

    peakX() { return this.wv.peak; },
    sweetX() { return Math.min(226, this.peakX() + 26); }, // shoulder side of the peak
    q() { return Math.min(1, this.wv.t / this.wv.T); },
    waveH(x, q) {
      const w = this.wv;
      const dx = x - this.peakX();
      // The Wedge is an ASYMMETRIC A-frame, not a round swell: reflected energy off the
      // jetty stacks the back (left) steep and short, while the shoulder (right) runs a
      // longer open wall you ride down the line. Exponent < 2 gives a peaked, cusp-like
      // apex (a wedge) instead of a rounded Gaussian hump.
      const sig = dx < 0 ? w.sigma * 0.7 : w.sigma * 1.08;
      let g = Math.exp(-Math.pow(Math.abs(dx) / sig, 1.4));
      if (!w.makeable) g = Math.min(1, g * 1.7);          // squared-off wall = closeout
      // constructive interference: the reflected wedge crest surges the peak as it stacks
      // in (see stackSurge), then is absorbed — the wave visibly jacks up mid-build.
      g += this.stackSurge(x, q);
      return w.A * Math.pow(q, 1.4) * Math.min(1.4, g);
    },

    // A second crest travelling in from the jetty side (left) that merges into the peak
    // around q≈0.5 — the moment the reflected wave stacks onto the incoming swell. Returns
    // an additive height bump (as a fraction of the base envelope) centred on its position.
    stackSurge(x, q) {
      const w = this.wv;
      if (q < 0.12 || q > 0.72) return 0;
      const k = (q - 0.12) / 0.6;                 // 0→1 as it sweeps in and locks up
      const from = this.peakX() - 150;            // starts well off the jetty side
      const cx = from + (this.peakX() - from) * Math.min(1, k * 1.15);
      const amp = 0.72 * Math.sin(Math.min(1, k) * Math.PI);  // swells then is absorbed
      return amp * Math.exp(-(((x - cx) / (w.sigma * 0.55)) ** 2));
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
      else if (m === 'npc') this.updateNpc(dt);
      else if (m === 'ride') this.updateRide(dt);
      else if (m === 'exit') this.updateExit(dt);
      else if (m === 'pullback') this.updatePullback(dt);
      else this.updatePitch(dt);
      // record the bomb's drop+ride frame-by-frame (only while still in that phase, so the
      // completing frame that flips to exit/wipeout isn't captured) — see startReplayPrompt
      if (this.recording && this.mode === m && (m === 'ride' || m === 'pitch')) this.recSnap(m);
    },

    updateWatch(dt) {
      const w = this.wv;
      // Second press within PULL_WIN of committing = pull back off it. Committing
      // fast-forwards the wave 6×, so it lands 0.2–1.3s after you press — the window
      // always runs out of the lineup and into the drop, and updateRide ticks the rest.
      if (this.committed && this.pullT > 0) {
        this.pullT -= dt;
        if (input.pressed('a')) { this.startPullback(); return; }
      }
      // committing breaks the wave NOW: the build fast-forwards, the peak stops
      // wandering, and your grade was sealed the instant you pressed
      w.t += this.committed ? dt * 6 : dt;
      // Phase 1 — teach the tell: the first makeable and first closeout of a session
      // (waves 1–2) each pause the drift for a beat and point at the feathering.
      if (this.holdT > 0) this.holdT -= dt;
      if (!game.daily && !this.committed && this.q() > 0.5 && game.wave <= 2) {
        if (w.makeable && !w.monster && !game.taughtMakeable) {
          game.taughtMakeable = true;
          this.say('IT\'S A LEFT', 'RIDEABLE — GO FOR IT', 1.8);
          this.holdT = 1.5;
        } else if (!w.makeable && !game.taughtCloseout) {
          game.taughtCloseout = true;
          this.say('DUDE THAT\'S GONNA CLOSE OUT', 'DON\'T GET SMASHED', 1.8);
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
      // Right-of-way tell: the deeper rider swings in toward the peak and starts stroking
      // for it well before the rest of the pack, so "someone else is already on this one"
      // is something you can SEE before you decide. His lineup spot is untouched — only
      // the drawn position moves (see drawWatch).
      if (this.snake && !this.committed && this.q() > 0.42) {
        // just inside the peak — and clear of whoever else is sitting there, so the one
        // rider who matters isn't drawn on top of a neighbour
        let want = this.peakX() - 26;
        for (let i = 0; i < this.riders.length; i++) {
          if (i !== this.snake.idx && Math.abs(this.riders[i].x - want) < 18) want = this.riders[i].x - 20;
        }
        want = Math.max(30, want);
        const dx = want - this.snake.x;
        this.snake.x += Math.sign(dx) * Math.min(Math.abs(dx), 52 * dt);
        if (!this.snake.called) {
          this.snake.called = true;
          this.say('HE\'S DEEPER — HIS WAVE', 'RIGHT OF WAY  ·  LET HIM HAVE IT', 1.8);
        }
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
          this.pullT = PULL_WIN;   // …but you have a beat and a half to think better of it
          this.streakAtCommit = game.streak;   // a bail must leave the combo exactly as it was
          audio.select();
        }
      }
      if (w.t < w.T) return;

      // the wave arrives — judgement was sealed at the commit instant
      const tol = Math.max(9, 16 - game.stage * 2);
      const d = this.committed ? this.commitD : 0;
      const mult = streakMult();
      // Nothing that ends your run may land while you can still get off the wave. A
      // makeable read starts the drop as normal and updateRide ticks the rest of the
      // window; a fatal one hangs the wave on you until the last of it runs out.
      if (this.committed && this.pullT > 0 && this.fatalRead(d, tol)) return;
      if (!this.committed) {
        // letting waves go never touches the streak (GOOD CALL / WAVE WASTED)
        if (this.snake) { game.score += 150; audio.select(); this.yieldWave('GOOD CALL', 'HIS WAVE — YOU LET HIM HAVE IT  +150'); }
        else if (w.monster) { game.score += 150; this.say('GOOD CALL', 'TOO BIG — LET IT GO  +150'); audio.select(); this.recordAndAdvance('good'); }
        else if (w.makeable) { this.say('WAVE WASTED', 'DUDE, THAT WAS THE ONE'); this.recordAndAdvance('waste'); }
        else { game.score += 150; this.say('GOOD CALL', 'CLOSEOUT — LET IT GO  +150'); audio.select(); this.recordAndAdvance('good'); }
      } else if (w.monster) {
        // committing to a bomb — the clip moment. Record the drop+ride so we can offer an
        // instant replay whether it's a made ride or a pitched wipeout (see updateExit/Pitch).
        this.isBomb = true;
        if (w.rideable && d <= tol) { this.rideBomb(); this.beginRecord('ride'); }
        else { this.startPitch(); this.beginRecord('pitch'); }   // off-slot bomb / trap monster — over the falls
      } else if (this.snake) {
        // his wave. Taking it earns you nothing wherever you took off from — the drop
        // bonus is for waves that were yours. Pull back during the drop or wear it.
        this.say('YOU WENT ANYWAY...', 'HE WAS ALREADY UP', 1.6);
        this.startRide(false, 'clean');
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

    // Would riding this one, from where you committed, end the run outright? Used to hold
    // the fatal outcomes back while the pull-back window is still open.
    fatalRead(d, tol) {
      const w = this.wv;
      if (this.snake) return false;                    // snaking plays out through the drop
      if (w.monster) return !(w.rideable && d <= tol); // trap monster / off-slot bomb
      if (!w.makeable) return true;                    // committed to a closeout
      return d > tol * 1.9;                            // too far off the peak — pitched
    },

    // Phase 4 — ride the bomb: flat +2000, a bigger, gnarlier pocket, doubled exit bonus.
    rideBomb() {
      game.score += 2000;
      this.pendingAward += 2000;
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
      this.pendingAward += b;
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

    // ---- NPC beat: a lineup rider takes a quick interstitial wave while you watch.
    //      Two flavors, same lesson as your own reads: a walled one pitches + smashes
    //      them; a clearly-smaller one runs clean down the line. ~4s focus beat, then
    //      your wave builds as normal (its clock was held at 0 the whole time).
    npcPhase() { return { STAND: 1.2, DROP: 1.9, TOSS: 2.8, END: 4.0 }; },
    //      Also reused to play out a right-of-way wave you gave up (see yieldWave): opts
    //      pin down who goes, how big it is, the headline, and what happens after.
    startNpc(opts = {}) {
      this.mode = 'npc';
      this.nT = 0;
      this.nMake = opts.make !== undefined ? opts.make : Math.random() < 0.5;   // runner vs walled smash
      this.nPeak = opts.peak !== undefined ? opts.peak : 70 + Math.random() * 100;
      this.nA = opts.A !== undefined ? opts.A
        : (this.nMake ? 46 + Math.random() * 10 : 88 + Math.random() * 18);
      this.nTakeX = this.nPeak + (this.nMake ? 18 : 6);     // runner starts on the shoulder
      this.nSpin = Math.random() < 0.5 ? -1 : 1;
      this.nDone = false;                                   // outcome shown yet?
      this.shake = 0;
      this.nAfter = opts.after || null;                     // where to go when the beat ends
      // hide whoever's going: the named rider on a right-of-way wave, otherwise the
      // lineup rider nearest the takeoff spot
      let best = opts.idx;
      if (best === undefined) {
        let bd = 1e9;
        best = 0;
        this.riders.forEach((r, i) => { const d = Math.abs(r.x - this.nTakeX); if (d < bd) { bd = d; best = i; } });
      }
      this.nHide = best;
      this.nType = this.riders[best].type || 'boarder';     // he goes as whatever he is
      this.nLook = this.riders[best].look;                  // …wearing his own gear
      this.say(opts.msg || (this.nMake ? 'GOING ON A SMALL ONE...' : 'GOING ON A WALLED ONE...'),
        opts.sub || null, 1.5);
      audio.tone(58, 0.8, { type: 'triangle', vol: 0.07, slide: 20 });
    },

    // Hand a right-of-way wave to the rider who had priority — he rides it clean while
    // you watch, then the run rolls on. Used both when you never went and when you
    // pulled back off the drop (see updateRide).
    yieldWave(msg, sub) {
      this.startNpc({
        make: true,
        idx: this.snake ? this.snake.idx : undefined,
        A: Math.min(96, this.wv.A * 0.72),
        peak: this.wv.peak,
        msg, sub,
        after: () => this.recordAndAdvance('good'),
      });
    },
    updateNpc(dt) {
      this.nT += dt;
      const ph = this.npcPhase();
      if (!this.nDone && this.nT >= ph.TOSS) {
        this.nDone = true;
        if (this.nMake) {
          audio.select();
          this.say('MADE IT!', 'THE SMALL ONES RUN', 1.7);
        } else {
          this.shake = 4;
          audio.crash(); audio.noise(0.6, { vol: 0.12 });
          this.say('PITCHED AND SMASHED!', 'WALLS HAVE NO EXIT', 1.7);
        }
      }
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 9);
      if (this.nT >= ph.END) {
        // an interstitial beat hands you back your own wave; a yielded right-of-way wave
        // was the wave, so it runs its own follow-up instead (see yieldWave)
        const after = this.nAfter;
        this.nAfter = null;
        if (after) after(); else this.mode = 'watch';
      }
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
      // per-ride phases for the wandering pocket band (see bandCenterAt) — the channel
      // is different every wave, so it can't be memorised
      this.bandSeed = { a: Math.random() * 6.28, b: Math.random() * 6.28, c: Math.random() * 6.28 };
      this.buried = 0;
      this.tubeTime = 0;
      this.rideLen = 3.0 + Math.random() * 1.6;
      this.band = 15 * stat().band;   // per-rider pocket width (Phase 3)
      // trick state (Phase 5) — flat fields so the instant-replay recorder can snapshot them
      this.trickKind = null;          // null | 'air' | 'spin' | 'stance'
      this.trickT = 0; this.trickDur = 0; this.trickCd = 0;
      this.foamCreep = 0;             // ground the break claws back during a slow trick
      this.airFrom = 0; this.airH = 42 + game.stage * 4;
      this.stanceScore = 0; this.holdTouchT = 0;
      this.chain = 0;                 // tricks linked without losing the pocket
      this.trickCount = 0;
      this.bombRide = false;          // set true by rideBomb() — doubles the exit bonus
    },

    // ---- PITCH: committed to a bomb. A slow, dramatic beat — he drops in, hangs at
    //      the lip, gets thrown over the falls (slow-mo), the wave lands (screen shake)
    //      and buries him, then WIPEOUT. Phase timings below. (monster waves only)
    pitchPhase() { return { HANG: 1.0, DROP: 2.0, TOSS: 4.4, END: 5.6 }; },
    //      Doubles as the snaking punishment: pass snaked=true and the rider who had the
    //      right of way comes screaming past on the inside while the lip takes you.
    startPitch(snaked = false) {
      this.mode = 'pitch';
      this.pT = 0;
      this.pDur = this.pitchPhase().END;
      this.lipX = this.peakX();
      // snaked: it's a normal makeable wave and you took off where you stood
      this.pSnake = snaked
        ? { type: this.riders[this.snake.idx].type || 'boarder', look: this.riders[this.snake.idx].look }
        : null;
      this.takeX = Math.min(206, snaked ? this.px : this.sweetX());   // where he committed / drops in
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
        const out = this.pSnake
          ? { reason: 'DROPPED IN!', detail: 'DON\'T SNAKE WAVES, KOOK' }
          : { reason: 'OVER THE FALLS!', detail: 'TOO BIG — YOU GOT PITCHED' };
        if (this.isBomb) { this.startReplayPrompt(() => game.goto('wipeout', out)); return; }
        game.goto('wipeout', out);
      }
    },

    drawPitch(ctx, p) {
      const w = this.wv;
      const ph = this.pitchPhase();
      const crestY = SURFACE - w.A;
      // the towering wall, peaking where the lip throws — same asymmetric top-heavy wedge:
      // steep on the jetty side, longer on the shoulder, and it JACKS up over its own base
      // (overhang) rather than standing like a round swell.
      for (let x = 0; x < W; x += 2) {
        const dx = x - this.lipX;
        const sig = dx < 0 ? 50 : 82;
        const g = Math.exp(-Math.pow(Math.abs(dx) / sig, 1.4));
        const h = w.A * g * 1.02;
        if (h < 2) continue;
        // upper face leans forward toward the shoulder as it stands — the pitching overhang
        const lean = Math.round((h / w.A) * 10 * Math.max(0, 1 - this.pT / (ph.DROP + 0.4)));
        const top = SURFACE - h;
        ctx.fillStyle = p.seaD; ctx.fillRect(x + lean, Math.round(top), 2, H - Math.round(top));
        ctx.fillStyle = p.sea;  ctx.fillRect(x + lean, Math.round(top + h * 0.4), 2, Math.round(h * 0.6));
        // crest feathers menacingly while it stands and he drops in
        if (this.pT < ph.DROP && Math.abs(x - this.lipX) < 42 && (x + Math.floor(this.animT * 10)) % 4 < 2) {
          ctx.fillStyle = p.foam; ctx.fillRect(x + lean, Math.round(top) - 2, 2, 4);
        }
      }
      // the lip pitches over once the drop fails — churning curtain, grows through the toss,
      // then collapses into whitewater once the wave lands (so it doesn't linger as a ghost).
      const collapse = this.pSmashed ? Math.max(0, 1 - (this.pT - ph.TOSS) / 0.4) : 1;
      const fall = Math.max(0, Math.min(1, (this.pT - ph.DROP) / 1.2)) * collapse;
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

      // the rider who had the right of way, screaming past on the inside while you get
      // thrown — he was always going to make it; the wave was his
      if (this.pSnake) {
        const u = Math.min(1, this.pT / ph.TOSS);
        const sx = (this.takeX - 62) + u * 172;
        const sy = crestY + 30 + u * (SURFACE - 16 - (crestY + 30));
        if (sx < W + 20) {
          if (!drawRiderImg(ctx, localKey(this.pSnake.type, 'ride', this.pSnake.look), sx, sy, -0.1)) {
            drawMap(ctx, MAPS.trim, sx - 16, sy - 6, 2, true);
          }
          ctx.fillStyle = 'rgba(255,255,255,0.8)';   // his spray trail down the line
          for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(sx - 10 - i * 6), Math.round(sy + 7 + (i % 2) * 2), 3, 2);
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
        if (Math.floor(this.pT * 5) % 2) {
          if (this.pSnake) text(ctx, 'DON\'T SNAKE WAVES, KOOK', W / 2, 30, 10, '#f85838', 'center');
          else text(ctx, 'HANG ON!', W / 2, 30, 11, '#f8f890', 'center');
        }
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

      // the wave lands: it detonates in shallow water, throwing an exploding wall of
      // whitewater up off the sand — then buries him in the churn.
      if (this.pSmashed) {
        // low explosion across the impact zone — the thump into ankle-deep water throws a
        // ragged wall of foam UP off the sand, churning (not a clean block).
        const blast = Math.min(1, (this.pT - ph.TOSS) / 0.5);
        for (let x = Math.round(this.lipX - 70); x < this.lipX + 80; x += 3) {
          if (x < 0 || x >= W) continue;
          const d = Math.abs(x - this.lipX) / 78;
          const jag = 0.6 + 0.4 * Math.abs(Math.sin(x * 0.6 + this.pT * 9)) + ((x * 13) % 4) * 0.06;
          const up = Math.round(blast * (44 - d * 30) * jag);
          if (up < 2) continue;
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, SURFACE - up, 3, up);                       // ragged spikes above the line
          ctx.fillStyle = 'rgba(255,255,255,0.55)';                    // churn just below the line
          ctx.fillRect(x, SURFACE, 3, Math.round(6 + jag * 8));
        }
        // spray flung skyward off the detonation
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 22; i++) {
          const a = i * 0.9;
          const rr = blast * 40 + (i % 4) * 6;
          ctx.fillRect(Math.round(this.lipX + Math.cos(a) * rr * 1.4),
                       Math.round(SURFACE - 20 - Math.abs(Math.sin(a)) * rr), 2, 3);
        }
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
    // The pocket isn't a metronome — it's the wave surging under you. Three sines whose
    // frequencies share no common period (0.61 / 1.07 / 1.73) plus per-ride random phases
    // give a channel that wanders organically and never repeats, but stays smooth enough
    // to read and track: every bury is still your fault.
    bandCenterAt(tt) {
      const amp = this.pAmp + this.lateAmp * Math.max(0, 1 - this.rt / 1.2);
      const f = this.pFreq, s = this.bandSeed || { a: 0, b: 0, c: 0 };
      const n = (0.58 * Math.sin(tt * f * 0.61 + s.a)
        + 0.30 * Math.sin(tt * f * 1.07 + s.b)
        + 0.16 * Math.sin(tt * f * 1.73 + s.c)) / 1.04;
      return Math.max(112, Math.min(158, 134 + n * amp));
    },
    pocketY() { return this.bandCenterAt(this.rt); },
    // how far ahead (in seconds) the channel drawn at screen x will reach the rider —
    // the wave streams leftward past him, so everything right of him is the near future
    BAND_VIS: 150,

    // ---- tricks -------------------------------------------------------------
    trickZone() {
      const rel = (this.py - this.pocketY()) / (this.band || 15);
      if (Math.abs(rel) > 1.15) return null;     // outside the pocket — fix that first
      // up by the lip: the boarder goes over it, the bodysurfer goes under it
      if (rel < -0.34) return game.rider === 'surfer' ? 'tube' : 'air';
      if (rel > 0.34) return 'stance';
      return 'spin';
    },
    trickName(kind) { return (TRICKS[game.rider] || TRICKS.boarder)[kind]; },
    chainMult() { return 1 + Math.min(4, this.chain) * 0.35; },   // up to 2.4×
    startTrick(kind) {
      this.trickKind = kind;
      this.trickT = 0;
      // the air keeps its snap; everything else draws out (TRICK_SLOW). The bodysurfer's
      // roll turns his whole body over rather than pivoting flat, so it's slower again.
      const spinBase = game.rider === 'surfer' ? 0.75 : 0.6;
      this.trickDur = kind === 'air' ? 0.95
        : kind === 'tube' ? 1.05
        : kind === 'spin' ? spinBase * TRICK_SLOW : 0;   // stance runs while held
      this.airFrom = this.py;
      this.stanceScore = 0;
      if (kind === 'air') audio.tone(300, 0.45, { type: 'square', slide: 430, vol: 0.09 });
      else if (kind === 'tube') audio.tone(150, 0.7, { type: 'triangle', slide: -60, vol: 0.09 });
      else if (kind === 'spin') audio.tone(520, 0.4, { type: 'square', slide: 320, vol: 0.08 });
      else audio.tone(170, 0.3, { type: 'triangle', slide: 70, vol: 0.07 });
    },
    awardTrick(base, label) {
      const b = Math.round(base * streakMult() * this.chainMult());
      game.score += b;
      this.chain++; this.trickCount++;
      this.floaters.push({ txt: `${label} +${b}`, x: Math.min(210, this.pocketX()), y: this.py - 22, t: 1.5 });
      audio.trick();
    },
    // Runs the active trick. Returns true while the rider is airborne (no bury, no drift).
    updateTrick(dt) {
      const k = this.trickKind;
      if (!k) return false;
      if (k === 'air') {
        this.trickT += dt;
        const u = Math.min(1, this.trickT / this.trickDur);
        this.py = this.airFrom - Math.sin(u * Math.PI) * this.airH;
        if (u >= 1) {
          // the channel wandered while you were in the air — that's the whole risk
          const off = Math.abs(this.py - this.pocketY());
          if (off <= this.band) { this.awardTrick(900, this.trickName('air')); audio.splash(); }
          else {
            this.chain = 0;
            this.buried = Math.max(this.buried, 0.3);
            this.say('BLOWN LANDING', 'GET BACK IN THE POCKET', 1.2);
            audio.noise(0.35, { vol: 0.11 });
          }
          this.trickKind = null; this.trickCd = 0.35;
        }
        return true;
      }
      if (k === 'tube') {
        // the bodysurfer's answer to the air: instead of going OVER the lip he pulls up
        // under it, disappears behind the curtain, and gets spat out down the line. Same
        // bargain as the air — you're safe from the bury while you're in there, but the
        // channel keeps wandering and you have to come out somewhere.
        this.trickT += dt;
        const u = Math.min(1, this.trickT / this.trickDur);
        this.py = this.airFrom - Math.sin(u * Math.PI) * this.airH * 0.55;
        if (u >= 1) {
          const off = Math.abs(this.py - this.pocketY());
          if (off <= this.band) {
            this.awardTrick(900, this.trickName('tube'));
            audio.splash();
            audio.tone(420, 0.35, { type: 'square', slide: 380, vol: 0.09 });   // the spit
          } else {
            this.chain = 0;
            this.buried = Math.max(this.buried, 0.3);
            this.say('ATE IT IN THERE', 'GET BACK IN THE POCKET', 1.2);
            audio.noise(0.35, { vol: 0.11 });
          }
          this.trickKind = null; this.trickCd = 0.35;
        }
        return true;
      }
      if (k === 'spin') {
        this.trickT += dt;
        if (this.trickT >= this.trickDur) {
          this.awardTrick(300, this.trickName('spin'));
          this.trickKind = null; this.trickCd = 0.45;
        }
        return false;   // passive drift still applies — a greedy spin can bury you
      }
      // stance: held, scores per second, ends on release or when you slip out of the pocket
      this.trickT += dt;
      const holding = input.held('a') || (input.touch.active && !input.touch.dragging);
      const inBand = Math.abs(this.py - this.pocketY()) <= this.band;
      if (holding && inBand) {
        const g = 240 * dt * streakMult() * this.chainMult();
        game.score += g; this.stanceScore += g;
      } else {
        if (this.trickT >= 0.45 * TRICK_SLOW && this.stanceScore > 0) {
          this.chain++; this.trickCount++;
          this.floaters.push({ txt: `${this.trickName('stance')} +${Math.round(this.stanceScore)}`,
            x: Math.min(210, this.pocketX()), y: this.py - 22, t: 1.5 });
          audio.trick();
        }
        this.trickKind = null; this.trickCd = 0.3;
      }
      return false;
    },

    // ---- PULL BACK: you pressed again inside PULL_WIN and got off the wave. He rides UP
    //      the face and out over the back, and is left floating in the flat as it peels
    //      away without him. What it's worth depends on the wave you got off — the streak
    //      is never touched, and it never costs a life.
    startPullback() {
      const w = this.wv;
      const fromDrop = this.mode === 'ride';
      this.mode = 'pullback';
      this.pbT = 0;
      this.pbX = fromDrop ? this.pocketX() : this.px;
      this.pbY0 = fromDrop ? this.py : LINEUP_Y;
      this.pullT = 0;
      this.floaters = [];
      this.pbSplashed = false;
      // You didn't ride it, so you don't keep what riding it paid: the drop bonus (and
      // the bomb's +2000) go back, and the combo returns to exactly where it stood when
      // you pressed. A late drop had already zeroed the streak — that's undone too.
      game.score -= this.pendingAward || 0;
      this.pendingAward = 0;
      if (this.streakAtCommit !== undefined) game.streak = this.streakAtCommit;
      this.isBomb = false; this.bombRide = false;
      this.recording = false; this.recBuf = null;
      if (this.snake) {
        // his wave, and you gave it back to him — then he rides it out (see yieldWave)
        this.snake.yielded = true;
        game.score += 250;
        this.pbSub = 'GOOD ETIQUETTE  +250';
        this.pbAfter = () => this.yieldWave('HIS WAVE', 'HE HAD THE RIGHT OF WAY');
      } else if (w.monster && w.rideable) {
        // the session's one makeable bomb, and it was ON — no "saved it" bonus for that
        this.pbSub = 'THAT BOMB WAS MAKEABLE...';
        this.pbAfter = () => this.recordAndAdvance('waste');
      } else if (!w.makeable || w.monster) {
        // a late read still counts — half of what never going at all would have paid
        game.score += 75;
        this.pbSub = (w.monster ? 'TOO BIG' : 'CLOSEOUT') + ' — SAVED IT  +75';
        this.pbAfter = () => this.recordAndAdvance('good');
      } else {
        this.pbSub = 'WAVE WASTED — THAT WAS THE ONE';
        this.pbAfter = () => this.recordAndAdvance('waste');
      }
      // clears before the beat ends, so the last half-second shows him alone in the flat
      this.say('PULLED BACK', this.pbSub, 1.5);
      audio.select();
      audio.tone(190, 0.4, { type: 'triangle', slide: 130, vol: 0.07 });
    },

    // The bail-out prompt and its draining window. Same in the lineup and on the drop, so
    // the move never looks like two different things.
    drawPullPrompt(ctx, y) {
      if (!(this.pullT > 0)) return;
      const u = Math.max(0, Math.min(1, this.pullT / PULL_WIN));
      text(ctx, input.usedTouch ? 'TAP AGAIN TO PULL BACK' : 'X AGAIN TO PULL BACK', W / 2, y, 8, '#48d048', 'center');
      ctx.fillStyle = '#181828'; ctx.fillRect(W / 2 - 24, y + 10, 48, 3);
      ctx.fillStyle = u > 0.35 ? '#48d048' : '#f8d848';
      ctx.fillRect(W / 2 - 24, y + 10, Math.round(u * 48), 3);
    },

    updatePullback(dt) {
      this.pbT += dt;
      if (!this.pbSplashed && this.pbT > PULL_BEAT * 0.42) {   // punching out through the crest
        this.pbSplashed = true;
        audio.splash();
      }
      if (this.pbT >= PULL_BEAT) {
        const after = this.pbAfter;
        this.pbAfter = null; this.pbSplashed = false;
        if (after) after();
      }
    },

    // The wave rolls on through and shrinks away toward the beach while he climbs the
    // face, punches over the crest, and settles in the flat behind it.
    drawPullback(ctx, p) {
      const w = this.wv;
      const u = Math.min(1, this.pbT / PULL_BEAT);
      const fade = Math.max(0, (u - 0.4) / 0.6);            // it leaves without him
      const scale = 1 - fade * 0.9;
      const baseY = SURFACE + fade * 34;                    // …and rolls on in toward the beach
      const peak = this.peakX();
      const crestOf = (x) => baseY - this.waveH(x, 1) * scale;
      const fg = faceGradient(ctx, crestOf(peak), baseY, p);
      for (let x = 0; x < W; x += 2) {
        const h = this.waveH(x, 1) * scale;
        if (h < 2) continue;
        const top = baseY - h;
        ctx.fillStyle = fg;
        ctx.fillRect(x, Math.round(top), 2, Math.round(h) + 2);   // sits on the backdrop's sea
        if (x > peak) {
          ctx.fillStyle = 'rgba(180,224,248,0.16)';
          ctx.fillRect(x, Math.round(top + h * 0.45), 2, Math.round(h * 0.55));
        }
        // it breaks on down the line without you — whitewater marching right along the crest
        if (h > 8 && (x + Math.floor(this.pbT * 40)) % 6 < 3) {
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(top) - 2, 2, 4 + Math.round(fade * 6));
        }
      }
      // flat water behind the wave — where he ends up
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i++) {
        const sx = ((((i * 33 + this.pbT * 40) % (W + 30)) + W + 30) % (W + 30)) - 15;
        ctx.fillRect(Math.round(sx), 112 + (i % 3) * 5, 9, 1);
      }
      // ---- him, going over the back ----
      // up the face to just clear of the crest by u≈0.42, then he rides the back down as
      // the wave shrinks away under him and sits up in the flat.
      // He goes to the crest where he is, then rides the back down as the wave sinks away
      // beneath him and finishes in the flat. From the lineup that's a climb; from the
      // lip (where he was already above the crest) it's him settling onto the back of it.
      const climb = Math.min(1, u / 0.42);
      const crestNow = Math.min(crestOf(this.pbX), 150) + 3;
      const rx = this.pbX - 6 - u * 12;                       // he drifts back, not with it
      const ry = this.pbY0 + (crestNow - this.pbY0) * (climb * climb * (3 - 2 * climb));
      const over = u > 0.42;
      const rot = over ? 0.30 * Math.max(0, 1 - (u - 0.42) / 0.3) : -0.44 * climb;
      const key = riderKey(over ? 'sit' : 'paddle');
      if (!drawRiderImg(ctx, key, rx, ry, rot, 0, 1)) {
        ctx.save();
        ctx.translate(rx, Math.round(ry)); ctx.rotate(rot);
        drawMap(ctx, over ? spr().paddleA : spr().ride, -16, -6, 2, true);
        ctx.restore();
      }
      if (u > 0.34 && u < 0.62) {                             // spray as he punches through
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(Math.round(rx - 8 + (i % 4) * 6),
            Math.round(ry - 4 - ((i * 7) % 14) - (u - 0.34) * 40), 3, 3);
        }
      }
      // no banner here — say('PULLED BACK', …) owns the headline for the whole beat
    },

    updateRide(dt) {
      if (this.dropT > 0) {
        // the tail of the pull-back window (it started at the commit press, back in the
        // lineup) — press again and you're off it, whatever kind of wave this is
        if (this.pullT > 0) {
          this.pullT -= dt;
          if (input.pressed('a')) { this.startPullback(); return; }
        }
        // the drop: accelerating fall from the lip into the pocket, no bury risk yet
        this.dropT -= dt;
        this.foamX += this.peel * dt * 0.3;
        const k = Math.min(1, 1 - this.dropT / this.dropDur);
        // cubic ease-in: real hang time at the lip, then freefall
        this.py = this.dropY0 + (this.pocketY() - this.dropY0) * k * k * k
          + Math.sin(this.animT * 26) * (1 - k) * 1.5;  // teetering wobble while hanging
        if (this.dropT <= 0) {
          // you rode it anyway — he zooms past on the inside and the lip takes you
          if (this.snake && !this.snake.yielded) { this.startPitch(true); return; }
          audio.splash();
          this.say('HOLD THE POCKET', input.usedTouch ? 'SLIDE ↑↓ ANYWHERE — STAY BETWEEN THE LINES' : '↑↓ STAY BETWEEN THE LINES', 2.6);
        }
        return;
      }
      this.rt += dt;
      // slow creep only — the foam never overruns the frame; speed reads via the streaming face
      this.foamX = Math.min(108, this.foamX + this.peel * dt * 0.4);
      // A drawn-out trick costs you ground: the break eats forward while you're busy and
      // falls back once you're trimming again. Visual pressure only — capped well short
      // of the rider, so the whitewater still never overtakes him.
      const dragging = this.trickKind && this.trickKind !== 'air' && this.trickKind !== 'tube';
      this.foamCreep = Math.max(0, Math.min(9,
        this.foamCreep + (dragging ? 16 : -11) * dt));

      // tricks (Phase 5): the band zone under you picks the move — see startTrick.
      if (this.trickCd > 0) this.trickCd -= dt;
      // touch has no "hold" button, so a finger parked down without dragging is the hold
      if (input.touch.active && !input.touch.dragging) this.holdTouchT += dt;
      else this.holdTouchT = 0;
      const airborne = this.updateTrick(dt);
      if (!this.trickKind && this.trickCd <= 0) {
        const zone = this.trickZone();
        const tapped = input.pressed('a');
        if (zone === 'stance' && (input.held('a') || this.holdTouchT > 0.18)) this.startTrick('stance');
        else if (zone && tapped) this.startTrick(zone);
        else if (!zone && tapped) this.say('GET IN THE POCKET FIRST', null, 0.8);
      }

      // steering: none mid-air or mid-spin; half rate while you're set in the stance
      if (!this.trickKind) {
        if (input.held('up')) this.py -= 75 * dt;
        if (input.held('down')) this.py += 90 * dt;
        if (input.touch.active) this.py += input.touch.dy * 1.4;
      } else if (this.trickKind === 'stance') {
        if (input.held('up')) this.py -= 38 * dt;
        if (input.held('down')) this.py += 45 * dt;
        if (input.touch.active && input.touch.dragging) this.py += input.touch.dy * 0.7;
      }
      if (!airborne) this.py += 20 * dt;   // passive drift — the price of every trick
      input.touch.dy = 0;
      this.py = Math.max(airborne ? 56 : 104, Math.min(166, this.py));

      const off = Math.abs(this.py - this.pocketY());
      const band = this.band;   // per-rider pocket width (Phase 3)
      if (!airborne) {
        if (off > band) this.buried += dt * (off > band + 12 ? 2.2 : 1);
        else this.buried = Math.max(0, this.buried - dt * 1.6);
      }
      if (this.buried > 0.35) this.chain = 0;   // lose the pocket, lose the chain

      if (this.rt > 0.6 && !airborne) {
        this.tubeTime += dt;
        // passive points are now a trickle — tricks are how you actually score
        game.score += 22 * dt * stat().tube * (off <= band ? 1 : 0);
      }

      if (this.buried > 0.95) {
        if (this.isBomb) { this.startReplayPrompt(() => game.goto('wipeout', { reason: 'BURIED!', detail: 'YOU LOST THE POCKET' })); return; }
        game.goto('wipeout', { reason: 'BURIED!', detail: 'YOU LOST THE POCKET' });
        return;
      }
      if (this.rt >= this.rideLen) {
        // made it all the way through — tube bonus + everything you landed on the way
        const bonus = Math.round((500 + Math.round(this.tubeTime * 90) + this.trickCount * 120) * streakMult());
        game.score += bonus;
        game.made++;
        // a slot/clean ride made in full extends the streak; late drops already zeroed it
        if (this.dropTier !== 'late') game.streak++;
        if (game.daily) game.dailyGrid.push(this.dropTier);   // 🟩/🟦/🟨
        else if (game.made % 2 === 0) game.stage = Math.min(3, game.stage + 1);
        this.say('SPIT OUT!', `${this.trickCount} TRICKS · TUBE ${this.tubeTime.toFixed(1)}s  +${bonus}`, 2.6);
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
            bandSeed: this.bandSeed, airH: this.airH, stage: game.stage }
        : { wv: this.wv, lipX: this.lipX, takeX: this.takeX, pSpin: this.pSpin, stage: game.stage };
    },
    recSnap(mode) {
      if (this.recBuf.length > 900) return;   // ~15s cap — a bomb never runs this long
      this.recBuf.push(mode === 'ride'
        ? { foamX: this.foamX, foamCreep: this.foamCreep, animT: this.animT, rt: this.rt, py: this.py, dropT: this.dropT,
            trickKind: this.trickKind, trickT: this.trickT, trickDur: this.trickDur,
            airFrom: this.airFrom, chain: this.chain, buried: this.buried, tubeTime: this.tubeTime }
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
      const shk = ((this.mode === 'pitch' || this.mode === 'npc') && this.shake > 0) ? this.shake : 0;
      if (shk) { ctx.save(); ctx.translate(Math.round((Math.random() * 2 - 1) * shk), Math.round((Math.random() * 2 - 1) * shk)); }
      const bgKey = BG_KEYS[game.stage];
      if (imgReady(bgKey)) {
        if (shk) ctx.drawImage(IMG[bgKey], -8, -8, W + 16, H + 16);   // overscan hides shake edges
        else ctx.drawImage(IMG[bgKey], 0, 0, W, H);                   // photo backdrop provides sky + sea
      } else {
        skyAndSea(ctx, p);
      }
      if (this.mode === 'watch') this.drawWatch(ctx, p);
      else if (this.mode === 'npc') this.drawNpc(ctx, p);
      else if (this.mode === 'ride') this.drawRide(ctx, p);
      else if (this.mode === 'exit') this.drawExit(ctx, p);
      else if (this.mode === 'pullback') this.drawPullback(ctx, p);
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
      // the reflected wedge: a diagonal crest peeling off the jetty side, converging on
      // the peak. This is the second wave that stacks onto the swell (see stackSurge).
      if (q > 0.12 && q < 0.72) {
        const k = (q - 0.12) / 0.6;
        const from = peak - 150;
        const cx = from + (peak - from) * Math.min(1, k * 1.15);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 26; i++) {
          const lx = cx - i * 5;                    // trailing diagonal back toward the jetty
          if (lx < -6) break;
          ctx.fillRect(Math.round(lx), Math.round(120 + i * 1.4), 4, 2);
        }
      }
      // looser, gradient-shaded face: dark pocket under the lip rolling to a glassy lit base
      const fg = faceGradient(ctx, baseY - this.waveH(peak, q), SURFACE, p);
      for (let x = 0; x < W; x += 2) {
        const h = this.waveH(x, q);
        if (h < 2) continue;
        const top = baseY - h;
        ctx.fillStyle = fg;
        ctx.fillRect(x, Math.round(top), 2, Math.round(h));
        // open face catches more light on the shoulder (right of peak) — soft glassy sheen
        if (x > peak) {
          ctx.fillStyle = 'rgba(180,224,248,0.16)';
          ctx.fillRect(x, Math.round(top + h * 0.45), 2, Math.round(h * 0.55));
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
      // pitching lip: once it stands up the top-heavy crest throws FORWARD over the
      // trough toward the shoulder, casting a shadow band beneath — the tube forming.
      if (q > 0.6) {
        const jut = (q - 0.6) / 0.4;                       // 0→1 as it pitches over
        const ctop = baseY - this.waveH(peak, q);
        const reach = Math.round(7 + jut * 18);            // how far it overhangs the shoulder
        ctx.fillStyle = 'rgba(8,16,48,0.30)';              // cavity shadow under the overhang
        ctx.fillRect(peak, Math.round(ctop + 1), reach + 6, Math.round(12 + jut * 16));
        ctx.fillStyle = p.foam;
        for (let i = 0; i <= reach; i += 2) {              // the curling lip, drooping as it reaches
          const t = i / reach;
          const ly = ctop - 4 + Math.round(t * t * (7 + jut * 12));
          ctx.fillRect(peak + i, Math.round(ly), 3, Math.round(5 + jut * 4));
        }
      }
      // backwash (stage 2+): water rebounding off the steep beach rushes back out and
      // collides with the wave's base near the peak — the Wedge's signature chop. A band
      // of churn sweeps seaward along the base; where it meets the face it throws spray.
      if (game.stage >= 2 && q > 0.35) {
        const cyc = (this.animT * 0.9) % 1;
        const cx = peak + 40 - cyc * 52;                   // sweeping in toward the peak base
        // chop rides on the wave's own base line, not on flat open water
        const baseAt = (xx) => baseY - Math.min(this.waveH(xx, q), 10) - 1;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (let i = 0; i < 5; i++) {
          const bx = Math.round(cx + i * 4);
          if (bx < peak - 4 || bx > peak + 44) continue;   // only the shoreward base near the peak
          ctx.fillRect(bx, Math.round(baseAt(bx) + (i % 2) * 2), 3, 2);
        }
        if (cyc > 0.72) {                                  // collision: spray kicks up the face
          const burst = (cyc - 0.72) / 0.28;
          const fy = baseAt(peak + 4);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          for (let i = 0; i < 6; i++) {
            const sx = peak - 4 + (i % 3) * 5;
            ctx.fillRect(sx, Math.round(fy - burst * (10 + i * 4)), 3, 3);
          }
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
      // the other riders in the lineup — the swell lifts them as it rolls through. On a
      // right-of-way wave one of them has already swung deep and is stroking for it
      // (updateWatch moves snake.x); he goes prone before the rest of the pack does.
      const deepIdx = this.snake ? this.snake.idx : -1;
      const drawLocal = (i) => {
        const r = this.riders[i];
        const deep = i === deepIdx;
        const rx = deep ? this.snake.x : r.x;
        const ry = LINEUP_Y + Math.sin(this.animT * 2 + r.ph) * 2 - this.waveH(rx, q) * 0.25 * q * q;
        const stroking = paddling || (deep && q > 0.42);
        if (!drawRiderImg(ctx, localKey(r.type, stroking ? 'paddle' : 'sit', r.look), rx, ry - 4, 0, 0)) drawMap(ctx, MAPS.paddleA, rx - 16, ry - 6, 2, true);
        if (deep && q > 0.42 && Math.floor(this.animT * 4) % 2) {
          // kept clear of the frame edges — he sits deep, and the label must not clip
          text(ctx, 'HIS WAVE', Math.max(32, Math.min(W - 32, rx)), ry - 22, 7, '#f85838', 'center');
        }
      };
      for (let i = 0; i < this.riders.length; i++) if (i !== deepIdx) drawLocal(i);
      if (deepIdx >= 0) drawLocal(deepIdx);   // on top — he's the one you have to read
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
        text(ctx, 'COMMITTED!', Math.max(30, Math.min(W - 30, this.px)), py - 24, 9, '#48d048', 'center');
        this.drawPullPrompt(ctx, 44);
      } else if (input.usedTouch && w.makeable && q > 0.5 && Math.floor(this.animT * 3) % 2 === 0) {
        // touch players get a big unmissable prompt — the whole screen is the button
        text(ctx, 'TAP TO GO!', W / 2, 40, 16, '#48d048', 'center');
      }
      // coaching line + arrival meter
      const goHint = this.committed
        ? 'COMMITTED — HERE IT COMES!'
        : (input.usedTouch ? 'SLIDE ←→ TO MOVE · TAP WHEN ▼ IS OVER YOU' : '←→ UNDER THE MARKER · X WHEN IT\'S OVER YOU');
      text(ctx, w.makeable || q < 0.5 ? goHint : 'CLOSED OUT — NOWHERE TO GO', W / 2, 224, 7, q > 0.5 && !w.makeable ? '#f85838' : '#fff', 'center');
      text(ctx, 'SET', 6, 22, 7, '#fff');
      ctx.fillStyle = '#181828'; ctx.fillRect(30, 23, 60, 5);
      ctx.fillStyle = q > 0.8 ? '#f85838' : '#f8d848';
      ctx.fillRect(30, 23, Math.round(q * 60), 5);
    },

    // the interstitial NPC wave — same visual language as drawWatch (march-in, gradient
    // face, the feathering tell) so the lesson transfers, minus markers/meters: you're
    // a spectator for ~4s.
    drawNpc(ctx, p) {
      const ph = this.npcPhase();
      const q = Math.min(1, this.nT / ph.STAND);
      const A = this.nA, peak = this.nPeak;
      const baseY = 116 + q * (SURFACE - 116);
      const hAt = (x) => {
        const dx = x - peak;
        const sig = dx < 0 ? 44 : (this.nMake ? 72 : 58);
        let g = Math.exp(-Math.pow(Math.abs(dx) / sig, 1.4));
        if (!this.nMake) g = Math.min(1, g * 1.7);          // squared-off wall
        return A * Math.pow(q, 1.4) * g;
      };
      const crestY = baseY - hAt(peak);
      const fg = faceGradient(ctx, crestY, SURFACE, p);
      for (let x = 0; x < W; x += 2) {
        const h = hAt(x);
        if (h < 2) continue;
        const top = baseY - h;
        ctx.fillStyle = fg;
        ctx.fillRect(x, Math.round(top), 2, Math.round(h));
        if (x > peak) {
          ctx.fillStyle = 'rgba(180,224,248,0.16)';
          ctx.fillRect(x, Math.round(top + h * 0.45), 2, Math.round(h * 0.55));
        }
        // the exact tell you read on your own waves — reinforced from the channel
        const feather = this.nMake ? Math.abs(x - peak) < 22 : h > A * q * 0.55;
        if (q > 0.5 && feather && (x + (Math.floor(this.animT * 10) % 4)) % 4 < 2) {
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(top) - 2, 2, 4);
        }
      }
      // walled flavor: the lip throws once the drop fails, then collapses at impact
      if (!this.nMake && this.nT > ph.DROP) {
        const collapse = this.nDone ? Math.max(0, 1 - (this.nT - ph.TOSS) / 0.4) : 1;
        const fall = Math.min(1, (this.nT - ph.DROP) / 0.9) * collapse;
        for (let x = Math.round(peak - 34); x < peak + 38; x += 2) {
          if (x < 0 || x >= W) continue;
          const col = (x - peak) / 38;
          const jag = 1 + Math.sin(x * 0.5 + this.nT * 12) * 0.12;
          const len = Math.max(2, (A * 0.8) * fall * (1 - Math.abs(col) * 0.42) * jag);
          ctx.fillStyle = 'rgba(232,240,248,0.72)';
          ctx.fillRect(x, Math.round(crestY), 2, Math.round(len));
          ctx.fillStyle = p.foam;
          ctx.fillRect(x, Math.round(crestY + len - 4), 2, 4);
        }
      }
      // the smash: ragged foam thrown up off the sand where the wave lands
      if (!this.nMake && this.nDone) {
        const blast = Math.min(1, (this.nT - ph.TOSS) / 0.5);
        ctx.fillStyle = p.foam;
        for (let x = Math.round(peak - 44); x < peak + 50; x += 3) {
          if (x < 0 || x >= W) continue;
          const d = Math.abs(x - peak) / 48;
          const jag = 0.6 + 0.4 * Math.abs(Math.sin(x * 0.6 + this.nT * 9));
          const up = Math.round(blast * (30 - d * 20) * jag);
          if (up >= 2) ctx.fillRect(x, baseY - up, 3, up + 5);
        }
      }
      // ---- the NPC rider, per phase (drawn as whichever kind of local he is) ----
      const nk = (pose) => localKey(this.nType, pose, this.nLook);
      let rx, ry, rot = 0, key = nk('paddle');
      if (this.nT < ph.STAND) {
        rx = this.nTakeX;                                    // paddling in as it stands up
        ry = baseY - hAt(rx) + 4;
      } else if (this.nT < ph.DROP) {
        const dp = (this.nT - ph.STAND) / (ph.DROP - ph.STAND);
        rx = this.nTakeX + dp * 8;                           // dropping down the face
        ry = (baseY - hAt(this.nTakeX)) + 6 + dp * dp * hAt(this.nTakeX) * 0.45;
        rot = 0.2 + dp * 0.3;
        key = nk('drop');
      } else if (this.nMake) {
        // racing the shoulder, outrunning the peel, spray off the tail
        const tp = Math.min(1, (this.nT - ph.DROP) / (ph.END - 0.4 - ph.DROP));
        rx = this.nTakeX + 8 + tp * 52;
        ry = SURFACE - hAt(rx) * 0.35 - 4;
        rot = -0.08;
        key = nk('ride');
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(rx - 8 - i * 5), Math.round(ry + 6 + (i % 2) * 2), 3, 2);
      } else if (!this.nDone) {
        // pitched — thrown up and over with the lip
        const tp = (this.nT - ph.DROP) / (ph.TOSS - ph.DROP);
        rx = this.nTakeX + 8 + tp * 18;
        ry = (SURFACE - A * 0.5) - Math.sin(tp * Math.PI * 0.8) * 26 + tp * 40;
        rot = this.nSpin * (0.4 + tp * 3.4);
        key = nk('ride');
      } else {
        rx = this.nTakeX + 26; ry = SURFACE - 12;            // buried in the churn
        rot = this.nSpin * 1.8;
        key = nk('ride');
      }
      if (!drawRiderImg(ctx, key, rx, ry, rot, 0, 1)) {
        ctx.save();
        ctx.translate(rx, ry); ctx.rotate(rot);
        drawMap(ctx, MAPS.paddleA, -16, -6, 2, true);
        ctx.restore();
      }
      // the rest of the lineup (minus whoever went) + you, sitting, lifted by the swell
      for (let i = 0; i < this.riders.length; i++) {
        if (i === this.nHide) continue;
        const r = this.riders[i];
        const ry2 = LINEUP_Y + Math.sin(this.animT * 2 + r.ph) * 2 - hAt(r.x) * 0.25 * q * q;
        if (!drawRiderImg(ctx, localKey(r.type, 'sit', r.look), r.x, ry2 - 4, 0, 0)) drawMap(ctx, MAPS.paddleA, r.x - 16, ry2 - 6, 2, true);
      }
      const py = LINEUP_Y + Math.sin(this.animT * 2.6) * 2 - hAt(this.px) * 0.25 * q * q;
      if (!drawRiderImg(ctx, riderKey('sit'), this.px, py - 4, 0, 0)) {
        drawMap(ctx, spr().paddleA, this.px - 16, py - 6, 2, true);
      }
      ctx.fillStyle = '#f8f890';
      ctx.fillRect(this.px - 1, py + 10, 3, 2);              // you-marker stays put
    },

    drawRide(ctx, p) {
      // the break front, plus whatever ground it has clawed back during a slow trick.
      // pocketX() deliberately reads this.foamX, so the rider holds his spot on screen
      // and the whitewater is the thing that closes the gap.
      const foamX = this.foamX + (this.foamCreep || 0);
      const pkX = this.pocketX();
      const w = this.wv;
      // looser, gradient-shaded standing face: dark in the pocket, glassy toward the base
      const fg = faceGradient(ctx, SURFACE - w.A, SURFACE, p);
      // The wave is breaking BEHIND the rider and eating forward down the line: left of
      // the edge it has already gone to whitewater; at the edge it's turning over right
      // now, so blue bleeds through a boiling churn into white; ahead of that is clean
      // blue face. The edge is ragged and breathes, so the break reads as a live thing
      // chasing him rather than a straight cut.
      const edge = foamX + Math.sin(this.animT * 3.1) * 2.5;
      const CHURN = 38;                       // width of the blue → white transition
      const taperAt = (x) => (x > foamX ? Math.max(0.55, 1 - ((x - foamX) / W) * 0.9) : 1);
      for (let x = 0; x < W; x += 2) {
        const h = w.A * taperAt(x);
        const top = SURFACE - h;
        // the break line is ragged and breathes — never a straight cut
        const e = edge + Math.sin(x * 0.4 + this.animT * 9) * 3 + Math.sin(x * 0.13 - this.animT * 4) * 2;
        ctx.fillStyle = fg;
        ctx.fillRect(x, Math.round(top), 2, H - Math.round(top));
        if (x >= e) {
          // clean blue face ahead of the break — glassy sheen low on it
          ctx.fillStyle = 'rgba(180,224,248,0.12)';
          const my = Math.round(top + h * 0.55);
          ctx.fillRect(x, my, 2, H - my);
        } else {
          // behind the break the face is turning over: blue still showing through at the
          // edge, whitening the further back you look, until it's pure tumbling whitewater
          const m = Math.min(1, (e - x) / CHURN);
          const jy = Math.round(top + Math.sin(x * 0.3 + this.animT * 14) * 4 * (1 - m * 0.6));
          ctx.fillStyle = `rgba(248,252,255,${(0.18 + 0.82 * m * m).toFixed(3)})`;
          ctx.fillRect(x, jy, 2, H - jy);
          // aerated chunks boiling up through the face as it goes over
          if (m < 1 && ((x * 7 + Math.floor(this.animT * 26)) % 11) < 4) {
            ctx.fillStyle = `rgba(255,255,255,${(0.8 - 0.4 * m).toFixed(2)})`;
            const cy = top + ((x * 17 + Math.floor(this.animT * 40)) % Math.max(6, Math.round(h * 0.7)));
            ctx.fillRect(x, Math.round(cy), 2, 4);
          }
        }
      }
      // white cap running along the crest right where it's toppling, and spray flung
      // FORWARD off the break — the whitewater reaching down the line for the rider
      ctx.fillStyle = p.foam;
      for (let x = Math.max(0, Math.round(edge - CHURN)); x < Math.min(W, edge + 4); x += 2) {
        const top = SURFACE - w.A * taperAt(x);
        ctx.fillRect(x, Math.round(top) - 2, 2, 4 + Math.round(Math.abs(Math.sin(x * 0.35 + this.animT * 8)) * 5));
      }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 8; i++) {
        const sx = edge + 4 + ((this.animT * 90 + i * 21) % 40);
        const sy = SURFACE - w.A * 0.88 + ((i * 23) % 40) + Math.sin(this.animT * 7 + i) * 3;
        ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
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
      // the barrel: a hollow, ROUNDED tube. The top-heavy lip throws over from the crest,
      // curls down toward the shoulder to roof the cavity, and the mouth opens down the
      // line where the light gets in — that's the exit the rider is driving for.
      // starts at the break edge, not behind it, so the blue → white churn stays visible
      const tubeL = Math.round(foamX + 4);
      const tubeR = pkX + 54;                       // wider mouth = a bigger, rounder barrel
      const crestY = SURFACE - w.A;
      const span = tubeR - tubeL;
      // ceiling of the barrel: the lip pitches WAY out from the crest and arcs down low
      // over the rider, roofing a deep cavity — the more it curls, the more hollow it reads.
      const lipCurve = (x) => {
        const f = Math.max(0, Math.min(1, (x - tubeL) / span));
        return crestY - 8 + f * f * (w.A * 0.5);    // drops toward mid-face — a real overhang
      };
      // deep dark hollow under the overhang — nearly the full face at the throwing pit.
      // Banded and fading at both ends so it reads as a cavity in the water rather than
      // a painted rectangle sitting on top of the wave.
      for (let x = tubeL; x < tubeR; x += 2) {
        const f = (x - tubeL) / span;
        const cy = Math.round(lipCurve(x));
        const depth = Math.round(w.A * (0.42 + 0.34 * Math.sin(f * Math.PI)));
        const a = 0.62 * Math.min(1, 2.4 * Math.sin(Math.min(1, f * 1.05) * Math.PI));
        const b1 = Math.round(depth * 0.45), b2 = Math.round(depth * 0.32);
        ctx.fillStyle = `rgba(4,10,34,${a.toFixed(3)})`;
        ctx.fillRect(x, cy, 2, b1);
        ctx.fillStyle = `rgba(6,14,44,${(a * 0.62).toFixed(3)})`;
        ctx.fillRect(x, cy + b1, 2, b2);
        ctx.fillStyle = `rgba(8,18,54,${(a * 0.28).toFixed(3)})`;
        ctx.fillRect(x, cy + b1 + b2, 2, depth - b1 - b2);
      }
      // bright spot down the line — the light at the end of the tube, framed by the cavity
      const exitY = crestY + Math.round(w.A * 0.5);
      const eg = ctx.createRadialGradient(tubeR + 8, exitY, 2, tubeR + 8, exitY, 34);
      eg.addColorStop(0, 'rgba(255,250,210,0.6)');
      eg.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(tubeR - 24, crestY, 60, Math.round(w.A * 0.9));
      // the throwing lip itself — thick pitching curtain at the crest, tapering to the mouth
      for (let x = tubeL; x < tubeR; x += 2) {
        const f = (x - tubeL) / span;
        const cy = lipCurve(x);
        const thick = Math.round(20 - f * 13);
        ctx.fillStyle = p.foam;
        ctx.fillRect(x, Math.round(cy - thick), 2, thick);
      }
      // falling curtain drips off the pitching lip at the tube mouth
      ctx.fillStyle = p.foam;
      for (let i = 0; i < 5; i++) {
        const dx = tubeR - 6 + i * 3;
        const len = 10 + Math.round(Math.sin(this.animT * 10 + i * 2) * 6) + i * 4;
        ctx.fillRect(dx, Math.round(lipCurve(dx)), 2, len);
      }
      // ---- the pocket channel: the wave surging under you ----------------------
      // Drawn the whole way down the line using look-ahead, so the wander is something
      // you can SEE coming and set up for instead of a gotcha. Brightest at the rider.
      const pyT = this.pocketY();
      const bnd = this.band || 15;
      for (let x = Math.max(0, Math.round(foamX - 10)); x < W; x += 4) {
        const c = this.bandCenterAt(this.rt + (x - pkX) / this.BAND_VIS);
        const near = Math.max(0.18, 1 - Math.abs(x - pkX) / 150);
        ctx.fillStyle = `rgba(180,240,255,${(0.10 * near).toFixed(2)})`;
        ctx.fillRect(x, Math.round(c - bnd) + 1, 3, Math.round(bnd * 2) - 1);
        ctx.fillStyle = `rgba(255,255,255,${(0.55 * near).toFixed(2)})`;
        ctx.fillRect(x, Math.round(c - bnd), 3, 1);
        ctx.fillRect(x, Math.round(c + bnd), 3, 1);
      }
      // solid brackets at the rider so "am I in it?" is never ambiguous — neutral while
      // he's off the face, since leaving the band is the point of an air / a tube pull-in
      ctx.fillStyle = (this.trickKind === 'air' || this.trickKind === 'tube') ? 'rgba(248,216,72,0.9)'
        : Math.abs(this.py - pyT) <= bnd ? 'rgba(140,232,160,0.9)' : 'rgba(248,88,56,0.9)';
      ctx.fillRect(pkX - 10, Math.round(pyT - bnd), 24, 1);
      ctx.fillRect(pkX - 10, Math.round(pyT + bnd), 24, 1);
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
        // right-of-way: he's deeper (left of you) and already on his feet — you're on
        // his shoulder, and the pull-back window is your way out of it
        if (this.snake && !this.snake.yielded) {
          const sx = pkX - 42 + dk * 12;
          const sy = this.py + 10 + dk * 6;
          if (!drawRiderImg(ctx, localKey(this.riders[this.snake.idx].type, 'drop', this.riders[this.snake.idx].look), sx, sy, 0.16)) {
            drawMap(ctx, MAPS.paddleA, sx - 16, sy - 6, 2, true);
          }
          if (Math.floor(this.animT * 6) % 2) {
            text(ctx, this.pullT > 0 ? 'HE HAS THE RIGHT OF WAY' : 'YOU\'RE SNAKING HIM...',
              W / 2, 30, 9, this.pullT > 0 ? '#f8f890' : '#f85838', 'center');
          }
        }
        this.drawPullPrompt(ctx, 46);
      } else if (this.trickKind === 'spin') {
        // Both riders are prone through this, but they turn about different axes: the
        // boarder pivots FLAT on the deck (a cartwheel seen from above), the bodysurfer
        // ROLLS about his own long axis — the same move he finishes a ride with.
        const rot = Math.min(1, this.trickT / (this.trickDur || 0.75)) * Math.PI * 2;
        const key = trickArt('spin', riderKey('ride'));
        const rolling = game.rider === 'surfer';
        const drawn = rolling
          ? drawRollImg(ctx, key, pkX, this.py, rot)
          : drawRiderImg(ctx, key, pkX, this.py, rot);
        if (!drawn) {
          ctx.save();
          ctx.translate(pkX, Math.round(this.py));
          if (rolling) ctx.scale(1, Math.cos(rot)); else ctx.rotate(rot);
          drawMap(ctx, spr().ride, -16, -5, 2, true);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';   // spray thrown off as he comes over
        for (let i = 0; i < 6; i++) {
          const a = rot + i * 1.05;
          ctx.fillRect(Math.round(pkX + Math.cos(a) * 16), Math.round(this.py + Math.sin(a) * 8), 2, 2);
        }
      } else if (this.trickKind === 'tube') {
        // pulled up under the curtain: he slides up the face, the lip swallows him for
        // the middle of the move, then he's spat out down the line on a jet of spray
        const u = Math.min(1, this.trickT / (this.trickDur || 1.05));
        const hidden = u > 0.28 && u < 0.72;
        // the curtain thickens over him while he's in there
        ctx.fillStyle = `rgba(248,248,240,${(0.3 + (hidden ? 0.35 : 0.1)).toFixed(2)})`;
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(pkX - 14 + i * 6, SURFACE - w.A + 8 + ((i * 13) % 8), 3, Math.round(w.A * 0.75));
        }
        if (!hidden) {
          const lean = (u < 0.28 ? -0.2 : 0.12);   // climbing in nose-up, coming out level
          const key = trickArt('tube', riderKey('ride'));
          if (!drawRiderImg(ctx, key, pkX + (u > 0.72 ? 8 : -4), this.py, lean)) {
            ctx.save();
            ctx.translate(pkX + (u > 0.72 ? 8 : -4), Math.round(this.py));
            ctx.rotate(lean);
            drawMap(ctx, spr().ride, -16, -5, 2, true);
            ctx.restore();
          }
        }
        if (u > 0.72) {
          // the spit — a blast of mist firing out of the barrel behind him
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const sp = (u - 0.72) / 0.28;
          for (let i = 0; i < 10; i++) {
            ctx.fillRect(Math.round(pkX - 24 - i * 5 + sp * 26),
              Math.round(this.py - 6 + ((i * 11) % 16)), 3, 2);
          }
        }
      } else if (this.trickKind === 'air') {
        // launched off the lip: airborne, rotating, growing as he leaves the face
        const u = Math.min(1, this.trickT / (this.trickDur || 0.95));
        const lift = Math.sin(u * Math.PI);
        const rot = u * Math.PI * 2;
        const key = trickArt('air', riderKey('drop'));   // boarder only — see trickZone
        ctx.fillStyle = 'rgba(8,16,48,0.28)';      // shadow marks where he has to come down
        ctx.fillRect(pkX - 9, Math.round(this.airFrom) + 6, 18, 3);
        if (!drawRiderImg(ctx, key, pkX + lift * 6, this.py, rot, 0, 1 + lift * 0.18)) {
          ctx.save();
          ctx.translate(pkX, Math.round(this.py));
          ctx.rotate(rot);
          drawMap(ctx, spr().ride, -16, -5, 2, true);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.7)';   // launch spray left behind at the lip
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(Math.round(pkX - 10 + (i % 3) * 6), Math.round(this.airFrom + 2 + (i % 2) * 3), 3, 2);
        }
      } else if (this.trickKind === 'stance') {
        // knee drop (boarder) / lay-back (surfer): set low and leaning into the face with
        // the trailing hand carving a spray line off the water
        // once the real pose exists the lean is baked into the art — don't double it up
        const key = trickArt('stance', null);
        const lean = (key ? 0 : (game.rider === 'surfer' ? 0.34 : -0.26))
          + Math.sin(this.animT * 12 / TRICK_SLOW) * 0.03;
        if (!drawRiderImg(ctx, key || riderKey('ride'), pkX, this.py + 2, lean)) {
          ctx.save();
          ctx.translate(pkX, Math.round(this.py + 2));
          ctx.rotate(lean);
          drawMap(ctx, spr().ride, -16, -5, 2, true);
          ctx.restore();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(Math.round(pkX - 6 - i * 5),
            Math.round(this.py + 9 + Math.sin(i * 0.9 + this.animT * 10 / TRICK_SLOW) * 2), 3, 2);
        }
      } else if (!drawRiderImg(ctx, riderKey('ride'), pkX, this.py)) {
        drawMap(ctx, spr().ride, pkX - 10, this.py - 6, 2, true);
      }
      if (deep && this.rt > 0.6) {
        // the curtain washing over him — light enough to still read the rider through it
        ctx.fillStyle = 'rgba(248,248,240,0.3)';
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(pkX - 12 + i * 6, SURFACE - w.A + 10 + ((i * 13) % 8), 3, Math.round(w.A * 0.7));
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
      if (this.trickKind) text(ctx, this.trickName(this.trickKind), W / 2, 40, 13, '#8ce8a0', 'center');
      if (this.chain > 0) text(ctx, `CHAIN ${this.chain} · x${this.chainMult().toFixed(2)}`, 6, 42, 7, '#8ce8a0');
      // the steering/trick hints stay out of the way while the pull-back prompt is up —
      // on a right-of-way wave X means "get off it", not "do a trick"
      const pullingBack = this.dropT > 0 && this.pullT > 0;
      if (this.rt < 3.2 && !pullingBack) {
        text(ctx, input.usedTouch ? 'SLIDE ↑↓ ANYWHERE TO STEER' : '↑↓ STAY BETWEEN THE LINES', W / 2, 214, 8, '#f8f890', 'center');
        // same three zones for both riders, different moves in the top one
        const hint = game.rider === 'surfer'
          ? (input.usedTouch ? 'TAP HIGH=TUBE · MID=ROLL · HOLD LOW=LAY-BACK' : 'X — HIGH=TUBE · MID=ROLL · HOLD LOW=LAY-BACK')
          : (input.usedTouch ? 'TAP HIGH=AIR · MID=SPIN · HOLD LOW=DRAG' : 'X — HIGH=AIR · MID=SPIN · HOLD LOW=DRAG');
        text(ctx, hint, W / 2, 225, 7, '#8ce8a0', 'center');
      } else if (this.buried > 0.3 && Math.floor(this.animT * 4) % 2) {
        text(ctx, this.py > pyT ? 'GO UP ↑' : 'GO DOWN ↓', W / 2, 224, 9, '#f85838', 'center');
      } else if (Math.floor(this.animT * 2) % 2) {
        text(ctx, 'WORK THE BAND — TRICKS SCORE', W / 2, 224, 8, '#8ce8a0', 'center');
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
        // lengthwise barrel roll — the kick-out version of his in-ride 360 (drawRollImg)
        const roll = this.exRoll || 0;
        if (!drawRollImg(ctx, trickArt('spin', 'sp_s_prone'), this.exX, this.exY, roll)) {
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
      if (this.trickDone || this.exT > 0.9) {
        text(ctx, 'CHEE HOO!', W / 2, 40, 9, '#f8f890', 'center');
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
