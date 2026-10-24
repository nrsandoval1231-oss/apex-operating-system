# APEX2 milestone 5 photo handoff

Branch `codex/apex-2-photos`, base `b3270e09edb9dcdff89a3d8836eb5d3e56938ea7`.

Commits:
- `26b7e9d862c699dda1e24ab3f467d8aa0c30322d` — `feat(photos): store optional jobsite photos with secure upload receipts`
- `a4862e8a0c8e165b57eb3a979e972c1a57b98e2a` — `feat(photos): add recoverable mobile uploads and protected galleries`

No push, merge, deployment, marketing edits, or subagents. Root-owned status/plan documents were not edited or committed by this task. The only remaining tracked working-tree changes are those two parent-owned documents.

## Delivered behavior

Migration `0040_jobsite_photos.sql` is registered after 0039. Existing evidence defaults to `gate-requirement`; only `jobsite-photo`/photo rows allow both gate links null. Legacy same-job/real-requirement validation remains. Evidence purpose cannot change. Optional photo content/association and upload receipts are immutable; existing controlled visibility fields remain editable. Own upload receipt/activity does not emit gate `evidence.added` events. Legacy demo image synchronization now explicitly excludes optional photo records.

`JobPhotoService` validates strict supported MIME/base64/signature and decoded 8 MB bound; requires current active staff before storage; serializes upload identity and job mutation; writes the unique object before the row; cleans only its own unreferenced object. Actor/job/full bytes and metadata bind the saved request digest. Exact retries return the original receipt before mutable job checks, including lost-ack retry after closure; new writes after closure/cancellation refuse. Customer photos use the existing canonical projection, visibility authority, and protected serving route; token/publication/same-job/photo checks for image lookup now share one statement snapshot. Internal captions are never substituted into customer captions.

PhotoWorkspace replaces the M4 scaffolding. Camera capture and multi-library choices come first, optional details follow in a disclosure. Optional metadata edited after selection applies to unattempted files; the first upload freezes the exact persisted payload and key. JPEG/PNG/WebP inputs are checked and decoded before canvas optimization (2048 long edge; JPEG quality .85 where applicable). JPEG EXIF uses a capture instant only with an explicit valid offset; otherwise reliable camera-local text remains explicitly timezone unknown. Modified-file timestamps are never capture timestamps.

XHR progress distinguishes bytes sent from server confirmation. IndexedDB stores bytes under stable userId/jobId with no tokens; 10 files/40 MB per project bound, discard, retry/reload, sign-out abort/isolation, device-only warnings when unavailable, completed-byte cleanup after receipt. A historical queue stays visible: attempted entries can check their saved receipt; new camera/library uploads remain disabled. Authenticated blob galleries revoke object URLs, distinguish optional photos/gate evidence, show confirmed counts, upload chronology and metadata, filter stages/categories, and offer bounded thumbnails plus a native accessible fullscreen viewer. Admin/office/superintendent use the existing separate customer-caption publication route; link issuance/revocation authority remains admin/office.

## Final verification

Working directory for every command: `/workspace/apex2`.

Final service-backed runs source `/tmp/apex2/photos-env.sh`, which sources the original environment and uses disposable PostgreSQL database `apex2_photos_final` on `127.0.0.1:55432`; S3 adapter uses Moto `http://127.0.0.1:59000`, bucket `apex2`. This database was created fresh after the final migration edit. Earlier draft-applied databases were not reused for final verification. The upgrade test creates and drops its own separate disposable database with migrations 0001–0039, a populated published gate evidence record, then 0040.

