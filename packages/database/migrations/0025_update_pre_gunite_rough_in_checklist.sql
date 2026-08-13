-- Pre-gunite checklist update requested by field workflow.
-- Remove five checks and replace them with the requested rough-in checks.
-- Historical Gate events/evidence remain append-only and are preserved.

begin;

create temporary table pre_gunite_version_bump on commit drop as
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
       gd.release_roles, gd.countersign_roles, gd.blocks_phase_key, true
from gate_definitions gd
join pre_gunite_version_bump b
  on b.definition_key = gd.definition_key and b.from_version = gd.version;

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
)
select gr.definition_key, b.to_version, gr.requirement_key, gr.title, gr.description,
       gr.sequence, gr.evidence_required, gr.accepted_evidence_kinds, gr.evaluator_roles
from gate_requirements gr
join pre_gunite_version_bump b
  on b.definition_key = gr.definition_key and b.from_version = gr.definition_version
where gr.requirement_key not in (
  'hydrostatic-relief-installed',
  'substrate-condition',
  'crew-qualification-confirmed',
  'mix-design-confirmed',
  'anti-entrapment-installed'
);

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
)
select 'pre-gunite', b.to_version, additions.requirement_key, additions.title,
       additions.description, additions.sequence, true,
       additions.accepted_evidence_kinds, array['admin','superintendent','field']
from pre_gunite_version_bump b
cross join (values
  ('cover-box-checked', 'Cover box checked',
   'Verify the cover box is installed, accessible, and matches the approved layout.', 80,
   array['photo','measurement','document']::text[]),
  ('returns-checked', 'Returns checked',
   'Verify return locations and fittings against the approved plan before concealment.', 90,
   array['photo','measurement']::text[]),
  ('drains-checked', 'Drains checked',
   'Verify drain locations, fittings, and connections against the approved plan.', 100,
   array['photo','measurement']::text[]),
  ('skimmers-checked', 'Skimmers checked',
   'Verify skimmer locations, elevations, and connections against the approved plan.', 110,
   array['photo','measurement']::text[]),
  ('cover-box-electrical-conduit-checked', 'Cover box electrical conduit checked',
   'Verify electrical conduit serving the cover box is installed, routed, and ready for connection.', 120,
   array['photo','measurement','document']::text[])
) as additions(requirement_key, title, description, sequence, accepted_evidence_kinds);

update gate_instances gi
set definition_version = b.to_version
from pre_gunite_version_bump b
where gi.definition_key = b.definition_key
  and gi.definition_version = b.from_version
  and gi.status <> 'released';

update gate_definitions gd
set active = false
from pre_gunite_version_bump b
where gd.definition_key = b.definition_key and gd.version = b.from_version;

commit;
