-- Align the operational status of migrated open Pre-gunite dry-run instances
-- with the current single-signature definition. Historical events remain intact.

begin;

update gate_instances gi
set status = 'in-progress'
from gate_definitions active
where gi.definition_key = 'pre-gunite'
  and active.definition_key = 'pre-gunite'
  and active.active = true
  and gi.definition_version = active.version
  and gi.status = 'awaiting-countersign';

commit;
