# Apex Operating System

Apex is the operating system for Apex Designer Pools. It carries one durable project identity from pre-contract opportunity through design, ordering, proposal, construction, closeout, and read-only history.

## Product thesis

> Capture once, calculate once, approve once, and carry the same identifiers and evidence from the first click through reconciliation.

## Current state

The non-Website product path is implemented on `main`. Verification is the local script [`scripts/ci.sh`](scripts/ci.sh) (or [`scripts/ci.ps1`](scripts/ci.ps1) on Windows, which runs the same script through bash). This repository does not use GitHub Actions for CI.

```text
Opportunity
→ Apex Designer
→ ordering-focused Takeoff (.xlsx)
→ Finish estimate
→ versioned, email-ready Proposal
→ explicit acceptance / signed Proposal
→ Job + construction Project
→ Gates, inspections, evidence, draws, and customer updates
→ close and archive
→ immutable, read-only History
```

A pre-contract intake creates a Lead/opportunity only. Apex does **not** create a construction Job until an authorized user records acceptance of the exact issued Proposal version. Closed projects remain searchable and readable, while mutation APIs reject further operational changes.

This code is production-shaped but deployment remains an explicit operator decision. See [`STATUS.md`](STATUS.md) for the current verified baseline and [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md) before staging or production work.

## Authoritative components

| Component | Authority and responsibility |
|---|---|
| `apps/designer` | Pool/spa geometry, true 3′–5′–3′ sports profiles, quantity model `designer-quantity-v5`, plan/section views, and the ordering workbook |
| `apps/website` | Astro marketing site, four-vertical routing, attribution, consent, and tagged lead capture |
| `packages/contracts` | Runtime-validated IDs, takeoff/Proposal/Job contracts, events, and customer-safe projections |
| `packages/pricing-engine` | Typed, fail-closed pricing of an approved takeoff using entered estimates; it never infers missing prices |
| `packages/database` | Operational PostgreSQL schema, forward-only migrations, immutable proposal/takeoff evidence, events, and closeout state |
| `packages/gate-service` | Opportunity estimates, Proposal versions, Job binding, Gates, inspections, schedules, draws, closeout, and archived reads |
| `apps/gate-api` | Authenticated API, evidence storage boundary, migration startup, and customer-safe endpoints |
| `apps/apex-os` | Office/owner UI for opportunities, Proposals, Projects, Today, Calendar, History, and retained artifacts |
| `workflows/lead-engine` | Apex lead intake and job-status workflow source, contracts, and fixtures |
| `docs/prd` | Apex product requirements, decision register, and operational specifications |
| `archive/proposal-engine` | Legacy reference/calibration implementation; not the production Proposal authority |
| `tools/decks` | Reproducible Apex strategy and pitch-deck generators |
| `docs/archive/` | Historical evidence only; preserved content is not current guidance |

## Lifecycle invariants

1. **Opportunity before Job.** Intake creates a Lead/opportunity without fabricating signed contract state.
2. **Designer owns measured quantities.** Apex OS consumes an approved, digest-matching takeoff revision and does not recompute geometry.
3. **Pricing fails closed.** Every measured line needs an approved estimate; every direct line needs a real quote or an explicit not-applicable decision.
4. **Proposal versions are durable.** Drafts use optimistic revisions; issued and signed versions are immutable.
5. **Signing binds exactly once.** Recording acceptance of an issued Proposal idempotently creates one Job and one construction Project.
6. **Closed means read-only.** Closeout is idempotent, requires reconciliation, preserves artifacts, and has no reopen path.
7. **External systems do not become hidden authorities.** QuickBooks remains financial authority; n8n is an adapter/notification layer.

## Designer workflow

From `Apex Designer`:

1. Create or select an opportunity.
2. Draw the pool and choose the depth profile, including **Sports Pool 3′–5′–3′** when appropriate.
3. Resolve design blockers.
4. Download **Takeoff (.xlsx)**. `Order List` is the first sheet; excavation and calculation references are secondary.
5. Use **Finish estimate** to hand the exact design revision to Apex OS.
6. Complete every authoritative price or explicit not-applicable decision before issuing the Proposal.

Excavation/soil assumptions and raw JSON diagnostics are available under **Advanced** rather than occupying the primary design workflow.

## Proposal workflow

`Finish estimate` is idempotent for an opportunity and design-input digest. It pins the approved takeoff revision and quantity digest, then returns structured pricing blockers or a durable Proposal version.

An authorized admin/office user can:

- review and update a draft with optimistic revision checks;
- issue a blocker-free version;
- print/save the customer-ready Proposal as PDF;
- copy the prepared email or open a `mailto:` draft; and
- record customer acceptance of the exact issued version.

A mail action prepares content; Apex never claims an email was sent unless an external delivery system later records that fact.

## Construction and History

A signed Proposal creates the Job and Project. Construction uses the current 11-phase model, nine active Gate definitions, inspections, retained evidence, schedules, and the fixed 10/30/30/20/10 draw schedule.

Closeout requires authoritative reconciliation. After close:

- active mutation routes return a domain refusal;
- retained takeoffs and project artifacts remain readable;
- History supports customer/address/project identity search; and
- archived detail omits mutation controls.

## Local verification

[`scripts/ci.sh`](scripts/ci.sh) is the full check: frozen install, typecheck, Apex OS / Designer / website builds, unit tests (workspace, Designer, and the legacy proposal engine), and the website Playwright specs. It also runs the integration tests when `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` are set. Without those, it skips the integration suite and says so. That skip is not a pass of the Postgres adapter or evidence storage tests.

```bash
bash scripts/ci.sh
```

On Windows, from the repository root:

```powershell
powershell -File scripts/ci.ps1
```

A production website build with `PUBLIC_ENV=production` and no `PUBLIC_LEAD_WEBHOOK_URL` is expected to fail. `scripts/ci.sh` checks that refusal.

The latest verified baseline is in [`STATUS.md`](STATUS.md).

## Documentation map

- [`STATUS.md`](STATUS.md) — concise current state, verification, and remaining operational work
- [`NEXT.md`](NEXT.md) — immediate staging/pilot sequence
- [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md) — deployment, rollback, backup, identity, storage, and CI keys
- [`docs/decisions/project-workspace-gate-boundary.md`](docs/decisions/project-workspace-gate-boundary.md) — authoritative mutation boundary
- [`docs/decisions/single-signature-gates.md`](docs/decisions/single-signature-gates.md) — current active Gate authority
- [`docs/requirements/designer-next-slice.md`](docs/requirements/designer-next-slice.md) — implemented Designer slice and explicitly deferred catalog/dig-sheet items
- [`docs/status.md`](docs/status.md) — chronological engineering record; older sections are historical, not current status
- [`docs/archive/README.md`](docs/archive/README.md) — superseded artifacts and preserved evidence

## Safety

- Do not invent prices, send claims, signed acceptance, safety facts, or customer data.
- Do not edit or delete applied migrations; reverse behavior with a new forward migration.
- Do not issue real customer links until the final HTTPS origin is configured.
- Do not treat archived fixtures or the legacy Proposal engine as current production authority.
