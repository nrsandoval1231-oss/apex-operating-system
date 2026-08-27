# PRD — Apex Website (work order)

Read `../CLAUDE.md` and `data-contract.md` first. This document is the scope and sequence. It is written to be executed, not pitched.

## Goal

Replace the current WordPress site (built by Monsoon) with a fast, SEO-clean, four-vertical marketing site whose primary function is **capturing correctly-tagged leads**. The approved look, copy, and the signature capture interaction are specified in `reference/apex-mockup.html`.

## Non-goals (do not build here)

CRM, commission engine, job costing, QuickBooks sync, Meta offline-conversion upload, paid-ad management. This repo ends at the n8n webhook handoff.

---

## Build phases

Phases are ordered by dependency. Do not start a phase whose predecessor's acceptance criteria are unmet.

### Phase 1 — Scaffold + data spine
The attribution layer is built **first**, before pages, because every page feeds it.
- Astro project scaffold, design tokens from the mockup as global CSS custom properties, font loading (Oswald / Inter / JetBrains Mono).
- Attribution capture module (`src/lib/attribution.ts`): first-touch capture, session persistence, source/medium resolution per `data-contract.md`.
- `lead_id` generator.
- Vertical config as a single typed data file (`src/content/verticals.ts`) — the enum, consent brand names, campaign defaults. Everything else imports from here.

### Phase 2 — Static pages + router
- Home with the four-vertical router (the hero). Color-coded per the tokens.
- Pools page/section built **deep** (process, features, warranty, financing, dedicated CTA).
- Coating, Renovation, Service built **shallow** — one section each.
- Guarantee band, testimonials, owner section, footer.
- All vertical copy and testimonials sourced from `content/`, not inlined.
- Responsive to mobile; the maintainer and the client will both open this on a phone first.

### Phase 3 — Quote form + capture (the signature feature)
- React island: service selector (4 options, pre-selectable via CTA), contact fields, per-vertical consent line that updates live.
- On submit: assemble the full lead object, generate `lead_id`, POST to `PUBLIC_LEAD_WEBHOOK_URL`, handle success/failure states with real messaging (see `frontend-design` copy rules: errors explain what to do).
- The capture-confirmation panel from the mockup is a real success state here (showing the user their request was received and routed) — keep the interaction, drop the "demo" framing.

### Phase 4 — SEO + analytics wiring
- Per-vertical `<title>`/meta/OG, semantic headings, sitemap, robots.
- One canonical domain; 301 map for the two legacy domains (`apexdesignandrenovation.com`, `apexcoatinglbk.com`) → new canonical paths. **See D-03 — which domain is canonical is BLOCKED on the maintainer.**
- GTM container + GA4 events: `lead_submit` fires with `vertical` and `source` as parameters. Reuse the existing GTM container ID if the maintainer provides it (one exists: GTM-WSHKQ3X).
- Google Business Profile is out of scope for the repo but note it in the launch checklist.

### Phase 5 — Launch prep
- Access/DNS checklist (see `decisions.md` D-01 — must confirm domain, hosting, GTM, GA4, Meta ownership are transferred from Monsoon *before* cutover).
- URL parity map old→new so existing rankings survive migration.
- Redirect verification.

---

## Task dependency graph

```
Phase 1  (spine) ─────────────┬──────────────┐
   │                          │              │
   ▼                          ▼              ▼
Phase 2 (pages)          Phase 3 (form)   Phase 4 (SEO/analytics)
   │                          │              │
   └──────────┬───────────────┴──────────────┘
              ▼
        Phase 5 (launch)  ← gated on D-01 access + D-03 canonical domain
```

Parallelizable once Phase 1 lands: pages (2), form (3), and analytics wiring (4) don't depend on each other. Phase 5 depends on all three plus two human decisions.

## Human-gated items (agent must stop, not guess)

These live in `decisions.md`. Summary of what blocks launch:
- **D-01** access transfer from Monsoon (domain, hosting, GTM, GA4, Meta) — blocks cutover
- **D-03** which domain is canonical — blocks the 301 map
- **D-07** content editing model (git vs headless CMS) — does not block launch, but decides whether Phase 2 content lives in the repo or a CMS

Everything else can be built to completion without a human.

## Reference

`reference/apex-mockup.html` is the approved design and interaction spec. Rebuild it in Astro/React per the stack in `CLAUDE.md`. Match layout, tokens, copy, and the capture behavior. It is not production code — it's the target.
