begin;

create table lead_followups (
  followup_id bigint generated always as identity primary key,
  lead_id text not null references leads(lead_id),
  next_action text not null check (length(trim(next_action)) between 1 and 1000),
  due_date date not null,
  assigned_user_id text not null references app_users(user_id),
  created_by text not null references app_users(user_id),
  created_at timestamptz not null default now(),
  completed_by text references app_users(user_id),
  completed_at timestamptz,
  idempotency_key text not null unique check (length(idempotency_key) >= 8),
  completion_idempotency_key text unique,
  check ((completed_by is null) = (completed_at is null)),
  check (completion_idempotency_key is null or completed_at is not null)
);

create unique index one_open_lead_followup on lead_followups(lead_id) where completed_at is null;
create index lead_followups_history on lead_followups(lead_id, created_at desc, followup_id desc);

create function enforce_lead_followup_staff() returns trigger language plpgsql as $$
declare lead_status text;
begin
  select status into lead_status from leads where lead_id = new.lead_id for update;
  if not exists (select 1 from app_users where user_id = new.assigned_user_id and active and role in ('admin', 'office')) then
    raise exception 'A lead follow-up must be assigned to an active admin or office user.';
  end if;
  if not exists (select 1 from app_users where user_id = new.created_by and active and role in ('admin', 'office')) then
    raise exception 'A lead follow-up must be created by an active admin or office user.';
  end if;
  if new.completed_by is not null and not exists (
    select 1 from app_users where user_id = new.completed_by and active and role in ('admin', 'office')
  ) then
    raise exception 'A lead follow-up must be completed by an active admin or office user.';
  end if;
  if lead_status not in ('accepted', 'qualified', 'proposal')
     or exists (select 1 from jobs where lead_id = new.lead_id) then
    raise exception 'Only an open pre-contract opportunity may have a follow-up.';
  end if;
  return new;
end;
$$;
create trigger enforce_lead_followup_staff_trigger before insert or update on lead_followups
for each row execute function enforce_lead_followup_staff();

create function prevent_job_with_open_lead_followup() returns trigger language plpgsql as $$
begin
  perform 1 from leads where lead_id = new.lead_id for update;
  if exists (select 1 from lead_followups where lead_id = new.lead_id and completed_at is null) then
    raise exception 'Complete the open pre-contract follow-up before binding the opportunity to a Job.';
  end if;
  return new;
end;
$$;
create trigger prevent_job_with_open_lead_followup_trigger before insert or update of lead_id on jobs
for each row execute function prevent_job_with_open_lead_followup();

create function prevent_closing_lead_with_open_followup() returns trigger language plpgsql as $$
begin
  if new.status in ('signed', 'rejected') and exists (
    select 1 from lead_followups where lead_id = new.lead_id and completed_at is null
  ) then
    raise exception 'Complete the open pre-contract follow-up before closing the opportunity lifecycle.';
  end if;
  return new;
end;
$$;
create trigger prevent_closing_lead_with_open_followup_trigger before update of status on leads
for each row when (old.status is distinct from new.status)
execute function prevent_closing_lead_with_open_followup();

commit;
