import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from '../apps/gate-api/node_modules/jose/dist/webapi/index.js';
import {
  createCanonicalId,
  ProjectPhaseHistorySchema,
} from '../packages/contracts/src/index.ts';
import {
  PostgresDatabase,
  applyOperationalMigrations,
} from '../packages/database/src/index.ts';
import { createGateApi } from '../apps/gate-api/src/server.ts';
import { LocalEvidenceStorage } from '../packages/storage/src/index.ts';
const url = process.env.DATABASE_URL;
let db: PostgresDatabase,
  server: ReturnType<typeof createGateApi>,
  base: string;
const ids = {
  admin: createCanonicalId('user'),
  field: createCanonicalId('user'),
};
const secret = 'workspace-synthetic-only-secret-long-enough';
async function job(vertical: string | null = 'Designer Pools') {
  const lead = createCanonicalId('lead'),
    id = createCanonicalId('job');
  await db.query(
    `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,$3::jsonb)`,
    [
      lead,
      randomUUID(),
      JSON.stringify({ vertical, first_name: 'Workspace', last_name: 'Test' }),
    ],
  );
  await db.query(
    `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
    [id, lead],
  );
  return id;
}
async function call(
  path: string,
  body?: unknown,
  who: keyof typeof ids = 'admin',
  key = randomUUID(),
) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ids[who])
    .setIssuer('apex-gate')
    .setAudience('apex-gate-api')
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
  return fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  if (!url) return;
  db = PostgresDatabase.create({
    url,
    maxConnections: 8,
    applicationName: 'workspace-tests',
  });
  await db.withMigrationLock((c) => applyOperationalMigrations(c));
  for (const [role, id] of Object.entries(ids))
    await db.query(
      `insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),$2,$2)`,
      [id, role],
    );
  server = createGateApi({
    db,
    jwtSecret: secret,
    storage: new LocalEvidenceStorage('/tmp/apex2/workspace-test-storage'),
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (db) await db.close();
});
describe.skipIf(!url)('project workspace real PostgreSQL and HTTP', () => {
  it('persists append-only notes with authenticated actor/time and exact retry binding', async () => {
    const id = await job(),
      k = randomUUID(),
      path = `/api/jobs/${id}/notes`;
    const result = await call(
      path,
      { text: 'Recorded site decision' },
      'field',
      k,
    );
    expect(result.status).toBe(201);
    const note = await result.json();
    expect(note).toMatchObject({
      jobId: id,
      text: 'Recorded site decision',
      actor: ids.field,
    });
    expect(Number.isNaN(Date.parse(note.at))).toBe(false);
    expect(
      await (
        await call(path, { text: 'Recorded site decision' }, 'field', k)
      ).json(),
    ).toEqual(note);
    expect((await call(path, { text: 'Changed' }, 'field', k)).status).toBe(
      409,
    );
    expect(
      (await call(path, { text: 'Recorded site decision' }, 'admin', k)).status,
    ).toBe(409);
    expect(await (await call(path)).json()).toEqual([note]);
    const otherJob = await job();
    expect(
      (
        await call(
          `/api/jobs/${otherJob}/notes`,
          { text: 'Recorded site decision' },
          'field',
          k,
        )
      ).status,
    ).toBe(409);
    expect((await call(path, { text: '   ' })).status).toBe(422);
    await expect(
      db.query('update project_notes set text=$1 where note_id=$2', [
        'rewrite',
        note.noteId,
      ]),
    ).rejects.toThrow(/append-only/);
  });
  it('refuses new notes after job closure/cancellation and serializes the job lock', async () => {
    const id = await job();
    let unlock!: () => void;
    let locked!: () => void;
    const ready = new Promise<void>((r) => (locked = r));
    const hold = new Promise<void>((r) => (unlock = r));
    const closing = db.transaction(async (tx) => {
      await tx.query('select 1 from jobs where job_id=$1 for update', [id]);
      locked();
      await hold;
      await tx.query(`update jobs set status='cancelled' where job_id=$1`, [
        id,
      ]);
    });
    await ready;
    const pending = call(`/api/jobs/${id}/notes`, { text: 'Must not commit' });
    unlock();
    await closing;
    expect((await pending).status).toBe(409);
    expect(await (await call(`/api/jobs/${id}/notes`)).json()).toEqual([]);
  });
  it('persists manager-only priority with revision, audit and payload-bound retries', async () => {
    const id = await job(),
      path = `/api/jobs/${id}/priority`,
      k = randomUUID();
    expect(
      (await call(path, { priority: 'urgent', expectedRevision: 0 }, 'field'))
        .status,
    ).toBe(403);
    const result = await call(
      path,
      { priority: 'urgent', expectedRevision: 0 },
      'admin',
      k,
    );
    expect(result.status).toBe(200);
    const meta = await result.json();
    expect(meta).toMatchObject({ jobId: id, priority: 'urgent', revision: 1 });
    expect(
      await (
        await call(
          path,
          { priority: 'urgent', expectedRevision: 0 },
          'admin',
          k,
        )
      ).json(),
    ).toEqual(meta);
    expect(
      (await call(path, { priority: 'high', expectedRevision: 0 })).status,
    ).toBe(409);
    expect(
      (await call(path, { priority: 'high', expectedRevision: 1 }, 'admin', k))
        .status,
    ).toBe(409);
    const row = (await (await call('/api/workspace-projects')).json()).find(
      (x: any) => x.jobId === id,
    );
    expect(row).toMatchObject({ priority: 'urgent', revision: 1 });
    await expect(
      db.query('delete from project_workspace_history where job_id=$1', [id]),
    ).rejects.toThrow(/append-only/);
    const concurrent = await Promise.all([
      call(path, { priority: 'normal', expectedRevision: 1 }),
      call(path, { priority: 'high', expectedRevision: 1 }),
    ]);
    expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
    const activity = await (await call(`/api/jobs/${id}/activity`)).json();
    expect(
      activity.some(
        (x: any) => x.source === 'priority' && x.actor === ids.admin,
      ),
    ).toBe(true);
    await db.query(`update jobs set status='cancelled' where job_id=$1`, [id]);
    expect(
      (await call(path, { priority: 'normal', expectedRevision: 2 })).status,
    ).toBe(409);
  });
  it('reads division only from stored intake and never assigns pool stages to unsupported divisions', async () => {
    const pool = await job(),
      coating = await job('Concrete Coating'),
      unknown = await job(null);
    const rows = await (await call('/api/workspace-projects')).json();
    expect(rows.find((x: any) => x.jobId === pool)).toMatchObject({
      division: 'Designer Pools',
      stageCatalog: 'pools',
      priority: 'normal',
      revision: 0,
      gates: { released: 0, required: 9 },
    });
    expect(rows.find((x: any) => x.jobId === coating)).toMatchObject({
      division: 'Concrete Coating',
      stageCatalog: null,
      gates: null,
    });
    expect(rows.find((x: any) => x.jobId === unknown)).toMatchObject({
      division: null,
      stageCatalog: null,
      gates: null,
    });
  });
  it('reads the real phase-history shape after a recorded skip without implying released gates', async () => {
    const id = await job();
    expect((await call(`/api/jobs/${id}/project`, {})).status).toBe(201);
    expect(
      (
        await call(`/api/jobs/${id}/project/phase`, {
          toPhaseKey: 'gunite',
          reason: 'Recorded skip, not gate completion.',
        })
      ).status,
    ).toBe(200);
    const history = ProjectPhaseHistorySchema.parse(
      await (await call(`/api/jobs/${id}/project/history`)).json(),
    );
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      toPhaseKey: 'gunite',
      reason: 'Recorded skip, not gate completion.',
    });
    const row = (await (await call('/api/workspace-projects')).json()).find(
      (x: any) => x.jobId === id,
    );
    expect(row.gates).toEqual({ released: 0, required: 9 });
  });
  it('projects existing task and appointment history once without copying records', async () => {
    const id = await job();
    const task = await (
      await call('/api/tasks', {
        title: 'Workspace activity task',
        detail: null,
        assignedUserId: ids.field,
        dueDate: null,
        priority: 'normal',
        milestone: null,
        recurrence: 'none',
        jobId: id,
      })
    ).json();
    await call(`/api/jobs/${id}/notes`, { text: 'Project note' });
    await call('/api/calendar-events', {
      title: 'Workspace activity appointment',
      note: null,
      assignedUserId: ids.field,
      eventType: 'meeting',
      jobId: id,
      allDay: true,
      startsOn: '2026-10-24',
      endsOn: '2026-10-24',
      startsAt: null,
      endsAt: null,
      timezone: 'America/Chicago',
    });
    const events = await (await call(`/api/jobs/${id}/activity`)).json();
    expect(
      events.filter(
        (x: any) => x.source === 'task' && x.title.includes(task.title),
      ),
    ).toHaveLength(1);
    expect(events.filter((x: any) => x.source === 'note')).toHaveLength(1);
    expect(
      events.filter(
        (x: any) =>
          x.source === 'appointment' &&
          x.title.includes('Workspace activity appointment'),
      ),
    ).toHaveLength(1);
    expect(
      (
        await db.query('select count(*) from task_history where task_id=$1', [
          task.taskId,
        ])
      ).rows[0],
    ).toMatchObject({ count: '1' });
  });
});
