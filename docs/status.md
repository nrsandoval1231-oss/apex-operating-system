# Apex Current Status

**Last updated:** 2026-07-31

**Program phase:** Phase 1 — Shared operational spine and controlled Gate vertical slice (Phase 0 preservation complete)

**Production status:** Not production-ready

**Current source of truth for status:** This file

**Active build scope:** All Apex components except the Website. The Website is being developed separately and must not be modified by this build workstream. See `docs/decisions/ADR-0002-non-website-build-profile.md`.

## Executive status

Apex has a coherent lifecycle, strong PRDs, a tested technical takeoff prototype, a tested proposal prototype, an actively developed website, and a high-value Gate field-operations concept. These components do not yet form a deployed end-to-end system.

Phase 0 goals:

1. Preserve all current source and Git history.
2. Establish private remotes and a system-level repository.
3. Stop documentation and artifact drift.
4. Record and fix safety/correctness blockers before integration.
5. Preserve verified baseline tests/builds.
6. Prepare one controlled lead-to-gate vertical slice.

## Preservation state

- Source-only working-tree backup: `C:\Users\NickSandoval\Desktop\Apex-Phase0-Backup-20260728_161654`
- Backup contains 175 productive/current files in a verified ZIP.
- Six independent Git histories are preserved as verified Git bundles.
- Dirty/untracked state and binary-capable patches are captured for every repository.
- Generated dependencies and outputs were intentionally excluded.
- High-confidence secret scans found no committed/current credentials in the reviewed productive source.

## Component status

### Apex Designer

**Strengths**

- Pure TypeScript calculation engine separated from React UI
- Formula/input/unit/result `Calc` primitive
- Strict TypeScript configuration
- 318 engine tests verified passing on 2026-07-29
- Production build and standalone artifact generation previously verified
- No production dependency vulnerabilities in the most recent audit

**Safety stabilization completed on 2026-07-29**

- Attached-spa excavation, shell, cove, exterior bond beam, reinforcement families, and plan outlines are now included without double-counting the shared edge.
- Hydraulic, gas, and impossible-pad failures now roll into the global blocking state.
- Gas-table sizing is deterministic and refuses to reuse a shorter terminal row.
- Nested step, seat, spa, hydraulic-run, and gas-load records are rejected before calculation.

**Launch blockers still open**

1. Duplicate physical facts, including shell thickness, must be removed as the shared quantity contract is introduced.
2. Job editor covers only part of the domain model.
3. React and standalone renderers have content/layout drift and no browser/PDF integration tests.
4. Placeholder inputs and standard-detail assumptions require expert and controlled-job reconciliation.

**Use restriction:** Designer is the sole measured-quantity authority, but its approved output must not drive material ordering or safety-critical field decisions until controlled-job reconciliation and production deployment controls are complete.

### Proposal Engine

**Strengths**

- Pure dependency-free calculation core
- 116 engine checks plus approved-authority/digest verification and 11 hash-pinned Whitaker evidence checks verified passing on 2026-07-29
- Explicit distinction between fee/markup and true margin
- Useful report and browser proposal prototype

**Safety stabilization completed on 2026-07-29**

- Impossible geometry, negative fees, negative direct costs, and negative allowances now fail before arithmetic.
- Draft takeoff and customer-issuable proposal are separate states.
- Unresolved direct-entry scope and back-solved residuals hard-block customer proposal generation.
- `calibrate.mjs` now exits non-zero and cannot emit pricing guidance.
- Browser UI gating was exercised against the shipped DOM with jsdom.
- The quoted estimate and completed-job transaction report are separately transcribed, source-hash pinned, and arithmetically reconciled in integer cents.

**Launch blockers still open**

1. Whitaker's 0.0% modelled-code result is calibration, not independent validation.
2. Approximately $47,302 / 40.4% of the quoted estimate remains unmodelled in the current calibration replay.
3. Proposal output is disconnected from `lead_id`, CRM, and Gate outside the approved-revision boundary.
4. Issued Proposal immutability exists in memory, but no durable proposal-version table, audit trail, or deployment control exists.
5. All 61 completed-job transactions are deliberately unclassified; owner-reviewed shared-cost-code mapping is required before category variance analysis.

