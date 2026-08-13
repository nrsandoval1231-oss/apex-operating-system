# Apex OS v1 — Product Requirements Document

**Product:** Apex OS — Designer Pools Construction Operations  
**Powered by:** GATE v3  
**Company:** Apex, Lubbock, Texas  
**Version:** 1.0  
**Status:** Build-ready draft. Phases, gate templates, draw schedule, and gate authority confirmed 2026-07-31 — see [`docs/decisions/construction-model.md`](docs/decisions/construction-model.md).  
**Initial customer:** Apex Designer Pools only

> **Implementation note (2026-08-13):** This v1 PRD preserves the requirements and decisions that drove the build. Current implemented authority is root [`STATUS.md`](STATUS.md), [`NEXT.md`](NEXT.md), and the migration/contract code. The active system now uses 11 construction phases, nine active Gate definitions, one authorized release signature, pre-contract opportunities, versioned Proposals, Proposal-acceptance Job creation, and read-only archived History. Older nine-phase/seven-Gate/two-signature statements below are historical design context.

---

## 1. Executive Summary

Apex OS is a mobile-first construction operating system built specifically for Apex Designer Pools. It begins when a pool opportunity becomes sufficiently qualified and continues through proposal, signed contract, construction, billing milestones, startup, handover, and conversion into recurring pool service.

The product is not a general CRM, accounting package, or full construction-management suite. Monday.com and QuickBooks may remain systems of record where appropriate. Apex OS is the action and control layer that turns project data into a short, reliable list of decisions and next actions.

Its core operating model is the **gate**:

> Every project has a current state, a next gate, evidence required to pass it, and operational or financial consequences attached to that gate.

Apex OS should answer four questions every morning:

1. What needs attention today?
2. Which jobs are at risk?
3. What work is ready to proceed?
4. What work is ready to bill?

The first release will be designed around Apex’s real workflow and active pool projects. Multi-company configuration and generalized Pool GATE features will be extracted only after the Apex implementation proves useful.

---

## 2. Product Vision

### 2.1 Vision statement

Build a calm, focused operating system that helps Apex complete pools correctly, communicate clearly, avoid preventable delays, document every critical milestone, and collect revenue as soon as work becomes billable.

### 2.2 Product promise

Apex OS tells the right person what must happen next, why it matters, and what evidence is required—without forcing the entire company into a bulky new software workflow.

### 2.3 Relationship to the Apex website

The existing Apex website is the acquisition layer. It routes prospects into one of four verticals and submits a structured lead object to an n8n webhook.

For Apex OS v1:

- **Designer Pools** leads may enter the Apex OS sales pipeline.
- **Concrete Coating**, **Design & Renovation**, and **Pool Service** remain routed through the website and n8n but are outside the operational scope of this release.
- The website-generated `lead_id` must persist through qualification, proposal, project creation, and eventual won-job reporting.

End-to-end lifecycle:

```text
Website inquiry
  → n8n lead intake and immediate response
  → Designer Pools qualification
  → consultation/site visit
  → proposal
  → signed contract and deposit
  → Apex OS construction project
  → construction gates and draws
  → startup and handover
  → Pool Service conversion
```

---

## 3. Problem Statement

Pool construction is coordinated across customers, office staff, field personnel, subcontractors, inspectors, suppliers, and accounting. Critical facts are commonly spread across text messages, calls, spreadsheets, calendars, photos, accounting records, and individual memory.

This creates recurring risks:

- Work proceeds before prerequisites are verified.
- Inspections are requested too late.
- Subcontractors are double-booked.
- Customer selections block work without becoming visible.
- Important field evidence is not captured consistently.
- Customers ask for updates because they cannot see progress.
- Draws are invoiced later than the milestone allows.
- Potential change orders remain buried in conversation.
- The owner spends time reconstructing project status instead of making decisions.
- Operational knowledge remains tribal instead of becoming a repeatable standard.

Apex OS will reduce these risks by connecting project state, gates, evidence, schedule dependencies, customer communication, and billing readiness in one action-oriented experience.

---

## 4. Goals and Non-Goals

### 4.1 Goals

