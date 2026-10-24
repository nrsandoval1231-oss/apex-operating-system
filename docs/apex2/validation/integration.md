# Final integration validation — 2026-10-24

## Final corrected candidate

Full `bash scripts/ci.sh` **passed again**, exit **0**, **659.457 seconds**, on frozen source/test SHA **`2231248cc6c0fc69e5850188782943191c45dec5`**, after all five review corrections. The source, tests and HEAD stayed fixed throughout this run. Later changes are documentation and screenshots only. [Exact result](final-corrected-ci.json) · [Counts and skips](final-corrected-summary.json) · [Environment](final-corrected-environment.json) · [Migration inventory](final-corrected-migrations.json).

```bash
cd /workspace/apex2
source /tmp/apex2/final-v2-env.sh
export APEX_CI_EVIDENCE_DIR=/tmp/apex2/final-v2/browser
python docs/audit/tools/run-command.py ci /tmp/apex2/final-v2 bash scripts/ci.sh
```

The final run passed **1,429 counted cases**: core 596, Designer 585, website unit 2, website browser 166, production intake browser 10, PostgreSQL/storage 70. **Two existing missing-engine guards were skipped**, not passed; the actual engine integration cases ran. Additional staff browser groups passed: shell 6, native IndexedDB races 6, checklist 4, **calendar 16, workspace 31, photos 16**. All five archive scripts and estimate navigation passed. Both [zero-optional-photo closeout](final-corrected-closeout-zero.json) and [optional-photo closeout](final-corrected-closeout-photo.json) passed. No configured infrastructure suite was omitted; no separate lint command is configured.

Preflight verified empty database `apex2_final_v2` on local port 55432 and empty Moto bucket `apex2-final-v2` on local port 59000. Post-run inventory verifies 47 public tables and all 39 registered **operational** migrations, including 0037–0040. The separate storage migration is not part of that operational inventory. Node 24.19.0, pinned CI pnpm 11.18.0, PostgreSQL 17.11, Moto 5.1.15 and Playwright 1.62.1 were used. Full local log: `/tmp/apex2/final-v2/ci.log`.

The independent whole-branch review and single correction re-review are [retained here](independent-review.md). All five original findings are addressed, with no Critical/Important issue remaining in the reviewed correction. The mixed-precision subsecond ordering edge and measured bundle growth remain nonblocking follow-ups. External staging/device/division acceptance conditions remain in [ACCEPTANCE.md](../ACCEPTANCE.md). No merge or deployment is authorized by these results.

## First integrated run — preserved historical evidence

