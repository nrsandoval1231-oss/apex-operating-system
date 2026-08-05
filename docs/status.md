# Apex Current Status

**Last updated:** 2026-08-03

**Program phase:** Phase 1 — Shared operational spine and controlled Gate vertical slice (Phase 0 preservation complete). **Apex OS build plan Steps 1–8 are complete, every MVP item in PRD §19 is built, and all content is approved.** Travis Sandoval approved the inspection list and lead times, the twelve added gate checklist items, and the nine customer-facing phase descriptions as written on 2026-08-03 (`docs/inspections-and-gate-checklists-2026-08-03.md`). Nothing is blocked on code and nothing is awaiting sign-off.

**The only thing between this and a pilot is deployment.** Everything runs on loopback with embedded Postgres and a symmetric pilot JWT. A pilot with three to five real projects and a live customer link needs a managed environment, TLS, and real identity — see the launch blockers below. That is now the single remaining workstream.

**Production status:** Not production-ready

**Current source of truth for status:** This file. `docs/HANDOFF.md` is a one-page orientation that points here rather than restating it.

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
4. Evidence freshness/expiration are not implemented.
5. **The Designer contract test runs in CI only once a deploy key is set.** The
   workflow now checks `apex-designer` out beside this repository and runs the
   contract test against it, but that needs a read-only deploy key in
   `APEX_DESIGNER_DEPLOY_KEY` — see `docs/runbooks/deployment.md` §8. Until the
   secret exists CI prints a warning and the test skips, which is the state as of
   2026-08-03. Where the secret is present, a missing engine **fails** the run
   rather than skipping it.
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

- The nine confirmed construction phases, six customer milestones, and the §9.3
  project record, keyed by Job ID

Currently disconnected:

- Proposal to lead/opportunity/job lifecycle
- Job creation to Gate
- Gate definitions to construction phases beyond pre-gunite
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

The previously untracked `apex-os/` React prototype is now `apps/apex-os` inside the pnpm workspace and reads live data from the Gate API. See [`docs/plans/apex-os-v1-build-plan.md`](plans/apex-os-v1-build-plan.md) and [`PRD FINAL.md`](../PRD%20FINAL.md).

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

## Project and construction-phase model — 2026-07-31

Build-plan Step 2. The nine confirmed construction phases, six customer
milestones, §9.3 project record, and append-only phase history are now in the
database and rendered by the Apex OS UI. Authority:
[`docs/decisions/construction-model.md`](decisions/construction-model.md).

| Commands | Result |
|---|---|
| `pnpm verify` | **121/121 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| `pnpm --filter @apex/os build` | Vite production build passed |
| Migration `0010` against the existing local dev database | Applied forward-only over pre-existing data; no row rewritten |
| Browser verification | Projects list and Project detail render live phase, milestone, superintendent, target window, and risk from Postgres; no console errors |

Added: `construction_phases`, `customer_milestones`, `projects`,
`project_phase_transitions`, the `superintendent` role, and
`gate_definitions.release_roles` / `.phase_key`.

**Behaviour change to note:** a `field` user may capture evidence and evaluate
requirements but **can no longer release a Gate**. Two existing tests asserted
the old behaviour and were updated.

Deliberate constraints in this slice:

- Handover is derived from job completion, never from reaching phase 9. A pool
  with water in it has not been handed over.
- The phase and milestone tables refuse writes by statement; they change only by
  migration, the same discipline `events` already has.
- Phase skips and reversals are recorded, not forbidden — but the database
  itself requires a reason for any move that is not one step forward.
- A signed job is not automatically a job under construction. `project` is null
  on the read model until someone opens it, and the UI says so.
- No `project_id` is minted; the canonical chain stays lead → job.

Not built in this slice: the six remaining gate templates, the action-card
engine, inspections, scheduled visits, the draw schedule, the customer progress
page, and the daily brief.

## Two-signature Gate release — 2026-07-31

Both open authority flags in §5 of the construction-model decision are now
**resolved and built** (migration `0011_gate_countersign.sql`).

