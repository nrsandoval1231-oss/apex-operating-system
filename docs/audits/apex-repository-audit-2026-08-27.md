# Apex GitHub Repository Audit

> **Historical snapshot, generated 2026-08-27.** This audit describes the
> GitHub repositories as they existed that day, before they were consolidated
> into this monorepo. Those former GitHub repositories were later deleted;
> their history lives in this repository's git history. Workflow paths named
> below were removed from this tree on 2026-10-02. It is not a work list.
> Current layout: `docs/repositories.md`. Provenance:
> `docs/REPOSITORY_CONSOLIDATION_2026-09-16.md`.

Generated: 2026-08-27T11:08:39-05:00

## Scope and method

- Enumerated all 27 repositories currently visible under `nrsandoval1231-oss` with authenticated `gh`.
- Shallow-cloned each repository default branch and scanned tracked working-tree files for case-insensitive `apex` references.
- Inspected repository metadata, default branches, package manifests, workflows, tests, and Git history at the current default-branch tip.
- No repository content, settings, branches, or external systems were changed.

## Executive conclusion

**Recommended canonical repository: `nrsandoval1231-oss/apex-operating-system`.** It is already structured as the integration root: `apps/apex-os`, `apps/gate-api`, shared `packages/*`, integration tests, database migrations, deployment/runbooks, and an existing consolidation archive/manifest.

The other six named Apex repositories should be preserved as source material and migrated into that monorepo through additive, verified moves. The unrelated repositories below should not be merged merely because the word `apex` appears in a file.

## Genuine Apex repositories

### `apex-operating-system`

- URL: https://github.com/nrsandoval1231-oss/apex-operating-system
- Visibility: PRIVATE; default branch: `main`; updated: 2026-08-17T01:57:08Z
- Apex-matching files on default branch: **212** of 262 scanned files
- Latest commit: `4bdb66e fix: package pinned Designer in production image`
- Workflows: .github/workflows/non-website-ci.yml
- Test files found: 39
- Package manifests/scripts: 9

**Role:** proposed canonical product/integration monorepo. Contains the live operating-system UI/API and shared domain, contracts, pricing, database, storage, and integration tests. Also contains dated archives of prior Apex artifacts, including bundles and a consolidation manifest.

### `apex-website`

- URL: https://github.com/nrsandoval1231-oss/apex-website
- Visibility: PRIVATE; default branch: `main`; updated: 2026-08-06T02:39:31Z
- Apex-matching files on default branch: **54** of 96 scanned files
- Latest commit: `acf4335 Ignore .claude/, alongside .hermes/`
- Workflows: .github/workflows/ci.yml
- Test files found: 5
- Package manifests/scripts: 1

**Role:** production-facing Astro marketing site and tagged lead-capture frontend. Strong candidate to move under `apps/website` (or `apps/apex-website`) while preserving its CI and deployment contract.

### `apex-designer`

- URL: https://github.com/nrsandoval1231-oss/apex-designer
- Visibility: PRIVATE; default branch: `main`; updated: 2026-08-17T01:44:41Z
- Apex-matching files on default branch: **38** of 115 scanned files
- Latest commit: `21a53a3 fix: version embedded Designer brand assets`
- Workflows: none
- Test files found: 25
- Package manifests/scripts: 1

**Role:** pool/spa technical takeoff engine, React/Vite UI, and Tauri desktop shell. Strong candidate to move under `apps/designer` with engine code extracted or retained as a package if the OS consumes it directly.

### `apex-lead-engine`

- URL: https://github.com/nrsandoval1231-oss/apex-lead-engine
- Visibility: PRIVATE; default branch: `main`; updated: 2026-07-28T21:28:39Z
- Apex-matching files on default branch: **20** of 23 scanned files
- Latest commit: `6436d3d setup/JobEvents.csv — import template for the job-status store`
- Workflows: none
- Test files found: 0
- Package manifests/scripts: 0

**Role:** lead intake/job-status workflow source plus contracts and fixtures. Strong candidate to move under `apps/lead-engine` or `workflows/lead-engine`; preserve fixture corpus and n8n webhook paths.

### `apex-prds`

- URL: https://github.com/nrsandoval1231-oss/apex-prds
- Visibility: PRIVATE; default branch: `main`; updated: 2026-08-06T01:22:13Z
- Apex-matching files on default branch: **10** of 11 scanned files
- Latest commit: `b2dd419 docs: record exactly what a second completed pool has to carry`
- Workflows: none
- Test files found: 0
- Package manifests/scripts: 0

**Role:** product requirements, decisions, and operational specs. Move under `docs/prd/` or `docs/requirements/`; reconcile duplicates with the canonical repo’s existing PRDs/decision records before deleting anything.

### `apex-proposal-engine`

- URL: https://github.com/nrsandoval1231-oss/apex-proposal-engine
- Visibility: PRIVATE; default branch: `main`; updated: 2026-08-13T19:48:50Z
- Apex-matching files on default branch: **9** of 22 scanned files
- Latest commit: `83bd145 docs: mark proposal engine as legacy reference`
- Workflows: none
- Test files found: 5
- Package manifests/scripts: 0

**Role:** legacy/reference quantity-to-price proposal engine and Whitaker evidence. Preserve under `packages/legacy-proposal-engine` or `archive/proposal-engine`; do not silently treat it as the canonical pricing implementation.

### `apex-decks`

