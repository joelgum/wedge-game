# WEDGE! — 8-Bit Bodyboarding & Bodysurfing Arcade Game: Game Plan

> Working plan, v2 — 2026-07-04 (reconciled with the built game)
> Stack: Vanilla JS + Canvas · Vibe: NES surf classic · Loop: watch → commit → ride/exit · pick rider · 3 lives, arcade style

---

## 1. Concept

An 80s NES-style side-scrolling arcade game. You're a **bodyboarder or a bodysurfer** (your pick on the select screen — The Wedge blackballs surfboards, so those are the two ways in) at The Wedge in Newport Beach on a maxing south swell. Each wave has a single shifting ideal takeoff spot — readable through visual tells — and committing anywhere else (or to a closeout) leads to getting pitched, pounded, and Wedged. Some sets aren't makeable at all; reading which is half the skill. Time your commit, survive the heavy drop, hold the tube, rack up points.

**Design pillars**
1. **Read the wave** — mastery is wave knowledge, not memorization. Tells shift every wave.
2. **Brutal but fair** — wipeouts are spectacular and always your fault. 3 lives, classic arcade.
3. **NES authenticity** — chunky pixels, limited palette, goofy charm. Town & Country / California Games energy.

## 2. Title Candidates

| Title | Notes |
|---|---|
| **WEDGE!** | Punchy, exclamation mark is very 80s box art. Front-runner. |
| **SPONGER** | Authentic bodyboard slang; reads as an NES-era one-word title. |
| **THE WEDGE** | Iconic, simple, locals know instantly. |
| **PITCHED!** | Names the failure state — Punch-Out energy. |
| **BOUNCE HOUSE** | Wedge nickname among bodyboarders; insider deep cut. |

(Pick one before the title screen gets built; "WEDGE!" is the recommendation.)

## 3. Core Gameplay Loop

Pick your rider first (bodyboarder or bodysurfer), then each "run" = one wave, played in a **single continuous view** — no phase/camera cuts. A session = 3 lives across as many waves as you survive. The rider always rides to the **right, away from the rock jetty** (distant scenery on the left).

### Watch — read the set (build-up)
- You're already sitting in the lineup; the camera holds one view. Waves build from the horizon and roll through **left → right** behind the other riders, so you feel the set approaching.
- The whole skill is a **single shifting ideal takeoff spot**: the peak wanders across the face, and from Afternoon on, the wedge backwash **flips its direction once** mid-build. Slide ←→ (or drag) to stay under the marker.
- **The tell is crest feathering:** a makeable wave feathers (spits spray) only near the peak; a closeout feathers all the way across — don't go on those.
- A **SET meter** fills as the wave stands up; it arrives whether you're ready or not.

### Commit — the timing skill
- Press X / tap when you're under the spot. Commit is an **instant timing call**: it seals your grade where you stand and the wave breaks immediately (the marker shows only briefly — it's about *when* you commit, not tracking a moving target). Commit only counts once the wave is at least a quarter built.
- **Outcomes by how close you were to the sweet spot:** IN THE SLOT (max bonus) · CLEAN DROP · LATE DROP (ride starts with a short chaotic window) · PITCHED (wipeout, life lost, over-the-falls tumble).
- **Not committing:** a makeable wave you let pass = WAVE WASTED (no life lost); a closeout you correctly skip = GOOD CALL (small bonus). Committing to a closeout = CLOSED OUT (wipeout).

### Ride — the drop + the tube
- A long, heavy **drop** down the face — deliberate hang-time so it reads as a big, heavy wave — then **hold the line**: keep the rider in the pocket band with ↑↓ (or vertical drag) as the wave tries to bury you.
- The foam curtain chases from behind on the **left**; sometimes it swallows the rider and he comes back out through the tube. A late drop adds a ~1.2s decaying chaos window. Fall out of the pocket too long = BURIED (wipeout).
- Hold the pocket to the end and you get blasted out ahead of the spit — **the wall shuts down behind you: MADE IT** (kick-out bonus), then the next wave rolls in.

