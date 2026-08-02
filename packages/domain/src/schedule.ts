import {
  constructionPhase,
  type ScheduledVisit,
  type VisitConflict,
} from '@apex/contracts';

/**
 * Crew conflict detection — PRD §9.6.
 *
 * Pure. Dates in, conflicts out.
 *
 * It reports only what it can prove from stored facts: the same crew claimed by
 * two jobs on the same days, and work booked into a phase whose guarding Gate
 * has not released. It does not guess at material lead times, weather, travel,
 * or crew capacity — those are Apex's judgment, and a warning the system cannot
 * substantiate teaches the owner to dismiss the ones that matter.
 *
 * §9.6 explicitly does not ask for schedule optimisation, and this does none.
 */

/** A visit still expected to happen. Cancelled and completed work cannot clash. */
const isLive = (visit: ScheduledVisit): boolean =>
  visit.status === 'planned' || visit.status === 'confirmed';

/** Inclusive ranges overlap when neither ends before the other begins. */
const overlaps = (a: ScheduledVisit, b: ScheduledVisit): boolean =>
  a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;

const laterOf = (a: string, b: string) => (a > b ? a : b);
const earlierOf = (a: string, b: string) => (a < b ? a : b);

/** The state of the Gate that guards a phase, as far as a job is concerned. */
export interface PhaseGuard {
  readonly phaseKey: ScheduledVisit['phaseKey'];
  readonly gateTitle: string;
  /** Null when no instance of that Gate has been opened on this job. */
  readonly gateStatus: string | null;
  readonly released: boolean;
}

export interface ConflictInput {
  readonly visits: readonly ScheduledVisit[];
  /** Guards for the job being examined, keyed by the phase each one blocks. */
  readonly guards: readonly PhaseGuard[];
  /** Display names for other jobs, so a conflict can name where the crew is. */
  readonly jobNames: Readonly<Record<string, string | null>>;
}

/**
 * Every conflict across a set of visits.
 *
 * A double-booking is reported once per visit involved, not once per pair: both
 * jobs have a problem, and an owner looking at one job should see it there.
 */
export function detectVisitConflicts(input: ConflictInput): readonly VisitConflict[] {
  const conflicts: VisitConflict[] = [];
  const live = input.visits.filter(isLive);

  // --- the same crew in two places ----------------------------------------
  for (const visit of live) {
    for (const other of live) {
      if (other.visitId === visit.visitId) continue;
      if (other.subcontractorId !== visit.subcontractorId) continue;
      // Two bookings for the same crew on the same job are a plan, not a clash.
      // A crew genuinely cannot be on two jobs at once; it can be on one job
      // twice in a week.
      if (other.jobId === visit.jobId) continue;
      if (!overlaps(visit, other)) continue;

      conflicts.push({
        kind: 'crew-double-booked',
        visitId: visit.visitId,
        otherVisitId: other.visitId,
        subcontractorName: visit.subcontractorName,
        otherJobId: other.jobId,
        otherJobName: input.jobNames[other.jobId] ?? null,
        overlapStartsOn: laterOf(visit.startsOn, other.startsOn),
        overlapEndsOn: earlierOf(visit.endsOn, other.endsOn),
      });
    }
  }

  // --- work booked ahead of its gate --------------------------------------
  const guardByPhase = new Map(input.guards.map((guard) => [guard.phaseKey, guard] as const));
  for (const visit of live) {
    const guard = guardByPhase.get(visit.phaseKey);
    if (guard === undefined || guard.released) continue;
    conflicts.push({
      kind: 'before-gate',
      visitId: visit.visitId,
      phaseKey: visit.phaseKey,
      gateTitle: guard.gateTitle,
      gateStatus: guard.gateStatus,
    });
  }

  return conflicts;
}

/** Plain-language explanation of a conflict, used by cards and the schedule view. */
export const describeConflict = (conflict: VisitConflict): string => {
  if (conflict.kind === 'crew-double-booked') {
    const where = conflict.otherJobName ?? 'another job';
    const days = conflict.overlapStartsOn === conflict.overlapEndsOn
      ? conflict.overlapStartsOn
      : `${conflict.overlapStartsOn} to ${conflict.overlapEndsOn}`;
    return `${conflict.subcontractorName} is booked on ${where} for the same days (${days}). `
      + 'One of the two will not happen, and nobody has been told which.';
  }
  const phase = constructionPhase(conflict.phaseKey);
  const state = conflict.gateStatus === null
    ? 'has not been opened'
    : `is ${conflict.gateStatus.replace(/-/g, ' ')}`;
  return `This books ${phase.title} before the ${conflict.gateTitle} gate has released — it ${state}. `
    + 'The crew would arrive to work that is not authorized yet.';
};
