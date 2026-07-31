-- Job-Proposal binding event emission
-- Adds job.bound event emission when proposals are signed
-- Also fixes the immutable protection to allow issued -> signed transition

begin;

-- Fix the immutable protection trigger to allow issued -> signed transition
create or replace function protect_immutable_proposal_version()
returns trigger language plpgsql as $$
begin
  -- Allow the specific transition from issued to signed (status change + job_id assignment)
  if old.status = 'issued' and new.status = 'signed' then
    -- Only allow: status change, signed_at set, job_id set
    if new.proposal_id is distinct from old.proposal_id
       or new.lead_id is distinct from old.lead_id
       or new.version_number is distinct from old.version_number
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
    then
      raise exception 'Issued or signed Proposal versions are immutable (except status/signed_at/job_id transition).';
    end if;
    return new;
  end if;

  -- Block all other mutations of issued or signed versions
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

-- Enhanced binding function that emits job.bound event
-- This replaces the existing bind_signed_proposal_to_job trigger from 0008
create or replace function bind_signed_proposal_to_job()
returns trigger language plpgsql as $$
declare
  event_suffix text;
  event_id text;
begin
  -- Validate signed proposal must have job_id
  if new.status = 'signed' and new.job_id is null then
    raise exception 'A signed Proposal version must be bound to a Job.';
  end if;

  -- Validate lead matches (job exists with same lead)
  if new.status = 'signed' and new.job_id is not null then
    if not exists (
      select 1 from jobs
      where job_id = new.job_id
        and lead_id = new.lead_id
    ) then
      raise exception 'Proposal lead_id and Job lead_id must match.';
    end if;

    -- Emit job.bound event when transitioning to signed
    if old.status <> 'signed' then
      event_suffix := split_part(new.proposal_version_id, '_', 3);
      event_id := 'event_' || event_suffix;

      insert into events (
        event_id,
        schema_version,
        event_type,
        occurred_at,
        recorded_at,
        actor,
        lead_id,
        job_id,
        correlation_id,
        idempotency_key,
        payload
      ) values (
        event_id,
        1,
        'job.bound',
        new.signed_at,
        now(),
        jsonb_build_object('kind', 'system'),
        new.lead_id,
        new.job_id,
        event_id,
        'job-bound:' || new.job_id || ':' || new.proposal_version_id,
        jsonb_build_object(
          'boundFromLeadId', new.lead_id,
          'signedProposalVersionId', new.proposal_version_id,
          'signedAt', new.signed_at
        )
      );
    end if;
  end if;

  return new;
end;
$$;

-- Drop and recreate the binding trigger with event emission
drop trigger if exists bind_signed_proposal_to_job_trigger on proposal_versions;
create trigger bind_signed_proposal_to_job_trigger
before insert or update of status, job_id, signed_at on proposal_versions
for each row execute function bind_signed_proposal_to_job();

-- Add index for proposal version lookup by job (might already exist from 0008)
create index if not exists proposal_versions_job_idx on proposal_versions(job_id);

commit;