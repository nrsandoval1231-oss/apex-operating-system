# Homepage V2 — Architecture

**Status:** SHIPPED (design/code) · **Photography:** pending (D-20)
**Branch:** `feat/homepage-v2` · **Baseline:** tag `pre-homepage-v2` (`2ebb470`)

> **Homepage V2 design/code complete — final proprietary photography and brand film pending.**
>
> Every image on the home page is a licensed stock placeholder. The layout, typography, motion
> and responsive behaviour are finished; the *content* is not final and must not be described as
> launch-ready. See [Photography workstream](#photography-workstream) below.

---

## 1. What this is

The home page was rebuilt from first principles. The previous one is described in
[§ What was retired](#3-what-was-retired).

**The narrative spine**, fixed and asserted by test:

```
DESIRE → EMOTION → CRAFTSMANSHIP → PROOF → TRUST → CAPABILITY → CONVERSION
```

| # | Section | Beat | Component |
|---|---|---|---|
| 01 | Hero | Desire | `components/home/Hero.astro` + `HeroMedia.astro` |
| 02 | Beauty above / engineering beneath | Craftsmanship | `components/home/Craft.astro` |
| 03 | The work | Proof | `components/home/Showcase.astro` |
| 04 | Outdoor living | The world | `components/home/Living.astro` |
| 05 | The Apex Standard | Trust | `components/home/Standard.astro` |
| 06 | Four specialties | Capability | `components/home/Capability.astro` |
| 07 | Process + close | Conversion | `components/home/Close.astro` |

The order is load-bearing: the emotional promise is made first and only proven at the end. That
inversion is what allows the page to work with a static hero and no film.

---

## 2. Architecture

### Content is separate from layout

All copy lives in `src/content/home-v2.ts`; all imagery is declared in
`src/content/images.ts` with a fixed aspect ratio, alt text and `srcset`. Editing the page's
words or swapping a photograph is a **content change**. No component or CSS change is involved
in either — the same property the site has had since D-20, and the reason the photography
workstream is cheap when it happens.

### The hero media interface

`src/content/hero-media.ts` is the single place that decides how the hero background behaves.
Three states, one component:

| Mode | State | Status |
|---|---|---|
| `poster` | a still `<img>` | **shipped** |
| `playback` | one continuous approved `<video>` | designed, not built |
| `scrub` | the same video, driven by scroll | designed, not built |

Promoting to video later is a config change, not a rebuild:

```ts
heroFilm.src = '/film/apex-brand-film-1080p.mp4';   // mode: 'playback'
```

**Rules that make this hold, and that are enforced in code:**

- The poster is the LCP element in *every* state. Adding video layers onto an image the browser
  is already fetching cannot regress the metric.
- `mode` is an explicit union. Setting a mode whose film is `null` **throws at build time**
  rather than silently rendering a poster forever.
- `scrub` is deliberately **not stubbed**. A `mode` that is accepted but ignored is a promise
  the code does not keep, and a half-built scrub path is exactly the accumulated complexity this
  rebuild exists to remove.

**One video, not a frame sequence.** D-22 originally specified scroll-scrubbed canvas frames.
That is still the right mechanism, but frames are only coherent if they come from ONE approved
master clip — independently generated frames drift in faces, wardrobe, pool geometry, lighting
and camera. So the source of truth is `film.src`, a single continuous clip. If scrubbing is
wanted later, frames are extracted **deterministically from that file** by a build step.

### Zero client JavaScript

The visual system ships no JS. The only script bundles on the home page are the pre-existing
ones: the attribution capture, analytics, and the quote-form island. No animation library was
added — the page's motion is one CSS keyframe on the hero image plus the existing `.anim`
entrance, both written as progressive enhancement.

Enforced in two places: `tests/homepage-v2.spec.ts` (browser) and `scripts/validate.mjs`
(the production bundle).

---

## 3. What was retired

There was **no cinematic implementation to quarantine.** The four most recent commits before this
branch (`07d287b`, `c30a8fd`, `caec51c`, D-22) are markdown only — the vision and storyboard
documents. The home page was still the original eight-section Astro stack. No cleanup workstream
was manufactured.

Deleted as part of the rebuild (all recoverable from `pre-homepage-v2`):

| File | Why |
|---|---|
| `components/Hero.astro` | the four-tile router hero |
| `components/PoolsSection.astro` | homepage-only card section |
| `components/MoreVerticals.astro` | three-card grid; replaced by the capability index |
| `components/Owner.astro` | folded into `home/Standard.astro` |

Kept, because `pages/[vertical].astro` still uses them: `VerticalHero`, `Faq`, `GuaranteeBand`,
`Testimonials`, `QuoteSection`, `Footer`, `Header`, `ImageSlot`, `Logo`, `Analytics*`,
`LegalDocument`.

Dead CSS removed from `global.css` alongside them: `.router`, `.tiles`, `.tile`, `.pool-grid`,
`.vstripe`, `.process`, `.pstep`, `.badge`, `.fin`, `.three`, `.vcard`, `.minibadge`, the old
`.hero` visual block, and the full-bleed SVG `.grain`. Retained: `.featlist`, `.tlink`,
`.hero-stats`/`.hstat`, `.img-slot` and the tone textures — all still used by the vertical pages.

### One real bug this surfaced

The global stylesheet targeted the site chrome with a bare element selector, `header { … }`.
Homepage V2 uses a semantic `<header class="sec-head">` for each section intro — correct HTML —
which that selector also matched, painting every section heading the charcoal navigation
background and dropping the body copy under it below contrast. Fixed by scoping to
`body > header`, which targets the one element the rule was written for. The full-page
screenshot review is what caught it; typecheck, build and unit tests were all green.

---

## 4. The four verticals

Apex is **not** becoming pools-only. The four verticals are still first-class, and none of the
home page's links to `/coating`, `/renovation` or `/service` were lost.

The old hero's four-tile router was the *only* set of links from the home page to those three
pages, so removing it wholesale would have orphaned three live pages with real SEO. The
replacement is **Section 06 (Capability)** — a typographic index rather than a card grid. Each
entry keeps both actions the old cards had:

- a link to the vertical's landing page, and
- a link to `#quote` carrying `data-preselect`, so the form opens with the right vertical chosen
  (the AC-2.2 contract, unchanged — it is read at click time by `QuoteSection`'s inline script).

Reachability is asserted in three independent places: `homepage-v2.spec.ts`, the rebuilt
`lead-capture.spec.ts` AC-2.1, and `validate.mjs` against the built HTML.

---

## 5. Truthfulness constraints

There is no real Apex photography (D-20), so:

- Every V2 slot is flagged `stock: true`.
- **No alt text claims stock imagery is Apex's work.** `tests/imagery.spec.ts` fails the build
  if any stock image's alt matches `/apex/i` or `/travis/i`. The alts describe what the
  photograph shows and stop there.
- **No project is named.** Section 03's `label`/`type` describe the *image* ("Dusk environment",
  "Custom pool with raised spa"), not a job, a location, or a client. When real projects are
  documented, those strings become names — a content-only change.
- Section 03's `features` are written as capabilities, not as claims about a specific pool.
- `owner-portrait` is the one genuine Apex photograph, so its alt does name Travis. The
  manifest records why that is only correct for that slot.

---

## 6. Validation

```bash
pnpm validate        # the one command: typecheck → production build → dist/ assertions
pnpm test            # Playwright, 154 tests
```

**`pnpm validate` exists because the previous validation path was misleading.** The repo root's
`pnpm build` runs `tsc -b`, which never builds the site — it passes identically if
`src/pages/index.astro` does not exist. It is not evidence that the website builds.
`scripts/validate.mjs` runs `astro check`, then a real `astro build`, then asserts against
`dist/`: every route built, all seven sections present, exactly one `<h1>`, the hero rendering
in its declared mode, no `<video>` before a film exists, all four verticals linked, every
internal link and image resolving, and the client-JS budget.

`preflight` is deliberately a **report** inside `validate`, not a hard step: its blockers are
environment-dependent facts about a deployable bundle (a non-production `robots.txt`, an
uninlined webhook URL) that say nothing about whether the code is correct, and two of them are
standing blockers on the base branch. `preflight` remains the **deploy** gate.

**Results at time of writing:** `astro check` 0 errors · production build 7 pages ·
`validate` all dist assertions passing · Playwright **154/154** · no console errors at 1440 /
820 / 390px · no horizontal overflow at any of the three widths.

### Tests changed, and why

Old test assumptions about the retired UI were replaced rather than worked around. No obsolete
UI was preserved to keep a test green.

| Test | Change |
|---|---|
| `reduced-motion.spec.ts` | "four router tiles" → asserts every home CTA is visible and ≥44px, the capability index has 4 visible links, and the hero poster renders. The *requirement* (accessible reduced-motion behaviour) is preserved; the obsolete implementation is not. |
| `lead-capture.spec.ts` AC-2.1 | tile count → the capability index's four `data-preselect` links, asserted in enum order. |
| `lead-capture.spec.ts` testimonials | three-card grid CSS → the V2 pull-quote is present, attributed, and a real `<blockquote>`. |
| `lead-capture.spec.ts` financing | two copies → one (the other belonged to the deleted `PoolsSection`); now also asserts `rel="noopener"`. |
| `lead-capture.spec.ts` AC-1.2 | `test.setTimeout(120_000)` — it does four full navigations and four hydrations in one body and was exceeding the 30s default on the longer page. Per-assertion timeouts are unchanged. |
| `homepage-v2.spec.ts` | **new** — section order, single `<h1>`, vertical reachability, hero media contract, no horizontal overflow at three widths, client-JS budget. |

Two genuine bugs were caught by `AC-9.1` and fixed rather than suppressed: the full-bleed bands
and the mobile founder portrait were overriding `aspect-ratio`, which silently removes the
no-layout-shift reservation. Both now cap height with `max-height` and re-frame with
`object-position` instead.

---

## 7. Photography workstream — pending

**This page is not launch-ready and must not be described as such.** It is design/code complete.

Required before launch:

1. **A commissioned half-day shoot at a completed pool** (D-20 option (a) — strongly preferred
   for Designer Pools). Pools is the highest-ticket vertical and the least documented, and real
   project photography is the primary conversion asset at this price point.
2. Replace each V2 slot in `content/images.ts`: drop the file in, clear `stock: true`, **and
   rewrite the alt text in the same edit** — the current alts are truthful only because they
   do not claim the work is Apex's.
3. Name the real projects in `home-v2.ts` (`showcaseV2.projects`) once documented.
4. Set `PUBLIC_OG_IMAGE` (1200×630) — currently unset, so shared links render as bare text cards.
   Blocked on D-20.

The brand film is a **separate workstream** and does not block this page. See
`cinematic-homepage-vision.md` for the concept and `cinematic-homepage-storyboard.md` for shot
planning; both remain the source of truth for the film. The homepage architecture above is
built so the film can be dropped in without touching the page.

### Swapping the hero for the film, when it exists

1. Produce one continuous master clip.
2. Put it at `public/film/`, set `HERO_MEDIA.film`, set `mode: 'playback'`.
3. `pnpm validate` — the `no <video>` assertion must be relaxed at that point, deliberately.
4. Optional: extract frames deterministically from the same clip for a scroll-scrubbed hero.