1. Give the owner and project team a reliable daily action list.
2. Prevent critical construction phases from advancing without verified prerequisites.
3. Surface schedule, inspection, selection, and material risks early.
4. Connect completed construction milestones to draw readiness.
5. Create a timestamped evidence trail for quality, warranty, and dispute protection.
6. Provide customers with simple, proactive project visibility.
7. Preserve the website lead identity through the full customer lifecycle.
8. Prove the GATE operating model on three to five active Apex pool projects.
9. Fit around current work habits rather than requiring every participant to adopt a new app.

### 4.2 Non-goals for v1

- Replacing QuickBooks
- Building a complete general ledger or accounting system
- Replacing every Monday.com workflow immediately
- Supporting multiple pool builders or tenants
- Supporting all four Apex verticals operationally
- Building a generalized no-code workflow designer
- Fully autonomous customer communication
- Fully autonomous invoicing or change-order issuance
- Comprehensive resource optimization
- Payroll or full commission administration
- A general-purpose AI chatbot as the primary interface
- Historical migration of every prior Apex project

---

## 5. Users and Roles

### 5.1 Owner / General Manager

Needs a concise view of decisions, risks, billable milestones, customer issues, and overall project health.

**Primary actions:** approve gates, resolve conflicts, approve customer communication, authorize change orders, review billing readiness, override project decisions.

### 5.2 Project Manager / Superintendent

Needs to coordinate active jobs, record field progress, complete checklists, attach evidence, schedule subcontractors, and identify blockers.

**Primary actions:** update project state, complete gate requirements, upload photos, request inspections, log notes, propose schedule changes.

### 5.3 Office / Sales Coordinator

Needs to respond to leads, schedule consultations, track proposals, collect customer decisions, and coordinate documents and billing handoffs.

**Primary actions:** qualify leads, update opportunity stage, schedule appointments, record approvals, prepare invoices, send approved updates.

### 5.4 Field Team Member

Needs the smallest possible mobile workflow for today’s assigned project.

**Primary actions:** see assigned task, complete checklist items, capture photos, record readings, flag a problem.

### 5.5 Customer

Needs a simple, reassuring view of current progress, recent photos, upcoming work, and decisions required from them.

**Primary actions:** view status, submit a selection or approval, contact Apex, sign a change order when enabled.

### 5.6 Administrator

Needs to maintain users, project templates, gate definitions, notification rules, and integrations.

---

## 6. Product Principles

### 6.1 Action before information

The homepage shows actions and exceptions, not a wall of metrics.

### 6.2 Gates before generic tasks

A gate represents a controlled transition with evidence and consequences. It is more important than an isolated checkbox.

### 6.3 Read widely, write carefully

Apex OS may ingest data from multiple sources, but external messages, invoices, schedule changes, and project transitions remain approval-gated in v1.

### 6.4 Additive, not disruptive

Subcontractors and customers should not need a new account for ordinary participation. Links, text messages, and simple mobile forms should be preferred.

### 6.5 Exceptions over micromanagement

The system should not require the owner to rebuild the schedule every day. It should surface the conflict, missing prerequisite, or stalled decision that needs intervention.

### 6.6 Internal detail, external simplicity

Apex may track many technical phases internally while customers see a small number of understandable milestones.

### 6.7 One builder first

The product should encode Apex’s current process directly. Generalization is a later extraction exercise, not a v1 requirement.

---

## 7. Scope

### 7.1 In scope

- Designer Pools lead handoff from the existing website/n8n flow
- Lightweight sales pipeline from qualified lead to signed contract
- Active pool project record
- Construction phase and gate engine
- Evidence capture and project photo timeline
- Inspection tracking
- Customer-selection blockers
- Subcontractor visit schedule and conflict detection
- Draw schedule and billing-readiness cards
- Startup and water-chemistry logging
- Customer progress page
- Daily owner brief
- AI-assisted summaries and drafts
- Basic project search and audit history
- Notifications by in-app feed and selected SMS/email channels

### 7.2 Deferred scope

- Concrete Coating operations
- Design & Renovation operations
- Standalone Pool Service operations beyond handover conversion
- Advanced marketing attribution dashboards
- Full estimating takeoff engine
- Full job-cost accounting
- Automated commission engine
- Vendor purchasing portal
- Inventory management
- Warranty service management beyond basic intake

---

