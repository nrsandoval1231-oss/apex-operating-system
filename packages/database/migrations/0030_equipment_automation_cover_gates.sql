begin;

-- Extend the reference phase model without changing historical phase keys.
drop trigger construction_phases_fixed on construction_phases;
alter table construction_phases drop constraint construction_phases_sequence_check;
alter table construction_phases add constraint construction_phases_sequence_check check (sequence between 1 and 11);
update construction_phases set sequence = 11 where phase_key = 'plaster-fill';
insert into construction_phases (phase_key, sequence, title, customer_milestone) values
  ('automation-programming', 9, 'Automation Programming', 'water'),
  ('cover-install', 10, 'Automatic Cover Installation', 'water');
create trigger construction_phases_fixed
before insert or update or delete on construction_phases
for each row execute function refuse_reference_mutation();

-- The original Equipment Gate remains the equipment completion check; the new
-- automation Gate is the final control inside the equipment phase. The new Cover
-- phase then precedes the existing final plaster/fill phase.
update gate_definitions set sequence = 9, blocks_phase_key = 'plaster-fill'
where definition_key = 'final' and active = true;
update gate_definitions set blocks_phase_key = 'automation-programming'
where definition_key = 'equipment' and active = true;
update gate_definitions set blocks_phase_key = 'cover-install'
where definition_key = 'automation-programming-complete' and active = true;
update gate_definitions set blocks_phase_key = 'plaster-fill'
where definition_key = 'cover-install' and active = true;

-- Existing historical definitions remain unchanged. These are new active Gates.
insert into gate_definitions (
  definition_key, version, title, phase, phase_key, sequence,
  draw_code, customer_milestone, customer_update_title, customer_update_summary,
  release_roles, countersign_roles, active, blocks_phase_key
) values
  ('automation-programming-complete', 1, 'Automation Programming Complete', 'equipment-hookup', 'equipment-hookup', 7,
   null, 'water', 'Automation programmed and tested', 'Pool automation has been programmed and tested against the installed equipment.',
   array['admin','superintendent'], array[]::text[], true, 'automation-programming'),
  ('cover-install', 1, 'Install Cover', 'cover-install', 'cover-install', 8,
   null, 'water', 'Automatic cover installed', 'The automatic cover has been installed, adjusted, and tested.',
   array['admin','superintendent'], array[]::text[], true, 'cover-install')
 on conflict (definition_key, version) do nothing;

-- The original Equipment Gate remains the end-of-equipment verification.
-- Automation is an additional Gate in that phase; Cover Install is its own phase.

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
) values
  ('automation-programming-complete', 1, 'automation-programmed', 'Automation programmed to approved configuration', 'Record that the installed automation is programmed to the approved configuration.', 10, true, array['photo','document','measurement'], array['admin','superintendent','field']),
  ('automation-programming-complete', 1, 'automation-modes-tested', 'Automation modes tested', 'Record successful testing of circulation, lighting, heating, and configured water features.', 20, true, array['photo','measurement','document'], array['admin','superintendent','field']),
  ('cover-install', 1, 'cover-installed', 'Automatic cover installed', 'Record installation of the cover, guides, box, and related hardware.', 10, true, array['photo','document'], array['admin','superintendent','field']),
  ('cover-install', 1, 'cover-operation-tested', 'Cover operation tested', 'Record open, close, stop, and safety operation tests.', 20, true, array['photo','measurement','document'], array['admin','superintendent','field'])
 on conflict (definition_key, definition_version, requirement_key) do nothing;

commit;
