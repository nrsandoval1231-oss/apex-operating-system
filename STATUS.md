# Apex — Status

**Last updated:** 2026-08-13

**Canonical workspace:** `C:\Users\NickSandoval\Nick OS\02_Projects\Apex`

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
- **Finish estimate** pins the exact approved takeoff revision and is idempotent for opportunity + design digest.
- Pricing uses `manual-approved-pricing-v1` and fails closed: missing estimates or unresolved direct scope become structured blockers; no amount is inferred.
- Proposal drafts are server-backed and optimistically versioned. Issued and signed versions are immutable.
- Recording acceptance of the exact issued Proposal idempotently creates one Job and one construction Project.
- Proposal preview supports print/save-as-PDF, copy-email, and `mailto:` preparation without claiming that an email was sent.
- Construction uses 11 phases and nine active Gate definitions. Active Gates use one authorized release signature; historical countersign records remain preserved.
- Closing a project requires authoritative reconciliation, is idempotent, has no reopen path, and moves the project to searchable read-only History.
- Closed jobs reject Gate, takeoff, assignment, schedule, inspection, draw, and customer-page mutations while retaining artifact reads.

### Repository state

- Root `main` is pushed to `origin/main`.
- Apex Designer `main` is pushed to its independent `origin/main`.
- The legacy proposal-engine repository remains clean and preserved as reference/calibration evidence; root packages are the production Proposal authority.
- Temporary implementation worktrees and branches were removed after integration.
- No production deployment or production data mutation was performed by this completion pass.

## Verification baseline

### Local

- Root typecheck passed.
- Apex OS production build passed.
- Root unit suite: **34 files, 514 tests passed**.
- Root integration suite without external services: **10 passed, 15 skipped**. The skips are the PostgreSQL/S3 cases that require service configuration.
- Designer: **580 tests passed**, typecheck passed, production build passed.
- Legacy proposal engine tests passed.
- `git diff --check` passed across all three repositories.
- Designer was launched with Vite and rendered in headless Chrome; the normal view showed the sports-pool control, Takeoff `.xlsx`, Finish Estimate, clean plan/section views, and no default verbose JSON dump.

### CI

GitHub Actions run `31735048854` passed on root `main`:

- `pnpm verify`;
- real PostgreSQL adapter tests;
- MinIO/S3 storage tests;
- production dependency audit at high severity;
- container image build;
- container startup against real dependencies;
- no-object-storage warning behavior; and
- refusal to ship an image with local authentication bypass enabled.

CI checks out Apex Designer and verifies its contract. The optional legacy Designer → proposal-engine chain remains skipped until `APEX_PROPOSAL_DEPLOY_KEY` is configured; the production root Proposal workflow is covered by root pricing, service, API, migration, and integration tests.

## Deployment status

The repository is ready for a controlled staging deployment. Deployment is not automatic and production has not been touched.

Required staging configuration:

- managed PostgreSQL (`DATABASE_URL`, with verified TLS);
- S3/R2-compatible private evidence storage;
- OIDC issuer, audience, and public SPA client;
- final HTTPS `APEX_PUBLIC_ORIGIN` before issuing customer links;
- optional customer contact phone/label; and
- real, approved price inputs for each estimate. There is intentionally no environment-backed inferred rate card.

Migrations run forward on application startup under a PostgreSQL advisory lock. Follow [`docs/runbooks/deployment.md`](docs/runbooks/deployment.md); never edit an applied migration.

## Remaining operational work

1. Configure and deploy a staging environment.
2. Execute the staging acceptance flow in [`NEXT.md`](NEXT.md).
3. Exercise and document a backup restore before the pilot carries real money.
4. Configure the optional proposal-engine deploy key only if the legacy cross-repository chain will remain supported; otherwise retire that check deliberately in a later cleanup.
5. Obtain the brochure/reference inputs before implementing the deferred equipment-catalog and excavator-specific dig-sheet work.

## Historical records

- [`docs/status.md`](docs/status.md) is the chronological engineering record. Sections dated before this update describe the system as it existed then and are intentionally preserved.
- [`docs/archive/`](docs/archive/README.md) contains immutable historical artifacts and old `designer-quantity-v4` fixtures; those files must not be rewritten to look current.
- Current active guidance is this file, [`README.md`](README.md), [`NEXT.md`](NEXT.md), and the deployment runbook.
