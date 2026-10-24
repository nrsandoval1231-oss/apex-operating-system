# Milestone 3 calendar implementation report

Branch: `codex/apex-2-calendar`, based on `3804a94` (checklist PR33 / foundation PR32). No push, merge, deployment, marketing edits, or subagents.

Commits:

- `b2be256` — `feat(calendar): persist audited appointments and unified schedule projection`
- `a1d750c` — `feat(calendar): add responsive unified calendar workspace and appointment editor`

## Implemented

- Shared strict `calendarEvents.ts` contract and canonical `agenda_` identifiers. Ordinary appointments have optional project/note/active staff assignment, supported coordination types, inclusive all-day dates or explicit UTC interval plus IANA timezone, revision, creator, timestamps and cancellation audit.
- Registered migration0038: canonical appointment storage, owning project/user foreign keys, snapshot association and mutually exclusive date/time checks, immutable history/receipt tables. Personal/project scope derives from nullable owning job; no duplicated task/visit/gate/inspection records.
- Separate CalendarService validates authenticated active staff, personal creator/assignee privacy, staff-wide project visibility, creator/assignee/project-manager editing, active staff assignments, expected revisions and cancellation. Edits obtain owning job from stored row, lock job before event and reject closed/cancelled jobs. Normalized request bindings include actor/action/target/body; immutable saved receipts preserve exact historical retries and reject changed bindings. Concurrent creates with one key replay one record. List/history use SQL visibility predicates; history authorization and returned snapshots share a single statement snapshot.
- Additive authenticated `/api/calendar-events` CRUD/history and `/api/workspace-calendar`. Existing `/api/calendar` schema/behavior remains unchanged. Workspace projection uses source-qualified IDs and joins ordinary appointments, actor-visible uncompleted dated checklist tasks, and existing operational visits/gates/inspections.
- Shared CalendarWorkspace used by `/calendar`: Agenda, Day, Week, Month; mobile Agenda and desktop Week defaults; previous/next/today/date picker; project/team/type filters; native modal details/history and ordinary event create/edit/cancel; explicit loading/errors/empty states. Shared client/resource hooks and current task assignee authority are reused.
- Query intent `action=schedule-event&project=id` supports same-route reopen and query changes, awaits asynchronous lookup choices, removes completed/dismissed intent, and retains missing/closed/cancelled project context explicitly until the user chooses a valid project or Personal. Retry retains one payload-bound idempotency key after lost acknowledgement.
- Operational details/deadlines navigate to authoritative project/Checklist. Visit drag proposes new inclusive span, requires reason and saves through unchanged `/api/visits/:id/move`; gunite duration, actor authority, crew/gate conflict rules remain server enforced. Crew coordination appointments explicitly do not reserve subcontractor capacity. No inspection results/gate releases/phase transitions are authored by calendar events.
- Business calendar day coverage uses America/Chicago; timed labels/details retain recorded timezone. Timed end is exclusive for day coverage (subtract1ms), all-day/crew civil end remains inclusive. Timed creation/edit inputs use browser-local time and save its explicit zone.
- Scoped charcoal/gold control styling uses existing tokens, 44px actions, readable event cards and no horizontal page overflow in tested390px views. Native modal prevents background focus.

## Validation (synthetic records only)

Read `/tmp/apex2/calendar-brief.md`, `/tmp/apex2/backend-map.md`, `docs/apex2/IMPLEMENTATION.md`, actual milestone2 TaskService/contracts/hooks, existing schedule services/API and migrations before implementation.

The pre-existing disposable `apex2` database was used during initial development. To verify the final0038 migration from scratch, created a separate disposable database `apex2_calendar_m3` on the same local PostgreSQL server using `pg.Client` and `CREATE DATABASE apex2_calendar_m3`. Its first test run applied all operational migrations. S3 Moto and other variables came from `source /tmp/apex2/env.sh`.

Final successful commands:

1. `pnpm typecheck` — exit0. Log: `/tmp/apex2/calendar-typecheck.log`.
2. `pnpm --filter @apex/os build` — exit0. Log: `/tmp/apex2/calendar-build.log`. Existing Rollup dependency annotation/chunk-size warnings remain; no build failure.
3. `source /tmp/apex2/env.sh; DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_calendar_m3 pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/calendar.test.ts integration-tests/checklist.test.ts --maxWorkers=1 --no-file-parallelism` — exit0; **17 passed, 0 failed, 0 skipped, 2 files** (7 calendar +10 unchanged checklist); 1.91s. Log: `/tmp/apex2/calendar-pg-fresh.log`.
4. `pnpm exec vitest run packages/gate-service/src/schedule.test.ts apps/apex-os/src/lib/calendarWorkspace.test.ts --maxWorkers=1 --no-file-parallelism` — exit0; **23 passed, 0 failed, 0 skipped, 2 files**; 31.92s. Log: `/tmp/apex2/calendar-unit.log`. Includes existing crew conflict/gate/closed-job/field/gunite move restrictions plus leap/year/DST/business-zone/exclusive-midnight coverage.
5. `source /tmp/apex2/env.sh; DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_calendar_m3 node apps/apex-os/tests/calendar.e2e.mjs` — exit0; **5 acceptance groups passed, 0 skipped**. Real API on4197 + PostgreSQL + Chromium; no API read fixtures. Uses synthetic users/projects/appointments/crew records, local disposable PG/Moto. Log: `/tmp/apex2/calendar-browser.log`; server log `/tmp/apex2/calendar-browser-server.log`.
6. `git diff --check` — exit0 before commits.

PostgreSQL checks: reload persistence, creator/assignee privacy against unrelated managers, reassignment history visibility, active staff validation, normalized exact historical retries, changed actor/payload/action/target binding refusal, concurrent duplicate creates, revision conflicts, project editing authority, append-only history, cancellation, closed/cancelled stored owning jobs, closure race serialization, real civil/leap/range validation, timed DST interval+timezone persistence, authenticated API CRUD/history/legacy compatibility, actor-qualified projection and task deadline projection without a copied appointment.

Browser groups:

-1440px real create/edit/reload/history, all4 views, desktop Week default, same-route intent reopen/cleanup, lost-create-ack retry stores exactly1 row, native modal background-focus refusal, no page overflow/runtime errors.
-390px real create/edit/reload/history, all4 views, mobile Agenda default, repeated intent, no page overflow/runtime errors.
-Delayed real project/staff API responses preserve selected project; browser-local timed input saves UTC+America/Los_Angeles and displays recorded zone after reload.
-Missing/closed/cancelled deep-linked project prevents any POST; only explicit Personal selection persists personal work.
-Existing operational conflict visibly projected; actual native mouse multi-day visit drag preserves inclusive duration and requires reason; saved visit dates verified against PostgreSQL (immutable move audit also covered by existing schedule tests); gunite multi-day refusal remains; authenticated field move API returns403 and keeps schedule authority intact.

Initial validation caught wrong test expectations for existing API error status/messages (409 personal not-found,403 field role refusal). These were corrected to match existing server behavior. Initial generic Playwright `dragTo` could scroll a tall day column and place another stacked card under the pointer; failing detail was the gunite record, not the intended plumbing record. The harness now uses source/target bounding boxes and real mouse movement at the same visible row coordinate, with no sleeps or synthetic drag dispatch. The operational proposal form is keyed by source visit and proposed start to isolate uncontrolled input defaults. Final five-group browser run passes.

## Screenshots and visual inspection

Inspected actual running app screenshots after create/edit/reload. Corrected undefined inherited `.btn` presentation through calendar-scoped token styles and removed agenda implicit empty grid rows. Parent also inspected scoped desktop/mobile presentation.

- `/tmp/apex2/screenshots/calendar-1440.png`
- `/tmp/apex2/screenshots/calendar-390.png`

Both are actual Chromium screenshots using persisted synthetic test records. They are viewport captures at1440x1000 and390x844, not render-only mockups.

## Explicit limits / next milestone dependencies