## 8. Core Lifecycle

### 8.1 Lead and sales stages

1. New lead
2. Contact attempted
3. Qualified
4. Consultation scheduled
5. Design / scope development
6. Proposal sent
7. Decision pending
8. Won — contract and deposit pending
9. Won — ready for project creation
10. Lost / nurture

### 8.2 Construction phases

**Confirmed 2026-07-31.** Apex’s actual construction sequence is nine phases. See [`docs/decisions/construction-model.md`](docs/decisions/construction-model.md).

1. Design, Engineering & Permitting
2. Layout & Excavation
3. Steel Reinforcement (Rebar)
4. Plumbing & Electrical Rough-In
5. Gunite/Shotcrete Concrete Pour
6. Waterline Tile & Coping Installation
7. Patio Decking & Hardscaping
8. Pool Pad Equipment Hookup
9. Interior Plaster Finish & Water Fill

This replaces the fifteen-phase proposed baseline carried in earlier drafts of this document, which was never confirmed and must not be built.

### 8.3 Customer-facing milestones

The customer view collapses internal detail into:

1. Design
2. Excavation
3. Shell
4. Finishes
5. Water
6. Handover

---

## 9. Functional Requirements

## 9.1 Website and lead handoff

### Requirements

- Accept Designer Pools lead payloads from the existing n8n workflow.
- Preserve the original website `lead_id` as the immutable lifecycle identifier.
- Store vertical, contact information, consent data, attribution, landing page, submitted page, and campaign metadata.
- Prevent duplicate lead creation when the same `lead_id` is retried.
- Allow n8n to create or update a lead through an authenticated endpoint.
- Return a stable Apex OS record identifier to n8n.
- Log the source and timestamp of every handoff.

### Acceptance criteria

- A website Designer Pools submission appears in Apex OS with the same `lead_id`.
- Repeated delivery of the same payload does not create duplicate records.
- Non-pool verticals are acknowledged but are not added to the Apex OS construction pipeline in v1.

## 9.2 Sales workspace

### Requirements

- Display Designer Pools opportunities by stage.
- Show last contact, next action, assigned owner, source, and expected project value.
- Create action cards for overdue first response, unscheduled consultation, stale proposal, and missing contract/deposit.
- Attach notes, files, and communication summaries to the opportunity.
- Convert a won opportunity into a project without re-entering customer data.
- Preserve proposal and contract references on the project.

### v1 constraint

This is a lightweight operational pipeline, not a full CRM replacement.

## 9.3 Project record

Every active project must include:

- Project ID
- Original lead ID
- Customer and property details
- Contract amount
- Current internal phase
- Current customer milestone
- Project owner / superintendent
- Project status
- Target completion window
- Current gate and next gate
- Subcontractors and key suppliers
- Inspection requirements
- Customer selections
- Draw schedule
- Photos, documents, notes, and activity timeline
- Known risks and blockers

## 9.4 Gate engine

### Gate definition

A gate is a required checkpoint that controls whether the project may move into a later phase or trigger a related action.

Each gate includes:

- Gate name and project phase
- Required checklist items
- Required evidence types
- Required responsible role
- Optional approver
- Blocking and non-blocking items
- Status: not started, in progress, ready for review, passed, failed, overridden
- Signoff identity and timestamp
- Override reason and author
- Downstream consequences

### Initial gate templates

**Confirmed 2026-07-31.** Seven gates, four of them draw-bearing. See [`docs/decisions/construction-model.md`](docs/decisions/construction-model.md).

| Gate | Position | Releases | Authority |
|---|---|---|---|
| Permit | End of P1 | — | Superintendent |
| Excavation | End of P2 | Draw 1 (30%) | Owner |
| Pre-gunite | Before P5 | — | Superintendent |
| Shell | End of P5 | Draw 2 (30%) | Owner |
| Deck & tile | End of P7 | Draw 3 (20%) | Owner |
| Equipment | End of P8 | — | Superintendent |
| Final | End of P9 | Final Draw (10%) | Owner |

The Deposit (10%) is released by contract signing and is not gate-triggered.

Two authority questions remain open and are recorded in §5 of the decisions document: whether the irreversible pre-gunite gate should also require owner confirmation, and whether money gates delegate when the owner is unavailable.

