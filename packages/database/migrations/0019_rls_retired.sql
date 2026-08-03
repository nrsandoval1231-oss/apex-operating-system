-- Row-level security: retired, not deleted — deployment plan slices 4–5.
--
-- Decision recorded 2026-08-03, Nick Sandoval. See docs/plans/deployment.md §4.
--
-- THE PROBLEM THIS MIGRATION FIXES IS HONESTY, NOT SECURITY.
--
-- Since 0002_rls.sql this schema has carried a full set of row-level security
-- policies — role separation, can_access_job, staff-only reads, customers never
-- seeing subcontractor names. They read like a second line of defence behind the
-- API. They have never enforced anything, for two independent reasons:
--
--   1. Nothing in the application sets `request.jwt.claims`, and every policy
--      predicate is built on `current_app_role()`, which reads it. On a real
--      connection each predicate evaluates against an empty role.
--   2. The application connects as the table owner, and an owner bypasses RLS
--      unless the table is set to FORCE ROW LEVEL SECURITY. So the policies are
--      skipped rather than failing.
--
-- The tables nevertheless reported `pg_tables.rowsecurity = true`, which is the
-- worst of both worlds: the schema asserts a protection that is not running.
-- Anyone auditing this would have believed it.
--
-- WHAT WAS DECIDED, AND WHY
--
-- The API remains the single enforcement point for the pilot. That is a smaller
-- concession than it sounds:
--
--   · One API client, one tenant, roughly eight trusted staff.
--   · The highest-risk surface — the customer progress page — is protected
--     structurally rather than by policy. `buildCustomerPage` constructs the
--     payload from a narrow input that never carries a contract value, a risk
--     note, a subcontractor, a visit, or a draw. A new column cannot reach a
--     customer even if everyone forgets it exists. That is a stronger guarantee
--     than a runtime policy, not a weaker one.
--   · Staff role boundaries are enforced in domain code with tests behind them.
--
-- What RLS would have added here is defence against a bug in our own API. Real,
-- but bounded — and activating it against every query path is the largest
-- remaining slice, with its own risk of denying something that works today.
--
-- WHAT THIS MIGRATION DOES
--
-- Disables RLS explicitly, so `rowsecurity` is false and the schema stops
-- claiming something untrue. The policy definitions are deliberately KEPT: they
-- are correct as written, they cost nothing while inactive, and re-enabling is
-- then one `alter table ... enable row level security` per table plus the claim
-- plumbing — rather than archaeology through this file's history.
--
-- TO ACTIVATE THIS LATER, three things are needed together, and none of them
-- work alone:
--
--   1. Connect as a role that does NOT own these tables, or set FORCE ROW LEVEL
--      SECURITY on each. Owner bypass is silent.
--   2. Set `request.jwt.claims` inside every request's transaction, so
--      `current_app_role()` and `current_auth_user_id()` return the caller.
--   3. Give the tokenized customer route its own narrow role, or a deliberately
--      trusted connection. It authenticates nobody by design — the unguessable
--      token is the control — so it has no role to present and would deny
--      everything under these policies.
--
-- Do not enable one table at a time as a "gradual rollout": a half-active RLS
-- layer is the state this migration exists to end.

begin;

alter table app_users disable row level security;
alter table construction_phases disable row level security;
alter table customer_decisions disable row level security;
alter table customer_link_accesses disable row level security;
alter table customer_links disable row level security;
alter table customer_milestone_projections disable row level security;
alter table customer_milestones disable row level security;
alter table daily_briefs disable row level security;
alter table events disable row level security;
alter table evidence_records disable row level security;
alter table gate_definitions disable row level security;
alter table gate_instances disable row level security;
alter table gate_requirements disable row level security;
alter table inspection_results disable row level security;
alter table inspection_types disable row level security;
alter table integration_links disable row level security;
alter table job_customer_access disable row level security;
alter table job_inspections disable row level security;
alter table jobs disable row level security;
alter table leads disable row level security;
alter table project_phase_transitions disable row level security;
alter table projects disable row level security;
alter table requirement_evaluations disable row level security;
alter table scheduled_visits disable row level security;
alter table subcontractors disable row level security;
alter table takeoff_revisions disable row level security;
alter table visit_reschedules disable row level security;

-- `draw_eligibility` was renamed to `job_draws` by 0013 and no longer exists
-- under its original name; `storage.objects` belongs to the evidence-storage
-- migration, which is applied separately. Neither is addressed here.
alter table job_draws disable row level security;

commit;
