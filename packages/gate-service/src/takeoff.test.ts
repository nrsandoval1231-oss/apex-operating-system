/**
 * Serving the approved Designer takeoff.
 *
 * This is the only read that hands out the measured quantities themselves rather than just a
 * revision id, and it is what a customer proposal gets priced from. So the tests here are
 * mostly about what it REFUSES: a row whose digest does not match the quantities it carries is
 * not authority, and must not be served as if it were.
 */
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import {
  calculateQuantityPayloadSha256,
  createCanonicalId,
  type AuthoritativeQuantity,
} from '@apex/contracts';
import { GateService } from './index.js';

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  otherJob: createCanonicalId('job'),
  otherLead: createCanonicalId('lead'),
  revision: createCanonicalId('revision'),
  office: createCanonicalId('user'),
};

/**
 * Two quantities and their Calc entries. Small on purpose — the digest and the calc-resolution
 * rules are what is under test, not the seventeen-code catalogue.
 */
const quantities: AuthoritativeQuantity[] = [
  { code: 'pool.water-volume', value: 15001, unit: 'gal', calcId: 'pool.volume' },
  { code: 'pool.wetted-area', value: 901, unit: 'sf', calcId: 'pool.wetted' },
];
const calcLedger = [
  { id: 'pool.volume', label: 'Water volume', formula: 'V = A x d', inputs: [], value: 15001, unit: 'gal' },
  { id: 'pool.wetted', label: 'Wetted area', formula: 'A = floor + walls', inputs: [], value: 901, unit: 'sf' },
];

let db: PGlite;
let service: GateService;

const seedRevision = async (overrides: { digest?: string; status?: string } = {}) => {
  await db.query(
    `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version,
        job_input_sha256, calc_ledger_sha256, quantity_payload_sha256,
        quantities, calc_ledger, created_by, approved_at, approved_by)
     values ($1, $2, 1, $3, 'designer-0.1.0', 'designer-quantity-v4',
        $4, $5, $6, $7, $8, $9,
        case when $3 = 'approved' then now() else null end,
        case when $3 = 'approved' then $9 else null end)`,
    [
      ids.revision, ids.job, overrides.status ?? 'approved',
      'a'.repeat(64), 'b'.repeat(64),
      overrides.digest ?? calculateQuantityPayloadSha256(quantities),
      JSON.stringify(quantities), JSON.stringify(calcLedger), ids.office,
    ],
  );
};

