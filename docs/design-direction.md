# Design Direction

The creative spec: what is locked, what is deliberately chosen, and what must never drift. Written after running the research → direct → build → verify → review method against this site.

The short version: **type is pinned by the brief. The palette is now pinned by the real logo — sage carries the brand, amber survives only on actions. The remaining design effort goes into motion, structure, and the signature device.**

> **Updated when the real logo arrived.** §1 below was written while the palette was an approximation and amber was treated as the master accent. It isn't — see §1a. The audit is kept rather than rewritten, because how the question was resolved matters more than the conclusion.

---

## 1 · The cliché audit

The most useful question in the method is *"what's the generic version of this brief, and are we accidentally building it?"* Current AI design clusters around three defaults:

1. Warm cream background (≈ `#F4F1EA`) + high-contrast serif + terracotta accent
2. Near-black background + one acid-green or vermilion accent
3. Broadsheet layout, hairline rules, dense newspaper columns

**Apex sits uncomfortably close to a blend of #1 and #2.** Honest accounting:

| Axis | Apex | Verdict |
|---|---|---|
| Paper `#F6F4EF` | Warm off-white, ~1 step from the cliché cream | ⚠ close to default #1 |
| Amber `#E0901B` | Warm orange accent | ⚠ terracotta-adjacent |
| Charcoal `#1B1C1E` hero + single warm accent | | ⚠ default #2 |
| **Oswald** display, not Playfair/Cormorant | Condensed industrial grotesque | ✅ dodges the tell |
| **Four vertical accent colours** (pool/coat/reno/serv) | A functional colour system, not decoration | ✅ specific to this brief |
| Mono capture panel | Data/terminal texture in a contractor site | ✅ unusual, and earned |

### Why it stays anyway

Two reasons, and neither is "we couldn't be bothered."

**The brief pins it.** `frontend-design`'s own rule: *"Where the brief pins down a visual direction, follow it exactly — the brief's own words always win."* D-08 locks tokens to the approved mockup, and `CLAUDE.md` records the palette as approximated from Apex's real charcoal-lion identity. That is a client-approved decision, not a free axis. Restyling it unilaterally would be overstepping.

**It's also correct for the category.** Queried independently for a construction/home-services palette, the `ui-ux-pro-max` database returns *industrial grey + safety orange* — charcoal and amber, arriving at the same place from the other direction. For a contractor in West Texas whose buyers are homeowners, this reads as *trade*, not as *AI*. The cliché overlap is real but incidental.

**What would change this:** if the maintainer supplies Apex's real brand hexes or logo file, those override (per `CLAUDE.md`). That is the moment to revisit — with the client, not in a commit.

---

## 1a · The real logo arrived, and the audit above was wrong on one axis

The maintainer supplied `Apex-Site-Logo-2x.png`. Sampled directly from the file rather than eyeballed:

| Colour | Hex | Share of the mark |
|---|---|---|
| Sage | `#A1CCCA` | 56.6% |
| Charcoal | `#383C3D` | 3.9% |
| White | `#FFFFFF` | 4.4% |

**There is no amber in Apex's identity at all.** The palette was an approximation from the pitch deck, and it guessed the accent wrong — not slightly, but to the opposite temperature. §1 spent its effort defending a warm accent that was never the brand's.

That is worth stating plainly, because the lesson generalises: the cliché audit was a good question asked against bad data. Sampling the actual asset took one command and settled in seconds what a paragraph of reasoning could not.

### The two-accent system (the maintainer's call: sage primary, amber demoted)

A straight find-and-replace was not an option — raw sage is **1.59:1 on paper**, unusable as text. So the accents were split by *job*, and each colour has a rule:

- **SAGE is brand *and* the call to action.** Eyebrows, the hero accent phrase, warranty badges, guarantee stats, hover states, the capture panel's cursor — and every button.
- **AMBER is interaction feedback and alerts.** Four jobs only: focus rings, the consent checkbox's checked state, the phone link in the form's error state, and star ratings.
- **One of those is load-bearing.** Now that buttons are sage, a sage focus ring would be invisible against them. Amber is what keeps keyboard focus legible on a sage control — that is why it survives at all, not sentiment.
- **Star ratings** are the documented exception: gold stars read as a *rating* convention, not as brand colour.

