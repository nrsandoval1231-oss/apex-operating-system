-- Durable Proposal lifecycle: proposal acquisition before Job existence.
-- proposal.drafted/issued belong to a Lead; proposal.signed / job.created / job.bound
-- are the only transitions that mint or bind a Job ID.

create table proposals (
  proposal_id text primary key check (proposal_id ~ '^proposal_[0-9A-HJKMNP-TV-Z]{26}$'),
  lead_id text not null references leads(lead_id),
  current_version integer not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proposal_versions (
  proposal_version_id text primary key check (proposal_version_id ~ '^proposal_version_[0-9A-HJKMNP-TV-Z]{26}$'),
  proposal_id text not null references proposals(proposal_id),
  lead_id text not null references leads(lead_id),
  job_id text references jobs(job_id),
  version_number integer not null check (version_number > 0),
  status text not null check (status in ('draft', 'issued', 'signed')),
  takeoff_revision_id text not null references takeoff_revisions(revision_id),
  quantity_payload_sha256 text not null check (quantity_payload_sha256 ~ '^[a-f0-9]{64}$'),
  quantity_model_version text not null,
  pricing_library_version text not null,
  proposal_payload_sha256 text not null check (proposal_payload_sha256 ~ '^[a-f0-9]{64}$'),
  proposal_payload jsonb not null check (jsonb_typeof(proposal_payload) = 'object'),
  total_cents bigint not null check (total_cents >= 0),
  created_at timestamptz not null default now(),
  created_by text not null references app_users(user_id),
  issued_at timestamptz,
  issued_by text references app_users(user_id),
  signed_at timestamptz,
  unique (proposal_id, version_number),
  check (
    (status = 'issued' and issued_at is not null and issued_by is not null)
    or status <> 'issued'
  ),
  check (
    (status = 'signed' and job_id is not null and signed_at is not null)
    or status <> 'signed'
  )
);

create index proposal_versions_lead_idx on proposal_versions(lead_id);
create index proposal_versions_job_idx on proposal_versions(job_id);

create or replace function protect_immutable_proposal_version()
returns trigger language plpgsql as $$
begin
  if old.status in ('issued', 'signed') and (
    new.proposal_id is distinct from old.proposal_id
    or new.lead_id is distinct from old.lead_id
    or new.job_id is distinct from old.job_id
    or new.version_number is distinct from old.version_number
    or new.status is distinct from old.status
    or new.takeoff_revision_id is distinct from old.takeoff_revision_id
    or new.quantity_payload_sha256 is distinct from old.quantity_payload_sha256
    or new.quantity_model_version is distinct from old.quantity_model_version
    or new.pricing_library_version is distinct from old.pricing_library_version
    or new.proposal_payload_sha256 is distinct from old.proposal_payload_sha256
    or new.proposal_payload is distinct from old.proposal_payload
    or new.total_cents is distinct from old.total_cents
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.issued_at is distinct from old.issued_at
    or new.issued_by is distinct from old.issued_by
    or new.signed_at is distinct from old.signed_at
  ) then
    raise exception 'Issued or signed Proposal versions are immutable.';
  end if;
  return new;
end;
$$;
create trigger protect_proposal_version_update
before update on proposal_versions
for each row execute function protect_immutable_proposal_version();

create or replace function protect_immutable_proposal_delete()
returns trigger language plpgsql as $$
begin
  if old.status in ('issued', 'signed') then
    raise exception 'Issued or signed Proposal versions are immutable.';
  end if;
  return old;
end;
$$;
create trigger protect_proposal_version_delete
before delete on proposal_versions
for each row execute function protect_immutable_proposal_delete();

create or replace function bind_signed_proposal_to_job()
returns trigger language plpgsql as $$
begin
  if new.status = 'signed' and new.job_id is null then
    raise exception 'A signed Proposal version must be bound to a Job.';
  end if;
  if new.status = 'signed' and new.job_id is not null then
    if not exists (
      select 1 from jobs
      where job_id = new.job_id
        and lead_id = new.lead_id
    ) then
      raise exception 'Proposal lead_id and Job lead_id must match.';
    end if;
  end if;
  return new;
end;
$$;
create trigger bind_signed_proposal_to_job_trigger
before insert or update of status, job_id on proposal_versions
for each row execute function bind_signed_proposal_to_job();
