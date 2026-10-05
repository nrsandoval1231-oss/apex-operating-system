# Apex Cinematic Visual Bible

**Status:** CANONICAL / LOCKED
**Recorded:** 2026-10-04
**Parent documents:**
- `cinematic-homepage-vision.md`
- `cinematic-homepage-storyboard.md`
- `design-direction.md`

**Scope:** Locked visual source-of-truth for every still and keyframe in the V1 cinematic asset package. Every reference, keyframe, intermediate frame, fallback, and mobile variant must inherit from this document.

> **Read this before touching the prompt file.** A still that drifts on any of these axes is a quality-gate reject, regardless of how beautiful it is on its own.

---

## 1. Brand context (must harmonize with site)

The Apex visual identity is locked in `design-direction.md` §1a and §2. The cinema must coexist with that brand — not compete with it.

| Token | Hex | Role in cinema |
|---|---|---|
| `--char` | `#1B1C1E` | Deepest shadows, dramatic contrast anchor |
| `--sage` | `#A1CCCA` | Skin/foliage chroma anchor; surface glare on water |
| `--sage-ink` | `#2F6B68` | Architectural accent (umbrellas, cushions) — rare on-screen |
| `--paper` | `#F6F4EF` | Sun-bleached limestone, coping accents, masonry read |
| `--amber` | `#E0901B` | **NOT a cinema color.** Amber is reserved for site CTAs/focus only. The cinema's "warm accent" is *golden-hour sunlight*, not the amber hex. |

**Implication:** the visual signature of the cinematic asset package is **warm sun + sage water reflection + charcoal shadows + paper limestone**. No `#E0901B` should appear on props, tile, signage, or wardrobe.

---

## 2. Family lock

These identities are fixed. Any frame where a face, body, hair, skin tone, or garment drifts is rejected.

### 2.1 — Father ("APEX-FATHER")

| Attribute | Locked value |
|---|---|
| Age read | Late 30s to early 40s |
| Build | Athletic, mesomorph-ish, believable — not model-ripped |
| Skin tone | Light olive / sun-touched Mediterranean (NC25–NC30 range) |
| Hair | Short dark brown, slightly textured on top, faded sides |
| Facial hair | Short, well-kept stubble (2–3 day growth) |
| Eyes | Hazel-green |
| Expression baseline | Warm, low-key smile — never posed grin |
| Swimwear | Solid charcoal `--char` boardshorts, mid-thigh, flat front, no logo, no pattern |
| Distinguishing marks | Small sun-freckle cluster on left forearm; subtle laugh-line near right eye |
| Personality cue | "Participating dad" — moves first, but reads as not-directing |
| In-frame height | ~5'10" |
| When wet | Hair darkens slightly; shorts visibly cling at hem; no transparent wardrobe issues |

### 2.2 — Son A — Older son ("APEX-SON-A")

| Attribute | Locked value |
|---|---|
| Age read | 9–11 (looks ~10) |
| Build | Lean, lanky, longer limbs relative to torso, visible motion-blur prone |
| Skin tone | Light olive, one shade lighter than father |
| Hair | Medium brown, shaggy side-swept, slightly wavy |
| Eyes | Brown |
| Expression baseline | Pure excitement, open mouth, mid-laugh |
| Swimwear | Solid terracotta-clay (warm rust `#B25E3A`) trunks, knee-length, drawstring |
| Distinguishing marks | Gap-tooth smile (one front tooth) |
| Personality cue | "First one in the pool" — leads the run, takes the bigger jump |
| In-frame height | ~4'8" — clearly the taller child |
| When wet | Hair clumps into damp waves; trunks darken at hip line |

### 2.3 — Son B — Younger son ("APEX-SON-B")

| Attribute | Locked value |
|---|---|
| Age read | 6–8 (looks ~7) |
| Build | Rounder, shorter, more compact torso, more obvious belly in mid-laugh pose |
| Skin tone | Light olive, same as Son A |
| Hair | Sandy blonde, curly, shorter, helmet-shaped |
| Eyes | Blue-green |
| Expression baseline | Uncontainable giggle, eyes half-squinted |
| Swimwear | Solid muted teal `#5C8E8A` trunks, mid-thigh, drawstring, slight cuff |
| Distinguishing marks | Small band-aid on right knee (subtle, narrative-realistic) |
| Personality cue | "Joyful caboose" — half a beat behind, smaller jump, biggest reaction |
| In-frame height | ~4'0" — visibly shorter than Son A |
| When wet | Curly hair tightens into defined ringlets |

### 2.4 — Family invariants

- All three share the light-olive skin family. No dark/light contrast between them.
- Body proportions are *biological*, not stylized: the father is not 7 feet tall, the boys are not miniature adults.
- No character ever wears sunglasses, hats, watches, jewelry, or visible logos. None ever carries a phone, towel, or pool toy. The frame is about the jump.
- No character ever looks directly at the camera. They look at each other, at the water, or at nothing in particular.
- Wardrobe stays dry-to-wet consistent within the same shot — no miraculous outfit changes between KF-040 (dry) and KF-116 (splash).

---

