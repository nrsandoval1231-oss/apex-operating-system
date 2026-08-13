# Operational database

These forward-only PostgreSQL migrations establish the non-Website operational authority.

## Current scope

The numbered migration chain now covers:

- canonical Leads/opportunities, Jobs, takeoff revisions, Gates, requirements, evidence, draws, customer projections, and append-only events;
- durable Proposal containers and immutable Proposal versions;
- project phases, assignments, schedules, inspections, customer pages, daily briefs, and closeout reconciliation;
- the current 11-phase construction model and nine active Gate definitions;
- pre-contract takeoffs keyed to a Lead before Job creation;
- idempotent Finish Estimate runs and Proposal acceptance binding;
- retained closeout/archive metadata; and
- private local/S3-compatible evidence storage policies and adapters.

`packages/database/src/index.ts` is the runtime migration registry. Every new migration must be added there and covered by `migrations.test.ts`.

## Rules

1. Never edit or delete an applied migration.
2. Reverse behavior with a new forward migration.
3. Keep issued/signed Proposal versions, approved takeoff evidence, and durable events immutable at the database boundary as well as in services.
4. Preserve historical Gate definition versions; change active checklists by adding a new version.
5. Run managed PostgreSQL migrations under the advisory lock used by application startup.

## Verification

The database suite executes the complete migration chain against embedded PostgreSQL and checks schema construction, migration registration/idempotency, takeoff/proposal protections, event immutability, and storage policy definitions.

CI additionally executes the operational chain through the real `pg` adapter against PostgreSQL, exercises pooled transactions and calendar-date parsing, and runs S3-compatible evidence tests against MinIO.

Local integration tests skip the external adapter cases when `DATABASE_URL`/S3 variables are absent. That is not treated as proof; GitHub Actions supplies those dependencies and must be green before deployment.
