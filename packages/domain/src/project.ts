import {
  constructionPhase,
  customerMilestoneForPhase,
  type ConstructionPhaseKey,
  type CustomerMilestoneKey,
  type EventActor,
  type JobId,
  type UserId,
} from '@apex/contracts';
import { DomainRuleError } from './errors.js';

/**
 * Pure construction-phase rules. No database, no clock, no I/O.
 *
 * Authority: docs/decisions/construction-model.md, confirmed 2026-07-31.
 */

export class PhaseRuleError extends DomainRuleError {
  constructor(message: string) {
    super(message);
    this.name = 'PhaseRuleError';
  }
}

/** Roles that may move a project between phases. Customers and field users may not. */
const PHASE_AUTHORITY = ['admin', 'office', 'superintendent'] as const;

export type PhaseMoveKind = 'advance' | 'skip' | 'reverse';

export interface ProjectPhaseState {
  readonly jobId: JobId;
  readonly currentPhaseKey: ConstructionPhaseKey;
  /**
   * True once the job itself is complete. Handover is reached by finishing the
   * job, not by finishing phase 9 — see CUSTOMER_MILESTONES.
   */
  readonly jobComplete: boolean;
}

export interface ChangePhaseCommand {
  readonly actor: EventActor;
  readonly at: string;
  readonly toPhaseKey: ConstructionPhaseKey;
  readonly reason?: string;
}

export interface PhaseChangedDraft {
  readonly eventType: 'project.phase_changed';
  readonly jobId: JobId;
  readonly payload: {
    readonly fromPhaseKey: ConstructionPhaseKey | null;
    readonly toPhaseKey: ConstructionPhaseKey;
    readonly changedBy: UserId;
    readonly reason: string | null;
  };
  readonly at: string;
  readonly actor: EventActor;
}

/**
 * What the customer is shown for a project.
 *
 * Handover comes only from a completed job. A pool sitting in phase 9 with water
 * in it has not been handed over, and the customer page must not say it has.
 */
export const customerMilestoneFor = (state: ProjectPhaseState): CustomerMilestoneKey =>
  state.jobComplete ? 'handover' : customerMilestoneForPhase(state.currentPhaseKey);

/** Classify a move without deciding whether it is allowed. */
export const classifyPhaseMove = (
  from: ConstructionPhaseKey,
  to: ConstructionPhaseKey,
): PhaseMoveKind => {
  const fromSequence = constructionPhase(from).sequence;
  const toSequence = constructionPhase(to).sequence;
  if (toSequence < fromSequence) return 'reverse';
  return toSequence === fromSequence + 1 ? 'advance' : 'skip';
};

/**
 * Decide a phase change.
 *
 * Skips and reversals are permitted — a real jobsite backs up, and refusing to
 * record it would only push the truth outside the system. They require a reason,
 * so the record explains itself later.
 */
export function decidePhaseChange(
  state: ProjectPhaseState,
  command: ChangePhaseCommand,
): readonly [PhaseChangedDraft] {
  if (command.actor.kind !== 'user') {
    throw new PhaseRuleError('A phase change requires an authenticated human actor.');
  }
  if (!PHASE_AUTHORITY.includes(command.actor.role as (typeof PHASE_AUTHORITY)[number])) {
    throw new PhaseRuleError(`Role ${command.actor.role} may not change a project phase.`);
  }
  if (state.jobComplete) {
    throw new PhaseRuleError('A completed job has no remaining construction phases.');
  }
  if (command.toPhaseKey === state.currentPhaseKey) {
    throw new PhaseRuleError(`Project is already in phase ${command.toPhaseKey}.`);
  }

  const move = classifyPhaseMove(state.currentPhaseKey, command.toPhaseKey);
  const reason = command.reason?.trim();
  if (move !== 'advance' && !reason) {
    throw new PhaseRuleError(
      `Moving from ${state.currentPhaseKey} to ${command.toPhaseKey} is a ${move} and requires a recorded reason.`,
    );
  }

  return [{
    eventType: 'project.phase_changed',
    jobId: state.jobId,
    payload: {
      fromPhaseKey: state.currentPhaseKey,
      toPhaseKey: command.toPhaseKey,
      changedBy: command.actor.userId,
      reason: reason ?? null,
    },
    at: command.at,
    actor: command.actor,
  }];
}

export const evolveProjectPhase = (
  state: ProjectPhaseState,
  draft: PhaseChangedDraft,
): ProjectPhaseState => ({ ...state, currentPhaseKey: draft.payload.toPhaseKey });
