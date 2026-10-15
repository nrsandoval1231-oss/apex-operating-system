# Slice 0 — Verified baseline

**Mission anchor:** `ab74aa333c97399004ccbdba20a7b1df58d33ab4`
**Observed:** branch `codex/apex-business-completion-20261015`, HEAD matches anchor; `git fetch origin main` returned the same SHA. Working source started clean. No code edits were made by this audit. Build outputs/dependencies were generated locally by checks.
**UTC window:** 2026-10-15 13:08–13:27 (approx.; exact per-command duration only where reported).

## Evidence and result

`pnpm install --frozen-lockfile` passed using Corepack pnpm 11.18.0. The CI script as checked out could not start under Git Bash: exit 1, `set: pipefail\r: invalid option name`; `scripts/ci.ps1` delegates to that same CRLF file. Running `corepack enable` then failed with EPERM trying to write a shim under `C:\Program Files\nodejs`. Direct `corepack pnpm@11.18.0` avoided the system write. Therefore checks were run individually and the literal one-command CI result remains a script portability failure.

Passed: root `pnpm typecheck`; `@apex/os` production build; core Vitest suite (42 files, 552 tests; 304.64 seconds; exit 0); Designer `npm ci --ignore-scripts`, typecheck, build, and tests (26 files, 585 tests; exit 0); website `astro check` (0 errors, 0 warnings, two deprecation hints), static build (7 pages), website unit tests (2/2); legacy proposal scripts (119 engine cases, 11 evidence cases, and approved-takeoff/browser-graph/quantity-ownership checks all pass). Website local checks used `PUBLIC_ENV=development` and `PUBLIC_LEAD_WEBHOOK_URL_TEST=https://lead-webhook.example/webhook-test/apex-lead-intake`.

The core suite and its PostgreSQL-in-migration tests ran with disposable services supplied by controller: `127.0.0.1:55435/apex_business_test` and S3-compatible moto at `127.0.0.1:59035`, synthetic credentials only. No real records or production credentials were used.

Still open at handoff: website Playwright desktop/mobile and production intake tests; `node apps/apex-os/tests/estimate-navigation.e2e.mjs`; explicit integration suite (Postgres adapter, S3 adapter, Designer contract, takeoff-to-proposal). No session was left running when the core process exited. The baseline runner should finish these using the same disposable service values and the documented POSIX commands. These checks were not skipped or passed.

External runtime evidence is read from the 2026-10-15 deployment handoff: staging at `https://apex-os-staging.nicksandoval201121.workers.dev` runs the exact anchor image; `/health`, `/ready` (database/evidence true), `/robots.txt` pass; unauthenticated `/app` and `/api/opportunities` redirect (302). The staff-authenticated lifecycle remains NOT EXERCISED, and website authenticated content was not inspected. Production was not deployed.

## Capability matrix

| Capability | Implemented | UI usable | Persisted | Integrated | Tested | Missing |
|---|---|---|---|---|---|---|
| Sales / intake | Website and authenticated/manual lead intake; Opportunity identity | Website form, Projects/opportunities | PostgreSQL `leads`, append-only events | Website intake contract/test path; lead-engine workflows present; live authenticated path unverified | Core API/domain and website units pass | Today feed has no lead follow-up state/date/action; speed-to-lead operating SLA unproven |
| Design | Designer owns geometry and measured quantities; approved revision contract | Designer app and handoff | Versioned takeoff evidence in PostgreSQL | Designer to API contract | Designer tests pass; integration suite still open | Real operator lifecycle not browser-accepted this turn |
| Estimating | Fail-closed pricing; explicit manual approved prices | Finish Estimate flow | Estimate/proposal versions and hashes | Pricing consumes approved Designer revision | Core suite and legacy pricing checks pass | No automatic supplier quotes/cost actuals |
| Proposals | Draft, issue, immutable versions, explicit acceptance | Preview/PDF/email preparation; acceptance action | PostgreSQL proposal versions/events | Acceptance binds exactly one Job and Project | API/service tests pass | Follow-up/aging action absent from Today |
| Projects | 11 phases, assignment, risks, target dates, history | Projects and detail | PostgreSQL phases/transitions | Gate progress drives phase | Core tests pass | Owner daily view excludes pre-contract funnel |
| Scheduling | Subcontractors/crew visits, reschedules/conflicts | Calendar/project detail | Visits and append-only reschedule history | Conflict cards share live schedule records | Core tests pass | Procurement-linked material/delivery readiness |
| Inspections | Seven inspections, request/schedule/result/waiver | Project workflow | PostgreSQL inspection/result history | Inspection blockers inform Gate/Today | Core tests pass | None identified within source scope; staff production exercise open |
| Procurement | No first-class requirements/orders/receipts | No purchasing workflow | No material purchase/order schema | Designer takeoff is downloadable but does not create controlled purchase state | No procurement tests | Requirements→requests/orders→vendor ETA→receipt→project blocker is absent |
| Finance | Contract, draw schedule/eligibility, human invoice reference, nullable paid data | Draws and project totals | Job draws and events | No QuickBooks connector; authority is documented as QuickBooks | Core draw tests pass | Accounting actual sync/reconciliation; profitability/cost visibility; paid status is not proven by eligibility |
| Customer communication | Customer-safe milestones, photos, decisions, links | Customer page and staff controls | Customer links/access log/publications | Token-scoped read, staff-controlled updates | API/domain tests pass | No automated delivery confirmation; record says draft/prepared does not mean sent |
| Executive oversight | Construction action cards and daily frozen brief | Today + Owner Brief | Derived from persisted job/gate/inspection/draw/schedule state | Same card derivation powers feed/brief | 552 core tests pass | Today/brief contain construction jobs only; no lead/proposal queue |
| Administration / access | Roles, OIDC/Cloudflare Access config, environment guards | Sign-in and staff navigation | `app_users` | Staging Cloudflare Access | Auth tests pass; staging unauth boundary observed | Authorized signed-in pilot flow and backup/restore remain open |

## First material gap / next READY slice

No material break was observed in the tested post-acceptance lifecycle: lead → takeoff → priced/issued Proposal → idempotent acceptance → one Job/Project → construction gates/inspections/draws → closeout/read-only history. The highest-priority bounded owner-workflow gap is before contract: `GET /api/today` calls `getActionCards`; `readCardSnapshot()` starts from `jobs`, and pure `deriveCards()` accepts only `CardJobSnapshot[]`. It cannot raise actionable overdue Lead follow-ups or pending issued Proposals. This leaves the owner's stated morning questions about lead/proposal attention outside the central operating screen. Recommendation: BIZ-001, a strictly additive deterministic pre-contract Today slice, using fields and statuses actually persisted, with links to authoritative opportunity/proposal records and no inferred SLA. Procurement is the largest absent operational domain after that owner visibility slice; inspect schema/authority before proposing writes.

Finance caveat: QuickBooks remains authoritative but no connector/current accounting actual is present. `paid_cents` is nullable; `getDrawSchedule()` falls back from missing paid cents to full draw amount when status is `paid`. This appears potentially overconfident and should be reviewed before asserting collected actuals, even though Apex documents QuickBooks as authority and UI notes its invoices are human attestations.

## State and authority

No push, merge, deploy, spend, external messages, schema changes, or real data access occurred in this audit. Runtime readiness was sourced from the external deployment handoff, not reproved live here. Retain `UNKNOWN` for authenticated staging workflow, Playwright/estimate browser checks, explicit integration gate completion, backup/restore, procurement completeness, QuickBooks actuals, and end-to-end pilot acceptance.
