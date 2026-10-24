import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  PostgresDatabase,
  OPERATIONAL_MIGRATIONS,
  applyOperationalMigrations,
} from '../packages/database/src/index.ts';
import { createCanonicalId } from '../packages/contracts/src/index.ts';
import { S3EvidenceStorage } from '../packages/storage/src/index.ts';

const url = process.env.DATABASE_URL;
describe.skipIf(!url || !process.env.S3_ENDPOINT)(
  '0040 upgrade with populated legacy evidence',
  () => {
    it('backfills gate purpose without changing existing links, publication or stored bytes', async () => {
      const admin = PostgresDatabase.create({ url: url!, maxConnections: 1 });
      // Generated identifier contains only letters, underscores and UUID hex.
      const name = 'photo_upgrade_' + randomUUID().replaceAll('-', '');
      const temporaryUrl = new URL(url!);
      temporaryUrl.pathname = '/' + name;
      let db: PostgresDatabase | undefined;
      const storage = new S3EvidenceStorage({
        endpoint: process.env.S3_ENDPOINT!,
        bucket: process.env.S3_BUCKET!,
        region: process.env.S3_REGION!,
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      });
      let storageKey: string | undefined;
      try {
        await admin.query(`create database ${name}`);
        db = PostgresDatabase.create({
          url: temporaryUrl.toString(),
          maxConnections: 1,
        });
        await db.withMigrationLock(async (client) => {
          await client.exec(
            'create table schema_migrations(migration_name text primary key,applied_at timestamptz not null default now())',
          );
          for (const migration of OPERATIONAL_MIGRATIONS.filter(
            (value) => value !== '0040_jobsite_photos.sql',
          )) {
            await client.exec(
              await readFile(
                new URL(
                  `../packages/database/migrations/${migration}`,
                  import.meta.url,
                ),
                'utf8',
              ),
            );
            await client.query(
              'insert into schema_migrations(migration_name) values($1)',
              [migration],
            );
          }
        });
        const user = createCanonicalId('user'),
          lead = createCanonicalId('lead'),
          job = createCanonicalId('job'),
          gate = createCanonicalId('gate'),
          revision = createCanonicalId('revision'),
          evidence = createCanonicalId('evidence');
        await db.query(
          `insert into app_users(user_id,auth_user_id,role,display_name) values($1,gen_random_uuid(),'admin','Upgrade fixture')`,
          [user],
        );
        await db.query(
          `insert into leads(lead_id,intake_source,source_record_id,idempotency_key,accepted_payload) values($1,'test',$1,$1,'{}')`,
          [lead],
        );
        await db.query(
          `insert into jobs(job_id,lead_id,signed_proposal_version,status) values($1,$2,1,'active')`,
          [job, lead],
        );
        await db.query(
          `insert into takeoff_revisions(revision_id,job_id,revision_number,status,engine_version,quantity_model_version,job_input_sha256,calc_ledger_sha256,quantity_payload_sha256,quantities,calc_ledger,created_by,approved_at,approved_by)
       values($1,$2,1,'approved','upgrade','v1',repeat('a',64),repeat('b',64),repeat('c',64),'[{"code":"pool.water-volume","value":1,"unit":"gal","calcId":"fixture"}]','[{"id":"fixture","label":"Fixture","formula":"1","inputs":[],"value":1,"unit":"gal"}]',$3,now(),$3)`,
          [revision, job, user],
        );
        await db.query(
          `insert into gate_instances(gate_instance_id,job_id,definition_key,definition_version,approved_takeoff_revision_id,status) values($1,$2,'pre-gunite',2,$3,'in-progress')`,
          [gate, job, revision],
        );
        storageKey = `${job}/${gate}/${evidence}.png`;
        const bytes = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
          'base64',
        );
        await storage.put(storageKey, bytes, 'image/png');
        await db.query(
          `insert into evidence_records(evidence_id,job_id,gate_instance_id,requirement_key,kind,storage_key,sha256,captured_at,captured_by,mime_type,byte_size,caption,customer_visible,customer_caption,visibility_set_at,visibility_set_by)
       values($1,$2,$3,'steel-placement-verified','photo',$4,$5,now(),$6,'image/png',$7,'Internal legacy',true,'Published legacy',now(),$6)`,
          [
            evidence,
            job,
            gate,
            storageKey,
            createHash('sha256').update(bytes).digest('hex'),
            user,
            bytes.length,
          ],
        );
        const before = (
          await db.query(
            'select * from evidence_records where evidence_id=$1',
            [evidence],
          )
        ).rows[0];
        await db.withMigrationLock((client) =>
          applyOperationalMigrations(client),
        );
        const after = (
          await db.query(
            'select * from evidence_records where evidence_id=$1',
            [evidence],
          )
        ).rows[0];
        expect(after).toEqual({
          ...(before as object),
          purpose: 'gate-requirement',
        });
        expect(await storage.get(storageKey)).toEqual(bytes);
        await expect(
          db.query(
            "update evidence_records set requirement_key='invented' where evidence_id=$1",
            [evidence],
          ),
        ).rejects.toThrow(/same job and Gate/);
        await expect(
          db.query(
            'update evidence_records set gate_instance_id=null,requirement_key=null where evidence_id=$1',
            [evidence],
          ),
        ).rejects.toThrow();
        await expect(
          db.query(
            "update evidence_records set purpose='jobsite-photo',gate_instance_id=null,requirement_key=null where evidence_id=$1",
            [evidence],
          ),
        ).rejects.toThrow(/purpose is immutable/);
        // Unrelated legacy maintenance behavior remains unchanged by the new trigger.
        await db.query('delete from evidence_records where evidence_id=$1', [
          evidence,
        ]);
        expect(
          (
            await db.query(
              'select 1 from evidence_records where evidence_id=$1',
              [evidence],
            )
          ).rows,
        ).toHaveLength(0);
      } finally {
        if (storageKey) await storage.remove(storageKey);
        if (db) await db.close();
        await admin.query(`drop database if exists ${name}`);
        await admin.close();
      }
    });
  },
);
