-- Dry-run override: Pre-gunite uses the normal single-signature release path.
-- This is intentionally versioned so the original countersign policy remains
-- preserved on historical definition versions.

begin;

create temporary table pre_gunite_countersign_bump on commit drop as
select definition_key, version as from_version, version + 1 as to_version
from gate_definitions
where definition_key = 'pre-gunite' and active = true;

insert into gate_definitions (
  definition_key, version, title, phase, phase_key, sequence,
  draw_code, customer_milestone, customer_update_title, customer_update_summary,
  release_roles, countersign_roles, blocks_phase_key, active
)
select gd.definition_key, b.to_version, gd.title, gd.phase, gd.phase_key, gd.sequence,
       gd.draw_code, gd.customer_milestone, gd.customer_update_title, gd.customer_update_summary,
       gd.release_roles, array[]::text[], gd.blocks_phase_key, true
from gate_definitions gd
join pre_gunite_countersign_bump b
  on b.definition_key = gd.definition_key and b.from_version = gd.version;

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
)
select gr.definition_key, b.to_version, gr.requirement_key, gr.title, gr.description,
       gr.sequence, gr.evidence_required, gr.accepted_evidence_kinds, gr.evaluator_roles
from gate_requirements gr
join pre_gunite_countersign_bump b
  on b.definition_key = gr.definition_key and b.from_version = gr.definition_version;

update gate_instances gi
set definition_version = b.to_version
from pre_gunite_countersign_bump b
where gi.definition_key = b.definition_key
  and gi.definition_version = b.from_version
  and gi.status <> 'released';

update gate_definitions gd
set active = false
from pre_gunite_countersign_bump b
where gd.definition_key = b.definition_key and gd.version = b.from_version;

commit;
