begin;
create table tasks (
  task_id text primary key,
  job_id text references jobs(job_id),
  created_by text not null references app_users(user_id),
  assigned_user_id text references app_users(user_id),
  parent_task_id text unique references tasks(task_id),
  snapshot jsonb not null,
   check (snapshot->>'taskId' = task_id),
  check ((snapshot->>'jobId') is not distinct from job_id),
  check (snapshot->>'createdBy' = created_by),  check ((snapshot->>'assignedUserId') is not distinct from assigned_user_id)
);
create index tasks_job on tasks(job_id);
create index tasks_personal on tasks(created_by, assigned_user_id) where job_id is null;
create table task_history (history_id bigserial primary key, task_id text not null references tasks(task_id), entry jsonb not null);
create table task_receipts (idempotency_key text primary key, binding text not null, response jsonb not null);
create function refuse_task_audit_change() returns trigger language plpgsql as $$ begin raise exception 'Task audit records are append-only'; end $$;
create trigger task_history_immutable before update or delete on task_history for each row execute function refuse_task_audit_change();
create trigger task_receipts_immutable before update or delete on task_receipts for each row execute function refuse_task_audit_change();
commit;
