# Shared contracts

`@apex/contracts` defines the runtime-validated language shared by the non-Website Apex system.

It owns:

- namespaced canonical IDs for Lead/opportunity, Job, Proposal, Proposal version, event, revision, Gate, evidence, draw, and customer updates;
- application roles and event actors;
- versioned operational event envelopes;
- Designer submission and approved-takeoff schemas, quantity digests, and audit hashes;
- pricing inputs/blockers and durable Proposal-version contracts;
- Job summaries, project/phase state, Gate definitions, requirements, inspections, schedules, and closeout records;
- evidence metadata, deliberately separate from pass/fail state; and
- strict customer-safe projections.

All external and persistence boundary inputs must be parsed through these Zod schemas. TypeScript types alone are not an acceptance boundary.

## Lifecycle rule

A Lead/opportunity may own takeoff and Proposal versions before construction. A Job ID is absent until an authorized acceptance records an issued Proposal as signed. Consumers must not synthesize a Job to satisfy an older interface.

## Versioning rule

Quantity-model, pricing-library, takeoff-revision, and Proposal-version identifiers are audit facts. Never rewrite an older record to a newer version string; create a new revision/version and preserve the historical payload.
