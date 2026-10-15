# ADR-0004: Apex operational record authority

**Accepted:** 2026-10-15  
**Scope:** Apex operational records and workflow state

## Decision

PostgreSQL is the system of record for Leads, opportunity next actions, Proposal state, Job state, schedules, and tracked material requirements, orders, and receipts. Procurement records coordinate work; they do not issue external orders or establish accounting commitments. A Lead exists before a Job; its durable follow-up history is keyed by the canonical Lead ID. A Job is created only by the existing accepted Proposal lifecycle.

This decision explicitly supersedes decision-register items 24 and 25 and PRD 05's Monday and HubSpot working assumptions **for Apex operational records**. The historical register and PRD text remain unchanged as provenance. Monday or HubSpot may later serve bounded display or communications adapters using mapped external IDs, each subject to its own approval. Neither becomes an authority for Apex Lead, Proposal, or Job state by this decision.

## Boundaries retained

- QuickBooks remains the accounting authority.
- Designer remains the measured-quantity authority; the pricing engine remains the estimate authority.
- n8n remains the asynchronous integration boundary.
- Cloudflare remains the approved hosting environment.
- This decision authorizes no external account, customer communication, finance action, or production write.

## Rationale

The existing Apex service already creates and qualifies Leads before a signed Proposal creates one Job. Keeping the next action beside that Lead lets Today surface pre-contract work without manufacturing a Job or delegating canonical state to an unapproved adapter.
