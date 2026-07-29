begin;

create table app_users (
  user_id text primary key check (user_id ~ '^user_[0-9A-HJKMNP-TV-Z]{26}$'),
  auth_user_id uuid not null unique,
  role text not null check (role in ('admin', 'office', 'field', 'customer')),
  display_name text not null check (length(trim(display_name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  lead_id text primary key check (lead_id ~ '^lead_[0-9A-HJKMNP-TV-Z]{26}$'),
  intake_source text not null check (length(trim(intake_source)) > 0),
  source_record_id text not null check (length(trim(source_record_id)) > 0),
  idempotency_key text not null unique check (length(idempotency_key) >= 8),
  accepted_payload_version integer not null default 1 check (accepted_payload_version > 0),
  accepted_payload jsonb not null check (jsonb_typeof(accepted_payload) = 'object'),
  status text not null default 'accepted' check (status in ('accepted', 'qualified', 'proposal', 'signed', 'rejected')),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intake_source, source_record_id)
);

create table jobs (
  job_id text primary key check (job_id ~ '^job_[0-9A-HJKMNP-TV-Z]{26}$'),
  lead_id text not null unique references leads(lead_id),
  signed_proposal_version integer not null check (signed_proposal_version > 0),
  status text not null check (status in ('active', 'on-hold', 'complete', 'closed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'closed' and closed_at is not null) or status <> 'closed')
);

create table job_customer_access (
  job_id text not null references jobs(job_id),
  auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (job_id, auth_user_id)
);

create table takeoff_revisions (
  revision_id text primary key check (revision_id ~ '^revision_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  revision_number integer not null check (revision_number > 0),
  status text not null check (status in ('draft', 'approved', 'superseded')),
  engine_version text not null,
  quantity_model_version text not null,
  job_input_sha256 text not null check (job_input_sha256 ~ '^[a-f0-9]{64}$'),
  calc_ledger_sha256 text not null check (calc_ledger_sha256 ~ '^[a-f0-9]{64}$'),
  quantities jsonb not null check (jsonb_typeof(quantities) = 'object'),
  calc_ledger jsonb not null check (jsonb_typeof(calc_ledger) = 'array'),
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  approved_at timestamptz,
  approved_by text references app_users(user_id),
  superseded_by_revision_id text references takeoff_revisions(revision_id),
  unique (job_id, revision_number),
  check (
    (status = 'approved' and approved_at is not null and approved_by is not null)
    or (status <> 'approved')
  )
);
create unique index one_approved_takeoff_per_job
  on takeoff_revisions(job_id)
  where status = 'approved';

create table gate_definitions (
  definition_key text not null,
  version integer not null check (version > 0),
  title text not null,
  phase text not null,
  draw_code text,
  customer_milestone text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (definition_key, version)
);

create table gate_requirements (
  definition_key text not null,
  definition_version integer not null,
  requirement_key text not null,
  title text not null,
  description text not null,
  sequence integer not null check (sequence >= 0),
  evidence_required boolean not null,
  accepted_evidence_kinds text[] not null check (cardinality(accepted_evidence_kinds) > 0),
  evaluator_roles text[] not null check (cardinality(evaluator_roles) > 0),
  primary key (definition_key, definition_version, requirement_key),
  foreign key (definition_key, definition_version)
    references gate_definitions(definition_key, version)
);

create table gate_instances (
  gate_instance_id text primary key check (gate_instance_id ~ '^gate_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  definition_key text not null,
  definition_version integer not null,
  approved_takeoff_revision_id text not null references takeoff_revisions(revision_id),
  status text not null check (status in ('not-started', 'in-progress', 'blocked', 'released')),
  started_at timestamptz,
  released_at timestamptz,
  released_by text references app_users(user_id),
  created_at timestamptz not null default now(),
  foreign key (definition_key, definition_version)
    references gate_definitions(definition_key, version),
  check ((status = 'released' and released_at is not null and released_by is not null) or status <> 'released')
);

create or replace function enforce_gate_revision_job()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from takeoff_revisions
    where revision_id = new.approved_takeoff_revision_id
      and job_id = new.job_id
      and status = 'approved'
  ) then
    raise exception 'Gate requires an approved takeoff revision for the same job';
  end if;
  return new;
end;
$$;
create trigger gate_revision_matches_job
before insert or update of approved_takeoff_revision_id, job_id on gate_instances
for each row execute function enforce_gate_revision_job();

create table evidence_records (
  evidence_id text primary key check (evidence_id ~ '^evidence_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  gate_instance_id text not null references gate_instances(gate_instance_id),
  requirement_key text not null,
  kind text not null check (kind in ('photo', 'video', 'document', 'measurement', 'inspection')),
  storage_key text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz not null,
  captured_by text not null references app_users(user_id),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 250000000),
  caption text,
  plan_revision_id text references takeoff_revisions(revision_id),
  detail_revision text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function enforce_evidence_requirement()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1
    from gate_instances gi
    join gate_requirements gr
      on gr.definition_key = gi.definition_key
     and gr.definition_version = gi.definition_version
    where gi.gate_instance_id = new.gate_instance_id
      and gi.job_id = new.job_id
      and gr.requirement_key = new.requirement_key
  ) then
    raise exception 'Evidence must link to a requirement on the same job and Gate';
  end if;
  return new;
end;
$$;
create trigger evidence_requirement_matches_gate
before insert or update of job_id, gate_instance_id, requirement_key on evidence_records
for each row execute function enforce_evidence_requirement();

create table requirement_evaluations (
  evaluation_id bigint generated always as identity primary key,
  gate_instance_id text not null references gate_instances(gate_instance_id),
  requirement_key text not null,
  evaluation_version integer not null check (evaluation_version > 0),
  outcome text not null check (outcome in ('passed', 'failed', 'overridden')),
  evidence_ids text[] not null default '{}',
  reason text,
  evaluated_at timestamptz not null,
  evaluated_by text not null references app_users(user_id),
  override_approved_by text references app_users(user_id),
  unique (gate_instance_id, requirement_key, evaluation_version),
  check (outcome <> 'failed' or reason is not null),
  check (outcome <> 'overridden' or (reason is not null and override_approved_by is not null))
);

create table events (
  event_id text primary key check (event_id ~ '^event_[0-9A-HJKMNP-TV-Z]{26}$'),
  schema_version integer not null check (schema_version > 0),
  event_type text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  actor jsonb not null check (jsonb_typeof(actor) = 'object'),
  lead_id text references leads(lead_id),
  job_id text references jobs(job_id),
  correlation_id text not null check (correlation_id ~ '^event_[0-9A-HJKMNP-TV-Z]{26}$'),
  causation_event_id text references events(event_id),
  idempotency_key text not null unique check (length(idempotency_key) >= 8),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  check (lead_id is not null or job_id is not null)
);
create index events_job_recorded_idx on events(job_id, recorded_at, event_id);
create index events_lead_recorded_idx on events(lead_id, recorded_at, event_id);

create or replace function refuse_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'events are append-only';
end;
$$;
create trigger events_no_update
before update on events
for each row execute function refuse_event_mutation();
create trigger events_no_delete
before delete on events
for each row execute function refuse_event_mutation();

create table draw_eligibility (
  draw_id text primary key check (draw_id ~ '^draw_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  source_gate_instance_id text not null unique references gate_instances(gate_instance_id),
  eligible_at timestamptz not null,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  quickbooks_invoice_id text,
  created_at timestamptz not null default now()
);

create table customer_milestone_projections (
  projection_id text primary key check (projection_id ~ '^customer_update_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text not null references jobs(job_id),
  milestone text not null,
  title text not null,
  summary text not null,
  media_url text,
  published_at timestamptz not null,
  source_event_id text not null unique references events(event_id),
  created_at timestamptz not null default now()
);

create table integration_links (
  integration text not null check (integration in ('quickbooks', 'monday', 'n8n')),
  entity_type text not null,
  canonical_id text not null,
  external_id text not null,
  sync_status text not null check (sync_status in ('pending', 'synced', 'failed')),
  last_synced_at timestamptz,
  last_error text,
  primary key (integration, entity_type, canonical_id),
  unique (integration, entity_type, external_id)
);

commit;
