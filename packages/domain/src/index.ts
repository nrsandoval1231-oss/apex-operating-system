import {
  createCanonicalId,
  type AppRole,
  type CustomerMilestoneKey,
  type EventActor,
  type EvidenceKind,
  type EvidenceId,
  type GateInstanceId,
  type GateReleaseRole,
  type JobId,
  type RevisionId,
} from '@apex/contracts';

import { DomainRuleError } from './errors.js';

export * from './project.js';
export * from './cards.js';
export * from './draws.js';

export type RequirementStatus = 'pending' | 'passed' | 'failed' | 'overridden';
export type GateStatus = 'not-started' | 'in-progress' | 'blocked' | 'awaiting-countersign' | 'released';

/** The first of two signatures on a Gate that requires a countersign. */
export interface GateSignoff {
  readonly userId: string;
  readonly role: GateReleaseRole;
  readonly at: string;
}

export interface GateRequirementState {
  readonly key: string;
  readonly evidenceRequired: boolean;
  readonly acceptedEvidenceKinds: readonly EvidenceKind[];
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
  /**
   * Who may release this Gate, from its definition. The owner alone holds the
   * four draw-bearing Gates; the superintendent holds the three that release no
   * money. Carried per-Gate rather than as one global rule.
   */
  readonly releaseRoles: readonly GateReleaseRole[];
  /**
   * Roles that must countersign before this Gate releases. Empty on every Gate
   * but pre-gunite: gunite buries the rebar and the plumbing, so the owner signs
   * the irreversible one personally. Authority follows what cannot be undone,
   * not what can be credited.
   */
  readonly countersignRoles: readonly GateReleaseRole[];
  /**
   * The draw this Gate releases, or null. Only four of the seven Gates bear a
   * draw; the other three must not create draw eligibility just by releasing.
   */
  readonly drawCode: string | null;
  /** The milestone published to the customer on release, or null for none. */
  readonly customerMilestone: CustomerMilestoneKey | null;
  /** The first signature, once given. Null on a single-signature Gate. */
  readonly signoff: GateSignoff | null;
  readonly releasedAt: string | null;
}

export interface NewGateStateInput {
  readonly gateInstanceId: GateInstanceId;
  readonly jobId: JobId;
  readonly definitionKey: string;
  readonly definitionVersion: number;
  readonly approvedTakeoffRevisionId: RevisionId | null;
  /** Required, not defaulted: an authority control must never fail open. */
  readonly releaseRoles: readonly GateReleaseRole[];
  /** Optional because empty is the ordinary case; absent means single-signature. */
  readonly countersignRoles?: readonly GateReleaseRole[];
  /** Absent means this Gate releases no draw. */
  readonly drawCode?: string | null;
  /** Absent means this Gate publishes nothing to the customer. */
  readonly customerMilestone?: CustomerMilestoneKey | null;
  readonly requirements: readonly {
    readonly key: string;
    readonly evidenceRequired: boolean;
    readonly acceptedEvidenceKinds?: readonly EvidenceKind[];
  }[];
}

export type GateCommand =
  | { readonly type: 'start-gate'; readonly actor: EventActor; readonly at: string }
  | {
      readonly type: 'add-evidence';
      readonly actor: EventActor;
      readonly at: string;
      readonly requirementKey: string;
      readonly evidenceId: EvidenceId;
      readonly kind: EvidenceKind;
    }
  | {
      readonly type: 'evaluate-requirement';
      readonly actor: EventActor;
      readonly at: string;
      readonly requirementKey: string;
      readonly outcome: 'passed' | 'failed';
      readonly note?: string;
    }
  | { readonly type: 'release-gate'; readonly actor: EventActor; readonly at: string }
  | { readonly type: 'countersign-gate'; readonly actor: EventActor; readonly at: string };

export type DomainEventDraft =
  | { readonly eventType: 'gate.started'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly takeoffRevisionId: RevisionId }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'evidence.added'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly requirementKey: string; readonly evidenceId: EvidenceId; readonly kind: EvidenceKind }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'requirement.passed' | 'requirement.failed'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly requirementKey: string; readonly evaluatedBy: string; readonly evidenceIds: readonly EvidenceId[]; readonly note?: string; readonly reason?: string }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.blocked'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly blockedRequirementKeys: readonly string[]; readonly reason: string }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.signoff_recorded'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly signedBy: string; readonly signedByRole: GateReleaseRole; readonly awaitingCountersignFromRoles: readonly GateReleaseRole[]; readonly evidenceIds: readonly EvidenceId[] }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.countersigned'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly countersignedBy: string; readonly countersignedByRole: GateReleaseRole; readonly signedBy: string }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'gate.released'; readonly jobId: JobId; readonly payload: { readonly gateInstanceId: GateInstanceId; readonly definitionVersion: number; readonly takeoffRevisionId: RevisionId; readonly releasedBy: string; readonly releasedByRole: GateReleaseRole; readonly evidenceIds: readonly EvidenceId[] }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'draw.eligible'; readonly jobId: JobId; readonly payload: { readonly drawId: string; readonly sourceGateInstanceId: GateInstanceId; readonly amountCents: null }; readonly at: string; readonly actor: EventActor }
  | { readonly eventType: 'customer_update.published'; readonly jobId: JobId; readonly payload: { readonly projectionId: string; readonly milestone: CustomerMilestoneKey; readonly publishedBy: string }; readonly at: string; readonly actor: EventActor };

