# APEX 2.0 implementation status

Base: main `f4421197de580028bfe53f9c7d50776b20a6a52b`, including merged cleanup PR #31. No open PRs at start. Branch: `codex/apex-2-foundation`. No deployment or merge authorized.

## Binding specification

Owner's Build APEX 2.0 directive: dark charcoal/gold horizontal desktop shell and three-column Checklist / Calendar + Active Projects / Selected Project workspace; dedicated mobile Today, Checklist, Calendar, Jobs, More and separate quick-action control; persisted tasks/calendar; optional secure jobsite photos; preserve all business gates, migrations, identity and customer isolation. No mockups were attached or found in workspace; detailed written direction is authoritative. Marketing website remains unchanged.

## Architecture and decisions

React/Vite, existing API/service/domain/contracts layers, PostgreSQL and EvidenceStorage remain authoritative. Existing lead follow-ups must not become a competing checklist; extend or project their existing authority. Existing scheduled visits, inspections and gate dates remain operational calendar records; new appointment kinds join one calendar read model. Optional job photos reuse storage/visibility boundaries and never satisfy or create gate requirements. Existing project deep links and operational screens remain accessible.

Official source inspected 2026-10-24: https://apexgetsitdone.com/. Main logo: `/snapshot/media/uploads/2024/09/Apex-Site-Logo-2x.png`. Official Concrete Coating asset: `/snapshot/media/uploads/2024/10/Apex-Concrete-Coating-V2.png`, dominant gold pixel RGB(184,143,82), **#B88F52**. Official charcoal #383838; main logo sage #A1CCCA remains unchanged. Centralized tokens use gold for selection/actions and higher-contrast variants where needed.

## Milestones

- [x] 1 Foundation: branded desktop/mobile shell, reusable controls, existing route compatibility. Browser-check navigation at desktop and 390px touch viewport; build/typecheck; commit/PR.
- [x] 2 Today + Checklist: authoritative personal/project/assigned/recurring tasks, due dates, priority, history, optimistic concurrency, task CRUD/completion. Test persistence, access, races and no gate side effects; commit/PR.
- [ ] 3 Calendar: existing scheduling read model plus persisted appointments, day/week/month/agenda and filtering; edits preserve operational restrictions. Test reload, edits, conflicts and date boundaries; commit/PR.
- [ ] 4 Projects: searchable/filterable selectable projects, verified progress, next milestones, integrated detail tabs/deep links, division metadata and safe lifecycle configuration. Test selection/back navigation, permissions and closure; commit/PR.
- [ ] 5 Photos: optional metadata, camera/library multi-upload, optimized image bytes, durable recoverable upload queue, stable retry identity, protected gallery/viewer, customer sharing/activity. Test invalid files, interruptions/retry, isolation, zero-photo lifecycle; commit/PR.
- [ ] 6 Integration: responsive/a11y/error/loading polish, browser workflow acceptance, full existing regressions, actual desktop/mobile screenshots, remaining gaps; commit/PR.

## Review focus

Cross-project stale responses; sign-out with pending uploads; lost server acknowledgement followed by retry; concurrent completion/edit/closure; dates around timezone/month boundaries. New functionality must have meaningful tests for these conditions.

## Current status

Milestone 1 implemented in `bdceb97`. `pnpm typecheck`, `pnpm --filter @apex/os build`, and `node apps/apex-os/tests/shell.e2e.mjs` exit 0. Shell browser checks cover 1440×1000 and 390×844 navigation, keyboard focus, touch targets, auth failure/signout, and horizontal overflow. API reads were intercepted with synthetic fixtures; these checks do not establish backend persistence. Screenshots: [desktop](screenshots/foundation-desktop.png), [mobile](screenshots/foundation-mobile.png).

Milestone1 alone routed Checklist to the existing Today feed. Milestone2 replaces that temporary route with persisted task operations; photo, note and calendar quick-action forms remain subsequent work. Baseline full `bash scripts/ci.sh` passed on main `f442119` in 627.133s: 581 core, 585 Designer, 2 website unit, 166 website browser, 10 production-intake browser, 39 integration cases passed; 2 missing-engine guards skipped (not passes); two staff browser harnesses and five archive scripts passed. Disposable PostgreSQL/Moto, synthetic records only. Exact run metadata: [baseline](validation/baseline-ci.json). Foundation follow-up `dfb7077` fixes nested-route manifest/icon URLs and manifest MIME; focused API test, typecheck/build and browser smoke passed. Next: persisted checklist. PRs will be stacked with explicit dependencies; none merged or deployed without approval.

## Known inherited conditions

See `../audit/REMAINING_RISKS.md`: phase-advancement recovery, real IdP/R2/backup acceptance, external workflow integration, offline deck advisory. These are not erased by a new UI. Division stage definitions will be grounded in repository evidence rather than assumed from division names.


## Milestone 2 evidence

Backend `3739ec5`, frontend `c989222`: one persisted ordinary checklist for personal/project work, active assignment, due/priority edits, audited completion and atomic recurrence. Existing lead follow-ups remain links to their authority. Task writes never advance gates. PostgreSQL 10 passed/0 skipped; browser4 acceptance groups passed against real API/PostgreSQL, including lost acknowledgements and delayed lookup defaults. Narrow client/lead regression8 passed/1 optional-PG case skipped; full baseline had configured PostgreSQL. Typecheck/build and existing shell smoke pass. Review found and fixed personal-history reassignment exposure and unavailable-project fallback in `c4fc100`; scoped re-review clean (both findings addressed). No PR merge/deploy.

[Exact checklist commands/results/limits](validation/checklist.md). Actual running application with synthetic persisted test records: [desktop](screenshots/checklist-desktop.png), [mobile](screenshots/checklist-mobile.png). Completed tasks remain immutable; no reopen/delete. List pagination and inactive-user display names are documented limits. Next: canonical calendar appointments and views.
