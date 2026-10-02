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
 */

import { applyOperationalMigrations, PostgresDatabase } from '../packages/database/dist/index.js';
import { removeDemoProject, seedDemoProject } from '../packages/gate-service/dist/demoSeed.js';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const remove = process.argv.includes('--remove');
const db = PostgresDatabase.create({ url, applicationName: 'apex-demo-seed' });

try {
  await db.withMigrationLock((client) => applyOperationalMigrations(client));
  if (remove) {
    const result = await removeDemoProject(db);
    console.log(result.removed
      ? 'Removed the Lubbock DEMO project.'
      : 'No Lubbock DEMO project was present.');
  } else {
    const seeded = await seedDemoProject(db);
    console.log(`job id: ${seeded.jobId}`);
    console.log(`customer link: ${seeded.customerPath}`);
  }
} finally {
  await db.close();
}
