import type { PGlite } from '@electric-sql/pglite';
import {
  InspectionResultSchema,
  InspectionTypeSchema,
  JobInspectionSchema,
  createCanonicalId,
  type EventActor,
  type InspectionResult,
  type InspectionType,
  type JobId,
  type JobInspection,
} from '@apex/contracts';
import { DomainRuleError, blockingInspections, lastSafeRequestOn } from '@apex/domain';

/**
 * Inspections — PRD §9.7. The inspection half of build-plan Step 5.
 *
 * The service fetches; the deadline arithmetic lives in @apex/domain. What is
 * decided here is one thing the pure layer cannot know: where a deadline comes
 * from when nobody typed one.
 *
 * `neededBy` falls back to the earliest live crew booking in the blocked Gate's
 * phase. That is deliberate. The alternative anchors — the project's target
 * completion window, or the phase sequence — are either too coarse to be
 * actionable or entirely invented. A booked crew is a real commitment with a
 * real date, and if no crew is booked then there genuinely is no deadline yet
 * and the system says so instead of manufacturing urgency.
 */

/** Roles that may record an inspection. The field lead calls these in. */
const INSPECTION_AUTHORITY = ['admin', 'office', 'superintendent', 'field'] as const;

const asDay = (value: string | Date | null): string | null =>
  value === null ? null : (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);

interface InspectionRow {
  inspection_key: string;
  sequence: number;
  title: string;
  phase_key: string;
  requested_by: string;
  requester_trade: string | null;
  lead_time_business_days: number;
  blocks_definition_key: string;
  request_method: string;
  authority: string;
  blocks_gate_title: string | null;
  inspection_id: string | null;
  status: string | null;
  requested_on: string | Date | null;
  scheduled_for: string | Date | null;
  result_on: string | Date | null;
  result_note: string | null;
  corrections: string | null;
  needed_by: string | Date | null;
  booked_from: string | Date | null;
  failure_count: string;
}

/**
 * One row per inspection type, joined to this job's record where one exists and
 * to the earliest live crew booking in the blocked Gate's phase.
 *
 * The booking join is the fallback deadline. `status in ('planned','confirmed')`
 * mirrors `isLive` in the schedule derivation: a cancelled or completed visit is
 * not a commitment to work on a date.
 */
const inspectionSelect = `
  select it.inspection_key, it.sequence, it.title, it.phase_key, it.requested_by,
         it.requester_trade, it.lead_time_business_days, it.blocks_definition_key,
         it.request_method, it.authority,
         gd.title as blocks_gate_title,
         ji.inspection_id, ji.status, ji.requested_on, ji.scheduled_for,
         ji.result_on, ji.result_note, ji.corrections, ji.needed_by,
         (select min(v.starts_on) from scheduled_visits v
           where v.job_id = $1 and v.phase_key = gd.phase_key
             and v.status in ('planned', 'confirmed')) as booked_from,
         (select count(*) from inspection_results r
           where r.inspection_id = ji.inspection_id and r.outcome = 'failed')::text as failure_count
  from inspection_types it
  left join gate_definitions gd
    on gd.definition_key = it.blocks_definition_key and gd.active = true
  left join job_inspections ji
    on ji.inspection_key = it.inspection_key and ji.job_id = $1
`;

const toInspection = (jobId: JobId, row: InspectionRow): JobInspection => {
  const recorded = asDay(row.needed_by);
  const booked = asDay(row.booked_from);
  const neededBy = recorded ?? booked;
  return JobInspectionSchema.parse({
    inspectionId: row.inspection_id,
    jobId,
    inspectionKey: row.inspection_key,
    title: row.title,
    phaseKey: row.phase_key,
    requestedBy: row.requested_by,
    requesterTrade: row.requester_trade,
    leadTimeBusinessDays: row.lead_time_business_days,
    blocksDefinitionKey: row.blocks_definition_key,
    // The join is on the active definition; a Gate whose definition was retired
    // still needs a name rather than a blank on screen.
    blocksGateTitle: row.blocks_gate_title ?? row.blocks_definition_key,
    requestMethod: row.request_method,
    authority: row.authority,
    status: row.status,
    requestedOn: asDay(row.requested_on),
    scheduledFor: asDay(row.scheduled_for),
    resultOn: asDay(row.result_on),
    resultNote: row.result_note,
    corrections: row.corrections,
    neededBy,
    neededBySource: neededBy === null ? null : (recorded !== null ? 'recorded' : 'crew-booking'),
    lastSafeRequestOn: lastSafeRequestOn(neededBy, row.lead_time_business_days),
    failureCount: Number(row.failure_count ?? 0),
  });
};