- Division data is not yet authoritative in current job summaries. Calendar explicitly displays Unknown; division filtering depends on truthful M4 metadata. No invented coating/renovation phases, gates or templates.
- Compact/dashboard/job-scoped embedding props are M4 integration work; the shared component is available now and the route uses it.
- Mobile optional filter density can be reduced during M6; all required controls function at390px, but appointments can begin below the initial fold.
- Workspace reads currently return all actor-visible entries without pagination or a server date window. Appointment recurrence is not introduced. Cancelled appointments leave scheduled UI but retain stored rows/history accessible by authenticated API.
- Full regression CI is owned by root and was not rerun by this worker. No claim of production IdP/R2/backups or real-world division lifecycle acceptance.
- Synthetic records remain only in local disposable test databases; no external messages, push, merge, deployment, or marketing changes occurred.

Root's plan ledger change remains uncommitted by this worker and was intentionally excluded from both commits.

## Scoped review correction — round1/5

Read full `/tmp/apex2/calendar-review.md` and verified the three findings against the actual editor save path, Chicago projection and existing `needsScheduling` helper. Applied scoped fixes in commit **`4f1c331`** (`fix(calendar): preserve timed edits and authoritative scheduling state`). No backend, migration, authorization, lifecycle, marketing or root documentation changes in this correction.

1. Unchanged timed editor values now reuse their original UTC strings, including the selected DST occurrence and seconds/milliseconds. If both temporal values remain unchanged, the original recorded timezone is retained even when the browser uses a different zone. Changed local times are matched against nearby timezone offsets: repeated times are explicitly refused with an actionable instruction to choose outside the repeated hour; nonexistent transition times are refused. No zone picker or new event capability was introduced.
2. Successful saves derive the cursor from the validated saved appointment using the exact same `calendarDates` business-day projection as grid/agenda coverage. The recorded-zone labels remain intact.
3. The actionable undated queue uses `workspaceNeedsScheduling`, a source guard delegating directly to existing `needsScheduling` for operational entries. Released gates, passed/waived inspections and terminal visits no longer appear as work needing dates. Unfinished undated controls still appear; operational cards now display their authoritative status.

Added focused unit checks for exact second-hour/precision preservation, ambiguous changed-time refusal, nonexistent transition refusal, unambiguous conversion, cross-zone business day and terminal-vs-unfinished operational queue classification. Added actual API/PostgreSQL/browser regressions for a Chicago editor note-only edit of `2026-11-01T07:30:15.125Z` through `07:45:30.875Z`, preserving original instants and a different recorded zone (`UTC`); changing the local start to ambiguous01:35 produces an explicit error without a POST. Added a Tokyo save at local2026-10-25 12:30, asserting stored03:30Z, retainedAsia/Tokyo label, cursorChicago2026-10-24, and visibility in both Day and mobile Agenda.

Final covering validation:

- `pnpm exec vitest run apps/apex-os/src/lib/calendarWorkspace.test.ts apps/apex-os/src/lib/calendarDisplay.test.ts --maxWorkers=1 --no-file-parallelism` — **exit0; 8 passed, 0 failed, 0 skipped; 2 files; 519ms**. Log `/tmp/apex2/calendar-review-unit.log`.
- `pnpm typecheck` — **exit0**. Log `/tmp/apex2/calendar-review-typecheck.log`. Initial test-only `process.env` references were incompatible with the browser app's type configuration; changed the test setup to Vitest `stubEnv`/`unstubAllEnvs`, then reran this command and the focused tests successfully.
- `pnpm --filter @apex/os build` — **exit0**, final product code built in6.87s. Log `/tmp/apex2/calendar-review-build.log`. Subsequent changes were test-only (Vitest environment setup and stronger different-recorded-zone fixture). Existing annotation/chunk warnings remain as previously documented.
- `source /tmp/apex2/env.sh; DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_calendar_m3 node apps/apex-os/tests/calendar.e2e.mjs` — **exit0; 7 acceptance groups passed, 0 skipped**, including original5 groups plus DST edit/ambiguity and cross-zone save regressions. Real API4197, PostgreSQL and Chromium; no read fixtures or synthetic drag dispatch. Final log `/tmp/apex2/calendar-review-browser.log`; server log `/tmp/apex2/calendar-browser-server.log`.
- `git diff --check` — **exit0** before commit.

Full CI and the unchanged PostgreSQL service suite were not rerun for this frontend-only correction. Previous backend evidence remains above; the covering browser suite exercised actual persisted appointment edits against local disposable PostgreSQL. Root plan-ledger changes remain excluded from the commit. Scoped independent rereview is pending.
