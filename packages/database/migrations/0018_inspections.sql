-- Inspections — PRD §9.7. The inspection half of build-plan Step 5.
--
-- Source: docs/inspections-and-gate-checklists-2026-08-03.md, proposed 2026-08-03
-- and pending Travis's approval. The one value here that no code can derive is
-- lead time — it is however long the City of Lubbock actually takes — so every
-- lead time below is deliberately rounded UP. See the note on the column.
--
-- Jurisdiction is closed: single regime, City of Lubbock, 2021 ISPSC
-- (docs/decisions/construction-model.md). There is no jurisdiction dimension and
-- adding one is a real migration, not a column default.

begin;

-- 1. What inspections exist --------------------------------------------------
--
-- Fixed by migration, like construction_phases and customer_milestones: the
-- list is a statement about how Lubbock regulates pools, not per-job data.

create table inspection_types (
  inspection_key text primary key check (inspection_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sequence integer not null unique check (sequence > 0),
  title text not null check (length(trim(title)) > 0),
  -- The phase the work being inspected happens in.
  phase_key text not null references construction_phases(phase_key),
  -- Whose card this becomes. The sub who holds the licence usually books their
  -- own inspection; Apex still carries the consequence of it not happening.
  requested_by text not null check (requested_by in ('apex', 'subcontractor', 'customer')),
  -- Free text: which trade, when it is not Apex.
  requester_trade text,
  /*
   * Business days between requesting an inspection and the inspector arriving.
   *
   * ROUNDED UP ON PURPOSE. This number drives the last-safe-request date, and
   * the cost of being wrong is one-directional: too long warns a day early,
   * which is harmless; too short warns a day late, which is a crew standing on
   * a job that cannot proceed. Tighten these once real turnaround is known.
   */
  lead_time_business_days integer not null check (lead_time_business_days between 0 and 60),
  -- The Gate that cannot release until this inspection has passed. Stated
  -- rather than derived from phase ordering, for the same reason
  -- gate_definitions.blocks_phase_key is stated.
  blocks_definition_key text not null,
  -- How it is booked. Free text because it is a phone number or a URL in
  -- practice, and inventing a schema for that would be speculation.
  request_method text not null,
  -- Why this inspection exists, in the code's terms. Shown to the field.
  authority text not null
);

insert into inspection_types (
  inspection_key, sequence, title, phase_key, requested_by, requester_trade,
  lead_time_business_days, blocks_definition_key, request_method, authority
) values
  ('pool-steel-structural', 1, 'Pool steel & structural', 'steel-reinforcement',
   'apex', null, 2, 'pre-gunite', 'City of Lubbock inspection portal',
   '2021 ISPSC structural — reinforcing before concealment'),

  ('equipotential-bonding', 2, 'Equipotential bonding', 'rough-in',
   'subcontractor', 'Electrical', 2, 'pre-gunite', 'City of Lubbock inspection portal',
   'NEC Article 680 — equipotential bonding grid'),

  ('plumbing-pressure-test', 3, 'Pool plumbing pressure test', 'rough-in',
   'subcontractor', 'Plumbing', 2, 'pre-gunite', 'City of Lubbock inspection portal',
   '2021 ISPSC — pressure test before concealment'),

  ('deck-pre-pour', 4, 'Deck pre-pour', 'decking',
   'apex', null, 2, 'deck-tile', 'City of Lubbock inspection portal',
   'Deck reinforcement and sub-base before pour'),

  ('gas-line-pressure-test', 5, 'Gas line pressure test', 'equipment-hookup',
   'subcontractor', 'Gas fitter', 2, 'equipment', 'City of Lubbock inspection portal',
   'Fuel gas pressure test — applies only where gas heat is fitted'),

  ('electrical-final', 6, 'Electrical final', 'equipment-hookup',
   'subcontractor', 'Electrical', 3, 'final', 'City of Lubbock inspection portal',
   'NEC Article 680 — equipment bonding, GFCI, disconnect'),

  ('final-safety-barrier', 7, 'Final & safety barrier', 'plaster-fill',
   'apex', null, 3, 'final', 'City of Lubbock inspection portal',
   '2021 ISPSC §305 barriers and §310 suction entrapment');

create or replace function refuse_inspection_type_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'The inspection list is fixed by docs/inspections-and-gate-checklists-2026-08-03.md; change it by migration, not by statement.';
end;
$$;
create trigger inspection_types_fixed
before insert or update or delete on inspection_types
for each row execute function refuse_inspection_type_mutation();

-- 2. Where each one stands on a job ------------------------------------------
--
-- A row is created lazily, when someone first records something about it. A job
-- with no row for an inspection has simply not requested it — which is a state
-- the derivation handles, not an absence it has to guess about.

create table job_inspections (
  inspection_id text primary key check (inspection_id ~ '^inspect_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  inspection_key text not null references inspection_types(inspection_key),
  status text not null default 'requested'
    check (status in ('requested', 'scheduled', 'passed', 'failed', 'waived')),
  requested_on date,
  scheduled_for date,
  -- Set when a result is recorded. A failed inspection keeps its corrections.
  result_on date,
  result_note text check (result_note is null or length(result_note) <= 2000),
  corrections text check (corrections is null or length(corrections) <= 2000),
  /*
   * When the work behind this inspection is actually needed.
   *
   * Optional. When it is null the deadline is derived from the earliest live
   * subcontractor visit booked into the blocked Gate's phase — because without
   * a planned date there is genuinely no deadline to compute, and inventing one
   * would produce urgency the system cannot justify.
   */
  needed_by date,
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  updated_at timestamptz not null default now(),
  -- One live record per inspection per job. A re-inspection after a failure is
  -- a status change with a new result, not a second row racing the first.
  unique (job_id, inspection_key),
  check (status <> 'waived' or result_note is not null),
  check (status <> 'failed' or corrections is not null)
);

create index job_inspections_job_idx on job_inspections(job_id, inspection_key);
create index job_inspections_open_idx on job_inspections(job_id)
  where status in ('requested', 'scheduled', 'failed');

-- 3. History -----------------------------------------------------------------
--
-- A failed inspection that later passes must not erase the failure. What was
-- wrong, and what had to be corrected, is exactly the thing somebody will want
-- six months later.

create table inspection_results (
  result_id bigint generated always as identity primary key,
  inspection_id text not null references job_inspections(inspection_id),
  outcome text not null check (outcome in ('passed', 'failed', 'waived')),
  occurred_on date not null,
  note text check (note is null or length(note) <= 2000),
  corrections text check (corrections is null or length(corrections) <= 2000),
  recorded_at timestamptz not null default now(),
  recorded_by text not null references app_users(user_id)
);

create index inspection_results_idx on inspection_results(inspection_id, occurred_on, result_id);

create or replace function refuse_inspection_result_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'inspection_results is append-only';
end;
$$;
create trigger inspection_results_no_update
before update on inspection_results
for each row execute function refuse_inspection_result_mutation();
create trigger inspection_results_no_delete
before delete on inspection_results
for each row execute function refuse_inspection_result_mutation();

-- 4. Row-level security ------------------------------------------------------
--
-- The inspection list is not secret, but which of them a job has failed is
-- internal: PRD §9.11 keeps internal state off the customer page, and "your
-- bonding inspection failed" is exactly that.

alter table inspection_types enable row level security;
alter table job_inspections enable row level security;
alter table inspection_results enable row level security;

create policy inspection_types_read on inspection_types for select using (true);

create policy job_inspections_staff_read on job_inspections
for select using (is_staff());
create policy job_inspections_staff_write on job_inspections
for all using (current_app_role() in ('admin', 'office', 'superintendent', 'field'))
with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

create policy inspection_results_staff_read on inspection_results
for select using (is_staff());
create policy inspection_results_staff_insert on inspection_results
for insert with check (current_app_role() in ('admin', 'office', 'superintendent', 'field'));

commit;