| Decision | Built |
|---|---|
| §5.1 Pre-gunite requires an owner countersign | Sign-off puts the Gate in `awaiting-countersign`; only the countersign releases it |
| §5.2 Money gates may be released by the owner **or** a superintendent | Draws no longer stall while the owner is unavailable |

Authority now follows what cannot be undone rather than what can be credited.
Every gate takes one signature from the owner or a superintendent, except
pre-gunite, which takes both.

| Commands | Result |
|---|---|
| `pnpm verify` | **134/134 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| `pnpm --filter @apex/os build` | Vite production build passed |
| HTTP verification against the local dev database | Field lead refused (409); superintendent sign-off produced `gate.signoff_recorded` and status `awaiting-countersign`; countersign by a non-countersign role refused (409); owner countersign produced `gate.countersigned`, `gate.released`, `draw.eligible`, `customer_update.published` |
| Browser verification | Projects list and Project detail render the released Gate and live project record; no console errors. The intermediate `awaiting-countersign` screen was **not** exercised in the browser — its label and badge are covered by unit tests only |

Deliberate constraints:

- The countersign **blocks** the release. It is not recorded after the fact —
  a confirmation that arrives after the pour protects nothing.
- **The countersigner must be a different person than the signer**, enforced in
  the domain and again by a database constraint. An authority control that lives
  only in application code is one refactor away from not existing.
- A definition whose countersign role is also its only release role is refused
  at both layers, because nobody could ever sign it first.

Consequence worth naming: a superintendent can now release a draw-bearing gate
on his own signature. What remains between him and an invoice is the gate's own
evidence requirements, the append-only audit trail, and the separate human
confirmation that PRD §9.8 requires before invoicing. If that proves too loose,
adding a countersign to the money gates is now one data change per definition.

## Seven Gate templates — 2026-07-31

Build-plan Step 3. The Gate engine now runs all seven confirmed templates instead
of pre-gunite alone (migration `0012_gate_templates.sql`).

| Gate | Phase | Draw | Signatures |
|---|---|---|---|
| Permit | P1 | — | one |
| Excavation | P2 | Draw 1 | one |
| Pre-gunite | before P5 | — | **two** |
| Shell | P5 | Draw 2 | one |
| Deck & tile | P7 | Draw 3 | one |
| Equipment | P8 | — | one |
| Final | P9 | Final Draw | one |

| Commands | Result |
|---|---|
| `pnpm verify` | **149/149 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| HTTP verification against the local dev database | Permit released with a customer update and **no draw**; Excavation released with `draw.eligible`; pre-gunite had already released under countersign. **Three Gate types completed on one job**, which is what PRD §21 requires |
| Browser verification | Project detail lists all seven Gates with per-Gate draw and countersign labels; released, not-opened, and current states render distinctly; no console errors |

What changed beyond seeding:

- **Release consequences are per-definition.** Only the four draw-bearing Gates
  emit `draw.eligible`. Previously every release created draw eligibility, so
  releasing Permit or Equipment would have invented money.
- **Customer wording comes from the definition**, not a hardcoded string. Before
  this, all seven Gates would have told the customer "Pre-gunite release complete".
- **Pre-gunite moved to version 2** carrying the eleven-item PRD §9.4 baseline,
  up from five requirements. Version 1 is deactivated but intact, so the Gate
  already released against it keeps its meaning.
- **Gates are not forced into sequence.** A job imported mid-build can open Shell
  before a Permit gate exists. The plan shows unopened Gates as "not opened",
  never as skipped or passed.
- The field console now picks a Gate instead of assuming pre-gunite, and knows
  the difference between signing off and countersigning.

**The checklists were not Apex's yet — resolved 2026-08-03.** The decision
document gives one line of "Verifies" per Gate, not procedures, so every
requirement list except pre-gunite's was written from that line plus the draw
schedule's "Covers" column. Migration `0017` revised them against the 2021 ISPSC
and Travis approved the result as written. They are Apex's procedures now.
Correcting one still means a new definition version, not an edit.

