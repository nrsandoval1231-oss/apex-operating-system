# APEX architecture and canonical ownership

Audit baseline: `f6d5252f76a3b103b8849ae74c00fd9f9b07c022` (main), 2026-10-24. This describes the existing system; no APEX 2.0 UI work is included.

## Runtime boundaries

- `apps/website`: Astro static marketing pages with a React quote island. Attribution, vertical selection, consent and retry identity stay in the browser. `src/lib/site.ts` selects the webhook at build time and refuses an unconfigured production build.
- `workflows/lead-engine`: two n8n SDK workflow sources. Intake validates and deduplicates website IDs into Airtable; job-status intake records external events. These are external integrations, not the operational database or a deployed background worker in this checkout. There is no implemented speed-to-lead workflow here.
- `apps/apex-os`: React/Vite staff application at `/app`, React Router, local component state and `api/useJobs.ts` resource hooks. Commands invalidate resources through `apex:data-changed`. Zod validates responses. Designer is a lazy route imported from source through an explicit Vite alias.
- `apps/designer`: standalone React/Vite application, embedded staff route, command-line takeoff/rendering tools and optional Tauri shell. Its pure engine owns geometry, hydraulics, structure, excavation, finishes, equipment, code checks and quantity calculations. Local saved designs are working files, not approved operational records. ExcelJS is dynamically loaded for workbook export and is necessary.
- `apps/gate-api`: one Node HTTP server serving staff assets, authenticated JSON endpoints, evidence and server-rendered customer progress pages. `main.ts` selects database, storage and identity configuration. `server.ts` owns HTTP parsing/authentication/authorization and delegates business commands to services.
- `packages/contracts`: runtime schemas, canonical prefixed ULID identities, event envelopes, quantity digest, civil-day and DTO contracts. Browser-safe; no database access.
- `packages/domain`: pure gate decisions/evolution, construction phase policy, inspection deadlines, scheduling conflicts, draws, customer projection and action cards. No infrastructure access.
- `packages/pricing-engine`: typed pricing of approved quantity facts; explicit measured/direct prices and fee basis points. Missing prices block issue; calibration rates in the archive are not production pricing authority.
- `packages/gate-service`: transaction orchestration and SQL read models. `GateService` owns gates, projects, takeoff approval, draws, calendar, briefs and closeout; proposal, procurement, inspections, customer and follow-up modules own their respective operations. `jobState.ts` owns the closed/cancelled mutation guard and job-row lock.
- `packages/database`: narrow Queryable/Database interfaces; pooled PostgreSQL and embedded PGlite adapters; ordered migration runner with PostgreSQL advisory lock. All 36 historical SQL files remain; the 35-file operational chain deliberately excludes provider-specific `0003_evidence_storage.sql`.
- `packages/storage`: validated write-once evidence keys, local filesystem adapter and signed S3-compatible HTTP adapter. Objects contain bytes; PostgreSQL contains ownership, digest, capture metadata and publication permission.
- `deploy/cloudflare`: static website hosting configuration and a thin Worker that starts the Node container and adds staging noindex. The Worker is independently packaged, not in pnpm workspaces. No deployments were performed by this audit.

## Business lifecycle and sources of truth

| Operation/entity | Canonical owner | Persistence / evidence |
| --- | --- | --- |
| Website inquiry | Website capture + n8n intake | External `apex_<seconds>_<suffix>` ID and Airtable; no automatic operational bridge is proven |
| Operational lead/opportunity | API manual intake, LeadFollowupService | `leads.accepted_payload`, canonical `lead_` ID, intake idempotency key, `lead_followups` |
| Design and quantities | Designer calculates; GateService/ProposalService approves | `takeoff_revisions`: retained input, ledger, digest, approver and quantity model version |
| Estimate and issued offer | ProposalService + typed pricing engine | `proposals`, `proposal_versions`, optimistic `draft_revision`, immutable issued/signed payload and hashes |
| Customer acceptance | ProposalService.signProposal | Staff confirmation of exact issued version; one transaction binds Job/Project, takeoff, events, lead status and follow-up completion |
| Construction Job | `jobs` is canonical identity; `projects` is its construction workspace | Shared `job_id`, phase transitions, assigned superintendent; no second Project ID authority |
| Gates and evidence | Pure domain decision + GateService transaction | `gate_instances`, definitions/requirements, evaluations, `events`, evidence rows + stored bytes |
| Procurement | ProcurementService | Approved current takeoff digest; revision-specific lines, optimistic updates, history snapshots and idempotency keys |
| Scheduling / tasks | GateService and LeadFollowupService | `scheduled_visits`, subcontractors; follow-ups before contract; Today cards are derived, not independently editable tasks |
| Inspections | InspectionService + domain inspection policy | Types, per-job state and append-only result history; blockers constrain release/handover |
| Financial gates | GateService + domain draw rules | `job_draws`, eligibility and human invoice confirmation; no full accounting ledger, collections engine or QuickBooks implementation |
| Customer visibility | CustomerService | Hashed revocable bearer links, access history, explicit photo publication, decisions and milestone projections |
| Handover and closure | GateService.completeJob / closeJob | Final phase, required gates/inspections, handover and invoice requirements; job row serializes closure against mutations; historical view is read-only |
| Daily brief | GateService + domain brief | `daily_briefs` freezes generated daily snapshot; not a scheduled daemon |

Sequence: inquiry → operational intake → follow-up/design → approved quantity snapshot → priced proposal → issue → confirmed acceptance → Job/Project → construction gates/visits/procurement/inspections/draws → completed handover → reconciled closure → retained history. Website-to-operational intake and external job-status delivery are acceptance gaps, not assumed automatic links.

## Security and persistence boundaries

Exactly one of OIDC/JWKS, Cloudflare Access or pilot HS256 is selected. Staff permissions come from active `app_users` rows, never role claims. The local tokenless mode is restricted to loopback and cannot coexist with configured provider identity at startup. Browser bearer tokens persist in localStorage; PKCE state/verifier are tab scoped. Customer links use separate hashed capabilities and projections.

Migration 0019 retires RLS in favor of the trusted API boundary. Direct database credentials must therefore remain private; historical RLS SQL is preserved as migration evidence. Query parameters carry values. Job-row locks, optimistic revisions, uniqueness/FK constraints and events provide complementary safeguards; they are not interchangeable.

The repository is a modular monolith with separate marketing and automation edges. Splitting services or replacing the database is unwarranted for this cleanup. Archives, decks, Tauri and CLI entry points are not dead merely because application imports do not reach them.
