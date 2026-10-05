# Apex Cinematic Generation Prompts — v1

**Status:** Production prompts, version-controlled.
**Recorded:** 2026-10-04
**Scope:** Every prompt used to generate the canonical V1 cinematic asset package.
**Companion docs:** `cinematic-visual-bible.md` is the source of truth for all locked attributes.

> **Why these exist in source control.** Generative prompts are production tooling. If a downstream re-run is required (regen of a rejected frame, V2 expansion, new project), the prompt set must be reproducible. This document is the prompt repository. Significant changes require a version bump in §0.

---

## 0. Version log

| Version | Date | Notes |
|---|---|---|
| `v1.0` | 2026-10-04 | Initial generation set that produced the approved V1 keyframes + reference pack. |

---

## 1. Common system prompt (injected into every request)

These descriptors are present in every prompt in this document. They are NOT repeated verbatim below; treat them as the locked baseline.**

### 1.1 — Environment block (West Texas premium backyard)

> premium West Texas / Lubbock-area luxury residential backyard at golden hour, single-story modern Texas ranch home with warm cream limestone exterior walls, board-formed concrete accent wall, matte charcoal standing-seam hip roof, dark anodized aluminum-framed floor-to-ceiling glass on pool-facing wall, covered patio with stained-cedar ceiling, mature live oaks framing the edges, drought-conscious modern xeriscape landscaping (Russian sage, yucca rostrata, agaves, sage bushes, Mexican feather grass, ornamental Texas mountain laurel), no tropical foliage, no palms, no bougainvillea, 6-foot cream limestone privacy wall, lueders limestone paver deck in running-bond pattern

### 1.2 — Pool block

> premium custom pool approximately 22x38 ft freeform-modern rectangle with one softened corner radius, 3'6" shallow end transitioning to 8'0" deep end, raised 8-foot-diameter circular spa on the right side with 8-inch spillway weir falling 6 inches into pool, wide 4-tread architectural steps on the right entering the deep end, rectangular tanning ledge 10x8 ft on the left side 18 inches deep with two umbrella sleeves, wraparound submerged bench along the back wall, 1x1 inch sage-and-cream glass mosaic waterline tile, 2-inch bullnose cream limestone coping, lueders limestone paver decking, medium gray plaster interior (NOT tropical aqua), Pentair IntelliBrite-style underwater white lights

### 1.3 — Family block

> Father: 40, light olive skin (NC25-NC30), short dark brown textured hair with faded sides, short well-kept stubble 2-3 day growth, hazel-green eyes, athletic mesomorph build ~5'10", wearing solid matte charcoal boardshorts mid-thigh flat front no logos, small sun-freckle cluster on left forearm, subtle laugh-line near right eye.
> Son A: 10, lean lanky build, longer limbs relative to torso, light olive skin one shade lighter than father, medium brown shaggy side-swept slightly wavy hair, brown eyes, wearing solid terracotta-clay warm rust knee-length drawstring swim trunks, gap-tooth smile visible when mouth open.
> Son B: 7, rounder shorter compact torso, slight visible belly, light olive skin matching Son A, sandy blonde curly shorter helmet-shaped hair, blue-green eyes, wearing solid muted teal mid-thigh drawstring swim trunks with slight cuff, small band-aid on right knee, half-squinted giggle.
> All three share the same light-olive skin family. No fashion-model appearance. No hats, sunglasses, watches, jewelry, phones, towels, or toys. No character ever looks directly at the camera.

### 1.4 — Lighting block

> Late September, 7:42 PM Central, 18 minutes before sunset. Sun 35° above horizon, positioned camera-left. Long warm soft shadows fall camera-right. Warm color temperature ~2800K. Sky gradient: warm peach near sun, deepening to soft lavender overhead, deep mauve camera-right. No lens flare. No direct sun bloom into camera. Architectural exterior fixtures off. Bounce light from cream limestone walls fills shadow sides of faces. Water surface acts as secondary light source (cool blue undertones on faces looking down).

### 1.5 — Style / quality block

> Premium cinematic editorial photography, photoreal, no lens flare, no chromatic aberration, no AI warping. Real skin texture with visible pores, no plastic-smooth AI look. Anatomically correct — five fingers per hand, correct limb count, no merged bodies, no impossible joints, no distorted faces, no uncanny smiles. Editorial color grade consistent with golden-hour natural palette. No text, no logos, no watermarks, no UI overlays.