| Exact command (after source where shown) | Final result | Exit | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | passed | 0 | `/tmp/apex2/photos-typecheck.log` |
| `pnpm --filter @apex/os build` | passed; existing bundle-size/Zod comment warnings | 0 | `/tmp/apex2/photos-build.log` |
| `source /tmp/apex2/photos-env.sh; pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/jobsite-photos.test.ts integration-tests/jobsite-photos-upgrade.test.ts --maxWorkers=1 --no-file-parallelism` | 8 passed, 0 skipped; 2 files | 0 | `/tmp/apex2/photos-pg-final.log` |
| `source /tmp/apex2/photos-env.sh; pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/business-lifecycle.test.ts integration-tests/workspace.test.ts --maxWorkers=1 --no-file-parallelism` | 7 passed, 0 skipped; 2 files | 0 | `/tmp/apex2/photos-regression-pg.log` |
| `source /tmp/apex2/photos-env.sh; pnpm exec vitest run packages/gate-service/src/customer.test.ts packages/gate-service/src/demoSeed.test.ts packages/contracts/src/index.test.ts apps/gate-api/src/server.test.ts apps/apex-os/src/api/client.test.ts apps/apex-os/src/photos/preparePhoto.test.ts --maxWorkers=1 --no-file-parallelism` | 124 passed, 0 skipped; 6 files | 0 | `/tmp/apex2/photos-unit-final.log` |
| `source /tmp/apex2/photos-env.sh; node apps/apex-os/tests/photos.e2e.mjs` | 15 acceptance groups passed, 0 skipped; real API port4199 | 0 | `/tmp/apex2/photos-browser.log`, `/tmp/apex2/photos-browser.json`, `/tmp/apex2/photos-browser-server.log` |
| `source /tmp/apex2/photos-env.sh; OPTIONAL_PHOTO_CLOSEOUT=1 EVIDENCE_DIR=/tmp/apex2/photos-closeout node apps/apex-os/tests/closeout-acceptance.e2e.mjs` | passed, 14 recorded steps, 0 skipped; optional photo retained after real guarded completion/closure | 0 | `/tmp/apex2/photos-closeout.log`, `/tmp/apex2/photos-closeout/closeout-acceptance.json` |
| `source /tmp/apex2/photos-env.sh; EVIDENCE_DIR=/tmp/apex2/photos-zero-closeout node apps/apex-os/tests/closeout-acceptance.e2e.mjs` | passed, 12 recorded steps, 0 skipped; original zero-optional-photo closeout | 0 | `/tmp/apex2/photos-zero-closeout.log`, `/tmp/apex2/photos-zero-closeout/closeout-acceptance.json` |
| `git diff --check` | passed | 0 | working tree inspection |

Backend coverage includes no optional metadata, multiple uploads, full-payload/actor/job retry binding, concurrent duplicate, lost acknowledgement then closure retry without storage write, active-staff/customer/inactive denial, MIME/base64/size refusals, storage lost-ack and DB insert cleanup, collision safety, job lock versus closure, publication authority/private caption exclusion, cross-job token image denial, token revocation, append-only receipts/content, and no gate events/instances created by optional uploads. Populated-upgrade case preserves all pre-0040 evidence columns, publication, and actual S3 object bytes; legacy invalid requirement/null links still refuse; legacy allowed deletion is unchanged.

Browser uses actual `hasTouch:true,isMobile:true` context at390×844 and `.tap()` for mobile controls, plus actual Chromium CDP touch events for swipe; desktop1440×1000 uses clicks/keyboard. It covers chooser/card action retention, repeated quick-action reopening, multi-file blank metadata, after-selection optional metadata, optimized dimensions, frozen lost-ack reload retry exactly once, user/token isolation, offline upload plus failed offline reload then online recovery, customer publication with separate caption, historical gallery and post-closure receipt resolution, unsupported/corrupt files, IndexedDB-unavailable warning, device-only discard, 10-file queue refusal, no horizontal overflow, and bounded single-filtered-thumbnail dimensions (<=360×270 at both sizes). Fixtures are tiny real browser-canvas PNG/JPEG images, not fake bytes presented as photographs.

## Earlier failures and corrections

The first seven-case PG attempt had 2 passes/5 failures: grouped base64 regex overflowed on the large rejection case (fixed to bounded simple checks); closure fixtures omitted required closure attribution/reconciliation fields; an injection used a separate imported ObjectExistsError identity (cleanup now also recognizes the storage error name); and the revoke test used POST to a nonexistent path instead of the existing DELETE route. Final PG/Moto runs above pass; no migration was modified in an already-applied final verification database.

