# Operational database

These PostgreSQL migrations establish the non-Website operational authority.

## Migration order

1. `0001_core.sql` — canonical records, approved takeoff revisions, Gate/evidence/evaluation separation, draw eligibility, projections, integration links, and append-only events.
2. `0002_rls.sql` — JWT-claim helpers and row-level authorization for admin, office, field, and customer roles.
3. `0003_evidence_storage.sql` — private `gate-evidence` Supabase Storage bucket and job-scoped object policies.
4. `0004_pre_gunite_definition.sql` — versioned pre-gunite definition and five evidence-bearing hold-point requirements.
5. `0005_gate_instance_uniqueness.sql` — one instance of a Gate definition version per Job.

## Verification

`migrations.test.ts` executes the migrations against embedded PostgreSQL through PGlite and proves:

- the schema builds;
- intake idempotency is unique;
- only one takeoff revision can be approved per job;
- evidence has no pass/fail columns;
- durable events reject update and delete; and
- evidence storage remains private and policy-protected.

No managed database has been provisioned and no credentials belong in this repository. Before deployment, run the same migrations against a disposable PostgreSQL/Supabase environment and then exercise RLS with real authenticated roles.
