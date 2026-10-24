# APEX 2.0 final correction wave — 2026-10-24

Worktree `/workspace/apex2`, branch `codex/apex-2-integration`. Frozen source/test HEAD for the combined calendar→workspace browser run: `2231248cc6c0fc69e5850188782943191c45dec5`. Product source was committed as `2d52c4161b524238d4de4c82ab9dbdc225a422ca`; `146b42d5c0dd5275bfeb745d19ed55639097d7e7`, `8a0cfe55a9676c4fdd494d6b75813d197a532231`, and `2231248cc6c0fc69e5850188782943191c45dec5` are test-only commits. All are new commits after `36fedaccd61a82d9fc664e97a9161d3327aa393d`; none were amended, rebased or reset. No merge or deployment.

## Finding mapping

| Final review finding | Correction | Focused evidence |
| --- | --- | --- |
| Important 1, missing Division filter | Calendar uses `/api/workspace-projects` canonical metadata. Known divisions, Personal and Unknown have distinct options; metadata loading/error is explicit with retry. Division combines with project, member and event type; active count includes Division. | Calendar browser: desktop/mobile mixed divisions, personal/unknown, four combined filters, metadata outage/retry. Refreshed final calendar captures. |
| Important 2, compact Agenda skips 24 days | Compact Agenda moves seven days per period in both directions; full Agenda retains 31. | Calendar browser: formerly skipped day+8 event appears in adjacent compact window at 1440/390, next/previous and full 31-day checks. |
| Important 3, empty-token photos fail | XHR upload and protected image fetch omit Authorization only for empty token, retaining nonempty captured token behavior and abort logic. | Photos browser: configured loopback `GATE_LOCAL_USER` performs no-token upload, fetches and decodes gallery bytes, and both requests lack Authorization. Normal anonymous request without local mode returns 403; existing token and queue cases pass. |
| Minor 1, wrong project task query | `useTasks(jobId)` sends `?jobId=`. | Workspace browser: actual project HTTP response includes own project task and excludes another project and personal task; existing scope-switch case updated to the correct URL. |
| Minor 2, creation-order Today cards | Entries sort all-day first and timed by actual start instant before day/agenda rendering and Today `slice(0,2)`. Policy retains earlier appointments from today, including elapsed ones, in chronological order. | Calendar browser: persisted timed 09/12/15 events arrive in reverse creation order; mobile Today shows 09/12 and Day puts all-day first. Workspace compares mobile Today cards with the first two eligible persisted API appointments even after the prior calendar harness seeds more work. |

The bundle-size warning (Minor 3) remains a measured follow-up, not part of this bounded correction wave.

## Exact focused commands and outcomes

All commands used `/workspace/apex2` as cwd. Successful exits were **0**. No focused runner reported a skip. Logs below are local evidence, with summaries also in `docs/apex2/validation/integration.md`.

| Command | Result / source correspondence | Evidence |
| --- | --- | --- |
| `pnpm typecheck` | Exit 0 after final product source edits, before test-only commits. | `/tmp/apex2/final-correction-typecheck.log` |
| `pnpm --filter @apex/os build` | Exit 0; Vite 6.89 s; corrected product source `2d52c41`. Existing Excel and staff entry >500 kB warnings. | `/tmp/apex2/final-correction-build.log` |
| `pnpm exec vitest run apps/apex-os/src/lib/calendarWorkspace.test.ts apps/apex-os/src/lib/calendarDisplay.test.ts apps/apex-os/src/photos/preparePhoto.test.ts` | Exit 0; 3 files, **11 passed, 0 skipped**. The tested unit modules were unchanged through the product commit. | `/tmp/apex2/final-correction-unit.log` |
| `source /tmp/apex2/env.sh; export DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_correction_combined; node apps/apex-os/tests/calendar.e2e.mjs` | Exit 0; **16 browser groups, 0 skipped**, HEAD `2231248`; ran first on a newly empty migrated DB. | `/tmp/apex2/final-correction-combined-calendar.log`, `/tmp/apex2/calendar-browser-server.log` |
| `source /tmp/apex2/env.sh; export DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_correction_combined; node apps/apex-os/tests/workspace.e2e.mjs` | Exit 0; **31 browser groups, 0 skipped**, HEAD `2231248`; ran immediately after calendar on that same DB, matching CI order. | `/tmp/apex2/final-correction-combined-workspace.log`, `/tmp/apex2/screenshots/workspace-1440.png`, `/tmp/apex2/screenshots/workspace-390.png` |
| `source /tmp/apex2/photos-env.sh; node apps/apex-os/tests/photos.e2e.mjs` | Exit 0; **16 browser groups, 0 skipped**. Run at `146b42d`; later commits changed only calendar/workspace browser assertions, not product/photo source or photo harness. | `/tmp/apex2/final-correction-photos.log`, `/tmp/apex2/photos-browser.json`, `/tmp/apex2/photos-browser-local-server.log` |
| `source /tmp/apex2/env.sh; export DATABASE_URL=postgres://apex:apex_disposable@127.0.0.1:55432/apex2_visual_final_v2; export APEX_DEMO_SCREENSHOTS=/tmp/apex2/final-correction-demo; node apps/apex-os/tests/integration-demo.e2e.mjs` | Exit 0; **12 synthetic persisted desktop/touch-mobile captures, 0 skipped**. Corrected product source `2d52c41`; later commits were test-only. | `/tmp/apex2/final-correction-visual.log`, `/tmp/apex2/final-correction-demo/captures.json`, refreshed `docs/apex2/screenshots/final-*.png` and `docs/apex2/validation/final-captures.json` |
| `python docs/apex2/validation/measure-staff.py > docs/apex2/validation/staff-assets-final.json` | Exit 0 on product source `2d52c41`. All JS 1,720,254 bytes / 502,737 gzip; HTML entry 538,463 / 159,966 gzip. | `docs/apex2/validation/staff-assets-final.json`, `/tmp/apex2/final-correction-build.log` |

The combined browser database was created empty using local development PostgreSQL and `applyOperationalMigrations`; it is separate from `apex2_final`. Photos used the existing disposable `apex2_photos_final` database and local Moto. Visual capture used the separate `apex2_visual_final_v2` database. The earlier full CI pass (1,429 cases, 2 guard skips, exit 0) belongs to frozen source `78dfa0857e53b13d69afc87bd2c8364704d9e485`, not to these commits. Root owns a separate full-CI run at `2231248`; its result is not claimed here.

`docs/apex2/validation/integration.md`, refreshed screenshot/asset metadata and images are prepared but left **uncommitted** while root's full CI runs. Root-owned `docs/apex2/IMPLEMENTATION.md`, `docs/superpowers/plans/2026-10-24-apex2.md`, `docs/apex2/validation/foundation.md`, and `docs/apex2/validation/independent-review.md` remain unstaged and untouched by this correction wave.

## Coordinator completion

The subsequent full CI at `2231248` passed, exit 0, 659.457 seconds. Evidence and scoped review are now retained in [integration.md](integration.md) and [independent-review.md](independent-review.md). Earlier references to uncommitted evidence describe the correction handoff during that run.
