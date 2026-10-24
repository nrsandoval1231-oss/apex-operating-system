# M4 command center / project workspace implementation report

Source frozen on branch `codex/apex-2-workspace` in `/workspace/apex2`.
Base: `f62a4c1`.

Commits:

- `20cb41bdd4cc13cd60f7b7b554997e208d3a9148` — `feat(workspace): persist project notes and audited priority`
- `d88da2184066c80ee7f4ffe45f317d61f98388c0` — `feat(workspace): add responsive command center and project tabs`

No push, merge, deployment, marketing edits, live customer messages, or production writes. Root-owned status/plan document edits were left unstaged and uncommitted.

## Implementation

- `/today`: desktop three-column command center, bounded compact agenda/week calendar, real active-job list with search/division/status/sort, query-backed selected project, and shared canonical Checklist. The first actual project card has visible content inside the loaded 1440×1000 viewport; current screenshot shows its entire card above the bottom edge. Checklist Add Task stays within its column.
- Mobile Today: two urgent/due owned tasks with completion and full Checklist link, today's real appointments, upcoming dated milestones, attention items, then jobs. Full filter/edit toolbars remain on the full Checklist page. The first appointment is entirely above both fixed bottom navigation and Quick add.
- `/projects`: canonical job cards, searchable/filterable/sortable, canonical detail navigation; project chooser for note/photo actions without selection.
- Selected project: current recorded stage, required/released counts, explicit priority, permission-appropriate contract display, canonical task/calendar tabs, existing photos, procurement/inspections, retained takeoff/proposal/evidence paths, financial unknowns, activity, and notes. Expensive tab resources mount only for the selected tab. Full ProjectDetail keeps existing operational sections, IDs, anchors and closeout controls. Individual History routes suppress global quick-add.
- Notes: migration `0039_workspace_metadata.sql`; GET/POST `/api/jobs/:id/notes`, server actor/time, append-only notes/receipts, payload/actor/job-bound keys, exact saved retries, shared job lock and immutable-job refusal.
- Priority: explicit default normal/revision 0 on reads; manager-only expected-revision command at POST `/api/jobs/:id/priority`, job locking, append-only audit and payload-bound receipts. Field controls hidden, server role authority enforced. Concurrent stale writers yield one success and one refusal.
- Metadata: `/api/workspace-projects` reads exact `leads.accepted_payload.vertical` values from the existing workflow data contract. No inference from titles. Only `Designer Pools` activates the approved pool catalog. Counts share `gateRequiredByScope` with GateService, including signed optional cover/automation exclusions. The full real signed lifecycle verifies 7/7, while a recorded phase skip leaves 0/9 released.
- Activity projects existing operational, task, appointment and evidence histories plus notes/priority history; it does not create duplicate task/event records to populate the view.
- Resource handling binds displayed state to path + token before effects, coalesces concurrent token/path reads without one subscriber cancelling another, invalidates sharing on commands, and refreshes on focus/reconnect. Project task reads remain scoped server-side; unrelated personal work is never loaded.
- My Checklist explicitly scopes assigned work plus the user's own unassigned personal work. Project task views show staff-visible project work, while edit/complete controls follow creator/assignee/project-manager policy. Canonical TaskService remains authoritative.

## Final covering verification

Commands run in `/workspace/apex2`. Real PostgreSQL/Moto environment loaded with `source /tmp/apex2/env.sh` for integration/browser commands. All data is disposable synthetic data. No test skips in the runs below.

