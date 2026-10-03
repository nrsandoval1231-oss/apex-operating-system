import { createHash } from 'node:crypto';
import type { Database } from '@apex/database';
import {
  AUTHORITATIVE_QUANTITY_UNITS,
  createCanonicalId,
  type AuthoritativeQuantityCode,
  type DesignerTakeoffSubmission,
  type EventActor,
  type EvidenceKind,
  type JobId,
} from '@apex/contracts';
import {
  DIRECT_LINE_DEFINITIONS,
  MEASURED_LINE_DEFINITIONS,
  type DirectPriceInput,
  type MeasuredPriceInput,
} from '@apex/pricing-engine';
import { StorageKeyError, assertStorageKey } from '@apex/storage';
import { CustomerService } from './customer.js';
import { GateService } from './index.js';

/**
 * One fictional Lubbock job for staging screenshots.
 *
 * The ids and the customer token are fixed so a second run finds the same
 * rows. The token is not a staff credential. It is the link for a made-up
 * homeowner, and `--remove` deletes that job.
 */

/** `user_` plus 26 Crockford characters. No I, L, O, or U. */
export const DEMO_USER_ID = 'user_7ZZZZZZZZZZZZZZZZZZZZZZZZZ';
/** Same job on every seed, including after `--remove` and a fresh run. */
export const DEMO_JOB_ID = 'job_7ZZZZZZZZZZZZZZZZZZZZZZZZZ';
export const DEMO_USER_EMAIL = 'demo.staff@example.com';
const DEMO_AUTH_USER_ID = '00000000-0000-4000-8000-0000000000d1';
export const DEMO_LEAD_KEY = 'demo:lubbock-sports-pool';
const DEMO_INTAKE_SOURCE = 'demo';
const DEMO_SOURCE_RECORD_ID = 'lubbock-sports-pool';
export const DEMO_CUSTOMER_NAME = 'DEMO Casey Rivera';
export const DEMO_STREET = '1400 Demo Basin Lane';
export const DEMO_CITY = 'Lubbock';
export const DEMO_STATE = 'TX';
export const DEMO_POSTAL = '79401';

/**
 * 43 URL-safe characters. The same value every run, so the printed `/c/` path
 * does not rotate. `customer.ts` stores only the SHA-256 of this string.
 */
export const DEMO_CUSTOMER_TOKEN = 'demo_lubbock_pool_link_token_00000000000000';
export const DEMO_FEE_RATE_BPS = 3000;
const DEMO_AT = '2026-09-15T15:00:00.000Z';
const COMPLETED_GATES = ['permit', 'excavation'] as const;

const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

if (!/^user_[0-9A-HJKMNP-TV-Z]{26}$/.test(DEMO_USER_ID)) {
  throw new Error('DEMO_USER_ID is not a canonical user id.');
}
if (!/^job_[0-9A-HJKMNP-TV-Z]{26}$/.test(DEMO_JOB_ID)) {
  throw new Error('DEMO_JOB_ID is not a canonical job id.');
}
if (!/^[A-Za-z0-9_-]{43}$/.test(DEMO_CUSTOMER_TOKEN)) {
  throw new Error('DEMO_CUSTOMER_TOKEN must be 43 URL-safe characters.');
}

/**
 * Extended amounts for a 16 by 32 foot gunite pool in Lubbock.
 *
 * The pricing engine does not multiply a rate by a quantity. Each `amountCents`
 * is the line total an estimator would type. The basis states the rate so the
 * figure can be checked. `finishEstimate` is what adds the fee and the total.
 */