**The test for drift:** if amber appears somewhere you don't click, it has drifted. Use sage.

### The button has two surfaces, and it must

Full brand sage is only **1.39:1 against `--concrete`** and **1.59:1 against `--paper`**. WCAG 1.4.11 asks 3:1 for a UI component's boundary, so a single sage button fails on every light section — it visually stops being a button. The fix is not a border; it is a second surface:

| Context | Fill | Text | Shape contrast |
|---|---|---|---|
| Light sections (default) | `--sage-ink` `#2F6B68` | `--paper` | 4.89:1 concrete · 5.58:1 paper |
| Dark sections (header, hero, vhero, #quote) | `--sage` | `--char` | 9.75:1 |

Ghost buttons follow the same split for the same reason. **Do not "simplify" this back to one button** — the light-background case is the one that silently fails, and it's where the pools and owner CTAs live.

---

## 2 · Locked (do not restyle)

| Token | Value | Source |
|---|---|---|
| `--char` / `--char2` | `#1B1C1E` / `#25272A` | approved mockup (D-08) |
| `--paper` / `--concrete` | `#F6F4EF` / `#E9E5DE` | approved mockup |
| `--sage` / `--sage-ink` | `#A1CCCA` / `#2F6B68` | **the real brand accent** — sampled from the logo |
| `--brand-char` | `#383C3D` | the logo's own charcoal |
| `--amber` / `--amber-d` | `#E0901B` / `#C67A0C` | **action only** — CTAs, focus, form affordances (§1a) |
| `--pool` `--coat` `--reno` `--serv` | `#0E6E7C` `#46586B` `#A9632F` `#3E9B5F` | the vertical enum, colour-coded |
| Display / body / utility | Oswald / Inter / JetBrains Mono | approved mockup |

The type system already does what the method asks: three roles, distinct jobs, not one Google font doing everything. The `--amber-eyebrow` and `--serv-text` variants exist purely to clear WCAG AA — keep that discipline when adding colours.

---

## 3 · The signature device

Every premium site has one memorable thing. Apex's is **the lead-intake panel** — the mono, terminal-styled capture confirmation that shows the visitor their request being tagged and routed (`service:`, `routed_to:`, `reference:`).

It works because it is *the product idea made visible*. This entire project exists because leads were arriving untagged and unattributable. The panel makes the fix legible to the customer: you can see your request being handed to the right crew. It also does real work — it is the AC-4.2 success state, not decoration.

**Keep it the loudest element on the page.** Everything else stays quiet so it can be loud. Chanel's rule applies: before shipping a new flourish, remove one.

### Vocabulary worth mining later

Apex's world has more UI material in it than has been used: quantity takeoffs, dimension lines, spec callouts, punch lists, warranty stamps, caliche soil profiles. The repo literally contains a reverse-engineered takeoff of a real job. If the site ever needs a second signature moment, that is where to look — **not** a generic parallax or a WebGL distortion, which would say nothing about Apex.

---

## 4 · Motion policy

**Decision: CSS-only, progressive-enhancement motion. No Lenis, no GSAP, no Three.js.**

Not dogma — a fit judgement, and the reasoning should be relitigated if the situation changes:

- **The buyers are homeowners on phones**, often on rural West Texas connections. A momentum-scroll library that hijacks native scrolling is a downgrade on touch, and WebGL is dead weight on a mid-range Android.
- **AC-5.1 requires Lighthouse ≥ 90 mobile.** The current site ships ~9 KB of JS (one form island). Lenis + GSAP + Three.js is ~150 KB before a single effect.
- **Astro was chosen precisely for zero-JS-by-default** (D-04). Adding three animation runtimes contradicts the reason the framework was picked.
- **The job of this page is conversion, not applause.** The method's own rule — *"restraint is the whole game"*, *"max one signature motion per screen"* — points the same way.

What is allowed: CSS transitions on `transform`/`opacity`/`clip-path` only, entrance and hover states, and `IntersectionObserver` scroll reveals if a section ever needs one.

### The one exception: the hero video

Added 2026-07-29, and it does not contradict the policy above — it clarifies it. **The objection was never "motion"; it was "runtime and payload spent on effects that say nothing about Apex."** A background video of a completed Apex pool at night is the opposite trade: no library, no runtime, and it is real project footage — the thing this site has been shortest of.

It is built as the live site's version should have been. Theirs: `<video preload="auto" autoplay playsinline loop muted>` — 2.23 MB, no poster, no dimensions, no viewport gate, then covered by a flat 64% black scrim. Full price, fraction of the value, and LCP waiting on the whole file.

Ours:

| | |
|---|---|
| Poster | A real still, ~41 KB, `fetchpriority="high"`, painted immediately. **The page is complete without the video.** |
| Video | `preload="none"`, no `src` in markup — attached only after `load` |
| Gates | Skipped entirely on reduced motion, on viewports ≤ 860 px, and on `saveData` / 2g / 3g |
| Size | 593 KB — trimmed from 15s to a 5.6s pool-only loop, boomeranged so the pan loops seamlessly |
| Scrim | Lighter than theirs, and weighted to the bottom where the text sits — a contrast requirement, not a mood |

A phone downloads **zero bytes** of it. Asserted in `tests/hero-video.spec.ts`, because every one of those properties is one careless edit from regressing and the regression is invisible on a fast desktop.

**If you add video anywhere else, it follows these rules or it doesn't ship.**

### The rule this cost us

Motion must be written as **progressive enhancement, never as something that has to be switched off.**

The hero previously read `.anim { opacity: 0; animation: rise … forwards }`, with a global `@media (prefers-reduced-motion: reduce) { * { animation: none !important } }` intended to disable it. Disabling the animation removed the only rule that ever restored opacity — so every visitor with reduced motion enabled got a **blank charcoal box** where the headline, subhead, warranty stats, and router question should have been. On the most important screen of the site, for exactly the users least able to work around it.

It built, it type-checked, it looked perfect in a normal browser, and it was invisible in any screenshot taken without the media query set. AC-6.3 had been marked "implemented" on the strength of reading the code.

**The rule:** content is visible with no animation at all; motion is added inside `@media (prefers-reduced-motion: no-preference)`. Locked by `tests/reduced-motion.spec.ts`, which also asserts the emulation is actually active — a reduced-motion test that silently fails to emulate passes for the wrong reason and is worse than no test.

---

## 5 · Anti-checklist — do NOT

1. **Do not restyle the tokens** without the maintainer and the client. D-08. The sage/charcoal values now come from the real logo and are not up for reinterpretation.
1a. **Do not use amber for anything you don't click.** It is the action colour, not a brand colour (§1a). The one exception is star ratings.
1b. **Do not put raw `--sage` on a light background as text** — 1.59:1, invisible. Use `--sage-ink`.
2. **Do not add a second loud element.** The capture panel is the signature. Anything competing with it gets cut.
3. **Do not add an animation runtime** (Lenis / GSAP / Three.js) for a marketing page whose buyers are on phones. See §4.
4. **Do not write motion that must be disabled.** Default to visible; enhance under `no-preference`. See §4.
5. **Do not use a coloured box where a photo belongs.** Every image goes through `<ImageSlot>` from the manifest, at a fixed ratio. Stock stand-ins are flagged `stock: true` and never claim to be Apex's work.
6. **Do not let a CTA fall below 44 px on mobile.** The three vertical-card links shipped at 26 px. Asserted now.
7. **Do not use numbered markers unless the content is genuinely a sequence.** The pools `01–04` process is a real ordered process, so it earns them. A numbered list of *services* would not.
8. **Do not add a font.** Three roles is the system; a fourth face is a smell.

---

## 6 · What the review pass actually caught

Kept as evidence that the review step is not ceremony. None of these are visible in a screenshot:

| # | Finding | Severity |
|---|---|---|
| 1 | Reduced motion blanked the entire hero (§4) | **Critical — a11y** |
| 2 | Three vertical-card CTAs were 26 px tall on mobile; the pools link 23 px | Moderate — a11y |
| 3 | Four home router tiles were `loading="eager"` while below the fold, competing with the hero for bandwidth | Moderate — perf |
| 4 | The Astro dev toolbar injects its own `<h1>` into dev pages, polluting test queries | Low — test integrity |
| 5 | A reduced-motion test that passed without the emulation applying | Low — test integrity |

Items 3–5 were found by tests written during this pass; item 1 was found by probing the page under an emulated media query rather than trusting the CSS.

---

## 7 · Open

- **D-20 photography — now 5 real, 4 stock.** Apex's own hero footage supplied real imagery for pools and coating; the owner portrait is a real photo of Travis. What remains stock is **Design & Renovation and Pool Service**, both verticals — the video covers neither. `npm run check:images` prints the shot list.
- **A high-resolution pool photograph.** The pools hero is real Apex work but cut from 720p footage, so its 4:5 crop is only 576×720 — about 1x for where it renders. It is the top item on the shot list.
- **Raw footage from Travis**, if it exists. The 2.23 MB web copy was enough for a hero loop and five stills; the originals would likely clear the whole remaining shot list without a photo shoot.
- **AC-6.4 colour contrast.** Every sage pairing was measured against AA before it shipped (§1a, §2a), but there is still no automated audit that would catch a future regression. Worth adding.
- **An SVG or EPS of the logo.** The supplied PNG is correct and 2x, so it is crisp everywhere it currently appears, but a vector has no ceiling and would drop ~10 KB.
- **A Lyon Financial partner/referral URL.** `PUBLIC_FINANCING_URL` currently points at Lyon's public site and attributes the referral to nobody.
- **Naming the second person** in the owner portrait, if they're happy to appear — the alt text names only Travis until then.

---

## 8 · Parked ideas

Not scheduled. Recorded so they don't have to be re-derived, with enough detail to act on.

### 8.1 · The CSS-only motion pass — *parked 2026-07-29, ready to build*

**Roughly an hour, fully reversible, no dependencies.** The goal is "expensive site" polish without contradicting §4's motion policy — no Lenis, no GSAP, no Three.js, no runtime.

Three effects, in priority order:

1. **Scroll reveals.** Sections fade and rise ~16 px as they enter. Use `IntersectionObserver` with a `.is-in` class, or CSS `animation-timeline: view()` where supported. Reuse the existing `rise` keyframes so it matches the hero's easing rather than inventing a second motion language.
2. **Parallax on the pools hero image.** The single tallest image on the page and the highest-ticket vertical. `transform: translate3d()` driven by a scroll listener — `transform` only, never `top`/`margin`.
3. **A slight 3D tilt on the four router tiles** as the pointer moves — `rotateX/rotateY` of 2–4°, `perspective` on the container. Pointer-only; must be inert on touch, where it would fight the tap.

**Non-negotiable constraints** (these are what make it safe, not garnish):

- Written as progressive enhancement inside `@media (prefers-reduced-motion: no-preference)`. Content must be fully visible and correctly positioned with every effect switched off — see §4 for the bug that rule exists to prevent.
- `transform` and `opacity` only. Never animate layout properties on scroll.
- Extend `tests/reduced-motion.spec.ts` to cover the new elements, and re-check that no below-the-fold image becomes eager (AC-9.5).
- **Max one signature motion per screen** (§4). If the tiles tilt *and* the section reveals *and* the hero parallaxes in one viewport, remove one.

**Do not let this grow into a motion framework.** If it needs a library, it has stopped being this idea.

### 8.2 · 3D that would actually sell — *speculative*

Distinct from 8.1, and a much larger piece of work. Ambient WebGL was rejected in §4 and stays rejected; this is the opposite case — 3D doing sales work rather than decoration:

- **A pool configurator** — shape, size, spa, decking — that ends by pre-filling the quote form with the configuration. It would earn its payload because a pool is a considered purchase people want to *see* before committing, and it would feed the lead spine rather than sitting beside it.
- **A backyard before/after slider.** Cheaper, and needs no 3D at all — worth trying first, and it is gated on the same thing everything else is: real project photography (D-20).

Both are only worth costing once there is real photography and real lead volume to justify the build.
