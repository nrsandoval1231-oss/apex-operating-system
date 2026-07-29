import {
  createCanonicalId,
  type AppRole,
  type EventActor,
  type EvidenceId,
  type GateInstanceId,
  type JobId,
  type RevisionId,
} from '@apex/contracts';

export type RequirementStatus = 'pending' | 'passed' | 'failed' | 'overridden';
export type GateStatus = 'not-started' | 'in-progress' | 'blocked' | 'released';

export interface GateRequirementState {
  readonly key: string;
  readonly evidenceRequired: boolean;
  readonly status: RequirementStatus;
  readonly evidenceIds: readonly EvidenceId[];
  readonly evaluatedBy?: string;
  readonly note?: string;
}

export interface GateState {
  readonly gateInstanceId: GateInstanceId;
  readonly jobId: JobId;
  readonly definitionKey: string;
  readonly definitionVersion: number;
  readonly approvedTakeoffRevisionId: RevisionId | null;
  readonly status: GateStatus;
  readonly requirements: ReadonlyMap<string, GateRequirementState>;
  readonly releasedAt: string | null;
}

export interface NewGateStateInput {
  readonly gateInstanceId: GateInstanceId;
  readonly jobId: JobId;
  readonly definitionKey: string;
  readonly definitionVersion: number;
  readonly approvedTakeoffRevisionId: RevisionId | null;
  readonly requirements: readonly { readonly key: string; readonly evidenceRequired: boolean }[];
}

export type GateCommand =
  | { readonly type: 'start-gate'; readonly actor: EventActor; readonly at: string }
  | {
      readonly type: 'add-evidence';
      readonly actor: EventActor;
      readonly at: string;
      readonly requirementKey: string;
      readonly evidenceId: EvidenceId;
    }
  | {
      readonly type: 'evaluate-requirement';
      readonly actor: EventActor;
      readonly at: string;
      readonly requirementKey: string;
      readonly outcome: 'passed' | 'failed';
      readonly note?: string;
    }
  | { readonly type: 'release-gate'; readonly actor: EventActor; readonly at: string };

export type DomainEventDraft =
  | { readonly eventType: 'gate.started'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly takeoffRevisionId: RevisionId }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'evidence.added'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly requirementKey: string; readonly evidenceId: EvidenceId; readonly kind: 'photo' }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'requirement.passed' | 'requirement.failed'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly requirementKey: string; readonly evaluatedBy: string; readonly evidenceIds: readonly EvidenceId[]; readonly note?: string; readonly reason?: string }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.blocked'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly blockedRequirementKeys: readonly string[]; readonly reason: string }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.released'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly takeoffRevisionId: RevisionId; readonly releasedBy: string; readonly releasedByRole: 'admin' | 'field'; readonly evidenceIds: readonly EvidenceId[] }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'draw.eligible'; readonly jobId: JobId; readonly payload: { readonly drawId: string; readonly sourceGateInstanceId: GateInstanceId; readonly amountCents: null }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'customer_update.published'; readonly jobId: JobId; readonly payload: { readonly projectionId: string; readonly milestone: 'pre-gunite-released'; readonly publishedBy: string }; readonly at: string; readonly actor: EventActor };

export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainRuleError';
  }
}

const userActor = (actor: EventActor): Extract<EventActor, { kind: 'user' }> => {
  if (actor.kind !== 'user') throw new DomainRuleError('This command requires an authenticated human actor.');
  return actor;
};

const requireRole = <Roles extends readonly AppRole[]>(actor: EventActor, allowed: Roles) => {
  const user = userActor(actor);
  if (!allowed.includes(user.role)) throw new DomainRuleError(`Role ${user.role} is not authorized for this Gate command.`);
  return user as typeof user & { role: Roles[number] };
};

const requirementFor = (state: GateState, key: string) => {
  const requirement = state.requirements.get(key);
  if (!requirement) throw new DomainRuleError(`Unknown Gate requirement: ${key}.`);
  return requirement;
};

export function newGateState(input: NewGateStateInput): GateState {
  const requirements = new Map<string, GateRequirementState>();
  for (const requirement of input.requirements) {
    if (requirements.has(requirement.key)) throw new DomainRuleError(`Duplicate Gate requirement: ${requirement.key}.`);
    requirements.set(requirement.key, {
      key: requirement.key,
      evidenceRequired: requirement.evidenceRequired,
      status: 'pending',
      evidenceIds: [],
    });
  }
  return {
    ...input,
    status: 'not-started',
    requirements,
    releasedAt: null,
  };
}

