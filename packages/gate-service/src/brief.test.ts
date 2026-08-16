import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperationalMigrations } from '@apex/database';
import { DailyBriefSchema, createCanonicalId, type EventActor } from '@apex/contracts';
import { GateService } from './index.js';

/**
 * The daily brief over real persisted state — PRD §9.14.
 *
 * The derivation is unit-tested in @apex/domain. What matters here is that a
 * brief is generated once per day and frozen, and that the next day's brief can
 * genuinely tell what changed.
 */

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  office: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };

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
     values ($1, 'test', 'source-brief', 'test:source-brief', '{"customerName":"Whitaker Oasis"}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );
  service = new GateService(db);
});

const addApprovedTakeoff = () => db.query(
  `insert into takeoff_revisions
   (revision_id, job_id, revision_number, status, engine_version, quantity_model_version, job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger, created_by, approved_at, approved_by)
   values ($1, $2, 1, 'approved', 'designer-test', 'quantity-v1', $3, $4, repeat('c', 64), '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture.calc"}]', '[{"id":"fixture.calc","label":"Fixture quantity","formula":"Q = 1","inputs":[],"value":1,"unit":"gal"}]', $5, now(), $5)`,
  [ids.revision, ids.job, 'a'.repeat(64), 'b'.repeat(64), ids.office],
);

const allTitles = (brief: Awaited<ReturnType<GateService['getDailyBrief']>>) =>
  [...brief.needsYou, ...brief.running, ...brief.thisWeek].map((item) => item.card.title);

describe('generating a brief', () => {
  it('produces a valid brief from real state', async () => {
    const brief = await service.getDailyBrief('2026-08-02');
    expect(DailyBriefSchema.safeParse(brief).success).toBe(true);
    expect(brief.briefDate).toBe('2026-08-02');
    expect(allTitles(brief).length).toBeGreaterThan(0);
  });

  it('is the first brief, so nothing is new and nothing has cleared', async () => {
    const brief = await service.getDailyBrief('2026-08-02');
    expect(brief.previousBriefDate).toBeNull();
    expect(brief.newSinceLast).toEqual([]);
    expect(brief.cleared).toEqual([]);
  });

  it('names what it cannot answer yet', async () => {
    expect((await service.getDailyBrief('2026-08-02')).notCovered).not.toContain('Inspections requiring action');
  });
});

describe('a brief is frozen once delivered', () => {
  it('returns the same brief when asked again on the same day', async () => {
    const first = await service.getDailyBrief('2026-08-02');
    // The world moves on after the brief was written.
    await addApprovedTakeoff();
    const second = await service.getDailyBrief('2026-08-02');

    expect(second.briefId).toBe(first.briefId);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(allTitles(second)).toEqual(allTitles(first));
  });

  it('leaves the live feed free to move', async () => {
    const brief = await service.getDailyBrief('2026-08-02');
    await addApprovedTakeoff();
    const live = await service.getActionCards('2026-08-02');

    // The takeoff card is gone from the feed but still stands in the brief.
    expect(live.map((card) => card.kind)).not.toContain('takeoff.missing');
    expect(allTitles(brief)).toContain('Approve a takeoff revision');
  });

  it('refuses to rewrite a delivered brief', async () => {
    await service.getDailyBrief('2026-08-02');
    await expect(db.query(`update daily_briefs set brief_date = '2026-08-03'`))
      .rejects.toThrow(/append-only/i);
    await expect(db.query('delete from daily_briefs')).rejects.toThrow(/append-only/i);
  });

  it('keeps one brief per day', async () => {
    await service.getDailyBrief('2026-08-02');
    await service.getDailyBrief('2026-08-02');
    const rows = await db.query<{ count: string }>('select count(*) as count from daily_briefs');
    expect(Number(rows.rows[0]?.count)).toBe(1);
  });
});

describe('what changed since the last brief', () => {
  it('ages a standing item and flags a genuinely new one', async () => {
    const first = await service.getDailyBrief('2026-08-01');
    expect(first.needsYou.every((item) => item.standingDays === 1)).toBe(true);

    // Opening the project resolves one card and creates others.
    await addApprovedTakeoff();
    await service.openProject({
      jobId: ids.job, actor: owner, initialPhaseKey: 'layout-excavation',
      superintendentUserId: ids.superintendent, idempotencyKey: 'open-for-brief',
    });

    const second = await service.getDailyBrief('2026-08-02');
    expect(second.previousBriefDate).toBe('2026-08-01');

    // "Approve a takeoff revision" and "Open this job as a construction
    // project" were both on yesterday's brief and are both resolved.
    expect(second.cleared.map((item) => item.title).sort()).toEqual([
      'Approve a takeoff revision',
      'Open this job as a construction project',
    ]);
    expect(allTitles(second)).not.toContain('Approve a takeoff revision');

    // And whatever the opened project surfaced is new rather than standing.
    expect(second.newSinceLast.length).toBeGreaterThan(0);
    expect(second.newSinceLast.every((item) => item.standingDays === 1)).toBe(true);
  });

  it('carries a still-unresolved item forward with its age', async () => {
    await service.getDailyBrief('2026-07-31');
    await service.getDailyBrief('2026-08-01');
    const third = await service.getDailyBrief('2026-08-02');

    const takeoff = third.needsYou.find((item) => item.card.kind === 'takeoff.missing');
    // Nothing was done about it for three mornings, and the brief says so.
    expect(takeoff?.standingDays).toBe(3);
    expect(third.newSinceLast.map((item) => item.card.kind)).not.toContain('takeoff.missing');
  });

  it('compares against the most recent earlier brief, not merely yesterday', async () => {
    await service.getDailyBrief('2026-07-28');
    const later = await service.getDailyBrief('2026-08-02');
    expect(later.previousBriefDate).toBe('2026-07-28');
    expect(later.needsYou[0]?.standingDays).toBe(2);
  });
});

describe('money on the brief', () => {
  it('agrees with the feed about what is ready to bill', async () => {
    const brief = await service.getDailyBrief('2026-08-02');
    const fromFeed = (await service.getActionCards('2026-08-02'))
      .filter((card) => card.kind === 'draw.uninvoiced')
      .reduce((sum, card) => sum + (card.amountCents ?? 0), 0);
    expect(brief.readyToBillCents).toBe(fromFeed);
  });
});
