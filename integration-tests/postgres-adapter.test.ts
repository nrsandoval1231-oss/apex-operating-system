import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  PostgresDatabase,
  applyOperationalMigrations,
  resolveSsl,
} from '../packages/database/src/index.ts';
import { GateService, InspectionService } from '../packages/gate-service/src/index.ts';
import { type EventActor, type JobId } from '../packages/contracts/src/index.ts';

/**
 * The Postgres adapter against a real server — deployment plan slice 2.
 *
 * Everything else in this repository is tested against PGlite, which is the
 * same engine but not the same driver. The differences that matter are all at
 * the driver boundary — type parsing, pooled transactions, advisory locks — so
 * they cannot be caught by the PGlite suite by construction.
 *
 * Runs only when DATABASE_URL is set. `scripts/ci.sh` starts that database
 * when it is going to run this file. Skipping locally is deliberate: needing
 * a server to run the unit suite on a laptop is a tax on every other change.
 */

const url = process.env.DATABASE_URL?.trim();
const available = Boolean(url);

if (!available) {
  console.warn(
    '\n  !  SKIPPING the Postgres adapter tests: DATABASE_URL is not set.'
    + '\n     scripts/ci.sh runs them when DATABASE_URL and S3 settings are present.'
    + '\n     Skipping is NOT a pass — the adapter is simply unverified here.\n',
  );
}

let db: PostgresDatabase;
/*
 * Stable ids. A rerun against the same database used to mint a fresh lead id,
 * hit ON CONFLICT DO NOTHING on the fixed idempotency key `adapter:1`, and
 * then fail the job insert: the new lead row was never written, so the
 * foreign key had nothing to point at. The same rows must be inserted again.
 */
