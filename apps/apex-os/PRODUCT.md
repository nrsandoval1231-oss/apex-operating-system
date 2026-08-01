# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**One primary user: the owner of Apex Designer Pools (Travis).** Confirmed
2026-07-31 — during the pilot, he is the only person who opens this app.

His situation: a pool builder running three to five concurrent pool builds in
Lubbock, Texas. He reads this on a phone, one-handed, outdoors in direct sun, at
the start of the day and in gaps between jobs. He is not at a desk and is not
looking for a dashboard.

His job: find out what needs him today, decide, and get on with it.

Other roles exist in the system and hold real authority — superintendent
(runs gates in the field, signs off non-money gates), office (confirms invoices),
field (captures evidence) — but they work through the separate Gate field
console, not this app. If they ever adopt this app, that is a later decision and
this record must be updated rather than assumed.

## Product Purpose

Apex OS is the daily control system for Apex Designer Pools. It turns each pool
build into a sequence of verified gates, surfaces only the decisions that need a
person, and connects completed work to billing readiness.

This app is its owner-facing surface. Success is Travis relying on it as the
daily operating view — and a morning that is quieter because of it.

It answers four questions every morning (PRD §1):

1. What needs attention today?
2. Which jobs are at risk?
3. What work is ready to proceed?
4. What work is ready to bill?

## Positioning

The **gate**: every project has a current state, a next gate, evidence required
to pass it, and operational or financial consequences attached to that gate. A
general CRM or construction suite tracks tasks; this refuses to let work proceed
without verified prerequisites, and turns a passed gate directly into billable
money.

It is deliberately not a CRM, an accounting package, or a full
construction-management suite. QuickBooks stays the financial authority.

## Operating Context

- Nine confirmed construction phases per pool, from design and permitting to
  plaster and water fill.
- Seven gate templates; four release draws. Pre-gunite takes two signatures
  because gunite buries its own evidence.
- Draw schedule fixed by Apex's contract: 10 / 30 / 30 / 20 / 10.
- Six customer-facing milestones collapse the nine internal phases.
- Evidence is photos taken on a phone at a jobsite, hashed and stored privately.
- The separate Gate field console at `/` on the API host is where evidence
  capture and gate sign-off happen.
- Authority for all of the above: `docs/decisions/construction-model.md`,
  confirmed 2026-07-31.

## Capabilities and Constraints

**Built and working:** action-card feed derived from stored state, project and
phase records, seven gate templates with two-signature release, draw schedule
with ready-to-bill and human invoice confirmation, customer-safe milestone
projection.

**Not built:** inspections (blocked on Apex's inspection list and lead times),
scheduled visits and crew-conflict detection, customer progress page, daily
brief, snooze/delegate/acknowledge on cards, QuickBooks synchronisation.

**Technical constraints:**

- React 19 + Vite, no UI framework, no CSS framework. Hand-written CSS.
- All data comes from the loopback Gate API. This app holds no database and
  mints no credentials.
- Authentication is a pasted short-lived pilot JWT. Production identity is a
  known launch blocker, not a design problem to solve here.
- Screens never fall back to sample data. A failed or empty load says so
  explicitly, because inventing a pool inside a system built for trustworthy
  field evidence is the one unforgivable bug.

## Brand Commitments

Binding, from `apex-website/src/styles/global.css` — the approved Apex design
system:

- **Charcoal** `#1b1c1e` — the base.
- **Sage** `#a1ccca` — the brand accent, sampled from the Apex logo. Carries
  identity and primary action.
- **Amber** `#e0901b` — interaction feedback and alerts **only**. Never brand,
  never the default CTA. If amber appears outside alerts and focus, it has
  drifted.
- Vertical identity for pools: `#0e6e7c`.

User-pinned 2026-07-31: dark, high-contrast, reads in direct sun, feels like
equipment rather than a website.

## Evidence on Hand

- Real pilot data in the local dev database: two jobs, one with the genuine
  Whitaker contract value of $152,041.73 and a real approved takeoff revision.
- Real gate templates, phases, and draw percentages from Apex's own contract.
- **No real photography.** Nine photography slots on the website remain
  unfilled; this app must not fabricate jobsite imagery.
- No customer testimonials, benchmarks, or pricing claims exist. Do not invent
  any.

## Product Principles

1. **Action before information.** The home screen shows what needs deciding, not
   a wall of metrics.
2. **Every card states its consequence.** What to do, why it matters, what
   happens if it waits. A card that cannot say all three should not exist.
3. **Never invent a fact.** Missing data says "not recorded". A figure the
   system does not have is never printed as zero.
4. **Gates before tasks.** A controlled transition with evidence and
   consequences outranks a checkbox.
5. **One glance, one thumb.** If it cannot be understood in a glance and acted
   on with a thumb in sunlight, it is not finished.

## Accessibility & Inclusion

- Direct sunlight is the design condition, not an edge case. Contrast targets
  exceed WCAG AA deliberately.
- Touch targets sized for a working hand, gloved or wet.
- Keyboard accessible with visible focus; amber carries focus so it stays
  legible against sage controls.
- Reduced-motion support respected.
- Errors in plain language, never a status code alone.
