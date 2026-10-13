/**
 * Seed or remove the fictional Lubbock DEMO job.
 *
 * Run from the repository root after `pnpm typecheck`, so the workspace
 * packages have a `dist` this file can import. Point `DATABASE_URL` at the
 * database you mean. Staging uses the same Neon string the container uses.
 *
 *   pnpm typecheck
 *   DATABASE_URL='postgres://…' node scripts/seed-demo-project.mjs
 *   DATABASE_URL='postgres://…' node scripts/seed-demo-project.mjs --remove
 *
 * A remote database also needs the evidence store the server reads
 * (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
 * and optionally `S3_REGION`). The DEMO photo is uploaded there. A local
 * database uses `GATE_EVIDENCE_DIRECTORY`, or `./var/gate-evidence`.
 */

import { resolve } from 'node:path';
import { applyOperationalMigrations, PostgresDatabase } from '../packages/database/dist/index.js';
import { removeDemoProject, seedDemoProject } from '../packages/gate-service/dist/demoSeed.js';
import { LocalEvidenceStorage, S3EvidenceStorage } from '../packages/storage/dist/index.js';

const evidenceStorage = (required) => {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const parts = { S3_ENDPOINT: endpoint, S3_BUCKET: bucket, S3_ACCESS_KEY_ID: accessKeyId, S3_SECRET_ACCESS_KEY: secretAccessKey };
  const present = Object.values(parts).filter(Boolean);
  if (present.length > 0) {
    const missing = Object.entries(parts).filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) {
      console.error(`Evidence storage is partly configured; these are missing: ${missing.join(', ')}.`);
      process.exit(1);
    }
    return new S3EvidenceStorage({
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region: process.env.S3_REGION?.trim() || 'auto',
    });
  }
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!local) {
    if (!required) {
      console.log('No S3 settings; DEMO photo objects, if any, are left in the bucket.');
      return undefined;
    }
    console.error(
      'Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY so the DEMO photo is uploaded to the same store the server reads.',
    );
    process.exit(1);
  }
  const directory = resolve(process.env.GATE_EVIDENCE_DIRECTORY ?? './var/gate-evidence');
  console.log(`evidence: ${directory}`);
  return new LocalEvidenceStorage(directory);
};

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const remove = process.argv.includes('--remove');
const storage = evidenceStorage(!remove);
const db = PostgresDatabase.create({ url, applicationName: 'apex-demo-seed' });

try {
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  if (remove) {
    const result = await removeDemoProject(db, storage);
    console.log(result.removed
      ? 'Removed the Lubbock DEMO project.'
      : 'No Lubbock DEMO project was present.');
  } else {
    const seeded = await seedDemoProject(db, storage);
    console.log(`job id: ${seeded.jobId}`);
    console.log(`customer link: ${seeded.customerPath}`);
  }
} finally {
  await db.close();
}
