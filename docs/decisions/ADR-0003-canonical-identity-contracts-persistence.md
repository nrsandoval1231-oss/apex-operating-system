# ADR-0003: Canonical Identity, Contracts, and Operational Persistence

- **Status:** Accepted
- **Date:** 2026-07-29
- **Scope:** Non-Website Apex operating system

## Decision

Apex uses namespaced ULIDs as canonical operational identifiers and Zod schemas as runtime acceptance contracts.

```text
lead_<ULID>
job_<ULID>
event_<ULID>
revision_<ULID>
gate_<ULID>
evidence_<ULID>
draw_<ULID>
customer_update_<ULID>
```

PostgreSQL owns durable operational state. The event table is append-only. Evidence metadata and storage are separate from requirement evaluations; uploading a photo cannot itself pass a Gate.

## Authority and access

- Roles are `admin`, `office`, `field`, and `customer`.
- Internal roles can access operational records according to row-level policies.
- Customers can access only explicit job membership and customer milestone projections.
- Customers cannot read raw Gate evidence, event payloads, margins, internal notes, or storage paths.
- Gate release requires a same-job approved takeoff revision.
- Only one takeoff revision may be approved for a job at a time.

## Event vocabulary

The version-one vocabulary includes lead receipt, proposal lifecycle, Job creation, takeoff revision lifecycle, Gate start/evidence/evaluation/block/release, overrides, draw eligibility, QuickBooks synchronization, customer publication, and Job closeout.

Every persisted event carries:

- event and schema version;
- canonical lineage;
- performer or system actor;
- occurrence and recording timestamps;
- correlation and optional causation IDs;
- idempotency key; and
- event-specific payload.

## Consequences

- n8n, Monday, QuickBooks adapters, and UI clients must map external IDs to canonical IDs rather than mint competing identities.
- Event corrections are compensating events, never row edits.
- Storage objects use `Job ID` as their first path segment.
- Managed deployment remains a separate step; migrations are first verified locally in embedded PostgreSQL.
