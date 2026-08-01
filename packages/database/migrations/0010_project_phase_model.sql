-- Project and construction-phase model — PRD §8.2, §8.3, §9.3.
--
-- Authority: docs/decisions/construction-model.md, confirmed 2026-07-31.
-- Nine phases, six customer milestones, and a `superintendent` role that the
-- original four-role model had no seat for.
--
-- Forward-only. This migration adds a role and tables; it changes no existing
-- row and invents no project record for an existing job.

begin;

-- 1. Superintendent role -----------------------------------------------------
--
-- PRD §5.2's Project Manager / Superintendent was being collapsed into `field`.
-- The confirmed authority model needs it distinct: the superintendent passes the
-- three non-draw Gates, the owner (`admin`) passes the four draw-bearing ones.

alter table app_users drop constraint app_users_role_check;
alter table app_users add constraint app_users_role_check
  check (role in ('admin', 'office', 'superintendent', 'field', 'customer'));

-- Superintendents are staff. Without this they would read nothing under RLS.
create or replace function is_staff()
returns boolean language sql stable as $$
  select current_app_role() in ('admin', 'office', 'superintendent', 'field')
$$;

-- Gate work the superintendent must be able to do. These mirror the existing
-- `field` grants; release authority is narrowed per-Gate below, not here.
drop policy if exists gate_instance_staff_insert on gate_instances;
create policy gate_instance_staff_insert on gate_instances
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

drop policy if exists gate_instance_field_update on gate_instances;
create policy gate_instance_field_update on gate_instances
for update using (current_app_role() in ('admin', 'superintendent', 'field'))
with check (current_app_role() in ('admin', 'superintendent', 'field'));

drop policy if exists evidence_field_insert on evidence_records;
create policy evidence_field_insert on evidence_records
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

drop policy if exists evaluation_field_insert on requirement_evaluations;
create policy evaluation_field_insert on requirement_evaluations
for insert with check (current_app_role() in ('admin', 'superintendent', 'field'));

drop policy if exists events_staff_insert on events;
create policy events_staff_insert on events
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

drop policy if exists customer_projection_staff_insert on customer_milestone_projections;
create policy customer_projection_staff_insert on customer_milestone_projections
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

-- 2. Reference model ---------------------------------------------------------

