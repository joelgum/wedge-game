// Procedural pixel sprites. Placeholder art until the Midjourney/Aseprite pass (PLAN.md §5);
// gameplay never depends on these beyond their footprint.

export const COLORS = {
  Y: '#f8c020', // board deck
  D: '#d88810', // board rail
  B: '#282830', // wetsuit
  S: '#f0a870', // skin
  F: '#181820', // fins
  W: '#f8f8f8', // white water / leash
  R: '#e04838', // red (buoy, hearts)
};

export const MAPS = {
  paddleA: [
    '......SS........',
    '.....BSS........',
    '..BBBBBB.B......',
    'YYYYYYYYYYYYY.F.',
    '.YDDDDDDDDDDYFF.',
    '..YYYYYYYYYY..F.',
  ],
  paddleB: [
    '......SS........',
    '.B...BSS........',
    '..BBBBBB........',
    'YYYYYYYYYYYYY.F.',
    '.YDDDDDDDDDDYFF.',
    '..YYYYYYYYYY.F..',
  ],
  duck: [
    '....BBBSS.......',
    'YYYYYYYYYYYY.FF.',
    '.YDDDDDDDDDY.F..',
  ],
  trim: [
    '......SS........',
    '....BBSS........',
    '..BBBBBB.B......',
    'YYYYYYYYYYYYYF..',
    '.YDDDDDDDDDDYFF.',
  ],
  // --- bodysurfer poses (no board, bare hands; S = extended lead arm/hand, F = swim fins) ---
  surfPaddleA: [
    'S.....SS.......',
    'SS...BSSB......',
    '.SBBBBBBBB.....',
    '...BBBBB...F.F.',
    '..S.....S..FFF.',
    '.W.......W..F..',
  ],
  surfPaddleB: [
    'S.....SS.......',
    'SS...BSSB......',
    '.SBBBBBBBB..F..',
    '...BBBBB.FF....',
    '..S.....S.F....',
    '.WW.....WW.....',
  ],
  surfTrim: [
    'S......SS......',
    'SS....BSS......',
    '.SBBBBBBBBB....',
    '..SBBBBBBB.F...',
    '..........S.FF.',
    '............F..',
  ],
  surfT: [        // bodysurfer T-pose (arms out) for the finishing barrel roll — spins
    '.......SS......',
    '.......SS......',
    'SSSSSSSSSSSSSSS',
    '.......BB......',
    '.......BB......',
    '......F..F.....',
  ],
  tumble: [
    '..S.BB..',
    '.BBWYB..',
    'B.YYWBS.',
    '.SBWBY..',
    '..B..S..',
  ],
  swimmer: [
    '..SS..',
    '.SSSS.',
    'W.SS.W',
  ],
  buoy: [
    '..RR..',
    '.RRRR.',
    'RRWWRR',
    '.RRRR.',
  ],
  gull: [
    'W....W',
    '.W..W.',
    '..WW..',
  ],
  // --- rider select icons (also serve as lineup 'watch' poses in the surf scene) ---
  sitBoard: [   // bodyboarder sitting upright on the board, waiting in the lineup
    '..SS..',
    '..SS..',
    '.BBBB.',
    '.BBBB.',
    'YYYYYY',
    '.DDDD.',
    '.F..F.',
  ],
  tread: [      // bodysurfer treading water, arms out, no board
    '..SS..',
    '..SS..',
    'SBBBBS',
    '.BBBB.',
    '.F..F.',
    'W.WW.W',
  ],
};

// flipX mirrors the sprite horizontally within its own box (same footprint, so
// draw offsets are unchanged) — used to point the rider its travel direction.
export function drawMap(ctx, map, x, y, scale = 1, flipX = false) {
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r < map.length; r++) {
    const w = map[r].length;
    for (let c = 0; c < w; c++) {
      const ch = map[r][c];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = COLORS[ch] || '#fff';
      const cc = flipX ? (w - 1 - c) : c;
      ctx.fillRect(x + cc * scale, y + r * scale, scale, scale);
    }
  }
}

const HEART = [
  '.RR.RR.',
  'RRRRRRR',
  'RRRRRRR',
  '.RRRRR.',
  '..RRR..',
  '...R...',
];

export function drawHeart(ctx, x, y, full) {
  for (let r = 0; r < HEART.length; r++) {
    for (let c = 0; c < HEART[r].length; c++) {
      if (HEART[r][c] === '.') continue;
      ctx.fillStyle = full ? COLORS.R : '#383840';
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}