const MEASURED_QUOTES: Readonly<Record<string, { readonly amountCents: number; readonly basis: string }>> = {
  'excavation-bank': {
    amountCents: 118 * 45_00,
    basis: '118 BCY bank excavation at $45/BCY. Lubbock crew estimate.',
  },
  'excavation-haul': {
    amountCents: 148 * 28_00,
    basis: '148 LCY haul-off at $28/LCY. West Texas spoil haul.',
  },
  'shell-rebar': {
    amountCents: 5100 * 1_25,
    basis: '5,100 lb reinforcing steel at $1.25/lb, placed.',
  },
  'shell-forming': {
    amountCents: 96 * 32_00,
    basis: '96 ft of forms at $32/ft for a 16x32 rectangle.',
  },
  'shell-gunite': {
    amountCents: 34 * 240_00,
    basis: '34 cy gunite at $240/cy, a current West Texas placed price.',
  },
  'finish-tile-material': {
    amountCents: 52 * 18_50,
    basis: '52 sf waterline tile at $18.50/sf material.',
  },
  'finish-tile-labor': {
    amountCents: 96 * 24_00,
    basis: '96 lf waterline tile labor at $24/lf.',
  },
  'finish-coping-material': {
    amountCents: 100 * 34_00,
    basis: '100 lf cantilever coping material at $34/lf.',
  },
  'finish-coping-labor': {
    amountCents: 100 * 19_00,
    basis: '100 lf coping labor at $19/lf.',
  },
  'finish-plaster-material': {
    amountCents: 900 * 4_75,
    basis: '900 sf plaster material at $4.75/sf.',
  },
  'finish-plaster-labor': {
    amountCents: 860 * 3_50,
    basis: '860 sf plaster labor at $3.50/sf.',
  },
  'utilities-bonding': {
    amountCents: 180 * 4_50,
    basis: '180 lf bonding conductor at $4.50/lf.',
  },
  'deck-decorative-concrete': {
    amountCents: 740 * 12_50,
    basis: '740 sf decorative deck at $12.50/sf, broom and stain.',
  },
  'pool-plumbing': {
    amountCents: 210 * 32_00,
    basis: '210 lf pool plumbing at $32/lf, equipment pad included in the run.',
  },
};

const DIRECT_QUOTES: Readonly<Record<number, DirectPriceInput>> = {
  300: {
    code: 300,
    name: 'Pool Equipment',
    scopeStatus: 'quoted',
    amountCents: 11_250_00,
    basis: 'Pump, cartridge filter, and salt cell. No heater. Lubbock supplier quote.',
  },
  500: {
    code: 500,
    name: 'Utilities - Plumber & Electrician',
    scopeStatus: 'quoted',
    amountCents: 5_400_00,
    basis: 'Licensed plumber and electrician to the equipment pad. West Texas subcontract.',
  },
  600: {
    code: 600,
    name: 'Lights',
    scopeStatus: 'quoted',
    amountCents: 1_680_00,
    basis: 'Two LED pool lights, supplied and installed.',
  },
};

export const DEMO_MEASURED_LINES: readonly MeasuredPriceInput[] = MEASURED_LINE_DEFINITIONS.map(([id]) => {
  const quote = MEASURED_QUOTES[id];
  if (!quote) throw new Error(`Demo seed is missing a measured price for ${id}.`);
  return { id, amountCents: quote.amountCents, basis: quote.basis };
});

export const DEMO_DIRECT_LINES: readonly DirectPriceInput[] = DIRECT_LINE_DEFINITIONS.map((definition) => {
  const quoted = DIRECT_QUOTES[definition.code];
  if (quoted) return quoted;
  return {
    code: definition.code,
    name: definition.name,
    scopeStatus: 'not-applicable' as const,
    amountCents: null,
    basis: 'Not in this DEMO scope. No cover, water feature, automation, or upgrade.',
  };
});

const QUANTITY_VALUES: Readonly<Record<AuthoritativeQuantityCode, number>> = {
  'pool.water-volume': 17_200,
  'pool.wetted-area': 860,
  'pool.waterline-perimeter': 96,
  'excavation.bank-volume': 118,
  'excavation.loose-volume': 148,
  'excavation.spoil-haul-volume': 148,
  'shell.gunite-ordered-volume': 34,
  'shell.reinforcing-steel-weight': 5_100,
  'shell.forming-perimeter': 96,
  'finishes.plaster-net-area': 860,
  'finishes.plaster-ordered-area': 900,
  'finishes.tile-net-length': 96,
  'finishes.tile-ordered-area': 52,
  'finishes.coping-ordered-length': 100,
  'yard.deck-area': 740,
  'plumbing.developed-run-length': 210,
  'utilities.bonding-conductor-length': 180,
};

