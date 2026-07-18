// Boot + fixed-timestep game loop at NES-native 256x240, integer-scaled.
// ?v= querystrings bust stale module caches on phones; bump together in all files
import { input } from './input.js?v=3';
import { audio } from './audio.js?v=3';
import { makeScenes } from './scenes.js?v=19';

const W = 256, H = 240;

const canvas = document.getElementById('game');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
