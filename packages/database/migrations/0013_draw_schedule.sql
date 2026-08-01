-- The draw schedule — PRD §9.8.
--
-- Authority: docs/decisions/construction-model.md §2, sourced from Apex's actual
-- contract and confirmed 2026-07-31. Deposit 10 / Draw 1 30 / Draw 2 30 /
-- Draw 3 20 / Final 10.
--
-- `draw_eligibility` is renamed rather than replaced. It already held every draw
-- a released Gate produced, and a second table tracking the same money is how a
-- system starts disagreeing with itself about what it is owed.
--
-- Apex OS is not a ledger and does not replace QuickBooks. It records what a
-- passed Gate makes billable and what a human said they did about it.

begin;

alter table draw_eligibility rename to job_draws;
alter table job_draws rename constraint draw_eligibility_pkey to job_draws_pkey;

-- 1. Schedule shape ----------------------------------------------------------

alter table job_draws
  add column draw_code text check (draw_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add column label text,
  add column sequence integer check (sequence is null or sequence > 0),
  -- Basis points, so 30% is 3000 and the arithmetic stays in integers. Money is
  -- never a float here.
  add column percent_basis_points integer
    check (percent_basis_points is null or (percent_basis_points > 0 and percent_basis_points <= 10000)),
  -- The Deposit is released by contract signing, not by a Gate. The schedule has
  -- to permit that or it cannot represent Apex's actual contract.
  add column release_condition text not null default 'gate'
    check (release_condition in ('contract-signed', 'gate')),
  add column gate_definition_key text,
  add column status text not null default 'eligible'
    check (status in ('scheduled', 'eligible', 'invoiced', 'paid')),
  add column invoiced_at timestamptz,
  add column invoiced_by text references app_users(user_id),
  add column due_date date,
  add column paid_at timestamptz,
  add column paid_cents bigint check (paid_cents is null or paid_cents >= 0);

-- One row per draw code per job.
create unique index job_draws_code_per_job on job_draws(job_id, draw_code)
  where draw_code is not null;

-- 2. What each status means --------------------------------------------------
--
-- A scheduled draw has not been earned yet, so it cannot carry a release time or
-- a source Gate. Everything past 'eligible' must.

alter table job_draws alter column eligible_at drop not null;

-- The table began life as a projection of Gate releases, so it demanded a source
-- Gate. A scheduled draw has not been released by anything yet, and the Deposit
-- never will be — contract signing releases it. The attribution rules below
-- replace the blanket NOT NULL with the narrower truth.
alter table job_draws alter column source_gate_instance_id drop not null;

alter table job_draws
  add constraint job_draws_scheduled_is_unreleased
  check (status <> 'scheduled' or (eligible_at is null and source_gate_instance_id is null));

alter table job_draws
  add constraint job_draws_released_has_a_time
  check (status = 'scheduled' or eligible_at is not null);

-- A Gate-released draw must name the Gate that released it. A contract-signed
-- draw must not, because no Gate released it.
alter table job_draws
  add constraint job_draws_gate_release_is_attributable
  check (
    status = 'scheduled'
    or release_condition <> 'gate'
    or source_gate_instance_id is not null
  );

alter table job_draws
  add constraint job_draws_contract_draw_has_no_gate
  check (release_condition <> 'contract-signed' or source_gate_instance_id is null);

-- Invoicing is a human act (PRD §9.8), and the record has to show who and when.
alter table job_draws
  add constraint job_draws_invoiced_is_attributable
  check (
    status not in ('invoiced', 'paid')
    or (invoiced_at is not null and invoiced_by is not null)
  );

alter table job_draws
  add constraint job_draws_paid_has_a_time
  check (status <> 'paid' or paid_at is not null);

-- 3. Backfill existing rows --------------------------------------------------
--
-- Draws already created by a released Gate keep their identity and take their
-- code from the Gate definition that produced them. Historical rows created
-- before the templates landed may carry a code outside the standard schedule;
-- that is a true record of what happened and is left alone.

update job_draws d set
  draw_code = coalesce(gd.draw_code, 'legacy-' || left(d.draw_id, 12)),
  label = gd.title,
  gate_definition_key = gi.definition_key,
  status = case when d.quickbooks_invoice_id is not null then 'invoiced' else 'eligible' end
from gate_instances gi
join gate_definitions gd
  on gd.definition_key = gi.definition_key and gd.version = gi.definition_version
where gi.gate_instance_id = d.source_gate_instance_id;

-- An invoice reference that predates this migration has no recorded author, so
-- the invoiced status above would violate its own attribution rule. Those rows
-- stay 'eligible' until a human confirms them properly.
update job_draws set status = 'eligible'
where status = 'invoiced' and (invoiced_at is null or invoiced_by is null);

-- 4. Rename the accounting link for what it is -------------------------------

alter table job_draws rename column quickbooks_invoice_id to invoice_reference;

commit;
