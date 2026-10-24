import {
  civilDay,
  type CalendarEvent,
  type WorkspaceCalendarEntry,
} from '@apex/contracts';
import { needsScheduling } from './calendarDisplay';
export const calendarAddDays = (day: string, delta: number) => {
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};
const dayOf = (event: CalendarEvent, end = false) =>
  event.allDay
    ? (end ? event.endsOn : event.startsOn)!
    : civilDay(
        new Date(
          Date.parse((end ? event.endsAt : event.startsAt)!) - (end ? 1 : 0),
        ),
        'America/Chicago',
      );
export const calendarDates = (
  item: WorkspaceCalendarEntry,
): [string | null, string | null] =>
  item.source === 'appointment'
    ? [dayOf(item.event), dayOf(item.event, true)]
    : item.source === 'task'
      ? [item.task.dueDate, item.task.dueDate]
      : [item.entry.startsOn, item.entry.endsOn];

/** Minute-resolution editor value in the browser's local timezone. */
export const calendarLocalInput = (iso: string | null): string =>
  iso
    ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : '';

/**
 * Keep the original instant (including seconds/offset occurrence) when its
 * displayed value is unchanged. Changed local times must identify one instant;
 * the browser's implicit choice during DST overlap/gap is not an edit decision.
 */
export function resolveCalendarLocalInstant(
  value: string,
  original: string | null = null,
): string {
  if (original && value === calendarLocalInput(original)) return original;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Enter a valid local date and time.');
  const parsed = new Date(value);
  if (
    !Number.isFinite(parsed.valueOf()) ||
    calendarLocalInput(parsed.toISOString()) !== value
  )
    throw new Error(
      'This local time does not exist. Choose a time outside the daylight saving transition.',
    );

  // Nearby offsets cover both sides of a timezone transition. Match each
  // candidate back to the actual local civil time rather than trusting Date's
  // automatic preference for the first occurrence of an overlapping hour.
  const civilAsUtc = Date.parse(value + ':00.000Z');
  const offsets = new Set<number>();
  for (let hours = -48; hours <= 48; hours += 6)
    offsets.add(
      new Date(parsed.valueOf() + hours * 3600000).getTimezoneOffset(),
    );
  const candidates = [...offsets]
    .map((offset) => new Date(civilAsUtc + offset * 60000).toISOString())
    .filter((instant) => calendarLocalInput(instant) === value);
  if (candidates.length !== 1)
    throw new Error(
      'This local time occurs twice during daylight saving. Choose a time outside the repeated hour.',
    );
  return candidates[0]!;
}

/** Only unfinished operational records belong in the actionable date queue. */
export const workspaceNeedsScheduling = (
  item: WorkspaceCalendarEntry,
): boolean => item.source === 'operational' && needsScheduling(item.entry);