The five whole-branch review corrections are committed at source SHA **`2d52c4161b524238d4de4c82ab9dbdc225a422ca`**; the final browser-harness refinement is at **`2231248cc6c0fc69e5850188782943191c45dec5`**. The full CI result below belongs to its earlier frozen source SHA; the correction evidence is recorded separately under [Final correction wave](#final-correction-wave).

Full `scripts/ci.sh` **passed**, exit **0**, **659.171 seconds**, on frozen product/test SHA **`78dfa0857e53b13d69afc87bd2c8364704d9e485`**. No source/test edits or commits occurred during execution. This document and the metadata are an evidence-only follow-up. Root-owned status/plan/foundation documentation was dirty at the start, recorded in [final-environment.json](final-environment.json), and excluded from the product commit.

```bash
cd /workspace/apex2
source /tmp/apex2/final-env.sh
export APEX_CI_EVIDENCE_DIR=/tmp/apex2/final/browser
python docs/audit/tools/run-command.py ci /tmp/apex2/final bash scripts/ci.sh
```

The wrapper records the actual command, cwd, SHA, elapsed time and exit in [final-ci.json](final-ci.json). Log creation/last write were **09:54:58.456Z–10:05:57.624Z**. The full local log is `/tmp/apex2/final/ci.log`; concise machine-readable results are retained in [final-summary.json](final-summary.json). No infrastructure suite was skipped.

| Runner | Result | Skipped |
| --- | --- | --- |
| Core Vitest | 596 passed, 50 files | 0 |
| Designer Vitest | 585 passed, 26 files | 0 |
| Website Node unit | 2 passed | 0 |
| Website Playwright | 166 passed | 0 |
| Website production intake Playwright | 10 passed | 0 |
| PostgreSQL/S3 Vitest | 70 passed, 14 files | 2 |
| **Runner cases total** | **1,429 passed** | **2** |

The two skips are existing conditional missing-engine *failure guards*: `Designer contract test requirement → finds the Designer engine, because APEX_REQUIRE_DESIGNER_CONTRACT is set` and `takeoff-to-proposal chain requirement → finds both engines, because APEX_REQUIRE_TAKEOFF_CHAIN is set`. Both engines are present. Actual Designer compatibility, takeoff and pricing-chain assertions ran. These two skips are not counted as passes.

Additional commands passed: all five legacy proposal scripts; estimate-navigation browser regression; shell fixture acceptance (6 groups); native IndexedDB photo queue races (6); real checklist (4), calendar (9), workspace (30), and photos (15) browser groups. Original zero-optional-photo closeout passed 12 recorded steps; optional-photo closeout passed 14. Their separate records are [final-closeout-zero.json](final-closeout-zero.json) and [final-closeout-photo.json](final-closeout-photo.json). The expected negative production website build refused a missing lead webhook; it is not an unexpected failure. No test assertions were weakened.

## Disposable environment and migrations

Node **v24.19.0**, PostgreSQL **17.11**, Moto **5.1.15**, Playwright **1.62.1**, Linux **6.18.55**. CI uses **pnpm 11.18.0** through its owned Corepack shims; separate direct feature commands used the environment's global **pnpm 11.25.0**. Local synthetic identity uses pilot JWTs, not a live IdP.

Final CI exclusively used PostgreSQL `apex2_final` on `127.0.0.1:55432` and Moto bucket `apex2-final` at `http://127.0.0.1:59000`. Read-only preflight verified **0 public base tables** and **0 bucket objects** before CI. This environment was never used for preparatory feature or visual work. Post-run verification found **47 public base tables** and **all 39 registered migrations**, including:

- `0037_checklist.sql`
- `0038_calendar_events.sql`
- `0039_workspace_metadata.sql`
- `0040_jobsite_photos.sql`

See [final-migrations.json](final-migrations.json). The populated 0040 upgrade test creates/drops its own disposable database. Its test role needs `CREATEDB`; no production application privilege was changed. Older development/visual databases were retained.

## Focused regressions and visual evidence

The stable-empty-token actor regression first failed on the old behavior: after `/api/me` changed to actor B, A's private appointment remained visible (`1 !== 0`, exit 1; `/tmp/apex2/integration-identity-red.log`). The unchanged privacy assertions passed after protected views were keyed to resolved userId/role and pending sharing cleared before new child effects. B's own task/calendar data arrives while A's old reads remain held, and late A responses cannot populate B. This case is included in final CI's shell harness. Normal same-user refresh and uploads passed the full photo browser suite.

Real workspace coverage proves initial selected-project mobile Today stays at its greeting/checklist/appointment, while a deliberate project selection reveals its workspace. It also checks shared task/calendar state, scope changes, reconnect coalescing and 360/768/1024-width layouts. Full workflow sizes are 1440×1000 and 390×844. Mobile contexts use `hasTouch:true`, `isMobile:true` and actual taps; these are Chromium emulations.

Twelve final viewport captures use the built app, actual API/PostgreSQL and protected storage on **separate database `apex2_visual_final_v2`**. [Capture metadata](final-captures.json) and [acceptance links](../ACCEPTANCE.md#synthetic-visual-evidence) identify them. The explicit pool division is supplied by the synthetic visual fixture before workspace initialization; no generic production mapping changed. The image is the bundled CC0 geometric demo illustration, clearly labelled synthetic. Loads and image decoding complete before capture; initial mobile Today is checked without scroll correction. The visual harness also checks lazy viewer Escape and focus return. Reproduction is in `apps/apex-os/tests/integration-demo.e2e.mjs`.

## Bundle and build observations

Like-for-like totals include **all emitted production JavaScript chunks**, deterministic gzip, excluding CSS/fonts/media. They do not measure initial network transfer. Reproduce with `python docs/apex2/validation/measure-staff.py` after building. Baseline is unchanged `f4421197de580028bfe53f9c7d50776b20a6a52b`; metadata: [baseline assets](staff-assets-baseline.json), [final assets](staff-assets-final.json), [baseline CI](baseline-ci.json).

| Measure | Audit baseline | Final | Difference |
| --- | ---: | ---: | ---: |
| All JS bytes | 1,647,705 | 1,720,254 | +72,549 (+4.40%) |
| All JS gzip bytes | 481,039 | 502,737 | +21,698 (+4.51%) |
| HTML entry JS bytes | 467,603 | 538,463 | +70,860 |
| HTML entry JS gzip bytes | 139,102 | 159,966 | +20,864 |
| Staff Vite build | 9.03 s | 6.87 s | Single local observations from final corrected CI |

Designer remains an async 239,859-byte chunk; Excel remains 940,243 bytes. The photo viewer is a separate 1,689-byte chunk (836 gzip). The inherited Excel size warning remains; the main staff entry's new **>500 kB** threshold crossing also warns. No initial-load reduction or controlled speed improvement is claimed. Full CI workloads differ from baseline, so their total durations are not a product performance comparison.

## Review and readiness

Milestone 6 task review is approved with no Critical/Important findings; final whole-branch review is separate. No merge, deployment, marketing changes or production-service access occurred.

Live identity/R2/provider permissions, physical mobile camera/Safari, backup/restore and inherited phase-advancement recovery remain unaccepted. A complete offline shell and offline task operation are absent. Optional photo recovery does not imply those capabilities. Coating/renovation lifecycle approval/configuration remains outstanding; service/unknown divisions also show configuration-required states. Existing pilot staff-wide job access and unbounded gallery reads remain. See [acceptance limits](../ACCEPTANCE.md#readiness-limits).

## Final correction wave

The review's three Important and first two Minor findings were corrected in source commit `2d52c4161b524238d4de4c82ab9dbdc225a422ca`; browser-harness refinements followed through `2231248cc6c0fc69e5850188782943191c45dec5`. Calendar Division now reads the canonical workspace project metadata and offers separate Personal and Unknown division filters. A metadata outage disables the choice and displays its own retry/error state. Division combines with project, member and type on desktop and mobile. Compact Agenda advances by its displayed seven days in either direction; full Agenda continues to advance 31 days. All-day work precedes timed work, and timed appointments use actual start instants before the mobile Today two-card limit. Today retains earlier appointments, including elapsed ones, in chronological order.

The photo uploader and protected image loader now omit Authorization when the captured token is empty, matching the shared JSON client. A configured loopback `localUserId` session can upload and view gallery bytes; an anonymous request without local mode remains forbidden. Project task reads now send `jobId`, and a direct HTTP assertion confirms that the project response excludes other projects and personal tasks.

Focused verification used disposable PostgreSQL development databases `apex2_correction_combined` for calendar→workspace in CI order and `apex2_photos_final` for photos, plus local Moto. These are separate from the frozen full-CI database `apex2_final`. The combined database was created empty and migrated before its covering run. Typecheck and staff build exited 0; 11 focused calendar/photo unit cases passed with no skips. Calendar passed 16 browser groups, workspace passed 31 immediately after calendar on the same database, and photos passed 16, all with exit 0 and no skips. The rebuilt visual fixture on `apex2_visual_final_v2` passed 12 viewport captures with no skips; changed captures and [capture metadata](final-captures.json) were refreshed. Exact commands and local evidence paths are in `/tmp/apex2/final-fix-report.md`.

The first 1,429-case CI pass remains historical evidence for `78dfa0857e53b13d69afc87bd2c8364704d9e485`. The final corrected candidate was subsequently rerun through the full CI command at `2231248cc6c0fc69e5850188782943191c45dec5`, as recorded above. Scoped re-review approved all five fixes. No merge or deployment is implied.