const requireInspectionRole = (actor: EventActor, action: string): { userId: string } => {
  if (actor.kind !== 'user') throw new DomainRuleError(`${action} requires an authenticated human actor.`);
  if (!(INSPECTION_AUTHORITY as readonly string[]).includes(actor.role)) {
    throw new DomainRuleError(`Role ${actor.role} may not record an inspection.`);
  }
  return { userId: actor.userId };
};

export class InspectionService {
  constructor(private readonly db: PGlite) {}

  /** The seven inspections Apex has to pass, in build order. */
  async listInspectionTypes(): Promise<readonly InspectionType[]> {
    const rows = await this.db.query<InspectionRow>(
      `select inspection_key, sequence, title, phase_key, requested_by, requester_trade,
              lead_time_business_days, blocks_definition_key, request_method, authority
       from inspection_types order by sequence`,
    );
    return rows.rows.map((row) => InspectionTypeSchema.parse({
      inspectionKey: row.inspection_key,
      sequence: row.sequence,
      title: row.title,
      phaseKey: row.phase_key,
      requestedBy: row.requested_by,
      requesterTrade: row.requester_trade,
      leadTimeBusinessDays: row.lead_time_business_days,
      blocksDefinitionKey: row.blocks_definition_key,
      requestMethod: row.request_method,
      authority: row.authority,
    }));
  }

  /**
   * Every inspection on a job, recorded or not.
   *
   * All seven always come back. An inspection nobody has touched is returned
   * with a null status — "not requested" is a state the feed has to act on, not
   * a row that is missing.
   */
  async listJobInspections(jobId: JobId): Promise<readonly JobInspection[]> {
    const rows = await this.db.query<InspectionRow>(
      `${inspectionSelect} order by it.sequence`,
      [jobId],
    );
    return rows.rows.map((row) => toInspection(jobId, row));
  }

  /** Record that an inspection has been called in. */
  async requestInspection(input: {
    jobId: JobId;
    inspectionKey: string;
    requestedOn: string;
    scheduledFor?: string;
    neededBy?: string;
    actor: EventActor;
  }): Promise<JobInspection> {
    const { userId } = requireInspectionRole(input.actor, 'Requesting an inspection');
    const known = await this.db.query(
      'select 1 from inspection_types where inspection_key = $1',
      [input.inspectionKey],
    );
    if (known.rows.length === 0) throw new DomainRuleError(`Unknown inspection: ${input.inspectionKey}.`);
    if (input.scheduledFor !== undefined && input.scheduledFor < input.requestedOn) {
      throw new DomainRuleError('An inspection cannot be scheduled before it was requested.');
    }

    await this.db.query(
      `insert into job_inspections
       (inspection_id, job_id, inspection_key, status, requested_on, scheduled_for, needed_by, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (job_id, inspection_key) do update
         set status = case when job_inspections.status = 'failed' then 'requested' else excluded.status end,
             requested_on = excluded.requested_on,
             scheduled_for = excluded.scheduled_for,
             needed_by = coalesce(excluded.needed_by, job_inspections.needed_by),
             updated_at = now()`,
      [createCanonicalId('inspect'), input.jobId, input.inspectionKey,
        input.scheduledFor === undefined ? 'requested' : 'scheduled',
        input.requestedOn, input.scheduledFor ?? null, input.neededBy ?? null, userId],
    );
    return this.readOne(input.jobId, input.inspectionKey);
  }