### Pre-gunite gate baseline

- Layout and dimensions reverified
- Depths and spa dimensions match plan
- Steel size, spacing, cover, laps, and chairs verified
- Lowered sections and structural details verified
- Plumbing pressure test recorded
- Electrical niches and bonding verified
- Equipment vault / pad alignment verified
- Hydrostatic relief installed where required
- Substrate condition acceptable
- Nozzleman / crew qualification confirmed
- Mix design / strength confirmed
- Required photos attached

### Gate behavior

- A blocking gate cannot be passed until all required items are complete.
- An authorized owner may override a gate only by entering a reason.
- Passing a gate updates project phase and may release a draw, draft a customer update, or enable a scheduled crew visit.
- Every state change is written to the audit timeline.

## 9.5 Owner action feed

The default home screen must display:

### Things Need You

Actions requiring judgment or approval, ordered by urgency and economic/operational impact.

Examples:

- Sign a pre-gunite hold
- Request an inspection today
- Resolve a crew conflict
- Approve a customer update
- Review a possible change order
- Mark a released draw invoiced

### Running

Active work that is progressing but requires a routine check or log.

Examples:

- Shell curing and watering due
- Startup chemistry reading due
- Deck pour ready
- Customer selection due this week

### This Week

- Scheduled subcontractor visits
- Known conflicts
- Gates expected to pass
- Inspections due
- Draws expected to unlock

### Feed rules

- Every card explains what to do and why it matters.
- Cards link directly to the smallest workflow needed to complete the action.
- Completed cards disappear from the urgent feed but remain in history.
- The owner can snooze, delegate, or mark certain low-risk items acknowledged.

## 9.6 Scheduling and dependency exceptions

### Requirements

- Store planned subcontractor visits by project, trade, date, and phase.
- Detect the same crew or constrained resource booked on overlapping dates.
- Warn when work is scheduled before its prerequisite gate passes.
- Warn when an inspection, customer selection, material confirmation, or curing period blocks scheduled work.
- Allow an authorized user to move a visit while preserving trade constraints.
- Notify affected internal users after a schedule change.
- External subcontractor notifications require approval in v1.

### Non-goal

The system will not optimize the full schedule automatically in v1.

## 9.7 Inspection management

### Requirements

- Define required inspections by project phase.
- Store jurisdiction, contact instructions, lead time, prerequisites, requested date, inspection window, status, result, and evidence.
- Create an urgent card before the last safe request time.
- Block dependent work when a required inspection has not passed.
- Record failed inspection details and required corrections.

## 9.8 Draw and billing readiness

### Requirements

- Store contract value and draw schedule for each project.
- Link each draw to a release condition or passed gate.
- Show amount, release date, invoice status, sent date, due date, and paid status.
- Create a “ready to bill” card immediately when the release condition is satisfied.
- Require a human to mark or confirm invoice creation in v1.
- Preserve links to the accounting-system invoice when available.
- Show collected-to-date and remaining contract amount.

### Constraint

Apex OS does not calculate the company ledger or replace QuickBooks.

## 9.9 Photos and field evidence

### Requirements

- Capture photos from a mobile device.
- Automatically attach project, gate, phase, user, and timestamp metadata.
- Allow a short note or evidence category.
- Support required-photo slots within gates.
- Display photos in the project timeline and customer-safe gallery when approved.
- Preserve originals and prevent silent replacement.
- Allow customer visibility to be toggled per photo.

## 9.10 Customer selections and decisions

### Requirements

- Record each required selection, due date, responsible customer, options, status, and related phase.
- Surface selections that threaten scheduled work.
- Send a simple no-login selection link after staff approval.
- Record the customer’s choice and timestamp.
- Require internal confirmation before the selection is treated as construction-ready where needed.

## 9.11 Customer progress page

### Requirements

- One persistent, secure, no-login link per customer project.
- Display six simplified milestones.
- Show current status in plain language.
- Show recent approved photos.
- Explain what is happening now and what happens next.
- Display decisions required from the customer.
- Provide a direct call/text contact route.
- Hide costs, subcontractor names, internal checklists, risk scores, and internal notes.
- Maintain an access log and allow link rotation/revocation.

## 9.12 Startup and water chemistry

