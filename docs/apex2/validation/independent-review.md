# APEX 2.0 whole-branch independent review

Reviewed base `f4421197de580028bfe53f9c7d50776b20a6a52b` through frozen product/test source `78dfa0857e53b13d69afc87bd2c8364704d9e485`, in `/workspace/apex2`. Root-owned final evidence documents were being updated during this review. This report concerns the frozen source, not a later documentation commit.

## Verdict

**Spec compliance: changes required. Technical merge readiness: not yet ready; fix the three Important findings below and obtain a scoped re-review.** The branch is a substantial, reviewable implementation with passing combined local CI. No Critical defect was found. The explicit calendar division requirement remains unimplemented; compact calendar navigation and supported empty-token local photo authentication have concrete defects.

This is separate from production readiness: live provider/device/restore acceptance and approved non-pool lifecycle definitions remain outstanding. Neither this review nor passing local tests authorizes merge or deployment.

## Strengths

- The existing React, HTTP API, PostgreSQL and EvidenceStorage architecture is preserved. No marketing changes or new framework appear in the branch. The checked-in official logo SHA256 matches the recorded source hash `421e7a063b78adb7f47c69fce6d17e5c9f5186360060cf04e0c3fbdefb1688bb`.
- Ordinary tasks and appointments each have a single authority, immutable history, actor/request-bound receipts, expected revisions and shared mutable-job locking. Personal history reads evaluate visibility and entries in one database statement. Recurrence creates a single successor under the original transaction; project task completion does not release a gate.
- Calendar entries retain explicit source identity. Existing visits, gate work, inspections and deadlines are projected without new copies; guarded operational moves remain the original command. Timed event edits preserve unchanged instants across DST ambiguity, while all-day dates remain civil dates.
- Notes and priority are real persistent commands with authenticated actor/time, audit, job locking and manager authority for priority. Lifecycle progress counts actual required gate releases using the shared signed-scope predicate; phase position is not presented as verified completion. Unsupported division inspection tabs are guarded and legacy anchors remain unique.
- The optional-photo migration preserves mandatory gate evidence links and same-job requirement checks. Photo receipts are bound to actor, job and exact bytes/metadata. Writes lock the job before storage, uncertain commits do not blindly delete referenced objects, and exact historical retries are distinct from new writes. Optional photos remain outside gate release commands.
- Customer publication is explicit and uses separate captions; token state, same-job scope and publication are read together for protected customer photo lookup. Staff bytes retain private/no-store delivery. New photo UI uses blobs, no token query strings, and revokes object URLs.
- The native IndexedDB queue uses insert-only admission and atomic existing-row updates/freezing/deletion. Missing rows cannot be resurrected by stale edits; every durable send uses the authoritative frozen payload. The UI separates pending device data from validated server confirmation and exposes unavailable recovery honestly.
- Token/path resource masking and resolved actor/role remounts cover both explicit token changes and stable-empty-token actor changes. Pending-read clearing respects promise identity, and one subscriber cannot abort another subscriber's fetch.
- Final supplied screenshots visibly support the three-column desktop command center and compact mobile Today/calendar, with five destinations and separate Quick add. Tests use persisted local data for workflow acceptance, with shell fixtures and synthetic images explicitly distinguished.

## Findings

### Important 1 — required calendar division filtering never integrated

**Locations:** `apps/apex-os/src/components/CalendarWorkspace.tsx:97`, `:158`, `:577`; authoritative source already exists in `apps/apex-os/src/api/useProjectWorkspace.ts:12` and `packages/gate-service/src/workspace.ts:45`.

The full calendar has state/predicates and controls only for project, member and event type. Its division display is literally `Division · Unknown`, irrespective of known Designer Pools/Coating/Renovation metadata. The owner's section 8 explicitly requires scheduling filters by Division, Project, Team member and Event type (confirmed by the coordinator during this review). The M3 report deferred division until M4 metadata; M4 now supplies that metadata, so this is an unmet final integration requirement, not an approved external-catalog limitation.

**Impact:** operators cannot isolate the schedule of a division, and known jobs are presented as having unknown division in this view.