| Command | Exit | Result | Evidence |
|---|---:|---|---|
| `pnpm typecheck` | 0 | Project references and staff app typecheck passed | `/tmp/apex2/projects-typecheck.log` |
| `pnpm --filter @apex/os build` | 0 | Production staff bundle built | `/tmp/apex2/projects-build.log` |
| `pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/workspace.test.ts integration-tests/checklist.test.ts integration-tests/calendar.test.ts integration-tests/business-lifecycle.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 4 files, 24 passed, 0 failed, 0 skipped; workspace contributes 6 real HTTP/PG cases | `/tmp/apex2/projects-pg.log` |
| `pnpm exec vitest run apps/apex-os/src/lib/taskAccess.test.ts apps/apex-os/src/lib/calendarWorkspace.test.ts packages/contracts/src/jobSummary.test.ts packages/database/src/migrations.test.ts packages/gate-service/src/index.test.ts apps/gate-api/src/server.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 6 files, 97 passed, 0 failed, 0 skipped | `/tmp/apex2/projects-unit.log` |
| `node apps/apex-os/tests/workspace.e2e.mjs` | 0 | 22 browser check groups passed, 0 skipped; 1440×1000 and 390×844, real API/PG | `/tmp/apex2/projects-browser.log` |
| `node apps/apex-os/tests/checklist.e2e.mjs` | 0 | Original harness unchanged: 4 check groups passed, 0 skipped | `/tmp/apex2/projects-checklist-browser.log` |
| `node apps/apex-os/tests/calendar.e2e.mjs` | 0 | Original harness unchanged: 7 check groups passed, 0 skipped, including DST, timezone, real drag/move history and field refusal | `/tmp/apex2/projects-calendar-browser.log` |
| `EVIDENCE_DIR=/tmp/apex2/projects-closeout node apps/apex-os/tests/closeout-acceptance.e2e.mjs` | 0 | Original harness unchanged: Final evidence/release in browser, complete, close, retained History/evidence; 1 job/1 project/44 evidence records; 17 history entries; superintendent/anonymous refusals retained | `/tmp/apex2/projects-closeout-browser.log`, `/tmp/apex2/projects-closeout/closeout-acceptance.json` |
| `git diff --check` | 0 | No whitespace errors | observed before commits |

The browser check groups include owned checklist isolation; three-column/single-column layout; query selection/reload/back; delayed project-task switch with no stale identity; tasks shared between project and checklist; same persisted calendar entries in both views; reconnect reads and independent subscriber cancellation; note lost-ack retry exactly once; note reload; manager priority/reload; Jobs search/division/status; chooser and repeated same-path note action; field task controls; closed/cancelled note UI and actual HTTP 409; loaded calendar geometry; header containment; mobile appointment visibility above overlays; no horizontal overflow or page JS errors.

Verification timing: the 97-test affected suite and unchanged Checklist/closeout harness passed before the last dashboard-only presentation refinements. Their exercised operational routes/default full-page flows were preserved. The final built app was then exercised by the full new workspace harness and unchanged Calendar harness after those refinements. No duplicate full CI was run; root owns final combined CI and independent review.

Build warning retained: Vite reports chunks over 500 kB (main approximately 514.25 kB and ExcelJS approximately 940.24 kB before gzip). Build succeeds; this is not a clean-size claim.

## Screenshots

Final screenshots are actual viewport captures, not full-page composites. Capture waits for this run's saved note and persisted reconnect appointment after final reload, and for loading text to disappear before geometry checks.

- `/tmp/apex2/screenshots/workspace-1440.png` — **1440×1000**, loaded calendar, three columns, first project card visible, selected project.
- `/tmp/apex2/screenshots/workspace-390.png` — **390×844**, dedicated Today summary and first real appointment above navigation/Quick add.
- Unchanged closeout harness artifacts: `/tmp/apex2/projects-closeout/01-project-before-final-gate.png`, `02-ready-to-archive.png`, `03-closed-history.png`.

Server logs: `/tmp/apex2/projects-browser-server.log`; existing canonical harnesses retain their own server log paths.

## Red checks and corrected regressions

- Initial workspace API red run: 5 failed because endpoints were absent (`/tmp/apex2/projects-red.log`).
- Ownership/control helper red run: 2 failed with permissive behavior before implementing scope/access (`projects-access-red.log`).
- Signed lifecycle projection red run proved the 7/7 gate result but failed for the missing retained proposal-version link (`projects-documents-red.log`); implementation added the actual stored version link.
- First UI run caught a skipped Today file write; corrected wiring before acceptance.
- Harness completion changed from Playwright `check()` to `click()` plus server-confirmed list observation; canonical non-optimistic task completion remains intact.
- Timeline initially parsed the domain transition shape, while existing HTTP history omits route-scoped `jobId`. Added canonical `ProjectPhaseHistorySchema` for the actual route and covered a real skipped transition with 0/9 released.
- Existing closeout harness initially caught global `Open quick actions` on historical records. Historical record quick-add is now suppressed; original assertion/harness unchanged, final run passed.
- Existing Calendar harness caught quick-action project intent being treated as a list filter: explicit Personal save was hidden by the unavailable project filter. Project query filtering now applies only to non-action Calendar links; action defaults remain controlled, exact Personal choice remains explicit. Original Calendar harness passed after correction.
- An added malformed-note assertion first expected 400; the existing API convention correctly uses Zod 422. Corrected the test expectation, retaining rejection.
- Density checks were strengthened after visual inspection: bounded loaded agenda, collapsed undated work, one-row desktop project filters, distinct mobile summary, token-styled tabs/note controls, and overlay-aware appointment geometry. Final captures wait for loaded data.

