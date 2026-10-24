import { describe, expect, it } from 'vitest';
import { calendarAddDays, calendarDates } from './calendarWorkspace';
import type { WorkspaceCalendarEntry } from '@apex/contracts';
const timed = (startsAt: string, endsAt: string, timezone: string) =>
  ({
    source: 'appointment',
    event: { allDay: false, startsAt, endsAt, timezone },
  }) as WorkspaceCalendarEntry;
describe('workspace calendar civil coverage', () => {
  it('preserves inclusive all-day spans through leap and year boundaries', () => {
    expect(calendarAddDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(calendarAddDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(calendarAddDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(
      calendarDates({
        source: 'appointment',
        event: { allDay: true, startsOn: '2028-02-29', endsOn: '2028-03-01' },
      } as WorkspaceCalendarEntry),
    ).toEqual(['2028-02-29', '2028-03-01']);
  });
  it('uses business civil days for timed events and excludes a midnight end', () => {
    expect(
      calendarDates(
        timed(
          '2026-10-23T23:00:00.000Z',
          '2026-10-24T05:00:00.000Z',
          'Asia/Tokyo',
        ),
      ),
    ).toEqual(['2026-10-23', '2026-10-23']);
    expect(
      calendarDates(
        timed(
          '2026-11-01T06:30:00.000Z',
          '2026-11-01T08:30:00.000Z',
          'America/Chicago',
        ),
      ),
    ).toEqual(['2026-11-01', '2026-11-01']);
    expect(
      calendarDates(
        timed('2026-12-31T23:30:00.000Z', '2027-01-01T06:00:00.000Z', 'UTC'),
      ),
    ).toEqual(['2026-12-31', '2026-12-31']);
  });
});