---

## 2. Reference pack prompts

### 2.1 — `REF-001` — Backyard wide (canonical environment lock)

```
A premium wide 16:9 architectural editorial photograph of the premium West Texas luxury backyard described in §1.1. The pool described in §2 dominates the lower half of the frame. The modern ranch home and the sky occupy the upper portion. Calm glassy water surface reflecting the house and sky. No toys, no people. Lighting is consistent with §1.4. Editorial color grade, photoreal, premium architectural magazine quality, 28mm full-frame wide lens, elevated 8 ft with slight tilt down. NO family, NO toys, NO logos, NO text.
```

**Conditioning:** None — establishes the visual world.

**Result:** Candidate A (3 generated) → approved.

---

### 2.2 — `REF-002` — Pool geometry (close-up)

```
Architectural close-up photograph of the EXACT same pool from REF-001, viewed from a slightly lower angle to emphasize geometry. Same house, same materials, same lighting. Pool details per §2: rectangular pool with one softened radius corner, raised 8-foot circular spa on the right with subtle spillway sheet, wide 4-tread architectural steps on the right, rectangular tanning ledge on the left, wraparound bench on back wall, 1x1 inch sage-cream glass mosaic waterline tile, 2-inch bullnose cream limestone coping, lueders limestone paver decking, medium gray plaster (NOT tropical aqua), calm glassy surface. NO family, NO toys.
```

**Conditioning:** `REF-001` (img2img).

**Result:** Approved (note: a tighter crop than REF-001, less of the full pool visible — appropriate for a detail/close-up).

---

### 2.3 — `REF-003` — Father portrait

```
Editorial portrait of the father described in §1.3. Three-quarter body or full body. Same golden-hour lighting per §1.4: warm soft sun from camera-left, long soft shadow camera-right, rim light on right side of face. Background blurred showing the cream limestone house and pool from REF-001. Father looking slightly off-camera to the right, relaxed confident stance, warm low-key smile. NO logos, NO jewelry, NO sunglasses, NO hat.
```

**Conditioning:** `REF-001` (for environment/lighting).

**Result:** Approved.

---

### 2.4 — `REF-004` — Older son portrait

```
Editorial portrait, full body, of Son A described in §1.3. Light olive skin one shade lighter than father, medium brown shaggy side-swept hair, brown eyes, wearing solid terracotta-clay warm rust knee-length drawstring trunks. Standing on the limestone paver deck from REF-001 with the pool behind him. Same golden-hour lighting per §1.4. Mid-laugh, energetic forward lean. Real natural skin texture. NO logos, NO shirt, NO hat, NO toys.
```

**Conditioning:** `REF-001` (for environment/lighting).

**Result:** Approved.

---

### 2.5 — `REF-005` — Younger son portrait

```
Editorial portrait, full body, of Son B described in §1.3. Light olive skin, sandy blonde curly shorter helmet-shaped hair, blue-green eyes, wearing solid muted teal mid-thigh drawstring trunks with slight cuff, small band-aid on right knee. Standing on the limestone paver deck from REF-001 with the pool behind him. Same golden-hour lighting per §1.4. Mid-laugh, eyes half-squinted. NO logos, NO shirt, NO hat, NO toys.
```

**Conditioning:** `REF-001` (for environment/lighting).

**Result:** Approved (band-aid visible, character locked).

---

### 2.6 — `REF-006` — Family together

```
Cinematic wide editorial photograph of the family from §1.3 standing together as a group in the same backyard as the reference images. Father center, Son A to his right, Son B to his left slightly in front. They look like they are about to head toward the pool together. Dad has a low-key warm smile, Son A is mid-laugh with mouth open, Son B is giggling with eyes half-squinted. Same modern Texas ranch home in the background per REF-001. Drought-tolerant xeriscape landscaping. Premium pool visible in lower portion. Same golden-hour lighting per §1.4. Editorial cinematic color grade, premium materials, no logos, no jewelry, no hats, no pets, no toys.
```

**Conditioning:** `REF-001`, `REF-003`, `REF-004`, `REF-005` (for character + environment).

