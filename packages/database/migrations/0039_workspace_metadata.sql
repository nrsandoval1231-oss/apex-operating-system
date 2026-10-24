begin;
create table project_workspace_metadata (
 job_id text primary key references jobs(job_id),
 priority text not null check (priority in ('normal','high','urgent')),
 revision integer not null check (revision > 0),
 updated_by text not null references app_users(user_id), updated_at timestamptz not null
);
create table project_notes (
 note_id text primary key check (note_id ~ '^note_[0-9A-HJKMNP-TV-Z]{26}$'),
 job_id text not null references jobs(job_id), text text not null check(length(trim(text)) between 1 and 4000),
 actor text not null references app_users(user_id), occurred_at timestamptz not null
);
create index project_notes_job on project_notes(job_id,occurred_at,note_id);
create table project_workspace_history (
 history_id bigserial primary key, job_id text not null references jobs(job_id),
 actor text not null references app_users(user_id), occurred_at timestamptz not null,
 priority text not null check(priority in ('normal','high','urgent')), revision integer not null,
 unique(job_id,revision)
);
create table project_workspace_receipts (idempotency_key text primary key, binding text not null, response jsonb not null);
create function refuse_workspace_audit_change() returns trigger language plpgsql as $$
begin raise exception 'Project workspace audit records are append-only'; end; $$;
create trigger project_notes_immutable before update or delete on project_notes for each row execute function refuse_workspace_audit_change();
create trigger project_workspace_history_immutable before update or delete on project_workspace_history for each row execute function refuse_workspace_audit_change();
create trigger project_workspace_receipts_immutable before update or delete on project_workspace_receipts for each row execute function refuse_workspace_audit_change();
commit;