export function decideGateCommand(state: GateState, command: GateCommand): readonly DomainEventDraft[] {
  switch (command.type) {
    case 'start-gate': {
      requireRole(command.actor, ['admin', 'office', 'field']);
      if (state.status !== 'not-started') throw new DomainRuleError('Gate has already been started.');
      if (!state.approvedTakeoffRevisionId) throw new DomainRuleError('Gate cannot start without an approved takeoff revision.');
      return [{
        eventType: 'gate.started',
        jobId: state.jobId,
        payload: {
          gateInstanceId: state.gateInstanceId,
          definitionVersion: state.definitionVersion,
          takeoffRevisionId: state.approvedTakeoffRevisionId,
        },
        at: command.at,
        actor: command.actor,
      }];
    }
    case 'add-evidence': {
      requireRole(command.actor, ['admin', 'office', 'field']);
      if (state.status === 'released') throw new DomainRuleError('Released Gates are immutable.');
      requirementFor(state, command.requirementKey);
      return [{
        eventType: 'evidence.added',
        jobId: state.jobId,
        payload: {
          gateInstanceId: state.gateInstanceId,
          definitionVersion: state.definitionVersion,
          requirementKey: command.requirementKey,
          evidenceId: command.evidenceId,
          kind: 'photo',
        },
        at: command.at,
        actor: command.actor,
      }];
    }
    case 'evaluate-requirement': {
      const user = requireRole(command.actor, ['admin', 'field']);
      if (state.status === 'released') throw new DomainRuleError('Released Gates are immutable.');
      const requirement = requirementFor(state, command.requirementKey);
      const payload = {
        gateInstanceId: state.gateInstanceId,
        definitionVersion: state.definitionVersion,
        requirementKey: command.requirementKey,
        evaluatedBy: user.userId,
        evidenceIds: requirement.evidenceIds,
        ...(command.note ? { note: command.note } : {}),
      };
      if (command.outcome === 'passed') {
        return [{ eventType: 'requirement.passed', jobId: state.jobId, payload, at: command.at, actor: command.actor }];
      }
      const reason = command.note?.trim() || 'Requirement failed without a note.';
      return [
        {
          eventType: 'requirement.failed',
          jobId: state.jobId,
          payload: { ...payload, reason },
          at: command.at,
          actor: command.actor,
        },
        {
          eventType: 'gate.blocked',
          jobId: state.jobId,
          payload: {
            gateInstanceId: state.gateInstanceId,
            definitionVersion: state.definitionVersion,
            blockedRequirementKeys: [command.requirementKey],
            reason,
          },
          at: command.at,
          actor: command.actor,
        },
      ];
    }
    case 'release-gate': {
      const user = requireRole(command.actor, ['admin', 'field']);
      if (!state.approvedTakeoffRevisionId) throw new DomainRuleError('Gate release requires an approved takeoff revision.');
      if (state.status !== 'in-progress') throw new DomainRuleError('Gate must be in progress before release.');
      const incomplete = [...state.requirements.values()].filter((requirement) => requirement.status !== 'passed' && requirement.status !== 'overridden');
      if (incomplete.length) throw new DomainRuleError(`Gate release blocked by incomplete requirements: ${incomplete.map((item) => item.key).join(', ')}.`);
      const missingEvidence = [...state.requirements.values()].filter((requirement) => requirement.evidenceRequired && requirement.evidenceIds.length === 0);
      if (missingEvidence.length) throw new DomainRuleError(`Gate release blocked because evidence is missing for: ${missingEvidence.map((item) => item.key).join(', ')}.`);
      const evidenceIds = [...new Set([...state.requirements.values()].flatMap((requirement) => requirement.evidenceIds))];
      return [
        {
          eventType: 'gate.released',
          jobId: state.jobId,
          payload: {
            gateInstanceId: state.gateInstanceId,
            definitionVersion: state.definitionVersion,
            takeoffRevisionId: state.approvedTakeoffRevisionId,
            releasedBy: user.userId,
            releasedByRole: user.role,
            evidenceIds,
          },
          at: command.at,
          actor: command.actor,
        },
        {
          eventType: 'draw.eligible',
          jobId: state.jobId,
          payload: {
            drawId: createCanonicalId('draw'),
            sourceGateInstanceId: state.gateInstanceId,
            amountCents: null,
          },
          at: command.at,
          actor: command.actor,
        },
        {
          eventType: 'customer_update.published',
          jobId: state.jobId,
          payload: {
            projectionId: createCanonicalId('customer_update'),
            milestone: 'pre-gunite-released',
            publishedBy: user.userId,
          },
          at: command.at,
          actor: command.actor,
        },
      ];
    }
  }
}

export function evolveGate(state: GateState, event: DomainEventDraft): GateState {
  switch (event.eventType) {
    case 'gate.started':
      return { ...state, status: 'in-progress' };
    case 'evidence.added': {
      const current = requirementFor(state, event.payload.requirementKey);
      const requirements = new Map(state.requirements);
      requirements.set(current.key, {
        ...current,
        evidenceIds: [...new Set([...current.evidenceIds, event.payload.evidenceId])],
      });
      return { ...state, requirements };
    }
    case 'requirement.passed':
    case 'requirement.failed': {
      const current = requirementFor(state, event.payload.requirementKey);
      const requirements = new Map(state.requirements);
      requirements.set(current.key, {
        ...current,
        status: event.eventType === 'requirement.passed' ? 'passed' : 'failed',
        evaluatedBy: event.payload.evaluatedBy,
        ...(event.payload.note ? { note: event.payload.note } : {}),
      });
      return { ...state, requirements };
    }
    case 'gate.blocked':
      return { ...state, status: 'blocked' };
    case 'gate.released':
      return { ...state, status: 'released', releasedAt: event.at };
    case 'draw.eligible':
    case 'customer_update.published':
      return state;
  }
}
