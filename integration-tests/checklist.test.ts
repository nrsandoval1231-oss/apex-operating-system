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
import {
  TaskService,
  nextTaskDate,
} from '../packages/gate-service/src/tasks.ts';
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
let service: TaskService;
let server: ReturnType<typeof createGateApi>;
let base: string;
const secret = 'checklist-synthetic-only-secret-long-enough';
const fields = {
  title: 'Synthetic checklist',
  detail: null,
  assignedUserId: ids.owner,
  dueDate: '2026-01-31',
  priority: 'normal',
  milestone: null,
  recurrence: 'none',
  jobId: null,
};
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
    applicationName: 'checklist-tests',
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
  service = new TaskService(db);
  server = createGateApi({
    db,
    jwtSecret: secret,
    storage: new LocalEvidenceStorage('/tmp/apex2/checklist-test-storage'),
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (server)
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  if (db) await db.close();
});
describe.skipIf(!url)('canonical checklist on real PostgreSQL', () => {
  it('persists and enforces personal creator/assignee privacy even against unrelated managers', async () => {
    const t = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      fields,
    );
    expect(
      (await new TaskService(db).list(actors.owner)).map((t) => t.taskId),
    ).toContain(t.taskId);
    for (const a of [actors.other, actors.admin]) {
      expect((await service.list(a)).map((t) => t.taskId)).not.toContain(
        t.taskId,
      );
      await expect(service.history(a, t.taskId)).rejects.toThrow(/not found/);
      await expect(
        service.command(a, key(), 'complete', t.taskId, {
          expectedRevision: 1,
        }),
      ).rejects.toThrow(/not found/);
    }
    const shared = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      assignedUserId: ids.other,
    });
    expect((await service.list(actors.other)).map((t) => t.taskId)).toContain(
      shared.taskId,
    );
  });
  it('binds exact saved retries to actor, action, target and normalized body', async () => {
    const k = key();
    const t = await service.command(actors.owner, k, 'create', null, fields);
    await service.command(actors.owner, key(), 'edit', t.taskId, {
      title: 'Later edit',
      detail: null,
      assignedUserId: ids.owner,
      dueDate: '2026-01-31',
      priority: 'normal',
      milestone: null,
      recurrence: 'none',
      expectedRevision: 1,
    });
    expect(
      await service.command(actors.owner, k, 'create', null, {
        ...fields,
        title: ' Synthetic checklist ',
      }),
    ).toEqual(t);
    await expect(
      service.command(actors.owner, k, 'create', null, {
        ...fields,
        title: 'different',
      }),
    ).rejects.toThrow(/Idempotency/);
    await expect(
      service.command(actors.other, k, 'create', null, fields),
    ).rejects.toThrow(/Idempotency/);
    await expect(
      service.command(actors.owner, k, 'complete', t.taskId, {
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/Idempotency/);
  });
  it('rejects inactive/customer assignees, customer actors, inactive actors and stale revisions', async () => {
    for (const assignedUserId of [ids.inactive, ids.customer])
      await expect(
        service.command(actors.owner, key(), 'create', null, {
          ...fields,
          assignedUserId,
        }),
      ).rejects.toThrow(/active staff/);
    for (const a of [actors.customer, actors.inactive])
      await expect(service.list(a)).rejects.toThrow(/staff/i);
    const t = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      fields,
    );
    const { jobId: _, ...edit } = fields;
    await service.command(actors.owner, key(), 'edit', t.taskId, {
      ...edit,
      expectedRevision: 1,
      title: 'Changed',
    });
    await expect(
      service.command(actors.owner, key(), 'complete', t.taskId, {
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/changed/);
  });
  it('completes concurrently once, preserves original dates/history and produces one monthly successor', async () => {
    const t = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      recurrence: 'monthly',
    });
    const k = key();
    const result = await Promise.all(
      [1, 2, 3].map(() =>
        service.command(actors.owner, k, 'complete', t.taskId, {
          expectedRevision: 1,
        }),
      ),
    );
    expect(result[0]).toEqual(result[1]);
    expect(result[0]?.dueDate).toBe('2026-01-31');
    const next = (await service.list(actors.owner)).filter(
      (v) => v.parentTaskId === t.taskId,
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.dueDate).toBe('2026-02-28');
    expect(next[0]?.completedAt).toBeNull();
    expect(
      (await service.history(actors.owner, t.taskId)).map((h: any) => h.action),
    ).toEqual(['created', 'completed']);
    const separate = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      { ...fields, recurrence: 'daily' },
    );
    const race = await Promise.allSettled(
      [1, 2].map(() =>
        service.command(actors.owner, key(), 'complete', separate.taskId, {
          expectedRevision: 1,
        }),
      ),
    );
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await service.list(actors.owner)).filter(
        (v) => v.parentTaskId === separate.taskId,
      ),
    ).toHaveLength(1);
    expect(nextTaskDate('2024-01-31', 'monthly')).toBe('2024-02-29');
    expect(nextTaskDate('2026-12-31', 'monthly')).toBe('2027-01-31');
    expect(nextTaskDate('2026-12-31', 'weekly')).toBe('2027-01-07');
  });
  it('refuses recurring completion when its assignee is deactivated without losing the occurrence', async () => {
    const t = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      assignedUserId: ids.other,
      recurrence: 'weekly',
    });
    await db.query('update app_users set active=false where user_id=$1', [
      ids.other,
    ]);
    try {
      await expect(
        service.command(actors.owner, key(), 'complete', t.taskId, {
          expectedRevision: 1,
        }),
      ).rejects.toThrow(/Reassign/);
      expect(
        (await service.list(actors.owner)).find((v) => v.taskId === t.taskId)
          ?.completedAt,
      ).toBeNull();
    } finally {
      await db.query('update app_users set active=true where user_id=$1', [
        ids.other,
      ]);
    }
  });
  it('uses existing staff project visibility and manager edit authority without gate or phase side effects', async () => {
    const j = await job();
    const t = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      jobId: j,
    });
    expect(
      (await service.list(actors.other, j)).map((v) => v.taskId),
    ).toContain(t.taskId);
    await expect(
      service.command(actors.other, key(), 'complete', t.taskId, {
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/creator/);
    const before = (await db.query('select * from jobs where job_id=$1', [j]))
      .rows;
    const eventsBefore = (
      await db.query('select * from events where job_id=$1', [j])
    ).rows;
    const gates = (
      await db.query('select * from gate_instances where job_id=$1', [j])
    ).rows;
    await service.command(actors.admin, key(), 'complete', t.taskId, {
      expectedRevision: 1,
    });
    expect(
      (await db.query('select * from events where job_id=$1', [j])).rows,
    ).toEqual(eventsBefore);
    expect(
      (await db.query('select * from jobs where job_id=$1', [j])).rows,
    ).toEqual(before);
    expect(
      (await db.query('select * from gate_instances where job_id=$1', [j]))
        .rows,
    ).toEqual(gates);
  });
  it('serializes project writes behind job closure and refuses closed/cancelled writes including recurrence', async () => {
    for (const status of ['closed', 'cancelled']) {
      const j = await job();
      const t = await service.command(actors.owner, key(), 'create', null, {
        ...fields,
        jobId: j,
        recurrence: 'daily',
      });
      let locked!: () => void;
      const lock = new Promise<void>((r) => (locked = r));
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const close = db.transaction(async (tx) => {
        await tx.query('select 1 from jobs where job_id=$1 for update', [j]);
        locked();
        await gate;
        await tx.query(
          'update jobs set status=$2,closed_at=now(),closed_by=$3,reconciliation_complete=true where job_id=$1',
          [j, status, ids.admin],
        );
      });
      await lock;
      const write = service.command(actors.owner, key(), 'complete', t.taskId, {
        expectedRevision: 1,
      });
      release();
      await close;
      await expect(write).rejects.toThrow(/closed or cancelled/);
      await expect(
        service.command(actors.owner, key(), 'create', null, {
          ...fields,
          jobId: j,
        }),
      ).rejects.toThrow(/closed or cancelled/);
      expect(
        (await service.list(actors.owner)).filter(
          (v) => v.parentTaskId === t.taskId,
        ),
      ).toHaveLength(0);
    }
  });
  it('reads personal visibility and history in one snapshot during reassignment', async () => {
    const t = await service.command(actors.owner, key(), 'create', null, {
      ...fields,
      assignedUserId: ids.other,
    });
    let reassigned = false;
    const racing = new TaskService({
      transaction: db.transaction.bind(db),
      query: async <Row>(sql: string, params?: unknown[]) => {
        const result = await db.query<Row>(sql, params);
        if (!reassigned && sql.includes('from tasks')) {
          reassigned = true;
          const { jobId: _, ...edit } = fields;
          await service.command(actors.owner, key(), 'edit', t.taskId, {
            ...edit,
            assignedUserId: null,
            expectedRevision: 1,
            title: 'Private after reassignment',
          });
        }
        return result;
      },
    });
    const entries = (await racing.history(actors.other, t.taskId)) as {
      snapshot: { title: string };
    }[];
    expect(reassigned).toBe(true);
    expect(entries).toHaveLength(1);
    expect(
      entries.some((h) => h.snapshot.title === 'Private after reassignment'),
    ).toBe(false);
    await expect(service.history(actors.other, t.taskId)).rejects.toThrow(
      /not found/,
    );
  });
  it('enforces append-only completion audit and request receipts in PostgreSQL', async () => {
    const t = await service.command(
      actors.owner,
      key(),
      'create',
      null,
      fields,
    );
    await expect(
      db.query('delete from task_history where task_id=$1', [t.taskId]),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.query(
        `update task_receipts set binding='changed' where response->>'taskId'=$1`,
        [t.taskId],
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      service.command(actors.owner, 'short', 'create', null, fields),
    ).rejects.toThrow(/8 to 200/);
  });
  it('API validates strict bodies, refuses unauthenticated/customer access and hides private history', async () => {
    expect((await fetch(base + '/api/tasks')).status).toBe(403);
    expect((await call('/api/tasks', 'customer')).status).toBe(403);
    expect(
      (await call('/api/tasks', 'owner', { ...fields, unknown: true })).status,
    ).toBe(422);
    const res = await call('/api/tasks', 'owner', fields);
    expect(res.status).toBe(201);
    const t = await res.json();
    expect(
      (await call(`/api/tasks/${t.taskId}/history`, 'other')).status,
    ).not.toBe(200);
    expect(
      (await call(`/api/tasks/${t.taskId}/complete`, 'owner', {})).status,
    ).toBe(422);
    expect(
      (
        await call(`/api/tasks/${t.taskId}/complete`, 'owner', {
          expectedRevision: 1,
        })
      ).status,
    ).toBe(200);
    expect((await call(`/api/tasks/${t.taskId}/history`)).status).toBe(200);
  });
});
