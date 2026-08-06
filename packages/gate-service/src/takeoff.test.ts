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
