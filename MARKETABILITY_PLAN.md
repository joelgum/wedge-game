# WEDGE! — Marketability Upgrade Plan (implementation spec)

> Written 2026-07-07 for a fresh agent (Opus 4.8) to implement. Companion to PLAN.md, which
> describes the game as built. Read PLAN.md §3–4 first for the loop and architecture.
> Stack constraint: vanilla JS + Canvas, no dependencies, no build step. Internal res 256×240.
> All gameplay lives in `src/scenes.js` (~1070 lines, one file: title → select → surf → wipeout → gameover).
> Dev server: `python3 serve.py 8020` from this directory.

## Why (context from marketability review)

The game is a solid one-mechanic arcade loop but has zero distribution (not deployed), no
retention hook (localStorage-only scores), a punishing learning curve that outpaces the
teaching, a shallow skill ceiling, and no shareable moment. The phases below fix those in
priority order. Do them in order; each phase is independently shippable and committable.

**Locked decisions (do not re-open):**
- The long dramatic drop and relative-slide mobile controls are user-validated. Don't change them.
- Brutal-but-fair stays: waves don't get easier, the game just teaches better.
- No accounts, no backend beyond what Phase 2 specifies. No frameworks.

---

## Phase 1 — Teach the tell (first-session survival)

Goal: a stranger's first 3 lives last long enough to learn *why* they got pitched.

1. **Callout on the first makeable wave of a session** (surf scene, `updateWatch`): the first
   time a makeable wave crosses q() > 0.5 in wave 1–2, pause the peak drift for ~1.5s and show
   a `say()` message pointing at the feathering: `WATCH THE SPRAY` / `FEATHERS AT THE PEAK = RIDEABLE`.
   Equivalent message the first time a closeout appears: `FEATHERS EVERYWHERE = WALL. LET IT GO`.
   Track shown-flags on `game` (reset in the game-state reset that runs on new session).
2. **First wipeout of a session is free**: in the wipeout scene (`game.lives--` around
   scenes.js:947), if `game.wave <= 3` and a `game.freeFallUsed` flag is unset, don't decrement;
   show `FREE ONE — WATCH THE PEAK` instead of the life lost line. Only once per session.
3. **Post-wipeout "why" overlay**: on PITCHED / CLOSED OUT, the wipeout screen already shows a
   reason + detail. Add one line rendering where the sweet spot was vs. where the player was
   (two markers on a mini wave strip, ~40px tall, drawn from `commitD` and `tol` passed via
   `game.goto('wipeout', {...})`). Text: `YOU WERE 23px OFF THE SLOT` (round to px).

Acceptance: fresh localStorage playthrough — first closeout and first makeable each trigger
their callout exactly once; first early wipeout costs no life; wipeout screen shows the marker strip.

## Phase 2 — Streak scoring + shareable Daily Wave (retention core)

### 2a. Streak multiplier
- Add `game.streak` (consecutive IN THE SLOT or CLEAN DROP commits that end in MADE IT).
  Multiplier `mult = min(4, 1 + streak * 0.5)` applied to drop bonuses (scenes.js:328/332/336)
  and the tube/exit bonus (scenes.js:553). LATE DROP or any wipeout resets streak to 0;
  GOOD CALL and WAVE WASTED leave it untouched.
- HUD: render `x1.5` etc. next to the score when streak > 0 (top-right, existing `text()` helper).
- Floaters already exist (`this.floaters`) — reuse for `+800 x2` style popups.

### 2b. Daily Wave mode
- **Seeded RNG**: add `src/rng.js` — mulberry32 (or equivalent tiny PRNG). Thread a `rand()`
  function through `newWave()` instead of `Math.random()` (surf scene takes it from `game.rand`,
  which defaults to `Math.random` for the normal arcade mode).
- **Mode**: title screen gains a second menu entry: `ARCADE` / `DAILY WAVE` (arrow keys/tap to
  pick, X to confirm — mirror the select-screen input pattern). Daily = seed from the UTC date
  (`YYYYMMDD` hashed), exactly **10 waves**, 3 lives, stage ramps every 3 waves regardless of
  makes. Session ends after wave 10 or last life.