**Result:** Approved (locked family unit image).

---

### 2.7 — `REF-007` — Family walking

```
Cinematic editorial photograph of the family walking naturally together toward the pool from the limestone paver deck area. Father slightly in front-center, relaxed stride. Son A mid-step with a playful skip in his stride. Son B half a step behind, mid-giggle. Spontaneous and joyful, not posed. Same architecture, pool, landscaping as REF-001. Same golden-hour lighting per §1.4.
```

**Conditioning:** `REF-001`, `REF-003`, `REF-004`, `REF-005`.

**Result:** Approved (used as a key reference for the establish/approach sequence).

---

### 2.8 — `REF-008` — Underwater pool geometry

```
Cinematic underwater photograph of the SAME premium custom swimming pool from REF-002, now viewed from beneath the water surface. Crystal clear water with cool blue-green color cast (NOT warm aqua). Visible underwater features: medium gray plaster walls, 1x1 inch sage-and-cream glass mosaic waterline tile band, 4 wide architectural steps, rectangular tanning ledge, raised circular spa wall on the far right with subtle spillway bubbles, wraparound bench along back wall. Four white Pentair IntelliBrite-style underwater lights glowing softly on walls. Refracted sunlight patterns dancing on plaster walls. Thin black cable runs visible on plaster. Anti-vortex main drain visible on deep end floor. No people in this frame.
```

**Conditioning:** `REF-002` (for pool geometry consistency).

**Result:** Approved.

---

### 2.9 — `REF-009` — Materials close-up

```
Editorial close-up materials photograph of premium custom pool and backyard materials from the reference environment. Detail shot showing the texture and color of: warm cream limestone coping (2-inch bullnose edge), 1x1 inch glass mosaic waterline tile in muted sage and cream blend, medium gray plaster pool interior surface, lueders limestone paver deck in running-bond pattern, decomposed granite between flagstone steppers, limestone privacy wall with subtle gray veining, Mexican feather grass clump, Russian sage, yucca rostrata. Close enough to read texture (slight cream tone, stone grain, mortar joints, plaster smoothness) but still compositionally beautiful. Golden hour per §1.4.
```

**Conditioning:** `REF-001`, `REF-002`.

**Result:** Approved.

---

### 2.10 — `REF-010` — Lighting reference

```
Cinematic wide environmental photograph defining the exact locked golden-hour lighting conditions. Same premium West Texas backyard as REF-001, but the camera is pulled back further to emphasize the lighting. Late September, 7:42 PM Central, sun 35° above horizon camera-left, long soft warm shadows camera-right. Sky gradient: warm peach near sun, soft lavender overhead, deep mauve camera-right. Architectural exterior fixtures off. Subtle warmth bouncing off cream limestone walls fills shadow sides of surfaces. No lens flare.
```

**Conditioning:** `REF-001`.

**Result:** Approved.

---

## 3. Keyframe prompts

### 3.1 — `KF-001` — Establish (canonical hero)

```
Wide 16:9 cinematic composition showing the premium West Texas backyard and pool from REF-001. Pool dominates the lower half of the frame, house and sky in the upper portion. Calm glassy water reflecting the house and trees. Golden hour per §1.4. The family from §1.3 visible but SECONDARY in the frame, walking casually toward the pool from the deck area on the right side. Family is smaller in frame than the architecture. The family looks like they are about to reach the water edge but not yet jumping. Open breathing room in the upper-left for typography. Editorial cinematic color grade, photoreal, no text, no logos, no lens flare. This is the single most important image in the entire Apex visual identity.
```

**Conditioning:** `REF-001`, `REF-006`, `REF-007`, `REF-010`.

**Result:** Candidate C of 3 approved. Architecture (charcoal standing-seam hip roof) and pool geometry (raised spa on right) preserved from REF-001. Family at modest scale on the right matching the "Family should still be secondary to the environment" requirement.

---

### 3.2 — `KF-020` — Acceleration (anticipation)

```
Continuing from KF-001. The same family is now in the SHOT 02 ANTICIPATION phase. They have begun walking with increased pace toward the pool edge from the deck area. The boys are starting to run playfully, glancing at each other. The father is joining in, smiling, body language participating not supervising. They are still on the deck/stone pavers, NOT yet airborne. Camera pushed slightly closer to the family compared to KF-001. Camera lowered slightly to increase energy. Same golden hour per §1.4. Natural acceleration, not a forced sprint.
```