export { DomainRuleError } from './errors.js';

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
  if (input.releaseRoles.length === 0) {
    throw new DomainRuleError('A Gate definition must name at least one role authorized to release it.');
  }
  const countersignRoles = input.countersignRoles ?? [];
  // A Gate whose only release role is also its countersign role could never be
  // released, because one person may not fill both signatures.
  if (countersignRoles.length > 0 && input.releaseRoles.every((role) => countersignRoles.includes(role))) {
    throw new DomainRuleError('A countersigned Gate needs a release role that is not also a countersign role.');
  }
  const requirements = new Map<string, GateRequirementState>();
  for (const requirement of input.requirements) {
    if (requirements.has(requirement.key)) throw new DomainRuleError(`Duplicate Gate requirement: ${requirement.key}.`);
    requirements.set(requirement.key, {
      key: requirement.key,
      evidenceRequired: requirement.evidenceRequired,
      acceptedEvidenceKinds: requirement.acceptedEvidenceKinds ?? ['photo', 'video', 'document', 'measurement', 'inspection'],
      status: 'pending',
      evidenceIds: [],
    });
  }
  return {
    ...input,
    countersignRoles,
    drawCode: input.drawCode ?? null,
    customerMilestone: input.customerMilestone ?? null,
    status: 'not-started',
    requirements,
    signoff: null,
    releasedAt: null,
  };
}

const gatheredEvidence = (state: GateState): readonly EvidenceId[] =>
  [...new Set([...state.requirements.values()].flatMap((requirement) => requirement.evidenceIds))];

/**
 * The release and everything it triggers. Shared by the single-signature path
 * and the countersigned one so a Gate's consequences cannot drift apart from
 * how many signatures it took to get there.
 */
const releaseDrafts = (
  state: GateState,
  user: { userId: string; role: GateReleaseRole },
  evidenceIds: readonly EvidenceId[],
  at: string,
  actor: EventActor,
): readonly DomainEventDraft[] => {
  if (!state.approvedTakeoffRevisionId) throw new DomainRuleError('Gate release requires an approved takeoff revision.');
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
      at,
      actor,
    },
    // Only the four draw-bearing Gates create draw eligibility. Permit,
    // pre-gunite, and Equipment release work, not money.
    ...(state.drawCode === null ? [] : [{
      eventType: 'draw.eligible' as const,
      jobId: state.jobId,
      payload: {
        drawId: createCanonicalId('draw'),
        sourceGateInstanceId: state.gateInstanceId,
        amountCents: null,
      },
      at,
      actor,
    }]),
    // And only Gates that map a milestone tell the customer anything.
    ...(state.customerMilestone === null ? [] : [{
      eventType: 'customer_update.published' as const,
      jobId: state.jobId,
      payload: {
        projectionId: createCanonicalId('customer_update'),
        milestone: state.customerMilestone,
        publishedBy: user.userId,
      },
      at,
      actor,
    }]),
  ];
};