- **Result screen** (replaces the arcade game-over for daily mode): score + a per-wave emoji
  grid — 🟩 in-the-slot · 🟦 clean · 🟨 late · 🟥 wipeout · ⬜ wasted · 🧠 good call — plus
  `WEDGE! DAILY #N` header (N = days since a fixed epoch, e.g. 2026-07-01).
  A `COPY RESULT` button/keypress uses `navigator.clipboard.writeText()` (fallback: draw the
  text and tell the player to screenshot). Format:
  ```
  WEDGE! DAILY #6  4,850
  🟩🟩🟨🟥🧠🟩⬜🟩🟦🟩
  ```
- **One attempt per day**: store `wedge-daily` = `{ date, grid, score }` in localStorage; if
  today's exists, the menu entry shows the result screen instead of replaying.
- Keep daily scores out of the arcade high-score table.

Acceptance: two runs with the same seed produce identical wave sequences (verify with a quick
bot or by logging `wv` params); daily is replay-locked; copied text matches the grid; streak
multiplier shows in HUD and resets on late/wipeout.

## Phase 3 — Rider identity + tube tricks (skill ceiling)

### 3a. Differentiate the riders
Rider choice (`game.rider`, set in select scene) currently only swaps sprites. Give each a stat line,
shown on the select screen panels (the `RIDERS[i].lines` array already renders text there):
- **Bodyboarder** — `WIDER POCKET / STEADY POINTS`: pocket band tolerance +25%, tube scoring
  (scenes.js:544 `60 * dt`) at 1.0×.
- **Bodysurfer** — `TIGHT POCKET / BIG POINTS`: band −15%, tube scoring 1.4×, exit bonus 1.25×.
Numbers are starting points — tune so a competent player scores within ~10% either way.

### 3b. Spin trick in the tube
- During ride mode (not during the drop), pressing X starts a ~0.6s spin: rider sprite swaps to
  the spin frame (`spr_s_spin.png` exists for the bodysurfer; bodyboarder can reuse drop frame
  rotated or a procedural flip via existing sprite draw), pocket-hold input is ignored for the
  duration (that's the risk), and completing it adds `+250 × streak-mult` with a floater.
  Getting buried mid-spin = normal BURIED wipeout. Max one spin per second.

Acceptance: select screen shows stat lines; measured band width differs per rider; spin scores
and can cause a wipeout if timed greedily.

## Phase 4 — Monster make (the clip moment)

- Once per session (arcade mode only), at stage ≥ 2, flag one monster wave (`wv.monster`,
  scenes.js:248) as `rideable: true`. Tell: it feathers at the peak AND rumbles early
  (reuse the `rumbled` audio cue at q() > 0.55 instead of 0.75) — observant players learn the
  early rumble means "this bomb is on".
- Committing in the slot on it: `BOMB! +2000`, ride runs with `pAmp × 1.5` and a taller face
  (already tall via `wv.A`), exit bonus doubled. Committing outside the slot = pitched as today.
  Letting it pass still pays GOOD CALL (the safe play stays valid).
- Add a distinct SFX sting on the bomb make (audio.js has the synth helpers).

Acceptance: exactly one rideable monster per arcade session; slot-commit rides it; off-slot
commit pitches; skip pays +150.

## Phase 5 — Ship it

1. **Deploy**: standalone Vercel repo (the traced-app pattern — see memory: needed an `.npmrc`
   fix there, but this game has no build step so it's pure static). Copy the game dir into a new
   repo, `vercel deploy`. Confirm with Joel before creating the public repo.
2. **itch.io page**: package the same static files as an HTML5 game zip (itch wants index.html
   at root). Draft page copy: "the NES bodysurfing game that never existed — read the wave,
   survive The Wedge." Note: itch upload itself is a Joel action (account); prepare the zip +
   copy and hand off.
3. **README/OG**: screenshot-forward README; add OG meta tags to index.html (title art as og:image)
   so shared links unfurl.

Acceptance: live URL loads and plays on iPhone Safari; daily-wave copy/paste works from the
live site; zip under itch's 1GB limit (trivially).

---

## Working notes for the implementing agent

- `src/wave.js` is dead code (PLAN.md §4) — delete it in your first commit.
- Cache-busting: module imports carry `?v=N` query strings (see scenes.js:6). Bump the version
  on files you touch, or imports go stale on iOS.
- Fixed-timestep loop lives in main.js; don't add per-frame allocations in update paths.
- Commit per phase with the existing message style: `[wedge-game] <summary>`.
- Playtest via the preview tools / serve.py after each phase; the difficulty curve was
  originally bot-verified (PLAN.md milestone 2) — if you change tolerances, re-verify that
  dawn-stage waves are makeable by a simple bot before moving on.
- Update PLAN.md milestone table when phases land.