**Conditioning:** `KF-001`, `REF-006`, `REF-007`, `REF-010`.

**Result:** Candidate A of 2 approved.

---

### 3.3 — `KF-040` — Final stride (run)

```
SHOT 03 RUN. Same family now in full run, approaching the pool edge from the limestone paver deck. All three mid-stride, feet planted on the deck surface, bodies leaning slightly forward with athletic posture that naturally leads into a jump. Father center. Son A slightly to one side, taller stride. Son B just behind. They are about to take off. Camera lowered and pushed closer than previous shots, small lateral shift for depth. Believable physics — feet placement makes sense for takeoff, body posture is athletic. Anatomically correct running posture. Photoreal cinematic editorial.
```

**Conditioning:** `KF-001`, `REF-006`, `REF-007`.

**Result:** Candidate A of 2 approved. **Quality flag:** small bluish object near Son B's foot reads as a stray toy in violation of the no-toys rule. Recommend regen or photo-edit removal before web delivery.

---

### 3.4 — `KF-055` — First airborne

```
SHOT 04 TAKEOFF first airborne frame. Same family has just left the pool edge and are in their FIRST airborne moment. Feet have just left the limestone deck. They are still very close to the pool edge, just a fraction of a second off the ground. Bodies launching upward and slightly forward. Father launching with arms starting to swing. Son A launching higher. Son B just lifting off, slightly behind. Camera continues from prior shot, slight side arc beginning. Same environment, same golden hour per §1.4. Anatomically correct. Natural staggered takeoff, not synchronized.
```

**Conditioning:** `KF-040`, `REF-006`, `REF-007`, `KF-001`.

**Result:** Candidate A of 2 approved. Father + Son A aloft, Son B mid-launch — appropriate for "first airborne."

---

### 3.5 — `KF-070` — Early flight

```
SHOT 05 HERO FLIGHT early frame. Same family clearly airborne above the pool. Several feet in the air, early slow-motion phase. Bodies visually separated. Father near visual center. Son A slightly higher and to one side. Son B slightly lower and to the other side. Arms and faces show joyful expressions mid-laugh. Below them the premium pool is clearly visible — calm water surface, raised circular spa on the right, waterline mosaic tile visible, limestone coping. Same modern Texas ranch home in upper background. Golden hour per §1.4. Camera slightly more orbital/lateral, creating dimensionality. Photoreal cinematic editorial, anatomically correct, no duplicate limbs.
```

**Conditioning:** `KF-040`, `REF-006`, `REF-007`, `KF-001`.

**Result:** Candidate A of 2 approved. **Quality flag:** roof color reads slightly different shade — see weak-spots report.

---

### 3.6 — `KF-080` — Peak flight (HERO IMAGE)

```
PREMIUM CINEMATIC HERO IMAGE. SHOT 05 PEAK FLIGHT — moment of suspended slow motion. The same father from §1.3 is visually centered, arms spread in a joyful open gesture, mid-laugh. Son A is slightly to the fathers left (camera-right) and slightly higher. Son B is slightly to the fathers right (camera-left) and slightly lower. All three bodies clearly separated and visible, suspended in golden hour light, no body intersections. Below them the premium custom pool is clearly visible: rectangular pool with raised 8-foot circular spa on the right side, calm water reflecting the family and sky, waterline mosaic tile, limestone pavers. Same modern Texas ranch home with cream limestone walls, charcoal standing-seam hip roof, large dark-framed pool-facing glass in the upper background. Drought-tolerant xeriscape landscaping. Golden hour per §1.4. Authentic joy on every face. No duplicate limbs, no merged hands, no distorted feet. Photoreal, premium cinematic editorial color grade, advertising-quality image, no text no logos no lens flare.
```

**Conditioning:** `KF-070`, `KF-001`, `REF-006`, `REF-007`.

**Result:** Candidate A of 4 approved. **Locked as the canonical hero image.** Architecture (charcoal standing-seam hip roof) preserved.

---

### 3.7 — `KF-090` — Descent

