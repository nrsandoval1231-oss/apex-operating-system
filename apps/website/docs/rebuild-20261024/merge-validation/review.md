# Focused independent review — PR 38 corrections

Reviewed source: `7909f135bf3f6f90e3fd9943ddadb36fe00deb1c`.
Fix base: `6444813bd9e712a3b88c0b1760c0c01962a1eb22`, which merges website `868985e` and OS main `98fb06b`.
Scope: the three confirmed findings, their regression tests, and concrete compatibility with integrated main. Read-only inspection; no checkout, index, branch, source mutations, subagents, or test-suite reruns. This report is the only file written.

## Strengths

The correction is small and addresses the root causes. The event listener now consults stable live request state, conversion reporting follows verified acknowledgement, and attribution normalization occurs at payload construction so old sessions are covered. Optional analytics failure cannot change a successfully accepted submission into a retry. The API validation, canonical persistence and idempotency contract remain strict.

## Original findings

1. **ADDRESSED — missing confirmed conversion event.** `apps/website/src/components/QuoteForm.tsx:49` verifies HTTP success and the matching accepted/duplicate response before reaching the event at line 56. `apps/website/src/lib/intake-response.ts:5` requires the submitted lead ID and a nonempty canonical ID. Event vertical and source come from the frozen request at line 50, not mutable UI or current URL state. The event contains no contact fields. The nested try/catch isolates optional telemetry failure. Regression coverage verifies a single event after acceptance and after a duplicate acknowledgement on retry; the production rejection/mismatched acknowledgement cases assert no event before confirmed retry.

2. **ADDRESSED — hero preselection clears project during pending/error and blocks retry.** `apps/website/src/components/QuoteForm.tsx:27` uses `pending.current`, which the mount-only handler can read live. Pending state is created before fetch and retained on ambiguous failure, so preselection cannot clear project type while sending or waiting for safe retry. Definitive 400/422 rejection clears it at line 48, permitting correction. Both sending and error scenarios click the actual hero CTA and assert exact payload equality across retry (`apps/website/tests/review-regressions.spec.ts:16`).

3. **ADDRESSED — long attribution rejects otherwise valid quotes.** `apps/website/src/lib/lead.ts:113` trims and bounds metadata at 200 UTF-16 units and removes a terminal high surrogate created by truncation. Lines 129–136 apply it to all eight tracking fields, including existing session values and page_submitted. Fallbacks remain short valid strings. The limit agrees with `apps/gate-api/src/publicLeads.ts:8` and its schema at lines 28–29. Contact, project and consent validation are not truncated or weakened. `apps/gate-api/src/publicLeads.test.ts:54` exercises persistence of all eight 200-unit fields, duplicate replay, changed-content conflict, and continued rejection of oversized contact/tracking data.

## New findings by severity

- Critical: none found in scope.
- Important: none found in scope.
- Minor: no actionable source defect found in scope.

No new breakage was identified in the reviewed correction. This is a focused source assessment, not a claim that all possible website behavior has been audited.

## Main integration compatibility

Main `98fb06b` is an ancestor of the reviewed source. Inspection of the merge and the diff against main shows the public intake is an additive exact-path handler (`apps/gate-api/src/server.ts:749` and `publicLeads.ts:81`); unrelated OS routes continue through the existing handler. The merged server retains main's Task, Calendar, Workspace and JobPhoto services. Public intake defaults off, and main.ts/container additions only carry its explicit enablement and origin configuration. The correction itself changes no routing, schema, migrations, shared contracts, OS implementation, lockfile or deployment configuration.

The scripts/ci.sh and shared contract exports are unchanged relative to main, preserving the expanded OS acceptance suite rather than replacing it with website checks. The website lockfile additions relative to main are additive font/accessibility packages. No concrete contract or integration clash was found. Full runtime integration verification remains the separate CI gate below.

## Evidence and test limits

Inspected supplied logs: browser-red.log records five failing original-code cases; browser-green.log records 12 passing desktop/mobile regression cases; api-tests-fixed.log records 9 passing API tests; typecheck-fixed.log records the corrected typecheck invocation with no reported error. The brief explicitly says the Unicode-boundary assertion was added after that focused browser run. Its execution and the expanded production acknowledgement checks must therefore be established by the frozen-source CI result, not inferred from the earlier log.

