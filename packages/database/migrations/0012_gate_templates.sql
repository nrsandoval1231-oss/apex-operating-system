-- The seven confirmed Gate templates.
--
-- Authority for the gates themselves — position, draw, and who signs — is
-- docs/decisions/construction-model.md §3, confirmed 2026-07-31.
--
-- READ THIS BEFORE FIELD USE
-- ==========================
-- The decision document gives one line of "Verifies" per gate. It does not give
-- checklists. Every requirement below except pre-gunite's was written from that
-- line plus the draw schedule's "Covers" column. They are a starting point for
-- Apex to correct, not Apex's own procedure.
--
-- Pre-gunite is the exception: its eleven requirements come from the explicit
-- baseline in PRD §9.4, and it moves to version 2 here. Version 1 stays in place
-- so Gates already run against it keep their meaning — that is what versioned
-- definitions are for. Correcting any other checklist means a new version, not
-- an edit.

begin;

-- 1. Definition metadata -----------------------------------------------------

alter table gate_definitions
  add column sequence integer check (sequence is null or sequence > 0),
  -- Plain-language text published to the customer when this Gate releases.
  -- Previously hardcoded to pre-gunite inside the service.
  add column customer_update_title text check (customer_update_title is null or length(trim(customer_update_title)) > 0),
  add column customer_update_summary text check (customer_update_summary is null or length(trim(customer_update_summary)) > 0);

-- Version 1 of pre-gunite predates all of this, and its `customer_milestone`
-- held 'pre-gunite-released' — a value outside the six confirmed customer
-- milestones. Correct it before the constraint below can be enforced. Gates
-- already running on version 1 keep working and now publish the same wording as
-- version 2.
update gate_definitions set
  sequence = 3,
  phase_key = 'gunite',
  customer_milestone = 'shell',
  customer_update_title = 'Ready for the concrete shell',
  customer_update_summary = 'Steel, plumbing, and electrical rough-in passed inspection. The shell is scheduled.'
where definition_key = 'pre-gunite' and version = 1;

-- 2. The seven templates -----------------------------------------------------
--
-- Every gate takes one signature from the owner or a superintendent. Pre-gunite
-- takes both, because gunite buries its own evidence.

insert into gate_definitions (
  definition_key, version, title, phase, phase_key, sequence,
  draw_code, customer_milestone, customer_update_title, customer_update_summary,
  release_roles, countersign_roles, active
) values
  ('permit', 1, 'Permit', 'design-permitting', 'design-permitting', 1,
   null, 'design',
   'Design approved and permitted',
   'Your engineered plans are approved and the permit is issued. Site work can be scheduled.',
   array['admin','superintendent'], array[]::text[], true),

  ('excavation', 1, 'Excavation', 'layout-excavation', 'layout-excavation', 2,
   'draw-1', 'excavation',
   'Excavation complete',
   'The pool is laid out and excavated to the approved plan. Steel goes in next.',
   array['admin','superintendent'], array[]::text[], true),

  ('pre-gunite', 2, 'Pre-gunite hold point', 'gunite', 'gunite', 3,
   null, 'shell',
   'Ready for the concrete shell',
   'Steel, plumbing, and electrical rough-in passed inspection. The shell is scheduled.',
   array['admin','superintendent'], array['admin'], true),

  ('shell', 1, 'Shell', 'gunite', 'gunite', 4,
   'draw-2', 'shell',
   'Concrete shell complete',
   'The shell is placed and curing. Tile and coping follow once it has cured.',
   array['admin','superintendent'], array[]::text[], true),

  ('deck-tile', 1, 'Deck & tile', 'decking', 'decking', 5,
   'draw-3', 'finishes',
   'Tile, coping, and decking complete',
   'Waterline tile, coping, and the patio deck are installed. Equipment is next.',
   array['admin','superintendent'], array[]::text[], true),

  ('equipment', 1, 'Equipment', 'equipment-hookup', 'equipment-hookup', 6,
   null, 'water',
   'Equipment set and running',
   'The equipment pad is plumbed, wired, and running. Interior finish and fill come next.',
   array['admin','superintendent'], array[]::text[], true),

  ('final', 1, 'Final', 'plaster-fill', 'plaster-fill', 7,
   'draw-final', 'water',
   'Interior finish complete and filled',
   'The interior finish is complete and the pool is filled and commissioned.',
   array['admin','superintendent'], array[]::text[], true)
