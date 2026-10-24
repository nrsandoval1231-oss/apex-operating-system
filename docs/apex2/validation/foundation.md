# APEX 2.0 milestone 1 shell report

Commit: `bdceb97` (`feat(apex2): establish branded responsive workspace shell`).

Implemented charcoal/gold top desktop navigation and fixed five-destination mobile navigation (Today, Checklist, Calendar, Jobs, More), with separate centered quick-add button above mobile navigation. More exposes Designer, History, Brief. All legacy routes remain. Official logo unchanged at `public/brand/official-apex-logo.png`; unique filename prevents existing Designer build plugin from replacing it. SHA256 original/public/dist is `421e7a063b78adb7f47c69fce6d17e5c9f5186360060cf04e0c3fbdefb1688bb`. Existing official icons power a manifest; no service worker or offline API caching introduced.

Tokens centralize brand, surfaces, text, spacing, typography, radii, shadows, control height and interaction states. Existing views inherit readable expanded width, contrast and action colors through compatibility aliases. Logo artwork keeps authentic sage. Session identity/signout remain; protected views remount on token changes and remain hidden during initial identity loading/failure. 401/403 sign-in and network/server retry presentation covered. Accessible skip link, labeled navigation, Escape/blur/outside quick-panel dismissal, focus return on Escape, and >=44px mobile destinations.

Intent contract for later milestones: `?action=add-task|add-photos|add-note|schedule-event&project=<id>`. Task goes `/checklist`, schedule `/calendar`, photo/note `/projects/:id` when selected else `/projects`. Project extracted from `/projects/:id` or `?project=` and safely encoded. **These are intent links, not completed forms. Checklist deliberately renders existing TodayFeed until milestone 2; persisted Checklist functionality is incomplete.**

Validation:
- `pnpm typecheck` PASS (log `/tmp/apex2/shell-typecheck.log`).
- `pnpm --filter @apex/os build` PASS (log `/tmp/apex2/shell-build.log`); existing third-party PURE comment and large chunk warnings remain.
- `git diff --check` PASS.
- `node apps/apex-os/tests/shell.e2e.mjs` PASS against production Vite preview on localhost4195. **All API reads intercepted with synthetic identity and empty list fixtures; this is shell interaction testing, not backend/persistence acceptance.** Desktop1440/mobile390 checked navigation, More destinations, logo, selected-project intent preservation, Escape/focus, mobile target size, action button/nav separation, horizontal overflow, runtime errors, signout token removal and protected UI removal, 401 sign-in and 503 retry. Screenshots `/tmp/apex2/screenshots/shell-1440.png` and `shell-390.png`; results `shell-smoke.log` there. Browser script committed for reproducibility.

No backend/service/marketing edits. No merge/deploy/push. Preview remains on4195 (tool session39201), can be stopped or reused by root.

## Deep-link asset follow-up — dfb7077

Commit `dfb7077` (`fix(apex2): serve manifest assets from app base on deep links`) fixes the independent review's Important nested-route asset finding. Document head assets now use Vite `%BASE_URL%`; Gate API maps `.webmanifest` to `application/manifest+json; charset=utf-8`. Browser smoke checks resolved manifest/icon URLs on nested project routes, manifest JSON/start URL, correct MIME types and actual PNG signatures. Focused Gate API regression checks the built deep-link HTML and static assets through the real HTTP server.

Exact validation commands and outcomes:
- `pnpm --filter @apex/os build` — PASS, production Vite bundle built; existing third-party PURE annotation and chunk size warnings only. Log `/tmp/apex2/shell-assets-build.log`.
- `node apps/apex-os/tests/shell.e2e.mjs` — PASS, 2 viewport cases (1440px and390px) plus 3 authentication/error cases (sign-out,401,503); 5 reported cases total. Both viewport cases additionally assert nested-route manifest/icon URL, MIME and content correctness. Browser API reads remain synthetic intercepted fixtures; static asset requests use real preview responses. Results `/tmp/apex2/screenshots/shell-smoke.log`.
- `pnpm exec vitest run apps/gate-api/src/server.test.ts -t 'serves app-base manifest' --maxWorkers=1 --no-file-parallelism` — PASS: 1 test file passed; 1 focused test passed,39 unrelated tests skipped (40 total); duration3.15s. Actual Gate API HTTP static serving covered, including manifest MIME and icon PNG bytes.
- `pnpm typecheck` — PASS. Log `/tmp/apex2/shell-assets-typecheck.log`.
- `git diff --check` — PASS.

Fix commit contains only the four asset implementation/regression files. Root documentation/screenshots were left untouched. M1 PR32 is open and review clean as reported by root; no merge/deploy/push performed by this worker.

This is the historical milestone1 verification record. See [current implementation status](../IMPLEMENTATION.md) for later completed functionality and current validation. Temporary preview sessions are not deployment infrastructure.