**Correction:** consume canonical workspace metadata, add a labelled division selection and predicate, include it in active-filter count, and define truthful separate behavior for personal events, unknown division, and loading/error states. Do not infer stage policies from this filter. Cover mixed known divisions plus personal/unknown records on desktop/mobile and preserve combined project/member/type filtering.

### Important 2 — compact Agenda navigation skips 24 days of work

**Locations:** `apps/apex-os/src/components/CalendarWorkspace.tsx:176`, `:196` (especially `:201`); used by `apps/apex-os/src/pages/TodayFeed.tsx:115` and project Calendar tab.

Compact Agenda renders seven consecutive days (`compact ? 7 : 31`), but Previous/Next always advances Agenda by 31 days. Starting October 24 shows October 24–30; Next starts November 24. Work scheduled October 31–November 23 is never visited by ordinary next-period navigation. The seven-day project calendar has the same problem.

**Impact:** the main compact scheduling workflow silently skips upcoming weeks and can falsely suggest there is no near-term work.

**Correction:** derive period navigation from the rendered Agenda span (seven compact, 31 full), preserving Week/Day/Month behavior. Verify adjacent compact windows in both directions with a record in the formerly skipped interval.

### Important 3 — photo requests break supported empty-token local authentication

**Locations:** `apps/apex-os/src/photos/uploadPhoto.ts:21`, `apps/apex-os/src/photos/ProtectedPhoto.tsx:26`; supporting unchanged contract `apps/gate-api/src/server.ts:635`.

Both new photo paths always send `Authorization: Bearer ${token}`. With the intentionally supported tokenless loopback `localUserId` session, token is empty. The server enters local authentication only when the Authorization header is absent. A nonempty `Bearer`/`Bearer ` header bypasses that branch and fails bearer verification. In contrast, the shared JSON client correctly omits Authorization when token is empty.

**Impact:** the local staff workspace can authenticate, list photos and use tasks/calendar, but uploading or viewing photo bytes fails in that same session. This does not affect Access-assertion mode (which resolves its assertion first) and is not an authorization bypass; it is a broken existing supported authentication mode.

**Correction:** omit Authorization for an empty token in both XHR and protected fetch, matching the established client contract. Preserve captured nonempty token behavior and abort/isolation checks. Add a focused real-API `localUserId` browser case proving authenticated no-token upload and gallery bytes; keep anonymous refusal when local mode is not configured.

### Minor 1 — project task hook sends the wrong query parameter

**Locations:** `apps/apex-os/src/api/useTasks.ts:8`; API reads `jobId` at `apps/gate-api/src/server.ts:1103`.

The hook requests `/api/tasks?job=...`; the server recognizes only `jobId`. Each project request consequently returns every task visible to that actor, including their personal and other-project tasks. Checklist re-filters by `jobId` before display, so I found no cross-user authorization or rendered-project disclosure. It nevertheless defeats server scoping and contradicts the scoped-read statement in the milestone review.

**Correction:** use `jobId` and assert the project's response excludes other projects and personal tasks. This is a small contract correction with an increasing payload cost as data grows.

### Minor 2 — today's appointment selection follows creation order, not schedule order

**Locations:** `apps/apex-os/src/components/CalendarWorkspace.tsx:377` (slice at `:388`); upstream `packages/gate-service/src/calendarEvents.ts:45` orders by event ID descending.

The mobile Today summary takes the first two appointments for today without sorting them by scheduled time. Creating 09:00, then 12:00, then 15:00 makes the summary show 15:00 and 12:00 and omit 09:00; timed cards in day/agenda also retain this creation order. Full calendar remains available, so this is nonblocking, but arbitrary creation order is poor behavior for a daily operating summary.

**Recommendation:** sort by the intended all-day/timed schedule order before truncating; define whether past appointments should remain or the summary should prioritize the next ones. A three-event case created out of time order would distinguish the behavior.

### Minor 3 — new entry bundle warning remains a measured cost

**Locations:** `docs/apex2/IMPLEMENTATION.md:58`; `/tmp/apex2/final/ci.log:90`; inventory in `/tmp/apex2/final/staff-assets.json`.