Known residue: customer milestone projections created before this migration still
carry the old `pre-gunite-released` milestone string, which is not one of the six
confirmed milestones. This is seeded local test data. A real deployment would need
a decision about historical projections rather than a silent rewrite.

## Action-card engine and Today feed — 2026-07-31

Build-plan Step 4. One derivation layer produces every card on the Today feed;
the daily brief and notifications will be views of the same cards rather than
parallel logic.

Twelve card kinds, all derived from stored state:

| Section | Cards |
|---|---|
| Things need you | countersign held, gate blocked, gate ready to sign, draw released but unbilled, no approved takeoff, job not opened as a project, no superintendent assigned, target completion passed |
| Running | gate in progress with requirement counts, gate for the current phase not opened, recorded risk |
| This week | next phase's gate, target completion approaching |

| Commands | Result |
|---|---|
| `pnpm verify` | **192/192 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| HTTP verification against the local dev database | Six card kinds derived from real state across two jobs, pinned to a day and byte-identical across repeat calls |
| Browser verification | Today renders three sections with per-card action, reason, consequence, urgency, and link; empty sections say so explicitly; no console errors |

Design decisions worth challenging:

- **The derivation is pure and takes `today` as an argument.** It reads no clock
  and no database, so the feed is reproducible and every rule is unit-testable
  without fixtures. The API resolves the date; the rules never do.
- **Card ids are derived, not minted** — `kind:jobId:subject`. The same condition
  yields the same id on every refresh, which is what later makes snooze and
  acknowledge possible without a table.
- **A card must state a consequence or it is not generated.** "Gate is in
  progress" is not a card; "all eleven clear, signing releases Draw 2" is.
- **Finished jobs go silent.** Complete, closed, and cancelled jobs produce
  nothing. Leaving their cards up teaches the owner to skim past the feed.
- **Cards are suppressed when they would ask for the impossible.** A job with no
  approved takeoff gets the takeoff card, not "open the Excavation gate" — the
  Gate cannot open, and one accurate card beats two.

Bug found and fixed while wiring this: the job read model was reporting the
approved takeoff revision **off the current Gate** rather than off the job, so a
job with an approved revision and no Gate yet reported having none. That was
already wrong on the Project detail screen since Step 1; it would have put a
false "approve a takeoff" card in front of the owner.