`/tmp/apex2/photos-unit.log` records the earlier affected run: **116 passed / 4 failed**, exit1. Extracting the invalidation helper had dropped the existing `typeof window.dispatchEvent === 'function'` guard. The guard was restored without weakening assertions. `pnpm exec vitest run apps/apex-os/src/api/client.test.ts apps/apex-os/src/photos/preparePhoto.test.ts --maxWorkers=1 --no-file-parallelism` then passed **8/8**, exit0 (`/tmp/apex2/photos-client-unit.log`), including the new pre-upload coalesced-read invalidation test. The final affected run passed124/124 above.

Earlier browser attempts exposed harness selector/TouchInit/sign-in text assumptions, corrected after actual DOM inspection; the final run uses scoped quick actions, pilot token label, and real touch events. Parent viewport review found an oversized single filtered desktop thumbnail; auto-fill now bounds thumbnails, with explicit dimensions asserted in the final passing run. Normal composer/empty copy was shortened per review.

## Screenshots inspected

Viewport-only, built app, synthetic persisted data:
- `/tmp/apex2/screenshots/photos-composer-mobile.png` —390×844, capture-first composer
- `/tmp/apex2/screenshots/photos-mobile.png` —390×844, gallery/customer sharing
- `/tmp/apex2/screenshots/photos-composer-desktop.png` —1440×1000, composer
- `/tmp/apex2/screenshots/photos-desktop.png` —1440×1000, filtered bounded thumbnail/gallery

Guarded optional-photo closeout screenshots: `/tmp/apex2/photos-closeout/01-project-before-final-gate.png`, `02-ready-to-archive.png`, `03-closed-history.png`. Original closeout screenshots are under `/tmp/apex2/photos-zero-closeout`.

## Limits / next owner action

- Root independent review and full combined CI remain outstanding; not claimed complete here. New browser harness is executable directly; the existing CI browser list was not expanded in this task.
- Moto establishes actual S3-adapter HTTP/object behavior, not production provider IAM/R2 acceptance. Identity uses the existing synthetic pilot JWT path, not a real IdP.
- Touch-enabled Chromium is tested; no physical iPhone/Android camera or Safari/HEIC conversion was tested. HEIC is explicitly refused with conversion guidance. Orientation uses browser decoding.
- Persisted pending bytes survive an offline failed reload and recover when the app can load again. This is not a new offline application shell/service worker; initial app loading still needs network access.
- Capture metadata parsing is conservative JPEG EXIF support; absent/unknown instants fall back visibly to server upload time.
- Queue bounds are per user/project (10 files/40 MB), checked atomically at durable admission across tabs. Every attempt for a previously durable row requires a successful current-row lookup/freeze and uses that authoritative payload; failed lookups refuse sending, even for previously attempted requests. Missing/deleted durable rows are removed from local UI and never become page-only retries. Initial queues that never reached IndexedDB remain explicitly page-only and discardable.
- If both DB reference lookup and cleanup storage are unavailable after a failed write, the service preserves an invisible orphan rather than risk deleting referenced proof; no new reconciliation daemon is claimed.
- Existing pilot staff-wide job access, unbounded gallery reads, and inherited app bundle warnings remain. No RLS, tenant ACL, or provider security claim is added.


## Round 1 queue review correction — 2026-10-24

Candidate base `a4862e8a0c8e165b57eb3a979e972c1a57b98e2a`; fix commit **`367ab5c80738944aaf025ecfa105e9c939c7e6b8`** — `fix(photos): preserve frozen queue intents across concurrent tabs`.

Read `/tmp/apex2/photos-review.md` and the native IndexedDB reproduction `/tmp/apex2/photos-queue-review.mjs` with its recorded successful reproductions. Addressed both Important findings. Scope: `queueStore.ts`, `PhotoComposer.tsx`, and new portable covering harness `apps/apex-os/tests/photo-queue-races.e2e.mjs`; no backend, migration, publication, root documentation, or deployment changes.