on conflict (definition_key, version) do nothing;

-- Version 1 of pre-gunite stops being offered for new Gates. Existing instances
-- keep running against it; superseding a definition must never rewrite history.
update gate_definitions set active = false where definition_key = 'pre-gunite' and version = 1;

-- A Gate that maps a customer milestone must say what the customer is told.
-- Added after the rows above so it is enforced against a corrected table.
alter table gate_definitions
  add constraint gate_definitions_customer_update_is_complete
  check (
    customer_milestone is null
    or (customer_update_title is not null and customer_update_summary is not null)
  );

-- 3. Requirements ------------------------------------------------------------

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
) values
  -- Permit — end of Phase 1. Locates belong here because they must exist before
  -- anyone digs, and the excavation gate is only reached after digging.
  ('permit', 1, 'engineered-plans-approved', 'Engineered plans approved', 'Attach the approved engineered plan set for this pool.', 10, true, array['document','photo'], array['admin','superintendent','office']),
  ('permit', 1, 'permit-issued', 'Permit issued', 'Attach the issued building permit.', 20, true, array['document','photo'], array['admin','superintendent','office']),
  ('permit', 1, 'utility-locates-cleared', 'Utility locates cleared', 'Confirm utility locates were requested and marked before any excavation.', 30, true, array['document','photo'], array['admin','superintendent','field']),

  -- Excavation — end of Phase 2. Releases Draw 1, which funds the steel that
  -- goes in next. This is the one draw that pays ahead of verified work.
  ('excavation', 1, 'layout-verified', 'Layout verified against plan', 'Verify pool position, orientation, and setbacks against the approved plan.', 10, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('excavation', 1, 'depths-verified', 'Depths verified against plan', 'Record excavated depths at the shallow end, transition, and deep end.', 20, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('excavation', 1, 'dimensions-verified', 'Dimensions verified against plan', 'Record excavated length, width, and any spa or bench dimensions.', 30, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('excavation', 1, 'spoil-handled', 'Spoil handled', 'Record that spoil was hauled or stockpiled as planned and the site is workable.', 40, true, array['photo'], array['admin','superintendent','field']),

  -- Pre-gunite v2 — PRD §9.4 baseline. The one irreversible hold point.
  -- The PRD's twelfth item, "required photos attached", is not a checklist item
  -- here: every requirement below already carries its own evidence requirement,
  -- so a separate photo checkbox would be a second place for the same fact.
  ('pre-gunite', 2, 'layout-dimensions-reverified', 'Layout and dimensions reverified', 'Reverify layout and dimensions against the approved plan before anything is concealed.', 10, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'depths-and-spa-verified', 'Depths and spa dimensions match plan', 'Verify depths and any spa dimensions against the approved plan.', 20, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'steel-placement-verified', 'Steel size, spacing, cover, laps, and chairs verified', 'Document reinforcing size, spacing, concrete cover, lap lengths, and chair support.', 30, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'structural-details-verified', 'Lowered sections and structural details verified', 'Document lowered sections, benches, steps, and any engineered structural detail.', 40, true, array['photo','measurement','document'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'plumbing-pressure-test', 'Plumbing pressure test recorded', 'Record the pressure-test result with supporting gauge evidence.', 50, true, array['photo','measurement','inspection'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'electrical-bonding-verified', 'Electrical niches and bonding verified', 'Document light niches, conduit, and the bonding grid before concealment.', 60, true, array['photo','inspection','document'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'equipment-pad-alignment', 'Equipment vault / pad alignment verified', 'Verify the equipment pad or vault location and its plumbing runs against the plan.', 70, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'hydrostatic-relief-installed', 'Hydrostatic relief installed where required', 'Document the hydrostatic relief valve, or record why the plan does not require one.', 80, true, array['photo','document'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'substrate-condition', 'Substrate condition acceptable', 'Record that the substrate is clean, stable, and ready to receive gunite.', 90, true, array['photo'], array['admin','superintendent','field']),
  ('pre-gunite', 2, 'crew-qualification-confirmed', 'Nozzleman / crew qualification confirmed', 'Record the placing crew and confirm the nozzleman qualification for this pour.', 100, true, array['document','photo'], array['admin','superintendent']),
  ('pre-gunite', 2, 'mix-design-confirmed', 'Mix design / strength confirmed', 'Attach the mix design or ticket confirming the specified strength.', 110, true, array['document','photo'], array['admin','superintendent']),

  -- Shell — end of Phase 5. Releases Draw 2.
  ('shell', 1, 'gunite-placed', 'Gunite placed to plan', 'Document the placed shell against the plan profile and thickness.', 10, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('shell', 1, 'shell-dimensions-verified', 'Shell dimensions verified', 'Record finished shell dimensions and depths after placement.', 20, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('shell', 1, 'cure-started', 'Curing started and recorded', 'Record that curing began, and how the shell is being kept wet.', 30, true, array['photo','document'], array['admin','superintendent','field']),

  -- Deck & tile — end of Phase 7. Releases Draw 3.
  ('deck-tile', 1, 'waterline-tile-complete', 'Waterline tile complete', 'Document the installed waterline tile.', 10, true, array['photo'], array['admin','superintendent','field']),
  ('deck-tile', 1, 'coping-set', 'Coping set', 'Document the set coping.', 20, true, array['photo'], array['admin','superintendent','field']),
  ('deck-tile', 1, 'decking-complete', 'Patio decking complete', 'Document the finished patio deck and hardscape.', 30, true, array['photo'], array['admin','superintendent','field']),
  ('deck-tile', 1, 'selections-match', 'Installed materials match customer selections', 'Confirm the installed tile, coping, and decking match the recorded customer selections.', 40, true, array['photo','document'], array['admin','superintendent','office']),

  -- Equipment — end of Phase 8.
  ('equipment', 1, 'equipment-set-and-plumbed', 'Equipment set and plumbed', 'Document the equipment set on the pad and plumbed per plan.', 10, true, array['photo'], array['admin','superintendent','field']),
  ('equipment', 1, 'electrical-connected-and-bonded', 'Electrical connected and bonded', 'Document the electrical connection and equipment bonding.', 20, true, array['photo','inspection','document'], array['admin','superintendent','field']),
  ('equipment', 1, 'leak-check-passed', 'Pressure and leak check passed', 'Record the system pressure or leak check result.', 30, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('equipment', 1, 'system-runs', 'System runs through its modes', 'Record that circulation, filtration, and any features run as intended.', 40, true, array['photo','measurement'], array['admin','superintendent','field']),

  -- Final — end of Phase 9. Releases the Final Draw.
  ('final', 1, 'interior-finish-complete', 'Interior finish complete', 'Document the completed plaster or pebble interior.', 10, true, array['photo'], array['admin','superintendent','field']),
  ('final', 1, 'fill-complete', 'Fill complete', 'Document the pool filled to its operating level.', 20, true, array['photo'], array['admin','superintendent','field']),
  ('final', 1, 'commissioned', 'Equipment commissioned', 'Record commissioning of the equipment and controls after fill.', 30, true, array['photo','document'], array['admin','superintendent','field']),
  -- Deliberately a record of what was done, not a chemistry recommendation.
  -- Chemistry guidance is held out of field deployment (docs/status.md).
  ('final', 1, 'startup-recorded', 'Startup recorded', 'Attach the startup record for this pool. This Gate records what was done; it does not provide dosing guidance.', 40, true, array['document','photo','measurement'], array['admin','superintendent','field']),
  ('final', 1, 'customer-walkthrough', 'Customer walkthrough completed', 'Record the customer walkthrough and handover of operating instructions.', 50, true, array['document','photo'], array['admin','superintendent','office'])
on conflict (definition_key, definition_version, requirement_key) do nothing;

commit;
