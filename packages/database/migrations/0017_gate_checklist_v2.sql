-- Gate checklists, next version — PRD §9.4.
--
-- Source: docs/inspections-and-gate-checklists-2026-08-03.md, proposed 2026-08-03
-- and pending Travis's approval. Corrections land as a further version; nothing
-- here rewrites a Gate that has already been passed.
--
-- Eleven items are added across all seven Gates. Two of them are the reason this
-- migration is not cosmetic:
--
--   · Anti-entrapment (VGB-compliant) outlet covers appeared on no checklist at
--     all. Suction entrapment is the failure mode the federal Virginia Graeme
--     Baker Act exists to prevent, and ISPSC §310 requires compliant covers on
--     every suction outlet. It is added TWICE — at pre-gunite, because the
--     outlet is buried by the shell and cannot be verified afterwards, and at
--     final, because covers get swapped.
--   · Safety barrier, gates, and alarms (ISPSC §305) also appeared nowhere. A
--     pool could pass every Gate in Apex OS and be handed over with no compliant
--     barrier, and nothing would have noticed.
--
-- The other nine are quality items, each one a callback Apex would otherwise
-- absorb.

begin;

-- 1. Copy every active definition forward ------------------------------------
--
-- Copied by select rather than retyped, so a column added by a later migration
-- travels with the definition instead of silently reverting to its default.

create temporary table gate_version_bump on commit drop as
select definition_key, version as from_version, version + 1 as to_version
from gate_definitions
where active = true;

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
  on b.definition_key = gr.definition_key and b.from_version = gr.definition_version;

-- 2. The eleven additions ----------------------------------------------------
--
-- `sequence` values continue the existing spacing so a later insertion between
-- two items does not need a renumber.

insert into gate_requirements (
  definition_key, definition_version, requirement_key, title, description,
  sequence, evidence_required, accepted_evidence_kinds, evaluator_roles
)
select a.definition_key, b.to_version, a.requirement_key, a.title, a.description,
       a.sequence, a.evidence_required, a.accepted_evidence_kinds, a.evaluator_roles
from (values
  -- Permit. Not a code item. It is here because a permitted Lubbock pool job
  -- stopping on an HOA or deed restriction is a real and recurring stall, and
  -- the Permit gate is the last point before anybody mobilises.
  ('permit', 'hoa-approval-on-file', 'HOA or deed-restriction approval on file',
   'Attach the HOA or deed-restriction approval, or record that the property has none.',
   40, true, array['document','photo'], array['admin','superintendent','office']),

  -- Excavation. Caliche and expansive clay are local facts, and the shell is
  -- engineered against an assumption about what it bears on.
  ('excavation', 'soil-bearing-acceptable', 'Soil and bearing condition acceptable',
   'Record the excavated soil condition and confirm it matches what the shell was engineered against.',
   50, true, array['photo','measurement','document'], array['admin','superintendent','field']),
  -- An open hole on a residential lot between the dig and the steel is a
  -- liability with no current record anywhere in the system.
  ('excavation', 'excavation-secured', 'Open excavation secured',
   'Document how the open excavation is secured against entry outside working hours.',
   60, true, array['photo'], array['admin','superintendent','field']),

  -- Pre-gunite. See the header: this is the one that must not wait.
  ('pre-gunite', 'anti-entrapment-installed', 'Suction outlets and anti-entrapment covers installed',
   'Document each suction outlet and its VGB-compliant cover before the shell conceals the plumbing.',
   120, true, array['photo','document'], array['admin','superintendent','field']),

  -- Shell. Both are defects that become invisible and then expensive.
  ('shell', 'rebound-removed', 'Rebound and trimmings removed',
   'Document that rebound and trimmings were removed rather than worked back into the shell.',
   40, true, array['photo'], array['admin','superintendent','field']),
  ('shell', 'bond-beam-elevation', 'Bond beam elevation verified',
   'Record the bond beam elevation against the plan before tile is set against it.',
   50, true, array['photo','measurement'], array['admin','superintendent','field']),

  -- Deck & tile.
  ('deck-tile', 'deck-drainage-verified', 'Deck drains and slopes away from the pool',
   'Document deck drainage and that finished surfaces fall away from the water.',
   50, true, array['photo','measurement'], array['admin','superintendent','field']),
  ('deck-tile', 'expansion-joint-verified', 'Expansion joint at coping verified',
   'Document the expansion joint between the deck and the coping.',
   60, true, array['photo'], array['admin','superintendent','field']),

  -- Equipment. The heater item applies only where gas heat is fitted; the
  -- requirement records why not, rather than being silently skipped.
  ('equipment', 'heater-clearances-verified', 'Heater clearances and venting verified',
   'Document heater clearances and venting against the manufacturer requirement, or record that no gas heater is fitted.',
   50, true, array['photo','document'], array['admin','superintendent','field']),
  ('equipment', 'equipment-pad-labelled', 'Equipment pad labelled',
   'Document valve and disconnect labelling at the pad. The customer operates this for twenty years.',
   60, true, array['photo'], array['admin','superintendent','field']),

  -- Final. The barrier is what the final inspection turns on, and the covers
  -- fitted at the end are the ones the customer swims over.
  ('final', 'anti-entrapment-verified', 'Anti-entrapment covers verified',
   'Confirm the installed suction outlet covers are VGB-compliant, unbroken, and correctly fastened.',
   60, true, array['photo','document'], array['admin','superintendent','field']),
  ('final', 'safety-barrier-verified', 'Safety barrier, gates, and alarms verified',
   'Document barrier height and openings, self-closing and self-latching gates, and any required door or gate alarms.',
   70, true, array['photo','document','inspection'], array['admin','superintendent','field'])
) as a (definition_key, requirement_key, title, description, sequence,
        evidence_required, accepted_evidence_kinds, evaluator_roles)
join gate_version_bump b on b.definition_key = a.definition_key;

-- 3. Retire the superseded versions ------------------------------------------
--
-- Deactivated, never deleted. A Gate instance already running against an older
-- version keeps its own checklist; superseding a definition must never rewrite
-- what a field lead was actually asked for at the time.

update gate_definitions gd
set active = false
from gate_version_bump b
where gd.definition_key = b.definition_key and gd.version = b.from_version;

commit;
