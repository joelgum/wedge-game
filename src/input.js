// Keyboard + touch input. Touch: the finger is the controller — the game reads
// input.touch (canvas coords) for direct positional control; a quick tap = A button.
import { audio } from './audio.js?v=7';

// on-screen master-mute button (bottom-right corner, canvas coords). Drawn in main.js;
// hit-tested here so a tap on it toggles audio instead of counting as the A button.
export const MUTE_RECT = { x: 234, y: 221, w: 20, h: 18 };
// on-screen PAUSE button, bottom-LEFT so it mirrors the speaker without colliding with the
// score (top-right) or the hearts (top-left). Only drawn during a run — see main.js.
export const PAUSE_RECT = { x: 2, y: 221, w: 20, h: 18 };
export function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
function inMute(p) { return inRect(p, MUTE_RECT); }

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyZ: 'b', KeyX: 'a', Space: 'a', Enter: 'start',
};

export const input = {
  down: {}, hit: {},
  touch: { active: false, x: 0, y: 0, dragging: false, dx: 0, dy: 0 },
  usedTouch: false,
  // Identifies each distinct A press, keyboard or finger. Touch has one button, so commit
  // and pull back are the same gesture; a caller that must not accept the SAME press twice
  // compares this against the value it saw when it consumed the first one.
  aSeq: 0,
  // Tap interceptor, set by main.js. Called with canvas coords for every tap/click before
  // the mute check and the default A press; returning true consumes the tap. This is how the
  // pause button and the pause menu get touch without inventing a gesture that would fight
  // drag-to-steer — and without the loop, which doesn't run while paused.
  onTap: null,
  pressed(k) { return !!this.hit[k]; },
  held(k) { return !!this.down[k]; },
  endFrame() { this.hit = {}; },
  press(k) { if (!this.down[k]) { this.hit[k] = true; if (k === 'a') this.aSeq++; } this.down[k] = true; },
  release(k) { this.down[k] = false; },
  set(k, v) { v ? this.press(k) : this.release(k); },
};

addEventListener('keydown', (e) => {
  // music toggle is handled here, not in the game loop, so it works even
  // when requestAnimationFrame is throttled while music keeps playing
  // M is also the way out of a master mute. The on-screen speaker is a small target in a
  // corner and its state persists across sessions, so without a keyboard escape one stray
  // tap silences the game for good — which is exactly what it did.
  if (e.code === 'KeyM' && !e.repeat) {
    audio.ensure();
    if (audio.mutedAll) audio.toggleMute(); else audio.toggleMusic();
    return;
  }
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

// cancelled === not a tap. iOS fires touchcancel whenever the system takes the gesture
// over (edge swipe, notification shade, call banner, a stray second finger), and routing
// that through the tap branch pressed A with no deliberate input from the player — which
// is what was pulling the rider back off waves nobody touched the screen for.
function touchEnd(e, cancelled) {
  e.preventDefault();
  if (e.touches.length === 0) {
    input.touch.active = false;
    input.touch.dragging = false;
    input.touch.dx = 0; input.touch.dy = 0;
    // quick tap without dragging = A button — unless it landed on the mute button
    if (!cancelled && tapStart && !tapStart.moved && performance.now() - tapStart.time < 500) {
      const tp = canvasPos({ clientX: tapStart.x, clientY: tapStart.y });
      if (input.onTap && input.onTap(tp)) {
        // consumed by the pause button or the pause menu
      } else if (inMute(tp)) {
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
addEventListener('touchend', (e) => touchEnd(e, false), { passive: false });
addEventListener('touchcancel', (e) => touchEnd(e, true), { passive: false });

// desktop: the mute button is clickable too (keyboard still has M for music-only)
addEventListener('mousedown', (e) => {
  const p = canvasPos({ clientX: e.clientX, clientY: e.clientY });
  if (input.onTap && input.onTap(p)) { e.preventDefault(); return; }
  if (inMute(p)) { e.preventDefault(); audio.ensure(); audio.toggleMute(); }
});
