// Boot + fixed-timestep game loop at NES-native 256x240, integer-scaled.
// ?v= querystrings bust stale module caches on phones; bump together in all files
import { input, MUTE_RECT, PAUSE_RECT, inRect } from './input.js?v=8';
import { audio } from './audio.js?v=7';
import { makeScenes } from './scenes.js?v=57';

const W = 256, H = 240;

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  // fill the viewport: fractional scale (still nearest-neighbour via image-rendering:pixelated),
  // so narrow phones no longer lock to a tiny 1× integer view
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = W * s + 'px';
  canvas.style.height = H * s + 'px';
}
addEventListener('resize', fit);
fit();

const game = {
  lives: 3, score: 0, stage: 0, wave: 0, made: 0,
  rider: 'boarder',   // 'boarder' | 'surfer' — chosen on the select screen, survives reset()
  // Phase 1 first-session teaching flags: fire once per session, cleared on new session.
  taughtMakeable: false, taughtCloseout: false, freeFallUsed: false,
  // Phase 2 streak (consecutive slot/clean rides made) drives the score multiplier.
  streak: 0,
  // Phase 4: one rideable BOMB monster per arcade session (the clip moment).
  bombUsed: false,
  // Has a too-big wave shown up yet this run? Drives the pity rule in surf.newWave() —
  // the 10% roll alone leaves ~55% of 10-wave daily runs never seeing one (measured).
  monsterSeen: false,
  // Phase 2 Daily Wave: mode flag, wave RNG (seeded for daily), and the per-wave grid.
  // These are set by the title menu and survive reset() — reset() only clears the run.
  daily: false, rand: Math.random, dailyGrid: [],
  reset() {
    this.lives = 3; this.score = 0; this.stage = 0; this.wave = 0; this.made = 0;
    this.taughtMakeable = false; this.taughtCloseout = false; this.freeFallUsed = false;
    this.streak = 0; this.bombUsed = false; this.monsterSeen = false;
  },
  goto(name, arg) { this.sceneName = name; scene = scenes[name]; scene.enter(game, arg || {}); },
};

// pause is event-driven (not in the frame loop) so it always responds
let paused = false;
function setPaused(v) {
  paused = v;
  if (paused) audio.pauseAll(); else audio.resumeAll();
}
// Quit is only offered mid-run — there's nothing to abandon on the title or the briefing.
function inRun() { return game.sceneName === 'surf' || game.sceneName === 'wipeout'; }
// Ending a run early still resolves it properly: an arcade score can still make the table,
// and a daily run records what you actually did. Quitting a daily SPENDS the attempt, which
// is the point — otherwise a bad daily could be quit-scummed away.
function quitRun() {
  setPaused(false);
  if (game.daily) game.goto('dailyresult', {});
  else game.goto('gameover');
}
// pause-menu buttons, laid out here because the overlay is drawn here too
// 84x34 canvas px ≈ 123x50pt on a 375pt phone. The 20px gutter between them matters more
// than the size does: QUIT ends the run, so it must not sit under the edge of a thumb
// aiming at RESUME.
const RESUME_RECT = { x: 34, y: 132, w: 84, h: 34 };
const QUIT_RECT = { x: 138, y: 132, w: 84, h: 34 };
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && !e.repeat) setPaused(!paused);
  else if (e.code === 'KeyQ' && !e.repeat && paused && inRun()) quitRun();
});
// Touch/click routing for pause. Registered on input so it runs on the event, not in the
// frame loop — which is stopped while paused.
input.onTap = (p) => {
  if (paused) {
    if (inRect(p, RESUME_RECT)) { setPaused(false); return true; }
    if (inRect(p, QUIT_RECT) && inRun()) { quitRun(); return true; }
    return true;            // swallow stray taps so they can't reach the game underneath
  }
  if (inRun() && inRect(p, PAUSE_RECT)) { setPaused(true); return true; }
  return false;
};

const scenes = makeScenes(game);
// debug/test handle (harmless in prod; no gameplay reads it)
window.__wedge = { game, scenes, scene: () => scene, paused: () => paused };
let scene;
game.goto('title');