## Honest limits / follow-up

1. **Jobsite photo upload is deferred to the immediately following M5 photo milestone.** `PhotoWorkspace({jobId, readOnly?})` currently renders existing staff photo evidence. Add Photos opens the correct project Photos tab/chooser. No optional upload pass is claimed, and it is not routed into a gate requirement. M5 can replace/extend the agreed component interface.
2. Coating, Design & Renovation and Pool Service stage catalogs are unapproved/unimplemented. They show configuration-required/unavailable stages and no pool gate counts in the new workspace. Unknown intake divisions remain unknown. Existing legacy operational routes were preserved; this work does not create new division execution workflows or retrofit all legacy write services with division dispatch.
3. Financials retain existing API access rules. Hiding stronger field UI controls is **not** new API authorization. Collections, costs/profitability and live accounting remain unavailable.
4. Retained documents are existing takeoff downloads, actual stored signed proposal versions, and evidence paths. No new document-storage or PDF-generation claim.
5. All acceptance is local synthetic PostgreSQL/Moto/HTTP/browser. This is not staging/Cloudflare Access, live customer/provider, production recovery, deployment or overall pilot acceptance.
6. Full combined CI and independent review remain root-owned follow-ups. No broad test duplication after covering checks passed.

## Review fix round 1/5 — inspection catalog and preserved anchors

Reviewed the complete independent findings in `/tmp/apex2/projects-review.md` against source at base `d88da2184066c80ee7f4ffe45f317d61f98388c0`.

Fix commit: **`d445264d040244434c5110dda1e66f9437a01ffb`** — `fix(workspace): guard inspection catalog and preserve anchors`.

- New workspace Inspections mounts `InspectionTab` only when `stageCatalog === 'pools'`. Coating, Design & Renovation, Pool Service, unknown and unavailable metadata display an inspection configuration-required state. Those embedded views neither mount nor fetch the pool workflow. Existing legacy operational routes remain preserved as explicitly requested.
- `Inspections` and `Procurement` now accept optional `anchorId: string | null`, retaining their original IDs by default. Embedded instances pass null, so the full detail page retains exactly one original `#inspections` and `#procurement` target. The inspection focus effect respects its supplied anchor. No other workflow behavior changed.
- The browser harness now covers all four unsupported divisions and both embedded tabs at both viewport sizes. It asserts no direct pool-inspection fetch and no pool catalog/controls in unsupported workspace tabs; globally unique DOM IDs with approved-pool tabs mounted; and legacy jump links resolving to original sections outside the selected-project workspace. Existing 22 groups remain covered; the revised harness has **26 passing groups**.

Fresh verification for this round (same disposable environment and real built app/API/PostgreSQL on browser port 4198):

| Command | Exit | Result | Evidence |
|---|---:|---|---|
| `pnpm typecheck` | 0 | Project references and app types passed | `/tmp/apex2/projects-fix1-typecheck.log` |
| `pnpm --filter @apex/os build` | 0 | Production app built; existing >500 kB chunk warning retained (main ~514.62 kB, ExcelJS ~940.24 kB) | `/tmp/apex2/projects-fix1-build.log` |
| `source /tmp/apex2/env.sh` then `node apps/apex-os/tests/workspace.e2e.mjs` | 0 | **26 check groups passed, 0 failures, 0 skips**, including the new component composition/catalog regressions at 1440×1000 and 390×844 | `/tmp/apex2/projects-fix1-browser.log` |
| `git diff --check` | 0 | No whitespace errors | observed before commit |

Red evidence: `/tmp/apex2/projects-fix1-anchor-red.log` exits 1 with 2 matching inspection IDs where 1 is required. After anchor repair, `/tmp/apex2/projects-fix1-catalog-red.log` exits 1 because the unsupported Coating tab lacks the configuration-required state. A first combined extension run also caught that its existing read-coalescing counter included the new preliminary navigation requests; the counter is now reset before the original dashboard navigation, preserving the existing assertion's scope. Final browser verification above passes.

The actual viewport screenshots at `/tmp/apex2/screenshots/workspace-1440.png` and `/tmp/apex2/screenshots/workspace-390.png` were refreshed by the passing harness, retaining loaded-data and overlay-aware geometry checks. This round adds no backend changes, deployment, push, merge, subagents, broad/full-CI duplication, or root-owned document edits. Independent re-review and root's eventual combined CI remain outstanding. M5 photo upload and other previously disclosed limits remain unchanged.