### Requirements

- Record pH, total alkalinity, calcium hardness, cyanuric acid, temperature, TDS, pool volume, and timestamp.
- Calculate LSI using a documented formula and inputs.
- Classify water as aggressive, balanced, or scaling according to configured thresholds.
- Produce ordered corrective guidance.
- Require the user to confirm actions rather than automatically treating recommendations as completed.
- Maintain startup-day count and reading history.
- Surface overdue readings in the action feed.

### Safety requirement

Chemical guidance must display assumptions, units, and warnings. Apex remains responsible for validating dosing procedures and training.

## 9.13 Change-order assistant

### v1.1 / pilot feature

- Ingest selected project communications or manually submitted notes.
- Detect language that may indicate a scope change.
- Draft a proposed change-order summary.
- Associate affected scope, cost codes, schedule impact, and supporting messages/photos.
- Send the draft to an authorized user for approve, edit, or reject.
- Never send a change order to the customer without explicit approval.
- Log approval and customer-signature status.

## 9.14 Daily owner brief

### Requirements

Generate one concise morning brief containing:

- Actions due today
- Jobs at risk
- Gates ready for review
- Inspections requiring action
- Schedule conflicts
- Draws ready to invoice
- Customer decisions overdue
- Startup or curing checks due
- Significant changes since the prior brief

The brief should link each item directly to its action card.

## 9.15 Search and project memory

- Search by customer, address, project, phase, subcontractor, gate, note, or document title.
- Show a chronological project timeline.
- Summarize the current project state from structured records and approved activity.
- Clearly distinguish source facts from AI-generated summaries.

---

## 10. AI Requirements

### 10.1 Approved AI uses

- Summarize project activity
- Draft customer updates
- Draft internal status reports
- Detect possible schedule or communication risks
- Detect possible change-order language
- Classify photos and notes
- Extract structured facts from uploaded documents
- Suggest next actions
- Explain why an item is urgent

### 10.2 Human approval required

- Passing or overriding gates
- Sending customer-facing messages
- Sending change orders
- Moving committed subcontractor schedules
- Marking invoices issued
- Changing contract values
- Publishing customer-visible photos
- Applying chemical treatment instructions as completed

### 10.3 AI trust requirements

- Show the source records used for consequential recommendations.
- Display confidence or uncertainty when appropriate.
- Never invent a completed field event or customer approval.
- Keep an audit record of generated drafts and final human-approved output.

---

## 11. Integrations

### 11.1 Required for pilot

- Existing Apex website lead webhook through n8n
- Email and/or SMS notification provider
- File/photo storage
- Authentication and role management

### 11.2 Preferred during v1

- Monday.com read/write synchronization for selected records
- QuickBooks invoice-link or status synchronization
- E-signature provider for approved change orders
- Calendar synchronization for inspections and crew visits

### 11.3 Integration principle

Apex OS should own gates, project state, action cards, and evidence relationships. External systems may remain authoritative for accounting, broad CRM history, or calendaring until a later migration decision.

---

## 12. Data Model

### Core entities

- Organization
- User
- Role
- Lead
- Opportunity
- Customer
- Property
- Project
- Project phase
- Gate template
- Project gate
- Gate checklist item
- Evidence item
- Photo
- Document
- Subcontractor
- Crew / resource
- Scheduled visit
- Inspection
- Customer selection
- Draw
- Invoice reference
- Chemistry reading
- Communication record
- Change-order draft
- Customer update
- Action card
- Notification
- Audit event

### Key identity rule

`lead_id` from the website must remain immutable and traceable through opportunity, project, revenue, and service conversion records.

---

## 13. Permissions

### Owner

Full access, including overrides, approvals, financial milestones, and configuration.

### Project manager

Project updates, gate completion, schedule proposals, inspection actions, evidence, and customer-update drafts.

### Office / sales

Lead and opportunity management, appointments, customer decisions, documents, billing-status updates, and approved communications.

### Field user

Assigned projects only; checklist completion, photos, readings, notes, and issue flags.

### Customer

Customer-safe project page and requested selections only.

### Audit requirement

All gate transitions, overrides, customer communications, financial-status changes, and permissions changes must record actor, timestamp, prior value, and new value.

---

## 14. UX Requirements