export function decideGateCommand(state: GateState, command: GateCommand): readonly DomainEventDraft[] {
  switch (command.type) {
    case 'start-gate': {
      requireRole(command.actor, ['admin', 'office', 'superintendent', 'field']);
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
      requireRole(command.actor, ['admin', 'office', 'superintendent', 'field']);
      if (state.status === 'released') throw new DomainRuleError('Released Gates are immutable.');
      const requirement = requirementFor(state, command.requirementKey);
      if (!requirement.acceptedEvidenceKinds.includes(command.kind)) {
        throw new DomainRuleError(`Evidence kind ${command.kind} is not accepted for ${command.requirementKey}.`);
      }
      return [{
        eventType: 'evidence.added',
        jobId: state.jobId,
        payload: {
          gateInstanceId: state.gateInstanceId,
          definitionVersion: state.definitionVersion,
          requirementKey: command.requirementKey,
          evidenceId: command.evidenceId,
          kind: command.kind,
        },
        at: command.at,
        actor: command.actor,
      }];
    }
    case 'evaluate-requirement': {
      const user = requireRole(command.actor, ['admin', 'superintendent', 'field']);
      if (state.status === 'released') throw new DomainRuleError('Released Gates are immutable.');
      const requirement = requirementFor(state, command.requirementKey);
      const sharedPayload = {
        gateInstanceId: state.gateInstanceId,
        definitionVersion: state.definitionVersion,
        requirementKey: command.requirementKey,
        evaluatedBy: user.userId,
        evidenceIds: requirement.evidenceIds,
      };
      if (command.outcome === 'passed') {
        const payload = { ...sharedPayload, ...(command.note ? { note: command.note } : {}) };
        return [{ eventType: 'requirement.passed', jobId: state.jobId, payload, at: command.at, actor: command.actor }];
      }
      const reason = command.note?.trim() || 'Requirement failed without a note.';
      return [
        {
          eventType: 'requirement.failed',
          jobId: state.jobId,
          payload: { ...sharedPayload, reason },
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
      // Authority comes from the Gate definition, not from a global role list.
      // A superintendent who may release pre-gunite may not release a draw.
      const user = requireRole(command.actor, state.releaseRoles);
      if (!state.approvedTakeoffRevisionId) throw new DomainRuleError('Gate release requires an approved takeoff revision.');
      if (state.status !== 'in-progress' && state.status !== 'blocked') {
        throw new DomainRuleError('Gate must be started before release.');
      }
      const incomplete = [...state.requirements.values()].filter((requirement) => requirement.status !== 'passed' && requirement.status !== 'overridden');
      if (incomplete.length) throw new DomainRuleError(`Gate release blocked by incomplete requirements: ${incomplete.map((item) => item.key).join(', ')}.`);
      const missingEvidence = [...state.requirements.values()].filter((requirement) => requirement.evidenceRequired && requirement.evidenceIds.length === 0);
      if (missingEvidence.length) throw new DomainRuleError(`Gate release blocked because evidence is missing for: ${missingEvidence.map((item) => item.key).join(', ')}.`);
      const evidenceIds = gatheredEvidence(state);

      // A Gate that needs two signatures does not release on the first one. The
      // countersign blocks the release; it is not a confirmation recorded after
      // the concrete is already down.
      if (state.countersignRoles.length > 0) {
        return [{
          eventType: 'gate.signoff_recorded',
          jobId: state.jobId,
          payload: {
            gateInstanceId: state.gateInstanceId,
            definitionVersion: state.definitionVersion,
            signedBy: user.userId,
            signedByRole: user.role,
            awaitingCountersignFromRoles: state.countersignRoles,
            evidenceIds,
          },
          at: command.at,
          actor: command.actor,
        }];
      }
      return releaseDrafts(state, user, evidenceIds, command.at, command.actor);
    }
    case 'countersign-gate': {
      if (state.countersignRoles.length === 0) {
        throw new DomainRuleError('This Gate does not require a countersign.');
      }
      const user = requireRole(command.actor, state.countersignRoles);
      if (state.status === 'released') throw new DomainRuleError('Released Gates are immutable.');
      if (state.status !== 'awaiting-countersign' || state.signoff === null) {
        throw new DomainRuleError('A Gate must be signed off before it can be countersigned.');
      }
      // The whole value of a countersign is that a second person looked. One
      // human holding both roles does not satisfy it.
      if (state.signoff.userId === user.userId) {
        throw new DomainRuleError('A Gate countersign requires a different person than the signer.');
      }
      if (!state.approvedTakeoffRevisionId) throw new DomainRuleError('Gate release requires an approved takeoff revision.');
      const evidenceIds = gatheredEvidence(state);
      return [
        {
          eventType: 'gate.countersigned',
          jobId: state.jobId,
          payload: {
            gateInstanceId: state.gateInstanceId,
            definitionVersion: state.definitionVersion,
            countersignedBy: user.userId,
            countersignedByRole: user.role,
            signedBy: state.signoff.userId,
          },
          at: command.at,
          actor: command.actor,
        },
        ...releaseDrafts(state, user, evidenceIds, command.at, command.actor),
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
    case 'gate.signoff_recorded':
      return {
        ...state,
        status: 'awaiting-countersign',
        signoff: { userId: event.payload.signedBy, role: event.payload.signedByRole, at: event.at },
      };
    case 'gate.countersigned':
      // The release event that follows carries the status change.
      return state;
    case 'gate.released':
      return { ...state, status: 'released', releasedAt: event.at };
    case 'draw.eligible':
    case 'customer_update.published':
      return state;
  }
}