## 3. Environment lock — premium West Texas backyard

A specific, locked place. Not generic. Not coastal. Not Scottsdale.

### 3.1 — Architecture ("APEX-HOUSE")

- **Style:** Modern Texas ranch — single story, low-pitched hip roof, deep overhangs
- **Exterior cladding:** Warm-toned limestone (creamy `--paper` base with subtle gray veining), board-formed concrete accent walls, matte black window mullions
- **Windows:** Floor-to-ceiling on the pool-facing wall, dark anodized aluminum frames
- **Outdoor living:** Covered patio with stained-cedar ceiling (warm `--sage-ink` stain), recessed lighting off (not on during golden hour), built-in limestone outdoor fireplace on far side (used as background anchor only, not a focal point)
- **Pool house / cabana:** None — the back of the main house *is* the backdrop
- **Roof color:** Standing-seam matte charcoal `--char`
- **Square footage read:** ~4,000–5,500 sq ft — believable for upper-end Lubbock custom home, not 12,000 sq ft mansion

### 3.2 — Landscaping ("APEX-LANDSCAPE")

- **Style:** Drought-conscious modern xeriscape with curated soft accents — clean lines, restrained palette
- **Trees:** 2× mature live oaks (off-frame left and right, used as canopy framing only); 1× ornamental Texas mountain laurel near fireplace
- **Shrubs:** Russian sage, yucca rostrata, agaves, sage bushes — all with `--sage` undertones
- **Grasses:** Mexican feather grass (Nassella tenuissima) clumps along the pool edge
- **Ground cover:** Decomposed granite between flagstone steppers
- **Hardscape:** Cream flagstone steppers + coping that matches the limestone house
- **No tropical foliage.** No palms. No banana leaves. No resort bougainvillea.
- **No neighbors visible.** Periphery is masked by oak canopy + a 6-ft limestone privacy wall on the property line.

### 3.3 — Atmosphere

- **Sky:** Mostly clear with a few high cirrus; soft gradient from warm peach near sun to muted lavender opposite
- **Wind:** Almost still. Mexican feather grass is upright, not blown. Water surface has barely-perceptible ripples.
- **Bugs / birds:** None visible. No drones. No lens flares from camera.

---

## 4. Pool lock ("APEX-POOL")

The pool is a hero object. It must remain recognizable from above, from jump-angle, from splash, and from underwater.

### 4.1 — Geometry

- **Footprint:** Approximately 22 ft × 38 ft freeform-modern rectangle with a softened corner radius on the pool-house side
- **Depth:** 3'6" shallow end → 4'6" break → 8'0" deep end (diving-grade)
- **Tanning ledge:** Step-down rectangular ledge on the *right* side (camera-left), 18 inches deep, ~10 ft × 8 ft, two umbrella sleeves
- **Spa:** Raised 18" round spa (8 ft diameter) on the *left* side (camera-right), spillway into pool, single 6-jet visible
- **Steps:** Wide architectural steps (4 treads) entering from the deep-end side (camera-right), 12 inches wide each, with a center handrail-less design
- **Bench:** Wraparound bench along the back wall (opposite the house), 18" wide, ~14" submerged
- **Skimmers:** Two recessed automatic-screws on the side walls (visible in underwater shots)
- **Returns:** Three directional returns visible underwater on the back wall
- **Drain:** Single main drain visible on the deep end floor — anti-vortex safety pattern

### 4.2 — Materials

| Element | Material | Visual read |
|---|---|---|
| Interior finish | Medium gray plaster (NuvoStone "Moonstone" family) | Reads warm in golden hour, cool in underwater |
| Waterline tile | 1" × 1" glass mosaic in `--sage` and cream blend | Defines the waterline across all above-water shots |
| Coping | 2" bullnose limestone (matches house) | Warm cream edge all the way around |
| Spa spillway | Single 8" weir, falls ~6" into pool | Subtle sheet of water on the spa side |
| Tanning ledge face | Same plaster as interior; no separate tile band | Clean look, no busy joints |
| Decking | Lueders limestone pavers, 16" × 24" running-bond pattern | Warm, slightly textured, barefoot-friendly |

### 4.3 — Underwater lighting

- **Four Pentair IntelliBrite 5g color lights** (set to white) — two in the deep-end wall, one on the bench wall, one on the spa-facing wall
- **One smaller light** at the tanning ledge step face
- **Cable runs** visible underwater as thin black lines on the wall — adds realism, hides nothing

### 4.4 — Above-water state

- Water surface: calm, glassy in early frames; progressively disturbed through the run and splash
- Reflections: of the house, the trees, the sky — consistent with the locked environment
- Caustics: visible on the tanning ledge and steps in early evening light

### 4.5 — Underwater state

- **Visibility:** ~25–30 ft crystal clear (fresh fill, properly balanced)
- **Color cast:** Cool blue-green, NOT warm. The sun bleaches above, the pool cools below.
- **Bubbles:** Occasional from the spillway; large burst after the splash entry
- **Caustics:** Refracted sunlight patterns dance on the plaster
- **Refraction lines:** Surface ripples distort the pool walls in a horizon band

---

