begin;

alter table takeoff_revisions
  add constraint takeoff_revisions_revision_job_unique unique (revision_id, job_id);

alter table material_procurement
  add constraint material_procurement_revision_job_fk
  foreign key (revision_id, job_id)
  references takeoff_revisions (revision_id, job_id);

commit;
