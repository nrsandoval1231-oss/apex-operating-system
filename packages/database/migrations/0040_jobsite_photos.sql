begin;

alter table evidence_records
  add column purpose text not null default 'gate-requirement'
    check (purpose in ('gate-requirement', 'jobsite-photo')),
  alter column gate_instance_id drop not null,
  alter column requirement_key drop not null,
  add constraint evidence_purpose_links check (
    (purpose = 'gate-requirement' and gate_instance_id is not null and requirement_key is not null)
    or (purpose = 'jobsite-photo' and kind = 'photo' and gate_instance_id is null and requirement_key is null)
  );

create or replace function enforce_evidence_requirement()
returns trigger language plpgsql as $$
begin
  if new.purpose = 'gate-requirement' and not exists (
    select 1 from gate_instances gi
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
drop trigger evidence_requirement_matches_gate on evidence_records;
create trigger evidence_requirement_matches_gate
before insert or update of job_id, gate_instance_id, requirement_key, purpose on evidence_records
for each row execute function enforce_evidence_requirement();

create table jobsite_photo_uploads (
  idempotency_key text primary key,
  actor_id text not null references app_users(user_id),
  job_id text not null references jobs(job_id),
  evidence_id text not null unique references evidence_records(evidence_id),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  response jsonb not null,
  created_at timestamptz not null default now()
);
create function refuse_photo_upload_change() returns trigger language plpgsql as $$
begin
  raise exception 'Photo upload receipts and activity are append-only';
end;
$$;
create trigger jobsite_photo_uploads_immutable before update or delete on jobsite_photo_uploads
for each row execute function refuse_photo_upload_change();

-- Visibility remains editable through the existing controlled publication command.
-- The uploaded documentation and its association remain immutable.
create function protect_jobsite_photo() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.purpose is distinct from old.purpose then
    raise exception 'Evidence purpose is immutable';
  end if;
  if old.purpose = 'jobsite-photo' then
    if tg_op = 'DELETE' then raise exception 'Uploaded jobsite photos are immutable'; end if;
    if (to_jsonb(new) - array['customer_visible','customer_caption','visibility_set_at','visibility_set_by'])
       is distinct from
       (to_jsonb(old) - array['customer_visible','customer_caption','visibility_set_at','visibility_set_by'])
    then raise exception 'Uploaded jobsite photos are immutable'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger jobsite_photo_immutable before update or delete on evidence_records
for each row execute function protect_jobsite_photo();
create index jobsite_photo_uploads_job on jobsite_photo_uploads(job_id, created_at desc);
commit;
