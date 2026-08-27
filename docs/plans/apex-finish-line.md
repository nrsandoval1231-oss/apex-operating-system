# Apex finish-line plan

**Canonical repository:** `nrsandoval1231-oss/apex-operating-system`
**Operating rule:** every milestone ends with a checked artifact, a repeatable command, and a rollback path.

## Finish line

Apex reaches pilot-ready status when a non-production user can complete the full lifecycle in staging, the public website is deployed on Cloudflare Pages, all lead traffic is isolated from production, a database/evidence restore has been proven, and a human approves the pilot.

## Milestones

### 1. Development environment — in progress

- [x] Create `dev` branch from verified `main`.
- [x] Add root GitHub Actions workflow for Cloudflare Pages.
- [ ] Create Cloudflare Pages project for the website.
- [ ] Configure GitHub `development` environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- [ ] Configure GitHub `development` variables: `CLOUDFLARE_PAGES_PROJECT`, `PUBLIC_SITE_URL`, `PUBLIC_LEAD_WEBHOOK_URL`, `PUBLIC_LEAD_TEST_WEBHOOK_URL`.
- [ ] Deploy the `dev` branch and verify the Cloudflare preview URL.
- [ ] Confirm dev submissions cannot reach production n8n, CRM, SMS, analytics, or conversion destinations.

### 2. Staging acceptance — queued behind environment configuration

- [ ] Provision staging PostgreSQL with TLS and isolated credentials.
- [ ] Provision private S3/R2-compatible evidence storage with versioning and retention.
- [ ] Configure OIDC issuer, audience, SPA client, and least-privilege staff identities.
- [ ] Deploy the canonical API/container to staging.
- [ ] Confirm `/health`, `/ready`, `/app`, and customer-link behavior.
- [ ] Execute `docs/acceptance/staging-acceptance.md` with synthetic/non-production data.
- [ ] Run idempotency retries and closed-job refusal checks.
- [ ] Complete database restore and evidence spot-check.
- [ ] Record evidence and human approval before pilot.

### 3. Production readiness

- [ ] Choose and verify the canonical Apex domain.
- [ ] Configure Cloudflare DNS, TLS, redirects, caching, and rollback.
- [ ] Replace stock website imagery with approved Apex photography.
- [ ] Confirm legal/consent/analytics configuration.
- [ ] Resolve or formally accept remaining dependency advisories.
- [ ] Approve production pricing inputs and external workflow destinations.

## Current blockers

- Cloudflare account/project credentials are not available to this workspace yet.
- Backend staging credentials and services are not configured.
- Canonical domain decision remains open (`D-03`).
- Website Playwright workflow must be promoted into the root GitHub workflow tree; nested workflows under `apps/website/.github/` are not executed by GitHub.
- The remaining moderate `uuid` advisory comes through `exceljs`; do not force a major override without compatibility testing.

## Rollback

- The `dev` branch is disposable and can be reset to `main`.
- Cloudflare deploys are branch-scoped; production is not touched by this workflow.
- Former Apex repositories remain preserved and unchanged.
- Backend deployments must use the existing backup/restore runbook before any production cutover.
