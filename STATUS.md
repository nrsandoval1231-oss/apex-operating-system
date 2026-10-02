# Apex — Status

**Last updated:** 2026-10-02

The counts below are from `scripts/ci.sh` on 2026-10-02 (exit 0). That script is
the verification entry point. GitHub Actions is not the CI for this repository.

**Canonical workspace:** `nrsandoval1231-oss/apex-operating-system` (`main`)

## Current verified state

The unified non-Website lifecycle is implemented and pushed:

```text
Opportunity
→ Designer
→ Takeoff Excel workbook
→ Finish estimate
→ versioned Proposal
→ Proposal accepted / Job created
→ Construction
→ close and archive
→ read-only History
```

### Lifecycle

- Manual/referral intake creates a durable Lead/opportunity without fabricating a Job or signed Proposal.
- Designer supports a true 3′–5′–3′ sports-pool profile across geometry, plan/section views, quantities, excavation, and exports.
- Designer quantity model authority is `designer-quantity-v5`.
- **Takeoff (.xlsx)** produces an ordering-focused workbook with `Order List` first; metadata, excavation, and calculation/reference material are secondary.
- Soil/excavation assumptions and raw JSON diagnostics are under **Advanced**, not in the primary workflow.
- **Finish estimate** pins the exact approved takeoff revision and is idempotent for opportunity + design digest. A first Finish on a draft the Designer already created applies the submitted prices and issues the proposal when nothing is missing. An issued or signed version is left unchanged.
- Pricing uses `manual-approved-pricing-v1` and fails closed: missing estimates or unresolved direct scope become structured blockers; no amount is inferred.
- Proposal drafts are server-backed and optimistically versioned. Issued and signed versions are immutable.
- Recording acceptance of the exact issued Proposal idempotently creates one Job and one construction Project.
- Proposal preview supports print/save-as-PDF, copy-email, and `mailto:` preparation without claiming that an email was sent.
- Construction uses 11 phases and nine active Gate definitions. Active Gates use one authorized release signature; historical countersign records remain preserved.
- Closing a project requires authoritative reconciliation, is idempotent, has no reopen path, and moves the project to searchable read-only History.
- Closed jobs reject Gate, takeoff, assignment, schedule, inspection, draw, and customer-page mutations while retaining artifact reads.

### Repository state

- Designer, Website, Lead Engine, PRDs, legacy proposal calibration, and deck generators are in this repository. Layout: `docs/repositories.md`.
- The six former GitHub repositories were deleted. Their history lives in this repository's git history.
- Duplicate working copies under `archive/imported-repositories/` and the matching bundles, zips, and duplicate PRD copies under `docs/archive/` were removed. `archive/proposal-engine` stays because the legacy chain test and CI reference it.
- No production deployment or production data mutation was performed by the consolidation.

## Verification baseline

`scripts/ci.sh` on 2026-10-02, Node v22.22.2, pnpm 11.18.0, exit 0. Integration
used PostgreSQL 16.15 on `127.0.0.1:5432` and moto (S3 API) on port 9000, bucket
`apex-evidence`. The container image is still built from Node 24; this run did
not build that image.

- Install (`pnpm install --frozen-lockfile`, then `npm ci --ignore-scripts` in `apps/designer`) completed.
- Root typecheck passed. Designer typecheck passed.
- Apex OS production build passed. Designer production build passed.
- A website production build with `PUBLIC_ENV=production` and no `PUBLIC_LEAD_WEBHOOK_URL` failed on purpose. The following development website check and build, with `PUBLIC_LEAD_WEBHOOK_URL_TEST` set, completed. `astro check` reported 0 errors.
- Core unit suite (`packages`, `apps/gate-api`, `apps/apex-os`): **36 files, 518 tests passed**.
- Designer unit suite: **26 files, 585 tests passed**.
- Legacy proposal engine: `engine.test.mjs` 119 pass / 0 fail, `whitaker-evidence.test.mjs` 11 pass / 0 fail, `approved-takeoff.test.mjs` passed, `browser-graph.test.mjs` passed, `quantity-ownership.test.mjs` 1 pass / 0 fail.
- Website Playwright (Chromium desktop and mobile): **122 passed**.
- Integration suite with `DATABASE_URL` and S3 set: **4 files, 24 passed, 2 skipped**. The two skips are the guards that run only when `APEX_REQUIRE_DESIGNER_CONTRACT` or `APEX_REQUIRE_TAKEOFF_CHAIN` is set and the engine file is missing. With both engines present, the Postgres adapter (including a second run of the calendar-date case against the same database), the S3 adapter, the Designer contract, and the takeoff-to-proposal chain all passed.
- `pnpm audit --prod`: critical 0, high 0, moderate 1 (`uuid` via `exceljs`). Designer `npm audit`: critical 0, high 0, moderate 4 (`uuid`/`exceljs`, and `vitest`/`@vitest/mocker`). Forcing those would install `exceljs@3.4.0` or `vitest@5`, so they were left.

The 2026-08-13 GitHub Actions run `31735048854` is historical. It is not the current verification.

## Deployment status

Staging is specified and not deployed. Hosting is Cloudflare only, never Render, Vercel, or GitHub Actions. The procedure is [`docs/runbooks/cloudflare-staging.md`](docs/runbooks/cloudflare-staging.md): Apex OS as a Cloudflare Container on `*.workers.dev`, the website on Cloudflare Pages (`*.pages.dev`), Neon Postgres through Hyperdrive, and R2 evidence. [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md) is the old Render procedure. `render.yaml` and the GitHub Actions workflows have been removed. Production has not been touched.

Required staging configuration:

- managed PostgreSQL (`DATABASE_URL`, with verified TLS);
- S3/R2-compatible private evidence storage;
- OIDC issuer, audience, and public SPA client;
- final HTTPS `APEX_PUBLIC_ORIGIN` before issuing customer links;
- optional customer contact phone/label; and
- real, approved price inputs for each estimate. There is intentionally no environment-backed inferred rate card.

Migrations run forward on application startup under a PostgreSQL advisory lock. Never edit an applied migration. Do not follow the Render runbook to deploy.

## Remaining operational work

1. Stand up staging from [`docs/runbooks/cloudflare-staging.md`](docs/runbooks/cloudflare-staging.md) on Nick's machine. Do not deploy to Render. The runbook's placeholders are the values that still have to be supplied.
2. Execute the staging acceptance flow in [`NEXT.md`](NEXT.md).
3. Exercise and document a backup restore before the pilot carries real money.
4. Obtain the brochure/reference inputs before implementing the deferred equipment-catalog and excavator-specific dig-sheet work.

The legacy takeoff-to-proposal chain reads `archive/proposal-engine` in this repository. No proposal-engine deploy key is required.

## Historical records

- [`docs/status.md`](docs/status.md) is the chronological engineering record. Sections dated before this update describe the system as it existed then and are intentionally preserved.
- [`docs/archive/`](docs/archive/README.md) keeps historical artifacts that are not copies of the live trees, including the old `designer-quantity-v4` fixtures. Do not rewrite those fixtures to look current. Duplicate repo snapshots that used to sit beside them were removed; that history lives in git, and the old GitHub repositories were deleted.
- Current active guidance is this file, [`README.md`](README.md), [`NEXT.md`](NEXT.md), and [`docs/runbooks/cloudflare-staging.md`](docs/runbooks/cloudflare-staging.md). The Render runbook is historical.
