# Apex Operating System

Apex is a unified operating-system project for a pool and outdoor-construction business. It connects lead capture, estimating, technical takeoff, field execution, customer communication, billing gates, job costing, and growth feedback without forcing every workflow into one giant application.

## Product thesis

> Capture once, calculate once, approve once, and carry the same identifiers and evidence from the first click through reconciliation.

## Current state

**Phase 0 — Preserve and stabilize.**

Apex has strong architecture, tested prototypes, and a promising field-operations concept. It is **not yet a production end-to-end system**. The current work is being preserved, versioned, corrected, and prepared for one controlled vertical slice.

See:

- [`docs/status.md`](docs/status.md) — verified current status and launch blockers
- [`docs/repositories.md`](docs/repositories.md) — private remote and local-source map
- [`docs/decisions/ADR-0001-system-boundaries.md`](docs/decisions/ADR-0001-system-boundaries.md) — proposed system authorities and boundaries
- [Unified implementation plan](.hermes/plans/2026-07-28_160832-apex-unified-operating-system.md)

## Intended lifecycle

```text
Website lead
→ accepted lead / opportunity
→ versioned proposal
→ signed contract / Job ID
→ versioned plan and takeoff
→ Gate field execution
→ inspections and draw releases
→ QuickBooks invoices, payments, and actual costs
→ completion and reconciliation
→ customer review and marketing feedback
```

## Existing components

| Component | Purpose | Phase 0 status |
|---|---|---|
| `apex-website/apex-website` | Public marketing site and tagged lead capture | Builds; active uncommitted launch work; not launched |
| `apex-lead-engine/apex-lead-engine` | n8n intake and job-status workflow source | Source exists; intake inactive; speed-to-lead not built |
| `apex-proposal-engine` | Quantity-to-price proposal prototype | 90 checks pass; input and calibration defects block production use |
| `Apex Designer` | Technical pool/spa plan and materials takeoff | 299 tests pass; correctness defects block field/material use |
| `gate-v3.jsx` | Field command-center prototype | Product mockup; no persistence/backend/audit yet |
| `apex-prds/apex-prds` | Foundation, decisions, and product requirements | Strong but contains stale/open decisions presented elsewhere as settled |
| `apex-decks` | Strategy and pitch-deck generators | Generated artifacts exist; validation claims require correction |
| `Apex Lead Engine` | Detached n8n workflow export/status snapshot | Historical/operational export; not an independent source of truth |

Each existing Git component remains an independent repository during Phase 0. The root repository preserves the system-level plans and non-repository artifacts. A later approved migration will import component histories into the target monorepo rather than copying files blindly.

## System boundaries

- Apex Postgres: operational identity, jobs, proposals, takeoff revisions, gates, events, and customer-safe projections
- Shared pool engine: authoritative geometry and quantities
- Shared pricing engine: cost codes, rates, allowances, and proposal totals
- Gate: field-facing command center
- n8n: notifications and external adapters, not canonical business state
- QuickBooks: financial authority
- Monday: transitional adapter only unless an explicit decision says otherwise

## Historical artifacts

The following are preserved for history but must not be treated as current source of truth:

- `Apex ideas.zip`
- `apex-handoff.md`
- `SESSION-HANDOFF.md`
- older root deck exports

Current status belongs in `docs/status.md`. Architecture decisions belong in `docs/decisions/`.

## Safety and readiness

Do not use current calculation outputs for material ordering, safety-critical field decisions, or customer pricing without reviewing the blockers in `docs/status.md` and reconciling against approved real-job inputs.