### 14.1 Primary form factor

Mobile-first web application, optimized for one-handed field use and owner review from a phone.

### 14.2 Navigation

Primary navigation should remain minimal:

- Today
- Projects
- Week
- Leads
- Search

Administrative settings may remain behind a secondary menu.

### 14.3 Card design

Each action card must include:

- Project/customer name
- Location or identifying context
- Required action
- Reason and consequence
- Due time or urgency
- Primary action button
- Optional photo/evidence shortcut

### 14.4 Performance

- Initial mobile page load should feel immediate on normal LTE.
- Today view should render useful content before loading large galleries.
- Photo uploads should support progress and retry.
- Core field workflows should tolerate intermittent connectivity and queue unsent data where feasible.

### 14.5 Accessibility

- Keyboard accessible
- Proper labels and focus states
- Sufficient contrast
- Touch targets suitable for field use
- Reduced-motion support
- Errors written in plain language

---

## 15. Notifications

### Urgent

- Gate blocking work within 24 hours
- Inspection request deadline
- Same-crew schedule conflict
- Failed inspection affecting scheduled work
- Customer decision blocking near-term work

### Important

- Gate ready for review
- Draw ready to invoice
- Proposal stale
- Startup reading overdue
- Change-order candidate detected

### Routine

- Daily owner brief
- Customer update draft ready
- Weekly schedule summary

Notifications must be deduplicated and should stop once the underlying condition is resolved.

---

## 16. Analytics and Success Metrics

### Operational metrics

- Average time from gate-ready to gate-signed
- Number of blocked-work attempts prevented
- Inspection deadlines missed
- Schedule conflicts detected and resolved before the workday
- Projects with a defined next action
- Required evidence completion rate
- Customer decisions received by deadline

### Financial metrics

- Time from milestone completion to invoice issuance
- Value of draws released but not invoiced
- Change orders identified and approved
- Contract value collected to date

### Customer metrics

- Customer progress-page usage
- Reduction in inbound status-request messages
- Customer update frequency
- Service-plan conversion at handover

### Adoption metrics

- Daily active internal users
- Percentage of active projects updated in the last 48 hours
- Photo/evidence capture per gate
- Action-card completion rate

### Pilot success criteria

The pilot is successful if, across three to five active projects, Apex demonstrates at least four of the following:

1. A missed prerequisite or construction error was prevented.
2. A schedule conflict was identified before it caused a lost workday.
3. An inspection was requested in time because of the system.
4. A draw was invoiced faster after milestone completion.
5. Project-update preparation time materially decreased.
6. Customer status-request volume decreased.
7. Required field evidence became more consistent.
8. The owner relied on the Today feed as the daily operating view.

---

## 17. Security, Privacy, and Reliability

- Role-based access control
- Encryption in transit and at rest
- Secure, revocable customer links
- Separate internal and customer-visible data flags
- Audit logs for consequential actions
- Configurable retention for communications and photos
- Consent-aware handling of website lead data and SMS communication
- Backup and restore procedures
- Idempotent webhook ingestion
- Retry handling for integrations
- Clear system-of-record ownership for each integrated field

---

## 18. Release Plan

## Phase 0 — Workflow discovery and setup

**Goal:** encode Apex’s real process before building broad functionality.

- Interview owner, office coordinator, and field lead
- Map actual construction phases and subcontractors
- Collect current checklists, contracts, draw schedules, and inspection rules
- Select three to five pilot projects
- Define user roles
- Confirm website/n8n lead handoff
- Decide temporary system-of-record boundaries with Monday.com and QuickBooks

**Exit gate:** Apex approves the phase map, initial gate templates, and pilot jobs.

## Phase 1 — Project spine and Today feed

- Authentication and roles
- Customer/project records
- Phase model
- Gate engine
- Today feed
- Photos and evidence
- Project timeline
- Manual project creation and basic lead import

**Exit gate:** A pilot project can move through a real gate with evidence and signoff.

## Phase 2 — Schedule, inspections, and draws

- Subcontractor visits
- Conflict detection
- Inspection workflows
- Draw release conditions
- Ready-to-bill cards
- Daily owner brief

**Exit gate:** Apex uses the system for one full workweek and resolves at least one live operational action through it.

