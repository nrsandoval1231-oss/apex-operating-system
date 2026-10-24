import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from '../apps/gate-api/node_modules/jose/dist/webapi/index.js';
import {
  createCanonicalId,
  type EventActor,
  type JobId,
} from '../packages/contracts/src/index.ts';
import {
  PostgresDatabase,
  applyOperationalMigrations,
} from '../packages/database/src/index.ts';
import {
  S3EvidenceStorage,
  ObjectExistsError,
  type EvidenceStorage,
} from '../packages/storage/src/index.ts';
import { JobPhotoService } from '../packages/gate-service/src/jobPhotos.ts';
import { createGateApi } from '../apps/gate-api/src/server.ts';
const url = process.env.DATABASE_URL;
const configuredS3 = !!process.env.S3_ENDPOINT;
const secret = 'photo-test-synthetic-secret-long-enough';
const ids = Object.fromEntries(
  ['admin', 'field', 'other', 'customer', 'inactive', 'superintendent'].map(
    (key) => [key, createCanonicalId('user')],
  ),
);
let db: PostgresDatabase,
  storage: S3EvidenceStorage,
  server: ReturnType<typeof createGateApi>,
  base: string;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
const payload = {
  mimeType: 'image/png',
  contentBase64: png.toString('base64'),
};
function actor(who = 'field'): EventActor {
  return {
    kind: 'user',
    userId: ids[who] as never,
    role: who === 'other' || who === 'inactive' ? 'field' : (who as never),
  };
}
async function job(): Promise<JobId> {
  const lead = createCanonicalId('lead'),
    id = createCanonicalId('job');
  await db.query(
    `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$2,$2,'{"first_name":"Photo","last_name":"Test","vertical":"Designer Pools"}'::jsonb)`,
    [lead, randomUUID()],
  );
  await db.query(
    `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
    [id, lead],
  );
  return id;
}
async function request(
  path: string,
  body?: unknown,
  who = 'field',
  key = randomUUID(),
  method?: string,
) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ids[who]!)
    .setIssuer('apex-gate')
    .setAudience('apex-gate-api')
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
  return fetch(base + path, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeAll(async () => {
  if (!url || !configuredS3) return;
  db = PostgresDatabase.create({
    url,
    maxConnections: 10,
    applicationName: 'photos-integration',
  });
  await db.withMigrationLock((c) => applyOperationalMigrations(c));
  for (const [role, id] of Object.entries(ids))
    await db.query(
      `insert into app_users(user_id,auth_user_id,role,display_name,active) values($1,gen_random_uuid(),$2,$3,$4)`,
      [
        id,
        ['other', 'inactive'].includes(role) ? 'field' : role,
        `Photo ${role}`,
        role !== 'inactive',
      ],
    );
  storage = new S3EvidenceStorage({
    endpoint: process.env.S3_ENDPOINT!,
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  });
  server = createGateApi({
    db,
    storage,
    jwtSecret: secret,
    publicOrigin: 'http://photos.test',
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (db) await db.close();
});
describe.skipIf(!url || !configuredS3)(
  'optional jobsite photos: PostgreSQL, HTTP and S3-compatible object store',
  () => {
    it('roundtrips optional metadata-free photos through real S3 storage without gate state/events', async () => {
      const id = await job(),
        path = `/api/jobs/${id}/photos`;
      const before = await db.query('select * from events where job_id=$1', [
        id,
      ]);
      const photos = [];
      for (let i = 0; i < 2; i++) {
        const response = await request(path, payload);
        expect(response.status).toBe(201);
        const photo = await response.json();
        photos.push(photo);
        expect(photo).toMatchObject({
          purpose: 'jobsite-photo',
          gateTitle: null,
          requirementKey: null,
          stage: null,
          category: null,
          internalCaption: null,
          originalCapturedAt: null,
          customerVisible: false,
          uploaderName: 'Photo field',
        });
        expect(photo.capturedAt).toBe(photo.uploadedAt);
        expect(await storage.get(photo.objectReference)).toEqual(png);
        const bytes = await request(`/api/evidence/${photo.evidenceId}`);
        expect(bytes.status).toBe(200);
        expect(bytes.headers.get('cache-control')).toBe('private, no-store');
        expect(Buffer.from(await bytes.arrayBuffer())).toEqual(png);
      }
      expect(await (await request(path)).json()).toHaveLength(2);
      expect(
        (await db.query('select * from events where job_id=$1', [id])).rows,
      ).toEqual(before.rows);
      expect(
        (await db.query('select * from gate_instances where job_id=$1', [id]))
          .rows,
      ).toHaveLength(0);
      const activity = await (await request(`/api/jobs/${id}/activity`)).json();
      expect(
        activity.filter((a: { source: string }) => a.source === 'photo'),
      ).toHaveLength(2);
    });
    it('binds exact retries to bytes, metadata, actor and job; concurrent duplicate is one object and receipt', async () => {
      const id = await job(),
        path = `/api/jobs/${id}/photos`,
        key = randomUUID();
      const responses = await Promise.all([
        request(path, payload, 'field', key),
        request(path, payload, 'field', key),
      ]);
      expect(responses.map((r) => r.status)).toEqual([201, 201]);
      const a = await responses[0]!.json(),
        b = await responses[1]!.json();
      expect(a).toEqual(b);
      for (const change of [
        { ...payload, caption: 'Changed' },
        { ...payload, stage: 'Gunite' },
        { ...payload, category: 'after' },
        { ...payload, contentBase64: png.subarray(0, -1).toString('base64') },
      ])
        expect((await request(path, change, 'field', key)).status).toBe(409);
      expect((await request(path, payload, 'other', key)).status).toBe(409);
      expect(
        (
          await request(
            `/api/jobs/${await job()}/photos`,
            payload,
            'field',
            key,
          )
        ).status,
      ).toBe(409);
      expect(
        (await db.query('select 1 from evidence_records where job_id=$1', [id]))
          .rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            'select 1 from jobsite_photo_uploads where job_id=$1',
            [id],
          )
        ).rows,
      ).toHaveLength(1);
      await expect(
        db.query(
          'update jobsite_photo_uploads set request_digest=request_digest where job_id=$1',
          [id],
        ),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.query(
          "update evidence_records set caption='tamper' where job_id=$1",
          [id],
        ),
      ).rejects.toThrow(/immutable/);
    });
    it('replays lost acknowledgement after closure without writing bytes; new uploads refuse', async () => {
      const id = await job(),
        key = randomUUID(),
        svc = new JobPhotoService(db, storage);
      const photo = await svc.upload(actor(), id, key, payload);
      await db.query(
        "update jobs set status='closed',closed_at=now(),closed_by=(select user_id from app_users where role='admin' limit 1),reconciliation_complete=true where job_id=$1",
        [id],
      );
      let writes = 0;
      const wrapped: EvidenceStorage = {
        put: async () => {
          writes++;
          throw Error('unexpected write');
        },
        get: (k) => storage.get(k),
        remove: (k) => storage.remove(k),
        isReachable: () => storage.isReachable(),
        describe: () => storage.describe(),
      };
      expect(
        await new JobPhotoService(db, wrapped).upload(
          actor(),
          id,
          key,
          payload,
        ),
      ).toEqual(photo);
      expect(writes).toBe(0);
      await expect(
        new JobPhotoService(db, wrapped).upload(
          actor(),
          id,
          randomUUID(),
          payload,
        ),
      ).rejects.toThrow(/closed/);
      expect(writes).toBe(0);
      expect(
        await (await request(`/api/jobs/${id}/photos`)).json(),
      ).toHaveLength(1);
    });
    it('denies customer/inactive/missing idempotency and rejects MIME, strict base64, size before storage', async () => {
      const id = await job(),
        path = `/api/jobs/${id}/photos`;
      for (const who of ['customer', 'inactive'])
        expect((await request(path, payload, who)).status).toBe(403);
      expect((await request(path, payload, 'field', '')).status).toBe(422);
      for (const change of [
        { ...payload, mimeType: 'image/svg+xml' },
        { ...payload, mimeType: 'image/heic' },
        { ...payload, mimeType: 'image/jpeg' },
        { ...payload, contentBase64: 'a===' },
        { ...payload, contentBase64: payload.contentBase64 + '\n' },
        {
          ...payload,
          contentBase64: Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64'),
        },
      ])
        expect([409, 422]).toContain((await request(path, change)).status);
      expect(
        (await db.query('select 1 from evidence_records where job_id=$1', [id]))
          .rows,
      ).toHaveLength(0);
    });
    it('cleans only owned orphan on object/DB failure and safely retries same intent', async () => {
      const id = await job(),
        key = randomUUID(),
        keys: string[] = [],
        removed: string[] = [];
      const failing: EvidenceStorage = {
        put: async (k, b, t) => {
          keys.push(k);
          await storage.put(k, b, t);
          throw Error('lost object acknowledgement');
        },
        get: (k) => storage.get(k),
        remove: async (k) => {
          removed.push(k);
          await storage.remove(k);
        },
        isReachable: () => storage.isReachable(),
        describe: () => storage.describe(),
      };
      await expect(
        new JobPhotoService(db, failing).upload(actor(), id, key, payload),
      ).rejects.toThrow('lost object acknowledgement');
      expect(removed).toEqual(keys);
      expect(await storage.get(keys[0]!)).toBe(null);
      expect(
        (await db.query('select 1 from evidence_records where job_id=$1', [id]))
          .rows,
      ).toHaveLength(0);
      const photo = await new JobPhotoService(db, storage).upload(
        actor(),
        id,
        key,
        payload,
      );
      expect(await storage.get(photo.objectReference!)).toEqual(png);
      let deletes = 0;
      const collision: EvidenceStorage = {
        ...failing,
        put: async (k) => {
          throw new ObjectExistsError(k);
        },
        remove: async () => {
          deletes++;
        },
      };
      await expect(
        new JobPhotoService(db, collision).upload(
          actor(),
          id,
          randomUUID(),
          payload,
        ),
      ).rejects.toThrow(/exists/);
      expect(deletes).toBe(0);
      // A database failure after object creation also rolls back receipt and removes the orphan.
      let failedKey = '';
      const dbFailure: EvidenceStorage = {
        ...failing,
        put: async (k, b, t) => {
          failedKey = k;
          await storage.put(k, b, t);
        },
      };
      // Insert failure is injected at the database port without changing canonical tables.
      const brokenDb = {
        query: db.query.bind(db),
        transaction: <T>(
          work: (
            tx: import('../packages/database/src/index.ts').Queryable,
          ) => Promise<T>,
        ) =>
          db.transaction((tx) =>
            work({
              query: async (sql, params) => {
                if (sql.includes('insert into evidence_records'))
                  throw Error('injected insert failure');
                return tx.query(sql, params);
              },
            }),
          ),
      };
      await expect(
        new JobPhotoService(brokenDb, dbFailure).upload(
          actor(),
          id,
          randomUUID(),
          payload,
        ),
      ).rejects.toThrow('injected insert failure');
      expect(await storage.get(failedKey)).toBe(null);
    });
    it('serializes closure with upload under the job lock', async () => {
      const id = await job();
      let release!: () => void, entered!: () => void;
      const paused = new Promise<void>((r) => (release = r)),
        started = new Promise<void>((r) => (entered = r));
      const delayed: EvidenceStorage = {
        put: async (k, b, t) => {
          entered();
          await paused;
          await storage.put(k, b, t);
        },
        get: (k) => storage.get(k),
        remove: (k) => storage.remove(k),
        isReachable: () => storage.isReachable(),
        describe: () => storage.describe(),
      };
      const upload = new JobPhotoService(db, delayed).upload(
        actor(),
        id,
        randomUUID(),
        payload,
      );
      await started;
      let closed = false;
      const closure = db
        .query(
          "update jobs set status='closed',closed_at=now(),closed_by=(select user_id from app_users where role='admin' limit 1),reconciliation_complete=true where job_id=$1",
          [id],
        )
        .then(() => {
          closed = true;
        });
      await new Promise((r) => setTimeout(r, 60));
      expect(closed).toBe(false);
      release();
      await upload;
      await closure;
      expect(closed).toBe(true);
      await expect(
        new JobPhotoService(db, storage).upload(
          actor(),
          id,
          randomUUID(),
          payload,
        ),
      ).rejects.toThrow(/closed/);
    });
    it('preserves controlled publication, private captions, cross-job isolation and token revocation', async () => {
      const id = await job(),
        other = await job();
      const photo = await (
        await request(`/api/jobs/${id}/photos`, {
          ...payload,
          caption: 'INTERNAL PRIVATE',
          stage: 'Excavation',
          category: 'before',
        })
      ).json();
      const link = await (
        await request(`/api/jobs/${id}/customer-link`, {}, 'admin')
      ).json();
      const otherLink = await (
        await request(`/api/jobs/${other}/customer-link`, {}, 'admin')
      ).json();
      const token = new URL(link.url).pathname.split('/').at(-1),
        otherToken = new URL(otherLink.url).pathname.split('/').at(-1);
      expect(
        (await fetch(`${base}/c/${token}/photo/${photo.evidenceId}`)).status,
      ).toBe(404);
      expect(
        (
          await request(
            `/api/evidence/${photo.evidenceId}/visibility`,
            { visible: true },
            'field',
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/api/evidence/${photo.evidenceId}/visibility`,
            { visible: true, caption: 'Customer progress' },
            'superintendent',
          )
        ).status,
      ).toBe(200);
      const page = await (await fetch(`${base}/c/${token}`)).text();
      expect(page).toContain('Customer progress');
      expect(page).not.toContain('INTERNAL PRIVATE');
      expect(page).not.toContain('/photos/evidence_');
      expect(
        (await fetch(`${base}/c/${token}/photo/${photo.evidenceId}`)).status,
      ).toBe(200);
      expect(
        (await fetch(`${base}/c/${otherToken}/photo/${photo.evidenceId}`))
          .status,
      ).toBe(404);
      expect(
        (
          await request(
            `/api/evidence/${photo.evidenceId}`,
            undefined,
            'customer',
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/api/jobs/${id}/customer-link`,
            {},
            'admin',
            randomUUID(),
            'DELETE',
          )
        ).status,
      ).toBe(200);
      expect(
        (await fetch(`${base}/c/${token}/photo/${photo.evidenceId}`)).status,
      ).toBe(404);
    });
  },
);
