import { createHash } from 'node:crypto';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import {
  ApexEventSchema,
  CustomerMilestoneProjectionSchema,
  DRAW_CODES,
  DRAW_SCHEDULE_TEMPLATE,
  DailyBriefSchema,
  DrawScheduleSchema,
  JobDrawSchema,
  JobSummarySchema,
  ScheduledVisitSchema,
  SubcontractorSchema,
  constructionPhase,
  createCanonicalId,
  readLeadIdentity,
  type ActionCard,
  type ApexEvent,
  type ConstructionPhaseKey,
  type CustomerMilestoneKey,
  type CustomerMilestoneProjection,
  type DailyBrief,
  type DrawSchedule,
  type JobDraw,
  type ScheduledVisit,
  type Subcontractor,
  type VisitConflict,
  type EvidenceId,
  type EvidenceKind,
  type EventActor,
  type EventId,
  type GateInstanceId,
  type GateReleaseRole,
  type JobId,
  type JobSummary,
  type UserId,
} from '@apex/contracts';
import {
  DomainRuleError,
  allocateDrawAmounts,
  buildDailyBrief,
  customerMilestoneFor,
  describeConflict,
  detectVisitConflicts,
  drawCodeForGate,
  decideGateCommand,
  decidePhaseChange,
  deriveCards,
  evolveGate,
  newGateState,
  type CardDrawSnapshot,
  type CardGateSnapshot,
  type CardJobSnapshot,
  type ChangePhaseCommand,
  type DomainEventDraft,
  type GateCommand,
  type GateState,
  type PhaseGuard,
  type PreviousBrief,
  type ProjectPhaseState,
} from '@apex/domain';

