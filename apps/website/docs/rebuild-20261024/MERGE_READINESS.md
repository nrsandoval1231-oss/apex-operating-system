# PR38 merge-readiness follow-up — 2026-10-24

Candidate source/test commit: `dc6c658e67edf9bbdbaa7deef128f9c0b4959f70`. Website fixes are in `7909f13`; the final commit only repairs an inherited checklist test wait. The website branch incorporates OS main `98fb06b` through merge commit `6444813`; history was not rewritten. No merge into main, deployment, DNS change, production configuration or production data operation occurred during this follow-up.

## Corrections

| Finding | Fix | Regression evidence |
| --- | --- | --- |
| Successful quotes no longer emit `lead_submit` | Emit once only after a matching accepted/duplicate acknowledgement, using the frozen payload's vertical/source and no contact fields. Optional analytics failure cannot change successful intake into a retry. | Desktop/mobile acceptance and duplicate retry; production malformed/mismatched responses emit no event until confirmed retry; unavailable analytics still shows success. |
| Hero preselection uses stale submission state | Read the live pending-request ref in the mount-only listener. Keep the pending project/payload frozen during sending and ambiguous failure; definitive rejection still allows correction. | Actual hero clicks while sending and after network failure preserve the exact payload and allow successful retry. |
| Long attribution blocks valid quotes | Bound eight tracking fields at payload construction to the API's existing 200 UTF-16-unit limit, including existing session values. Preserve valid Unicode at the truncation boundary. Keep contact/project/consent validation strict. | Long URL and saved-session values; Unicode boundary; API persists 200-unit tracking fields and retains duplicate/conflict and oversized-contact checks. |

Tracking metadata beyond the accepted prefix is intentionally omitted from the submitted lead. Original first-touch session values remain unchanged. Business fields are not truncated. API limits, migrations, authentication, idempotency and deployment settings were not relaxed.

## Focused validation

Five browser regressions failed against the original code (missing event, pending CTA click, failed CTA click, URL attribution, stored attribution). After fixes, the focused browser run passed 12 desktop/mobile cases. The final Unicode assertion was added afterward and is covered by full CI, not claimed from that earlier run. The public-intake test file passed 9 cases with zero skips. Type checking passed after removing an attempted cross-application test import that violated the TypeScript project boundary; browser and API contract tests remain separate and preserve the assertions.

Commands: `corepack pnpm --filter apex-website exec playwright test tests/review-regressions.spec.ts`; `corepack pnpm exec vitest run apps/gate-api/src/publicLeads.test.ts`; `corepack pnpm typecheck`. All final focused commands exited0. Local logs are retained in `/tmp/apex-website-merge-evidence/` (`browser-red.log`, `browser-green.log`, `api-tests-fixed.log`, `typecheck-fixed.log`). The red runs and test-setup failure are not passing results.

The existing `tools/website-postgres-proof.mjs` also passed against a separate disposable PostgreSQL17 instance at loopback55442/database `apex_website_review`: concurrent requests returned201/200 with one canonical lead, changed content returned409, consent/project/attribution persisted, and the record survived adapter reopening. [Proof record](merge-validation/postgres-intake-proof.json). This used the real PostgreSQL adapter and handler, not an intercepted browser API. The browser regression tests explicitly intercept their reserved-domain endpoint.

## Full combined validation

**PASS**, exit0, **643.413seconds**, frozen source/test SHA `dc6c658e67edf9bbdbaa7deef128f9c0b4959f70`. [Exact result](merge-validation/ci.json) · [Counts/skips](merge-validation/summary.json) · [Full compressed log](merge-validation/ci.log.gz).

| Suite | Passed | Skipped |
| --- | ---: | ---: |
| Core | 605 | 0 |
| Designer | 585 | 0 |
| Website unit | 2 | 0 |
| Website browser | 49 | 1 |
| Production intake browser | 12 | 0 |
| PostgreSQL/storage | 71 | 2 |
| **Total counted cases** | **1,324** | **3** |

The website skip is the desktop invocation of a mobile-only menu test; its mobile invocation passed. The two integration skips are existing missing-engine failure guards; actual Designer and takeoff compatibility assertions ran. Skips are not passes. No infrastructure suite was omitted.

Additional staff browser groups passed: shell6, native IndexedDB6, checklist6, calendar16, workspace31, photos16. Estimate navigation, all five legacy proposal scripts, and both zero-optional-photo/optional-photo closeout paths passed. Their group/step counts are not added to the runner-case total. Type checks and production builds passed; the intentionally failing missing-webhook production build guard behaved as required. Existing bundle-size and color-environment warnings remain; no new performance claim is made. [Operational migration verification](merge-validation/migrations.json) confirms all39 registered migrations and47 public tables after the initially empty database run.

Exact invocation from `/workspace/apex-website-merge`:

```bash
source /tmp/apex-website-merge-evidence/final/env.sh
export APEX_CI_EVIDENCE_DIR=/tmp/apex-website-merge-evidence/final/browser
python docs/audit/tools/run-command.py ci /tmp/apex-website-merge-evidence/final bash scripts/ci.sh
```

The [preflight environment](merge-validation/environment.json) records zero initial public tables in `apex_website_merge_final` at127.0.0.1:55432 and zero objects in the local Moto bucket `apex-website-merge-final` at127.0.0.1:59000. Node24.19.0, pinned pnpm11.18.0, PostgreSQL17.11, Moto5.1.15 and Playwright1.62.1 were used. The source/test commit and HEAD stayed fixed during CI; subsequent evidence updates are documentation only. No separate lint command is configured.

## First combined run and test correction

The [first full CI attempt](merge-validation/initial-ci.json) at `7909f13` exited1 after595.846seconds. Core605, Designer585, website unit2, website browser49 (one intentional skip), production intake12 and PostgreSQL/storage71 (two existing guard skips) passed. It then exposed a timing flaw in the checklist browser regression inherited from main: waiting for the “Save task” label to disappear also matched the immediate “Saving…” state, before the POST committed. Its database assertion could therefore run too early.

Test-only `dc6c658` waits for the exact task edit POST response, asserts200 and `assignedUserId:null`, waits for the assignment field to close, and retains the database assertion. All six checklist browser groups passed in the focused rerun; independent scoped review approved the correction with no weakened assertion. The first full run is **failed**, not counted as a full pass. Final results above come from a separate full run on the final source/test SHA and new empty infrastructure.

## Review and release boundary

[Independent focused review](merge-validation/review.md): all three findings addressed, source approved, no Critical/Important issue found within scope. The review covers the fixes and concrete integration with OS main; it is not a fresh whole-site or production certification.

The earlier staging preview has not been redeployed to this candidate and remains historical evidence only. Its temporary tunnel/local fixture must not be treated as durable production intake. Live provider/Access/exact-origin/edge-abuse configuration, legal/SMS/business approval, analytics property IDs, approved-mockup comparison and production cutover remain separate conditions in [CUTOVER.md](CUTOVER.md). Passing local CI establishes merge validation, not production acceptance. This follow-up leaves PR38 open for merge approval.
