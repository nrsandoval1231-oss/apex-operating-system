import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { GateService } from './index.js';

/**
 * The draw schedule over real persisted state — PRD §9.8.
 *
 * The arithmetic is unit-tested in @apex/domain. What matters here is that money
 * is recorded once, released by the right Gate, and never billed by the system
 * on its own.
 */

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  proposal: createCanonicalId('proposal'),
  proposalVersion: createCanonicalId('proposal_version'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };
const CONTRACT_CENTS = 15_204_173;
const at = '2026-07-29T12:00:00.000Z';

let db: PGlite;
let service: GateService;

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name) values
     ($1, '00000000-0000-0000-0000-000000000001', 'admin', 'Travis'),
     ($2, '00000000-0000-0000-0000-000000000002', 'superintendent', 'Site Super'),
     ($3, '00000000-0000-0000-0000-000000000003', 'office', 'Office User')`,
    [ids.owner, ids.superintendent, ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-draws', 'test:source-draws', '{"customerName":"Whitaker Oasis"}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  await db.query(
    `insert into takeoff_revisions
     (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
    [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
  );
  service = new GateService(db);
});

/** Sign a proposal so the job has a contract total to divide. */
const signContract = async (totalCents = CONTRACT_CENTS) => {
  await db.query(`insert into proposals (proposal_id, lead_id, current_version) values ($1, $2, 1)`,
    [ids.proposal, ids.lead]);
  await db.query(
    `insert into proposal_versions
     (proposal_version_id, proposal_id, lead_id, job_id, version_number, status, takeoff_revision_id,
      quantity_payload_sha256, quantity_model_version, pricing_library_version, proposal_payload_sha256,
      proposal_payload, total_cents, created_by, created_at, issued_at, issued_by)
     values ($1, $2, $3, null, 1, 'issued', $4, repeat('c', 64), 'quantity-v1', 'pricing-v1',
             repeat('d', 64), '{}', $5, $6, now(), now(), $6)`,
    [ids.proposalVersion, ids.proposal, ids.lead, ids.revision, totalCents, ids.office],
  );
  await db.query(
    `update proposal_versions set status = 'signed', signed_at = now(), job_id = $1
     where proposal_version_id = $2`,
    [ids.job, ids.proposalVersion],
  );
};

const createSchedule = () =>
  service.createDrawSchedule({ jobId: ids.job, actor: owner, idempotencyKey: 'create-schedule-1' });

/** Take a Gate all the way to release. */
const releaseGate = async (definitionKey: string) => {
  const opened = await service.createGate({
    gateInstanceId: createCanonicalId('gate'), jobId: ids.job, definitionKey,
  });
  const gateInstanceId = opened.gateInstanceId;
  await service.execute(gateInstanceId, { type: 'start-gate', actor: superintendent, at }, { idempotencyKey: `s-${definitionKey}` });
  for (const requirement of (await service.getGate(gateInstanceId)).requirements.values()) {
    const evidenceId = createCanonicalId('evidence');
    const kind = requirement.acceptedEvidenceKinds[0]!;
    await service.execute(gateInstanceId, {
      type: 'add-evidence', actor: superintendent, at, requirementKey: requirement.key, evidenceId, kind,
    }, {
      idempotencyKey: `e-${definitionKey}-${requirement.key}`,
      evidence: {
        evidenceId, requirementKey: requirement.key, kind,
        storageKey: `${ids.job}/${definitionKey}/${requirement.key}.bin`,
        sha256: 'd'.repeat(64), capturedAt: at, mimeType: 'image/jpeg', byteSize: 64, metadata: {},
      },
    });
    await service.execute(gateInstanceId, {
      type: 'evaluate-requirement', actor: superintendent, at, requirementKey: requirement.key, outcome: 'passed',
    }, { idempotencyKey: `p-${definitionKey}-${requirement.key}` });
  }
  await service.execute(gateInstanceId, { type: 'release-gate', actor: superintendent, at }, { idempotencyKey: `r-${definitionKey}` });
  return gateInstanceId;
};

