begin;

-- Estimates belong to the opportunity before a signed Proposal creates a Job.
alter table takeoff_revisions add column lead_id text references leads(lead_id);
update takeoff_revisions tr set lead_id = j.lead_id from jobs j where j.job_id = tr.job_id;
alter table takeoff_revisions alter column lead_id set not null;
alter table takeoff_revisions alter column job_id drop not null;
alter table takeoff_revisions drop constraint takeoff_revisions_job_id_revision_number_key;
alter table takeoff_revisions add constraint takeoff_revision_number_per_lead unique (lead_id, revision_number);
drop index one_approved_takeoff_per_job;
create unique index one_approved_takeoff_per_lead on takeoff_revisions(lead_id) where status = 'approved';

-- Existing Job-owned write paths remain valid while the new opportunity path
-- supplies lead_id directly. The database derives rather than trusts a mismatch.
create or replace function derive_takeoff_lead()
returns trigger language plpgsql as $$
declare job_lead text;
begin
  if new.job_id is not null then
    select lead_id into job_lead from jobs where job_id = new.job_id;
    if job_lead is null then raise exception 'Takeoff references an unknown Job.'; end if;
    if new.lead_id is not null and new.lead_id <> job_lead then
      raise exception 'Takeoff lead_id and Job lead_id must match.';
    end if;
    new.lead_id := job_lead;
  end if;
  return new;
end;
$$;
create trigger derive_takeoff_lead_trigger
before insert or update of job_id, lead_id on takeoff_revisions
for each row execute function derive_takeoff_lead();

alter table proposals add constraint one_proposal_per_lead unique (lead_id);
alter table proposal_versions add column draft_revision integer not null default 1 check (draft_revision > 0);

create or replace function protect_immutable_proposal_version()
returns trigger language plpgsql as $$
begin
  -- Signing is the only permitted mutation after issue: it must bind the
  -- already-issued commercial payload to exactly one matching Job.
  if old.status = 'issued' and new.status = 'signed' then
    if new.proposal_id is distinct from old.proposal_id
       or new.lead_id is distinct from old.lead_id
       or old.job_id is not null
       or new.job_id is null
       or new.version_number is distinct from old.version_number
       or new.draft_revision is distinct from old.draft_revision
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
       or old.signed_at is not null
       or new.signed_at is null
       or not exists (
         select 1 from jobs where job_id = new.job_id and lead_id = old.lead_id
       )
    then raise exception 'Issued or signed Proposal versions are immutable.';
    end if;
    return new;
  end if;

  if old.status in ('issued', 'signed') and (
    new.proposal_id is distinct from old.proposal_id
    or new.lead_id is distinct from old.lead_id
    or new.job_id is distinct from old.job_id
    or new.version_number is distinct from old.version_number
    or new.draft_revision is distinct from old.draft_revision
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
  ) then raise exception 'Issued or signed Proposal versions are immutable.';
  end if;
  return new;
end;
$$;

create table finish_estimate_runs (
  lead_id text not null references leads(lead_id),
  job_input_sha256 text not null check (job_input_sha256 ~ '^[a-f0-9]{64}$'),
  takeoff_revision_id text not null references takeoff_revisions(revision_id),
  proposal_version_id text not null references proposal_versions(proposal_version_id),
  created_at timestamptz not null default now(),
  primary key (lead_id, job_input_sha256)
);

-- Approved evidence stays immutable. Its sole permitted ownership transition is
-- binding a pre-contract Lead revision to the Job minted by its signed Proposal.
create or replace function protect_approved_takeoff_evidence()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved', 'superseded') then
      raise exception 'Approved takeoff quantity evidence is immutable.';
    end if;
    return old;
  end if;

  if old.job_id is null and new.job_id is not null
     and new.lead_id = old.lead_id
     and exists (select 1 from jobs where job_id = new.job_id and lead_id = old.lead_id)
     and exists (select 1 from proposal_versions
       where takeoff_revision_id = old.revision_id and job_id = new.job_id and status = 'signed')
  then
    if new.revision_number is distinct from old.revision_number
       or new.engine_version is distinct from old.engine_version
       or new.quantity_model_version is distinct from old.quantity_model_version
       or new.job_input_sha256 is distinct from old.job_input_sha256
       or new.calc_ledger_sha256 is distinct from old.calc_ledger_sha256
       or new.quantities is distinct from old.quantities
       or new.calc_ledger is distinct from old.calc_ledger
       or new.blocking_issues is distinct from old.blocking_issues
       or new.created_by is distinct from old.created_by
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
    then
      raise exception 'Approved takeoff quantity evidence is immutable.';
    end if;
    return new;
  end if;

  if old.status = 'approved' and new.status <> 'approved' and exists (
    select 1 from jobs where current_takeoff_revision_id = old.revision_id
  ) then
    raise exception 'Cannot supersede the current revision until the job pointer is cleared.';
  end if;

  if old.status in ('approved', 'superseded') and (
    new.lead_id is distinct from old.lead_id
    or new.job_id is distinct from old.job_id
    or new.revision_number is distinct from old.revision_number
    or new.engine_version is distinct from old.engine_version
    or new.quantity_model_version is distinct from old.quantity_model_version
    or new.job_input_sha256 is distinct from old.job_input_sha256
    or new.calc_ledger_sha256 is distinct from old.calc_ledger_sha256
    or new.quantities is distinct from old.quantities
    or new.calc_ledger is distinct from old.calc_ledger
    or new.blocking_issues is distinct from old.blocking_issues
    or new.created_by is distinct from old.created_by
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
  ) then
    raise exception 'Approved takeoff quantity evidence is immutable.';
  end if;
  return new;
end;
$$;

commit;