export const demoSubmission = (): DesignerTakeoffSubmission => {
  const codes = Object.keys(QUANTITY_VALUES) as AuthoritativeQuantityCode[];
  const quantities = codes.map((code) => ({
    code,
    value: QUANTITY_VALUES[code],
    unit: AUTHORITATIVE_QUANTITY_UNITS[code],
    calcId: `calc.${code.replaceAll('-', '.')}`,
  }));
  return {
    engineVersion: 'demo-seed-v1',
    quantityModelVersion: 'demo-quantity-v1',
    jobModel: {
      label: 'DEMO 16x32 sports pool',
      shape: 'rectangle',
      lengthFt: 32,
      widthFt: 16,
      city: DEMO_CITY,
      state: DEMO_STATE,
    },
    quantities,
    calcLedger: quantities.map((fact) => ({
      id: fact.calcId,
      label: fact.code,
      formula: 'Demo quantity for the fictional Lubbock pool. Not measured on a site.',
      inputs: [],
      value: fact.value,
      unit: fact.unit,
    })),
    supersedeExisting: false,
  };
};

export interface DemoSeedResult {
  readonly jobId: string;
  readonly leadId: string;
  readonly customerPath: string;
}

const actorFor = (): EventActor => ({ kind: 'user', userId: DEMO_USER_ID, role: 'admin' });

