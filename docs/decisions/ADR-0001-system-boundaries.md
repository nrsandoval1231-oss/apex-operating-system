# ADR-0001: Apex System Boundaries and Authorities

- **Status:** Proposed for Phase 1; Phase 0 preservation is approved
- **Date:** 2026-07-28
- **Decision owner:** Nick Sandoval
- **Related plan:** `.hermes/plans/2026-07-28_160832-apex-unified-operating-system.md`

## Context

Apex currently consists of several high-value but disconnected components: website, n8n lead workflows, proposal engine, technical Designer, Gate field prototype, customer view, PRDs, and deck artifacts. They duplicate contracts and calculations and do not share a canonical operational store.

The goal is one system without forcing all users and workflows into one application.

## Proposed decision

### Operational authority

Apex will use one managed Postgres database as the canonical operational store for:

- leads and attribution
- opportunities and proposals
- Job IDs and job state
- takeoff/proposal revisions
- gate definitions, checks, evidence, and signatures
- crew assignments
- inspections and draw eligibility
- append-only operational events
- customer-safe progress projections

Supabase is the proposed default provider because it combines managed Postgres, authentication, row-level security, object storage, and realtime support. Provider selection is not final until Nick approves Phase 1.

### Calculation authority

The shared pool engine will own geometry and physical quantities. The pricing engine will consume versioned quantities and own cost codes, rates, allowances, and proposal totals. The two engines will not independently calculate the same physical facts after migration.

### External authority

- QuickBooks owns invoices, payments, expenses, and financial actuals.
- n8n owns asynchronous orchestration and external adapters, not business invariants or canonical storage.
- Monday is transitional. Its exact temporary authority must be explicitly selected before bi-directional synchronization is built.

### User surfaces

- Website: prospect acquisition
- Office: sales/proposals/job administration
- Designer: technical calculation and plan output
- Gate: internal field command center
- Customer: filtered customer-safe progress

These surfaces share contracts, identity, and events but remain purpose-built.

## Consequences

### Positive

- One Job ID and lifecycle across every surface
- Atomic idempotency and legal transition enforcement
- Versioned takeoffs, proposals, and gate definitions
- Auditable draw releases and customer updates
- No independent geometry implementations
- External tools can be replaced without changing Apex identity

### Costs and risks

- Requires migration from several independent repositories
- Requires authentication and authorization design
- Requires careful Monday/QuickBooks synchronization boundaries
- Requires fixing known calculation defects before integration
- Requires photo/data retention and customer-token security policies

## Alternatives rejected

### One giant frontend application

Rejected because website visitors, office users, technical estimators, field users, and customers need materially different interfaces.

### n8n as the primary backend

Rejected because business invariants, atomic idempotency, authorization, and versioned operational data require a transactional application/database boundary.

### Monday as permanent canonical database

Not selected as the default because Gate requires immutable evidence, signatures, versioned definitions, fine-grained security, and offline-safe commands. Monday may remain a transitional schedule/operations adapter.

### Two independent takeoff engines

Rejected because physical quantities would continue to diverge between customer pricing and technical plans.

## Open decisions

1. Approve Supabase or choose a different managed/self-hosted backend.
2. Define launch roles and access.
3. Decide whether Gate is internal-only for the pilot.
4. Select Monday's transitional mode.
5. Define the business event that mints a Job ID.
6. Define who may sign or override each gate.

## Validation

This ADR becomes accepted only after Nick approves the open Phase 1 decisions. The architecture is proven only when one lead-to-gate pilot passes the vertical-slice acceptance criteria without manual re-keying or duplicate records.