Not built: snooze, delegate, and acknowledge (§9.5's feed rules), and the
notification channels in §15. Both want the same card identity that now exists.

## Draw schedule and ready-to-bill — 2026-07-31

Build-plan Step 6, taken before Step 5 because inspections are still blocked on
Apex's inspection list and lead times, and the draw schedule is fully confirmed.

The 10 / 30 / 30 / 20 / 10 from Apex's contract, bound to the four draw-bearing
Gates, with the Deposit released by contract signing.

| Commands | Result |
|---|---|
| `pnpm verify` | **229/229 root tests** and **1/1 integration test** passed; strict TypeScript project build and the app typecheck passed |
| Live dev database | The real Whitaker contract of **$152,041.73** split to **$15,204.17 / $45,612.51 / $45,612.51 / $30,408.34 / $15,204.20** — summing to the contract exactly |
| HTTP verification | Confirming the deposit invoice moved $15,204.17 out of ready-to-bill; billing the same draw twice and billing an unearned draw both refused with 409 |
| Browser verification | Project detail shows all five draws with amount, percentage, release condition, invoice reference, and the contract/ready/invoiced/collected/remaining summary; no console errors |

Decisions worth challenging:

- **One table, not two.** `draw_eligibility` was renamed to `job_draws` rather
  than joined by a new schedule table. Two tables tracking the same money is how
  a system starts disagreeing with itself about what it is owed.
- **Basis points, integer cents, remainder on the final draw.** A percentage of
  an odd total does not divide evenly. Every earlier draw is a clean floor of its
  percentage and the last one carries the few cents, so the arithmetic has to be
  explained once rather than five times. The allocator refuses to return at all
  if the parts do not sum to the whole.
- **Regenerating a schedule adopts what already happened.** A job that released
  draw-bearing Gates before it had a schedule keeps those releases and gets its
  amounts filled in. Status, release time, releasing Gate, and the amount on an
  already-invoiced draw are never overwritten.
- **Invoicing stays a human act with a name against it.** `invoiced_by` is
  required by a database constraint, not by convention. Apex OS never issues an
  invoice, and QuickBooks remains the financial authority.
- **Money is the owner's and the office's.** Creating a schedule and confirming
  an invoice are closed to `field` and to `superintendent`, unlike Gate release.

Known residue on the dev database: the Whitaker job carries a legacy
"Pre-gunite release" draw with no amount, created when every Gate release
produced a draw. It is a true record of what the system did at the time and was
left alone rather than deleted. A real deployment would need a decision about
such rows rather than a silent rewrite.

Still not built from §9.8: payment recording beyond a `paid` status, due-date
tracking on the feed, and any QuickBooks synchronisation.

## Single-origin serving and local pilot access — 2026-07-31

Two changes made after the owner could not reliably open the app.

**The Gate API now serves Apex OS at `/app`.** The Vite dev server previously
proxied `/api` across to the API, and when that hop failed the app reported "no
connection" while the API was running perfectly. One server, one origin, no
proxy — and the same shape a deployment takes. Vite still serves `/` for fast
iteration and should be ignored by anyone but a developer.

**`GATE_LOCAL_USER` removes the token paste for single-machine use.** Pasting a
short-lived JWT to look at your own jobs on your own laptop is friction with no
security value: the server binds to loopback, so anything that can reach it can
read the database file directly.

It is deliberately hard to enable by accident, and each guard is tested:

- Off unless `GATE_LOCAL_USER` names a real, active user.
- Refused unless the connection came from a loopback address.
- The listen host is fixed to `127.0.0.1` and is not configurable, because the
  trade is only defensible while "anything that can reach it" means this machine.
- A supplied token still wins, so roles remain switchable for testing.
- The server prints a warning at startup whenever the mode is on.

**This is not an authentication model.** A deployment reaching real users with
`GATE_LOCAL_USER` set has no access control at all. Production identity —
asymmetric/JWKS, TLS, provisioning, rotation — remains an open launch blocker.

| Commands | Result |
|---|---|
| `pnpm verify` | **234/234 root tests** and **1/1 integration test** passed |
| Tokenless local request | `GET /api/today` returns 200 with six cards and no Authorization header |
| Without the flag | The same request returns 403 |
| Unknown or inactive local user | Refused with 403 rather than assumed |

## Daily owner brief — 2026-08-02

Build-plan Step 8. A view over the action cards rather than new logic, so the
brief and the Today feed cannot disagree about what needs doing.

**The brief is generated once per day and frozen; Today stays live.** That is
the whole difference between them. The feed answers "what is true now"; the
brief answers "what changed since yesterday", and a brief that rewrote itself
through the day could not answer the second question at all. Migration `0014`
stores the delivered payload and makes `daily_briefs` append-only for the same
reason the event log is: a delivered brief records what someone was told that
morning.

| Commands | Result |
|---|---|
| `pnpm verify` | **261/261 root tests** and **1/1 integration test** passed; strict TypeScript build and app typecheck passed |
| Live database, three consecutive days | Aug 1 first brief (nothing new, nothing cleared) → Aug 2 compares against it, everything standing 2 days → Draw 1 invoiced → Aug 3 shows it under **Cleared**, ready-to-bill drops $45,612.51 → $0, and the untouched items age to 3 days |
| Browser | Renders at 375px with no overflow, 48px targets, three nav items; no console errors |

What it carries: things-need-you / running / this-week, what is new since the
last brief, what has cleared, how many days each item has been standing, and the
total a passed Gate has made billable.

Decisions worth challenging:

- **`amountCents` moved onto the action card.** The brief's ready-to-bill total
  was briefly parsed out of card titles with a regex; a copy change would have
  broken the figure silently. Money is data now, which also gives §16's "value
  of draws released but not invoiced" a number to read.
- **Nothing is "new" on a first brief.** There is no previous state to be new
  against, and calling every open item new would overstate the morning.
- **The brief names the four PRD §9.14 sections it cannot answer** —
  inspections, schedule conflicts, customer decisions, startup checks. A brief
  silently missing four of its nine sections reads as "all clear" on subjects it
  has never looked at.

The sample-data brief prototype is gone; the screen is wired to real state.

## Subcontractor visits and crew conflicts — 2026-08-02

The half of build-plan Step 5 that is not blocked (PRD §9.6). Inspections still
need Apex's inspection list, requesters, and lead times before §9.7 can be built;
crew scheduling needs none of that.

Migration `0015` adds subcontractors, dated visits, an append-only reschedule
history, and `gate_definitions.blocks_phase_key`.

**Two detections, both provable from stored facts:**

1. The same crew claimed by two different jobs on overlapping days.
2. Work booked into a phase whose guarding Gate has not released.

It reports nothing else. Material lead times, weather, travel, and crew capacity
are Apex's judgment, and a warning the system cannot substantiate teaches the
owner to dismiss the ones that matter. §9.6 explicitly does not ask for schedule
optimisation and none is done.

| Commands | Result |
|---|---|
| `pnpm verify` | **296/296 root tests** and **1/1 integration test** passed |
| Live database | A real double-booking staged across both pilot jobs — Lubbock Gunite Co. on Whitaker and Johnson for 2026-08-06 — surfaces on both projects and on the feed as urgent, alongside two before-gate warnings |
| Browser | Project detail shows a Schedule section stating each conflict in full on the row it belongs to; no console errors |

Decisions worth challenging:

- **`blocks_phase_key` is stated, not inferred.** "The gate before this phase" is
  not derivable from sequence: pre-gunite sits *on* the gunite phase and guards
  it, while every other gate sits at the end of the phase before the one it
  guards. Inferring from ordering would get the one irreversible gate wrong.
- **A conflicting booking is stored, not refused.** The crew genuinely is
  double-booked the moment someone writes it down; refusing the write would put
  that fact outside the system where nothing can surface it.
- **A move is recorded rather than the dates overwritten.** A crew told Tuesday
  and now expected Thursday is a fact somebody will have to answer for.
- **Dates, not times.** A gunite crew is booked for Tuesday, not 09:00–14:30.
  Modelling hours would invent precision Apex does not have.
- **Scheduling is closed to the field role.** Booking someone else's day is an
  office and superintendent act.

**Known noise, not yet changed:** a double-booking produces one card per job, so
one phone call currently shows as two urgent cards on the feed. That is correct
per job and correct on the project screens, but it may read as duplication on a
single-owner feed. Collapsing it is a small change if wanted.

Still not built from §9.6: notifying affected internal users after a schedule
change, which needs the §15 notification channels. Nothing is sent to
subcontractors, which satisfies "external notifications require approval in v1"
by construction rather than by control.

## Customer progress page — 2026-08-03

Build-plan Step 7 (PRD §9.11), and the last MVP item. Migration `0016` adds the
tokenized link, its access log, per-photo customer visibility, and the decisions
Apex is waiting on from a customer.

This is the only surface in Apex OS that a person outside the company can reach,
and it has no login. Every decision below follows from that.

**The page is not part of the Apex OS bundle.** It is server-rendered by the Gate
API at `/c/<token>` and contains no JavaScript at all. Routing it inside the
staff single-page app would have shipped every staff screen, the pilot-token
sign-in, and the `/api` client that carries a bearer token to a homeowner's
phone. A customer receives a string of HTML and a stylesheet.

**The payload is built, never filtered.** `buildCustomerPage` in `@apex/domain`
constructs each field from an input type that never carries a contract value, a
risk note, a subcontractor, a visit, or a draw. §9.11's hide list is enforced by
absence, so a new column on `projects` cannot reach a customer by being
forgotten about.

**Only the SHA-256 of the token is stored.** The token exists in the clear once,
in the response to issuing or rotating, and is not recoverable. A leaked backup
hands out no working links.

| Commands | Result |
|---|---|
| `pnpm verify` | **348/348 root tests** and **1/1 integration test** passed (52 new: 14 projection, 30 service, 8 over HTTP) |
| Live database | A link issued on a seeded pilot job serves the real page — six milestones with Shell current, three published photos, two open decisions, one milestone update, and a call/text route — to a request carrying no credentials |
| Browser | Customer page renders at 375px with no console errors; raising a decision from the staff screen puts it on the customer page immediately; rotating the link 404s the old one |

Decisions worth challenging:

- **Issuing twice is refused, not silently a rotation.** "Send the customer their
  link" and "invalidate the link they already have" are different intentions and
  one must not perform the other by accident.
- **A revoked link and an invented one are indistinguishable** — same status,
  same bytes. Telling a stranger a token used to be valid tells them the scheme
  is real and worth guessing at. The revoked read is still logged internally,
  which is the point of keeping the log.
- **A photo is invisible until published, and the internal caption is never
  shown.** Gate evidence proves a bar spacing; its caption may name a
  subcontractor or quote a checklist item. Only `kind = 'photo'` can be
  published, enforced by a check constraint.
- **The page takes no input.** A tile selection submitted from a link with no
  login is not evidence the customer made it. Decisions are displayed and
  answered by phone or text, which a staff member records.
- **The access log is coarse on purpose.** An IPv4 /24 or IPv6 /48 and a
  truncated user agent — enough to notice a link being read from three cities,
  not enough to profile the person reading it. An unknown token records nothing;
  there is no link to attach it to.
- **Photos are cached for ten minutes on the customer's own device.**
  Re-downloading a gallery over cellular on every visit is a real cost. The trade
  is stated rather than hidden: for that long after a revocation, photos already
  on that device still open.

**Open launch blockers this does not close:**

1. **Deployment.** The Gate API binds to loopback, so a link issued today reaches
   nobody outside the machine that issued it. A live customer link needs the
   managed environment and TLS already tracked below. The staff screen says so
   rather than letting someone send a link that cannot open.
2. **Contact route.** `APEX_CUSTOMER_CONTACT_PHONE` is unset by default and the
   page then shows no call or text button. A page printing a number nobody
   configured is worse than one printing none.
3. ~~**Copy review.**~~ Closed 2026-08-03: the nine per-phase customer
   descriptions in `packages/domain/src/customer.ts` were approved as written.

Not built from §9.11: nothing. Deliberately out of scope: customer-submitted
answers, and any per-phase date on the page — Apex OS holds a target completion
window, not a schedule anyone committed to, and a date there is a promise the
system cannot keep.

## Inspections and gate checklist v-next — 2026-08-03

Build-plan Step 5's inspection half (PRD §9.7), which had been blocked since the
plan was written, plus twelve additions to the gate checklists. Content proposed
in `docs/inspections-and-gate-checklists-2026-08-03.md`, built ahead of approval
by explicit instruction, and **approved as written by Travis Sandoval on
2026-08-03 with no corrections**. Future corrections land as a new version.

**Migration `0017`** copies all seven active gate definitions forward a version
and adds twelve requirement items. Three are safety items that were missing
entirely: VGB-compliant anti-entrapment outlet covers (ISPSC §310) at pre-gunite
*and* at final, and the safety barrier, gates, and alarms (ISPSC §305) at final.
A pool could previously pass every Gate in Apex OS and be handed over with no
compliant barrier. Thirty-four checklist items become forty-six.

**Migration `0018`** adds the seven inspections, their lead times, and where each
one stands per job. The list is derived from the 2021 ISPSC and NEC 680 — the
adopted code, already confirmed in the construction model — sequenced against the
nine phases. It is fixed by migration, like the phase model.

| Commands | Result |
|---|---|
| `pnpm verify` | **396/396 root tests** and **1/1 integration test** passed (48 new: 22 deadline logic, 24 service and feed, plus the vertical slice now clearing inspections) |
| Live database | A job with the gunite crew booked for 13 Aug shows all three pre-gunite inspections due 11 Aug, derived from the booking; a failed bonding inspection carries its corrections; the four inspections with nothing booked behind them show no deadline at all |
| Browser | Project detail renders the Inspections section with deadlines, corrections, and call-in/result actions; no console errors |

Decisions worth challenging:

- **Lead times are rounded up, not estimated.** Two business days for routine
  trade inspections, three for finals. The error is one-directional: too long
  warns a day early, which is harmless; too short warns a day late, which is a
  crew standing on a job that cannot proceed. Tighten once real turnaround is
  known — it is one number per row.
- **The deadline is anchored to the crew booking.** `neededBy` falls back to the
  earliest live scheduled visit in the blocked Gate's phase. The alternatives —
  the project's target window, or phase sequence — are too coarse or invented. An
  inspection with no booking behind it shows **no deadline at all**, because
  without a planned date there genuinely is nothing to be late for.
- **A release actually fails.** §9.7's "block dependent work" is enforced in
  `GateService.execute`, not surfaced as a warning. Waiving is the escape hatch
  and is a recorded act with a stated reason.
- **The guard runs after authority and the checklist, not before.** First
  written the other way round, which meant an unauthorised user was told about
  inspection state instead of being refused. Order now: authority → requirements
  → inspections.
- **An untouched inspection blocks.** Null status counts as outstanding. A system
  that only looked at recorded rows would let a pour proceed because nobody had
  written anything down — which is the failure mode, not the safe case.
- **Weekends only, no holiday calendar.** A city holiday makes a deadline one day
  optimistic. The rounded-up lead times absorb roughly that much; worth
  revisiting the first time someone misses an inspection over Thanksgiving.

**Open launch blockers this does not close:** deployment and identity, unchanged.
The content itself is no longer open — approved 2026-08-03.

**Worth revisiting once real inspections run:** the lead times were approved as
conservative planning figures, not as measurements. If Lubbock actually turns
these around next-day, tightening each row is one number and makes every warning
sharper. Nothing breaks in the meantime; the deadlines simply fire a day early.

## Designer contract in CI — 2026-08-03

The one test that reaches outside this repository now has a CI path. The workflow
checks the private `apex-designer` repository out into `Apex Designer/` with a
read-only deploy key and runs `integration-tests/designer-contract.test.ts`
against the real engine, rather than skipping it as it has since the test was
written.

Source only — the Designer engine imports nothing outside its own tree, so there
is no second install — and `Apex Designer` was already in `.dockerignore`, so the
container build is untouched.

| Commands | Result |
|---|---|
| `pnpm verify` | **436/436 root tests** passed; integration **3 passed / 14 skipped**, the Designer contract test among the three |
| Guard exercised both ways | With the engine path broken and `APEX_REQUIRE_DESIGNER_CONTRACT=1`, the run **fails** naming the missing path; with the variable unset the same state **skips** and exits 0 |
| YAML | Workflow parses |

Decisions worth challenging:

- **A skip has to be able to fail.** `APEX_REQUIRE_DESIGNER_CONTRACT` is set only
  where the checkout was supposed to happen. Without it, a checkout landing in
  the wrong directory or a revoked key would show up as a green run with one
  quiet skip — indistinguishable from coverage. The variable is what makes the
  new signal trustworthy, and it was tested by breaking it rather than by
  reasoning about it.
- **The checkout is conditional on the secret, and says so out loud.** A fork, or
  this repository before the key is added, cannot read `apex-designer` and must
  not fail on a secret it was never going to have. That leniency is announced
  with a workflow warning rather than left silent.
- **`secrets` is not available in a step-level `if`.** It is routed through a
  job-level `env` boolean, which carries whether the key is configured and never
  the key.
- **The deploy key is read-only.** A writable key in a workflow is a way to
  rewrite the quantity authority from a pull request.

**Still open, and it is yours:** the secret does not exist yet, so CI warns and
the test skips exactly as before. Four steps in
[`docs/runbooks/deployment.md`](runbooks/deployment.md) §8.

## Apex Designer becomes a drawing tool — 2026-08-04

Unmerged, on `apex-designer` branch `feat/builder-design-tool` (11 commits).
Designer was a calculator that printed a plan. It is now something a builder
draws in, with the takeoff running underneath rather than in front.

| Commands | Result |
|---|---|
| `npm test` (Designer) | **380/380 passed**, up from 318 |
| `tsc --noEmit`, `vite build` | Both clean |
| Designer contract with `APEX_REQUIRE_DESIGNER_CONTRACT=1` | **Passes** — the approved-quantity digest did not move |

What it gained: three preset sizes (12×24, 15×30, 20×40, each with a corner spa
and spillover — roughly 90% of Lubbock work); drag to move and to resize, on the
plan and on a now-draggable section; add and remove for steps, benches, tanning
ledges, bubblers, deck jets and spa jets; property lines drawn and dimensioned
for the city submittal; a longitudinal section carrying the depth dimensions a
plan cannot show; an order list; saved designs in localStorage; and the real
Apex brand tokens from the website.

Decisions worth challenging:

- **Placement does not affect quantities.** Step displacement comes from tread
  size and count, bench volume from its own dimensions. That is what allowed a
  whole move-and-resize layer to land without touching the seventeen signed
  quantities or the digest over them.
- **The spa's own suction and return went on the presets, not on
  `STANDARD_MODEL`.** Developed run length is one of those seventeen quantities
  and `STANDARD_MODEL` is the fixture the digest is pinned against. Adding
  plumbing there would have moved it. The contract test was run explicitly to
  confirm it did not.
- **Step and bench measurements are printed, not signed.** Total rise, tread
  depth, riser list, tread area: derived from inputs the payload already covers
  and deliberately kept out of it. Promoting any of them is a version bump.
- **Property lines are drawn and dimensioned but never code-checked.** No
  Lubbock property-line setback has been recorded, and a PASS badge against a
  limit nobody supplied would be a fabricated compliance claim on a drawing
  going to a plan reviewer.
- **Spa jets are a count, not six placed objects.** Six in the wall is the Apex
  standard and a count is the level anyone specifies or orders at.
- **A drag can only produce buildable geometry.** Objects hold one degree of
  freedom along a wall; a shorter pool gives up its deep flat first, then the
  transition, then the shallow flat; floors cannot cross; the pool cannot be
  dragged narrower than a spa set into it. The rules are pure functions with
  their own tests, so the drag handler contains no policy.

Three bugs of one shape were found by driving the tool rather than reasoning
about it, and are worth knowing because the pattern will recur: **React batches,
so anything that reads a prop to compute its next value loses every edit but the
last when several land in one task.** It cost a dropped drag, three keyboard
nudges collapsing into one, and an added bubbler vanishing. Each is fixed by
chaining off what the component actually emitted.

**Not built:** a rotate tool, and a deck that is anything other than a uniform
border width.

## Proposal builder was inert — 2026-08-04

Unmerged, on `apex-proposal-engine` branch `fix/builder-runs-in-a-browser`.

Clicking "Generate customer proposal" did nothing. So did everything else on the
page — every output read "—". Two stacked faults: `node:crypto` imports meant a
browser could never evaluate the module graph, so no handler was ever attached;
and underneath that, `index.html` called the production takeoff path, which
throws without an approved Designer revision it has no way to supply.

| Commands | Result |
|---|---|
| `engine.test.mjs` | **119/119** |
| `whitaker-evidence.test.mjs` | **11/11** — the hash-pinned checks that prove the digest did not move |
| `browser-graph.test.mjs` | New. Fails if a `node:` import returns or the page calls the production path |

The SHA-256 was reimplemented with no runtime-specific import rather than split
across a conditional — two implementations of a tamper-evidence function are
free to disagree. Verified against the published NIST vectors and byte-identical
to `node:crypto` across 201 lengths spanning every padding boundary.

**Draft pricing works; issuance is still fail-closed.** A 24×14 with spa prices
at $69,653 cost / $90,548.90 customer price, and the issue gate refuses with
both real reasons — no approved Designer revision, and seven direct-entry lines
unquoted.

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
