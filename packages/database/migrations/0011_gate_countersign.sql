-- Two-signature Gate release, and delegation of the money gates.
--
-- Authority: Nick Sandoval, 2026-07-31, resolving the two open flags in §5 of
-- docs/decisions/construction-model.md.
--
--   §5.1 Irreversibility vs. financial consequence — RESOLVED. Pre-gunite now
--        requires an owner countersign. Authority follows what cannot be undone,
--        not what can be credited.
--   §5.2 Single-authority stall risk — RESOLVED. The four draw-bearing gates may
--        be released by the owner OR a superintendent, so draws no longer stall
--        while the owner is unavailable.
--
-- Net effect: the superintendent can release any gate on his own EXCEPT the one
-- that puts concrete over work nobody can inspect again.

begin;

-- 1. Countersign requirement, per Gate definition ----------------------------
--
-- Empty means single-signature, which is every gate but pre-gunite. The
-- countersign blocks the release; it is not a confirmation recorded afterwards.
-- A confirmation that arrives after the pour protects nothing.

alter table gate_definitions
  add column countersign_roles text[] not null default array[]::text[];

alter table gate_definitions
  add constraint gate_definitions_countersign_roles_valid
  check (countersign_roles <@ array['admin', 'superintendent']::text[]);

-- A definition whose countersign role is also its only release role would be
-- unsatisfiable, because one person may not sign both slots.
alter table gate_definitions
  add constraint gate_definitions_countersign_is_reachable
  -- `release_roles <@ countersign_roles` means every release role is also a
  -- countersign role, which leaves nobody able to sign first.
  check (
    cardinality(countersign_roles) = 0
    or not (release_roles <@ countersign_roles)
  );

update gate_definitions
  set countersign_roles = array['admin']::text[]
  where definition_key = 'pre-gunite';

-- 2. Gate instance sign-off state -------------------------------------------

alter table gate_instances drop constraint gate_instances_status_check;
alter table gate_instances add constraint gate_instances_status_check
  check (status in ('not-started', 'in-progress', 'blocked', 'awaiting-countersign', 'released'));

alter table gate_instances
  add column signed_by text references app_users(user_id),
  add column signed_at timestamptz;

-- The countersigner must be a different human. Enforced here as well as in the
-- domain: an authority control that lives only in application code is one
-- refactor away from not existing.
alter table gate_instances
  add constraint gate_instances_countersign_is_a_second_person
  check (released_by is null or signed_by is null or released_by <> signed_by);

alter table gate_instances
  add constraint gate_instances_awaiting_countersign_is_signed
  check (status <> 'awaiting-countersign' or (signed_by is not null and signed_at is not null));

commit;