### Scoring
- Drop-quality bonus (in-the-slot > clean > late) + good-call/made-wave kick-out bonus, accumulated across waves.
- **High score table:** localStorage, 3-initial entry on game over, classic arcade attract screen.

### Controls
- **Keyboard:** ←→ move · X commit / go · ↑↓ tube · P pause · M music.
- **Touch:** drag to move (relative slide, finger-as-controller) · tap to go.

### Day progression (difficulty ramp)
Each survived wave advances the clock; palette + difficulty shift together:
| Stage | Time | Palette | Difficulty |
|---|---|---|---|
| 1 | Dawn patrol | Pink/lavender glass | Smaller sets, long build-up, generous sweet spot, slow curtain |
| 2 | Mid-morning | Bright blue/gold | Bigger faces, faster wandering peak, more closeouts |
| 3 | Afternoon | Deep blue, wind texture | Backwash flips the peak once mid-build, tighter pocket |
| 4 | Sunset ("maxing") | Orange/magenta | Biggest/fastest, tiny commit window, curtain at max, tube closes fast |

## 4. Technical Architecture (Vanilla JS + Canvas)

```
10-Projects/wedge-game/
├── PLAN.md              ← this file
├── README.md
├── index.html           # single page, one <canvas>, versioned module import
├── serve.py             # no-cache static server (defeats iOS module caching); python3 serve.py 8020
└── src/
    ├── main.js          # boot, fixed-timestep loop (60fps accumulator), game state, pause
    ├── scenes.js        # scene state machine (title → select → surf → wipeout → gameover);
    │                    #   surf = the whole game with modes watch → ride → exit
    ├── input.js         # keyboard (arrows + Z/X, P/M) + touch (relative-slide, tap = go)
    ├── sprites.js       # procedural pixel sprites (string-array maps) + drawMap; placeholder art
    ├── audio.js         # WebAudio synth: 8-bit SFX + chiptune, mute persisted to localStorage
    ├── score.js         # localStorage high-score table (loadScores / saveScore / qualifies)
    └── wave.js          # DEAD CODE — early generateWave(); superseded by scenes.js newWave(). Remove.
```