**Use restriction:** Customer issuance now fails closed without approved, digest-matching Designer quantity authority and complete commercial scope, but the provisional rate library is not pricing authority and the calibration replay must not be represented as independent validation.

### Website

**Strengths**

- Astro static architecture with one React form island
- Shared vertical configuration and first-touch attribution
- Five pages, sitemap, and robots output previously verified building
- Website and lead-engine payloads are presently field-aligned

**Current working state**

- Phase 4 and Phase 5 launch-preparation work were committed on 2026-07-28.
- Local Hermes attachment artifacts are ignored rather than committed.
- Local and private-remote `main` heads were verified to match.

**Launch blockers**

1. No automated browser or contract test suite.
2. Real photography slots remain unresolved.
3. Production dependency audit previously reported three high and one moderate vulnerability.
4. Website can treat a quarantined 2xx lead response as successful/routed.
5. Form requires both email and phone while the receiving contract accepts either.
6. Speed-to-lead copy promises behavior not currently implemented.
7. Canonical domain, real contact settings, analytics IDs, redirects, and legal pages require final verification.
8. Production launch/access transfer and rollback runbook are not verified.

### Lead Engine

**Strengths**

- Explicit contracts and fixtures
- Intake and job-status workflow source
- Deterministic identity concepts
- No high-confidence secrets found in current source or reviewed history

**Launch blockers**

1. Deployed intake is inactive with no verified live executions.
2. Core speed-to-lead SMS/email/team response does not exist.
3. Both webhooks use `authentication: none`.
4. Search-then-create idempotency is not atomic.
5. Quarantined payloads return HTTP 200 and can be reported as successful by clients.
6. Consent text is not fully enforced at the trusted boundary.
7. Job-status transition legality and timestamp validity are not enforced.
8. No package manifest, lockfile, TypeScript build, tests, SDK pin, or repeatable deployment command exists.
9. Airtable PII retention/access/deletion policy is undocumented.

### Gate

**Strengths**

- Exception-first daily action queue
- Strong irreversible hold-point concept
- Useful linkage among QC, schedule conflicts, draws, and customer communication
- Customer view correctly hides internal QC complexity
- Persistent local pre-gunite service now links an approved takeoff revision to versioned requirements, binary evidence, evaluation events, release authority, draw eligibility, and a customer-safe projection
- Authenticated field console and loopback API now exercise the narrow hold point end to end

**Launch blockers**

1. The preserved `gate-v3.jsx` prototype remains sample-driven; the new operational slice is a separate controlled-pilot implementation.
2. Local persistence is embedded PostgreSQL and private filesystem storage, not the managed production deployment profile.
3. Pilot JWT authentication uses a local symmetric secret; production requires asymmetric/JWKS identity, TLS, provisioning, rotation, and access logging.
4. Evidence freshness/expiration and inspection-request scheduling are not implemented.
5. QuickBooks synchronization is not connected; release only creates canonical draw eligibility.
6. Schedule authority remains disconnected.
7. Chemistry remains explicitly outside field deployment until separately approved.
8. Full accessibility, offline behavior, deployment monitoring, automated backups, and recovery drills remain required.

## Integration status

Currently aligned:

- Website and intake lead fields
- Lead ID concept
- Four-vertical vocabulary
- Job-status event concept
- Shared cost-code strategy in PRDs
- Namespaced canonical IDs and versioned Zod contracts
- Durable event vocabulary and append-only PostgreSQL history
- Approved takeoff revision, Gate, evidence, draw, and customer-projection schema
- Designer-owned canonical quantities flow directly into Proposal pricing with Calc provenance, revision pinning, and an order-sensitive quantity-payload SHA-256
- Admin/office/field/customer row-level authorization policies

Currently disconnected:

- Proposal to lead/opportunity/job lifecycle
- Job creation to Gate
- Gate events to draw release and QuickBooks
- Customer view to approved operational events
- Completed-job cost classification to pricing review, Meta, reviews, and commissions

## Artifact and documentation drift

The following claims must not be reused without correction:

- “Not fitted to the answer” for the Whitaker calibration job
- 0.0% variance presented as whole-job or independent validation
- Old 13-slide strategy-deck references
- Old proposal test counts of 82, 87, or 90; current verified baseline is 112 engine checks plus 11 source-evidence checks
- Website README claims that implementation has not started
- Claims that all repositories are clean
- Commission decisions presented as settled before recorded approval

