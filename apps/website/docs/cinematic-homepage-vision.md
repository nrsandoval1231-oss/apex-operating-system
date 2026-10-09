# Apex Cinematic Homepage Vision

**Status:** ARCHIVED / SUPERSEDED BY `cinematic-video-handoff.md`
**Recorded:** 2026-10-04  
**Scope:** Apex public website — homepage experience and visual storytelling direction  
**Owner:** Nick Sandoval  

> Historical frame-sequence concept. The family/pool creative intent remains useful, but its
> sequence-first implementation is not active. The approved master video is now canonical;
> future posters, mobile crops, and any scroll sequence must derive from that source.

---

## 1. Core idea

The Apex homepage should not feel like a conventional pool-builder website.

It should feel like an **interactive luxury brand film controlled by scroll**.

The defining opening sequence is a father and his two sons experiencing a completed Apex pool together. The visitor scrolls through a continuous cinematic moment:

**beautiful backyard → approach → run → jump → suspended midair → impact → splash → underwater transition → craftsmanship → emergence into the broader Apex experience**

The experience is emotional first, product second, conversion third.

Apex is not merely selling gunite, pumps, tile, decking, or construction labor. The website should communicate the reason the customer wants the pool in the first place:

**family, memory, lifestyle, pride of ownership, and a backyard people want to live in.**

The emotional center is:

> **Build the backyard they'll remember.**

---

## 2. Canonical opening scene

The hero environment is a high-end West Texas / Lubbock-area luxury backyard at golden hour.

The canonical scene includes:

- one father
- his two sons
- one architecturally beautiful custom pool
- upscale but believable West Texas residential architecture
- landscaping appropriate to the market
- refined hardscape
- optional fire/water features where compositionally useful
- warm low-angle sunlight
- premium editorial/cinematic photography
- restrained Apex branding and typography

The family and environment must remain visually consistent throughout the sequence.

The father is centered or compositionally dominant during the jump, with one son on each side or arranged naturally around him. The moment should feel joyful and real rather than staged or stock-photo-like.

The pool must remain a hero object in the frame. The family creates the emotional connection; the pool proves what Apex builds.

---

## 3. Scroll-driven story

### Scene 01 — Establish

Wide architectural shot of the completed backyard and pool.

The water is calm. The family is approaching the pool.

Possible opening message:

> **BUILD THE BACKYARD THEY'LL REMEMBER.**

The copy should be minimal and disappear before the action becomes visually dominant.

### Scene 02 — Approach / run

The father and boys begin moving toward the water.

The camera gradually pushes closer and may lower slightly to increase energy.

Avoid excessive text.

### Scene 03 — Jump

All three launch into the air.

This is the hero moment of the experience.

The apparent motion can slow as the user scrolls through the airborne frames. The composition should have real depth and dimensionality, with subtle camera movement rather than a purely static side view.

Possible message:

> **THIS IS WHY WE BUILD.**

Use only if it improves the scene. The imagery should be strong enough to work without copy.

### Scene 04 — Impact

The family hits the water.

A large natural splash moves toward camera until water occupies most or all of the viewport.

The splash becomes a transition surface rather than simply the end of the animation.

### Scene 05 — Underwater transition

The camera appears to pass through the water surface.

The environment changes from emotional lifestyle storytelling to craftsmanship storytelling.

Visual ingredients:

- bubbles
- refracted sunlight
- underwater lighting
- tile
- steps
- tanning ledges
- benches
- spa interfaces
- finish quality
- depth and geometry

Possible copy:

> **CRAFTED ABOVE. ENGINEERED BELOW.**

or

> **CUSTOM POOLS. BUILT DIFFERENT.**

### Scene 06 — Craftsmanship journey

The camera moves through or along the pool architecture.

This section can introduce subtle feature storytelling, but it must not turn into a technical diagram or cluttered feature-label experience.

Possible elements to reveal:

- premium tile and coping
- tanning ledges
- submerged seating
- integrated spa
- spillways
- lighting
- stonework
- water features
- thoughtful depth transitions
- equipment/engineering where useful

### Scene 07 — Surface into another Apex environment

The camera moves upward through the water and emerges into another completed Apex backyard.

This creates the larger transition language for the website:

**water connects scenes.**

The second scene may be evening or nighttime, with lighting, fire features, spa activity, and another finished pool.

Possible message:

> **DESIGNED AROUND HOW YOU LIVE.**

---

## 4. Website as one continuous world

The long-term experience should avoid feeling like disconnected blocks stacked down a page.

Instead of the conventional pattern:

```text
Hero
About
Services
Gallery
Reviews
Contact
```

the site should feel like a continuous journey:

```text
Emotion
→ Jump
→ Splash
→ Underwater
→ Craftsmanship
→ Surface into another project
→ Explore styles
→ Apex process
→ Final lifestyle scene
→ Consultation CTA
```

Transitions should feel spatial and cinematic.

Water is the primary transition device.

