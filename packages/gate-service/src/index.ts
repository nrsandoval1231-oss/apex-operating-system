import { createHash } from 'node:crypto';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import {
  ApexEventSchema,
  CustomerMilestoneProjectionSchema,
  createCanonicalId,
  type ApexEvent,
  type CustomerMilestoneProjection,
  type EvidenceId,
  type EvidenceKind,
  type EventActor,
  type EventId,
  type GateInstanceId,
  type JobId,
} from '@apex/contracts';
import {
  decideGateCommand,
  evolveGate,
  newGateState,
  type DomainEventDraft,
  type GateCommand,
  type GateState,
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

export interface ExecuteResult {
  readonly state: GateState;
  readonly events: readonly ApexEvent[];
  readonly duplicate: boolean;
}

type QueryClient = Pick<PGlite, 'query'> | Transaction;

const replayableEventTypes = new Set([
  'gate.started',
  'evidence.added',
  'requirement.passed',
  'requirement.failed',
  'gate.blocked',
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

  async createPreGuniteGate(input: { gateInstanceId: GateInstanceId; jobId: JobId }): Promise<GateState> {
    const existing = await this.db.query<{ gate_instance_id: GateInstanceId }>(
      `select gate_instance_id from gate_instances
       where job_id = $1 and definition_key = 'pre-gunite' and definition_version = 1`,
      [input.jobId],
    );
    if (existing.rows[0]) return this.getGate(existing.rows[0].gate_instance_id);

    const approved = await this.db.query<{ revision_id: string }>(
      `select revision_id from takeoff_revisions
       where job_id = $1 and status = 'approved'
       order by revision_number desc limit 1`,
      [input.jobId],
    );
    if (!approved.rows[0]) throw new Error('A pre-gunite Gate requires an approved Designer takeoff revision.');

    await this.db.query(
      `insert into gate_instances
       (gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id, status)
       values ($1, $2, 'pre-gunite', 1, $3, 'not-started')`,
      [input.gateInstanceId, input.jobId, approved.rows[0].revision_id],
    );
    return this.getGate(input.gateInstanceId);
  }

  async getGate(gateInstanceId: GateInstanceId, client: QueryClient = this.db): Promise<GateState> {
    const gates = await client.query<{
      gate_instance_id: GateInstanceId;
      job_id: JobId;
      definition_key: string;
      definition_version: number;
      approved_takeoff_revision_id: string;
    }>(
      `select gate_instance_id, job_id, definition_key, definition_version, approved_takeoff_revision_id
       from gate_instances where gate_instance_id = $1`,
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
        await this.projectEvent(tx, event);
        persisted.push(event);
      }
    });

    return {
      state: drafts.reduce(evolveGate, state),
      events: persisted,
      duplicate: false,
    };
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

  private async projectEvent(tx: Transaction, event: ApexEvent) {
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
      case 'gate.released':
        await tx.query(
          `update gate_instances set status = 'released', released_at = $2, released_by = $3 where gate_instance_id = $1`,
          [event.payload.gateInstanceId, event.occurredAt, event.payload.releasedBy],
        );
        break;
      case 'draw.eligible':
        await tx.query(
          `insert into draw_eligibility (draw_id, job_id, source_gate_instance_id, eligible_at, amount_cents)
           values ($1, $2, $3, $4, $5)`,
          [event.payload.drawId, event.jobId, event.payload.sourceGateInstanceId, event.occurredAt, event.payload.amountCents],
        );
        break;
      case 'customer_update.published':
        await tx.query(
          `insert into customer_milestone_projections
           (projection_id, job_id, milestone, title, summary, published_at, source_event_id)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            event.payload.projectionId,
            event.jobId,
            event.payload.milestone,
            'Pre-gunite release complete',
            'Apex verified the pre-gunite hold point and authorized the next construction phase.',
            event.occurredAt,
            event.eventId,
          ],
        );
        break;
      default:
        break;
    }
  }
}
