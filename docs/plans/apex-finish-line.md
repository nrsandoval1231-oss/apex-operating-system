# Apex finish-line plan

**Canonical repository:** `nrsandoval1231-oss/apex-operating-system`
**Operating rule:** every milestone ends with a checked artifact, a repeatable command, and a rollback path.

Ported from `origin/dev` commit `bc504eb` (2026-08-28) and edited on 2026-10-02 so it matches current `main`. The original told the operator to add a GitHub Actions Pages workflow and GitHub environment secrets. Those steps do not fit: CI is `scripts/ci.sh`, and hosting is Cloudflare only. The Actions workflow from that commit was not ported.

## Finish line

Apex reaches pilot-ready status when a non-production user can complete the full lifecycle in staging, the public website is deployed on Cloudflare Pages, all lead traffic is isolated from production, a database and evidence restore has been proven, and a human approves the pilot.

## Milestones

### 1. Local verification — done on `main` as of 2026-10-02

- [x] `scripts/ci.sh` is the verification entry point. GitHub Actions workflows are not in the tree.
- [x] Designer staff calls use the same bearer token as Apex OS.
- [x] The first Finish on an existing draft keeps the entered prices.
- [ ] Staging itself is not deployed. Production has not been touched.

### 2. Staging acceptance — procedure is written, not executed

The commands are [`docs/runbooks/cloudflare-staging.md`](../runbooks/cloudflare-staging.md). Nothing has been deployed.

- [ ] Provision staging Postgres (Neon) and set `CONTAINER_DATABASE_URL` to the pooled string with `sslmode=require`.
- [ ] Provision private R2 evidence storage with versioning and retention.
- [ ] Configure staff identity. Customers stay on unguessable links.
- [ ] Deploy Apex OS and the website to `*.workers.dev` and `*.pages.dev` only. No custom domain until that decision is made.
- [ ] Confirm `/health`, `/ready`, `/app`, and customer-link behavior, and that every staging response is `noindex`.
- [ ] Execute [`docs/acceptance/staging-acceptance.md`](../acceptance/staging-acceptance.md) with synthetic data.
- [ ] Run idempotency retries and closed-job refusal checks.
- [ ] Complete a database restore and an evidence spot-check.
- [ ] Record evidence and a human approval before any pilot.

### 3. Production readiness

- [ ] Choose and verify the canonical Apex domain.
- [ ] Configure Cloudflare DNS, TLS, redirects, caching, and rollback.
- [ ] Replace stock website imagery with approved Apex photography.
- [ ] Confirm legal, consent, and analytics configuration.
- [ ] Resolve or formally accept the remaining moderate `uuid` advisory through `exceljs`. Do not force `exceljs@3.4.0` or `vitest@5` without a compatibility check.
- [ ] Approve production pricing inputs and external workflow destinations.

## Current blockers

- Cloudflare, Neon, and R2 credentials are not in this repository. They must be supplied at deploy time.
- Canonical domain decision remains open (`D-03`).
- The Supabase lead-intake migration on `origin/dev` (`0033_lead_intake.sql`, commit `ca735af`) was not ported. Staging Postgres is Neon, not Supabase.

## Rollback

- Do not merge or reset `origin/dev` as a unit. The website fixes that still fit are already on this branch; the Actions workflows and the Supabase migration stay on `dev`.
- A staging deploy must not touch production DNS or production data.
- Backend cutover, when it exists, uses a backup and restore drill before any production traffic.
