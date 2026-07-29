# Apex Operating System

Apex is a unified operating-system project for a pool and outdoor-construction business. It connects lead capture, estimating, technical takeoff, field execution, customer communication, billing gates, job costing, and growth feedback without forcing every workflow into one giant application.

## Product thesis

> Capture once, calculate once, approve once, and carry the same identifiers and evidence from the first click through reconciliation.

## Current state

**Phase 1 — Shared operational spine and controlled Gate vertical slice.**

Phase 0 preservation is complete. Designer and Proposal now fail closed on the known safety defects, and the root workspace contains the first shared contracts, domain rules, PostgreSQL migrations, authorization policies, private evidence-storage policies, and CI verification. Apex is **not yet a production end-to-end system**; the next proof is one persistent pre-gunite Gate workflow.

See:

- [`docs/architecture/apex-system-showcase.html`](docs/architecture/apex-system-showcase.html) — visual walkthrough of the unified operating model
- [`docs/status.md`](docs/status.md) — verified current status and launch blockers
- [`docs/repositories.md`](docs/repositories.md) — private remote and local-source map
- [`docs/decisions/ADR-0001-system-boundaries.md`](docs/decisions/ADR-0001-system-boundaries.md) — proposed system authorities and boundaries
- [`docs/decisions/ADR-0002-non-website-build-profile.md`](docs/decisions/ADR-0002-non-website-build-profile.md) — accepted implementation defaults and Website exclusion
- [`docs/decisions/ADR-0003-canonical-identity-contracts-persistence.md`](docs/decisions/ADR-0003-canonical-identity-contracts-persistence.md) — canonical IDs, events, authorization, evidence, and persistence
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

| Component | Purpose | Current status |
|---|---|---|
| `apex-website/apex-website` | External public marketing site and upstream lead producer | Explicitly excluded from this build-out; maintained in a separate workstream |
| `apex-lead-engine/apex-lead-engine` | n8n intake and job-status workflow source | Source exists; intake inactive; speed-to-lead not built |
| `apex-proposal-engine` | Quantity-to-price proposal prototype | 112 checks pass; impossible inputs and incomplete customer issuance now fail closed; provisional pricing still blocks authority |
| `Apex Designer` | Technical pool/spa plan and materials takeoff | 312 tests pass; known spa, gas, rollup, and nested-validation defects corrected; real-job reconciliation still gates authority |
| `gate-v3.jsx` | Field command-center prototype | Product mockup; no persistence/backend/audit yet |
| `apex-prds/apex-prds` | Foundation, decisions, and product requirements | Strong but contains stale/open decisions presented elsewhere as settled |
| `apex-decks` | Strategy and pitch-deck generators | Claims corrected; generated packages structurally validate |
| `Apex Lead Engine` | Detached n8n workflow export/status snapshot | Historical/operational export; not an independent source of truth |

Each existing Git component remains an independent repository during Phase 0. The root repository preserves the system-level plans and non-repository artifacts. A later approved migration will import component histories into the target monorepo rather than copying files blindly.

## Shared workspace

The root non-Website workspace uses pnpm, strict TypeScript, Vitest, Zod, and PostgreSQL-compatible migrations.

```bash
pnpm install
pnpm verify
pnpm audit --prod --audit-level high
```

- `packages/contracts` — runtime schemas, canonical IDs, event vocabulary, and customer-safe projections
- `packages/domain` — pure Gate authority and release rules
- `packages/database` — operational schema, row-level authorization, private evidence storage, and migration execution tests

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
