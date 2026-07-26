# WEDGE! — Trick Sprite Prompt Kit (Google AI Studio / Gemini)

> Written 2026-07-26 for the Phase 5 trick system. The tricks **already play** using the
> existing frames transformed in code; these prompts produce the dedicated poses that
> replace those stand-ins.

## How these get into the game

1. Generate in **Google AI Studio** (Gemini image generation), one prompt per pose.
2. Cut the figure out onto **transparency** (the existing rider PNGs are transparent —
   AI Studio output usually needs a background knock-out; a flat magenta/white background
   keys cleanly).
3. Save into `assets/` with the **exact filename** listed on each prompt.
4. In `src/scenes.js`, uncomment that sprite's `loadImg(...)` line in the `TRICK_ART`
   block near the top. That's the whole integration — `drawRide` picks the frame up the
   moment it loads, and falls back to the transformed stand-in if it's missing.
5. Bump `?v=` on the `IMG` loader (`loadImg` in scenes.js) so phones don't serve a cached
   miss, and hard-reload.

## House style — must match the existing sprites

The riders already in the game (`spr_b_ride.png`, `spr_s_prone.png`, …) are **27–38 px
tall, 15–42 px wide**, transparent, NES-palette, and **all face RIGHT** (the direction of
travel — the wave peels left→right and the rider trims right, away from the jetty).

Every prompt below already carries this style block. Keep it intact:

```
8-bit pixel art game sprite, NES video game style 1987, limited 16-color palette, chunky
pixels, flat shading, no anti-aliasing, no gradients, no outline glow, single figure,
side view facing RIGHT, centered on a plain solid magenta background for easy cutout
--ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard, multiple
figures, grid, reference sheet, text, watermark
```

**Character continuity:** the boarder is a 1980s bodyboarder — dark hair, green tank top,
blue trunks, **yellow bodyboard**, short swim fins. The bodysurfer is bare-handed, no
board, no handplane, teal/green trunks, short swim fins. Paste one of the existing PNGs
into the AI Studio prompt as a **reference image** and ask it to keep the same character,
palette, and pixel scale — that's what keeps the set consistent.

---

## BODYBOARDER

### 1 — `spr_b_spin.png` · flat 360 spin on the face
> Used mid-band. The game rotates this frame a full turn, so the pose must read from any
> angle: body compact, board flat, nothing sticking out that looks wrong upside down.

```
8-bit pixel art game sprite of a 1980s bodyboarder doing a flat 360 spin on the face of a
wave, prone and compact on a yellow bodyboard, board flat and level, both elbows tucked in
tight gripping the nose and the rail, knees bent with short swim fins pulled in close to
the body, body kept symmetrical and compact so the pose reads at any rotation, dark hair,
green tank top, blue trunks, small spray flicking off the rail, NES video game style 1987,
limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients,
single figure, viewed from slightly above and to the side facing RIGHT, centered on a plain
solid magenta background for easy cutout --ar 1:1 --no photorealism, blur, smooth shading,
standing surfer, surfboard, multiple figures, grid, reference sheet, text, watermark
```

### 2 — `spr_b_air.png` · airborne off the lip
> Used at the top of the band. Launches off the lip, rotates once, lands back in the
> pocket. Wants to read clearly against sky.

```
8-bit pixel art game sprite of a 1980s bodyboarder launched into the air off the lip of a
wave, fully airborne with clear sky all around him, yellow bodyboard pressed to his chest
and angled nose-up, one hand grabbing the outside rail of the board, knees drawn up and
short swim fins tucked behind him, back slightly arched, dark hair, green tank top, blue
trunks, a few loose spray droplets trailing below the board, NES video game style 1987,
limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients,
single figure, side view facing RIGHT, centered on a plain solid magenta background for easy
cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard, wave,
water, multiple figures, grid, reference sheet, text, watermark
```

### 3 — `spr_b_knee.png` · knee drop with hand drag
> Used at the bottom of the band, held. The game draws a spray trail behind the trailing
> hand, so the hand must be **low and back**, dragging the water.

```
8-bit pixel art game sprite of a 1980s bodyboarder in a drop-knee stance on a yellow
bodyboard, one knee planted on the deck of the board and the other foot forward with a
short swim fin planted flat, torso upright and twisted slightly toward the viewer, trailing
arm reaching down and BACK behind him with his fingertips dragging in the water surface,
leading arm forward for balance, dark hair, green tank top, blue trunks, small spray kicking
up off the dragging hand, NES video game style 1987, limited 16-color palette, chunky
pixels, flat shading, no anti-aliasing, no gradients, single figure, side view facing RIGHT,
centered on a plain solid magenta background for easy cutout --ar 1:1 --no photorealism,
blur, smooth shading, standing surfer, surfboard, multiple figures, grid, reference sheet,
text, watermark
```

---

## BODYSURFER

### 4 — `spr_s_layback.png` · lay-back, arm spread on the face
> Used at the bottom of the band, held. The move you described: leaning back into the
> wave, lead arm spread wide, body laid out along the face.

```
8-bit pixel art game sprite of a 1980s bodysurfer laying back into the face of a wave, no
surfboard and no bodyboard and no handplane, bare hands, body stretched out and reclined
with his back and shoulder laid against the wave face, lead arm flung out wide and straight
to the side with the palm skimming flat on the water, trailing arm back along his hip, chest
open to the sky, short swim fins trailing behind and slightly spread, dark hair, teal
trunks, spray peeling off his shoulder and his outstretched hand, NES video game style 1987,
limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients,
single figure, side view facing RIGHT, centered on a plain solid magenta background for easy
cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard,
bodyboard, handplane, multiple figures, grid, reference sheet, text, watermark
```

### 5 — `spr_s_prone.png` (optional re-roll) · lead hand out front, planing
> The second half of the move you described — hand back out in FRONT, body planing down
> the line. The game already has this frame (`spr_s_prone.png`) and uses it for both the
> paddle and the ride. Only re-roll it if you want the lead hand more pronounced.

```
8-bit pixel art game sprite of a 1980s bodysurfer planing prone and flat down the line of a
wave, no surfboard and no bodyboard and no handplane, bare hands, body rigid and streamlined
just above the water, lead arm punched straight out in FRONT of him with the flat of the
hand planing on the water surface and throwing a small spray plume, trailing arm pinned back
along his side for trim, chest and ribs skimming the surface, short swim fins spread and
trailing, head up and looking down the line, dark hair, teal trunks, NES video game style
1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients,
single figure, side view facing RIGHT, centered on a plain solid magenta background for easy
cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard,
bodyboard, handplane, multiple figures, grid, reference sheet, text, watermark
```

### 6 — bodysurfer air / EL ROLLO — **no prompt needed**
The existing arms-out `spr_s_spin.png` already covers both the mid-band body rotation and
the top-of-band el rollo (the game rotates it). Generate a dedicated one only if you want
them visually distinct.

---

## Judging a generation before you cut it out

- **Direction:** facing RIGHT. Gemini flips riders constantly — reject rather than mirror
  (mirroring puts the part in his wrong hand and reverses the board's rocker).
- **No board on the bodysurfer.** Most common failure by far.
- **Pixel scale matches:** stand it next to `spr_b_ride.png` at 1:1. If its pixels are
  finer, downscale to ~32 px tall with **nearest-neighbour** before cutting out.
- **Palette:** flat blocks, no soft shading. AI "pixel art" is usually faux-pixel with
  thousands of colours — palette-snap to 16 in Aseprite/Piskel if it's soft.
- **Spin frame only:** cover it with your thumb and rotate the image 180° — if it still
  reads as a rider it will survive the in-game rotation.