The attribution browser test intercepts HTTP rather than exercising the real API. The separate API test checks actual acceptance/persistence at the same contract boundary, which provides reasonable layered coverage for this change. Nonblocking coverage limits: page_submitted is checked for bounded length on a short route rather than a long pathname, and the API persistence boundary case uses ASCII rather than a surrogate-pair value. The shared normalization implementation is directly readable; these are not identified functional failures or required source corrections.

Full CI with disposable PostgreSQL/Moto was pending when this review was prepared. No full-CI PASS is claimed, and no suites were duplicated by this reviewer.

## Declined to judge

- Production legal/SMS compliance and accuracy of business claims: owner/legal review is a documented CUTOVER gate and is not established by these fixes.
- Production provider/Cloudflare Access bypass, trusted-edge abuse controls, exact origins, managed persistence, live delivery and domain cutover: deployment/configuration verification remains in CUTOVER; no deployment was requested.
- Visual approval against the missing approved mockup, exhaustive SEO/media/copy review, and unrelated whole-site redesign: outside the focused correction scope.
- Current behavior of the historical staging preview: it has not been updated to this source and cannot certify it.
- Arbitrarily corrupted session data containing pre-existing lone surrogates or NUL characters: the confirmed defect is overlength ordinary URL/session attribution; this patch prevents a valid surrogate pair from becoming invalid at its new truncation boundary, not general sanitization of arbitrary corrupt storage.
- Full CI success, Windows wrapper execution, live production readiness, and authorization to merge/deploy: these are separate evidence or authorization gates, not source conclusions.

## Assessment

**Source verdict: APPROVED for the focused corrections; all three original findings ADDRESSED.** No further source fix is requested from this review.

**Merge readiness: conditional on a successful required frozen-source full CI run and normal branch/PR checks.** CI is pending, not approved by this source verdict. No merge or deployment is authorized or performed by this review.

## Focused follow-up — checklist synchronization

Reviewed test-only commit `dc6c658e67edf9bbdbaa7deef128f9c0b4959f70` and checklist-wait-review.diff. Scope is exclusively the wait correction and preservation of assertions; no suites rerun or source changes made by reviewer.

**Verdict: APPROVED. No Critical, Important or Minor findings in this follow-up.** `apps/apex-os/tests/checklist.e2e.mjs:220` installs the response waiter before clicking, matches the exact task-edit URL and POST method, and then requires status 200 and returned assignedUserId null. It waits for the actual assignment field to disappear before the existing direct PostgreSQL assertion at line 228. The prior wait only observed the Save task accessible name disappearing, which also occurs when busy changes the label to Saving; source inspection of Checklist.tsx confirms that label change precedes the awaited API completion. The replacement synchronizes on the operation under test, without sleeps, retries that hide failures, mocks, or relaxed assertions. Existing unavailable-assignee preservation/reload checks and the persisted-null assertion are retained; acknowledgement assertions add coverage.

Inspected checklist-wait.log: all six focused checklist groups passed, including desktop/mobile unavailable-assignee preservation and explicit-unassignment persistence. This corroborates the synchronization fix but does not certify the full suite.

The original full CI run on 7909f13 **failed** at this inherited checklist synchronization race; its earlier passing stages do not convert that run into PASS. Per coordinator evidence, those stages included 605 core, 585 Designer, 49 website browser tests (plus one expected desktop skip), 12 production browser tests and 71 PostgreSQL tests (plus two guards). The restarted full CI on final source dc6c658 remains **pending** at this follow-up review. The source approval of the three website corrections remains valid; overall merge readiness still requires successful final-source full CI and normal PR checks. No expanded production certification or merge/deployment authorization follows from this addendum.

## Coordinator final validation

The pending full-CI gate subsequently passed at `dc6c658e67edf9bbdbaa7deef128f9c0b4959f70`, exit0,643.413seconds:1,324 runner cases passed and3 disclosed skips, with all additional staff browser and closeout acceptances passed. Source/tests were frozen throughout; later commits update evidence only. See [merge readiness](../MERGE_READINESS.md). This completes local merge validation, not production certification.
