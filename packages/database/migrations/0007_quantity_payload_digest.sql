-- Add tamper evidence for the ordered authoritative quantity facts.
-- Existing revisions must be explicitly re-derived and backfilled;
-- migration refuses to invent a digest for evidence it did not canonicalize.

alter table takeoff_revisions
  add column quantity_payload_sha256 text;

do $$
begin
  if exists (select 1 from takeoff_revisions) then
    raise exception 'Backfill quantity_payload_sha256 for existing takeoff revisions before applying 0007.';
  end if;
end;
$$;

alter table takeoff_revisions
  alter column quantity_payload_sha256 set not null,
  add constraint takeoff_revisions_quantity_payload_sha256_format
    check (quantity_payload_sha256 ~ '^[a-f0-9]{64}$');

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
    or new.quantity_payload_sha256 is distinct from old.quantity_payload_sha256
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
