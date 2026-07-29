begin;

insert into gate_definitions
  (definition_key, version, title, phase, draw_code, customer_milestone, active)
values
  ('pre-gunite', 1, 'Pre-gunite release', 'pre-gunite', 'pre-gunite-draw', 'pre-gunite-released', true)
on conflict (definition_key, version) do update set
  title = excluded.title,
  phase = excluded.phase,
  draw_code = excluded.draw_code,
  customer_milestone = excluded.customer_milestone,
  active = excluded.active;

insert into gate_requirements
  (definition_key, definition_version, requirement_key, title, description, sequence, evidence_required, accepted_evidence_kinds, evaluator_roles)
values
  ('pre-gunite', 1, 'approved-plan-on-site', 'Approved plan on site', 'Confirm the field team is building from the approved plan and takeoff revision linked to this Gate.', 10, true, array['photo','document'], array['field','admin']),
  ('pre-gunite', 1, 'shell-dimensions', 'Shell dimensions verified', 'Record shell dimensions and depths against the approved revision before concealment.', 20, true, array['photo','measurement'], array['field','admin']),
  ('pre-gunite', 1, 'steel-spacing', 'Steel spacing verified', 'Document reinforcing placement and spacing required by the approved detail.', 30, true, array['photo','measurement'], array['field','admin']),
  ('pre-gunite', 1, 'bonding', 'Bonding verified', 'Document the bonding inspection or authorized verification before gunite.', 40, true, array['photo','inspection','document'], array['field','admin']),
  ('pre-gunite', 1, 'plumbing-pressure-test', 'Plumbing pressure test verified', 'Record the pressure-test result and supporting gauge evidence.', 50, true, array['photo','measurement','inspection'], array['field','admin'])
on conflict (definition_key, definition_version, requirement_key) do update set
  title = excluded.title,
  description = excluded.description,
  sequence = excluded.sequence,
  evidence_required = excluded.evidence_required,
  accepted_evidence_kinds = excluded.accepted_evidence_kinds,
  evaluator_roles = excluded.evaluator_roles;

commit;
