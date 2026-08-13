begin;

-- Countersign is removed from the active workflow. Historical definitions,
-- signoff/countersign events, and append-only audit records remain intact.
update gate_definitions
set countersign_roles = array[]::text[];

-- Any active operational Gate that was waiting on the retired second approval
-- is returned to the normal in-progress state. No events or evaluations are
-- deleted.
update gate_instances
set status = 'in-progress', signed_by = null, signed_at = null
where status = 'awaiting-countersign';

commit;