const ids = {
  lead: 'lead_ADAPTERDATEYARD00000000001',
  job: 'job_ADAPTERDATETASK00000000001',
  revision: 'revision_ADAPTERDATEREV000000000001',
  owner: 'user_ADAPTERDATEENTRY0000000001',
  sub: 'sub_ADAPTERDATECREW00000000001',
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const jobId = ids.job as JobId;

beforeAll(async () => {
  if (!available) return;
  db = PostgresDatabase.create({ url: url!, applicationName: 'apex-adapter-test' });
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
});

afterAll(async () => {
  if (available && db) await db.close();
});

describe.skipIf(!available)('the Postgres adapter', () => {
  it('applies every migration, and applying them again is a no-op', async () => {
    const before = await db.query<{ count: string }>(
      'select count(*)::text as count from schema_migrations',
    );
    // Second pass under the same lock: this is what a second instance starting
    // after the first one finished actually does.
    await db.withMigrationLock((client) => applyOperationalMigrations(client));
    const after = await db.query<{ count: string }>(
      'select count(*)::text as count from schema_migrations',
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    expect(Number(after.rows[0]?.count)).toBeGreaterThan(15);
  });

  it('seeds the fixed reference data the same way embedded Postgres does', async () => {
    const inspections = await db.query<{ count: string }>(
      'select count(*)::text as count from inspection_types',
    );
    expect(Number(inspections.rows[0]?.count)).toBe(7);

    const gates = await db.query<{ count: string }>(
      'select count(*)::text as count from gate_definitions where active = true',
    );
    // Migration 0030 adds Automation Programming Complete and Cover Install
    // to the original seven active Gates.
    expect(Number(gates.rows[0]?.count)).toBe(9);
  });

  it('rolls a failed transaction back and keeps the connection usable', async () => {
    await db.query('create table if not exists adapter_tx_probe (id integer primary key)');
    await db.query('delete from adapter_tx_probe');

    await expect(db.transaction(async (tx) => {
      await tx.query('insert into adapter_tx_probe (id) values (1)');
      throw new Error('deliberate');
    })).rejects.toThrow('deliberate');

    const rows = await db.query<{ id: number }>('select id from adapter_tx_probe');
    expect(rows.rows).toHaveLength(0);

    // The client must have gone back to the pool clean, not poisoned mid-transaction.
    await db.transaction(async (tx) => {
      await tx.query('insert into adapter_tx_probe (id) values (2)');
    });
    expect((await db.query('select id from adapter_tx_probe')).rows).toHaveLength(1);
  });

  it('reports affected rows on a write and leaves it absent on a read', async () => {
    const written = await db.query('update adapter_tx_probe set id = 3 where id = 2');
    expect(written.affectedRows).toBe(1);
    const read = await db.query('select 1');
    expect(read.rows).toHaveLength(1);
  });

  /**
   * The type-parsing test, and the reason this file exists.
   *
   * node-postgres parses `date` into a JS Date at local midnight, which shifts
   * the calendar day backwards in any timezone east of UTC. The adapter
   * overrides that parser. This asserts on a date that round-trips through the
   * inspection deadline logic, because that is where a one-day error would
   * actually cost someone a crew.
   */
  it('returns calendar dates as the day that was stored, not a timezone-shifted one', async () => {
    await db.query(
      `insert into app_users (user_id, auth_user_id, role, display_name)
       values ($1, gen_random_uuid(), 'admin', 'Travis') on conflict do nothing`,
      [ids.owner],
    );
    await db.query(
      `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
       values ($1, 'adapter-test', 'adapter-1', 'adapter:1', '{"customerName":"Whitaker Oasis"}')
       on conflict do nothing`,
      [ids.lead],
    );
    await db.query(
      `insert into jobs (job_id, lead_id, signed_proposal_version, status)
       values ($1, $2, 1, 'active') on conflict do nothing`,
      [ids.job, ids.lead],
    );
    await db.query(
      `insert into takeoff_revisions
       (revision_id, job_id, revision_number, status, engine_version, quantity_model_version,
        job_input_sha256, calc_ledger_sha256, quantity_payload_sha256, quantities, calc_ledger,
        created_by, approved_at, approved_by)
       values ($1, $2, 1, 'approved', 'adapter', 'q1', repeat('a',64), repeat('b',64), repeat('c',64),
       '[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"f"}]',
       '[{"id":"f","label":"F","formula":"Q=1","inputs":[],"value":1,"unit":"gal"}]', $3, now(), $3)
       on conflict do nothing`,
      [ids.revision, ids.job, ids.owner],
    );
    await db.query(
      `insert into projects (job_id, current_phase_key, created_by)
       values ($1, 'steel-reinforcement', $2) on conflict do nothing`,
      [ids.job, ids.owner],
    );
    await db.query(
      `insert into subcontractors (subcontractor_id, name, trade)
       values ($1, 'Lubbock Gunite', 'Gunite') on conflict do nothing`,
      [ids.sub],
    );

    const service = new GateService(db);
    const visit = await service.scheduleVisit({
      jobId,
      subcontractorId: ids.sub,
      phaseKey: 'gunite',
      startsOn: '2026-08-13',
      endsOn: '2026-08-13',
      actor: owner,
    });
    // Read back through the driver: the day stored is the day returned.
    expect(visit.startsOn).toBe('2026-08-13');
    expect(visit.endsOn).toBe('2026-08-13');

    const inspections = new InspectionService(db);
    const steel = (await inspections.listJobInspections(jobId))
      .find((row) => row.inspectionKey === 'pool-steel-structural');
    expect(steel?.neededBy).toBe('2026-08-13');
    expect(steel?.neededBySource).toBe('crew-booking');
    // Two business days back from Thursday 13 August is Tuesday 11 August. A
    // timezone-shifted date would land this on the 10th and quietly warn a day
    // early for the rest of the build.
    expect(steel?.lastSafeRequestOn).toBe('2026-08-11');
  });

  it('runs the same action-card derivation as the embedded database', async () => {
    const cards = await new GateService(db).getActionCards('2026-08-11');
    const due = cards.filter((card) => card.kind === 'inspection.due');
    expect(due.length).toBeGreaterThan(0);
    expect(due[0]?.reason).toMatch(/Pre-gunite hold point/);
  });
});

/** Pure, so it runs everywhere — no server needed to check the TLS policy. */
describe('TLS policy', () => {
  it('is off for a local database and on with verification for anything else', () => {
    expect(resolveSsl('postgres://u:p@localhost:5432/apex')).toBe(false);
    expect(resolveSsl('postgres://u:p@127.0.0.1:5432/apex')).toBe(false);
    expect(resolveSsl('postgres://u:p@db.example.com:5432/apex'))
      .toEqual({ rejectUnauthorized: true });
  });

  it('honours an explicit sslmode=disable but never disables verification alone', () => {
    expect(resolveSsl('postgres://u:p@db.example.com/apex?sslmode=disable')).toBe(false);
    // There is deliberately no option that leaves TLS on with verification off.
    const withCa = resolveSsl('postgres://u:p@db.example.com/apex', '-----BEGIN CERTIFICATE-----');
    expect(withCa).toMatchObject({ rejectUnauthorized: true });
  });
});
