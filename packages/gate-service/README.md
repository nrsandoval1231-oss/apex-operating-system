# Persistent Gate service

`@apex/gate-service` is the authoritative application-service layer between pure contracts/domain rules and PostgreSQL persistence.

It provides:

- idempotent commands and append-only operational events;
- opportunity intake without pre-creating a construction Job;
- approved takeoff persistence and digest verification;
- idempotent Finish Estimate and fail-closed pricing blockers;
- optimistic Proposal drafts and immutable issued/signed Proposal versions;
- one-time Proposal acceptance binding to exactly one Job and Project;
- Gate reconstruction, evidence/evaluation separation, and atomic release projections;
- inspections, schedules, assignments, draws, customer-safe progress, and retained artifacts;
- reconciliation-backed idempotent closeout; and
- read-only archived records with authoritative rejection of closed-Job mutations.

The service accepts only a migrated database. HTTP authentication, request parsing, binary evidence handling, CORS/CSP, and user-facing behavior live in `apps/gate-api` and `apps/apex-os`.

## Safety invariants

- Missing commercial inputs are blockers; the service never invents prices.
- An issued/signed Proposal cannot be edited or rebound to a different Job.
- Repeated issue, sign, Finish Estimate, and close commands do not create duplicate business records/events.
- A Job is created only when authorized acceptance of an issued Proposal is recorded.
- A closed Job remains readable but cannot return to active mutation paths.
