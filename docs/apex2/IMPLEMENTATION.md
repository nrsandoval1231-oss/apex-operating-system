# APEX 2.0 implementation status

## Current status

Milestones 1–6 are implemented and independently reviewed in milestone PRs 32–37. Final integration PR 37 is on `codex/apex-2-integration`, based on reviewed photo candidate `6d9162f4849ff5b3ba78d08e5493a14880522283`.

The implementation started from main `f4421197de580028bfe53f9c7d50776b20a6a52b`, including merged cleanup PR 31. The owner authorized merging eligible milestone PRs on 2026-10-24; GitHub records their current merge status. No production deployment was performed. Final corrected CI passed at `2231248cc6c0fc69e5850188782943191c45dec5`. Whole-branch review and scoped correction review are complete, with no Critical/Important findings remaining in the reviewed fixes.

## Binding specification

The owner's Build APEX 2.0 directive requires a charcoal/gold desktop workspace with Checklist, Calendar + Active Projects, and Selected Project; dedicated mobile Today, Checklist, Calendar, Jobs and More with a separate quick-action button; real persisted tasks and scheduling; secure optional jobsite photos; and preservation of authentication, approval, inspection, procurement, closure and historical evidence safeguards.

No approved mockups were attached or found in the workspace, so the detailed written direction is authoritative. The public marketing website remains unchanged. No fictional business values or records are inserted into production views. Screenshots and tests use explicitly synthetic local records.

## Milestones and review sequence

