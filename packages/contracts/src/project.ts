import { z } from 'zod';
import { idSchemas } from './ids.js';

/**
 * Apex construction model — PRD §8.2, §8.3, §9.3.
 *
 * Source of authority: `docs/decisions/construction-model.md`, confirmed by Nick
 * Sandoval on 2026-07-31 against Apex's real sequence and contract. This replaces
 * the never-confirmed fifteen-phase baseline that earlier PRD drafts carried;
 * that list must not be built.
 *
 * Nothing here is inferred. Every phase, milestone, and mapping below traces to
 * that decision document or to PRD §8.3.
 */

/** The nine internal construction phases, in build order. */
export const CONSTRUCTION_PHASE_KEYS = [
  'design-permitting',
  'layout-excavation',
  'steel-reinforcement',
  'rough-in',
  'gunite',
  'tile-coping',
  'decking',
  'equipment-hookup',
  'plaster-fill',
] as const;
export const ConstructionPhaseKeySchema = z.enum(CONSTRUCTION_PHASE_KEYS);
export type ConstructionPhaseKey = z.infer<typeof ConstructionPhaseKeySchema>;

/** The six milestones a customer sees. PRD §8.3. */
export const CUSTOMER_MILESTONE_KEYS = [
  'design',
  'excavation',
  'shell',
  'finishes',
  'water',
  'handover',
] as const;
export const CustomerMilestoneKeySchema = z.enum(CUSTOMER_MILESTONE_KEYS);
export type CustomerMilestoneKey = z.infer<typeof CustomerMilestoneKeySchema>;

export interface ConstructionPhase {
  readonly key: ConstructionPhaseKey;
  /** 1-based position in the build order. */
  readonly sequence: number;
  readonly title: string;
  /** The milestone the customer sees while this phase is current. */
  readonly customerMilestone: CustomerMilestoneKey;
}

export const CONSTRUCTION_PHASES: readonly ConstructionPhase[] = [
  { key: 'design-permitting', sequence: 1, title: 'Design, Engineering & Permitting', customerMilestone: 'design' },
  { key: 'layout-excavation', sequence: 2, title: 'Layout & Excavation', customerMilestone: 'excavation' },
  { key: 'steel-reinforcement', sequence: 3, title: 'Steel Reinforcement (Rebar)', customerMilestone: 'shell' },
  { key: 'rough-in', sequence: 4, title: 'Plumbing & Electrical Rough-In', customerMilestone: 'shell' },
  { key: 'gunite', sequence: 5, title: 'Gunite/Shotcrete Concrete Pour', customerMilestone: 'shell' },
  { key: 'tile-coping', sequence: 6, title: 'Waterline Tile & Coping Installation', customerMilestone: 'finishes' },
  { key: 'decking', sequence: 7, title: 'Patio Decking & Hardscaping', customerMilestone: 'finishes' },
  { key: 'equipment-hookup', sequence: 8, title: 'Pool Pad Equipment Hookup', customerMilestone: 'water' },
  { key: 'plaster-fill', sequence: 9, title: 'Interior Plaster Finish & Water Fill', customerMilestone: 'water' },
] as const;

export interface CustomerMilestone {
  readonly key: CustomerMilestoneKey;
  readonly sequence: number;
  readonly title: string;
}

export const CUSTOMER_MILESTONES: readonly CustomerMilestone[] = [
  { key: 'design', sequence: 1, title: 'Design' },
  { key: 'excavation', sequence: 2, title: 'Excavation' },
  { key: 'shell', sequence: 3, title: 'Shell' },
  { key: 'finishes', sequence: 4, title: 'Finishes' },
  { key: 'water', sequence: 5, title: 'Water' },
  /**
   * Handover is not reachable from any phase. No ninth-phase completion makes a
   * pool handed over; the job does. It is derived from job completion, never
   * from `currentPhaseKey`, so the customer is never told the pool is theirs
   * because a checklist advanced.
   */
  { key: 'handover', sequence: 6, title: 'Handover' },
] as const;

const phaseByKey = new Map(CONSTRUCTION_PHASES.map((phase) => [phase.key, phase] as const));

export const constructionPhase = (key: ConstructionPhaseKey): ConstructionPhase => {
  const phase = phaseByKey.get(key);
  if (!phase) throw new Error(`Unknown construction phase: ${key}`);
  return phase;
};

/** The milestone shown to the customer while `key` is the current phase. */
export const customerMilestoneForPhase = (key: ConstructionPhaseKey): CustomerMilestoneKey =>
  constructionPhase(key).customerMilestone;

/** The phase that follows `key`, or null at the end of the build. */
export const nextConstructionPhase = (key: ConstructionPhaseKey): ConstructionPhaseKey | null =>
  CONSTRUCTION_PHASE_KEYS[constructionPhase(key).sequence] ?? null;

/**
 * The §9.3 project record.
 *
 * Keyed by `jobId`, not a new `project_id`. The canonical identity chain is
 * lead → job (PRD §12 key identity rule); minting a parallel project identity
 * would create a second thing to reconcile for no gain. "Project" is the PRD's
 * word for the operational face of a Job.
 *
 * Lifecycle status is deliberately absent: `jobs.status` already carries it, and
 * two status columns on one thing is how a system starts disagreeing with itself.
 */
export const ProjectRecordSchema = z.strictObject({
  jobId: idSchemas.job,
  currentPhaseKey: ConstructionPhaseKeySchema,
  /** Derived from the current phase, or 'handover' once the job completes. */
  customerMilestone: CustomerMilestoneKeySchema,
  /** Owner/superintendent accountable for the job. Null until assigned. */
  superintendentUserId: idSchemas.user.nullable(),
  /** Target completion window, both ends optional; PRD §9.3. */
  targetCompletionStart: z.string().date().nullable(),
  targetCompletionEnd: z.string().date().nullable(),
  /** Free-text known risks and blockers; PRD §9.3. Structured risk is a later step. */
  riskNote: z.string().max(2000).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).superRefine((project, ctx) => {
  const { targetCompletionStart: start, targetCompletionEnd: end } = project;
  if (start !== null && end !== null && start > end) {
    ctx.addIssue({
      code: 'custom',
      path: ['targetCompletionEnd'],
      message: 'Target completion window cannot end before it starts.',
    });
  }
});
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;

export const ProjectPhaseTransitionSchema = z.strictObject({
  jobId: idSchemas.job,
  fromPhaseKey: ConstructionPhaseKeySchema.nullable(),
  toPhaseKey: ConstructionPhaseKeySchema,
  occurredAt: z.string().datetime({ offset: true }),
  actorUserId: idSchemas.user,
  /** Required when the transition moves backwards or skips ahead. */
  reason: z.string().min(1).max(2000).nullable(),
});
export type ProjectPhaseTransition = z.infer<typeof ProjectPhaseTransitionSchema>;