The entry is 537,050 bytes versus baseline 467,603 (+69,447), crossing Vite's 500 kB threshold. Total emitted JS grows by 71,136 bytes. This was already identified in M6 review and is not a new correctness defect. Keep the distinction between the new entry warning and inherited Excel warning, and retain measurements rather than calling this a performance improvement. Further route splitting can be a separate measured follow-up.

## Evidence reviewed and review method

Reviewed in passes: supplied whole-branch log/stat/diff; milestone requirements and reports; new contracts/migrations/services/API changes; browser identity/resource hooks; task/calendar/project/photo components; integration of legacy operational components; relevant tests and recorded CI outcomes; responsive shell/styles and final screenshots. Large source outputs were read in bounded sections when needed. Supporting unchanged contracts inspected for specific risks included authentication dispatch, job immutability locking, protected evidence delivery, customer publication, gate-scope derivation and historical/operational composition. This was a source and evidence review, not an exhaustive new execution of every test or a line-by-line recertification of unchanged modules.

The three Important findings and the task-query mismatch follow directly from deterministic branch/control flow; no new service writes or broad test runs were needed. No source edits, checkout, commits, subagents, suite reruns, merge or deployment were performed. Only this review output was written.

Directly inspected `/tmp/apex2/final/ci.json`, environment metadata and relevant log results: `bash scripts/ci.sh`, exact frozen SHA above, exit 0, 659.171 seconds; empty initial local PostgreSQL 17.11 `apex2_final` and empty Moto `apex2-final` bucket, Node 24.19.0, pinned CI pnpm 11.18.0. Dirty paths recorded at start were documentation only.

- 596 core, 585 Designer, 2 website unit, 166 website browser, 10 production-intake browser, and 70 PostgreSQL/storage tests passed: 1,429 cases total. Two existing missing-engine guard skips remain skips.
- Additional shell 6, native IndexedDB 6, checklist 4, calendar 9, workspace 30 and photos 15 browser groups passed. Group counts are not added to test-case totals.
- Both original zero-optional-photo and opt-in optional-photo closeout passed. Logs explicitly show premature close/completion refusals, canonical final gate release, role restrictions, immutable retained history, protected evidence, and retained optional photos without altered gate facts.
- Production staff build reports 6.91 seconds. This single environment observation is not a comparative speed claim.

These tests establish meaningful local behavior but do not cover the newly identified division filter, compact period stride, empty-token photo headers, or server task query mismatch. Passing CI therefore does not negate those findings.

## Behaviors not certified, declined judgments and explicit boundaries

1. **Approved Coating/Renovation/Pool Service stage policies:** not judged complete because approved definitions were not supplied. Configuration-required behavior is appropriate. The division *filter* is independent and remains a finding. Legacy backend division dispatch is unchanged and disclosed; this review does not approve applying pool policy to other divisions.
2. **Team-member scheduling semantics:** judged as filtering stored staff assignees for ordinary appointments and task deadlines. Existing operational entries do not carry that same user assignment; I did not invent a mapping between staff users and subcontractor/crew identities or certify crew-capacity reservation through ordinary appointments. The existing guarded operational workflow remains separate.
3. **Live identity/provider IAM/R2 security:** not certified. Existing authentication dispatch and local authorization paths were inspected; CI uses local pilot JWTs/Moto. Real provider/edge/browser sessions still need staging acceptance. No tenancy or RLS claim is made; the inherited staff-wide single-tenant access model remains.
4. **Physical mobile camera, native Safari, Android hardware and HEIC conversion:** not certified. Touch Chromium is meaningful local browser coverage, not hardware acceptance. HEIC is explicitly refused; conversion is not implemented.
5. **Complete offline shell or offline checklist/calendar writes:** not certified or claimed implemented. The implemented photo queue recovers when the application can load again; unavailable storage is disclosed. Offline reload failure and later recovery are distinct from a fully offline app.
6. **Backup/restore and inherited phase-advancement failure recovery:** not certified by this branch. Existing audit risks remain and no local suite substitutes for staging restore/fault acceptance.
7. **Arbitrary-scale performance:** not certified. Lists/gallery are unpaginated and private images load full prepared bytes. Local measurements are reported; no high-volume/load or production-network benchmark was supplied. The task-query mismatch adds an avoidable local cost and is separately recorded.
8. **Complete accessibility certification/every viewport/assistive technology:** not certified. Label/focus/dialog/touch/reduced-motion and supplied responsive checks support scoped acceptance, not full WCAG conformance. No approved mockups were available for pixel-matching; written direction governs visual assessment.
9. **Business financial completeness:** not claimed. Existing permitted contract/draw facts are displayed; collections/cost/profitability/provider integrations remain unavailable. UI hiding is not stronger API authorization.
10. **Arbitrary direct database corruption or every malformed legacy metadata shape:** not certified. Reviewed the defined migrations and service contracts, plus the supplied populated gate-evidence upgrade test. No speculative defect is asserted for states outside those contracts.
11. **Final PR metadata, owner approval, deployment and production rollout:** outside this read-only source review. Final documentation links/claims should be reconciled after fixes and exact validation evidence updated. Do not label all explicit requirements complete until the division filter is supplied.

