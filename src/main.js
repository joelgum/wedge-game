// Boot + fixed-timestep game loop at NES-native 256x240, integer-scaled.
// ?v= querystrings bust stale module caches on phones; bump together in all files
import { input, MUTE_RECT } from './input.js?v=4';
import { audio } from './audio.js?v=4';
import { makeScenes } from './scenes.js?v=22';

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
  // Phase 2 Daily Wave: mode flag, wave RNG (seeded for daily), and the per-wave grid.
  // These are set by the title menu and survive reset() — reset() only clears the run.
  daily: false, rand: Math.random, dailyGrid: [],
  reset() {
    this.lives = 3; this.score = 0; this.stage = 0; this.wave = 0; this.made = 0;
    this.taughtMakeable = false; this.taughtCloseout = false; this.freeFallUsed = false;
    this.streak = 0; this.bombUsed = false;
  },
  goto(name, arg) { this.sceneName = name; scene = scenes[name]; scene.enter(game, arg || {}); },
};

// pause is event-driven (not in the frame loop) so it always responds
let paused = false;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && !e.repeat) {
    paused = !paused;
    if (paused) audio.pauseAll();
    else audio.resumeAll();
  }
});

const scenes = makeScenes(game);
// debug/test handle (harmless in prod; no gameplay reads it)
window.__wedge = { game, scenes, scene: () => scene, paused: () => paused };
let scene;
game.goto('title');

// on-screen master-mute toggle (works on touch + mouse; keyboard M still toggles music).
// Hit region lives in input.js (MUTE_RECT); this only draws it, on top of every scene.
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
    ctx.fillText('PRESS P TO RESUME', W / 2, 126);
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
  drawMute(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