describe('creating the schedule', () => {
  it('divides the signed contract into the confirmed five draws', async () => {
    await signContract();
    const schedule = await createSchedule();

    expect(schedule.contractCents).toBe(CONTRACT_CENTS);
    expect(schedule.draws.map((draw) => [draw.drawCode, draw.amountCents])).toEqual([
      ['deposit', 1_520_417],
      ['draw-1', 4_561_251],
      ['draw-2', 4_561_251],
      ['draw-3', 3_040_834],
      ['draw-final', 1_520_420],
    ]);
    // The whole contract, to the cent.
    expect(schedule.draws.reduce((sum, draw) => sum + (draw.amountCents ?? 0), 0)).toBe(CONTRACT_CENTS);
  });

  it('makes the deposit billable at once and leaves the rest unearned', async () => {
    await signContract();
    const schedule = await createSchedule();
    expect(schedule.draws.map((draw) => draw.status)).toEqual([
      'eligible', 'scheduled', 'scheduled', 'scheduled', 'scheduled',
    ]);
    expect(schedule.eligibleUnbilledCents).toBe(1_520_417);
  });

  it('is idempotent — a job keeps the schedule it already has', async () => {
    await signContract();
    const first = await createSchedule();
    const second = await service.createDrawSchedule({
      jobId: ids.job, actor: owner, idempotencyKey: 'a-different-key',
    });
    expect(second.draws.map((draw) => draw.drawId)).toEqual(first.draws.map((draw) => draw.drawId));
  });

  it('adopts draws a job already released before it had a schedule', async () => {
    // The realistic case: Apex OS arrives on a job that is already mid-build.
    await releaseGate('excavation');
    await signContract();
    const schedule = await createSchedule();

    expect(schedule.draws).toHaveLength(5);
    const drawOne = schedule.draws.find((draw) => draw.drawCode === 'draw-1');
    // The release is preserved, and the amount it was always worth is filled in.
    expect(drawOne).toMatchObject({ status: 'eligible', amountCents: 4_561_251 });
    expect(drawOne?.sourceGateInstanceId).not.toBeNull();
    expect(schedule.draws.reduce((sum, draw) => sum + (draw.amountCents ?? 0), 0)).toBe(CONTRACT_CENTS);
  });

  it('never moves money that has already been billed', async () => {
    await signContract();
    await createSchedule();
    await service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-1041', actor: owner,
    });
    // Regenerating against a different total must not rewrite an issued invoice.
    await db.query(`update proposal_versions set total_cents = 20_000_000 where job_id = $1`, [ids.job])
      .catch(() => undefined);
    await service.createDrawSchedule({ jobId: ids.job, actor: owner, idempotencyKey: 'regenerate-1' });

    const schedule = await service.getDrawSchedule(ids.job);
    expect(schedule.draws.find((draw) => draw.drawCode === 'deposit'))
      .toMatchObject({ status: 'invoiced', amountCents: 1_520_417 });
  });

  it('refuses without a signed contract total to divide', async () => {
    await expect(createSchedule()).rejects.toThrow(/signed contract total/i);
  });

  it('is closed to the field and the superintendent', async () => {
    await signContract();
    for (const actor of [superintendent, { kind: 'user' as const, userId: ids.office, role: 'field' as const }]) {
      await expect(service.createDrawSchedule({ jobId: ids.job, actor, idempotencyKey: 'k1' }))
        .rejects.toThrow(/may not create a draw schedule/i);
    }
  });
});

describe('a gate releasing its draw', () => {
  beforeEach(async () => {
    await signContract();
    await createSchedule();
  });

  it('makes exactly the scheduled draw billable, with its amount', async () => {
    await releaseGate('excavation');
    const schedule = await service.getDrawSchedule(ids.job);
    const drawOne = schedule.draws.find((draw) => draw.drawCode === 'draw-1');
    expect(drawOne).toMatchObject({ status: 'eligible', amountCents: 4_561_251 });
    expect(drawOne?.sourceGateInstanceId).not.toBeNull();
  });

  it('records the money once, not twice', async () => {
    await releaseGate('excavation');
    const rows = await db.query<{ count: string }>(
      `select count(*) as count from job_draws where job_id = $1`, [ids.job],
    );
    // Still the five scheduled draws — no parallel row for the same money.
    expect(Number(rows.rows[0]?.count)).toBe(5);
  });

  it('leaves the other draws unearned', async () => {
    await releaseGate('excavation');
    const schedule = await service.getDrawSchedule(ids.job);
    expect(schedule.draws.filter((draw) => draw.status === 'scheduled').map((draw) => draw.drawCode))
      .toEqual(['draw-2', 'draw-3', 'draw-final']);
  });

  it('makes nothing billable when the gate bears no draw', async () => {
    const before = await service.getDrawSchedule(ids.job);
    await releaseGate('permit');
    const after = await service.getDrawSchedule(ids.job);
    expect(after.eligibleUnbilledCents).toBe(before.eligibleUnbilledCents);
  });
});