// on-screen master-mute toggle (works on touch + mouse; keyboard M still toggles music).
// Hit region lives in input.js (MUTE_RECT); this only draws it, on top of every scene.
// the pause button — two bars, same visual weight as the speaker so the pair reads as a set
function drawPause(ctx) {
  if (!inRun() || paused) return;
  const r = PAUSE_RECT;
  // plate is inset from the hit box — the target is bigger than it looks, by design
  ctx.fillStyle = 'rgba(8,8,32,0.5)';
  ctx.fillRect(r.x + 4, r.y + 6, 22, 20);
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(r.x + 10, r.y + 11, 4, 10);
  ctx.fillRect(r.x + 16, r.y + 11, 4, 10);
}

function drawMute(ctx) {
  const r = MUTE_RECT;
  ctx.fillStyle = 'rgba(8,8,32,0.5)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const bx = r.x + 3, by = r.y + 4; // speaker body origin
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(bx, by + 3, 3, 4);                 // neck
  ctx.fillRect(bx + 3, by, 4, 10);                // cone block
  ctx.beginPath();
  ctx.moveTo(bx + 7, by); ctx.lineTo(bx + 11, by - 3);
  ctx.lineTo(bx + 11, by + 13); ctx.lineTo(bx + 7, by + 10);
  ctx.closePath(); ctx.fill();
  if (audio.mutedAll) {
    ctx.strokeStyle = '#f85838'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx + 8, by - 1); ctx.lineTo(bx + 15, by + 11); ctx.stroke();
    // a red slash on a 16px icon is easy to miss, and the state outlives the session — so
    // say it in words, and say how to undo it. This is the only label drawn over every scene.
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = "bold 7px 'Courier New', monospace";
    ctx.fillStyle = '#f85838';
    ctx.fillText('MUTED', r.x - 2, r.y + 1);
    ctx.fillStyle = '#a8a8b8';
    ctx.fillText('M = SOUND ON', r.x + r.w - 1, r.y - 8);
  } else {
    ctx.fillStyle = '#f8f8f8';                     // sound waves
    ctx.fillRect(bx + 13, by + 1, 1, 8);
    ctx.fillRect(bx + 15, by - 1, 1, 12);
  }
}

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  if (paused) {
    last = now; acc = 0;          // no time debt builds up while paused
    scene.draw(ctx);
    ctx.fillStyle = 'rgba(8,8,32,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = "bold 22px 'Courier New', monospace";
    ctx.fillStyle = '#f8f8f8';
    ctx.fillText('PAUSED', W / 2, 96);
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.fillText(input.usedTouch ? 'TAP A BUTTON' : 'P RESUMES', W / 2, 126);
    // two real targets, so touch gets resume AND quit without a hidden gesture
    const btn = (r, label, on, colour) => {
      ctx.fillStyle = on ? colour : 'rgba(40,40,60,0.9)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = on ? '#f8f8f8' : '#585868';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillStyle = on ? '#fff' : '#787888';
      ctx.fillText(label, r.x + r.w / 2, r.y + 12);
    };
    btn(RESUME_RECT, 'RESUME', true, 'rgba(40,120,60,0.95)');
    btn(QUIT_RECT, 'QUIT', inRun(), 'rgba(150,50,40,0.95)');
    if (inRun()) {
      ctx.font = "bold 7px 'Courier New', monospace";
      ctx.fillStyle = '#c8c8d8';
      ctx.fillText(game.daily ? 'QUIT ENDS YOUR DAILY ATTEMPT'
        : (input.usedTouch ? 'QUIT ENDS THE RUN' : 'QUIT ENDS THE RUN · Q'), W / 2, 174);
    }
    drawMute(ctx);
    requestAnimationFrame(frame);
    return;
  }
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    scene.update(STEP);
    input.endFrame();
    acc -= STEP;
  }
  scene.draw(ctx);
  drawPause(ctx);
  drawMute(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
