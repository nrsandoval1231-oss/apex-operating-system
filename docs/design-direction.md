# Design Direction

The creative spec: what is locked, what is deliberately chosen, and what must never drift. Written after running the research → direct → build → verify → review method against this site.

The short version: **the palette and type are pinned by the brief and stay pinned. The design effort goes into motion, structure, and the signature device — the axes the brief leaves free.**

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

## 2 · Locked (do not restyle)

| Token | Value | Source |
|---|---|---|
| `--char` / `--char2` | `#1B1C1E` / `#25272A` | approved mockup (D-08) |
| `--paper` / `--concrete` | `#F6F4EF` / `#E9E5DE` | approved mockup |
| `--amber` / `--amber-d` | `#E0901B` / `#C67A0C` | brand accent |
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

### The rule this cost us

Motion must be written as **progressive enhancement, never as something that has to be switched off.**

The hero previously read `.anim { opacity: 0; animation: rise … forwards }`, with a global `@media (prefers-reduced-motion: reduce) { * { animation: none !important } }` intended to disable it. Disabling the animation removed the only rule that ever restored opacity — so every visitor with reduced motion enabled got a **blank charcoal box** where the headline, subhead, warranty stats, and router question should have been. On the most important screen of the site, for exactly the users least able to work around it.

It built, it type-checked, it looked perfect in a normal browser, and it was invisible in any screenshot taken without the media query set. AC-6.3 had been marked "implemented" on the strength of reading the code.

**The rule:** content is visible with no animation at all; motion is added inside `@media (prefers-reduced-motion: no-preference)`. Locked by `tests/reduced-motion.spec.ts`, which also asserts the emulation is actually active — a reduced-motion test that silently fails to emulate passes for the wrong reason and is worse than no test.

---

## 5 · Anti-checklist — do NOT

1. **Do not restyle the tokens** without the maintainer and the client. D-08. If real brand hexes arrive, swap and keep everything else.
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

- **D-20 photography.** Nine stock stand-ins. Real project photography is the single biggest available lift to this page — a local buyer recognises stock, and pools is a considered purchase at pool prices. `npm run check:images` prints the shot list.
- **AC-6.4 colour contrast.** Tokens were chosen against AA and the two risky ones have documented safe variants, but no automated audit runs. Worth adding.
- **A second signature moment**, if the site ever needs one — from §3's vocabulary, not from a stock effect.
