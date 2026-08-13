# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Primary users

Apex OS is the owner/office operating surface, designed first for Travis and also used by authorized office staff for opportunity, estimate, Proposal, and closeout work. Superintendent and field roles perform authorized construction actions through the same Job-centered Project workspace and Gate surfaces. Customers use token-authorized progress pages; they do not sign into Apex OS.

The field design condition remains a phone used one-handed, outdoors, in direct sun. Office estimate and Proposal views must also work at a desk without becoming a separate source of truth.

## Product purpose

Apex OS carries one project identity from pre-contract opportunity through Proposal, construction, closeout, and read-only History. It turns each pool build into verified transitions, surfaces decisions that need a person, and connects accepted scope to construction and billing readiness.

It answers:

1. What needs attention today?
2. Which jobs are at risk?
3. What work is ready to proceed?
4. What work is ready to bill?
5. Which opportunities need a complete estimate or Proposal decision?
6. Which completed projects must remain available as immutable history?

## Lifecycle

```text
Opportunity
→ Designer / approved takeoff
→ Finish estimate
→ versioned Proposal
→ accepted Proposal / Job created
→ construction Project
→ Gates, inspections, draws, customer updates
→ close and archive
→ read-only History
```

A Lead/opportunity is not a Job. Only authoritative acceptance of an issued Proposal creates the Job and construction Project.

## Positioning

The **Gate** remains the construction control: every Project has a current state, a next Gate, evidence required to pass it, and operational or financial consequences. A general CRM tracks tasks; Apex refuses controlled transitions without their prerequisites.

Apex OS is deliberately not the geometry engine, an accounting package, or an email-delivery service:

- Designer owns measured geometry and quantities.
- The root pricing engine prices approved facts but never invents a missing rate.
- QuickBooks remains financial authority.
- Copy-email and `mailto:` prepare communication but do not claim delivery.

## Operating context

- Eleven construction phases from design/permitting through automation, cover installation, plaster, and water fill.
- Nine active Gate definitions, including Automation Programming Complete and Install Cover.
- Active Gates use one authorized release signature. Historical countersign data remains preserved.
- Fixed contract draw schedule: 10 / 30 / 30 / 20 / 10.
- Six customer-facing milestones collapse internal construction detail.
- Evidence is hashed, private, retained, and readable after archive.
- Closed Jobs reject operational mutations and have no reopen path.

Authority: current migrations, `docs/decisions/single-signature-gates.md`, and `STATUS.md`. Older nine-phase/two-signature records are historical.

## Built capabilities

- Opportunity intake without fabricated Job state.
- Approved Designer takeoff ingestion and retained workbook/artifact reads.
- Idempotent Finish Estimate tied to opportunity and design digest.
- Fail-closed typed pricing with structured blockers.
- Durable optimistic Proposal drafts and immutable issued/signed versions.
- Proposal preview, print/save-as-PDF, copy email, and `mailto:` preparation.
- Idempotent acceptance recording that creates exactly one Job and Project.
- Today feed, Projects, Project workspace, Gates, inspections, scheduling, evidence, draw readiness, and customer-safe progress.
- Authoritative closeout checks, idempotent close, searchable History, and read-only archived detail.

## Constraints

- React 19 + Vite; no UI or CSS framework.
- All durable writes cross the authenticated Gate API/service boundary.
- Browser state is never business authority.
- Screens never fall back to sample data.
- Missing pricing, evidence, identity, or reconciliation produces a blocker/refusal—not a plausible default.
- Issued/signed Proposals and archived business evidence are immutable.

## Brand commitments

- **Charcoal** `#1b1c1e` — base.
- **Sage** `#a1ccca` — identity and primary action.
- **Amber** `#e0901b` — alerts and interaction feedback only.
- Pool identity: `#0e6e7c`.
- High contrast, direct-sun readability, and equipment-not-website character.

## Product principles

1. **Action before information.**
2. **Every card states its consequence.**
3. **Never invent a fact or price.**
4. **Opportunity before Job; acceptance before construction.**
5. **Gates before tasks.**
6. **One authoritative mutation path.**
7. **Closed means immutable but still readable.**
8. **One glance, one thumb where field action is expected.**

## Accessibility and inclusion

- Contrast exceeds WCAG AA where practical for outdoor use.
- Touch targets support working, gloved, or wet hands.
- Keyboard access and visible focus are required.
- Reduced motion is respected.
- Errors and blockers use plain language and identify the corrective action.