## 5. Lighting lock ("APEX-LIGHT")

Time: **7:42 PM Central, late September.** Roughly 18 minutes before sunset. The whole sequence happens in this window.

### 5.1 — Direction

- Sun position: low, **35° above horizon, camera-left** (consistent across all above-water frames)
- Shadows: fall **camera-right**, long and soft-edged
- Rim light: every back-facing body edge and the roofline catch a warm orange rim
- Sky gradient: peach behind the sun, deepening to soft lavender overhead, deep mauve opposite the sun

### 5.2 — Quality

- Light is **soft and warm** (~2800K ambient), not contrasty-noon
- Bounce light from the limestone house adds subtle warm fill to shadow sides of faces
- The water surface acts as a giant secondary light source (cool blue undertones on faces looking down)
- Exposure: preserve highlight on the sun rim; pull shadow detail up; never clip skin tones

### 5.3 — Underwater lighting

- Refracted sunlight dominates in the upper water column — sharp patterns on steps and walls
- Pool lights (white) dominate in the deep end and the back wall — soft pools of warm-white light
- No dramatic chiaroscuro underwater. Craftsmanship must read, not mood.

### 5.4 — Forbidden lighting states

- ❌ Sun on camera-right (must stay camera-left throughout)
- ❌ Midday sun / hard top-down shadows
- ❌ Stormy / dramatic cloud cover
- ❌ Sunset color shift from peach to magenta within the sequence
- ❌ Visible moon
- ❌ Lens flare that breaks the cinematic language

---

## 6. Camera lock ("APEX-CAM")

### 6.1 — Lens language

- Primary: **35mm full-frame equivalent** for the establish and hero flight
- Slight wide shift to **28mm** for the underwater opening
- 50mm-ish compression for the splash entry (camera close to water)
- **No fisheye. No 16mm distortion. No extreme telephoto.**

### 6.2 — Camera behavior

- Establish: slow dolly forward, slight tilt down
- Approach: continued dolly, subtle vertical drop
- Run: lower and closer, tiny lateral shift
- Takeoff: deceleration, hint of arc
- Flight: subtle 8–15° orbital arc, slow
- Descent: drive toward water
- Impact: rapid push into splash
- Wipe: pass through splash
- Underwater: smooth glide, slight rise

### 6.3 — Framing invariants

- Aspect ratio: **16:9 desktop**, **9:16 mobile**
- **No characters are ever out of frame during the run → flight** — both boys and father must remain visible until the splash obscures them
- Always leave one corner with breathing room for typography (Beat A opening copy)

---

## 7. Continuity enforcement protocol

These rules are how visual drift is prevented across ~165 frames.

### 7.1 — Reference chain

Every non-reference image MUST condition on prior locked references:

| Output | Required `input_urls` |
|---|---|
| REF-002 (pool) | REF-001 |
| REF-003 (father) | REF-001, REF-002 |
| REF-004 (older son) | REF-001, REF-002 |
| REF-005 (younger son) | REF-001, REF-002 |
| REF-006 (family) | REF-003, REF-004, REF-005 |
| REF-007 (family walking) | REF-006 |
| REF-008 (underwater) | REF-002 |
| REF-009 (materials) | REF-001, REF-002 |
| REF-010 (lighting) | REF-001 |
| KF-001 | REF-001, REF-006, REF-007, REF-010 |
| KF-020 → KF-090 | KF-001 + immediate-prior keyframe |
| KF-100 → KF-116 | KF-090 + immediate-prior keyframe |
| KF-120 | KF-116 |
| KF-126 (if used) | KF-120, REF-008 |
| KF-140 | REF-008 + immediate-prior keyframe |
| Intermediate frames | two nearest keyframes |

### 7.2 — Drift gates (Section 24 of the brief)

Reject and regenerate any frame exhibiting:

- Face / age / hair / swimwear / body-shape drift on any family member
- Architecture change (house footprint, roof line, cladding pattern)
- Pool geometry change (any of: spa moves, steps change shape, bench shape changes, tile pattern differs, coping changes)
- Sun direction change, sunset color shift, shadow reversal
- Anatomy errors on any character
- Impossible water behavior (water walking on, water ignoring physics, broken reflections)

### 7.3 — Approval threshold

A keyframe is "approved" only when it passes all drift gates *and* passes a side-by-side compare against its neighbors at thumbnail size.

---

## 8. Asset inventory the visual bible generates

```
/apps/website/public/cinematic/v1/
├── reference/    REF-001 through REF-010
├── keyframes/    KF-001, KF-020, KF-040, KF-055, KF-070, KF-080, KF-090,
│                 KF-100, KF-108, KF-112, KF-116, KF-120, KF-126?, KF-140
├── frames/       FRAME-0001 ... FRAME-0140+
├── review/       Contact sheets per generation round
├── fallback/     hero.webp, flight.webp, underwater.webp
├── mobile/       Portrait variants of approved keyframes
└── frame-manifest.json
```

---

## 9. Master sign-off

This bible is canonical for V1. Any future variant (V2 scenes, additional projects, evening sequences) is a sibling document, not an edit to this one.