| Milestone | Status | Pull request | Detailed evidence |
| --- | --- | --- | --- |
| 1. Brand, navigation and responsive shell | Implemented; review approved | [32](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/32) | [Foundation](validation/foundation.md) |
| 2. Persisted checklist, assignment and recurrence | Implemented; review approved | [33](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/33) | [Checklist](validation/checklist.md) |
| 3. Unified calendar and persisted appointments | Implemented; review approved | [34](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/34) | [Calendar](validation/calendar.md) |
| 4. Desktop command center and mobile project workspace | Implemented; review approved | [35](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/35) | [Workspace](validation/workspace.md) |
| 5. Optional photos and recoverable uploads | Implemented; review approved | [36](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/36) | [Photos](validation/photos.md) |
| 6. Integrated polish and full regression validation | Implemented; final CI and review approved | [37](https://github.com/nrsandoval1231-oss/apex-operating-system/pull/37) | [Acceptance](ACCEPTANCE.md) · [Integration](validation/integration.md) |

PRs were stacked in milestone order to isolate review diffs. Review and merge them in that order, retargeting each dependent PR to main after its prerequisite merges. Local independent review is not owner merge approval. No merge or deployment is authorized by this status document.

## Canonical architecture

- React/Vite and the existing API, service, domain and contract layers remain. PostgreSQL is the transactional authority; existing EvidenceStorage adapters serve private media.
- Ordinary tasks have one task/history/receipt model. Lead follow-ups and operational gate requirements retain their separate existing authority; task completion cannot release gates.
- Ordinary appointments have one event/history/receipt model. The calendar projects existing visits, gates, inspections and task deadlines without copying them into new event records. Operational moves still use their original guarded commands.
- Project notes are append-only; priority uses manager authority, expected revisions, immutable retry receipts and the shared job lock. Gate progress reuses the existing signed-scope predicate and never derives completion from phase position.
- Jobsite photos extend evidence with an explicit optional purpose. Required gate links remain mandatory for gate evidence. Publication uses existing staff authority and live, same-job customer capabilities; internal captions are separate from customer captions.
- The device upload queue is scoped to user and project, stores no tokens, and uses atomic native IndexedDB operations. Every attempted upload uses its authoritative frozen payload. Discarded or confirmed entries cannot be recreated by stale tabs.
- Division comes from stored intake facts. Only Designer Pools has a verified stage catalog. Coating, renovation, Pool Service and unknown divisions remain configuration-required; no pool workflow is invented for them in the new workspace. Retrofitting legacy division dispatch remains outside the implemented scope.

## Brand evidence

Official source inspected on 2026-10-24: https://apexgetsitdone.com/. The unmodified lion/wordmark comes from `/snapshot/media/uploads/2024/09/Apex-Site-Logo-2x.png`, SHA256 `421e7a063b78adb7f47c69fce6d17e5c9f5186360060cf04e0c3fbdefb1688bb`.

The official Concrete Coating image `/snapshot/media/uploads/2024/10/Apex-Concrete-Coating-V2.png` supplies gold RGB(184,143,82), **#B88F52**. Official charcoal is #383838; the logo's sage #A1CCCA remains unchanged. Central tokens define colors, typography, spacing, radii, shadows and control states.

## Validation baseline and milestone evidence

Unchanged merged main passed `bash scripts/ci.sh` in 627.133 seconds: 581 core tests, 585 Designer tests, 2 website unit tests, 166 website browser tests, 10 production-intake browser tests and 39 integration tests passed. Two missing-engine guards were skipped, not passed. Two staff browser harnesses and five archive scripts also passed. Environment: disposable PostgreSQL/Moto and synthetic data. [Exact baseline metadata](validation/baseline-ci.json).

The linked milestone reports record exact commands, commits, counts, failures, skips and limits. They also preserve the independent review corrections: nested-route assets; checklist privacy and unavailable-project intent; calendar DST/timezone/status handling; division inspection guards and unique anchors; and photo queue races. Milestone 1 browser API reads used intercepted fixtures; later persistence workflows use the real API/PostgreSQL. Queue-race checks use actual components and native IndexedDB with controlled upload responses.

Final actual-application screenshots: [desktop workspace](screenshots/final-today-1440.png), [mobile Today](screenshots/final-today-390.png), [mobile calendar](screenshots/final-calendar-390.png), [mobile photo gallery](screenshots/final-photos-390.png). All twelve final captures use persisted synthetic local records and a labelled demo illustration, not production customers.

Final corrected CI passed in 659.457 seconds: 596 core, 585 Designer, 2 website unit, 166 website browser, 10 production-intake browser and 70 PostgreSQL/storage cases passed (1,429 total); two existing missing-engine guards were skipped. Additional shell 6, native IndexedDB 6, checklist 4, calendar 16, workspace 31 and photo 16 browser groups passed, along with both original zero-optional-photo and optional-photo closeout paths. These group/step counts are not added to the test-case total. Exact commands, source SHA, environment and limitations are in the integration report.

Total emitted JavaScript grew from 1,647,705 to 1,720,254 bytes (gzip 481,039 to 502,737). The entry grew from 467,603 to 538,463 bytes and now crosses the 500 kB warning threshold. This is a measured functionality cost, not a performance-improvement claim.

## Remaining acceptance conditions

- Approved Coating and Design & Renovation lifecycle definitions are still required. No response to the owner clarification has been received; shared tools proceed while those catalogs remain inactive.
- Live identity/provider access, real R2 permissions, backup restoration and inherited phase-advancement recovery require staging acceptance. See [inherited audit risks](../audit/REMAINING_RISKS.md).
- Touch Chromium is tested; physical camera, Safari and HEIC conversion are not verified. Unsupported HEIC is refused with conversion guidance.
- Pending photo bytes recover when the app can load again. A full offline application shell and offline task/calendar mutations are not implemented.
- Mixed-precision API appointment timestamps can sort incorrectly within the same second. Normal UI timestamps use fixed precision; numeric comparison remains a nonblocking follow-up.
- Existing staff-wide job access and financial API policy remain. UI hiding is not stronger server authorization. Large task/calendar/gallery lists remain unpaginated.

Next: owner review of the stacked PRs, approval/configuration of the remaining division catalogs, and staging/device acceptance. Owner approval is required before merge or deployment; no production-readiness claim is made from local tests alone.

Merge-time review and focused correction evidence: [merge acceptance](validation/merge-acceptance.md).
