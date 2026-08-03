import type { InspectionStatus, JobInspection } from '@apex/contracts';

/**
 * Inspection deadlines — PRD §9.7.
 *
 * Pure. Dates in, dates out. No database, no clock: `today` is always an
 * argument, so the same state produces the same answer on every run and every
 * rule here is testable without fixtures.
 *
 * The whole feature turns on one derived value: the last day an inspection can
 * still be requested and arrive before the work needs it. Everything else —
 * the urgent card, the blocked Gate — reads off that.
 */

/** ISO day arithmetic done on UTC, because a day here is a calendar day. */
const asUtc = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
const asDay = (date: Date): string => date.toISOString().slice(0, 10);

/** Saturday and Sunday. City inspectors do not work them. */
const isWeekend = (date: Date): boolean => date.getUTCDay() === 0 || date.getUTCDay() === 6;

/**
 * Move `days` business days backwards from `from`.
 *
 * NO HOLIDAY CALENDAR. Weekends only. A city holiday will make a deadline one
 * day optimistic, which is the wrong direction — but the alternative is
 * maintaining a Lubbock holiday table that nobody has been asked for, and the
 * lead times themselves are already rounded up to absorb roughly this much.
 * Worth revisiting the day someone misses an inspection over Thanksgiving.
 */
export function subtractBusinessDays(from: string, days: number): string {
  const date = asUtc(from);
  let remaining = Math.max(0, days);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() - 1);
    if (!isWeekend(date)) remaining -= 1;
  }
  // The result itself must be a working day: requesting on a Saturday is
  // requesting on the following Monday, and the deadline should say so.
  while (isWeekend(date)) date.setUTCDate(date.getUTCDate() - 1);
  return asDay(date);
}

/** Whole days between two ISO days. Negative when `to` is in the past. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((asUtc(to).getTime() - asUtc(from).getTime()) / 86_400_000);

/**
 * The last day an inspection can still be requested.
 *
 * Null when nothing has been planned. An inspection with no date behind it has
 * no deadline, and inventing one would manufacture urgency the system cannot
 * justify — which is how a feed teaches its reader to ignore it.
 */
export const lastSafeRequestOn = (
  neededBy: string | null,
  leadTimeBusinessDays: number,
): string | null =>
  neededBy === null ? null : subtractBusinessDays(neededBy, leadTimeBusinessDays);

/** An inspection still in the way. Passed and waived are out of the way. */
export const isOutstanding = (status: InspectionStatus | null): boolean =>
  status === null || status === 'requested' || status === 'scheduled' || status === 'failed';

/** Nothing has been recorded and the clock is running. */
export const isUnrequested = (status: InspectionStatus | null): boolean => status === null;

export type InspectionPressure =
  /** Past the last safe day, or failed with work still to come. */
  | 'overdue'
  /** Inside the lead time — request it now or it will not arrive in time. */
  | 'due'
  /** Outstanding, but there is still room. */
  | 'ahead'
  /** Outstanding with nothing planned, so no deadline exists to be late for. */
  | 'unscheduled'
  /** Passed or waived. */
  | 'clear';

/**
 * How much trouble one inspection is in, on a given day.
 *
 * A failure is always at least `due`: corrections have to happen and then the
 * inspector has to come back, so a failed inspection with time on the clock is
 * still the thing most likely to stop the job.
 */
export function inspectionPressure(
  inspection: Pick<JobInspection, 'status' | 'lastSafeRequestOn' | 'neededBy'>,
  today: string,
): InspectionPressure {
  if (!isOutstanding(inspection.status)) return 'clear';
  if (inspection.lastSafeRequestOn === null) {
    return inspection.status === 'failed' ? 'overdue' : 'unscheduled';
  }
  if (today > inspection.lastSafeRequestOn) return 'overdue';
  if (inspection.status === 'failed') return 'due';
  // "Due" starts the day the request has to go in, not a week of nagging before it.
  return today === inspection.lastSafeRequestOn ? 'due' : 'ahead';
}

/**
 * Plain-language reason, for a card or a screen.
 *
 * Every sentence names the consequence, because a card that does not state one
 * is not worth the owner's attention (build-plan Step 4, rule 1).
 */
export function describeInspection(inspection: JobInspection, today: string): string {
  const who = inspection.requestedBy === 'apex'
    ? 'Apex books this one'
    : inspection.requestedBy === 'customer'
      ? 'The customer books this one'
      : `${inspection.requesterTrade ?? 'The sub'} books this one`;

  if (inspection.status === 'failed') {
    return `${inspection.title} failed and has to be corrected and re-inspected before `
      + `${inspection.blocksGateTitle} can release. ${who}, and the re-inspection takes `
      + `${inspection.leadTimeBusinessDays} working days on top of the corrections.`;
  }

  if (inspection.lastSafeRequestOn === null) {
    return `${inspection.title} has not been requested and nothing is booked into the work it `
      + `gates, so there is no deadline yet. ${who}. It blocks ${inspection.blocksGateTitle}.`;
  }

  const slack = daysBetween(today, inspection.lastSafeRequestOn);
  const when = slack < 0
    ? `The last safe day to request it was ${inspection.lastSafeRequestOn}`
    : slack === 0
      ? 'Today is the last day it can be requested'
      : `It has to be requested by ${inspection.lastSafeRequestOn}`;

  return `${when} to arrive before ${inspection.neededBy}. ${who}, and the city takes `
    + `${inspection.leadTimeBusinessDays} working days. Until it passes, `
    + `${inspection.blocksGateTitle} cannot release.`;
}

/**
 * Which inspections stand between a Gate and its release.
 *
 * Used both to raise a card and to refuse the release itself. "Block dependent
 * work when a required inspection has not passed" (§9.7) has to mean the
 * release actually fails, not that a warning was displayed and ignored.
 */
export const blockingInspections = (
  inspections: readonly JobInspection[],
  definitionKey: string,
): readonly JobInspection[] =>
  inspections.filter(
    (inspection) => inspection.blocksDefinitionKey === definitionKey && isOutstanding(inspection.status),
  );
