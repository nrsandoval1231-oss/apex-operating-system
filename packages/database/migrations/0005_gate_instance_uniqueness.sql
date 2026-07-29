begin;

create unique index one_gate_definition_instance_per_job
  on gate_instances(job_id, definition_key, definition_version);

commit;
