-- Repair older open Pre-gunite dry-run instances that were created before the
-- checklist revisions. Historical events remain append-only; the active Gate
-- instance is moved to the current definition so the dry run can continue.

begin;

update gate_instances gi
set definition_version = active.version
from gate_definitions active
where gi.definition_key = 'pre-gunite'
  and active.definition_key = 'pre-gunite'
  and active.active = true
  and gi.status <> 'released'
  and gi.definition_version < active.version;

commit;