create table customer_milestones (
  milestone_key text primary key check (milestone_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sequence integer not null unique check (sequence > 0),
  title text not null check (length(trim(title)) > 0)
);

insert into customer_milestones (milestone_key, sequence, title) values
  ('design', 1, 'Design'),
  ('excavation', 2, 'Excavation'),
  ('shell', 3, 'Shell'),
  ('finishes', 4, 'Finishes'),
  ('water', 5, 'Water'),
  ('handover', 6, 'Handover');

create table construction_phases (
  phase_key text primary key check (phase_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sequence integer not null unique check (sequence between 1 and 9),
  title text not null check (length(trim(title)) > 0),
  customer_milestone text not null references customer_milestones(milestone_key)
);

insert into construction_phases (phase_key, sequence, title, customer_milestone) values
  ('design-permitting',   1, 'Design, Engineering & Permitting',     'design'),
  ('layout-excavation',   2, 'Layout & Excavation',                  'excavation'),
  ('steel-reinforcement', 3, 'Steel Reinforcement (Rebar)',          'shell'),
  ('rough-in',            4, 'Plumbing & Electrical Rough-In',       'shell'),
  ('gunite',              5, 'Gunite/Shotcrete Concrete Pour',       'shell'),
  ('tile-coping',         6, 'Waterline Tile & Coping Installation', 'finishes'),
  ('decking',             7, 'Patio Decking & Hardscaping',          'finishes'),
  ('equipment-hookup',    8, 'Pool Pad Equipment Hookup',            'water'),
  ('plaster-fill',        9, 'Interior Plaster Finish & Water Fill',  'water');

-- Handover is deliberately unreachable from any phase: it is a property of the
-- job being finished, not of a checklist advancing.
create or replace function refuse_reference_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'The construction phase and customer milestone model is fixed by docs/decisions/construction-model.md; change it by migration, not by statement.';
end;
$$;
create trigger construction_phases_fixed
before insert or update or delete on construction_phases
for each row execute function refuse_reference_mutation();
create trigger customer_milestones_fixed
before insert or update or delete on customer_milestones
for each row execute function refuse_reference_mutation();

-- 3. Project record (PRD §9.3) ----------------------------------------------
--
-- Keyed by job_id. No parallel project identity is minted: the canonical chain
-- is lead → job, and a second key would be a second thing to reconcile.
-- Lifecycle status lives on `jobs.status` and is not duplicated here.

create table projects (
  job_id text primary key references jobs(job_id),
  current_phase_key text not null references construction_phases(phase_key),
  superintendent_user_id text references app_users(user_id),
  target_completion_start date,
  target_completion_end date,
  risk_note text check (risk_note is null or length(risk_note) <= 2000),
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  updated_at timestamptz not null default now(),
  check (
    target_completion_start is null
    or target_completion_end is null
    or target_completion_start <= target_completion_end
  )
);

-- Only the owner or a superintendent can be accountable for a job.
create or replace function enforce_superintendent_role()
returns trigger language plpgsql as $$
begin
  if new.superintendent_user_id is not null and not exists (
    select 1 from app_users
    where user_id = new.superintendent_user_id
      and role in ('admin', 'superintendent')
      and active
  ) then
    raise exception 'A project superintendent must be an active admin or superintendent user.';
  end if;
  return new;
end;
$$;
create trigger project_superintendent_role
before insert or update of superintendent_user_id on projects
for each row execute function enforce_superintendent_role();

-- 4. Phase history -----------------------------------------------------------
--
-- Append-only, same discipline as `events`. A phase change is a consequential
-- action under PRD §13's audit requirement: actor, timestamp, prior value, new
-- value. `reason` is mandatory whenever the move is not one step forward.

create table project_phase_transitions (
  transition_id bigint generated always as identity primary key,
  job_id text not null references projects(job_id),
  from_phase_key text references construction_phases(phase_key),
  to_phase_key text not null references construction_phases(phase_key),
  occurred_at timestamptz not null,
  actor_user_id text not null references app_users(user_id),
  reason text check (reason is null or length(trim(reason)) > 0),
  source_event_id text not null unique references events(event_id),
  created_at timestamptz not null default now(),
  check (from_phase_key is null or from_phase_key <> to_phase_key)
);
create index project_phase_transitions_job_idx
  on project_phase_transitions(job_id, occurred_at, transition_id);

create or replace function enforce_phase_transition_reason()
returns trigger language plpgsql as $$
declare
  from_sequence integer;
  to_sequence integer;
begin
  select sequence into to_sequence from construction_phases where phase_key = new.to_phase_key;
  if new.from_phase_key is null then
    -- Opening a project at any phase is a stated starting position, not a move.
    return new;
  end if;
  select sequence into from_sequence from construction_phases where phase_key = new.from_phase_key;
  if to_sequence <> from_sequence + 1 and (new.reason is null or length(trim(new.reason)) = 0) then
    raise exception 'A phase change that is not one step forward requires a recorded reason.';
  end if;
  return new;
end;
$$;
create trigger project_phase_transition_reason
before insert on project_phase_transitions
for each row execute function enforce_phase_transition_reason();

create or replace function refuse_phase_history_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'project_phase_transitions is append-only';
end;
$$;
create trigger project_phase_transitions_no_update
before update on project_phase_transitions
for each row execute function refuse_phase_history_mutation();
create trigger project_phase_transitions_no_delete
before delete on project_phase_transitions
for each row execute function refuse_phase_history_mutation();

-- 5. Per-Gate release authority ---------------------------------------------
--
-- The owner alone releases the four draw-bearing Gates; the superintendent
-- releases the three that release no money. Authority therefore belongs to the
-- Gate definition, not to a single global rule.
--
-- Backfill note: existing rows get {admin, superintendent}, which is the
-- confirmed authority for pre-gunite — the only definition that exists today.
-- The remaining six definitions are seeded in the Gate-generalization step.

alter table gate_definitions
  add column release_roles text[] not null default array['admin']::text[];

alter table gate_definitions
  add constraint gate_definitions_release_roles_valid
  check (
    cardinality(release_roles) > 0
    and release_roles <@ array['admin', 'superintendent', 'field']::text[]
  );

-- Ties a Gate to its phase so a Gate cannot be defined against a phase Apex
-- does not build. Nullable while the remaining definitions are seeded.
alter table gate_definitions
  add column phase_key text references construction_phases(phase_key);

update gate_definitions
  set release_roles = array['admin', 'superintendent']::text[],
      phase_key = 'gunite'
  where definition_key = 'pre-gunite';

alter table gate_definitions alter column release_roles drop default;

-- 6. Row-level security ------------------------------------------------------

alter table construction_phases enable row level security;
alter table customer_milestones enable row level security;
alter table projects enable row level security;
alter table project_phase_transitions enable row level security;

-- The phase model is not secret; a customer page renders milestone names from it.
create policy construction_phases_read on construction_phases for select using (true);
create policy customer_milestones_read on customer_milestones for select using (true);

create policy projects_authorized_read on projects
for select using (can_access_job(job_id));
create policy projects_staff_write on projects
for all using (current_app_role() in ('admin', 'office', 'superintendent'))
with check (current_app_role() in ('admin', 'office', 'superintendent'));

create policy project_transitions_staff_read on project_phase_transitions
for select using (is_staff());
create policy project_transitions_staff_insert on project_phase_transitions
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

commit;
