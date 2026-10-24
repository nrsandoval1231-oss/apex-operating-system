# Milestone 2: canonical ordinary checklist

Implemented in `/workspace/apex2`, branch `codex/apex-2-checklist`, foundation `d139366` (PR32). No push, merge, deployment or subagents. Working tree clean after two coherent commits:

- `3739ec5` — contracts, canonical TaskId, migration0037, TaskService, staff API and real PostgreSQL integration/API tests.
- `c989222` (`c989222209da4115bacb09ddfb368e698a509205`) — Checklist UI, Today panel, stable intent client keys, browser acceptance and client regression.

## Persistence and authority

Exactly one ordinary-task model serves personal/project/mobile/Today work. `tasks.snapshot` is the canonical strict-contract state; relational job/creator/assignee keys support FK integrity and visibility lookup and are CHECK-constrained against the snapshot. Unique parent-task FK prevents duplicate recurrence successors. `task_history` stores append-only actor/action/time/full-state snapshots; `task_receipts` stores append-only normalized request bindings and exact saved responses. Database triggers refuse audit/receipt UPDATE/DELETE. Operational migration list includes `0037_checklist.sql`.

The service validates active staff against app_users, does not trust elevated token roles, and filters personal reads to creator/current assignee. Unrelated managers cannot read/edit private tasks. Project reads intentionally retain existing staff-wide job visibility. Project edits require creator/assignee or admin/office/superintendent. All project writes resolve stored immutable job association, lock owning job with assertJobMutable before task row, and refuse closed/cancelled projects. Assignment uses active-staff validation and shared user lock; recurring completion explicitly refuses an inactive assignee until reassigned.

Receipts bind key to actor/action/target/strict normalized body. Advisory transaction key locks serialize same-key creates. Retries validate current visibility and return the saved response even after later edits; changed actor/action/target/payload refuses without disclosure. Completion requires expectedRevision and task row lock. Completion and new independently identified recurring occurrence commit atomically; dates remain on completed rows. UTC civil arithmetic clamps month end. No task command writes gates, phases, canonical business events or lead follow-ups.

Existing lead_followups remain authoritative pre-contract work with their own lifecycle/office authority. Checklist shows due/missing opportunity follow-ups as explicitly labelled links to the opportunity; no duplicated task rows or generic completion path. Today retains operational action cards and pre-contract cards. Its operational stamp now explicitly describes operational counts rather than claiming all work is clear while checklist tasks remain.

## Staff interaction

Real `/checklist` page, inline create/edit, assignee/project/due/priority/detail/recurrence/milestone fields, Today/Overdue/Upcoming/Assigned/Completed/All and project filtering, completion history, loading/error/empty/busy feedback. Personal sharing by assignment is explained in composer. Forms wait for real identity/assignee/job lookups before initializing current-user/project defaults. Quick action query intent reacts to location.key for repeated same-route navigation; initial action URL stays intact, and successful save/cancel clears action while retaining project. Create/edit and completion retain stable intent keys after uncertain responses. Checkbox state changes only after successful server response; known closed/cancelled project tasks disable completion/edit. Checkbox hit targets 44px with 22px visual checks, charcoal/gold tokens, scoped control styles and responsive form/header.

Reusable component: `apps/apex-os/src/components/Checklist.tsx`, default export accepting `{ compact?: boolean }`. Compact mode changes initial view to Today and omits duplicated opportunity links. Standalone project filter initializes from `?project=`. No external selected-job/readOnly prop yet; M4 may add those when embedding in project detail, reusing the same useTasks/API/task model. Backend remains authoritative for immutable projects regardless of UI.

## Verification — final results

All commands run from `/workspace/apex2` against synthetic local data only. Existing baseline full CI was independently supplied by root (1383 pass/2skip); it was not rerun or claimed as this worker's result.