beforeEach(async () => {
  db = new PGlite();
  await applyOperationalMigrations(db);
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name)
     values ($1, '00000000-0000-0000-0000-000000000002', 'office', 'Office User')`,
    [ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'source-takeoff', 'test:source-takeoff', '{}'),
            ($2, 'test', 'source-other', 'test:source-other', '{}')`,
    [ids.lead, ids.otherLead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status)
     values ($1, $2, 1, 'active'), ($3, $4, 1, 'active')`,
    [ids.job, ids.lead, ids.otherJob, ids.otherLead],
  );
  service = new GateService(db);
});

describe('getApprovedTakeoffRevision', () => {
  it('returns the approved revision with its quantities and calc ledger', async () => {
    await seedRevision();
    const revision = await service.getApprovedTakeoffRevision(ids.job);

    expect(revision).not.toBeNull();
    expect(revision?.revisionId).toBe(ids.revision);
    expect(revision?.jobId).toBe(ids.job);
    expect(revision?.status).toBe('approved');
    expect(revision?.quantityModelVersion).toBe('designer-quantity-v4');
    expect(revision?.quantities).toHaveLength(2);
    expect(revision?.calcLedger).toHaveLength(2);
    expect(revision?.blockingIssues).toEqual([]);
  });

  /**
   * The contract requires leadId and takeoff_revisions has no such column, so it is joined
   * from jobs. If that join is ever dropped the parse fails rather than emitting a revision
   * with no traceable lead.
   */
  it('carries the lead id, joined from the job', async () => {
    await seedRevision();
    expect((await service.getApprovedTakeoffRevision(ids.job))?.leadId).toBe(ids.lead);
  });

  it('serves a digest that still matches its own quantities', async () => {
    await seedRevision();
    const revision = await service.getApprovedTakeoffRevision(ids.job);
    expect(revision?.quantityPayloadSha256).toBe(calculateQuantityPayloadSha256(quantities));
  });

  /**
   * The point of the whole endpoint. A row edited in place — quantities changed without
   * re-deriving the digest — is not authority, and pricing a customer proposal from it would
   * put a number in front of a homeowner that nothing can substantiate.
   */
  it('refuses a row whose digest does not match its quantities', async () => {
    await seedRevision({ digest: 'c'.repeat(64) });
    await expect(service.getApprovedTakeoffRevision(ids.job)).rejects.toThrow(
      /SHA-256 does not match/i,
    );
  });

  it('returns null when the job has no approved revision', async () => {
    await seedRevision({ status: 'draft' });
    expect(await service.getApprovedTakeoffRevision(ids.job)).toBeNull();
  });

  it('returns null for a job that has no revisions at all', async () => {
    await seedRevision();
    expect(await service.getApprovedTakeoffRevision(ids.otherJob)).toBeNull();
  });

  /** Never another job's authority, however the id arrives. */
  it('does not leak one job\'s revision to another job', async () => {
    await seedRevision();
    const other = await service.getApprovedTakeoffRevision(ids.otherJob);
    expect(other).toBeNull();
  });
});

/**
 * Recording an approved takeoff — the write half, and the link that had no path
 * outside the test suite until now.
 *
 * The tests below are mostly about what the boundary refuses and what it declines
 * to take on trust. It cannot re-derive a quantity (the Designer engine is another
 * repository on purpose), so everything it CAN check has to actually be checked.
 */
describe('recordApprovedTakeoff', () => {
  const submission = {
    engineVersion: 'designer-0.1.0',
    quantityModelVersion: 'designer-quantity-v4',
    jobModel: { shape: 'rectangle', lengthFt: 30, widthFt: 15 },
    quantities,
    calcLedger,
    supersedeExisting: false,
  };
  const officeActor = { kind: 'user', userId: ids.office, role: 'office' } as const;

  it('stores a revision that can immediately be served as authority', async () => {
    const revision = await service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission,
      idempotencyKey: 'takeoff-first',
    });

    expect(revision.status).toBe('approved');
    expect(revision.revisionNumber).toBe(1);
    expect(revision.approvedBy).toBe(ids.office);
    expect(revision.quantities).toHaveLength(2);
    // Read back through the consumer's own parser, not the object we just built.
    expect(await service.getApprovedTakeoffRevision(ids.job)).toMatchObject({
      revisionId: revision.revisionId,
    });
  });

  /**
   * The digest is the product. Computing it here — never accepting one — is what
   * makes "these are the approved quantities" checkable by anyone later.
   */
  it('computes the quantity digest itself rather than accepting one', async () => {
    const revision = await service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission,
      idempotencyKey: 'takeoff-digest',
    });
    expect(revision.quantityPayloadSha256).toBe(calculateQuantityPayloadSha256(quantities));
  });

  /**
   * The same design serialised with its keys in a different order is the same
   * design. If this ever fails, `job_input_sha256` has started recording the
   * sender's formatting instead of the input.
   */
  it('hashes the job model canonically, so key order does not change the input hash', async () => {
    const first = await service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission,
      idempotencyKey: 'takeoff-order-a',
    });
    const reordered = { widthFt: 15, lengthFt: 30, shape: 'rectangle' };
    const second = await service.recordApprovedTakeoff({
      jobId: ids.otherJob,
      actor: officeActor,
      submission: { ...submission, jobModel: reordered },
      idempotencyKey: 'takeoff-order-b',
    });
    expect(second.jobInputSha256).toBe(first.jobInputSha256);
  });

  /**
   * Replacing an approved revision invalidates any price derived from it. That is
   * a different intention from approving a first one and must be said out loud —
   * the same rule the customer link follows.
   */
  it('refuses a second approval unless superseding is asked for', async () => {
    await service.recordApprovedTakeoff({
      jobId: ids.job, actor: officeActor, submission, idempotencyKey: 'takeoff-one',
    });
    await expect(service.recordApprovedTakeoff({
      jobId: ids.job, actor: officeActor, submission, idempotencyKey: 'takeoff-two',
    })).rejects.toThrow(/already has an approved takeoff revision/i);
  });

  it('supersedes the previous revision when asked, and keeps it intact', async () => {
    const first = await service.recordApprovedTakeoff({
      jobId: ids.job, actor: officeActor, submission, idempotencyKey: 'takeoff-a',
    });
    const second = await service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission: { ...submission, supersedeExisting: true },
      idempotencyKey: 'takeoff-b',
    });

    expect(second.revisionNumber).toBe(2);
    const rows = await db.query<{ revision_id: string; status: string; superseded_by_revision_id: string | null }>(
      'select revision_id, status, superseded_by_revision_id from takeoff_revisions order by revision_number',
    );
    // The old revision is retired, not deleted: something was priced against it.
    expect(rows.rows[0]).toMatchObject({
      revision_id: first.revisionId,
      status: 'superseded',
      superseded_by_revision_id: second.revisionId,
    });
    expect(rows.rows[1]).toMatchObject({ revision_id: second.revisionId, status: 'approved' });
  });

  /** Deciding the quantities is not the same act as building against them. */
  it('refuses a superintendent, who may release a Gate but not decide quantities', async () => {
    const superintendent = createCanonicalId('user');
    await db.query(
      `insert into app_users (user_id, auth_user_id, role, display_name)
       values ($1, '00000000-0000-0000-0000-000000000003', 'superintendent', 'Super')`,
      [superintendent],
    );
    await expect(service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: { kind: 'user', userId: superintendent, role: 'superintendent' },
      submission,
      idempotencyKey: 'takeoff-super',
    })).rejects.toThrow(/may not approve a Designer takeoff/i);
  });

  /**
   * The one consistency check this boundary can genuinely make. A quantity whose
   * value disagrees with the Calc it cites is not a rounding difference — it is a
   * claim with no derivation behind it.
   */
  it('refuses a quantity that does not equal the Calc entry it names', async () => {
    await expect(service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission: {
        ...submission,
        quantities: [{ ...quantities[0]!, value: 99999 }, quantities[1]!],
      },
      idempotencyKey: 'takeoff-mismatch',
    })).rejects.toThrow(/must equal its Calc result/i);
  });

  it('refuses a quantity carrying the wrong unit for its code', async () => {
    await expect(service.recordApprovedTakeoff({
      jobId: ids.job,
      actor: officeActor,
      submission: {
        ...submission,
        quantities: [{ ...quantities[0]!, unit: 'cf' }, quantities[1]!],
      },
      idempotencyKey: 'takeoff-unit',
    })).rejects.toThrow(/must use gal/i);
  });

  it('refuses an unknown job rather than orphaning a revision', async () => {
    await expect(service.recordApprovedTakeoff({
      jobId: createCanonicalId('job'),
      actor: officeActor,
      submission,
      idempotencyKey: 'takeoff-nojob',
    })).rejects.toThrow(/Unknown Job/i);
  });

  /** The approval is an event, not just a row: the audit trail is the product too. */
  it('records created and approved events against the job', async () => {
    await service.recordApprovedTakeoff({
      jobId: ids.job, actor: officeActor, submission, idempotencyKey: 'takeoff-events',
    });
    const events = await db.query<{ event_type: string }>(
      'select event_type from events where job_id = $1 order by recorded_at',
      [ids.job],
    );
    const types = events.rows.map((row) => row.event_type);
    expect(types).toContain('takeoff_revision.created');
    expect(types).toContain('takeoff_revision.approved');
  });
});