  /**
   * Record what the inspector found.
   *
   * The outcome is appended to `inspection_results` as well as set on the row.
   * A pass after a failure must not erase the failure: what was wrong and what
   * had to be corrected is exactly what somebody wants six months later.
   */
  async recordResult(input: {
    jobId: JobId;
    inspectionKey: string;
    outcome: 'passed' | 'failed' | 'waived';
    occurredOn: string;
    note?: string;
    corrections?: string;
    actor: EventActor;
  }): Promise<JobInspection> {
    const { userId } = requireInspectionRole(input.actor, 'Recording an inspection result');
    if (input.outcome === 'failed' && !input.corrections?.trim()) {
      throw new DomainRuleError('A failed inspection has to record what must be corrected.');
    }
    if (input.outcome === 'waived' && !input.note?.trim()) {
      throw new DomainRuleError('Waiving an inspection has to record why it does not apply.');
    }

    const existing = await this.db.query<{ inspection_id: string }>(
      'select inspection_id from job_inspections where job_id = $1 and inspection_key = $2',
      [input.jobId, input.inspectionKey],
    );
    let inspectionId = existing.rows[0]?.inspection_id;

    await this.db.transaction(async (tx) => {
      if (inspectionId === undefined) {
        // A result can arrive on an inspection nobody recorded requesting —
        // most often a waiver. Refusing it would push the fact outside the
        // system, which is the failure this codebase keeps declining to make.
        inspectionId = createCanonicalId('inspect');
        await tx.query(
          `insert into job_inspections
           (inspection_id, job_id, inspection_key, status, result_on, result_note, corrections, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [inspectionId, input.jobId, input.inspectionKey, input.outcome, input.occurredOn,
            input.note?.trim() ?? null, input.corrections?.trim() ?? null, userId],
        );
      } else {
        await tx.query(
          `update job_inspections
           set status = $2, result_on = $3, result_note = $4,
               corrections = case when $2 = 'failed' then $5 else corrections end,
               updated_at = now()
           where inspection_id = $1`,
          [inspectionId, input.outcome, input.occurredOn,
            input.note?.trim() ?? null, input.corrections?.trim() ?? null],
        );
      }
      await tx.query(
        `insert into inspection_results
         (inspection_id, outcome, occurred_on, note, corrections, recorded_by)
         values ($1, $2, $3, $4, $5, $6)`,
        [inspectionId, input.outcome, input.occurredOn,
          input.note?.trim() ?? null, input.corrections?.trim() ?? null, userId],
      );
    });

    return this.readOne(input.jobId, input.inspectionKey);
  }

  /** Every recorded outcome on one job's inspection, oldest first. */
  async listResults(jobId: JobId, inspectionKey: string): Promise<readonly InspectionResult[]> {
    const rows = await this.db.query<{
      outcome: 'passed' | 'failed' | 'waived';
      occurred_on: string | Date;
      note: string | null;
      corrections: string | null;
      recorded_at: string | Date;
      recorded_by_name: string | null;
    }>(
      `select r.outcome, r.occurred_on, r.note, r.corrections, r.recorded_at,
              u.display_name as recorded_by_name
       from inspection_results r
       join job_inspections ji on ji.inspection_id = r.inspection_id
       left join app_users u on u.user_id = r.recorded_by
       where ji.job_id = $1 and ji.inspection_key = $2
       order by r.occurred_on, r.result_id`,
      [jobId, inspectionKey],
    );
    return rows.rows.map((row) => InspectionResultSchema.parse({
      outcome: row.outcome,
      occurredOn: asDay(row.occurred_on),
      note: row.note,
      corrections: row.corrections,
      recordedAt: new Date(row.recorded_at).toISOString(),
      recordedByName: row.recorded_by_name,
    }));
  }

  /**
   * The inspections standing between a Gate and its release.
   *
   * §9.7 says required inspections block dependent work. That has to mean the
   * release actually fails — a warning that can be clicked past is not a block,
   * and this is the one control that stops a pour going ahead of the city.
   */
  async blockingFor(jobId: JobId, definitionKey: string): Promise<readonly JobInspection[]> {
    return blockingInspections(await this.listJobInspections(jobId), definitionKey);
  }

  private async readOne(jobId: JobId, inspectionKey: string): Promise<JobInspection> {
    const rows = await this.db.query<InspectionRow>(
      `${inspectionSelect} where it.inspection_key = $2`,
      [jobId, inspectionKey],
    );
    const row = rows.rows[0];
    if (!row) throw new Error('Inspection disappeared after being written.');
    return toInspection(jobId, row);
  }
}
