# WEDGE! — Trick Sprite Prompt Kit (Google AI Studio / Gemini)

> Written 2026-07-26 for the Phase 5 trick system. **All six trick frames are generated
> and live** as of 2026-07-27 (plus a re-rolled `spr_s_prone`), so prompts 1–8 are here
> as the recipe for re-rolls.
>
> **Everything still outstanding is in [§ NPC batch](#npc-batch--the-lineup-stops-being-clones) — eight prompts, and they are the whole list:**
>
> | | Prompt | Why it's outstanding |
> |---|---|---|
> | ~~B1–B3~~ | ~~`spr_b_sit_n1..n3`~~ | ✅ generated and installed 2026-07-29 |
> | ~~S1–S3~~ | ~~`spr_s_tread_n1..n3`~~ | ✅ generated and installed 2026-07-29 |
> | ~~9~~ | ~~`spr_s_tread`~~ | ✅ generated and installed 2026-07-27 |
> | ~~10~~ | ~~`spr_s_drop`~~ | ✅ generated and installed 2026-07-27 |
>
> **The game is no longer missing any art.** One re-roll is pending, not a missing file:
> **prompt 9 v2** — the player's own `spr_s_tread` is horizontal while the three NPC
> bodysurfers are upright, so a bodysurfer lineup has the locals standing and you floating.
> One render fixes it.
>
> Nothing else in the game is missing art: every other `loadImg` resolves to a file in
> `assets/`, and every file in `assets/` is used.

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

### The locals used to need no new art — see the NPC batch below
Right-of-way waves and the interstitial NPC beat draw the other riders from the same frames
the *player* uses, picked by that local's own type. That's why the lineup is three clones of
whoever you picked. The batch below fixes it.

---

# NPC batch — the lineup stops being clones

Written 2026-07-27. **Eight prompts**: six NPC identities (three boarders, three
bodysurfers) plus the two replacement frames the player's own bodysurfer still needs.

## Why only the lineup pose is generated

Every rider needs four poses — `sit`, `paddle`, `drop`, `ride`. Generating four poses × six
identities is 24 renders, and Gemini's character drift between poses is exactly what went
wrong with the bodysurfer last time: you'd be judging continuity 24 times.

So each identity gets **one generated frame — the lineup pose** — and the loader recolours
that identity's palette onto the shared frames for the other three. The lineup is where the
variety actually reads: it's the pose the game spends most of its time in, with all three
locals side by side. The consequence to know about: **build and gender are a lineup-only
tell.** Once a local drops in, he or she is the standard silhouette wearing that identity's
colours. At 30 px in a one-second beat that holds up; if a variant ever needs to read as
itself mid-ride, generate its `ride` frame too and drop it in under the same name.

## Pin the palette before you generate

The recolour needs to know which colour means what, so each identity's colours are fixed
here and the prompt just describes them. **If Gemini gives you a different shade, keep the
render and tell me the actual hexes** — the swap table is edited to match the art, never the
other way round.

| # | File | Who | Hair | Skin | Top | Trunks | Board / fins |
|---|---|---|---|---|---|---|---|
| B1 | `spr_b_sit_n1.png` | small wiry grom, ~14 | bleached blond mop | pale, sunburnt | bare chest | black | **red** board, blue fins |
| B2 | `spr_b_sit_n2.png` | heavyset veteran, ~55 | grey buzz cut + moustache | deep tan | black wetsuit vest | black | **faded orange** board, yellow fins |
| B3 | `spr_b_sit_n3.png` | woman, athletic | dark ponytail | brown | teal one-piece | — | **purple** board, pink fins |
| S1 | `spr_s_tread_n1.png` | tall lanky guy | red, shaggy | freckled pale | bare chest | orange | bright blue fins |
| S2 | `spr_s_tread_n2.png` | woman, strong shoulders | black hair in a bun | brown | magenta one-piece | — | lime fins |
| S3 | `spr_s_tread_n3.png` | heavyset older guy | bald / shaved | deep tan | black wetsuit top | grey | orange fins *(shipped render has yellow)* |

Boarders sit **on** the board in the lineup; bodysurfers tread water with just head and
shoulders clear. Everything faces **RIGHT**, same as the rest of the set.

---

## B1 — `spr_b_sit_n1.png` · the grom

```
8-bit pixel art game sprite of a small skinny teenage bodyboarder sitting on his board in
the lineup waiting for a wave, sitting upright astride a red bodyboard floating flat on the
water, both hands resting on the rails, short swim fins dangling below the surface, small
wiry build with narrow shoulders, bleached blond surfer mop of hair, pale sunburnt skin,
bare chest, black boardshorts, blue swim fins, calm water line across his waist, NES video
game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing,
no gradients, single figure, side view facing RIGHT, centered on a plain solid magenta
background for easy cutout --ar 1:1 --no photorealism, blur, smooth shading, standing
surfer, surfboard, multiple figures, grid, reference sheet, text, watermark
```

## B2 — `spr_b_sit_n2.png` · the veteran

```
8-bit pixel art game sprite of a heavyset older man sitting on his bodyboard in the lineup
waiting for a wave, sitting upright astride a faded orange bodyboard floating flat on the
water, both hands resting on the rails, short swim fins dangling below the surface, thick
barrel-chested build with broad round shoulders and a belly, short grey buzz cut and a grey
moustache, deeply tanned leathery skin, sleeveless black wetsuit vest, black boardshorts,
yellow swim fins, calm water line across his waist, NES video game style 1987, limited
16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients, single
figure, side view facing RIGHT, centered on a plain solid magenta background for easy
cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard,
multiple figures, grid, reference sheet, text, watermark
```

## B3 — `spr_b_sit_n3.png` · her wave

```
8-bit pixel art game sprite of an athletic young woman sitting on her bodyboard in the
lineup waiting for a wave, sitting upright astride a purple bodyboard floating flat on the
water, both hands resting on the rails, short swim fins dangling below the surface, lean
athletic build with strong shoulders, long dark hair pulled back in a high ponytail, brown
skin, teal one-piece swimsuit, pink swim fins, calm water line across her waist, NES video
game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing,
no gradients, single figure, side view facing RIGHT, centered on a plain solid magenta
background for easy cutout --ar 1:1 --no photorealism, blur, smooth shading, standing
surfer, surfboard, bikini, multiple figures, grid, reference sheet, text, watermark
```

## S1 — `spr_s_tread_n1.png` · the lanky one

```
8-bit pixel art game sprite of a tall lanky young bodysurfer treading water upright in the
lineup waiting for a wave, no surfboard and no bodyboard and no handplane, bare hands,
submerged to mid-chest with only his head and shoulders clear of the surface, long thin
arms sculling at the waterline, thin narrow build, shaggy red hair, pale freckled skin,
bare chest, orange trunks, bright blue swim fins just visible under the water, calm water
line across his chest, NES video game style 1987, limited 16-color palette, chunky pixels,
flat shading, no anti-aliasing, no gradients, single figure, side view facing RIGHT,
centered on a plain solid magenta background for easy cutout --ar 1:1 --no photorealism,
blur, smooth shading, standing surfer, surfboard, bodyboard, handplane, multiple figures,
grid, reference sheet, text, watermark
```

## S2 — `spr_s_tread_n2.png` · shoulders

```
8-bit pixel art game sprite of a strong young woman treading water upright in the lineup
waiting for a wave, no surfboard and no bodyboard and no handplane, bare hands, submerged
to mid-chest with only her head and shoulders clear of the surface, arms sculling at the
waterline, broad swimmer's shoulders, black hair pulled up in a tight bun, brown skin,
magenta one-piece swimsuit, lime green swim fins just visible under the water, calm water
line across her chest, NES video game style 1987, limited 16-color palette, chunky pixels,
flat shading, no anti-aliasing, no gradients, single figure, side view facing RIGHT,
centered on a plain solid magenta background for easy cutout --ar 1:1 --no photorealism,
blur, smooth shading, standing surfer, surfboard, bodyboard, handplane, bikini, multiple
figures, grid, reference sheet, text, watermark
```

## S3 — `spr_s_tread_n3.png` · the old boy

> ⚠️ **The original wording was refused by AI Studio as "prohibited content"** (2026-07-27).
> No phrase was named, but the language unique to this prompt was a stack of body and skin
> descriptors on a realistic person — `heavyset older`, `heavy round build with a broad
> neck`, `bald shaved head`, `deeply tanned leathery skin`. Use **v2** below. The original
> is kept underneath for the record, since the refusal is partly stochastic and B2 carries
> some of the same words without tripping.
>
> **This is the one identity that can ship with no art at all:** the recolour already gives
> him grey trunks and grey fins, so a persistent refusal only costs the build tell. Don't
> burn a dozen attempts here.

### v2 — use this one

```
8-bit pixel art game sprite of a stocky veteran bodysurfer waiting in the lineup for a
wave, no surfboard and no bodyboard and no handplane, bare hands, floating chest-deep in
calm water with his head and broad shoulders above the surface, arms sculling along the
waterline, barrel-chested and thick through the middle, bald, weather-beaten tan,
sleeveless black wetsuit top, grey trunks, orange swim fins showing beneath the water, calm
water line across his chest, NES video game style 1987, limited 16-color palette, chunky
pixels, flat shading, no anti-aliasing, no gradients, single figure, side view facing
RIGHT, centered on a plain solid magenta background for easy cutout --ar 1:1 --no
photorealism, blur, smooth shading, standing surfer, surfboard, bodyboard, handplane,
multiple figures, grid, reference sheet, text, watermark
```

### v3 — if v2 is refused too

Drops every body and skin descriptor and carries his age and bulk on **gear and posture
alone**. Least likely to be refused, weakest silhouette tell.

```
8-bit pixel art game sprite of a bodysurfer waiting in the lineup for a wave, no surfboard
and no bodyboard and no handplane, bare hands, floating chest-deep in calm water with his
head and shoulders above the surface, arms sculling along the waterline, wide heavy
shoulders hunched forward, bald, sleeveless black wetsuit top, grey trunks, orange swim
fins showing beneath the water, calm water line across his chest, NES video game style
1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no
gradients, single figure, side view facing RIGHT, centered on a plain solid magenta
background for easy cutout --ar 1:1 --no photorealism, blur, smooth shading, standing
surfer, surfboard, bodyboard, handplane, young, slim, multiple figures, grid, reference
sheet, text, watermark
```

<details><summary>v1 — the refused original, for the record</summary>

```
8-bit pixel art game sprite of a heavyset older bodysurfer treading water upright in the
lineup waiting for a wave, no surfboard and no bodyboard and no handplane, bare hands,
submerged to mid-chest with only his head and thick shoulders clear of the surface, arms
sculling at the waterline, heavy round build with a broad neck, bald shaved head, deeply
tanned leathery skin, sleeveless black wetsuit top, grey trunks, orange swim fins just
visible under the water, calm water line across his chest, NES video game style 1987,
limited 16-color palette, chunky pixels, flat shading, no anti-aliasing, no gradients,
single figure, side view facing RIGHT, centered on a plain solid magenta background for
easy cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard,
bodyboard, handplane, multiple figures, grid, reference sheet, text, watermark
```

</details>

### If B2 (the boarder veteran) gets refused as well

It shares `heavyset older man` and `deeply tanned leathery skin` with v1. Swap those for
`stocky veteran man` and `weather-beaten tan` — same edit, same reasoning.

---

## The player's own bodysurfer — ✅ done 2026-07-27

Both generated and installed; he is now the same character in every frame. Originals kept
at `art-src/spr_s_tread_v1.png` / `spr_s_drop_v1.png`. Prompts kept for re-rolls.

**Both needed `--crop`**, which is why the option exists:

```sh
python3 execution/pixelate_sprite.py --crop 175,315,765,955 --scale 0.65 art-src/spr_s_tread.jpg assets/spr_s_tread.png
python3 execution/pixelate_sprite.py --crop 105,265,890,910 --scale 0.65 art-src/spr_s_drop.jpg  assets/spr_s_drop.png
```

Gemini drew the tread frame's waterline **edge to edge across the whole 1024 frame**, so
the untrimmed sprite came out 72 px wide — a bright horizontal line that would have been
painted across the sea. The drop frame's spray plume ran off the bottom-left corner and
padded the bbox the same way. Watch for both: if `--report` gives a width far larger than
the figure, something scenic is touching the frame edge.

### 9 — `spr_s_tread.png` · treading in the lineup

> **v1 came back horizontal** — floating prone, whole body seen through the water — despite
> asking for upright. It was kept at the time because it read well on its own, but once the
> three NPC bodysurfers landed *upright*, the lineup ended up with the locals standing and
> the player floating. **Use v2.**
>
> The fix isn't repeating the word "upright" — S1–S3 used near-identical wording and came
> back standing, so the original was partly unlucky. The lever the old prompt never pulled
> is **the legs**: describing them hanging vertically leaves no room for a prone body.
> Belt and braces, `lying flat`, `prone`, `horizontal` and `swimming` go in the negatives.
>
> **Paste `assets/spr_s_tread_n1.png` in as a reference image** and ask for the same pose
> and framing — that's the cheapest way to match a set that already exists.

#### v2 — use this one

```
8-bit pixel art game sprite of a 1980s bodysurfer treading water in the lineup waiting for
a wave, body VERTICAL and upright in the water like a person standing, legs hanging
straight down below him with knees slightly bent, short dark swim fins pointing down at the
end of his legs, submerged to mid-chest with his head and shoulders clear of the surface,
both arms out sculling along the waterline, chin up watching the horizon, average athletic
build, dark hair, brown skin, teal trunks, calm flat water line across his chest, NES video
game style 1987, limited 16-color palette, chunky pixels, flat shading, no anti-aliasing,
no gradients, single figure, side view facing RIGHT, centered on a plain solid magenta
background for easy cutout --ar 1:1 --no lying flat, prone, horizontal, swimming, diving,
photorealism, blur, smooth shading, standing surfer, surfboard, bodyboard, handplane,
multiple figures, grid, reference sheet, text, watermark
```

**Judge it on one thing before anything else:** stand it next to `spr_s_tread_n1.png`. If
the body isn't vertical with the legs below it, re-roll — everything else about the render
is negotiable, that isn't.

Converting it will most likely need `--key-at`, because the NPC batch showed Gemini paints
the sea as a **second opaque field** rather than magenta. Probe the water and the surface
highlight, then follow the recipe in *Conversion notes* below. It overwrites
`assets/spr_s_tread.png`; no `loadImg` line to touch.

<details><summary>v1 — the horizontal original, for the record</summary>

```
8-bit pixel art game sprite of a 1980s bodysurfer treading water upright in the lineup
waiting for a wave, no surfboard and no bodyboard and no handplane, bare hands, submerged
to mid-chest with only his head and shoulders clear of the surface, both arms sculling
outward at the waterline, chin up watching the horizon, average athletic build, dark hair,
brown skin, teal trunks, dark short swim fins just visible under the water, calm water line
across his chest, NES video game style 1987, limited 16-color palette, chunky pixels, flat
shading, no anti-aliasing, no gradients, single figure, side view facing RIGHT, centered on
a plain solid magenta background for easy cutout --ar 1:1 --no photorealism, blur, smooth
shading, standing surfer, surfboard, bodyboard, handplane, multiple figures, grid,
reference sheet, text, watermark
```

</details>

### 10 — `spr_s_drop.png` · stroking into the drop

```
8-bit pixel art game sprite of a 1980s bodysurfer dropping in on a steep wave, no surfboard
and no bodyboard and no handplane, bare hands, body angled steeply head-down and forward as
he takes the drop, lead arm punched out and down in front of him reaching for the face,
trailing arm mid-stroke back along his hip, short swim fins kicking hard behind him and
throwing spray, chin up looking down the line, dark hair, brown skin, teal trunks, dark
short swim fins, spray off his kick, NES video game style 1987, limited 16-color palette,
chunky pixels, flat shading, no anti-aliasing, no gradients, single figure, side view
facing RIGHT and angled downward, centered on a plain solid magenta background for easy
cutout --ar 1:1 --no photorealism, blur, smooth shading, standing surfer, surfboard,
bodyboard, handplane, multiple figures, grid, reference sheet, text, watermark
```

## Converting this batch

Same as the trick batch — the lineup poses are smaller in frame than an action pose, so
check `--report` and adjust:

```sh
python3 execution/pixelate_sprite.py --report art-src/spr_b_sit_n1.jpg
python3 execution/pixelate_sprite.py --scale 0.65 art-src/spr_b_sit_n1.jpg assets/spr_b_sit_n1.png
```

Target heights: boarders sitting ≈ 34–38 px (next to `spr_b_sit.png` at 36), bodysurfers
treading ≈ 34–38 px (next to `spr_s_tread.png` at 37). If a render comes out short because
the figure sits small in the 1024 frame, raise `--scale` rather than accepting a 24 px NPC.

## Conversion notes — what this batch actually needed

All six installed 2026-07-29. The commands are not uniform, because the renders weren't:

```sh
# boarders: key the deep water AND the surface highlight + ripple dashes (wider tol on
# those two, or stray blue specks survive as pixels floating in mid-air)
python3 execution/pixelate_sprite.py --key-at 952,636 --key-at 60,632,72 --key-at 60,670,72 \
  --scale 0.61 art-src/spr_b_sit_n1.jpg assets/spr_b_sit_n1.png     # n2 same, n3 --scale 0.59
# S1: no regular lattice at all -> sample at native res and crop off the full-width waterline
python3 execution/pixelate_sprite.py --grid 1024 --crop 300,140,745,975 \
  --key-at 296,512 --key-at 20,514 --scale 0.044 art-src/spr_s_tread_n1.jpg assets/spr_s_tread_n1.png
# S2 / S3: 100x100 grids, no crop needed
python3 execution/pixelate_sprite.py --key-at 92,528 --key-at 20,514 --scale 0.44 ...
python3 execution/pixelate_sprite.py --key-at 0,524  --key-at 20,514 --scale 0.40 ...
```

**Three things this batch taught the converter.**

1. **Gemini painted the sea as a second opaque field**, not as magenta. The default keying
   only drops the corner colour, so the water came through as a solid block — hence
   `--key-at`, repeatable, with an optional per-colour tolerance. The surface highlight and
   ripple dashes are a *third* colour and need their own key.
2. **`--grid` exists because S1 has no regular lattice.** Its block edges came in at
   4.5–7.6 px, so it only *looks* blocky. Passing `--grid 1024` samples at native
   resolution and lets `--scale` do the downsampling, which doesn't care about regularity.
3. **The lattice tolerance had to become proportional to block size.** Held at a flat
   1.2 px it is a large fraction of a small block, so every fine lattice "fits" — S1's real
   grid is ~205 and the detector was confidently reporting 400+. Now a render with no real
   grid correctly returns *no grid found* and tells you to use `--grid`.

**Scales are per file, not the usual 0.65.** This batch arrived at three different logical
resolutions (80, 100, and none) and wildly different zoom — S3 fills his whole frame, S1 is
a small figure in a big one. Pick the scale from the measured bbox to land ~36 px tall, next
to `spr_b_sit.png` at 36. Don't assume the house factor carries over.

**S3 was re-rolled 2026-07-29** — the first render was drawn so zoomed that he dwarfed the
other two and his fins were clipped by the frame edge. The replacement (`--key-at 215,700
--key-at 215,433,72 --scale 0.655`) is leaner, complete, and sits properly beside S1 and S2.
First version archived at `art-src/spr_s_tread_n3_v1.jpg`. Note his fins came back **yellow**
rather than the table's orange; left as-is, since the fins are recoloured to grey in his
three motion poses anyway and only the lineup frame shows them.

**One cosmetic compromise, accepted:** S2 is clipped by the bottom frame edge, so her fins
are cut a little short.

### ⚠️ Open: the bodysurfer lineup mixes poses

The three NPC bodysurfers came back **upright**, exactly as prompted. The player's own
`spr_s_tread` came back **horizontal** and was kept because it read well on its own. Put
them side by side and the locals stand while you float — visible in a bodysurfer lineup.

Cheapest fix is one render, not three: re-roll **prompt 9** with the upright pose stated
hard (*"vertical body, upright in the water, legs hanging straight down, NOT lying flat"*)
so the player matches the crowd. The alternative — re-rolling all three NPCs horizontal —
costs three renders and loses the standing silhouettes that carry their build.

## Judging this batch

Everything in the checklist at the top of the file, plus:

- **Waterline, not a full body.** Both lineup poses are half-submerged. A render showing
  legs and feet below the surface is wrong — the game draws these bobbing at the sea line.
- **The board is flat, not upright.** Boarders sit astride a board lying flat on the water.
  Gemini likes to stand the board up like a surfboard.
- **Silhouettes must differ at a glance.** Put the three boarders side by side at 1:1 and
  squint: if you can't tell the grom from the veteran without colour, the build didn't come
  through and it's worth a re-roll — colour alone is what the recolour already gives you.

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