1. `pnpm typecheck` — exit0 (final after all code changes, including route formatting and action handling).
2. `pnpm --filter @apex/os build` — exit0. Existing Zod pure-annotation and large chunk warnings only. Log `/tmp/apex2/checklist-build.log`.
3. `DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2 pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/checklist.test.ts --maxWorkers=1 --no-file-parallelism` — exit0, **9 passed / 0 skipped**. Actual PostgreSQL (8 pool connections), not PGlite. Coverage: persistence via new service instance, creator/assignee personal isolation including unrelated admin/history denial, exact historical retries and mismatch actor/action/body, inactive/customer users, stale revision, same-key concurrent completion (three calls), different-key concurrent completion, one successor, month/leap/year clamping, inactive recurrence assignee, staff project visibility/manager authority, zero job/gate/event changes, closure/cancellation lock races, immutable history/receipt triggers, strict API/unauthenticated/customer access. Job closure race uses a held job row lock, concurrent completion, then closure/cancellation commit; completion rejects and no successor appears.
4. `pnpm exec vitest run apps/apex-os/src/api/client.test.ts packages/gate-service/src/leadFollowup.test.ts --maxWorkers=1 --no-file-parallelism` — exit0, **8 passed / 1 skipped**. Skip is existing optional real-PG lead-followup regression because this narrow command did not set DATABASE_URL. Existing lead-followup tests unchanged. Client-only rerun `pnpm exec vitest run apps/apex-os/src/api/client.test.ts --maxWorkers=1 --no-file-parallelism` — exit0, **4 passed** including stable caller intent key.
5. `DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2 node apps/apex-os/tests/checklist.e2e.mjs` — exit0, **3 browser acceptance groups passed**. Starts real API on4196 and real PostgreSQL, JWT application user, no fake API responses. 1440px and390px create/reload/edit/reload/complete/reload, filters/history, 44px target, no horizontal overflow/runtime errors and DB row checks. Desktop create acknowledgement deliberately lost after actual API commit; retry yields exactly one row. Mobile completion acknowledgement deliberately lost after commit; checkbox remains unchecked until exact retry succeeds. Cancel then repeat same-route Quick Add reopens composer. Third group delays real lookup requests then continues them, checks selected project/current assignee defaults from deep link and actual stored project association.
6. Existing unchanged `apps/apex-os/tests/shell.e2e.mjs`, invoked via `/tmp/apex2/run-checklist-shell.mjs` with real API4196 and `APEX_SHELL_URL=http://127.0.0.1:4196/app` — exit0. **1440/390 shell groups + signout/401/503 cases passed**, including original exact action URL/project retention assertion. This shell test intentionally intercepts browser API reads as documented in its pre-existing source; it is navigation/auth presentation evidence, not the checklist persistence evidence above.
7. `git diff --check` — exit0. Final `git status --porcelain` empty.

Screenshots inspected visually after final polish: `/tmp/apex2/screenshots/checklist-1440.png`, `/tmp/apex2/screenshots/checklist-390.png`; server log `/tmp/apex2/checklist-browser-server.log`. Existing shell screenshots regenerated by its unchanged harness.

Initial local test attempts exposed and resolved test setup issues (root-level jose module resolution, valid closed-job fixture reconciliation fields, existing unauthenticated403 convention) and browser harness assumptions (select accessible label, asynchronous non-optimistic checkbox assertion). Final passing evidence above is from corrected tests and final implementation; no existing assertions weakened.

## Boundaries/concerns

No reopen/delete command was added; completed occurrences remain immutable with viewable audit. History labels can show “Inactive assignee” after a user becomes inactive because the selectable user list intentionally includes only active staff; canonical actor IDs/full snapshots remain in API history. Recurrence is generated on successful completion, not bulk scheduled materialization. List/history reads currently return all visible records without pagination (pilot scope). Existing application-level staff ACL boundary applies; no RLS claim. No new dependency/framework, fabricated production data, gate lifecycle changes or division-specific construction assumptions.

## Independent review fix round 1

Addressed both Important findings from `/tmp/apex2/checklist-review.md` in commit `c4fc1002233ec46fdec1f86844c983784fa8ddb9` (`fix(checklist): snapshot history access and retain unavailable project intent`). Only four implementation/test files staged; root-owned docs, plans, validation and committed-screenshot candidates were left untouched and unstaged.

- History visibility and ordered audit entries now come from a single PostgreSQL SELECT joining tasks/task_history, with creator/assignee/project visibility in that same statement snapshot. A deterministic real-PG test intercepts the history read after its result snapshot, reassigns the task and appends a new private title, then allows the read to return. Only the earlier authorized snapshot appears; subsequent history access refuses. This reproduces the former split-read exposure without timing assumptions.
- Composer project association is now a controlled draft field. A missing/closed/cancelled selected project stays selected as an explicit unavailable option instead of browser fallback to Personal. Save refuses before issuing a request until the user chooses an eligible project or explicitly chooses Personal. Existing stable request-key and lookup initialization behavior remains. Real browser regression covers all three unavailable cases, checks zero POSTs and zero created rows, then explicitly chooses Personal and verifies its null job association in PostgreSQL.

Focused final commands/results:

- `DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2 pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/checklist.test.ts --maxWorkers=1 --no-file-parallelism` — exit0, **10 passed / 0 skipped** (includes deterministic history reassignment regression).
- `pnpm typecheck` — exit0 after final controlled project field.
- `pnpm --filter @apex/os build` — exit0; log `/tmp/apex2/checklist-fix-build.log`, existing bundle/Zod warnings only.
- `DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2 node apps/apex-os/tests/checklist.e2e.mjs` — exit0, **4 acceptance groups passed** after final controlled field. Existing desktop/mobile persistence and lost-ack retries, delayed lookup/project defaults, plus unavailable-project association regression. Synthetic realAPI4196/PostgreSQL throughout.
- `git diff --check` — exit0 before commit.

No broad/full test repetition, push, merge or deployment. Remaining worktree changes are root-owned documentation/artifact work listed above; worker implementation is committed.
