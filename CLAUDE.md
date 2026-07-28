# CLAUDE.md — Apex Website

You are building the marketing website for **Apex** (Lubbock, TX), a single brand with **four service verticals**. This file is loaded on every task. Read `docs/prd.md` before starting work and `docs/decisions.md` before making any choice that isn't already specified here.

The job of this site is two things, in order: (1) route a visitor to the correct vertical, (2) **capture every lead with a vertical + source tag** so conversion and ad spend can be measured per vertical. Everything else is secondary.

---

## Hard rules — never break

1. **Every lead submission MUST carry a `vertical` and the full attribution set** (`source`, `medium`, `campaign`, `landing_page`, `gclid`/`fbclid` when present). A form that submits without a resolved `vertical` is a bug, not an edge case. See `docs/data-contract.md`.
2. **`lead_id` is the join key.** It is generated once at submission, returned to the client, and travels with the lead everywhere downstream (n8n, CRM, Meta offline conversions). Never regenerate it.
3. **Four verticals, exact names, exact order:** `Designer Pools`, `Concrete Coating`, `Design & Renovation`, `Pool Service`. These strings are an enum. Do not rename, abbreviate, or reorder them anywhere — they are used as keys.
4. **Consent text is per-vertical and legally load-bearing.** The SMS consent disclosure must name the brand for the *selected* vertical, never a hardcoded one. Getting this wrong is a TCPA exposure, not a copy nit.
5. **No secrets in the repo.** n8n webhook URLs, API keys, and tracking IDs come from environment variables. Never commit them.
6. **Do not send real outbound messages or fire real conversions from any test or preview build.** Point non-production builds at a test webhook.
7. **When a decision in `docs/decisions.md` is marked `⚠ BLOCKED`, stop and surface it.** Do not invent an answer. Build everything around it that you can, leave a clearly-marked `TODO(BLOCKED: <id>)`, and move on.

---

## Stack (decided — confirm with maintainer before changing)

- **Framework:** Astro. This is a content-first marketing site where SEO and load speed are the point; Astro ships zero JS by default and renders static HTML. Recommended over Next.js (heavier, SSR not needed here) and over staying on WordPress (Monsoon is being replaced).
- **Interactivity:** React islands (`client:visible`) only where needed — the quote form and its capture behavior. The rest of the site is static.
- **Styling:** plain CSS with custom properties (design tokens below). No Tailwind unless the maintainer asks. Match the token values in `reference/apex-mockup.html` exactly.
- **Content:** vertical copy, testimonials, and service lists live in Markdown/MDX or a `content/` data file, not hardcoded in components, so they can be edited without touching layout. (See `docs/decisions.md` D-07 — a headless CMS may be added later.)
- **Forms → n8n:** the quote form POSTs JSON to an n8n webhook (env var `PUBLIC_LEAD_WEBHOOK_URL`). n8n owns routing, auto-response, and CRM write. The site's only job is to capture and tag correctly.
- **Deploy target:** static output, hostable on the maintainer's existing Hostinger environment or Vercel/Netlify. Keep the build output a static bundle.

## Design tokens (from the approved mockup — do not restyle from scratch)

```
--char:#1B1C1E   --char2:#25272A   --steel:#54585E
--concrete:#E9E5DE  --paper:#F6F4EF  --line:#D4CFC5
--amber:#E0901B  (master accent)   --amber-d:#C67A0C
vertical accents:  pool #0E6E7C   coat #46586B   reno #A9632F   serv #3E9B5F
display/headers: Oswald   body: Inter   data/mono: JetBrains Mono
```

The palette is approximated from Apex's charcoal-lion identity. If the maintainer supplies the real brand hexes or logo file, those override — swap and keep everything else.

---

## What "done" means

Work is not done until it passes `docs/acceptance-criteria.md`. Those are written as checkable assertions. Run them (or walk the manual checklist) before reporting a task complete. If you added a feature with no corresponding acceptance criterion, add one.

## Map

- `docs/prd.md` — the work order: scope, phases, task breakdown, dependency graph
- `docs/data-contract.md` — the lead object schema and attribution capture rules (the spine)
- `docs/acceptance-criteria.md` — pass/fail assertions; definition of done
- `docs/decisions.md` — locked decisions and `⚠ BLOCKED` gates that need a human
- `docs/redirect-map.md` — old→new URL parity plan for cutover (Phase 4/5; BLOCKED on D-03)
- `.env.example` — every credential the build needs. Copy to `.env` before starting.
- `reference/apex-mockup.html` — the approved visual + interaction spec. Open it. The final build should match its layout, copy, and the capture-panel behavior. It is vanilla HTML; your job is to rebuild it in the stack above, not to ship it as-is.

## Out of scope for this repo

CRM platform, commission engine, job costing, and the QuickBooks integration are **separate projects**, gated on decisions this repo does not own. Do not build them here. This repo ends at "tagged lead handed to the n8n webhook."
