import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { MigrationClient } from './client.js';

export * from './client.js';
export * from './postgres.js';

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
  '0010_project_phase_model.sql',
  '0011_gate_countersign.sql',
  '0012_gate_templates.sql',
  '0013_draw_schedule.sql',
  '0014_daily_brief.sql',
  '0015_scheduled_visits.sql',
  '0016_customer_page.sql',
  '0017_gate_checklist_v2.sql',
  '0018_inspections.sql',
  '0019_rls_retired.sql',
  '0020_oidc_subject.sql',
  '0021_job_closure_reconciliation.sql',
  '0022_gunite_one_day.sql',
  '0023_remove_excavation_spoil_soil_requirements.sql',
  '0024_migrate_existing_excavation_gates.sql',
  '0025_update_pre_gunite_rough_in_checklist.sql',
  '0026_pre_gunite_dry_run_single_signature.sql',
  '0027_repair_open_pre_gunite_dry_runs.sql',
  '0028_align_pre_gunite_dry_run_status.sql',
  '0029_clear_obsolete_pre_gunite_signoff.sql',
  '0030_equipment_automation_cover_gates.sql',
  '0031_remove_countersign_from_active_gates.sql',
  '0032_proposal_workflow.sql',
] as const;

export const STORAGE_MIGRATION = '0003_evidence_storage.sql';

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
