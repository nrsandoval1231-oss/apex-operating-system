-- Align PostgreSQL persistence with the canonical approved Designer quantity revision.

alter table takeoff_revisions
  drop constraint takeoff_revisions_quantities_check;

alter table takeoff_revisions
  add column blocking_issues jsonb not null default '[]'::jsonb,
  add constraint takeoff_revisions_quantities_array
    check (jsonb_typeof(quantities) = 'array'),
  add constraint takeoff_revisions_blocking_issues_array
    check (jsonb_typeof(blocking_issues) = 'array'),
  add constraint approved_takeoff_requires_quantity_evidence
    check (
      status <> 'approved'
      or (
        jsonb_array_length(quantities) > 0
        and jsonb_array_length(calc_ledger) > 0
        and jsonb_array_length(blocking_issues) = 0
      )
    );

alter table jobs
  add column current_takeoff_revision_id text references takeoff_revisions(revision_id);

create or replace function enforce_job_current_takeoff_revision()
returns trigger language plpgsql as $$
begin
  if new.current_takeoff_revision_id is null then
    return new;
  end if;
  if not exists (
    select 1 from takeoff_revisions
    where revision_id = new.current_takeoff_revision_id
      and job_id = new.job_id
      and status = 'approved'
  ) then
    raise exception 'Current takeoff revision must be an approved revision for the same job.';
  end if;
  return new;
end;
$$;

create trigger enforce_job_current_takeoff_revision
before insert or update of current_takeoff_revision_id on jobs
for each row execute function enforce_job_current_takeoff_revision();

create or replace function protect_approved_takeoff_evidence()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('approved', 'superseded') then
      raise exception 'Approved takeoff quantity evidence is immutable.';
    end if;
    return old;
  end if;

  if old.status = 'approved' and new.status <> 'approved' and exists (
    select 1 from jobs where current_takeoff_revision_id = old.revision_id
  ) then
    raise exception 'Cannot supersede the current revision until the job pointer is cleared.';
  end if;

  if old.status in ('approved', 'superseded') and (
    new.job_id is distinct from old.job_id
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

create trigger protect_approved_takeoff_update
before update on takeoff_revisions
for each row execute function protect_approved_takeoff_evidence();

create trigger protect_approved_takeoff_delete
before delete on takeoff_revisions
for each row execute function protect_approved_takeoff_evidence();