## Phase 3 — Customer experience and startup

- Customer progress page
- Approved photo sharing
- Customer decisions
- Startup readings and LSI guidance
- Handover and service conversion

**Exit gate:** At least one real customer receives and uses the progress page through handover or an active milestone.

## Phase 4 — Sales continuity and AI assistance

- Website/n8n lead synchronization
- Lightweight opportunity stages
- Proposal follow-up actions
- AI summaries and customer-update drafts
- Change-order detection pilot

**Exit gate:** One website lead is traceable from acquisition into a project, or a live project produces a validated change-order candidate.

## Phase 5 — Pilot review and product extraction

- Review metrics and user behavior
- Remove unused features
- Identify universal Pool GATE components
- Identify Apex-specific configuration
- Decide whether to expand into Service, Coating, or Renovation

---

## 19. MVP Cut Line

The true MVP contains only:

1. Projects
2. Construction phases
3. Gates with checklists and photos
4. Today action feed
5. Inspection deadlines
6. Basic subcontractor conflict detection
7. Draw-release cards
8. Customer progress page
9. Daily owner brief

The following should be cut first if schedule or complexity grows:

- Full sales pipeline
- Automatic communication ingestion
- Advanced AI change-order detection
- Deep QuickBooks synchronization
- Commission logic
- Broad analytics dashboards
- Support for other Apex verticals

---

## 20. Open Decisions

1. ~~Which current tool is authoritative for active-project scheduling?~~ **Resolved 2026-08-05 by inheritance** — **Monday Work Management**, on Apex's own account (`apex-prds/decision-register.md` item 24). Apex OS holds a target completion window and crew bookings, not a schedule; it must not present itself as schedule authority.
2. ~~Which current tool is authoritative for invoice and payment status?~~ **Resolved 2026-08-05 by inheritance** — **QuickBooks**, with Projects on and Classes for the three business lines (item 2, pending Travis's confirmation of the structure — the *authority* does not depend on it). Unchanged from §12: Apex OS never issues an invoice; `job_draws` records readiness and a human's confirmation, never the financial truth.
3. ~~Who may pass each gate: field lead, project manager, or owner?~~ **Resolved 2026-07-31** — Owner and Superintendent; owner alone on the four draw-bearing gates.
4. ~~What are Apex’s exact construction phases and required gate templates?~~ **Resolved 2026-07-31** — nine phases (§8.2), seven gate templates (§9.4).
5. ~~Which draw schedules are standard versus contract-specific?~~ **Resolved 2026-07-31** — standard schedule, sourced from Apex’s contract: 10 / 30 / 30 / 20 / 10.
6. ~~Which inspections vary by jurisdiction?~~ **Resolved 2026-07-31** — no jurisdictional variation. The inspection list and per-inspection lead times remain open.
7. Which customer messages may be sent automatically, if any?
8. Where are existing project photos and documents stored?
9. Which team members need access during the pilot?
10. Should customer pages use one stable link or short-lived secure links?
11. What is the approved chemistry formula, threshold, and dosing policy?
12. Which three to five active projects provide the best pilot coverage?

---

## 21. Definition of Done for v1 Pilot

Apex OS v1 is complete when:

- Three to five real Apex pool projects are active in the system.
- Each project has a current phase, next gate, owner, schedule, and draw plan.
- At least three gate types have been completed on real work.
- Photos and required evidence are attached to gate records.
- Inspection and crew-conflict cards work on real schedules.
- At least one passed gate releases a real draw for invoicing.
- At least one customer uses a live progress page.
- The owner receives and uses the daily brief.
- All consequential actions are auditable.
- The team can remove Apex OS without corrupting QuickBooks, the website, or other operational records.
- A pilot review identifies what becomes shared Pool GATE capability and what remains Apex-specific.

---

## 22. Product Positioning

### Internal working description

**Apex OS is the daily control system for Apex Designer Pools.** It turns each pool project into a sequence of verified gates, highlights only the decisions that need attention, and connects completed work to customer communication and billing readiness.

### Future platform relationship

After proving the system at Apex:

```text
GATE platform
  → Pool GATE product
    → Apex OS deployment
```

The platform should be extracted from successful Apex workflows rather than designed from assumptions about future builders.
