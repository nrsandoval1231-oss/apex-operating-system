# ADR-0002: Non-Website Build Profile

> **Superseded as a repository map (consolidation on `main`, 2026-09-16).**
> The website is in this repository at `apps/website`. The sentence below that
> excludes "the existing Website repository" from the workspace describes the
> 2026-07-29 split, not the current tree. Current layout: `docs/repositories.md`.
> The build profile (platform, roles, Gate, identity) is still the record of
> what was decided then.
>
> **Superseded as a hosting authorization (2026-10-02).** The Platform section
> names a Supabase-compatible Postgres shape for local work. It is not permission
> to deploy on Supabase, Render, or Vercel. Hosting is Cloudflare only. A
> Cloudflare deployment plan is still pending. Do not treat this ADR, or
> `docs/runbooks/deployment.md`, as authorization to deploy.

- **Status:** Accepted for implementation; website-exclusion clause superseded by consolidation
- **Date:** 2026-07-29
- **Decision owner:** Nick Sandoval
- **Supersedes:** Open Phase 1 implementation choices in ADR-0001 for this build

## Context

Nick directed Apex implementation to continue while the public Website is being developed in a separate workstream. The remaining system needs a fixed local implementation profile so contracts, persistence, Gate, and adapters can be built without re-opening architecture decisions on every task.

## Decision

### Scope

This build includes:

- shared contracts and domain invariants
- canonical operational database migrations
- Office commands and proposal/job administration foundations
- Apex Designer safety fixes and quantity authority
- Proposal validation and pricing integration
- Gate internal field application
- customer-safe milestone projection
- Lead Engine hardening and external adapters
- QuickBooks and Monday adapter boundaries and test fixtures

The existing Website repository is excluded. It will not be modified, moved, upgraded, or included in aggregate build commands. Apex will publish a versioned lead-intake contract for the separate Website workstream to consume later.

### Platform

- Use a TypeScript workspace with Zod contracts and Vitest.
- Use Supabase-compatible Postgres migrations, row-level security, authentication roles, and object-storage references.
- Local development and CI must not require production Supabase credentials.
- Production provisioning, account ownership, and secrets remain a deployment gate rather than a reason to block local implementation.

### Launch roles

The first controlled build supports:

- `admin` — full operational access; may approve documented overrides
- `office` — leads, opportunities, proposals, jobs, draws, and customer updates
- `field` — assigned jobs, gate evidence, readings, issues, and authorized signatures
- `customer` — scoped customer-safe projection only

Subcontractor-specific access is deferred until the internal pilot is proven.

### Gate

- Gate is internal-only for the first pilot.
- A field user may sign a gate only when every required requirement passes and the definition authorizes that role.
- Only an admin may approve an override, and the override must record a reason and superseding event.
- Signed gate snapshots are immutable; corrections create superseding events.
- Chemistry guidance is excluded until expert-approved sources, bounds, concentrations, sequencing, and refusal behavior exist.

### Identity and lifecycle

- A Job ID is minted once when a proposal is marked won because a contract is signed.
- Deposit receipt is a separate scheduling/release condition.
- External identifiers never replace Apex IDs.
- Every command carries an idempotency key and every accepted operational change emits a durable event.

### External systems

- QuickBooks remains the financial authority. Apex may create/read linked drafts and projections but will not become a ledger.
- Monday is a transitional display/adapter. Apex owns job and gate state; free bi-directional status editing is prohibited.
- n8n orchestrates notifications and synchronization but does not own business invariants or canonical records.

## Consequences

- Implementation can proceed locally without production accounts.
- The Website can evolve independently as long as it adopts the published intake contract before integration.
- Gate v1 remains intentionally narrow: one real job, one pre-gunite gate, evidence, signature, draw eligibility, and customer milestone.
- Full scheduling, chemistry, commissions, review requests, and broad accounting automation remain outside the first controlled proof.

## Verification

This decision is proven when the non-Website workspace passes its unit, contract, database, security, integration, and Gate end-to-end checks without requiring the Website repository or production credentials.