export interface EvidenceWrite {
  readonly evidenceId: EvidenceId;
  readonly requirementKey: string;
  readonly kind: EvidenceKind;
  readonly storageKey: string;
  readonly sha256: string;
  readonly capturedAt: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly caption?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CommandContext {
  readonly idempotencyKey: string;
  readonly correlationId?: EventId;
  readonly evidence?: EvidenceWrite;
}

/** Roles that may open a construction project or change its phase. */
const PROJECT_AUTHORITY = ['admin', 'office', 'superintendent'] as const;

/** Roles that may book or move a crew. The field does not commit other people's time. */
const SCHEDULE_AUTHORITY = ['admin', 'office', 'superintendent'] as const;

interface VisitRow {
  visit_id: string;
  job_id: string;
  subcontractor_id: string;
  subcontractor_name: string;
  trade: string;
  phase_key: string;
  starts_on: string | Date;
  ends_on: string | Date;
  status: ScheduledVisit['status'];
  note: string | null;
  reschedule_count: string;
}

const visitSelect = `
  select v.visit_id, v.job_id, v.subcontractor_id, s.name as subcontractor_name, s.trade,
         v.phase_key, v.starts_on, v.ends_on, v.status, v.note,
         (select count(*) from visit_reschedules r where r.visit_id = v.visit_id)::text as reschedule_count
  from scheduled_visits v
  join subcontractors s on s.subcontractor_id = v.subcontractor_id
`;

/**
 * Roles that may create a draw schedule or confirm an invoice. Deliberately
 * excludes `field` and `superintendent`: money is the owner's and the office's.
 */
const DRAW_SCHEDULE_AUTHORITY = ['admin', 'office'] as const;

export interface ProjectSnapshot {
  readonly jobId: JobId;
  readonly currentPhaseKey: ConstructionPhaseKey;
  readonly currentPhaseTitle: string;
  readonly currentPhaseSequence: number;
  readonly customerMilestone: string;
  readonly superintendentUserId: UserId | null;
  readonly superintendentName: string | null;
  readonly targetCompletionStart: string | null;
  readonly targetCompletionEnd: string | null;
  readonly riskNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * One row of the job's Gate plan: the template, and this job's instance of it
 * when one has been opened. `gateInstanceId` null means the Gate is planned but
 * not started — not that it was skipped.
 */
export interface JobGateEntry {
  readonly definitionKey: string;
  readonly title: string;
  readonly sequence: number | null;
  readonly phaseKey: ConstructionPhaseKey | null;
  readonly drawCode: string | null;
  readonly requiresCountersign: boolean;
  readonly gateInstanceId: GateInstanceId | null;
  readonly status: 'not-started' | 'in-progress' | 'blocked' | 'awaiting-countersign' | 'released' | null;
}

export interface ProjectPhaseHistoryEntry {
  readonly fromPhaseKey: ConstructionPhaseKey | null;
  readonly toPhaseKey: ConstructionPhaseKey;
  readonly occurredAt: string;
  readonly actorUserId: UserId;
  readonly reason: string | null;
}

export interface ExecuteResult {
  readonly state: GateState;
  readonly events: readonly ApexEvent[];
  readonly duplicate: boolean;
}

type QueryClient = Pick<PGlite, 'query'> | Transaction;

interface JobSummaryRow {
  job_id: string;
  lead_id: string;
  status: string;
  created_at: string | Date;
  accepted_payload: unknown;
  total_cents_text: string | null;
  gate_instance_id: string | null;
  definition_key: string | null;
  definition_version: number | null;
  gate_status: string | null;
  approved_takeoff_revision_id: string | null;
  gate_title: string | null;
  gate_phase: string | null;
  customer_milestone: string | null;
  current_phase_key: string | null;
  superintendent_user_id: string | null;
  superintendent_name: string | null;
  target_completion_start: string | Date | null;
  target_completion_end: string | Date | null;
  risk_note: string | null;
}

/**
 * Current Gate = the most recent gate that is not yet released; if every gate on
 * the job is released, the most recent released one. `order by (status = 'released')`
 * sorts false before true, so unreleased gates always win.
 */
const jobSummaryQuery = (filter: 'all' | 'one') => `
  select
    j.job_id, j.lead_id, j.status, j.created_at,
    l.accepted_payload,
    pv.total_cents::text as total_cents_text,
    gi.gate_instance_id, gi.definition_key, gi.definition_version,
    gi.status as gate_status, tr.revision_id as approved_takeoff_revision_id,
    gd.title as gate_title, gd.phase as gate_phase, gd.customer_milestone,
    p.current_phase_key, p.superintendent_user_id,
    su.display_name as superintendent_name,
    p.target_completion_start, p.target_completion_end, p.risk_note
  from jobs j
  join leads l on l.lead_id = j.lead_id
  -- The job's approved takeoff, not the Gate's. Reading it off the Gate meant a
  -- job with an approved revision and no Gate yet reported having none, which
  -- would have put a false "approve a takeoff" card in front of the owner.
  left join takeoff_revisions tr on tr.job_id = j.job_id and tr.status = 'approved'
  left join projects p on p.job_id = j.job_id
  left join app_users su on su.user_id = p.superintendent_user_id
  left join lateral (
    select total_cents from proposal_versions
    where job_id = j.job_id and status = 'signed'
    order by version_number desc limit 1
  ) pv on true
  left join lateral (
    select gate_instance_id, definition_key, definition_version, status, approved_takeoff_revision_id
    from gate_instances
    where job_id = j.job_id
    order by (status = 'released'), created_at desc, gate_instance_id desc
    limit 1
  ) gi on true
  left join gate_definitions gd
    on gd.definition_key = gi.definition_key and gd.version = gi.definition_version
  ${filter === 'one' ? 'where j.job_id = $1' : ''}
  order by j.created_at desc, j.job_id desc
`;

/**
 * bigint columns arrive as text so no cent is lost to float conversion. A value
 * outside the safe-integer range is refused rather than silently rounded.
 */
const readCents = (value: string | null): number | null => {
  if (value === null) return null;
  const cents = Number(value);
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Contract total ${value} is outside the safe integer range.`);
  }
  return cents;
};

/** `date` columns come back as a Date or a string; both render as YYYY-MM-DD. */
const readDate = (value: string | Date | null): string | null => {
  if (value === null) return null;
  const iso = value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return iso.slice(0, 10);
};

const toVisit = (row: VisitRow): ScheduledVisit => ScheduledVisitSchema.parse({
  visitId: row.visit_id,
  jobId: row.job_id,
  subcontractorId: row.subcontractor_id,
  subcontractorName: row.subcontractor_name,
  trade: row.trade,
  phaseKey: row.phase_key,
  startsOn: readDate(row.starts_on),
  endsOn: readDate(row.ends_on),
  status: row.status,
  note: row.note,
  rescheduleCount: Number(row.reschedule_count),
});

const toJobSummary = (row: JobSummaryRow): JobSummary => {
  const identity = readLeadIdentity(row.accepted_payload);
  const gate = row.gate_instance_id === null ? null : {
    gateInstanceId: row.gate_instance_id,
    definitionKey: row.definition_key,
    definitionVersion: row.definition_version,
    title: row.gate_title,
    phase: row.gate_phase,
    status: row.gate_status,
    customerMilestone: row.customer_milestone,
  };
  return JobSummarySchema.parse({
    jobId: row.job_id,
    leadId: row.lead_id,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    customerName: identity.customerName,
    addressLine: identity.addressLine,
    contractCents: readCents(row.total_cents_text),
    approvedTakeoffRevisionId: row.approved_takeoff_revision_id,
    currentGate: gate,
    project: readJobSummaryProject(row),
  });
};

/**
 * The §9.3 project facts, or null when the job has no project record. A signed
 * job is not automatically a job under construction, and the feed must not
 * imply that it is.
 */
const readJobSummaryProject = (row: JobSummaryRow) => {
  if (row.current_phase_key === null) return null;
  const phase = constructionPhase(row.current_phase_key as ConstructionPhaseKey);
  return {
    currentPhaseKey: phase.key,
    currentPhaseTitle: phase.title,
    currentPhaseSequence: phase.sequence,
    customerMilestone: customerMilestoneFor({
      jobId: row.job_id as JobId,
      currentPhaseKey: phase.key,
      jobComplete: row.status === 'complete' || row.status === 'closed',
    }),
    superintendentUserId: row.superintendent_user_id,
    superintendentName: row.superintendent_name,
    targetCompletionStart: readDate(row.target_completion_start),
    targetCompletionEnd: readDate(row.target_completion_end),
    riskNote: row.risk_note,
  };
};

const replayableEventTypes = new Set([
  'gate.started',
  'evidence.added',
  'requirement.passed',
  'requirement.failed',
  'gate.blocked',
  'gate.signoff_recorded',
  'gate.countersigned',
  'gate.released',
  'draw.eligible',
  'customer_update.published',
]);

const commandKey = (value: string) => {
  if (value.trim().length < 8) throw new Error('Command idempotency keys must contain at least 8 characters.');
  return `gate:${createHash('sha256').update(value).digest('hex')}`;
};

export class GateService {
  constructor(private readonly db: PGlite) {}

  /**
   * Open a Gate of the given definition on a job.
   *
   * Idempotent per (job, definition): asking twice returns the Gate that exists
   * rather than opening a second one. The active version is resolved at creation
   * and pinned on the instance, so a later template revision never silently
   * changes what a running Gate means.
   *
   * Gates are deliberately not forced into sequence. A job imported mid-build
   * legitimately opens its Shell gate before anyone has recorded a Permit gate,
   * and refusing that would only push the truth outside the system.
   */
  async createGate(input: {
    gateInstanceId: GateInstanceId;
    jobId: JobId;
    definitionKey: string;
  }): Promise<GateState> {
    const existing = await this.db.query<{ gate_instance_id: GateInstanceId }>(
      `select gate_instance_id from gate_instances
       where job_id = $1 and definition_key = $2`,
      [input.jobId, input.definitionKey],
    );
    if (existing.rows[0]) return this.getGate(existing.rows[0].gate_instance_id);

    const definition = await this.db.query<{ version: number }>(
      `select version from gate_definitions
       where definition_key = $1 and active = true
       order by version desc limit 1`,
      [input.definitionKey],
    );
    const version = definition.rows[0]?.version;
    if (version === undefined) {
      throw new DomainRuleError(`Unknown or inactive Gate definition: ${input.definitionKey}.`);
    }

    const approved = await this.db.query<{ revision_id: string }>(
      `select revision_id from takeoff_revisions
       where job_id = $1 and status = 'approved'
       order by revision_number desc limit 1`,
      [input.jobId],
    );
    if (!approved.rows[0]) throw new DomainRuleError('A Gate requires an approved Designer takeoff revision.');

    await this.db.query(
      `insert into gate_instances
       (gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id, status)
       values ($1, $2, $3, $4, $5, 'not-started')`,
      [input.gateInstanceId, input.jobId, input.definitionKey, version, approved.rows[0].revision_id],
    );
    return this.getGate(input.gateInstanceId);
  }

  /** Every Gate template, in build order, with this job's instance where one exists. */
  async listJobGates(jobId: JobId): Promise<readonly JobGateEntry[]> {
    const result = await this.db.query<{
      definition_key: string;
      title: string;
      sequence: number | null;
      phase_key: string | null;
      draw_code: string | null;
      countersign_roles: GateReleaseRole[];
      gate_instance_id: string | null;
      status: string | null;
    }>(
      `select gd.definition_key, gd.title, gd.sequence, gd.phase_key, gd.draw_code,
              gd.countersign_roles, gi.gate_instance_id, gi.status
       from gate_definitions gd
       left join gate_instances gi
         on gi.definition_key = gd.definition_key and gi.job_id = $1
       where gd.active = true
       order by gd.sequence nulls last, gd.definition_key`,
      [jobId],
    );
    return result.rows.map((row) => ({
      definitionKey: row.definition_key,
      title: row.title,
      sequence: row.sequence,
      phaseKey: row.phase_key as ConstructionPhaseKey | null,
      drawCode: row.draw_code,
      requiresCountersign: row.countersign_roles.length > 0,
      gateInstanceId: row.gate_instance_id as GateInstanceId | null,
      status: row.status as JobGateEntry['status'],
    }));
  }

  async getGate(gateInstanceId: GateInstanceId, client: QueryClient = this.db): Promise<GateState> {
    const gates = await client.query<{
      gate_instance_id: GateInstanceId;
      job_id: JobId;
      definition_key: string;
      definition_version: number;
      approved_takeoff_revision_id: string;
      release_roles: GateReleaseRole[];
      countersign_roles: GateReleaseRole[];
      draw_code: string | null;
      customer_milestone: CustomerMilestoneKey | null;
    }>(
      // Release authority is read from the Gate definition, so a Gate that
      // releases money can never be signed off by a role that may not, and the
      // one irreversible Gate always demands its second signature.
      `select gi.gate_instance_id, gi.job_id, gi.definition_key, gi.definition_version,
              gi.approved_takeoff_revision_id, gd.release_roles, gd.countersign_roles,
              gd.draw_code, gd.customer_milestone
       from gate_instances gi
       join gate_definitions gd
         on gd.definition_key = gi.definition_key and gd.version = gi.definition_version
       where gi.gate_instance_id = $1`,
      [gateInstanceId],
    );
    const gate = gates.rows[0];
    if (!gate) throw new Error(`Unknown Gate: ${gateInstanceId}.`);

    const requirements = await client.query<{
      requirement_key: string;
      evidence_required: boolean;
      accepted_evidence_kinds: EvidenceKind[];
    }>(
      `select requirement_key, evidence_required, accepted_evidence_kinds
       from gate_requirements
       where definition_key = $1 and definition_version = $2
       order by sequence`,
      [gate.definition_key, gate.definition_version],
    );
    let state = newGateState({
      gateInstanceId: gate.gate_instance_id,
      jobId: gate.job_id,
      definitionKey: gate.definition_key,
      definitionVersion: gate.definition_version,
      approvedTakeoffRevisionId: gate.approved_takeoff_revision_id as GateState['approvedTakeoffRevisionId'],
      releaseRoles: gate.release_roles,
      countersignRoles: gate.countersign_roles,
      drawCode: gate.draw_code,
      customerMilestone: gate.customer_milestone,
      requirements: requirements.rows.map((row) => ({
        key: row.requirement_key,
        evidenceRequired: row.evidence_required,
        acceptedEvidenceKinds: row.accepted_evidence_kinds,
      })),
    });

    const storedEvents = await client.query<{
      event_type: string;
      job_id: JobId;
      payload: DomainEventDraft['payload'];
      occurred_at: string | Date;
      actor: EventActor;
    }>(
      `select event_type, job_id, payload, occurred_at, actor
       from events
       where payload->>'gateInstanceId' = $1
       order by recorded_at, event_id`,
      [gateInstanceId],
    );
    for (const row of storedEvents.rows) {
      if (!replayableEventTypes.has(row.event_type)) continue;
      state = evolveGate(state, {
        eventType: row.event_type,
        jobId: row.job_id,
        payload: row.payload,
        at: new Date(row.occurred_at).toISOString(),
        actor: row.actor,
      } as DomainEventDraft);
    }
    return state;
  }

  async execute(gateInstanceId: GateInstanceId, command: GateCommand, context: CommandContext): Promise<ExecuteResult> {
    const baseIdempotencyKey = commandKey(context.idempotencyKey);
    const duplicate = await this.db.query<{ event_id: string }>(
      `select event_id from events where idempotency_key like $1 limit 1`,
      [`${baseIdempotencyKey}:%`],
    );
    if (duplicate.rows.length > 0) {
      return { state: await this.getGate(gateInstanceId), events: [], duplicate: true };
    }

    const state = await this.getGate(gateInstanceId);
    const drafts = decideGateCommand(state, command);
    if (command.type === 'add-evidence') this.assertEvidenceContext(command, context.evidence, state.jobId);
    const correlationId = context.correlationId ?? createCanonicalId('event');
    const persisted: ApexEvent[] = [];

    await this.db.transaction(async (tx) => {
      if (command.type === 'add-evidence' && context.evidence) {
        const actor = command.actor;
        if (actor.kind !== 'user') throw new Error('Evidence capture requires a user actor.');
        const proof = context.evidence;
        await tx.query(
          `insert into evidence_records
           (evidence_id, job_id, gate_instance_id, requirement_key, kind, storage_key, sha256, captured_at, captured_by, mime_type, byte_size, caption, metadata)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            proof.evidenceId, state.jobId, gateInstanceId, proof.requirementKey, proof.kind,
            proof.storageKey, proof.sha256, proof.capturedAt, actor.userId, proof.mimeType,
            proof.byteSize, proof.caption ?? null, proof.metadata,
          ],
        );
      }

      for (const [index, draft] of drafts.entries()) {
        const eventId = createCanonicalId('event');
        const event = ApexEventSchema.parse({
          schemaVersion: 1,
          eventId,
          eventType: draft.eventType,
          occurredAt: draft.at,
          recordedAt: new Date().toISOString(),
          actor: draft.actor,
          jobId: draft.jobId,
          correlationId,
          idempotencyKey: `${baseIdempotencyKey}:${index}`,
          payload: draft.payload,
        });
        await this.persistEvent(tx, event);
        await this.projectEvent(tx, event, {
          definitionKey: state.definitionKey,
          definitionVersion: state.definitionVersion,
        });
        persisted.push(event);
      }
    });

    return {
      state: drafts.reduce(evolveGate, state),
      events: persisted,
      duplicate: false,
    };
  }

  /**
   * Every job with its lead identity, signed contract value, and current Gate.
   * Ordered newest first. Internal read model — staff only at the API boundary.
   */
  async listJobs(): Promise<readonly JobSummary[]> {
    const result = await this.db.query<JobSummaryRow>(jobSummaryQuery('all'));
    return result.rows.map(toJobSummary);
  }

  /** One job summary, or null when the job does not exist. */
  async getJob(jobId: JobId): Promise<JobSummary | null> {
    const result = await this.db.query<JobSummaryRow>(jobSummaryQuery('one'), [jobId]);
    const row = result.rows[0];
    return row === undefined ? null : toJobSummary(row);
  }

  /**
   * Open a Job as a construction project (PRD §9.3).
   *
   * Idempotent: opening an existing project returns it untouched rather than
   * resetting its phase. Emits `project.created` and the opening entry in the
   * phase history so the record explains where it started.
   */
  async openProject(input: {
    jobId: JobId;
    actor: EventActor;
    initialPhaseKey?: ConstructionPhaseKey;
    superintendentUserId?: UserId | null;
    idempotencyKey: string;
  }): Promise<ProjectSnapshot> {
    if (input.actor.kind !== 'user') throw new Error('Opening a project requires an authenticated human actor.');
    if (!PROJECT_AUTHORITY.includes(input.actor.role as (typeof PROJECT_AUTHORITY)[number])) {
      throw new Error(`Role ${input.actor.role} may not open a construction project.`);
    }
    const existing = await this.getProject(input.jobId);
    if (existing) return existing;

    const job = await this.db.query<{ job_id: string }>('select job_id from jobs where job_id = $1', [input.jobId]);
    if (!job.rows[0]) throw new Error(`Unknown Job: ${input.jobId}.`);

    const actor = input.actor;
    const phaseKey = input.initialPhaseKey ?? 'design-permitting';
    const superintendentUserId = input.superintendentUserId ?? null;
    const at = new Date().toISOString();
    const correlationId = createCanonicalId('event');

    await this.db.transaction(async (tx) => {
      await tx.query(
        `insert into projects (job_id, current_phase_key, superintendent_user_id, created_by)
         values ($1, $2, $3, $4)`,
        [input.jobId, phaseKey, superintendentUserId, actor.userId],
      );
      const created = await this.writeEvent(tx, {
        eventType: 'project.created',
        jobId: input.jobId,
        actor,
        at,
        correlationId,
        idempotencyKey: `${commandKey(input.idempotencyKey)}:project.created`,
        payload: { initialPhaseKey: phaseKey, superintendentUserId },
      });
      await tx.query(
        `insert into project_phase_transitions
         (job_id, from_phase_key, to_phase_key, occurred_at, actor_user_id, reason, source_event_id)
         values ($1, null, $2, $3, $4, null, $5)`,
        [input.jobId, phaseKey, at, actor.userId, created.eventId],
      );
    });

    const opened = await this.getProject(input.jobId);
    if (!opened) throw new Error('Project was not persisted.');
    return opened;
  }

  /** Move a project between construction phases. Domain rules decide; this records. */
  async changeProjectPhase(
    jobId: JobId,
    command: ChangePhaseCommand,
    context: { idempotencyKey: string },
  ): Promise<ProjectSnapshot> {
    const state = await this.readProjectPhaseState(jobId);
    const [draft] = decidePhaseChange(state, command);
    if (command.actor.kind !== 'user') throw new Error('A phase change requires an authenticated human actor.');
    const actor = command.actor;
    const baseKey = commandKey(context.idempotencyKey);

    const duplicate = await this.db.query<{ event_id: string }>(
      'select event_id from events where idempotency_key = $1 limit 1',
      [`${baseKey}:project.phase_changed`],
    );
    if (duplicate.rows.length > 0) {
      const current = await this.getProject(jobId);
      if (!current) throw new Error(`Unknown project: ${jobId}.`);
      return current;
    }

    await this.db.transaction(async (tx) => {
      const event = await this.writeEvent(tx, {
        eventType: 'project.phase_changed',
        jobId,
        actor,
        at: draft.at,
        correlationId: createCanonicalId('event'),
        idempotencyKey: `${baseKey}:project.phase_changed`,
        payload: draft.payload,
      });
      await tx.query(
        `insert into project_phase_transitions
         (job_id, from_phase_key, to_phase_key, occurred_at, actor_user_id, reason, source_event_id)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [jobId, draft.payload.fromPhaseKey, draft.payload.toPhaseKey, draft.at, actor.userId, draft.payload.reason, event.eventId],
      );
      await tx.query(
        'update projects set current_phase_key = $2, updated_at = now() where job_id = $1',
        [jobId, draft.payload.toPhaseKey],
      );
    });

    const updated = await this.getProject(jobId);
    if (!updated) throw new Error(`Unknown project: ${jobId}.`);
    return updated;
  }

  async getProject(jobId: JobId): Promise<ProjectSnapshot | null> {
    const result = await this.db.query<{
      job_id: string;
      current_phase_key: string;
      superintendent_user_id: string | null;
      superintendent_name: string | null;
      target_completion_start: string | Date | null;
      target_completion_end: string | Date | null;
      risk_note: string | null;
      job_status: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `select p.job_id, p.current_phase_key, p.superintendent_user_id,
              su.display_name as superintendent_name,
              p.target_completion_start, p.target_completion_end, p.risk_note,
              j.status as job_status, p.created_at, p.updated_at
       from projects p
       join jobs j on j.job_id = p.job_id
       left join app_users su on su.user_id = p.superintendent_user_id
       where p.job_id = $1`,
      [jobId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const phase = constructionPhase(row.current_phase_key as ConstructionPhaseKey);
    return {
      jobId: row.job_id as JobId,
      currentPhaseKey: phase.key,
      currentPhaseTitle: phase.title,
      currentPhaseSequence: phase.sequence,
      customerMilestone: customerMilestoneFor({
        jobId: row.job_id as JobId,
        currentPhaseKey: phase.key,
        jobComplete: row.job_status === 'complete' || row.job_status === 'closed',
      }),
      superintendentUserId: row.superintendent_user_id as UserId | null,
      superintendentName: row.superintendent_name,
      targetCompletionStart: readDate(row.target_completion_start),
      targetCompletionEnd: readDate(row.target_completion_end),
      riskNote: row.risk_note,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  /** Ordered phase history for a job. Append-only in the database. */
  async getProjectPhaseHistory(jobId: JobId): Promise<readonly ProjectPhaseHistoryEntry[]> {
    const result = await this.db.query<{
      from_phase_key: string | null;
      to_phase_key: string;
      occurred_at: string | Date;
      actor_user_id: string;
      reason: string | null;
    }>(
      `select from_phase_key, to_phase_key, occurred_at, actor_user_id, reason
       from project_phase_transitions where job_id = $1
       order by occurred_at, transition_id`,
      [jobId],
    );
    return result.rows.map((row) => ({
      fromPhaseKey: row.from_phase_key as ConstructionPhaseKey | null,
      toPhaseKey: row.to_phase_key as ConstructionPhaseKey,
      occurredAt: new Date(row.occurred_at).toISOString(),
      actorUserId: row.actor_user_id as UserId,
      reason: row.reason,
    }));
  }

  private async readProjectPhaseState(jobId: JobId): Promise<ProjectPhaseState> {
    const result = await this.db.query<{ current_phase_key: string; job_status: string }>(
      `select p.current_phase_key, j.status as job_status
       from projects p join jobs j on j.job_id = p.job_id
       where p.job_id = $1`,
      [jobId],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Job ${jobId} has no construction project yet.`);
    return {
      jobId,
      currentPhaseKey: row.current_phase_key as ConstructionPhaseKey,
      jobComplete: row.job_status === 'complete' || row.job_status === 'closed',
    };
  }

  private async writeEvent(tx: Transaction, input: {
    eventType: 'project.created' | 'project.phase_changed';
    jobId: JobId;
    actor: EventActor;
    at: string;
    correlationId: EventId;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<ApexEvent> {
    const event = ApexEventSchema.parse({
      schemaVersion: 1,
      eventId: createCanonicalId('event'),
      eventType: input.eventType,
      occurredAt: input.at,
      recordedAt: new Date().toISOString(),
      actor: input.actor,
      jobId: input.jobId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
    });
    await this.persistEvent(tx, event);
    return event;
  }

  /**
   * Create the job's draw schedule from its signed contract total — PRD §9.8.
   *
   * Idempotent: a job keeps the schedule it already has. Regenerating one after
   * money has moved would rewrite what the customer was told they owe.
   *
   * The Deposit is marked eligible immediately because contract signing is its
   * release condition; the other four wait for their Gate.
   */
  async createDrawSchedule(input: {
    jobId: JobId;
    actor: EventActor;
    idempotencyKey: string;
  }): Promise<DrawSchedule> {
    if (input.actor.kind !== 'user') throw new DomainRuleError('Creating a draw schedule requires an authenticated human actor.');
    if (!DRAW_SCHEDULE_AUTHORITY.includes(input.actor.role as (typeof DRAW_SCHEDULE_AUTHORITY)[number])) {
      throw new DomainRuleError(`Role ${input.actor.role} may not create a draw schedule.`);
    }

    const summary = await this.getJob(input.jobId);
    if (summary === null) throw new DomainRuleError(`Unknown Job: ${input.jobId}.`);
    if (summary.contractCents === null) {
      throw new DomainRuleError('A draw schedule needs a signed contract total to divide.');
    }

    const allocated = allocateDrawAmounts(summary.contractCents);
    const signedAt = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      for (const { template, amountCents } of allocated) {
        const contractReleased = template.releaseCondition === 'contract-signed';
        // A job that released draw-bearing Gates before it had a schedule
        // already has rows for those draws. Adopt them instead of refusing:
        // real jobs are mid-build when a system arrives, and a job that can
        // never be given a schedule can never be billed correctly.
        //
        // Status, release time, and the releasing Gate are never overwritten —
        // those are records of what happened. Nor is the amount on a draw that
        // has already been billed: money on an issued invoice does not move
        // because a schedule was regenerated.
        const updated = await tx.query<{ draw_id: string }>(
          `update job_draws set
             label = $3,
             sequence = $4,
             percent_basis_points = $5,
             amount_cents = case when status in ('invoiced', 'paid') then amount_cents else $6 end,
             release_condition = $7,
             gate_definition_key = $8
           where job_id = $1 and draw_code = $2
           returning draw_id`,
          [
            input.jobId, template.code, template.label, template.sequence,
            template.percentBasisPoints, amountCents, template.releaseCondition,
            template.gateDefinitionKey,
          ],
        );
        if (updated.rows.length > 0) continue;

        await tx.query(
          `insert into job_draws
           (draw_id, job_id, draw_code, label, sequence, percent_basis_points, amount_cents,
            release_condition, gate_definition_key, status, eligible_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            createCanonicalId('draw'), input.jobId, template.code, template.label, template.sequence,
            template.percentBasisPoints, amountCents, template.releaseCondition,
            template.gateDefinitionKey, contractReleased ? 'eligible' : 'scheduled',
            contractReleased ? signedAt : null,
          ],
        );
      }
    });

    return this.getDrawSchedule(input.jobId);
  }

  /** The job's draws and where the money stands. Not a ledger — see PRD §9.8. */
  async getDrawSchedule(jobId: JobId): Promise<DrawSchedule> {
    const summary = await this.getJob(jobId);
    const result = await this.db.query<{
      draw_id: string;
      job_id: string;
      draw_code: string | null;
      label: string | null;
      sequence: number | null;
      percent_basis_points: number | null;
      amount_cents_text: string | null;
      release_condition: 'contract-signed' | 'gate';
      gate_definition_key: string | null;
      status: JobDraw['status'];
      eligible_at: string | Date | null;
      source_gate_instance_id: string | null;
      invoice_reference: string | null;
      invoiced_at: string | Date | null;
      due_date: string | Date | null;
      paid_at: string | Date | null;
      paid_cents_text: string | null;
    }>(
      `select draw_id, job_id, draw_code, label, sequence, percent_basis_points,
              amount_cents::text as amount_cents_text, release_condition, gate_definition_key,
              status, eligible_at, source_gate_instance_id, invoice_reference, invoiced_at,
              due_date, paid_at, paid_cents::text as paid_cents_text
       from job_draws where job_id = $1
       order by sequence nulls last, eligible_at, draw_id`,
      [jobId],
    );

    const draws = result.rows.map((row) => JobDrawSchema.parse({
      drawId: row.draw_id,
      jobId: row.job_id,
      drawCode: row.draw_code ?? 'unassigned',
      label: row.label ?? row.draw_code ?? 'Draw',
      sequence: row.sequence,
      percentBasisPoints: row.percent_basis_points,
      amountCents: readCents(row.amount_cents_text),
      releaseCondition: row.release_condition,
      gateDefinitionKey: row.gate_definition_key,
      status: row.status,
      eligibleAt: row.eligible_at === null ? null : new Date(row.eligible_at).toISOString(),
      sourceGateInstanceId: row.source_gate_instance_id,
      invoiceReference: row.invoice_reference,
      invoicedAt: row.invoiced_at === null ? null : new Date(row.invoiced_at).toISOString(),
      dueDate: readDate(row.due_date),
      paidAt: row.paid_at === null ? null : new Date(row.paid_at).toISOString(),
      paidCents: readCents(row.paid_cents_text),
    }));

    const sumWhere = (predicate: (draw: JobDraw) => boolean) =>
      draws.filter(predicate).reduce((sum, draw) => sum + (draw.amountCents ?? 0), 0);

    const collectedCents = draws.reduce(
      (sum, draw) => sum + (draw.paidCents ?? (draw.status === 'paid' ? draw.amountCents ?? 0 : 0)),
      0,
    );

    return DrawScheduleSchema.parse({
      jobId,
      contractCents: summary?.contractCents ?? null,
      draws,
      eligibleUnbilledCents: sumWhere((draw) => draw.status === 'eligible'),
      invoicedCents: sumWhere((draw) => draw.status === 'invoiced' || draw.status === 'paid'),
      collectedCents,
      remainingCents: summary?.contractCents === null || summary?.contractCents === undefined
        ? null
        : summary.contractCents - collectedCents,
    });
  }

  /**
   * Record that a human created the invoice for a draw — PRD §9.8.
   *
   * Apex OS never issues an invoice. This only records that someone says one
   * exists, with their name against it.
   */
  async markDrawInvoiced(input: {
    jobId: JobId;
    drawCode: string;
    invoiceReference: string;
    actor: EventActor;
    dueDate?: string;
  }): Promise<DrawSchedule> {
    if (input.actor.kind !== 'user') throw new DomainRuleError('Confirming an invoice requires an authenticated human actor.');
    if (!DRAW_SCHEDULE_AUTHORITY.includes(input.actor.role as (typeof DRAW_SCHEDULE_AUTHORITY)[number])) {
      throw new DomainRuleError(`Role ${input.actor.role} may not confirm an invoice.`);
    }
    const reference = input.invoiceReference.trim();
    if (reference.length === 0) throw new DomainRuleError('An invoice confirmation needs the accounting system reference.');

    const updated = await this.db.query<{ draw_id: string }>(
      `update job_draws
       set status = 'invoiced', invoice_reference = $3, invoiced_at = now(), invoiced_by = $4,
           due_date = coalesce($5, due_date)
       where job_id = $1 and draw_code = $2 and status = 'eligible'
       returning draw_id`,
      [input.jobId, input.drawCode, reference, input.actor.userId, input.dueDate ?? null],
    );
    if (updated.rows.length === 0) {
      throw new DomainRuleError(
        `Draw ${input.drawCode} is not eligible to bill on this job, or has already been invoiced.`,
      );
    }
    return this.getDrawSchedule(input.jobId);
  }

  /** Every subcontractor Apex works with. */
  async listSubcontractors(): Promise<readonly Subcontractor[]> {
    const result = await this.db.query<{
      subcontractor_id: string; name: string; trade: string; contact: string | null; active: boolean;
    }>('select subcontractor_id, name, trade, contact, active from subcontractors order by trade, name');
    return result.rows.map((row) => SubcontractorSchema.parse({
      subcontractorId: row.subcontractor_id,
      name: row.name,
      trade: row.trade,
      contact: row.contact,
      active: row.active,
    }));
  }

  /**
   * Book a crew onto a job — PRD §9.6.
   *
   * A conflicting booking is stored, not refused. The crew genuinely is
   * double-booked the moment someone writes it down, and refusing the write
   * would leave that fact outside the system where nothing can surface it.
   */
  async scheduleVisit(input: {
    jobId: JobId;
    subcontractorId: string;
    phaseKey: ConstructionPhaseKey;
    startsOn: string;
    endsOn: string;
    actor: EventActor;
    note?: string;
  }): Promise<ScheduledVisit> {
    if (input.actor.kind !== 'user') throw new DomainRuleError('Scheduling a visit requires an authenticated human actor.');
    if (!SCHEDULE_AUTHORITY.includes(input.actor.role as (typeof SCHEDULE_AUTHORITY)[number])) {
      throw new DomainRuleError(`Role ${input.actor.role} may not schedule a subcontractor visit.`);
    }
    if (input.endsOn < input.startsOn) {
      throw new DomainRuleError('A visit cannot end before it starts.');
    }

    const visitId = createCanonicalId('visit');
    await this.db.query(
      `insert into scheduled_visits
       (visit_id, job_id, subcontractor_id, phase_key, starts_on, ends_on, note, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [visitId, input.jobId, input.subcontractorId, input.phaseKey,
        input.startsOn, input.endsOn, input.note ?? null, input.actor.userId],
    );
    const visit = (await this.listJobVisits(input.jobId)).find((row) => row.visitId === visitId);
    if (!visit) throw new Error('Visit was not persisted.');
    return visit;
  }

  /**
   * Move a visit — PRD §9.6.
   *
   * The move is recorded rather than the dates simply overwritten: a crew told
   * Tuesday and now expected Thursday is a fact somebody will have to answer
   * for. External notification stays manual in v1, so nothing is sent.
   */
  async rescheduleVisit(input: {
    visitId: string;
    startsOn: string;
    endsOn: string;
    actor: EventActor;
    reason?: string;
  }): Promise<ScheduledVisit> {
    if (input.actor.kind !== 'user') throw new DomainRuleError('Moving a visit requires an authenticated human actor.');
    if (!SCHEDULE_AUTHORITY.includes(input.actor.role as (typeof SCHEDULE_AUTHORITY)[number])) {
      throw new DomainRuleError(`Role ${input.actor.role} may not move a subcontractor visit.`);
    }
    if (input.endsOn < input.startsOn) throw new DomainRuleError('A visit cannot end before it starts.');

    const current = await this.db.query<{
      job_id: string; starts_on: string | Date; ends_on: string | Date; status: string;
    }>('select job_id, starts_on, ends_on, status from scheduled_visits where visit_id = $1', [input.visitId]);
    const row = current.rows[0];
    if (!row) throw new DomainRuleError(`Unknown visit: ${input.visitId}.`);
    if (row.status === 'done' || row.status === 'cancelled') {
      throw new DomainRuleError('A completed or cancelled visit cannot be moved.');
    }
    const from = { startsOn: readDate(row.starts_on)!, endsOn: readDate(row.ends_on)! };
    if (from.startsOn === input.startsOn && from.endsOn === input.endsOn) {
      throw new DomainRuleError('That visit is already on those dates.');
    }

    await this.db.transaction(async (tx) => {
      await tx.query(
        `insert into visit_reschedules
         (visit_id, from_starts_on, from_ends_on, to_starts_on, to_ends_on, reason, moved_by)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [input.visitId, from.startsOn, from.endsOn, input.startsOn, input.endsOn,
          input.reason ?? null, (input.actor as { userId: string }).userId],
      );
      await tx.query(
        'update scheduled_visits set starts_on = $2, ends_on = $3, updated_at = now() where visit_id = $1',
        [input.visitId, input.startsOn, input.endsOn],
      );
    });

    const moved = (await this.listJobVisits(row.job_id as JobId)).find((v) => v.visitId === input.visitId);
    if (!moved) throw new Error('Visit disappeared after being moved.');
    return moved;
  }

  /** A job's visits, in date order. */
  async listJobVisits(jobId: JobId): Promise<readonly ScheduledVisit[]> {
    const result = await this.db.query<VisitRow>(
      `${visitSelect} where v.job_id = $1 order by v.starts_on, v.visit_id`,
      [jobId],
    );
    return result.rows.map(toVisit);
  }

  /** Conflicts on one job, detected against every live visit in the system. */
  async getJobVisitConflicts(jobId: JobId): Promise<readonly VisitConflict[]> {
    const { conflictsByJob } = await this.readScheduleSnapshot();
    return conflictsByJob.get(jobId) ?? [];
  }

  /**
   * Every live visit and the conflicts across them.
   *
   * Detection has to see the whole schedule at once: a double-booking is only
   * visible from outside either job.
   */
  private async readScheduleSnapshot(): Promise<{
    visitsByJob: Map<string, ScheduledVisit[]>;
    conflictsByJob: Map<string, VisitConflict[]>;
  }> {
    const rows = await this.db.query<VisitRow>(`${visitSelect} order by v.starts_on, v.visit_id`);
    const visits = rows.rows.map(toVisit);

    const names = await this.db.query<{ job_id: string; accepted_payload: unknown }>(
      'select j.job_id, l.accepted_payload from jobs j join leads l on l.lead_id = j.lead_id',
    );
    const jobNames = Object.fromEntries(
      names.rows.map((row) => [row.job_id, readLeadIdentity(row.accepted_payload).customerName] as const),
    );

    // Which Gate guards which phase, and whether it has released on each job.
    const guards = await this.db.query<{
      job_id: string; blocks_phase_key: string; title: string; status: string | null;
    }>(`
      select j.job_id, gd.blocks_phase_key, gd.title, gi.status
      from jobs j
      cross join gate_definitions gd
      left join gate_instances gi
        on gi.job_id = j.job_id and gi.definition_key = gd.definition_key
      where gd.active = true and gd.blocks_phase_key is not null
    `);
    const guardsByJob = new Map<string, PhaseGuard[]>();
    for (const row of guards.rows) {
      const list = guardsByJob.get(row.job_id) ?? [];
      list.push({
        phaseKey: row.blocks_phase_key as ConstructionPhaseKey,
        gateTitle: row.title,
        gateStatus: row.status,
        released: row.status === 'released',
      });
      guardsByJob.set(row.job_id, list);
    }

    const conflicts = detectVisitConflicts({
      visits,
      guards: [...guardsByJob.values()].flat(),
      jobNames,
    });

    const visitsByJob = new Map<string, ScheduledVisit[]>();
    for (const visit of visits) {
      visitsByJob.set(visit.jobId, [...(visitsByJob.get(visit.jobId) ?? []), visit]);
    }

    // A conflict belongs to the job whose visit it is about.
    const visitJob = new Map(visits.map((visit) => [visit.visitId, visit.jobId] as const));
    const conflictsByJob = new Map<string, VisitConflict[]>();
    for (const conflict of conflicts) {
      const jobId = visitJob.get(conflict.visitId);
      if (jobId === undefined) continue;
      conflictsByJob.set(jobId, [...(conflictsByJob.get(jobId) ?? []), conflict]);
    }

    return { visitsByJob, conflictsByJob };
  }

  /**
   * The action-card feed — PRD §9.5.
   *
   * Assembles the state the derivation needs and hands it to the pure function
   * in @apex/domain. All judgment about what deserves attention lives there;
   * this method only fetches. `today` is passed in rather than read here so the
   * feed is reproducible and testable.
   */
  async getActionCards(today: string): Promise<readonly ActionCard[]> {
    return deriveCards(await this.readCardSnapshot(), today);
  }

  /**
   * The day's brief — PRD §9.14.
   *
   * Generated once per date and frozen. Asking again on the same day returns
   * the brief that was delivered that morning rather than a fresh one, which is
   * what lets it answer "what changed since yesterday" at all. The Today feed
   * remains the live view.
   */
  async getDailyBrief(briefDate: string): Promise<DailyBrief> {
    const existing = await this.db.query<{ payload: unknown }>(
      'select payload from daily_briefs where brief_date = $1',
      [briefDate],
    );
    if (existing.rows[0]) return DailyBriefSchema.parse(existing.rows[0].payload);

    const previousRow = await this.db.query<{ brief_date: string | Date; payload: unknown }>(
      `select brief_date, payload from daily_briefs
       where brief_date < $1 order by brief_date desc limit 1`,
      [briefDate],
    );
    const previousBrief = previousRow.rows[0]
      ? DailyBriefSchema.parse(previousRow.rows[0].payload)
      : null;

    // Everything the previous brief carried, so today can tell new from
    // standing and name anything that has since cleared.
    const previous: PreviousBrief | null = previousBrief === null ? null : {
      briefDate: previousBrief.briefDate,
      items: [...previousBrief.needsYou, ...previousBrief.running, ...previousBrief.thisWeek]
        .map((item) => ({ cardId: item.card.cardId, standingDays: item.standingDays })),
      titles: Object.fromEntries(
        [...previousBrief.needsYou, ...previousBrief.running, ...previousBrief.thisWeek]
          .map((item) => [item.card.cardId, {
            title: item.card.title,
            customerName: item.card.customerName,
          }] as const),
      ),
    };

    const brief = buildDailyBrief({
      briefId: createCanonicalId('brief'),
      briefDate,
      generatedAt: new Date().toISOString(),
      cards: await this.getActionCards(briefDate),
      previous,
    });

    const cardIds = [...brief.needsYou, ...brief.running, ...brief.thisWeek]
      .map((item) => item.card.cardId);
    await this.db.query(
      `insert into daily_briefs (brief_id, brief_date, generated_at, payload, card_ids)
       values ($1, $2, $3, $4, $5)
       on conflict (brief_date) do nothing`,
      [brief.briefId, briefDate, brief.generatedAt, brief, cardIds],
    );

    // A concurrent request may have won the insert. The delivered brief is the
    // one that was stored, not the one this call happened to build.
    const stored = await this.db.query<{ payload: unknown }>(
      'select payload from daily_briefs where brief_date = $1',
      [briefDate],
    );
    return DailyBriefSchema.parse(stored.rows[0]?.payload ?? brief);
  }

  private async readCardSnapshot(): Promise<readonly CardJobSnapshot[]> {
    const jobs = await this.db.query<JobSummaryRow>(jobSummaryQuery('all'));
    const { visitsByJob, conflictsByJob } = await this.readScheduleSnapshot();
    const phaseTitle = (key: string) => constructionPhase(key as ConstructionPhaseKey).title;

    // Requirement progress per open Gate. `evidence_required` requirements are
    // counted separately from those that have evidence, so a Gate is only ever
    // reported ready when both are satisfied.
    const gates = await this.db.query<{
      job_id: string;
      definition_key: string;
      title: string;
      sequence: number | null;
      phase_key: string | null;
      draw_code: string | null;
      countersign_roles: string[];
      gate_instance_id: string | null;
      status: string | null;
      signed_at: string | Date | null;
      signed_by_name: string | null;
      requirements_total: string;
      requirements_passed: string;
      evidence_outstanding: string;
    }>(`
      select
        j.job_id, gd.definition_key, gd.title, gd.sequence, gd.phase_key, gd.draw_code,
        gd.countersign_roles, gi.gate_instance_id, gi.status, gi.signed_at,
        su.display_name as signed_by_name,
        (select count(*) from gate_requirements gr
          where gr.definition_key = gd.definition_key and gr.definition_version = gd.version)::text
          as requirements_total,
        coalesce((
          select count(*) from (
            select distinct on (re.requirement_key) re.requirement_key, re.outcome
            from requirement_evaluations re
            where re.gate_instance_id = gi.gate_instance_id
            order by re.requirement_key, re.evaluation_version desc
          ) latest where latest.outcome in ('passed', 'overridden')
        ), 0)::text as requirements_passed,
        coalesce((
          select count(*) from gate_requirements gr
          where gr.definition_key = gd.definition_key
            and gr.definition_version = gd.version
            and gr.evidence_required
            and not exists (
              select 1 from evidence_records er
              where er.gate_instance_id = gi.gate_instance_id
                and er.requirement_key = gr.requirement_key
            )
        ), 0)::text as evidence_outstanding
      from jobs j
      cross join gate_definitions gd
      left join gate_instances gi
        on gi.job_id = j.job_id and gi.definition_key = gd.definition_key
      left join app_users su on su.user_id = gi.signed_by
      where gd.active = true
      order by j.job_id, gd.sequence nulls last, gd.definition_key
    `);

    // A draw is outstanding until a human records the invoice. PRD §9.8.
    const draws = await this.db.query<{
      job_id: string;
      draw_id: string;
      draw_code: string | null;
      label: string | null;
      amount_cents_text: string | null;
      percent_basis_points: number | null;
      status: CardDrawSnapshot['status'];
      eligible_at: string | Date | null;
    }>(`
      select job_id, draw_id, draw_code, label, amount_cents::text as amount_cents_text,
             percent_basis_points, status, eligible_at
      from job_draws
      order by sequence nulls last, eligible_at, draw_id
    `);

    const gatesByJob = new Map<string, CardGateSnapshot[]>();
    for (const row of gates.rows) {
      const total = Number(row.requirements_total);
      const list = gatesByJob.get(row.job_id) ?? [];
      list.push({
        definitionKey: row.definition_key,
        title: row.title,
        sequence: row.sequence,
        phaseKey: row.phase_key as ConstructionPhaseKey | null,
        drawCode: row.draw_code,
        requiresCountersign: row.countersign_roles.length > 0,
        gateInstanceId: row.gate_instance_id,
        status: row.status as CardGateSnapshot['status'],
        requirementsTotal: total,
        requirementsPassed: Number(row.requirements_passed),
        evidenceComplete: Number(row.evidence_outstanding) === 0,
        signedByName: row.signed_by_name,
        signedAt: row.signed_at === null ? null : new Date(row.signed_at).toISOString(),
      });
      gatesByJob.set(row.job_id, list);
    }

    const drawsByJob = new Map<string, CardDrawSnapshot[]>();
    for (const row of draws.rows) {
      const list = drawsByJob.get(row.job_id) ?? [];
      list.push({
        drawId: row.draw_id,
        drawCode: row.draw_code ?? row.draw_id,
        label: row.label ?? row.draw_code ?? 'Draw',
        amountCents: readCents(row.amount_cents_text),
        percentBasisPoints: row.percent_basis_points,
        status: row.status,
        eligibleAt: row.eligible_at === null ? null : new Date(row.eligible_at).toISOString(),
      });
      drawsByJob.set(row.job_id, list);
    }

    return jobs.rows.map((row) => {
      const summary = toJobSummary(row);
      return {
        jobId: summary.jobId,
        customerName: summary.customerName,
        addressLine: summary.addressLine,
        jobStatus: summary.status,
        approvedTakeoffRevisionId: summary.approvedTakeoffRevisionId,
        contractCents: summary.contractCents,
        hasDrawSchedule: (drawsByJob.get(summary.jobId) ?? []).some((draw) => DRAW_CODES.includes(draw.drawCode as never)),
        project: summary.project === null ? null : {
          currentPhaseKey: summary.project.currentPhaseKey,
          superintendentName: summary.project.superintendentName,
          targetCompletionEnd: summary.project.targetCompletionEnd,
          riskNote: summary.project.riskNote,
        },
        gates: gatesByJob.get(summary.jobId) ?? [],
        draws: drawsByJob.get(summary.jobId) ?? [],
        visits: (visitsByJob.get(summary.jobId) ?? [])
          .filter((visit) => visit.status === 'planned' || visit.status === 'confirmed')
          .map((visit) => ({
            visitId: visit.visitId,
            subcontractorName: visit.subcontractorName,
            trade: visit.trade,
            phaseTitle: phaseTitle(visit.phaseKey),
            startsOn: visit.startsOn,
            endsOn: visit.endsOn,
            conflicts: (conflictsByJob.get(summary.jobId) ?? [])
              .filter((conflict) => conflict.visitId === visit.visitId)
              .map((conflict) => ({ kind: conflict.kind, description: describeConflict(conflict) })),
          })),
      };
    });
  }

  async getCustomerMilestones(jobId: JobId): Promise<readonly CustomerMilestoneProjection[]> {
    const result = await this.db.query<{
      projection_id: string;
      job_id: string;
      milestone: string;
      title: string;
      summary: string;
      media_url: string | null;
      published_at: string | Date;
    }>(
      `select projection_id, job_id, milestone, title, summary, media_url, published_at
       from customer_milestone_projections where job_id = $1 order by published_at`,
      [jobId],
    );
    return result.rows.map((row) => CustomerMilestoneProjectionSchema.parse({
      projectionId: row.projection_id,
      jobId: row.job_id,
      milestone: row.milestone,
      title: row.title,
      summary: row.summary,
      ...(row.media_url ? { mediaUrl: row.media_url } : {}),
      publishedAt: new Date(row.published_at).toISOString(),
    }));
  }

  private assertEvidenceContext(
    command: Extract<GateCommand, { type: 'add-evidence' }>,
    proof: EvidenceWrite | undefined,
    jobId: JobId,
  ) {
    if (!proof) throw new Error('Evidence metadata is required for an evidence command.');
    if (proof.evidenceId !== command.evidenceId || proof.requirementKey !== command.requirementKey || proof.kind !== command.kind) {
      throw new Error('Evidence metadata does not match the Gate command.');
    }
    if (!/^[a-f0-9]{64}$/.test(proof.sha256)) throw new Error('Evidence requires a lowercase SHA-256 digest.');
    if (!proof.storageKey.startsWith(`${jobId}/`)) {
      throw new Error('Evidence storage keys must be job-scoped paths.');
    }
  }

  private async persistEvent(tx: Transaction, event: ApexEvent) {
    await tx.query(
      `insert into events
       (event_id, schema_version, event_type, occurred_at, recorded_at, actor, lead_id, job_id, correlation_id, causation_event_id, idempotency_key, payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        event.eventId, event.schemaVersion, event.eventType, event.occurredAt, event.recordedAt,
        event.actor, event.leadId ?? null, event.jobId, event.correlationId,
        event.causationEventId ?? null, event.idempotencyKey, event.payload,
      ],
    );
  }

  private async projectEvent(
    tx: Transaction,
    event: ApexEvent,
    gate: { definitionKey: string; definitionVersion: number } | null = null,
  ) {
    switch (event.eventType) {
      case 'gate.started':
        await tx.query(
          `update gate_instances set status = 'in-progress', started_at = $2 where gate_instance_id = $1`,
          [event.payload.gateInstanceId, event.occurredAt],
        );
        break;
      case 'requirement.passed':
      case 'requirement.failed': {
        const version = await tx.query<{ next_version: number }>(
          `select coalesce(max(evaluation_version), 0) + 1 as next_version
           from requirement_evaluations where gate_instance_id = $1 and requirement_key = $2`,
          [event.payload.gateInstanceId, event.payload.requirementKey],
        );
        await tx.query(
          `insert into requirement_evaluations
           (gate_instance_id, requirement_key, evaluation_version, outcome, evidence_ids, reason, evaluated_at, evaluated_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            event.payload.gateInstanceId,
            event.payload.requirementKey,
            version.rows[0]?.next_version ?? 1,
            event.eventType === 'requirement.passed' ? 'passed' : 'failed',
            event.payload.evidenceIds,
            event.eventType === 'requirement.failed' ? event.payload.reason : event.payload.note ?? null,
            event.occurredAt,
            event.payload.evaluatedBy,
          ],
        );
        break;
      }
      case 'gate.blocked':
        await tx.query(`update gate_instances set status = 'blocked' where gate_instance_id = $1`, [event.payload.gateInstanceId]);
        break;
      case 'gate.signoff_recorded':
        await tx.query(
          `update gate_instances
           set status = 'awaiting-countersign', signed_by = $2, signed_at = $3
           where gate_instance_id = $1`,
          [event.payload.gateInstanceId, event.payload.signedBy, event.occurredAt],
        );
        break;
      case 'gate.countersigned':
        // The release event immediately after this one records the countersigner
        // in released_by; the database refuses it if it equals signed_by.
        break;
      case 'gate.released':
        await tx.query(
          `update gate_instances set status = 'released', released_at = $2, released_by = $3 where gate_instance_id = $1`,
          [event.payload.gateInstanceId, event.occurredAt, event.payload.releasedBy],
        );
        break;
      case 'draw.eligible': {
        // Prefer the scheduled draw this Gate was bound to. Inserting a second
        // row would leave the job owed the same money twice.
        const drawCode = gate === null ? null : drawCodeForGate(gate.definitionKey);
        if (drawCode !== null) {
          const claimed = await tx.query<{ draw_id: string }>(
            `update job_draws
             set status = 'eligible', eligible_at = $3, source_gate_instance_id = $4
             where job_id = $1 and draw_code = $2 and status = 'scheduled'
             returning draw_id`,
            [event.jobId, drawCode, event.occurredAt, event.payload.sourceGateInstanceId],
          );
          if (claimed.rows.length > 0) break;
        }
        // No schedule on this job yet — record the draw so the money is not lost,
        // with no amount, because nothing here knows what it is worth.
        await tx.query(
          `insert into job_draws
           (draw_id, job_id, draw_code, label, source_gate_instance_id, eligible_at, amount_cents, release_condition, gate_definition_key, status)
           values ($1, $2, $3, $4, $5, $6, $7, 'gate', $8, 'eligible')`,
          [
            event.payload.drawId, event.jobId, drawCode ?? `unscheduled-${event.payload.drawId.slice(-8).toLowerCase()}`,
            DRAW_SCHEDULE_TEMPLATE.find((draw) => draw.code === drawCode)?.label ?? gate?.definitionKey ?? 'Draw',
            event.payload.sourceGateInstanceId, event.occurredAt,
            event.payload.amountCents, gate?.definitionKey ?? null,
          ],
        );
        break;
      }
      case 'customer_update.published': {
        // The customer's wording belongs to the Gate definition. It used to be
        // hardcoded to pre-gunite, which would have told every customer the
        // same thing about seven different milestones.
        if (!gate) throw new Error('A customer update must be projected in the context of its Gate.');
        const source = await tx.query<{ customer_update_title: string; customer_update_summary: string }>(
          `select customer_update_title, customer_update_summary
           from gate_definitions where definition_key = $1 and version = $2`,
          [gate.definitionKey, gate.definitionVersion],
        );
        const copy = source.rows[0];
        if (!copy?.customer_update_title || !copy.customer_update_summary) {
          throw new Error('A customer update requires published wording on its Gate definition.');
        }
        await tx.query(
          `insert into customer_milestone_projections
           (projection_id, job_id, milestone, title, summary, published_at, source_event_id)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.payload.projectionId,
            event.jobId,
            event.payload.milestone,
            copy.customer_update_title,
            copy.customer_update_summary,
            event.occurredAt,
            event.eventId,
          ],
        );
        break;
      }
      default:
        break;
    }
  }
}
