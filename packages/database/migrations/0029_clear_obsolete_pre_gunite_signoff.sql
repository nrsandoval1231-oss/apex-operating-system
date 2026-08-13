-- Clear obsolete first-signature fields from migrated single-signature
-- Pre-gunite dry runs. The original signoff event remains append-only history.

begin;

update gate_instances gi
set signed_by = null,
    signed_at = null
from gate_definitions active
where gi.definition_key = 'pre-gunite'
  and active.definition_key = 'pre-gunite'
  and active.active = true
  and gi.definition_version = active.version
  and gi.status = 'in-progress'
  and gi.signed_by is not null;

commit;