- URL: https://github.com/nrsandoval1231-oss/apex-decks
- Visibility: PRIVATE; default branch: `main`; updated: 2026-07-28T22:41:53Z
- Apex-matching files on default branch: **6** of 7 scanned files
- Latest commit: `cb850d0 docs: label Whitaker results as calibration`
- Workflows: none
- Test files found: 0
- Package manifests/scripts: 0

**Role:** reproducible pitch/strategy deck generators. Move under `tools/decks` or `packages/decks`; preserve render prerequisites and generated-output provenance.

## Incidental matches — do not consolidate

- `Nucleus` — 1 matching files; examples: `docs/history/2026-08-27-nucleus-finish-line-prd-v1-source.md:735`: * Apex
- `gridlens` — 4 matching files; examples: `docs/N8N_AUDIT_2026-07-31.md:27`: TC Paper Bot, Trading Recap x2, Apex Lead Engine, Gap Bot (2 SSH auth errors — not BP scope).
- `power-gap-report-website` — 2 matching files; examples: `HANDOFF.md:82`: - **Live site:** https://thepowergapreport.com (apex primary; `www` 307-redirects
- `nick-cloud` — 1 matching files; examples: `docs/discovery-gate0.md:23`: - `02_Projects/Apex`
- `qb-readz` — 4 matching files; examples: `docs/vision.md:51`: rotation, corner leverage/eyes, apex/nickel alignment, LB depth, hash; `src/data/coverages/quarters.ts:5`: * Quarters (Cover 4), simplified match rule: safeties/apex corners play
- `nick-os` — 4 matching files; examples: `Mission Control/app/data/items.json:360`: "source_detail": "auto-sweep · folder \"Apex\" · latest \"Astro site Phases 1–2\" · 2026-07-26 · 1 session(s)",; `Work & Business/2G Energy Rental/invoices-reports/2G_Energy_Rental_Proposal_LifeCycle Power.docx:1803`: APEx۫g<
- `bitcoin-mining-calculator` — 1 matching files; examples:
- `bitcoin-tool` — 1 matching files; examples:
- `power-block` — 1 matching files; examples:

## Consolidation map

| Source | Destination in canonical repo | Treatment | Risk / verification |
|---|---|---|---|
| apex-website | `apps/website` | Move application and tests intact; preserve Astro config, env names, redirects, CI, and deployment settings | Verify build, Playwright tests, lead webhook URL, canonical/redirect behavior |
| apex-designer | `apps/designer` | Move UI/engine/Tauri source; decide whether Tauri remains separately packaged | Verify unit tests, `.apex.json` compatibility, XLSX export, Apex OS handoff contract |
| apex-lead-engine | `apps/lead-engine` or `workflows/lead-engine` | Move TypeScript workflow source, docs, fixtures, and setup data | Verify webhook paths, payload schema parity, dedupe/event behavior, n8n importability |
| apex-prds | `docs/prd` | Move docs; reconcile IDs and decisions against canonical docs | Verify no conflicting requirements or decision history is dropped |
| apex-proposal-engine | `archive/proposal-engine` initially | Preserve as calibration/reference until parity with canonical pricing engine is proven | Compare Whitaker outputs and pricing assumptions before any replacement |
| apex-decks | `tools/decks` | Move generators and rendering instructions | Verify Node/render toolchain and output reproducibility |
| apex-operating-system | repository root | Keep as canonical root; retain existing archives until migration verification completes | Run full monorepo tests/build and validate deployment/auth/persistence boundaries |

## Preservation and sequencing requirements

1. Create a migration branch and a machine-readable source manifest containing source commit, source path, destination path, and SHA-256 for every migrated file.
2. Preserve source repositories read-only/archived or with a deprecation README only after the canonical copy is verified. Do not delete repos in the migration pass.
3. Migrate in dependency order: PRDs/contracts → proposal/designer engines → lead engine → website → decks.
4. Preserve external identifiers and contracts: n8n webhook paths, environment-variable names, API routes, auth/session behavior, database migrations, storage keys, `.apex.json` files, and generated artifact naming.
5. Keep legacy proposal code and historical evidence separate from the production path until differential tests demonstrate parity.
6. Update links, CI path filters, deployment roots, documentation, and package scripts in one verified change set. Then run tests/builds from the canonical repository and verify live integrations before deprecating sources.

## Verification evidence collected

- `apex-designer`: `npm ci --ignore-scripts && npm test` — **25 test files passed; 582 tests passed**. Install reported 3 dependency vulnerabilities (2 moderate, 1 high).
- `apex-proposal-engine`: no `package.json` or lockfile exists, so npm package scripts are not available. Direct execution of `node engine.test.mjs` — **119 pass / 0 fail**.
- `apex-website`: `npm ci --ignore-scripts` completed; `env -u CLAUDECODE npm test` discovered **122 tests**, but all were blocked before test execution because the Playwright Chromium executable is not installed. The suite requires `npx playwright install`.
- `apex-operating-system`: verification is currently blocked on missing local `pnpm`; the repository requires `pnpm@11.18.0` and documents `pnpm run verify`.

## Important limitation

This audit scanned the current default branch of every repository and queried branch names, but did not fully clone and content-scan every historical/non-default branch. If Apex work exists only on an unmerged feature branch, it requires a second branch-by-branch sweep before final deletion or archival decisions.

## Artifacts

- Raw machine-readable report: `C:\Users\nrsan\apex-audit-report.json`
- Cloned audit sources: `C:\Users\nrsan\apex-audit-repos\`
- Audit script: `C:\Users\nrsan\apex_audit.py`