## Recommended next step

One bounded correction wave can address the three Important issues and the small task-query contract mismatch. Chronological ordering is a sensible nearby nonblocking improvement; the bundle follow-up can remain documented. Run focused regressions for those changes and the required applicable checks, then request a scoped re-review of the correction diff. Any new source SHA must be clearly distinguished from the already-passing frozen full-CI SHA.

## Single final correction wave — scoped re-review

**Reviewed correction range:** `78dfa0857e53b13d69afc87bd2c8364704d9e485..2231248cc6c0fc69e5850188782943191c45dec5`. Product fix is `2d52c4161b524238d4de4c82ab9dbdc225a422ca`; subsequent commits refine browser waits/assertions only. Read the complete supplied `/tmp/apex2/final-fix-review.diff` once in bounded sections, the correction brief/report, and focused evidence. This is one scoped re-review of the findings and new breakage in their fix, not another whole-branch audit.

**Updated source verdict: APPROVED with nonblocking minor follow-ups. All five requested findings are ADDRESSED. No remaining Critical or Important issue was found in the correction diff.** This supersedes the earlier changes-required source verdict. Technical merge readiness remains conditional on root verifying the running full CI at `2231248` and reconciling final evidence documents; this reviewer does not claim that run has completed. Production acceptance limitations and owner merge/deploy approval remain unchanged.

| Original finding | Verdict | Correction assessed |
| --- | --- | --- |
| Important 1: missing division filter | **ADDRESSED** | `CalendarWorkspace.tsx:84`, `:164`, `:554` consume canonical workspace metadata, distinguish known divisions/Personal/Unknown, combine all four predicates, and count the selection. Loading/error/retry is explicit; an active division filter does not silently become unfiltered when metadata is unavailable. No lifecycle catalog or authorization policy was expanded. |
| Important 2: compact Agenda stride | **ADDRESSED** | `CalendarWorkspace.tsx:216` advances seven days for compact Agenda and 31 for full Agenda, preserving Week/Day/Month logic. Regression visits the day+8 record using adjacent windows in both directions at desktop/mobile widths. |
| Important 3: empty-token photo authentication | **ADDRESSED** | `uploadPhoto.ts:21` and `ProtectedPhoto.tsx:26` omit Authorization only when token is empty. Nonempty-token behavior, captured token, cancellation and private/no-store fetch remain. The new real localUserId browser case confirms upload, decoded protected bytes and absent headers; normal unauthenticated mode still refuses. |
| Minor 1: project task query parameter | **ADDRESSED** | `useTasks.ts:9` sends `jobId`. Actual API response assertions exclude personal/other-project tasks, and the delayed project-switch route now targets the corrected request. |
| Minor 2: creation-order Today appointments | **ADDRESSED** | `CalendarWorkspace.tsx:180` sorts before rendering/truncating. `calendarWorkspace.ts:31` puts all-day work first and orders normal UI UTC timestamps chronologically with deterministic identity ties. The explicit policy retains earlier appointments from today, including elapsed ones. Persisted 09/12/15 coverage demonstrates earliest-two selection; Day verifies all-day-first ordering. A subsecond serialization edge is noted below, without reopening the original creation-order defect. |