```
SHOT 06 DESCENT. Same family descending toward the pool after peak flight. All three clearly airborne but body positions now lean slightly downward. Family is closer to the water surface than at peak. Below them, the premium pool is clearly visible: rectangular pool, raised circular spa on the right, calm water now showing some ripples from the descent air pressure, waterline mosaic tile, limestone coping. Same modern Texas ranch home. Golden hour per §1.4. Camera has moved subtly closer to the water. Bodies clearly beginning downward motion, no flat side-view. Anatomically correct.
```

**Conditioning:** `KF-080`, `KF-070`, `REF-006`, `REF-007`.

**Result:** Candidate A of 2 approved.

---

### 3.8 — `KF-100` — Pre-impact

```
SHOT 07 PRE-IMPACT. Same family almost at the pool surface, the moment just before water contact. Father feet-down almost touching water. Son A on one side, feet pointing down toward water, knees slightly bent. Son B on the other side, about to enter. Water surface below shows visible ripples and small concentric waves already beginning from the proximity. Same architecture and pool. Camera driving toward the water. Hands, feet, faces, and body shape carefully rendered — anatomically correct, no distortions, no merged limbs.
```

**Conditioning:** `KF-080`, `REF-006`, `REF-007`.

**Result:** Approved. **Note:** Son A expression drifts slightly serious — flag for retouch if available.

---

### 3.9 — `KF-108` — Water contact

```
SHOT 07 IMPACT first water contact. Same family has just hit the pool water surface. Father partially submerged, splash starting around him. Son A just entering feet-first with first splash. Son B just hitting. Splash is starting naturally — water rising around each body, not yet a huge explosion. Premium pool with raised circular spa on the right, waterline mosaic tile, limestone coping. Modern Texas ranch home with cream limestone, charcoal hip roof in background. Golden hour per §1.4. Camera moving closer to the water. Anatomically correct.
```

**Conditioning:** `KF-080`, `REF-006`, `REF-007`.

**Result:** Approved. **Note:** Son B body position is sitting-on-edge rather than airborne in this frame — minor seam with KF-100; hidden by KF-116 splash.

---

### 3.10 — `KF-112` — Splash expansion

```
SHOT 07 SPLASH EXPANSION. Family has hit the water and the splash is now expanding significantly. Water moving toward the camera. Large amount of water spray, droplets, and waves fill the lower 2/3 of the frame, partially obscuring the family. Bodies still slightly recognizable but water dominates. Architecture in the background begins becoming obscured by water spray. Premium pool with raised circular spa on the right visible but increasingly splashed. Modern Texas ranch with cream limestone, charcoal hip roof still partially visible. Golden hour per §1.4. Splash looks physically believable — not a stylized cartoon explosion.
```

**Conditioning:** `KF-108`, `KF-100`.

**Result:** Candidate A of 2 approved.

---

### 3.11 — `KF-116` — Water dominates

```
SHOT 07 WATER DOMINATES. Frame mostly water. Most of viewport is water, droplets, refracted light, spray. Family anatomy no longer required to be visible. Architecture mostly obscured. Only hints of the modern Texas ranch home with cream limestone and charcoal hip roof can be seen in the upper portion. Beautiful golden-hour light refracting through water. Caustics, droplets, motion blur. Premium cinematic editorial color grade.
```

**Conditioning:** `KF-108`.

**Result:** Candidate A of 2 approved.

---

### 3.12 — `KF-120` — Transition cover (full-screen water)

```
SHOT 08 SPLASH WIPE — the safest hidden edit point in the entire sequence. Essentially full-screen cinematic water. No clear family anatomy required. No architecture needs to remain visible. Just water, droplets, refracted golden-hour light, and motion. Caustics and bubbles starting to appear at the bottom hinting at the underwater world below. Beautiful, abstract, premium cinematic editorial color grade. Photoreal.
```

**Conditioning:** `KF-108`.

**Result:** Candidate B of 2 approved (Candidate B was the cleaner abstract cover with no family elements visible).

---

### 3.13 — `KF-126` — Surface crossing

```
SHOT 09 SURFACE CROSSING. A premium cinematic half-above-half-below water photograph. Camera has just crossed the water surface and is now looking at the pool from below. Upper portion shows the above-water scene blurred and refracted through the surface line — distorted views of the modern Texas ranch home, sky, and pool deck. Lower portion shows the underwater view of the SAME pool — medium gray plaster walls, mosaic waterline tile band at top, steps visible, tanning ledge visible, raised spa wall on one side. Bubbles and refracted sunlight. Caustics on plaster walls.
```

