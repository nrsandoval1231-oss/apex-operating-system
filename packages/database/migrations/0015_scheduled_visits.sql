-- Subcontractor visits and crew conflicts — PRD §9.6.
--
-- The half of build-plan Step 5 that is not blocked. Inspections need Apex's
-- inspection list, requesters, and lead times before §9.7 can be built at all;
-- crew scheduling needs none of that.
--
-- Explicit non-goal (§9.6): this does not optimise a schedule. It stores what
-- was planned and surfaces the two things the system can prove are wrong — the
-- same crew in two places at once, and work booked before the gate that guards
-- it has released.

begin;

-- 1. Who does the work ------------------------------------------------------

create table subcontractors (
  subcontractor_id text primary key check (subcontractor_id ~ '^sub_[0-9A-HJKMNP-TV-Z]{26}$'),
  name text not null check (length(trim(name)) > 0),
  trade text not null check (length(trim(trade)) > 0),
  -- Free text on purpose: how Apex reaches them is a phone number in practice,
  -- and inventing a contact schema before anyone asked for one is speculation.
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index subcontractors_trade_idx on subcontractors(trade) where active;

-- 2. What is booked ---------------------------------------------------------

create table scheduled_visits (
  visit_id text primary key check (visit_id ~ '^visit_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  subcontractor_id text not null references subcontractors(subcontractor_id),
  -- The phase this visit does work in. Constrains it to the confirmed model, so
  -- nobody can book a crew into a phase Apex does not build.
  phase_key text not null references construction_phases(phase_key),
  -- Inclusive date range. Pool trades work in days, not hours: a gunite crew is
  -- booked for a day, not 09:00–14:30, and pretending otherwise would invent
  -- precision Apex does not have.
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'done', 'cancelled')),
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index scheduled_visits_job_idx on scheduled_visits(job_id, starts_on);
-- The index the conflict query runs on: a crew's bookings in date order.
create index scheduled_visits_crew_idx on scheduled_visits(subcontractor_id, starts_on, ends_on)
  where status in ('planned', 'confirmed');

-- 3. Moving a visit is a recorded act ---------------------------------------
--
-- §9.6 allows an authorized user to move a visit. A crew that was told Tuesday
-- and is now expected Thursday is a fact someone will have to answer for, so
-- the move is kept rather than overwritten.

create table visit_reschedules (
  reschedule_id bigint generated always as identity primary key,
  visit_id text not null references scheduled_visits(visit_id),
  from_starts_on date not null,
  from_ends_on date not null,
  to_starts_on date not null,
  to_ends_on date not null,
  reason text check (reason is null or length(trim(reason)) > 0),
  moved_at timestamptz not null default now(),
  moved_by text not null references app_users(user_id),
  check (to_starts_on <> from_starts_on or to_ends_on <> from_ends_on)
);

create index visit_reschedules_visit_idx on visit_reschedules(visit_id, moved_at);

create or replace function refuse_reschedule_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'visit_reschedules is append-only';
end;
$$;
create trigger visit_reschedules_no_update
before update on visit_reschedules
for each row execute function refuse_reschedule_mutation();
create trigger visit_reschedules_no_delete
before delete on visit_reschedules
for each row execute function refuse_reschedule_mutation();

-- 4. Which gate guards which phase ------------------------------------------
--
-- Stated rather than inferred. "The gate before this phase" is not derivable
-- from sequence alone: pre-gunite sits ON the gunite phase and guards it, while
-- every other gate sits at the end of the phase before the one it guards.
-- Guessing that from ordering would get the one irreversible gate wrong.

alter table gate_definitions
  add column blocks_phase_key text references construction_phases(phase_key);

update gate_definitions set blocks_phase_key = 'layout-excavation' where definition_key = 'permit';
update gate_definitions set blocks_phase_key = 'steel-reinforcement' where definition_key = 'excavation';
update gate_definitions set blocks_phase_key = 'gunite' where definition_key = 'pre-gunite';
update gate_definitions set blocks_phase_key = 'tile-coping' where definition_key = 'shell';
update gate_definitions set blocks_phase_key = 'equipment-hookup' where definition_key = 'deck-tile';
update gate_definitions set blocks_phase_key = 'plaster-fill' where definition_key = 'equipment';
-- The final gate guards nothing: there is no phase after it.

-- 5. Row-level security ------------------------------------------------------

alter table subcontractors enable row level security;
alter table scheduled_visits enable row level security;
alter table visit_reschedules enable row level security;

create policy subcontractors_staff_read on subcontractors
for select using (is_staff());
create policy subcontractors_office_write on subcontractors
for all using (current_app_role() in ('admin', 'office'))
with check (current_app_role() in ('admin', 'office'));

-- Customers never see which subcontractor is on their job (PRD §9.11).
create policy visits_staff_read on scheduled_visits
for select using (is_staff());
create policy visits_staff_write on scheduled_visits
for all using (current_app_role() in ('admin', 'office', 'superintendent'))
with check (current_app_role() in ('admin', 'office', 'superintendent'));

create policy reschedules_staff_read on visit_reschedules
for select using (is_staff());
create policy reschedules_staff_insert on visit_reschedules
for insert with check (current_app_role() in ('admin', 'office', 'superintendent'));

commit;
