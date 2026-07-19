// Keyboard + touch input. Touch: the finger is the controller — the game reads
// input.touch (canvas coords) for direct positional control; a quick tap = A button.
import { audio } from './audio.js?v=4';

// on-screen master-mute button (bottom-right corner, canvas coords). Drawn in main.js;
// hit-tested here so a tap on it toggles audio instead of counting as the A button.
export const MUTE_RECT = { x: 234, y: 221, w: 20, h: 18 };
function inMute(p) {
  const r = MUTE_RECT;
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyZ: 'b', KeyX: 'a', Space: 'a', Enter: 'start',
};

export const input = {
  down: {}, hit: {},
  touch: { active: false, x: 0, y: 0, dragging: false, dx: 0, dy: 0 },
  usedTouch: false,
  pressed(k) { return !!this.hit[k]; },
  held(k) { return !!this.down[k]; },
  endFrame() { this.hit = {}; },
  press(k) { if (!this.down[k]) this.hit[k] = true; this.down[k] = true; },
  release(k) { this.down[k] = false; },
  set(k, v) { v ? this.press(k) : this.release(k); },
};

addEventListener('keydown', (e) => {
  // music toggle is handled here, not in the game loop, so it works even
  // when requestAnimationFrame is throttled while music keeps playing
  if (e.code === 'KeyM' && !e.repeat) { audio.ensure(); audio.toggleMusic(); return; }
  const k = KEYMAP[e.code];
  if (k) { e.preventDefault(); if (!e.repeat) input.press(k); audio.ensure(); }
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input.release(k);
});

let canvasEl = null;
function canvasPos(t) {
  if (!canvasEl) canvasEl = document.getElementById('game');
  const r = canvasEl.getBoundingClientRect();
  return {
    x: ((t.clientX - r.left) / r.width) * 256,
    y: ((t.clientY - r.top) / r.height) * 240,
  };
}

let tapStart = null;
addEventListener('touchstart', (e) => {
  e.preventDefault();
  audio.ensure();
  input.usedTouch = true;
  const t = e.touches[0];
  const p = canvasPos(t);
  input.touch.active = true; input.touch.x = p.x; input.touch.y = p.y;
  input.touch.dragging = false;   // position control waits for a deliberate drag,
                                  // so a tap never moves the player
  input.touch.dx = 0; input.touch.dy = 0;
  tapStart = { x: t.clientX, y: t.clientY, time: performance.now(), moved: false };
}, { passive: false });

addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  const p = canvasPos(t);
  input.touch.dx += p.x - input.touch.x;   // relative deltas for slide steering
  input.touch.dy += p.y - input.touch.y;
  input.touch.x = p.x; input.touch.y = p.y;
  if (tapStart && !tapStart.moved && Math.hypot(t.clientX - tapStart.x, t.clientY - tapStart.y) > 18) {
    tapStart.moved = true;
    input.touch.dragging = true;
    input.touch.dx = 0;   // the tap-guard distance doesn't count as movement
  }
}, { passive: false });

function touchEnd(e) {
  e.preventDefault();
  if (e.touches.length === 0) {
    input.touch.active = false;
    input.touch.dragging = false;
    input.touch.dx = 0; input.touch.dy = 0;
    // quick tap without dragging = A button — unless it landed on the mute button
    if (tapStart && !tapStart.moved && performance.now() - tapStart.time < 500) {
      if (inMute(canvasPos({ clientX: tapStart.x, clientY: tapStart.y }))) {
        audio.ensure(); audio.toggleMute();
      } else {
        input.press('a');
        setTimeout(() => input.release('a'), 150);
      }
    }
    tapStart = null;
  } else {
    const p = canvasPos(e.touches[0]);
    input.touch.x = p.x; input.touch.y = p.y;
  }
}
addEventListener('touchend', touchEnd, { passive: false });
addEventListener('touchcancel', touchEnd, { passive: false });

// desktop: the mute button is clickable too (keyboard still has M for music-only)
addEventListener('mousedown', (e) => {
  if (inMute(canvasPos({ clientX: e.clientX, clientY: e.clientY }))) {
    e.preventDefault(); audio.ensure(); audio.toggleMute();
  }
});