const ensureActor = async (db: Database): Promise<EventActor> => {
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name, active, email)
     values ($1, $2, 'admin', 'DEMO Staff', true, $3)
     on conflict (user_id) do update
       set active = true, email = excluded.email, display_name = excluded.display_name`,
    [DEMO_USER_ID, DEMO_AUTH_USER_ID, DEMO_USER_EMAIL],
  );
  return actorFor();
};

const ensureLead = async (db: Database): Promise<string> => {
  const existing = await db.query<{ lead_id: string }>(
    'select lead_id from leads where idempotency_key = $1',
    [DEMO_LEAD_KEY],
  );
  const found = existing.rows[0]?.lead_id;
  if (found) return found;
  const leadId = createCanonicalId('lead');
  await db.query(
    `insert into leads
      (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, $2, $3, $4, $5::jsonb)`,
    [
      leadId,
      DEMO_INTAKE_SOURCE,
      DEMO_SOURCE_RECORD_ID,
      DEMO_LEAD_KEY,
      JSON.stringify({
        customerName: DEMO_CUSTOMER_NAME,
        streetAddress: DEMO_STREET,
        city: DEMO_CITY,
        state: DEMO_STATE,
        postalCode: DEMO_POSTAL,
      }),
    ],
  );
  return leadId;
};

const releaseGate = async (
  service: GateService,
  jobId: JobId,
  definitionKey: string,
  actor: EventActor,
): Promise<void> => {
  const opened = await service.createGate({
    gateInstanceId: createCanonicalId('gate'),
    jobId,
    definitionKey,
  });
  const gateInstanceId = opened.gateInstanceId;
  const key = (step: string) => `demo:lubbock:${definitionKey}:${step}`;
  await service.execute(
    gateInstanceId,
    { type: 'start-gate', actor, at: DEMO_AT },
    { idempotencyKey: key('start') },
  );
  for (const requirement of (await service.getGate(gateInstanceId)).requirements.values()) {
    const kind: EvidenceKind = requirement.acceptedEvidenceKinds.includes('photo')
      ? 'photo'
      : requirement.acceptedEvidenceKinds[0]!;
    const evidenceId = createCanonicalId('evidence');
    await service.execute(gateInstanceId, {
      type: 'add-evidence',
      actor,
      at: DEMO_AT,
      requirementKey: requirement.key,
      evidenceId,
      kind,
    }, {
      idempotencyKey: key(`evidence:${requirement.key}`),
      evidence: {
        evidenceId,
        requirementKey: requirement.key,
        kind,
        storageKey: `${jobId}/demo/${definitionKey}/${requirement.key}`,
        sha256: 'd'.repeat(64),
        capturedAt: DEMO_AT,
        mimeType: 'image/jpeg',
        byteSize: 128,
        caption: `DEMO ${definitionKey} — ${requirement.key}`,
        metadata: {},
      },
    });
    await service.execute(gateInstanceId, {
      type: 'evaluate-requirement',
      actor,
      at: DEMO_AT,
      requirementKey: requirement.key,
      outcome: 'passed',
    }, { idempotencyKey: key(`pass:${requirement.key}`) });
  }
  await service.execute(
    gateInstanceId,
    { type: 'release-gate', actor, at: DEMO_AT },
    { idempotencyKey: key('release') },
  );
};

const publishOnePhoto = async (db: Database, jobId: JobId, actor: EventActor): Promise<void> => {
  const photos = await db.query<{ evidence_id: string; customer_visible: boolean }>(
    `select er.evidence_id, er.customer_visible
     from evidence_records er
     join gate_instances gi on gi.gate_instance_id = er.gate_instance_id
     where er.job_id = $1 and er.kind = 'photo' and gi.definition_key = 'excavation'
     order by er.evidence_id
     limit 1`,
    [jobId],
  );
  const photo = photos.rows[0];
  if (!photo || photo.customer_visible) return;
  const customers = new CustomerService(db);
  await customers.setPhotoVisibility({
    evidenceId: photo.evidence_id as Parameters<CustomerService['setPhotoVisibility']>[0]['evidenceId'],
    visible: true,
    caption: 'DEMO — the hole is dug at the sample Lubbock pool.',
    actor,
  });
};

const ensureCustomerLink = async (db: Database, jobId: JobId): Promise<string> => {
  const digest = hashToken(DEMO_CUSTOMER_TOKEN);
  const live = await db.query<{ token_sha256: string }>(
    'select token_sha256 from customer_links where job_id = $1 and revoked_at is null',
    [jobId],
  );
  const current = live.rows[0];
  if (!current) {
    await db.query(
      `insert into customer_links (link_id, job_id, token_sha256, issued_by)
       values ($1, $2, $3, $4)`,
      [createCanonicalId('clink'), jobId, digest, DEMO_USER_ID],
    );
  } else if (current.token_sha256 !== digest) {
    throw new Error(
      'This DEMO job already has a different customer link. Run with --remove, then seed again.',
    );
  }
  return `/c/${DEMO_CUSTOMER_TOKEN}`;
};

/** Create the Lubbock DEMO job, or return the one that already exists. */
export async function seedDemoProject(db: Database): Promise<DemoSeedResult> {
  const actor = await ensureActor(db);
  const leadId = await ensureLead(db);
  const service = new GateService(db);
  const existingJob = await db.query<{ job_id: string }>(
    'select job_id from jobs where lead_id = $1',
    [leadId],
  );
  let jobId = existingJob.rows[0]?.job_id as JobId | undefined;
  if (jobId === undefined) {
    const finished = await service.finishEstimate({
      leadId: leadId as Parameters<GateService['finishEstimate']>[0]['leadId'],
      actor,
      submission: demoSubmission(),
      directLines: DEMO_DIRECT_LINES,
      measuredLines: DEMO_MEASURED_LINES,
      feeRateBps: DEMO_FEE_RATE_BPS,
      idempotencyKey: 'demo:lubbock:finish',
    });
    if (finished.blockers.length > 0) {
      throw new Error(`Demo pricing did not issue: ${finished.blockers.map((blocker) => blocker.message).join(' ')}`);
    }
    const signed = await service.signProposal({
      proposalVersionId: finished.proposal.proposalVersionId,
      expectedVersionNumber: finished.proposal.versionNumber,
      expectedDraftRevision: finished.proposal.draftRevision,
      actor,
      customerAcceptanceConfirmed: true,
      idempotencyKey: 'demo:lubbock:sign',
      jobId: DEMO_JOB_ID,
    });
    jobId = signed.jobId as JobId;
  }
  await service.createDrawSchedule({
    jobId,
    actor,
    idempotencyKey: 'demo:lubbock:draws',
  });
  for (const definitionKey of COMPLETED_GATES) {
    await releaseGate(service, jobId, definitionKey, actor);
  }
  await publishOnePhoto(db, jobId, actor);
  const customerPath = await ensureCustomerLink(db, jobId);
  return { jobId, leadId, customerPath };
}

const PAUSED_TRIGGERS = [
  ['events', 'events_no_delete'],
  ['proposal_versions', 'protect_proposal_version_delete'],
  ['takeoff_revisions', 'protect_approved_takeoff_delete'],
  ['project_phase_transitions', 'project_phase_transitions_no_delete'],
  ['customer_link_accesses', 'customer_link_accesses_no_delete'],
  ['visit_reschedules', 'visit_reschedules_no_delete'],
  ['inspection_results', 'inspection_results_no_delete'],
] as const;

/**
 * Delete the Lubbock DEMO lead, its job, and the demo staff row.
 *
 * Append-only triggers are paused inside this transaction and restored before
 * it commits. A failure rolls the pause back with the deletes. Rows that do
 * not belong to this lead are left alone.
 */
export async function removeDemoProject(
  db: Database,
  storage?: { remove(key: string): Promise<void> },
): Promise<{ readonly removed: boolean }> {
  const leads = await db.query<{ lead_id: string }>(
    'select lead_id from leads where idempotency_key = $1',
    [DEMO_LEAD_KEY],
  );
  const leadId = leads.rows[0]?.lead_id;
  if (leadId) {
    const jobs = await db.query<{ job_id: string }>(
      'select job_id from jobs where lead_id = $1',
      [leadId],
    );
    const jobId = jobs.rows[0]?.job_id ?? null;
    const storedKeys = jobId === null ? [] : (await db.query<{ storage_key: string }>(
      'select storage_key from evidence_records where job_id = $1',
      [jobId],
    )).rows.map((row) => row.storage_key);
    await db.transaction(async (tx) => {
      for (const [table, trigger] of PAUSED_TRIGGERS) {
        await tx.query(`alter table ${table} disable trigger ${trigger}`);
      }
      if (jobId) {
        await tx.query(
          `delete from customer_link_accesses
           where link_id in (select link_id from customer_links where job_id = $1)`,
          [jobId],
        );
        await tx.query('delete from customer_decisions where job_id = $1', [jobId]);
        await tx.query('delete from customer_milestone_projections where job_id = $1', [jobId]);
        await tx.query('delete from customer_links where job_id = $1', [jobId]);
        await tx.query(
          `delete from inspection_results
           where inspection_id in (select inspection_id from job_inspections where job_id = $1)`,
          [jobId],
        );
        await tx.query('delete from job_inspections where job_id = $1', [jobId]);
        await tx.query(
          `delete from visit_reschedules
           where visit_id in (select visit_id from scheduled_visits where job_id = $1)`,
          [jobId],
        );
        await tx.query('delete from scheduled_visits where job_id = $1', [jobId]);
        await tx.query(
          `delete from requirement_evaluations
           where gate_instance_id in (select gate_instance_id from gate_instances where job_id = $1)`,
          [jobId],
        );
        await tx.query('delete from evidence_records where job_id = $1', [jobId]);
        await tx.query('delete from job_draws where job_id = $1', [jobId]);
        await tx.query('delete from gate_instances where job_id = $1', [jobId]);
        await tx.query('delete from project_phase_transitions where job_id = $1', [jobId]);
        await tx.query('delete from projects where job_id = $1', [jobId]);
      }
      await tx.query(
        'delete from events where lead_id = $1 or job_id = $2',
        [leadId, jobId],
      );
      await tx.query('delete from finish_estimate_runs where lead_id = $1', [leadId]);
      await tx.query('delete from proposal_versions where lead_id = $1', [leadId]);
      await tx.query('delete from proposals where lead_id = $1', [leadId]);
      if (jobId) {
        await tx.query(
          'update jobs set current_takeoff_revision_id = null where job_id = $1',
          [jobId],
        );
      }
      await tx.query('delete from takeoff_revisions where lead_id = $1', [leadId]);
      if (jobId) {
        await tx.query('delete from job_customer_access where job_id = $1', [jobId]);
        await tx.query(
          'delete from integration_links where canonical_id = $1 or canonical_id = $2',
          [jobId, leadId],
        );
        await tx.query('delete from jobs where job_id = $1', [jobId]);
      }
      await tx.query('delete from leads where lead_id = $1', [leadId]);
      for (const [table, trigger] of [...PAUSED_TRIGGERS].reverse()) {
        await tx.query(`alter table ${table} enable trigger ${trigger}`);
      }
    });
    if (storage) {
      for (const key of storedKeys) {
        try {
          assertStorageKey(key);
        } catch (error) {
          if (error instanceof StorageKeyError) continue;
          throw error;
        }
        await storage.remove(key);
      }
    }
  }

  await db.query(
    'delete from app_users where user_id = $1 and email = $2',
    [DEMO_USER_ID, DEMO_USER_EMAIL],
  );
  return { removed: leadId !== undefined };
}