The durable store now separates insert-only fresh-file admission from current-row mutation. Draft edits, first/every attempt freezing, and deletion read and act within one native readwrite transaction. An attempted row returns its saved payload without replacement. A missing row is terminal for edits and freezes: neither operation inserts. New selection alone may insert a fresh UUID, with owner/job caps checked atomically. Scope is checked against the actual stored record. Delayed save callbacks cannot repopulate local deleted UI either.

The composer sends the authoritative frozen record returned by the store on **every** durable attempt, including the first attempt from a stale tab. It separately tracks identities that were ever durable, so a missing row or lookup failure cannot fall back to cached page-only bytes. Unsaved metadata errors refuse a subsequent send. Only an initial queue that never became durable uses the existing honest page-only fallback. Post-closure receipt resolution and unavailable-IDB discard remain covered by the existing real-API browser suite.

Exact commands, cwd `/workspace/apex2`:

| Command | Result | Exit | Output |
| --- | --- | --- | --- |
| `pnpm typecheck` | passed | 0 | `/tmp/apex2/photos-queue-fix-typecheck.log` |
| `pnpm --filter @apex/os build` | passed; inherited Zod comment/bundle warnings | 0 | `/tmp/apex2/photos-queue-fix-build.log` |
| `node apps/apex-os/tests/photo-queue-races.e2e.mjs` | **6 passed, 0 skipped**, native Chromium IndexedDB, no page errors | 0 | `/tmp/apex2/photos-queue-fix-races.log` |
| `source /tmp/apex2/photos-env.sh; node apps/apex-os/tests/photos.e2e.mjs` | **15 acceptance groups passed, 0 skipped**, real API4199/PostgreSQL/Moto | 0 | `/tmp/apex2/photos-queue-fix-browser.log`; `/tmp/apex2/photos-browser.json` |
| `git diff --check` | passed | 0 | command inspection |

Final focused race output:

```text
PASS delayed metadata save cannot resurrect discarded bytes or UI after reload
PASS two tabs freeze authoritative metadata; stale edit and lost-response reload preserve exact key and payload
PASS delayed save in another tab cannot resurrect confirmed-and-cleared bytes
PASS stale upload after confirmation refuses missing durable row instead of falling back to cached bytes
PASS failed durable lookup refuses cached sending; recovery still honors another tab discard
PASS native transactions preserve owner/job scope and concurrent file/byte queue caps
PASS 6 native IndexedDB race groups; 0 skipped; no browser page errors
```

The race harness bundles the actual production composer/store from portable repository-relative paths into a temporary local React harness, uses separate same-context browser tabs and native IndexedDB, delays one native open-success callback for controlled save scheduling, and controls only upload responses. It asserts identical request key/full payload after lost-response reload, first-attempt use of another tab's newer durable metadata, no recreation after discard or confirmed cleanup, zero requests when a durable lookup fails or the record has been deleted, owner/job refusal, and concurrent count/byte admission caps. No business rows are fabricated by that focused harness; the separate full photo browser run verifies real API receipts and closed-job behavior.

An early new-harness run passed the delayed-discard case then timed out on an exact wrapped textarea label after its nonempty value changed the label text. The locator now matches the stable label text without exact whole-label matching, consistent with the existing photo browser harness. The five-case version then passed; the final version adds the durable-lookup failure/recovery case and passes all six. No assertions about queue content, retry identity, terminal deletion, or network sends were weakened.

Only the prescribed focused checks were rerun; full CI remains the root task's responsibility. `/tmp/apex2/final-env.sh` and its empty final-CI database were not used. Backend/PG/upgrade/closeout evidence from the original candidate remains recorded above and was not rerun for this client-only correction. Parent-owned tracked/untracked docs and screenshot artifacts remain untouched. Provider/physical-device/offline-shell limits above still apply.