## Baseline verification — 2026-07-28

| Component | Commands | Result |
|---|---|---|
| Designer | `npm test` | 9/9 files and **305/305 tests passed** |
| Designer | `npm run build` | TypeScript check and Vite production build passed |
| Designer | `npm audit --omit=dev` | **0 vulnerabilities** |
| Proposal | `node engine.test.mjs` | **90/90 checks passed** |
| Proposal | `node backtest.mjs` | Executed; whole-job model remains **40.4% / $47,302 short** because direct-entry scope is unmodelled |
| Proposal | `node report.mjs whitaker` | Executed; coverage and blocking warnings rendered |
| Website | `npm run check` | 0 errors, 0 warnings, 2 TypeScript deprecation hints |
| Website | `npm run check:images` | Completed; **9 photography slots remain unfilled** |
| Website | `npm run build` | Static production build passed; five pages plus robots and sitemap emitted |
| Website | `npm audit --omit=dev --audit-level=high` | **3 high and 1 moderate** vulnerability; breaking Astro upgrade required |
| Decks | `node --check strategy-deck.js` and `node --check pitch-deck.js` | Passed |
| Decks | `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** after adding the lockfile |
| Decks | regenerate both PPTX files | Completed |
| Decks | Office package validator | Both PPTX files passed structural/package validation |

## Designer stabilization verification — 2026-07-29

| Commands | Result |
|---|---|
| `npm test` | **10/10 files and 312/312 tests passed** |
| `npm run build` | Strict TypeScript check and Vite production build passed |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** |

## Proposal stabilization verification — 2026-07-29

| Commands | Result |
|---|---|
| `node engine.test.mjs` | **112/112 checks passed** |
| `node whitaker-evidence.test.mjs` | **11/11 checks passed**; 13 estimate sections, 61 actual transactions, fee math, five payments, and remaining balance reconcile |
| `node backtest.mjs` and `node report.mjs whitaker` | Both executed successfully; known calibration/coverage limitations remain visible |
| `node calibrate.mjs` | Expected non-zero refusal with `DISABLED` message |
| jsdom DOM verification | Blocked default, quoted-scope release, customer render, and invalid-geometry refusal all passed |

The completed-job report records **$104,602.12** of actual pool expenses and a **$135,982.76** actual cost-plus total, versus the **$116,955.18** quoted job cost and **$152,041.73** quoted customer total. The same-job variance is **−$12,353.06 / −10.56%** at cost and **−$16,058.97 / −10.56%** at customer total. This is estimate-to-actual evidence, not independent quantity validation or rate authority.

## Shared platform verification — 2026-07-29

| Commands | Result |
|---|---|
| `pnpm verify` | **34/34 tests passed** and strict TypeScript project build passed |
| Embedded PostgreSQL migration suite | Core schema, RLS policies, intake idempotency, one-approved-revision invariant, evidence separation, append-only events, and private evidence bucket all passed |
| `pnpm install --frozen-lockfile` | Reproducible install passed |
| `pnpm audit --prod --audit-level high` | **No known vulnerabilities** |

The shared spine is implemented locally but is not provisioned in a managed environment. Real JWT/RLS integration, signed evidence uploads, backups, monitoring, and deployment remain required before production use.

## Approved quantity authority and tamper-evidence verification — 2026-07-29

| Commands | Result |
|---|---|
| Designer tests, typecheck, and build | **318/318 tests passed**; strict TypeScript and production build passed |
| Proposal ownership, engine, authority/digest, and Whitaker suites | Ownership passed, **116/116 engine checks passed**, digest tamper cases passed, and **11/11 evidence checks passed** |
| `pnpm test` | **50/50 root tests passed** plus **1/1 real Designer-contract integration test** |
| `pnpm typecheck` and `pnpm build` | Strict TypeScript project build passed |
| `pnpm audit --prod` | **No known vulnerabilities** |
| Disposable cross-repository verifier | Contract and Proposal produced the same SHA-256 for all 17 Designer quantities; reordered, omitted, provenance-consistent substituted, and non-finite payloads were rejected; verifier removed |

Approved revisions now carry an immutable `quantity_payload_sha256` over the ordered tuple `(code, value, unit, calcId)`. The digest is validated by the shared contract, persisted by forward-only migration `0007`, included in approval events, independently revalidated by Proposal, and pinned into issued Proposal output. Existing database revisions require an explicit digest backfill before migration; the migration refuses to invent historical evidence.

`pnpm peers check` still reports the pre-existing transitive PGlite/WASM `@emnapi/core` and `@emnapi/runtime` version mismatch. Operational tests and the production audit pass, but this dependency-tree warning remains open for a separate runtime-dependency checkpoint.

## Persistent Gate vertical-slice verification — 2026-07-29

| Commands | Result |
|---|---|
| Gate service tests | Persistent event reconstruction, command idempotency, evidence-kind refusal, release authority, draw projection, and customer filtering passed |
| Gate API tests | Full approved-revision → evidence files → evaluations → release → draw → customer milestone flow passed over HTTP |
| Security assertions | Missing/invalid tokens, missing idempotency keys, customer access to internal Gate state, MIME mismatch, and inactive/role-mismatched users fail closed |
| Strict TypeScript | Full project-reference build passed |
| Built server smoke test | Compiled API started from `dist`, migrated a persistent local database, returned HTTP 200 for health and the field console, and shut down cleanly |

The API binds to loopback for a controlled pilot. It stores real evidence bytes privately, hashes them, and never exposes internal evidence through the customer endpoint. This is a working local vertical slice, not a production deployment.

An additional temporary Phase 0 verification script passed **75 targeted assertions** covering backup checksums, ZIP integrity, all six Git bundles, deck claim corrections, generated deck contents/slide counts, Office package structure, ignore rules, dependency audit, and whitespace hygiene. This was ad-hoc verification, not a substitute for the component suites above. The script was removed after execution.

PowerPoint visual rendering was not completed because the headless COM export approval timed out. Structural validation passed, but slide-level visual QA remains pending before the corrected decks are used externally.

## Apex OS shell adoption — 2026-07-31

The previously untracked `apex-os/` React prototype is now `apps/apex-os` inside the pnpm workspace and reads live data from the Gate API. See [`docs/plans/apex-os-v1-build-plan.md`](plans/apex-os-v1-build-plan.md) and [`PRD.md`](../PRD.md).

| Commands | Result |
|---|---|
| `pnpm verify` | **85/85 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| `pnpm --filter @apex/os build` | Vite production build passed |
| `pnpm audit --prod` | **No known vulnerabilities** |
| Browser verification | Signed-out, signed-in, sign-out, Today, Projects, and Project detail all verified against seeded local data; no console errors |

Added: a `job_summary` read model (`GET /api/jobs`, `GET /api/jobs/:jobId`) over jobs, leads, signed proposal versions, and gate instances, staff-only at the API boundary and validated by a shared contract schema at both ends.

Deliberate constraints in this slice:

- Wired screens never fall back to sample data. Failure, empty, and signed-out states are shown explicitly so an invented project can never be mistaken for a real one.
- Lead identity is read from a fixed list of known payload key spellings and returns null rather than guessing; contract value comes only from a signed Proposal version.
- Contract totals are read as text and refused if outside the safe-integer range, so no cent is lost to float conversion.
- The app holds no database and mints no credentials. It carries the same short-lived pilot token as the Gate field console, which remains pilot-grade symmetric authentication.

Dependency decisions made during adoption:

- `allowBuilds: esbuild: false` resolves a placeholder that was blocking every pnpm command. Vite runs from the platform binary pnpm installs directly, so the install script is not needed.
- React 19.2.8 and React Router 8.3.0 replace React 18 / Router 6. Router 6 and 7 both carried open advisories; Router 8 requires React 19. The app uses only core routing APIs, so the upgrade was contained.

Not built in this slice: the action-card engine, the project/phase model, inspections, scheduled visits, draw schedules, the customer progress page, and the daily brief. The Today feed shows Gate status only and says so on screen.

## Next controlled milestone

One pilot job must demonstrate:

```text
Lead accepted once
→ response recorded
→ proposal won / Job ID minted
→ versioned takeoff attached
→ pre-gunite gate completed with evidence
→ immutable gate signature
→ draw eligibility
→ customer-safe milestone update
```

No broader feature expansion should outrun this slice.