Potential future transitions:

- surface → underwater
- underwater → another pool
- daylight → twilight
- finished environment → design drawings
- design drawings → construction
- construction → finished pool
- spa spillway → water transition
- reflection → next environment

The environment should transform around the visitor rather than repeatedly cutting to conventional page sections.

---

## 5. Emotional positioning

The homepage must lead with what owning the pool creates, not with construction features.

Primary emotional themes:

- family memories
- children growing up around the backyard
- entertaining
- pride of ownership
- private resort experience
- time together
- lifestyle transformation

Apex craftsmanship is the proof behind the emotional promise.

Possible brand lines include:

> **BUILD THE BACKYARD THEY'LL REMEMBER.**

> **MORE THAN A POOL. A PLACE YOUR FAMILY GROWS UP IN.**

> **DESIGNED AROUND HOW YOU WANT TO LIVE.**

> **YOUR BACKYARD. BUILT DIFFERENT.**

> **THIS IS WHY WE BUILD.**

Copy should remain restrained. The visual experience should carry most of the story.

---

## 6. Technical strategy — V1

The first version should **feel 3D without requiring a fully real-time 3D website**.

The preferred implementation is:

**canonical hero still → controlled cinematic motion → image sequence → scroll-controlled canvas playback**

Do not generate 100–200 independent images from text prompts. Character faces, clothing, pool geometry, architecture, lighting, and camera position will drift.

Instead:

1. create one canonical hero image/environment
2. lock the father, boys, wardrobe, architecture, pool, materials, camera language, and lighting
3. derive motion from that canonical visual source using controlled image-to-video or similar generation
4. create a master cinematic clip
5. extract frames
6. optimize the frames for web delivery
7. map scroll position to frame position

Conceptually:

```text
scroll progress → animation frame
```

Example:

```text
0%   → frame 001
20%  → frame 030
50%  → frame 075
75%  → frame 115
100% → frame 150
```

Scrolling backward reverses the experience naturally.

---

## 7. Recommended rendering model

Use a fullscreen canvas for the image sequence rather than rendering a large stack of visible `<img>` elements.

The cinematic sequence should be pinned while the visitor scrolls through several viewport heights.

GSAP ScrollTrigger or an equivalent robust scroll orchestration system is appropriate.

Illustrative choreography:

```text
0–15%   Establishing pool scene
15–35%  Family begins running
35–60%  Jump
60–72%  Suspended / slow-motion airborne moment
72–82%  Impact
82–92%  Splash fills viewport
92–100% Underwater reveal
```

The exact percentages should be tuned by feel after the prototype exists.

The user's scroll position should control time. The visitor should be able to move forward and backward through the moment smoothly.

---

## 8. Cinematic direction

The camera should participate in the story.

Preferred progression:

### Establish
Wide architectural view, approximately a 24–28 mm visual feel.

### Approach
Slow dolly toward the family.

### Acceleration
Camera lowers slightly or moves closer as they run.

### Flight
Time appears to slow. A subtle orbital or lateral camera move creates dimensionality.

### Impact
Camera drives toward the water.

### Transition
Splash occupies the frame.

### Underwater
Camera moves beneath the surface.

### Craft
Camera travels through or alongside the pool architecture.

### Surface
Camera rises into another completed project.

The result should feel like one cinematic shot or a deliberately seamless set of shots, not a slideshow.

---

## 9. Asset strategy

A likely initial master sequence is approximately 10–15 seconds of source motion.

Illustrative timing:

| Time | Scene |
| --- | --- |
| 0–2 s | Wide luxury backyard / family approaches |
| 2–4 s | Family begins running |
| 4–6 s | Camera pushes toward them |
| 6–8 s | Jump / hero moment |
| 8–9 s | Water impact |
| 9–11 s | Splash fills frame |
| 11–13 s | Camera passes underwater |
| 13–15 s | Craftsmanship reveal |

The final scroll experience may use roughly 100–180 optimized frames rather than every frame of the source clip.

The source asset can be higher resolution; web delivery assets must be aggressively optimized.

---

## 10. Performance requirements

The experience cannot become a huge download or block the page.

Required principles:

- AVIF/WebP where appropriate
- responsive frame sizes
- preload only the opening frame set
- background-load later frames
- CDN delivery
- canvas rendering
- adjacent-frame caching
- desktop/tablet/mobile asset tiers
- static/reduced-motion fallback
- graceful degradation on low-power devices
- no long spinner before the visitor sees a beautiful first frame

Illustrative asset tiers:

```text
Desktop: 1440–1920 px
Tablet:  ~1024 px
Mobile:  ~720 px
```

Target the smallest practical initial hero payload. The visitor should see the scene immediately while later frames progressively load.

---

## 11. V1 scope — build this first

V1 should prove the defining interaction before the site becomes more complex.

Build:

1. canonical luxury-pool environment
2. father + two sons
3. approach/run
4. jump
5. splash
6. underwater transition
7. scroll-controlled frame sequence
8. restrained cinematic typography
9. responsive behavior
10. reduced-motion/static fallback
11. final transition/CTA state

Do **not** begin by building a full Three.js/WebGL universe.

The image-sequence approach should capture most of the perceived magic with much lower implementation and performance risk.

The first prototype exists to answer one question:

> **Is the scroll interaction so satisfying that a visitor naturally scrolls back and forth through the jump just to experience it again?**

If not, tune the visual sequence and interaction before expanding the website.

---

## 12. V2 / later expansion

After V1 is excellent, the same language can expand into:

- multiple completed pool environments
- project-to-project water transitions
- interactive portfolio exploration
- Modern / Resort / Family / Natural / Compact Luxury modes
- WebGL water effects
- shader-based refraction/distortion
- 3D parallax and depth
- interactive design visualization
- pool style/configuration tools
- animated architectural drawings
- design → construction → finished-project transitions
- nighttime lighting experiences
- spatial gallery navigation

True 3D should be added selectively where it produces a clear improvement rather than because it is technically interesting.

---

## 13. Conversion journey

The cinematic experience must ultimately create business.

A likely overall journey:

### Emotion
Family + completed backyard.

### Desire
The jump and lifestyle moment.

### Proof
Underwater craftsmanship and construction quality.

### Inspiration
Multiple styles and completed environments.

### Trust
Apex process, experience, testimonials, and project proof.

### Action
A clear design consultation CTA.

Potential final scene:

Evening. Pool lighting is on. The father is relaxing beside the pool while the boys swim.

Final message:

> **YOUR BACKYARD IS WAITING.**

Primary CTA:

> **DESIGN MY POOL**

The CTA should feel like the natural conclusion of the story rather than an interruption.

---

## 14. Non-negotiable design rules

1. **Emotion before features.**
2. **The pool stays visually premium and believable.**
3. **Character continuity is mandatory.**
4. **No independent AI frame generation for the master sequence.**
5. **Minimal copy.**
6. **No conventional section-stack feeling during the cinematic experience.**
7. **Scroll controls time.**
8. **Reverse scrolling must feel natural.**
9. **Water is the primary transition language.**
10. **Performance is part of the design, not a later optimization.**
11. **V1 proves the core sequence before real-time 3D complexity is added.**
12. **The website should feel like an interactive luxury film, not a template with effects.**
13. **Do not sacrifice conversion clarity for spectacle.**
14. **The emotional promise and visual continuity outrank novelty.**
15. **The first build is a focused prototype of the cinematic hero, not a full-site rewrite.**

---

## 15. Build order

The approved execution sequence is:

### Step A — Storyboard
Define each major shot, camera position, character position, copy moment, transition, and scroll range.

### Step B — Canonical hero image
Create the single visual source of truth for characters, environment, architecture, pool, lighting, wardrobe, and style.

### Step C — Master cinematic motion
Turn the canonical frame into a controlled motion sequence while preserving continuity.

### Step D — Web frame extraction
Extract and optimize the useful sequence frames for desktop, tablet, and mobile.

### Step E — Standalone interaction prototype
Build only the pinned fullscreen scroll sequence:

**pool → run → jump → splash → underwater**

Do not build the rest of the homepage yet.

### Step F — Tune until compelling
The interaction must feel excellent forward and backward.

### Step G — Integrate into Apex
Only after the cinematic prototype works should the rest of the site be designed around it.

---

## 16. Success criteria

The concept is successful when:

- the first frame immediately communicates premium custom-pool quality
- the family moment feels authentic rather than AI-generated or staged
- scroll movement feels direct and responsive
- the jump has enough temporal resolution to feel controllable
- reversing scroll feels natural
- the splash transition hides the scene change cleanly
- underwater imagery feels like a continuation of the same environment
- the site remains fast enough that the effect does not become frustrating
- mobile retains the emotional impact even if the implementation is simplified
- visitors understand that Apex builds premium pools without needing dense copy
- the final experience makes the visitor want to start a project

The qualitative benchmark is simple:

> **The interaction should make people scroll back up just to experience the jump again.**

---

## 17. Strategic rationale

Most pool-builder websites compete with the same ingredients:

- project galleries
- service lists
- generic luxury copy
- quote forms
- stock or inconsistent photography

Apex should differentiate through experience, not just styling.

This concept creates a memorable association between Apex and the emotional outcome of building a great backyard.

The technology exists to serve that story.

The story should never exist merely to demonstrate the technology.

---

## 18. Canonical decision

This cinematic scroll experience is the approved direction for the next-generation Apex homepage.

Future design and engineering work should treat this document as the source of truth for the concept until the owner explicitly replaces or revises it.

**Canonical sequence:**

> **Luxury backyard → father and two sons → run → jump → splash → underwater craftsmanship → transformed Apex environment → conversion.**

**Canonical emotional promise:**

> **Build the backyard they'll remember.**
