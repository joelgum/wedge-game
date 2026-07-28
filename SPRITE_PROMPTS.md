# WEDGE! — Trick Sprite Prompt Kit (Google AI Studio / Gemini)

> Written 2026-07-26 for the Phase 5 trick system. **All six trick frames are generated
> and live** as of 2026-07-27 (plus a re-rolled `spr_s_prone`). Keep this file as the
> recipe for re-rolls and for the two frames still on the old bodysurfer — see
> *Still to do* at the bottom.

## How these get into the game

1. Generate in **Google AI Studio** (Gemini image generation), one prompt per pose.
   Gemini returns a 1024×1024 JPG: real pixel art, but drawn as an 80×80 logical image
   blown up to 12.8 px blocks on a solid magenta field. Keep the JPG — it goes in
   `art-src/`, not `assets/`.
2. Convert it with **`execution/pixelate_sprite.py`**, which finds the block grid,
   samples one true pixel per block, keys the magenta to transparency, and snaps the
   JPEG noise back down to ~10 colours:

   ```sh
   python3 execution/pixelate_sprite.py --report art-src/spr_b_air.jpg
   python3 execution/pixelate_sprite.py --scale 0.65 art-src/spr_b_air.jpg assets/spr_b_air.png
   ```

   `--scale 0.65` is the house factor: Gemini draws the figure about 1.5× bigger than the
   existing riders, and 0.65 lands the trick frames at 34–46 px wide, next to
   `spr_b_ride.png` at 36. Check `--report` first — if the grid confidence isn't ~1.00 the
   render isn't clean faux-pixel art and is worth re-rolling rather than salvaging.
3. In `src/scenes.js`, that sprite's `loadImg(...)` line above `TRICK_ART` is already
   there — comment it back out to fall the move back to its transformed stand-in.
4. Bump `?v=` on the `IMG` loader (`loadImg` in scenes.js) so phones don't serve a cached
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

### 5 — `spr_s_roll.png` · PRONE 360 ROLL down the line
> His mid-band move, and the same move he finishes a ride with. **Not a cartwheel** — he
> turns about his own long axis, like a barrel roll, arms up near his head for momentum.
> The game fakes the roll by squashing this frame vertically through `cos(roll)`, so it is
> drawn full-height, then edge-on, then **upside down**: the pose has to read belly-up as
> well as belly-down. Never the arms-out ragdoll pose, which the game reserves for getting
> pitched.

```
8-bit pixel art game sprite of a 1980s bodysurfer mid barrel roll on the face of a wave,
rolling about the long axis of his own body, no surfboard and no bodyboard and no
handplane, bare hands, body prone and rigid and streamlined flat along the water, both
arms raised up alongside his head and slightly bent to drive the roll, torso and hips
turning over as one line, short swim fins together and trailing close to the body, body
kept symmetrical top to bottom so the pose still reads when it is flipped upside down,
dark hair, teal trunks, a small ring of spray flicking off his shoulder and hip as he
comes over, NES video game style 1987, limited 16-color palette, chunky pixels, flat
shading, no anti-aliasing, no gradients, single figure, viewed from the side facing RIGHT,
centered on a plain solid magenta background for easy cutout --ar 1:1 --no photorealism,
blur, smooth shading, standing surfer, surfboard, bodyboard, handplane, arms spread wide,
cartwheel, airborne, multiple figures, grid, reference sheet, text, watermark
```

### 6 — `spr_s_tube.png` · coming out of the barrel
> His top-of-band move, where the boarder has an air: he pulls up under the curtain,
> disappears behind it, and gets spat out down the line. The game hides him for the middle
> of the move and draws this frame on the way in (nose-up) and on the way out (level, with
> a jet of mist behind him), so it wants to read as **driving forward hard**, not floating.

```
8-bit pixel art game sprite of a 1980s bodysurfer being spat out of a barrelling wave, no
surfboard and no bodyboard and no handplane, bare hands, body prone and stretched out low
and flat and streamlined, lead arm punched straight out in FRONT of him with the flat of
the hand planing hard on the water, trailing arm locked tight along his hip, chin up and
head driving forward down the line, chest just clear of the surface, short swim fins
together and kicked straight out behind him, dark hair, teal trunks, a burst of spray and
mist trailing off his fins from behind, NES video game style 1987, limited 16-color
palette, chunky pixels, flat shading, no anti-aliasing, no gradients, single figure, side
view facing RIGHT, centered on a plain solid magenta background for easy cutout --ar 1:1
--no photorealism, blur, smooth shading, standing surfer, surfboard, bodyboard, handplane,
arms spread wide, airborne, multiple figures, grid, reference sheet, text, watermark
```

### 7 — `spr_s_prone.png` · lead hand out front, planing — **re-rolled and installed**
> The second half of the move you described — hand back out in FRONT, body planing down
> the line. Used for both the paddle and the ride. The re-roll shipped 2026-07-27: it
> wasn't optional in the end, because the original frame is a *different character*
> (pale, blue-and-green striped trunks) from the six trick poses, so the bodysurfer
> visibly changed skin and trunks the instant a trick started. The original is kept at
> `art-src/spr_s_prone_v1.png`.

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

### 8 — bodysurfer air — **there isn't one**
The bodysurfer has no air trick; he stays on the water, so his top-of-band tap pulls him
into the barrel instead (`spr_s_tube.png`). `spr_s_spin.png` (arms-out "U") is **not** a
trick frame — it's the ragdoll toss when a wave pitches you, and nothing else should use it.

### The locals need no new art
Right-of-way waves and the interstitial NPC beat draw the other riders from the frames
already in `assets/` (`spr_b_*` / `spr_s_*`), picked by that local's own type. Nothing to
generate for them.

---

---

## Still to do — the last two old bodysurfer frames

`spr_s_tread.png` (bobbing in the lineup) and `spr_s_drop.png` (dropping in) are still the
**original** bodysurfer: pale skin, blue/green striped trunks, no dark outline. Every other
frame he appears in is now the dark-haired, teal-trunked character, so he still changes
between the lineup and the ride. Two more generations fix it — reuse the style block above
with *"dark hair, teal trunks"*, one treading water upright with just his head and
shoulders clear, one stroking into the drop head-down on a steep face.

The boarder needs nothing: his old frames already match the new set.

## Judging a generation before you cut it out

- **Direction:** facing RIGHT. Gemini flips riders constantly — reject rather than mirror
  (mirroring puts the part in his wrong hand and reverses the board's rocker).
- **No board on the bodysurfer.** Most common failure by far.
- **Pixel scale matches:** stand it next to `spr_b_ride.png` at 1:1. If its pixels are
  finer, downscale to ~32 px tall with **nearest-neighbour** before cutting out.
- **Palette:** flat blocks, no soft shading. AI "pixel art" is usually faux-pixel with
  thousands of colours — palette-snap to 16 in Aseprite/Piskel if it's soft.
- **Boarder's spin frame:** cover it with your thumb and rotate the image 180° — if it
  still reads as a rider it will survive the in-game rotation.
- **Bodysurfer's roll frame:** flip it *vertically* (mirror top-to-bottom), not rotate.
  That's exactly what the game does to it mid-roll, and it has to still read belly-up.