**Conditioning:** `KF-120`, `REF-008`.

**Result:** Candidate B of 2 approved. **Note:** above-water architecture differs subtly from KF-001. Per the brief: "If visual consistency is poor: Do not force this shot. Use KF-120 as the transition and begin underwater directly." Recommendation: use KF-120 as the canonical edit point in production; KF-126 is optional.

---

### 3.14 — `KF-140` — Underwater hero

```
SHOT 10 UNDERWATER HERO REVEAL. Underwater craftsmanship photograph of the SAME premium custom pool from prior frames, now revealed as the focal point. Crystal clear water with cool blue-green color cast (NOT warm aqua). Medium gray plaster interior walls. Visible underwater features: 1x1 inch sage-and-cream glass mosaic waterline tile at top of walls, wide 4-tread architectural steps, rectangular tanning ledge, raised circular spa wall, wraparound bench along back wall. Four white Pentair IntelliBrite-style underwater lights glowing softly on walls — two in deep-end wall, one on bench wall, one on spa-facing wall. Refracted golden-hour sunlight patterns dancing on plaster walls and ceiling. Thin black cable runs visible on plaster. Anti-vortex main drain on deep end floor. Some distant legs or bubbles in foreground hinting the family just entered. Premium cinematic craftsmanship reveal.
```

**Conditioning:** `REF-008`.

**Result:** Candidate A of 2 approved. Pool geometry matches REF-008 perfectly — same pool from above to below.

---

## 4. Generation discipline rules

These are non-negotiable for any regen, V2 expansion, or new project in this family:

1. **Always condition on locked references.** A frame without its proper `input_urls` is a coin flip — character, pool, architecture, and lighting will drift.
2. **Always specify the family block (§1.3) verbatim.** Don't paraphrase, don't trim. Faces drift when description drifts.
3. **Always end with the quality block (§1.5).** Even one missing clause (no logos, anatomically correct, etc.) measurably degrades output.
4. **Sun direction is camera-left. Always.** A single prompt inversion is enough to break the entire sequence.
5. **Pool geometry is fixed.** Refer to §2 for the canonical shape. Don't describe "freeform" without the radius-corner and tanning-ledge-on-left spa-on-right specification.
6. **Aspect ratio: 16:9 for desktop, 9:16 for mobile.** Resolution: 1K minimum, 2K preferred for master outputs.
7. **Image-to-image chaining beats text-only for adjacent frames.** If you regenerate KF-090, condition it on KF-080, not on the family references alone.
8. **Reject any frame where**: face drift, body shape change, swimwear change, age change, house footprint change, pool shape change, spa move, steps change, sun direction flip, shadow reversal, anatomy errors, impossible water behavior.

---

## 5. Re-run quick reference

| To regenerate | Condition on | Notes |
|---|---|---|
| Any reference | `REF-001` | Always — environment lock |
| Any character | `REF-001` + the character reference | Always |
| Family together | `REF-006` | The locked family unit image |
| KF-001 | `REF-001` + `REF-006` + `REF-007` + `REF-010` | |
| KF-020–040 | `KF-001` + family references | Pre-jump family movement |
| KF-055–080 | `KF-040` + `REF-006` + `REF-007` + `KF-001` | Airborne family |
| KF-090–108 | `KF-080` + `REF-006` + `REF-007` | Descent + impact |
| KF-112–120 | `KF-108` + `KF-100` | Splash zone |
| KF-126 | `KF-120` + `REF-008` | Surface crossing |
| KF-140 | `REF-008` + immediate-prior keyframe | Underwater |

---

## 6. Open questions for V2

- Add mobile (9:16) generation script for portrait-adapted variants of KF-001, KF-080, KF-140
- Add an explicit color-correction pass that pulls pool water toward the bible's "muted gray plaster" target — current frames lean aqua
- Add a higher-density intermediate-frame generation pass (currently 6 frames in the flight zone; brief target ~30-40)
- Consider adding the V2 evening / night sequence as a sibling bible — same family, second environment