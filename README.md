# Apex Operating System

Apex is a unified operating-system project for a pool and outdoor-construction business. It connects lead capture, estimating, technical takeoff, field execution, customer communication, billing gates, job costing, and growth feedback without forcing every workflow into one giant application.

## Vision

The upstream statement of what Apex is for — and the test every work item must pass — lives in [`docs/vision.md`](docs/vision.md). Read it first. Everything below is implementation.

## Product thesis

> Capture once, calculate once, approve once, and carry the same identifiers and evidence from the first click through reconciliation.

## Current state

**Phase 1 — Shared operational spine and controlled Gate vertical slice.**

Phase 0 preservation is complete. The root workspace contains the shared contracts, domain rules, PostgreSQL migrations, authorization policies, private evidence-storage policies, and CI verification, plus the adopted Apex OS UI shell. Apex is **not yet a production end-to-end system**; the next proof is one persistent pre-gunite Gate workflow on a real pilot job.

See:

- [`docs/vision.md`](docs/vision.md) — the vision; upstream source for all product decisions
- [`docs/status.md`](docs/status.md) — verified current status and launch blockers
- [`docs/plans/apex-os-v1-build-plan.md`](docs/plans/apex-os-v1-build-plan.md) — approved build sequence
- [`docs/apex-audit-2026-07-31.md`](docs/apex-audit-2026-07-31.md) — folder audit measured against the vision
- [`docs/repositories.md`](docs/repositories.md) — private remote and local-source map
- [`docs/architecture/apex-system-showcase.html`](docs/architecture/apex-system-showcase.html) — visual walkthrough of the unified operating model
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
| `packages/*` + `apps/gate-api` | Operational spine: contracts, domain rules, database, gate service, authenticated pilot API and field console | 85 root tests + 1 integration test passing; local vertical slice only, not production |
| `apps/apex-os` | Owner/office UI shell (Today feed, Projects, Project detail wired to the Gate API; Owner Brief and Customer view still labelled sample data) | Adopted into the workspace 2026-07-31 |
| `Apex Designer` | Technical pool/spa plan and materials takeoff | 318 tests pass; real-job reconciliation still gates authority |
| `apex-proposal-engine` | Quantity-to-price proposal engine | 116 engine checks + 11 evidence checks pass; customer issuance fails closed; provisional pricing is not authority |
| `apex-website` | External public marketing site and upstream lead producer | Explicitly excluded from this build-out; maintained in a separate workstream |
| `apex-lead-engine` | n8n intake and job-status workflow source | Source exists; intake inactive; speed-to-lead not built |
| `apex-prds` | Foundation, decisions, and product requirements, including the decision register | Active |
| `apex-decks` | Strategy and pitch-deck generators | Deck files regenerate on demand from source; slide-level visual QA pending before external use |
| `docs/archive/` | Superseded artifacts kept for history — the `gate-v3.jsx` mockup, the pre-wiring browser demo, and two earlier handoffs | Reference only; not source of truth |

Each existing Git component remains an independent repository during Phase 0/1. The root repository preserves the system-level plans and non-repository artifacts. A later approved migration will import component histories into the target monorepo rather than copying files blindly.

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
- `packages/gate-service` — idempotent Gate commands, durable event reconstruction, and atomic release projections
- `apps/gate-api` — authenticated loopback pilot API, private evidence files, and the field console
- `apps/apex-os` — the Apex OS React UI shell

The controlled-pilot procedure and refusal boundaries are in [`docs/runbooks/gate-controlled-pilot.md`](docs/runbooks/gate-controlled-pilot.md).

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

They live in [`docs/archive/`](docs/archive/README.md), which says what each one is and what replaced it:

- `apex-handoff.md` — original client/project context (Travis, margin finding, tooling decisions)
- `SESSION-HANDOFF.md` — 2026-07-26 build-state handoff
- `gate-v3.jsx`, `demo.html`, `README-DEMO.md` — the pre-`apps/apex-os` prototypes

Superseded artifacts were moved to `_to_delete/` during the 2026-07-31 cleanup and the root was flattened again on 2026-08-05. Current status belongs in `docs/status.md`. Architecture decisions belong in `docs/decisions/`.

## Safety and readiness

Do not use current calculation outputs for material ordering, safety-critical field decisions, or customer pricing without reviewing the blockers in `docs/status.md` and reconciling against approved real-job inputs.
