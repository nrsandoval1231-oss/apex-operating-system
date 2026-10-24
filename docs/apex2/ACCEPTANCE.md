# APEX 2.0 acceptance

The implemented staff workflows are reviewable in this branch. Deployment and production readiness remain unapproved. Exact final CI results, environment and bundle measurements are recorded in [validation/integration.md](validation/integration.md).

| Workflow | Acceptance evidence |
| --- | --- |
| Shell | Five destinations plus separate quick action, nested manifest/icon assets, sign-out, stable-token resolved-actor isolation with delayed old private responses, server refusal, keyboard Escape/focus, touch target and overflow checks. `shell.e2e.mjs` owns a built preview and uses explicit synthetic read fixtures; it does not prove persistence. |
| Checklist | Actual API/PostgreSQL create/edit/complete/reload/history, scope/assignee rules, lost-response idempotency, missing/closed project refusal, desktop and touch mobile. `checklist.e2e.mjs`. |
| Calendar | Actual persisted events, all four views, project/member/type filtering, collapsed mobile Filters with active count, first appointment above mobile actions, native dialog focus, DST/timezone handling, operational moves/conflicts and server refusals. `calendar.e2e.mjs`. |
| Today and projects | Canonical task/calendar state across columns, owner scope, fast project changes clear old data, coalesced reconnect reads, persisted notes/priority, unsupported divisions, initial selected mobile Today retains its daily summary and deliberate selection reveals the project. `workspace.e2e.mjs`. |
| Optional photos | Actual PostgreSQL/Moto upload receipts, safe retries, frozen metadata, bounded native IndexedDB queue and atomic cross-tab regressions, user/sign-out isolation, historical receipt recovery, private galleries, separate customer captions/publication/revocation. `photos.e2e.mjs`, `photo-queue-races.e2e.mjs`, service and populated-upgrade tests. |
| Existing lifecycle | Full integration suite plus original zero-optional closeout and opt-in optional-photo closeout. Optional documentation does not satisfy or change canonical gate facts. |

Browser acceptance covers desktop 1440×1000 and mobile 390×844 with `hasTouch:true`, mobile context and actual `.tap()` interactions. Real Today/project layouts also cover 360, 768 and 1024 pixel widths; these are lightweight overflow/column/touch checks, not repetitions of every workflow. Reduced-motion CSS, labelled controls, 44px primary action targets, native dialog keyboard handling and runtime-error checks are retained. This is a scoped accessibility check, not a complete WCAG audit.

## Synthetic visual evidence

[Today desktop](screenshots/final-today-1440.png) · [Today mobile](screenshots/final-today-390.png) · [Checklist mobile](screenshots/final-checklist-390.png) · [Calendar mobile](screenshots/final-calendar-390.png) · [Jobs mobile](screenshots/final-jobs-390.png) · [Project mobile](screenshots/final-project-390.png) · [Photos mobile](screenshots/final-photos-390.png).

All final captures are viewport-only screenshots of the built application using a dedicated local visual PostgreSQL database and actual HTTP API/storage. Names, address, amounts, tasks and appointments are synthetic persisted demo records. The bundled CC0 geometric excavation illustration is a clearly labelled fixture, not a customer photograph. The canonical demo's pool division is supplied explicitly by the visual harness before workspace initialization. Gate release counts are read from real seeded gate facts; missing dates remain visibly unscheduled.

Reproduce after a production build with a dedicated loopback PostgreSQL database whose name contains `visual` and the configured local Moto bucket, then run `node apps/apex-os/tests/integration-demo.e2e.mjs`. The script owns API port 4200, seeds through existing domain services, uploads the optional illustration through the Photo API and writes images plus capture metadata to `APEX_DEMO_SCREENSHOTS` (default `/tmp/apex2/final-demo`). Never use the fresh CI database for visual work.

## Readiness limits

- Live identity, R2/provider IAM and staging deployment have not been accepted. Synthetic pilot JWTs and local Moto establish local behavior only.
- Touch-enabled Chromium does not establish physical iPhone/Android camera, mobile Safari or HEIC conversion support. HEIC is explicitly refused with guidance.
- Manifest and recoverable pending photo bytes are implemented. A complete offline app shell and offline task operation are not implemented; an offline failed reload can recover after connectivity returns. Private media is fetched through authenticated protected routes and is not added to a public service-worker cache.
- Backup/restore and inherited phase-advancement failure recovery remain unverified. Recorded phase and canonical gate release are separate facts.
- Designer Pools has the implemented lifecycle. Coating and renovation lifecycles await approval/configuration; service/unknown divisions also display configuration-required states. No pool inspection catalog is silently substituted.
- Existing staff-wide pilot job access, unbounded gallery reads and inherited bundle warnings remain. No production tenancy/RLS or provider security claim is made.
- Migration upgrade tests require a disposable integration role with `CREATEDB` to create/drop their own temporary database. This is a test requirement, not a production application-role grant.