**Key technical decisions**
- **Internal resolution 256×240** (NES native), rendered to an offscreen canvas, integer-scaled up with `image-rendering: pixelated` / `imageSmoothingEnabled = false`. This single decision does 80% of the "looks 8-bit" work.
- **Palette discipline:** pick ~16 colors from the NES palette (see §5) and hold every asset to it.
- Fixed-timestep update + render interpolation so wipeout physics feel identical on any refresh rate.
- No dependencies, no build step. Deployable as static files (Vercel or the Astro site's `public/`, same as prior games).

## 5. Art Assets & Midjourney Prompts

### Honest caveat on Midjourney for game sprites
Midjourney is excellent for **key art, title screens, backgrounds, and mood/palette reference**, but weak at **spritesheets** — it can't produce consistent multi-frame animations of the same character, and its "pixel art" is faux-pixel (irregular grid, thousands of colors). Recommended pipeline:

1. **Midjourney** → title screen, background layers, character *design reference*.
2. **Downscale + palette-snap** the MJ output (e.g. in [Aseprite](https://www.aseprite.org/), ~$20, the industry pixel-art tool; free alternatives: [Piskel](https://www.piskelapp.com/), [Libresprite](https://libresprite.github.io/)) to true 8-bit grid + 16-color palette.
3. **Hand-pixel the animation frames** in Aseprite/Piskel using the MJ design as reference (player is ~16×24 px — small enough that frames are quick).

### Master style suffix (append to every prompt for consistency)
```
, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, side-scrolling game, flat shading, no anti-aliasing, no gradients --ar 16:9 --style raw --no photorealism, blur, smooth shading, surfboard, standing surfer, board underfoot
```
**How to use these prompts:**
- **Scene/key-art prompts** (title, backgrounds, wave, select screen, wipeout) end with `[master style suffix]` — replace that placeholder with the block above (which already carries `--ar 16:9`). Don't paste the `[ ]`.
- **Sprite-reference sheets** (character/hazard/HUD) are written out **fully expanded and paste-ready** below — a single `--ar 1:1` already at the end, tuned `--no` per sheet. Copy the whole line as-is; don't append the master suffix or a second `--ar`.
- One `--ar` per prompt, always at the very end. Use `--sref` with your first accepted image on later prompts to lock the style, and `--tile` for repeatable water/sand textures.

### Prompt list

**Title screen / key art**
```
retro NES title screen for a bodyboarding and bodysurfing arcade video game called "WEDGE!", giant teal wedge-shaped wave peeling from LEFT to RIGHT, the pitching curl and breaking whitewater on the LEFT chasing rightward, a clean open unbroken face ahead on the RIGHT, small pixel bodysurfer riding and dropping toward the RIGHT down the open face away from the jetty — body-planing prone and low with just his body on the water, absolutely NO surfboard and NO board of any kind, wearing swim fins on his feet, chest and torso planing on the wave surface, left arm extended forward with his left hand resting and dragging against the wave face, positioned far over on the RIGHT side of the frame deep on the open shoulder, a wide expanse of open unbroken wave face and clear water separating him from the jetty, the jetty small and distant on the far left, no chance of being washed into the rocks, long low stacked-boulder rock jetty running far out into the water along the left side (long like a pier but low-profile, not tall) at Newport Beach, orange sunset sky in background, big blocky 80s arcade logo text at top, [master style suffix]
```

**Background layer — sky/horizon (4 palette variants for day progression)**
```
side-scrolling video game background, ocean horizon at dawn, pink and lavender sky, flat pixel clouds, long low Newport Beach rock jetty running far out into the water along the left side (like a pier but low, not tall), empty foreground for gameplay, [master style suffix]
```
(Re-run swapping "dawn, pink and lavender" → "mid-morning, bright blue and gold" → "afternoon, deep blue, wind-textured water" → "sunset, orange and magenta".)

**Background layer — beach/berm**
```
side-scrolling video game foreground layer, steep golden-sand beach berm of Newport Beach dropping off sharply to a heavy shorebreak, a long dense line of pixel onlookers standing shoulder-to-shoulder along the top of the berm watching the waves, two red lifeguard pickup trucks parked on the sand, a small lifeguard tower, a few scattered beach towels, footprints tracked across the sand, the rip-rap rock jetty meeting the beach on the far left, [master style suffix]
```

**The wave (design reference for the in-game wave renderer)**
```
massive wedge-shaped teal ocean wave viewed from the side, two waves colliding into one peaking A-frame that peels from LEFT to RIGHT, thick pitching lip and barrel on the LEFT with the tube opening toward the RIGHT and a clean open unbroken face on the right, the break chasing rightward away from the jetty, white foam ball at base, backwash line racing off the long low rock jetty on the left across the face, pixel art water texture, [master style suffix]
```

**Character-select screen / key art (two iconic riders)**
> The game opens on a select screen: pick **Bodyboarder** or **Bodysurfer** (The Wedge is famous for both — surfboards are blackballed there). Each needs one big, iconic hero pose.
```
retro NES character-select screen, two large iconic pixel-art surf athletes side by side on a split panel, LEFT: 1980s bodyboarder kneeling with a yellow bodyboard under one arm and short swim fins, confident pose, RIGHT: 1980s bodysurfer standing with swim fins, bare hands and no board, one arm raised, big blocky arcade "SELECT YOUR RIDER" text at top, teal ocean and orange sunset behind them, [master style suffix]
```

**Bodyboarder character sheet (reference only — final frames hand-pixeled)**
> Four gameplay states the renderer needs, in order: (1) waiting in the lineup, (2) paddling into the wave before commit, (3) the drop, (4) riding after the drop.
```
pixel art character reference sheet on white background, 1980s bodyboarder with short swim fins and a yellow bodyboard, four poses in a grid: straddling the board like sitting on a horse with one leg hanging off each side waiting in the lineup, lying prone paddling and kicking to catch a wave, dropping down a steep wave face nose-down, prone and trimming to the right across the open wave face riding away from the break, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, standing surfer
```

**Bodysurfer character sheet (reference only — final frames hand-pixeled)**
> Same four states, no board and no handplane — bare hands, the classic Wedge bodysurf: the lead arm and hand plane on the wave face.
```
pixel art character reference sheet on white background, 1980s bodysurfer in swim trunks with short swim fins, bare hands, absolutely no surfboard, no bodyboard, and no handplane, ALL action poses facing and riding to the RIGHT for one consistent riding direction (never facing or angled left), four poses in a grid: (1) treading water upright waiting in the lineup, (2) swimming and kicking hard to the right to catch a wave, lead arm reaching forward to the right, (3) the drop — high near the lip on a steep near-vertical wave face, body stretched out prone and angled down the face toward the lower right, leading with the forward arm and hand planing on the face, swim fins trailing behind, spray flying, (4) the ride — planing prone and flat to the right across the open wave face, arms outstretched with the lead hand skimming the water ahead and the other arm out behind for trim, swim fins spread and trailing, spray off the body, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, surfboard, board, handplane, standing surfer
```
**Fallback — single-pose bodysurfer prompts** (if the grid keeps flipping direction, generate each pose on its own; all face RIGHT, plain white background so they isolate cleanly, and `--no grid/sheet/multiple` keeps it to one figure). Same trick works for the bodyboarder — swap the subject and re-add the yellow bodyboard.
```
# 1 — lineup
pixel art game sprite, a single 1980s bodysurfer treading water upright waiting in the lineup, bare hands, short swim fins, no surfboard no bodyboard no handplane, side view facing right, centered on a plain white background, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, surfboard, board, handplane, standing surfer, multiple figures, grid, reference sheet
```
```
# 2 — paddle
pixel art game sprite, a single 1980s bodysurfer prone, swimming and kicking hard to the RIGHT to catch a wave, lead arm reaching forward to the right, swim fins kicking up spray, bare hands, no surfboard no bodyboard no handplane, side view moving right, centered on a plain white background, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, surfboard, board, handplane, standing surfer, multiple figures, grid, reference sheet
```
```
# 3 — drop
pixel art game sprite, a single 1980s bodysurfer dropping in high near the lip on a steep near-vertical wave face, body stretched out prone and angled down the face toward the lower RIGHT, leading with the forward arm and hand planing on the face, swim fins trailing, spray flying, bare hands, no surfboard no bodyboard no handplane, side view riding right, on a plain white background, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, surfboard, board, handplane, standing surfer, multiple figures, grid, reference sheet
```
```
# 4 — ride
pixel art game sprite, a single 1980s bodysurfer planing prone and flat to the RIGHT across an open wave face, arms outstretched with the lead hand skimming the water ahead and the other arm out behind for trim, swim fins spread and trailing, spray off the body, bare hands, no surfboard no bodyboard no handplane, side view riding right, on a plain white background, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, surfboard, board, handplane, standing surfer, multiple figures, grid, reference sheet
```

**Wipeout key art (game-over screen)**
```
comedic retro video game "game over" screen, tiny pixel wave rider being launched over the falls of a giant wave, arms and legs flailing, a bodyboard tumbling separately (bodyboarder) or empty-handed (bodysurfer), onlookers on the beach wincing, text space at bottom, [master style suffix]
```

**Hazard sprites reference**
```
pixel art sprite reference sheet on white background: swimmer head bobbing in water, a second bodyboarder lying prone paddling on a bodyboard, red lifeguard rescue buoy, seagull flying, whitewater foam wall, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading, standing surfer
```

**HUD/UI reference**
```
retro NES game HUD elements: pixel heart life icons x3, score counter in blocky arcade font, small wave-height meter, sun/clock day-progression icon, on plain dark background, 8-bit pixel art, NES video game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients --ar 1:1 --style raw --no photorealism, blur, smooth shading
```

## 6. Audio Plan

**SFX — generate, don't source (recommended primary path)**
- [jsfxr](https://sfxr.me/) / [ChipTone](https://sfbgames.itch.io/chiptone) — free browser tools that generate authentic 8-bit SFX in seconds. Perfect for: the "commit" blip, drop whoosh, tube rumble, score tick, wipeout crash, made-wave jingle, menu blips. This *is* how retro SFX sound; sourcing recorded audio would actually be less authentic.

**Music — chiptune**
- [BeepBox](https://www.beepbox.co/) (free, browser) — compose an original NES-style loop; exports WAV. One 30–60s surf-rock-flavored chiptune loop for gameplay + a short title jingle + a 3-second "pitched!" sting is the whole score.
- Ready-made alternatives (check license per track): [OpenGameArt.org](https://opengameart.org/) chiptune section (CC0/CC-BY), [FreePD.com](https://freepd.com/) (public domain), [Pixabay Music](https://pixabay.com/music/) (free license, chiptune tag).

**Archive.org — yes, but for flavor, not core audio**
- Great for: public-domain **surf-rock 78s/45s** for the attract screen if you want a "Wipe Out"-adjacent feel (verify each item's rights statement — much 60s surf rock is *not* PD), and ambient ocean recordings (search "ocean waves field recording" filtered to CC0/PD).
- Weak for: game SFX and chiptune — quality/licensing is a lottery there; the tools above are faster and cleaner.
- **Attribution rule:** keep a `assets/audio/CREDITS.md` logging source + license for every file.

**Implementation:** WebAudio API, single `AudioContext` unlocked on first input (iOS requirement), SFX as decoded buffers in a small pool, music as a looped buffer source.

## 7. Build Milestones & Success Criteria

| # | Milestone | Status |
|---|---|---|
| 1 | **Skeleton** | ✅ 256×240 integer-scaled, 60fps fixed-timestep loop, scene FSM (title → select → surf → wipeout → gameover) |
| 2 | **Watch + commit mechanic** | ✅ Per-wave shifting sweet spot + feathering tell + backwash flip; instant-commit timing produces in-the-slot / clean / late / pitched deterministically (bot-verified difficulty curve) |
| 3 | **Ride + wipeout** | ✅ Heavy cubic-hang drop, hold-the-pocket tube, buried/closeout wipeouts, made-wave exit cinematic; full 3-life session playable |
| 4 | **Rider select** | ✅ Bodyboarder / bodysurfer, wired through every player draw (placeholder sprites) |
| 5 | **Mobile controls** | ✅ Relative-slide steering (finger-as-controller) + tap-to-go; no-cache dev server for iOS |
| 6 | **Art pass** | ⬜ Run §5 Midjourney prompts, hand-pixel to the 16-color grid, replace placeholder sprites; day-progression palettes already swap in code |
| 7 | **Audio pass** | 🟡 8-bit SFX + chiptune synth working in code; could refine/mix |
| 8 | **Polish + ship** | 🟡 High scores, pause, mute persist and touch is usable; **remaining:** deploy to a live URL (Astro route or standalone Vercel) |

**Definition of done:** a stranger on a phone can pick it up, get pitched a few times, understand *why*, and want one more run. (Core loop is there; art + deploy are what's left.)

## 8. Open Questions (for later, not blockers)

- Final title pick (§2) — "WEDGE!" is in use as the working title.
- Whether the game ships on the Astro site (like sample-game) or a standalone Vercel repo (like traced-app). Decide at the deploy step.
