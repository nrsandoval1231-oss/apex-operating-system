# Apex Current Status

**Last updated:** 2026-07-28

**Program phase:** Phase 0 — Preserve and stabilize

**Production status:** Not production-ready

**Current source of truth for status:** This file

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
- 305 engine tests verified passing on 2026-07-28
- Production build and standalone artifact generation previously verified
- No production dependency vulnerabilities in the most recent audit

**Launch blockers**

1. Attached spa is omitted from excavation and most shell/reinforcement quantities.
2. Hydraulic and gas failures do not roll into the global blocking flag.
3. Gas-table selection can depend on input order and silently use a shorter length row.
4. Runtime job-file validation is incomplete and malformed nested inputs can crash later.
5. Duplicate physical facts, including shell thickness, can diverge between modules.
6. Job editor covers only part of the domain model.
7. React and standalone renderers have content/layout drift and no browser/PDF integration tests.
8. Placeholder inputs and standard-detail assumptions require expert reconciliation.

**Use restriction:** Do not use for material ordering or safety-critical field decisions until blockers 1–5 are fixed and independently reviewed.

### Proposal Engine

**Strengths**

- Pure dependency-free calculation core
- 90 checks previously verified passing
- Explicit distinction between fee/markup and true margin
- Useful report and browser proposal prototype

**Launch blockers**

1. Whitaker's 0.0% modelled-code result is calibration, not independent validation.
2. Approximately $47,302 / 40.4% of the full reference job remains unmodelled in the current back-test.
3. Zero and negative dimensions/fee rates are accepted.
4. Customer proposal generation is not hard-blocked when required direct-entry scope is unresolved.
5. `calibrate.mjs` is stale/broken and can generate incorrect pricing guidance.
6. Proposal output is disconnected from `lead_id`, `job_id`, CRM, and Gate.
7. No proposal versioning, audit trail, persistence, or deployment controls exist.

**Use restriction:** Do not represent the calibration result as independent validation. Disable calibration use until repaired and validated.

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

**Launch blockers**

1. Prototype only; all state resets on reload.
2. Primary “Sign this gate” button has no action.
3. No identity, authorization, immutable signature, or audit trail.
4. Checks do not support evidence, expiration/freshness, roles, or versioned definitions.
5. Photos, inspection requests, notes, billing, and sharing are simulated.
6. Schedule is hardcoded and not connected to an authority.
7. Chemistry dosing is advisory logic without input bounds, product-specific instructions, or expert approval.
8. Accessibility and secure customer-link behavior are not implemented.

## Integration status

Currently aligned:

- Website and intake lead fields
- Lead ID concept
- Four-vertical vocabulary
- Job-status event concept
- Shared cost-code strategy in PRDs

Currently disconnected:

- Proposal to lead/opportunity/job lifecycle
- Designer quantities to Proposal pricing
- Job creation to Gate
- Gate events to draw release and QuickBooks
- Customer view to approved operational events
- Completed jobs to pricing calibration, Meta, reviews, and commissions

## Artifact and documentation drift

The following claims must not be reused without correction:

- “Not fitted to the answer” for the Whitaker calibration job
- 0.0% variance presented as whole-job or independent validation
- Old 13-slide strategy-deck references
- Old proposal test counts of 82 or 87; current verified count is 90
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

An additional temporary Phase 0 verification script passed **75 targeted assertions** covering backup checksums, ZIP integrity, all six Git bundles, deck claim corrections, generated deck contents/slide counts, Office package structure, ignore rules, dependency audit, and whitespace hygiene. This was ad-hoc verification, not a substitute for the component suites above. The script was removed after execution.

PowerPoint visual rendering was not completed because the headless COM export approval timed out. Structural validation passed, but slide-level visual QA remains pending before the corrected decks are used externally.

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