describe('confirming an invoice', () => {
  beforeEach(async () => {
    await signContract();
    await createSchedule();
  });

  it('records who said so and moves the money out of ready-to-bill', async () => {
    const schedule = await service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-1041', actor: owner, dueDate: '2026-08-15',
    });
    const deposit = schedule.draws.find((draw) => draw.drawCode === 'deposit');
    expect(deposit).toMatchObject({ status: 'invoiced', invoiceReference: 'QB-1041', dueDate: '2026-08-15' });
    expect(deposit?.invoicedAt).not.toBeNull();
    expect(schedule.eligibleUnbilledCents).toBe(0);
    expect(schedule.invoicedCents).toBe(1_520_417);

    const author = await db.query<{ invoiced_by: string }>(
      `select invoiced_by from job_draws where job_id = $1 and draw_code = 'deposit'`, [ids.job],
    );
    expect(author.rows[0]?.invoiced_by).toBe(ids.owner);
  });

  it('refuses a draw that is not earned yet', async () => {
    await expect(service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'draw-2', invoiceReference: 'QB-1042', actor: owner,
    })).rejects.toThrow(DomainRuleError);
  });

  it('refuses to invoice the same draw twice', async () => {
    await service.markDrawInvoiced({ jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-1041', actor: owner });
    await expect(service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-9999', actor: owner,
    })).rejects.toThrow(/already been invoiced/i);
  });

  it('refuses an empty accounting reference', async () => {
    await expect(service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'deposit', invoiceReference: '   ', actor: owner,
    })).rejects.toThrow(/accounting system reference/i);
  });

  it('is closed to the superintendent', async () => {
    await expect(service.markDrawInvoiced({
      jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-1041', actor: superintendent,
    })).rejects.toThrow(/may not confirm an invoice/i);
  });
});

describe('what the job is owed', () => {
  it('reports collected and remaining against the contract', async () => {
    await signContract();
    await createSchedule();
    await service.markDrawInvoiced({ jobId: ids.job, drawCode: 'deposit', invoiceReference: 'QB-1041', actor: owner });
    await db.query(
      `update job_draws set status = 'paid', paid_at = now(), paid_cents = amount_cents
       where job_id = $1 and draw_code = 'deposit'`, [ids.job],
    );

    const schedule = await service.getDrawSchedule(ids.job);
    expect(schedule.collectedCents).toBe(1_520_417);
    expect(schedule.remainingCents).toBe(CONTRACT_CENTS - 1_520_417);
  });

  it('reports nothing collected on a job with no schedule', async () => {
    const schedule = await service.getDrawSchedule(ids.job);
    expect(schedule).toMatchObject({ draws: [], collectedCents: 0, contractCents: null, remainingCents: null });
  });
});

describe('the feed once money is on it', () => {
  it('names the amount that is ready to bill', async () => {
    await signContract();
    await createSchedule();
    await releaseGate('excavation');

    const cards = await service.getActionCards('2026-07-31');
    const billable = cards.filter((card) => card.kind === 'draw.uninvoiced');
    expect(billable.map((card) => card.title)).toEqual([
      'Bill the Deposit — $15,204',
      'Bill the Draw 1 — $45,613',
    ]);
  });

  it('asks for a schedule when a signed contract has none', async () => {
    await signContract();
    const cards = await service.getActionCards('2026-07-31');
    expect(cards.map((card) => card.kind)).toContain('draw.unscheduled');
  });
});
