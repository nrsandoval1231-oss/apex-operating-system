# Apex — Status

**Updated:** 2026-10-15. **Pilot acceptance remains OPEN.**

Apex runs the business through canonical PostgreSQL operational records. Designer owns measured quantities, the pricing engine owns estimate calculations, QuickBooks owns accounting actuals, n8n owns asynchronous adapters, and Cloudflare is the approved host. [ADR-0004](docs/decisions/ADR-0004-apex-operational-record-authority.md) explicitly supersedes the historical Monday/HubSpot operational-authority assumptions while preserving their approval history. The owner-centered [vision](docs/vision.md) is unchanged.

## This engineering candidate

- Today now includes persisted, Lead-linked pre-contract next actions: overdue, due today, and missing next action. Office users can delegate, replace, complete, and inspect retained history from the authoritative opportunity. Future work is not called overdue. A failed lane cannot produce a false all-clear.
- Proposal acceptance serializes against follow-up writes and resolves open pre-contract work while retaining the existing exactly-one Job/Project invariant. Construction cards and frozen Brief identity remain intact; Brief explicitly names its pre-contract coverage limit.
- A newly accepted Job's empty Draws section now offers authorized staff the existing **Create draw schedule** operation. Previously Today linked to a dead end.
- Procurement is a bounded pilot for four approved Designer material quantities: ordered gunite volume, reinforcing steel weight, ordered tile area, and ordered coping length. Staff explicitly record order quantity, vendor/reference, needed-by/expected dates, and cumulative receipt. Source quantity/unit/revision remain immutable. Concurrent updates use revisions and idempotent history; stale takeoffs are flagged. Recorded overdue shortages/deliveries produce Today actions. Untracked material status is unknown. This does not place orders or establish accounting commitments; split orders, inventory, and additional material codes are not implemented.
- Contract value and draw eligibility remain operational facts. Invoice references are staff-recorded and unverified. Collections, remaining balance, costs, and profitability are unavailable without authoritative accounting data; a `paid` row cannot fabricate a full payment. QuickBooks is not connected.
- Website copy no longer promises an unimplemented rapid text response. Intake acceptance is distinct from message delivery. No real customer messages were sent.
- The Windows CI launcher selects Git Bash, checks out shell scripts with LF, and uses temporary writable Corepack shims rather than requiring Program Files writes. Mandatory gates are retained.
- The active Cloudflare runbook now describes separate retained evidence copies and isolated database restore. It no longer instructs operators to enable unsupported R2 S3 versioning. The old Render runbook remains historical.

## Audit and local evidence

The concise capability matrix and pre-change gaps are in [.agent/BASELINE.md](.agent/BASELINE.md). Audit anchor and fetched main: `ab74aa333c97399004ccbdba20a7b1df58d33ab4`. Original checkouts and cinematic work were preserved; implementation uses an isolated worktree/branch.

Before final candidate freeze, the controller independently observed:

- Baseline core: 552 tests passed; Designer: 585 passed; real PostgreSQL/S3 adapter suite: 29 passed with two missing-engine guard skips. Website desktop/mobile: 166 passed; production intake: 10 passed; estimate-navigation browser regression passed.
- Follow-up/Proposal/API affected checks: 52 passed, including real PostgreSQL races. Financial draw checks: 21 passed.
- New operational tests: three real-PostgreSQL procurement cases and one complete backend business-lifecycle case passed together. The lifecycle case passed again against the same database, without clearing prior synthetic records. It uses service commands for transitions and fixture evidence metadata; it is not live-provider or browser acceptance.
- Actual local browser: Sports Pool 3′–5′–3′, Order List-first workbook, missing-fee refusal, explicitly priced issued proposal, synthetic acceptance, one Job/Project, assignment, and four uploaded evidence objects retrieved from a fresh page. Follow-up scheduling, completion, history, reload, scoped query failure, and recovery passed.
- Actual loopback API plus browser-rendered reads: five-draw schedule, explicit financial unknowns, source-pinned material order, partial receipt/Today blocker, full receipt/blocker removal, persisted reload.
- A synthetic PostgreSQL dump restored to a separate local database with matching counts; a synthetic S3 object copy matched its checksum. These are local drills, not managed Neon/R2 recovery acceptance.

Final combined verification is `powershell -NoProfile -File scripts/ci.ps1` (or `bash scripts/ci.sh`). Exact frozen commit, complete output, pass/failure/skip accounting, image compatibility, and independent review belong to the PR test report and the durable local `../business-completion-evidence/FINAL.json`; earlier focused checks do not certify a later candidate. The work graph is [.agent/GRAPH.md](.agent/GRAPH.md).

## Observed staging versus this candidate

The prior deployment handoff identifies audit-anchor `ab74aa3` on the existing workers.dev staging host. Fresh read-only checks on 2026-10-15 observed `/health` and `/ready` HTTP 200, database/evidence ready, and unauthenticated staff/API redirects to Cloudflare Access. This candidate has not been deployed by this mission. Production and real customer data were untouched.

## Open pilot gates

1. Deploy only an independently accepted candidate to staging under explicit release authority, then complete signed-in staff and customer-isolation acceptance through Cloudflare Access.
2. Local browser closeout is demonstrated on candidate `a3ddbf8`: `apps/apex-os/tests/closeout-acceptance.e2e.mjs` runs the built gate-api against PostgreSQL and S3-compatible storage with signed pilot tokens. Over HTTP it signs one priced Proposal (a retry returns the same Job), refuses early completion/close (409), records inspections and releases six Gates. In the browser it uploads Final evidence, passes requirements, accepts the native release confirmation, completes, closes (superintendent close 403), and lands on the read-only History record. Closed-job Gate/phase mutation returns 409; evidence remains readable to staff and 403 anonymously. This is local acceptance, not staging; the same journey still needs to run signed in through Cloudflare Access (gate 1).
3. Demonstrate managed Neon recovery and independent retained R2 evidence recovery, including retrieval/checksum checks, before real jobs or money.
4. Confirm pilot staff/roles, final HTTPS customer-link origin, actual approved pricing, and operational lead-response ownership. No mocked adapter or human invoice reference proves live accounting reconciliation.

No completion percentage or business-readiness claim is made. See [NEXT.md](NEXT.md) for the exact next acceptance sequence. Historical engineering records remain in `docs/status.md` and Git history.
