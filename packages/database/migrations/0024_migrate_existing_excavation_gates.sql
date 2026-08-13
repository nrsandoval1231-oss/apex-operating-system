-- Move existing Excavation Gate instances to the simplified active checklist.
-- The Gate status and historical events remain intact; only the definition
-- version used to render the current checklist changes.

begin;

update gate_instances gi
set definition_version = active.version
from gate_definitions active
where gi.definition_key = 'excavation'
  and active.definition_key = 'excavation'
  and active.active = true
  and gi.definition_version <> active.version;

commit;
