import {
  civilDay,
  type CalendarEvent,
  type WorkspaceCalendarEntry,
} from '@apex/contracts';
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