### New nonblocking precision note

**Minor — `apps/apex-os/src/lib/calendarWorkspace.ts:43`:** the new timed comparator uses `localeCompare` on accepted UTC timestamp strings rather than numeric instants. The existing contract permits both `2026-10-24T15:00:00Z` and `2026-10-24T15:00:00.001Z`; lexical comparison puts the latter first although it is one millisecond later. The UI normally creates fixed `.sssZ` timestamps, so the reviewed normal scheduling behavior and original 09/12/15 finding are corrected. This edge concerns direct-API timestamps with different fractional precision and is not a load-bearing merge blocker.

Recommendation: compare `Date.parse(startsAt)` for two timed entries, keeping the explicit all-day and identity ordering. I ran only a tiny read-only schema/ordering probe to resolve this named contract risk: both second-only and fractional-second samples were accepted; a minute-only sample was rejected and is not part of the finding. No API writes, mutations or suites were run.

The existing entry-bundle follow-up remains nonblocking. Corrected focused measurements are total JS **1,720,254 bytes / 502,737 gzip**, entry **538,463 / 159,966 gzip**. Keep old full-CI evidence at `78dfa08` clearly distinct from correction-source evidence and the currently running full CI.

### Evidence and test changes assessed

Directly read the focused logs: typecheck has no diagnostics; build succeeds in 6.89 seconds with retained bundle warnings; unit runner reports 3 files / **11 passed**; calendar reports **16 groups**; sequential same-database workspace reports **31 groups**; photos include **16 groups** with the real local-pilot case; visual log reports **12 captures**, no skips. Exact commands, source correspondence and log paths are in `/tmp/apex2/final-fix-report.md`. The report distinguishes photos at `146b42d` (unchanged product/photo source thereafter) from calendar→workspace at `2231248`, and records the earlier full CI only at its original SHA.

The new chronology browser case filters a real API response to the persisted correction-event IDs for deterministic isolation; it does not fabricate their contents. The revised workspace test computes the first two eligible persisted appointments after preceding harnesses seed more work, rather than requiring the most recently created event to displace earlier chronological work. It retains the project event assertion, actual persisted reconnect record check, shared-read count and subscriber-cancellation assertions. This is a justified adjustment for the changed two-item selection policy; the targeted ordering case supplies the out-of-order regression.

The prior unknown/loading distinction, private data isolation, legacy operational workflows and all listed external acceptance boundaries remain as in the whole-branch report. No new broad review, subagents, source edits, checkout, suite reruns, commits, merge or deployment occurred. Only this review report was appended. Root owns verifying the pending full-CI exit and committing final documentation evidence.

**Precision-note reachability check:** inspected only the unchanged calendar output path for this named risk. `packages/gate-service/src/calendarEvents.ts:163` constructs the event from parsed input fields, `:202` persists the event as JSONB snapshot, and `:48` returns `CalendarEventSchema.parse(snapshot)` without timestamp normalization. `apps/gate-api/src/server.ts:1487` passes those event objects directly into the workspace projection. These appointment times are not read from timestamptz through `Date.toISOString()`. Thus mixed accepted string precision can reach the comparator through the canonical API; the note is a real narrow direct-API ordering edge, not merely an unreachable helper robustness concern. Its cost is limited to subsecond ordering within the same second, and root has elected to defer numeric-comparator refinement while preserving the frozen full-CI run. The approved source verdict and all-five-addressed mapping are unchanged.

## Coordinator final CI verification

Full CI subsequently passed at frozen `2231248cc6c0fc69e5850188782943191c45dec5`, exit 0, 659.457 seconds, with 1,429 cases passed and two disclosed guard skips. Corrected calendar 16, workspace 31 and photos 16 browser groups passed in the actual CI sequence; both closeout paths passed. Source/tests remained unchanged throughout execution. See [final corrected evidence](integration.md#final-corrected-candidate). This completes the pending validation condition in the scoped source verdict; production acceptance conditions remain.
