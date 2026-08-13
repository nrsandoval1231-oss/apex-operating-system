-- Excavation checklist simplification.
--
-- Remove the redundant "Spoil handled" and "Soil bearing acceptable" items
-- from the active Excavation Gate. Historical Gate instances and their
-- evaluations remain untouched because definitions are versioned, not rewritten.
-- The excavation Gate still keeps layout, depths, dimensions, and any future
-- authoritative safety/inspection controls.

begin;

create temporary table gate_version_bump on commit drop as
select definition_key, version as from_version, version + 1 as to_version
from gate_definitions
where definition_key = 'excavation' and active = true;

insert into gate_definitions (
  definition_key, version, title, phase, phase_key, sequence,
  draw_code, customer_milestone, customer_update_title, customer_update_summary,
  release_roles, countersign_roles, blocks_phase_key, active
)
select gd.definition_key, b.to_version, gd.title, gd.phase, gd.phase_key, gd.sequence,
       gd.draw_code, gd.customer_milestone, gd.customer_update_title, gd.customer_update_summary,
       gd.release_roles, gd.countersign_roles, gd.blocks_phase_key, true
from gate_definitions gd
join gate_version_bump b
  on b.definition_key = gd.definition_key and b.from_version = gd.version;

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
)
select gr.definition_key, b.to_version, gr.requirement_key, gr.title, gr.description,
       gr.sequence, gr.evidence_required, gr.accepted_evidence_kinds, gr.evaluator_roles
from gate_requirements gr
join gate_version_bump b
  on b.definition_key = gr.definition_key and b.from_version = gr.definition_version
where not (
  gr.definition_key = 'excavation'
  and gr.requirement_key in ('spoil-handled', 'soil-bearing-acceptable')
);

update gate_instances gi
set definition_version = b.to_version
from gate_version_bump b
where gi.definition_key = b.definition_key
  and gi.definition_version = b.from_version
  and gi.definition_key = 'excavation'
  and gi.status <> 'released';

update gate_definitions gd
set active = false
from gate_version_bump b
where gd.definition_key = b.definition_key and gd.version = b.from_version;

commit;
