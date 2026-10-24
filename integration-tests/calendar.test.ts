import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from '../apps/gate-api/node_modules/jose/dist/webapi/index.js';
import {
  createCanonicalId,
  type EventActor,
} from '../packages/contracts/src/index.ts';
import {
  PostgresDatabase,
  applyOperationalMigrations,
} from '../packages/database/src/index.ts';
import { CalendarService } from '../packages/gate-service/src/calendarEvents.ts';
import { TaskService } from '../packages/gate-service/src/tasks.ts';
import { createGateApi } from '../apps/gate-api/src/server.ts';
import { LocalEvidenceStorage } from '../packages/storage/src/index.ts';
const url = process.env.DATABASE_URL;
const ids = {
  owner: createCanonicalId('user'),
  other: createCanonicalId('user'),
  admin: createCanonicalId('user'),
  inactive: createCanonicalId('user'),
  customer: createCanonicalId('user'),
};
const actors = Object.fromEntries(
  Object.entries(ids).map(([k, userId]) => [
    k,
    {
      kind: 'user',
      userId,
      role: k === 'admin' ? 'admin' : k === 'customer' ? 'customer' : 'field',
    },
  ]),
) as Record<keyof typeof ids, EventActor>;
let db: PostgresDatabase;
let service: CalendarService;
let server: ReturnType<typeof createGateApi>;
let base: string;
const secret = 'calendar-synthetic-only-secret-long-enough';
const fields = {
  title: 'Synthetic calendar',
  note: null,
  assignedUserId: ids.owner,
  eventType: 'meeting',
  jobId: null,
  allDay: true,
  startsOn: '2028-02-29',
  endsOn: '2028-03-01',
  startsAt: null,
  endsAt: null,
  timezone: 'America/Chicago',
};
const edit = ({ jobId, ...rest }: typeof fields, expectedRevision = 1) => ({
  ...rest,
  expectedRevision,
});
const key = () => randomUUID();
async function job() {
  const lead = createCanonicalId('lead'),
    job = createCanonicalId('job');
  await db.query(
    `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,'{}')`,
    [lead, key()],
  );
  await db.query(
    `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
    [job, lead],
  );
  return job;
}
async function call(
  path: string,
  who: keyof typeof ids = 'owner',
  body?: unknown,
  k = key(),
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
      'idempotency-key': k,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  if (!url) return;
  db = PostgresDatabase.create({
    url,
    maxConnections: 8,
    applicationName: 'calendar-tests',
  });
  await db.withMigrationLock((c) => applyOperationalMigrations(c));
  for (const [name, id] of Object.entries(ids))
    await db.query(
      `insert into app_users(user_id,auth_user_id,role,display_name,active) values($1,gen_random_uuid(),$2,$3,$4)`,
      [
        id,
        name === 'admin' ? 'admin' : name === 'customer' ? 'customer' : 'field',
        `Checklist ${name}`,
        name !== 'inactive',
      ],
    );
  service = new CalendarService(db);
  server = createGateApi({
    db,
    jwtSecret: secret,
    storage: new LocalEvidenceStorage('/tmp/apex2/calendar-test-storage'),
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (server)
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  if (db) await db.close();
});
describe.skipIf(!url)('canonical calendar on real PostgreSQL', () => {
  it('persists personal visibility for creator/assignee and hides unrelated managers including history', async () => {
    const event = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      fields,
    );
    expect(
      (await new CalendarService(db).list(actors.owner)).map((e) => e.eventId),
    ).toContain(event.eventId);
    for (const actor of [actors.other, actors.admin]) {
      expect((await service.list(actor)).map((e) => e.eventId)).not.toContain(
        event.eventId,
      );
      await expect(service.history(actor, event.eventId)).rejects.toThrow(
        /not found/,
      );
      await expect(
        service.command(actor, key(), 'cancel', event.eventId, {
          expectedRevision: 1,
        }),
      ).rejects.toThrow(/not found/);
    }
    const assigned = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      { ...fields, assignedUserId: ids.other },
    );
    expect((await service.list(actors.other)).map((e) => e.eventId)).toContain(
      assigned.eventId,
    );
    await service.command(
      actors.owner,
      key(),
      'edit',
      assigned.eventId,
      edit(fields),
    );
    await expect(
      service.history(actors.other, assigned.eventId),
    ).rejects.toThrow(/not found/);
  });
  it('replays exact original receipts and refuses changed payload/actor/action/target', async () => {
    const k = key();
    const original = await service.command(
      actors.owner,
      k,
      'create',
      null,
      fields,
    );
    await service.command(actors.owner, key(), 'edit', original.eventId, {
      ...edit(fields),
      title: 'Later title',
    });
    expect(
      await service.command(actors.owner, k, 'create', null, {
        ...fields,
        title: ' Synthetic calendar ',
      }),
    ).toEqual(original);
    for (const [actor, action, id, body] of [
      [actors.other, 'create', null, fields],
      [actors.owner, 'create', null, { ...fields, title: 'Changed' }],
      [actors.owner, 'cancel', original.eventId, { expectedRevision: 2 }],
      [actors.owner, 'edit', original.eventId, edit(fields, 2)],
    ] as const)
      await expect(service.command(actor, k, action, id, body)).rejects.toThrow(
        /Idempotency/,
      );
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        service.command(actors.owner, k + 'concurrent', 'create', null, fields),
      ),
    );
    expect(concurrent[0].eventId).toBe(concurrent[1].eventId);
  });
  it('checks active staff assignments, project editing authority and revisions', async () => {
    for (const id of [ids.inactive, ids.customer])
      await expect(
        service.command(actors.owner, key(), 'create', null, {
          ...fields,
          assignedUserId: id,
        }),
      ).rejects.toThrow(/active staff/);
    const jobId = await job();
    const event = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      jobId,
    });
    expect((await service.list(actors.other)).map((e) => e.eventId)).toContain(
      event.eventId,
    );
    await expect(
      service.command(actors.other, key(), 'edit', event.eventId, edit(fields)),
    ).rejects.toThrow(/creator/);
    const changed = await service.command(
      actors.admin,
      key(),
      'edit',
      event.eventId,
      edit(fields),
    );
    expect(changed.revision).toBe(2);
    await expect(
      service.command(actors.owner, key(), 'edit', event.eventId, edit(fields)),
    ).rejects.toThrow(/changed/);
    const cancelled = await service.command(
      actors.owner,
      key(),
      'cancel',
      event.eventId,
      { expectedRevision: 2 },
    );
    expect(cancelled.cancelledBy).toBe(ids.owner);
    expect(
      (await service.history(actors.admin, event.eventId)).map(
        (h: any) => h.action,
      ),
    ).toEqual(['created', 'edited', 'cancelled']);
    await expect(
      service.command(
        actors.owner,
        key(),
        'edit',
        event.eventId,
        edit(fields, 3),
      ),
    ).rejects.toThrow(/Cancelled/);
    await expect(
      db.query(
        'delete from calendar_event_history where calendar_event_id=$1',
        [event.eventId],
      ),
    ).rejects.toThrow(/append-only/);
  });
  it('rejects closed/cancelled jobs using stored owning association for edits/cancellation', async () => {
    for (const status of ['closed', 'cancelled']) {
      const jobId = await job();
      const event = await service.command(actors.owner, key(), 'create', null, {
        ...fields,
        jobId,
      });
      await db.query(
        'update jobs set status=$2,closed_at=now(),closed_by=$3,reconciliation_complete=true where job_id=$1',
        [jobId, status, ids.admin],
      );
      await expect(
        service.command(actors.owner, key(), 'create', null, {
          ...fields,
          jobId,
        }),
      ).rejects.toThrow(/closed|cancelled/);
      await expect(
        service.command(
          actors.owner,
          key(),
          'edit',
          event.eventId,
          edit(fields),
        ),
      ).rejects.toThrow(/closed|cancelled/);
      await expect(
        service.command(actors.owner, key(), 'cancel', event.eventId, {
          expectedRevision: 1,
        }),
      ).rejects.toThrow(/closed|cancelled/);
    }
  });
  it('validates real civil days, exclusive timed intervals, timezones and bounded spans', async () => {
    for (const patch of [
      { startsOn: '2027-02-29' },
      { endsOn: '2028-02-28' },
      { endsOn: '2030-01-01' },
      { startsAt: '2028-01-01T00:00:00.000Z' },
      { timezone: 'Not/AZone' },
      {
        allDay: false,
        startsOn: null,
        endsOn: null,
        startsAt: '2028-01-01T00:00:00.000Z',
        endsAt: '2028-01-01T00:00:00.000Z',
      },
    ])
      await expect(
        service.command(actors.owner, key(), 'create', null, {
          ...fields,
          ...patch,
        }),
      ).rejects.toThrow();
    const timed = {
      ...fields,
      allDay: false,
      startsOn: null,
      endsOn: null,
      startsAt: '2026-11-01T06:30:00.000Z',
      endsAt: '2026-11-01T08:30:00.000Z',
      timezone: 'America/Chicago',
    };
    const saved = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      timed,
    );
    expect(saved.startsAt).toBe(timed.startsAt);
    expect(saved.endsAt).toBe(timed.endsAt);
    expect(saved.timezone).toBe('America/Chicago');
  });
  it('serializes owning-job closure before appointment creation without writes', async () => {
    const jobId = await job();
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const ready = new Promise<void>((r) => (locked = r));
    const closing = db.transaction(async (tx) => {
      await tx.query('select job_id from jobs where job_id=$1 for update', [
        jobId,
      ]);
      locked();
      await gate;
      await tx.query(
        "update jobs set status='closed',closed_at=now(),closed_by=$2,reconciliation_complete=true where job_id=$1",
        [jobId, ids.admin],
      );
    });
    await ready;
    const writing = service.command(actors.owner, key(), 'create', null, {
      ...fields,
      jobId,
    });
    release();
    await closing;
    await expect(writing).rejects.toThrow(/closed/);
    expect(
      (await db.query('select 1 from calendar_events where job_id=$1', [jobId]))
        .rows,
    ).toHaveLength(0);
  });
  it('authenticates API CRUD/projection/history and projects task deadlines once without copying', async () => {
    const unauthorized = await fetch(base + '/api/workspace-calendar');
    expect(unauthorized.status).toBe(403);
    const response = await call('/api/calendar-events', 'owner', fields);
    expect(response.status).toBe(201);
    const event = await response.json();
    const task = await new TaskService(db).command(
      actors.owner,
      key(),
      'create',
      null,
      {
        title: 'Deadline projection',
        detail: null,
        assignedUserId: null,
        dueDate: '2028-02-29',
        priority: 'normal',
        milestone: null,
        recurrence: 'none',
        jobId: null,
      },
    );
    const projection = await call('/api/workspace-calendar');
    expect(projection.status).toBe(200);
    const items = await projection.json();
    expect(
      items.filter((i: any) => i.id === `appointment:${event.eventId}`),
    ).toHaveLength(1);
    expect(
      items.filter((i: any) => i.id === `task:${task.taskId}`),
    ).toHaveLength(1);
    expect(
      (
        await db.query(
          "select 1 from calendar_events where snapshot->>'title'='Deadline projection'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await call(
          '/api/calendar-events/' + event.eventId + '/history',
          'other',
        )
      ).status,
    ).toBe(409);
    const editing = await call(
      `/api/calendar-events/${event.eventId}/edit`,
      'owner',
      { ...edit(fields), title: 'API edit' },
    );
    expect(editing.status).toBe(200);
    expect(
      (
        await call(`/api/calendar-events/${event.eventId}/cancel`, 'owner', {
          expectedRevision: 2,
        })
      ).status,
    ).toBe(200);
    const legacy = await call('/api/calendar');
    expect(legacy.status).toBe(200);
    expect((await legacy.json()).every((i: any) => i.taskType && i.jobId)).toBe(
      true,
    );
  });
});
