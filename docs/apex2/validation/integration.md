# Final integration validation — 2026-10-24

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
| All JS bytes | 1,647,705 | 1,718,841 | +71,136 (+4.32%) |
| All JS gzip bytes | 481,039 | 502,365 | +21,326 (+4.43%) |
| HTML entry JS bytes | 467,603 | 537,050 | +69,447 |
| HTML entry JS gzip bytes | 139,102 | 159,598 | +20,496 |
| Staff Vite build | 9.03 s | 6.91 s | Single local observations |

Designer remains an async 239,859-byte chunk; Excel remains 940,243 bytes. The photo viewer is a separate 1,689-byte chunk (836 gzip). The inherited Excel size warning remains; the main staff entry's new **>500 kB** threshold crossing also warns. No initial-load reduction or controlled speed improvement is claimed. Full CI workloads differ from baseline, so their total durations are not a product performance comparison.

## Review and readiness

Milestone 6 task review is approved with no Critical/Important findings; final whole-branch review is separate. No merge, push, deployment, marketing changes or production-service access occurred.

Live identity/R2/provider permissions, physical mobile camera/Safari, backup/restore and inherited phase-advancement recovery remain unaccepted. A complete offline shell and offline task operation are absent. Optional photo recovery does not imply those capabilities. Coating/renovation lifecycle approval/configuration remains outstanding; service/unknown divisions also show configuration-required states. Existing pilot staff-wide job access and unbounded gallery reads remain. See [acceptance limits](../ACCEPTANCE.md#readiness-limits).
