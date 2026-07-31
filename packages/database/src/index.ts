import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = resolve(here, '../migrations');

export const OPERATIONAL_MIGRATIONS = [
  '0001_core.sql',
  '0002_rls.sql',
  '0004_pre_gunite_definition.sql',
  '0005_gate_instance_uniqueness.sql',
  '0006_approved_takeoff_authority.sql',
  '0007_quantity_payload_digest.sql',
  '0008_proposal_versions.sql',
  '0009_job_binding.sql',
] as const;

export const STORAGE_MIGRATION = '0003_evidence_storage.sql';

type MigrationClient = Pick<PGlite, 'exec' | 'query'>;

export async function applyOperationalMigrations(db: MigrationClient): Promise<void> {
  await db.exec(`
    create table if not exists schema_migrations (
      migration_name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migrationName of OPERATIONAL_MIGRATIONS) {
    const applied = await db.query<{ migration_name: string }>(
      'select migration_name from schema_migrations where migration_name = $1',
      [migrationName],
    );
    if (applied.rows.length > 0) continue;
    const sql = await readFile(resolve(migrationsDirectory, migrationName), 'utf8');
    await db.exec(sql);
    await db.query('insert into schema_migrations (migration_name) values ($1)', [migrationName]);
  }
}

export async function createLocalDatabase(dataDirectory?: string): Promise<PGlite> {
  const db = dataDirectory ? new PGlite(`file://${resolve(dataDirectory)}`) : new PGlite();
  await applyOperationalMigrations(db);
  return db;
}
