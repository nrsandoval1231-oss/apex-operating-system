begin;

-- Closure is an explicit financial/operational fact, not an inference from the
-- last released Gate. The event remains the audit authority; these columns make
-- the current read model safe and queryable.
alter table jobs
  add column closed_by text references app_users(user_id),
  add column reconciliation_complete boolean;

alter table jobs
  add constraint jobs_closed_metadata_check check (
    (status = 'closed' and closed_at is not null and closed_by is not null and reconciliation_complete = true)
    or status <> 'closed'
  );

commit;
