begin;

-- Ordinary appointments only. Crew visits, gates, inspections and task deadlines
-- retain their existing authorities and join the read projection without copies.
create table calendar_events (
  calendar_event_id text primary key check (calendar_event_id ~ '^agenda_[0-9A-HJKMNP-TV-Z]{26}$'),
  job_id text references jobs(job_id),
  created_by text not null references app_users(user_id),
  assigned_user_id text references app_users(user_id),
  snapshot jsonb not null,
  check (snapshot->>'eventId' = calendar_event_id),
  check ((snapshot->>'jobId') is not distinct from job_id),
  check (snapshot->>'createdBy' = created_by),
  check ((snapshot->>'assignedUserId') is not distinct from assigned_user_id),
  check (
    (snapshot->>'allDay' = 'true'
      and snapshot->>'startsOn' is not null and snapshot->>'endsOn' is not null
      and snapshot->>'startsAt' is null and snapshot->>'endsAt' is null)
    or
    (snapshot->>'allDay' = 'false'
      and snapshot->>'startsOn' is null and snapshot->>'endsOn' is null
      and snapshot->>'startsAt' is not null and snapshot->>'endsAt' is not null)
  )
);
create index calendar_events_job on calendar_events(job_id);
create index calendar_events_personal on calendar_events(created_by, assigned_user_id) where job_id is null;

create table calendar_event_history (
  history_id bigserial primary key,
  calendar_event_id text not null references calendar_events(calendar_event_id),
  entry jsonb not null
);
create table calendar_event_receipts (
  idempotency_key text primary key,
  binding text not null,
  response jsonb not null
);
create function refuse_calendar_event_audit_change() returns trigger language plpgsql as $$
begin
  raise exception 'Calendar audit records are append-only';
end;
$$;
create trigger calendar_event_history_immutable before update or delete on calendar_event_history
  for each row execute function refuse_calendar_event_audit_change();
create trigger calendar_event_receipts_immutable before update or delete on calendar_event_receipts
  for each row execute function refuse_calendar_event_audit_change();

commit;
