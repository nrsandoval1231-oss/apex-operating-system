import { describe, expect, it, vi } from 'vitest';
import {
  calendarAddDays,
  calendarDates,
  calendarLocalInput,
  resolveCalendarLocalInstant,
  workspaceNeedsScheduling,
} from './calendarWorkspace';
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

describe('calendar editor temporal round trips', () => {
  const inChicago = (run: () => void) => {
    vi.stubEnv('TZ', 'America/Chicago');
    try {
      run();
    } finally {
      vi.unstubAllEnvs();
    }
  };
  it('preserves a second repeated-hour instant and its original precision', () =>
    inChicago(() => {
      const secondOccurrence = '2026-11-01T07:30:15.125Z';
      expect(calendarLocalInput(secondOccurrence)).toBe('2026-11-01T01:30');
      expect(
        resolveCalendarLocalInstant('2026-11-01T01:30', secondOccurrence),
      ).toBe(secondOccurrence);
    }));
  it('refuses an ambiguous changed local time instead of choosing an occurrence', () =>
    inChicago(() => {
      expect(() =>
        resolveCalendarLocalInstant(
          '2026-11-01T01:45',
          '2026-11-01T07:30:00.000Z',
        ),
      ).toThrow(/occurs twice/);
      expect(() => resolveCalendarLocalInstant('2026-11-01T01:45')).toThrow(
        /occurs twice/,
      );
    }));
  it('refuses nonexistent transition times and resolves unambiguous changed times', () =>
    inChicago(() => {
      expect(() => resolveCalendarLocalInstant('2026-03-08T02:30')).toThrow(
        /does not exist/,
      );
      expect(resolveCalendarLocalInstant('2026-11-01T03:00')).toBe(
        '2026-11-01T09:00:00.000Z',
      );
    }));
  it('uses the same Chicago start day for saved navigation and coverage across zones', () => {
    expect(
      calendarDates(
        timed(
          '2026-10-25T03:30:00.000Z',
          '2026-10-25T04:30:00.000Z',
          'Asia/Tokyo',
        ),
      ),
    ).toEqual(['2026-10-24', '2026-10-24']);
  });
});

describe('workspace actionable scheduling queue', () => {
  it('reuses operational status rules and excludes released, passed and waived undated work', () => {
    const operational = (
      taskType: 'gate' | 'inspection' | 'visit',
      status: string,
      startsOn: string | null = null,
    ) =>
      ({
        source: 'operational',
        id: `${taskType}:${status}`,
        entry: { taskType, status, startsOn, endsOn: startsOn },
      }) as WorkspaceCalendarEntry;
    const records = [
      operational('gate', 'released'),
      operational('inspection', 'passed'),
      operational('inspection', 'waived'),
      operational('visit', 'done'),
      operational('visit', 'cancelled'),
      operational('gate', 'blocked'),
      operational('inspection', 'failed'),
      operational('gate', 'blocked', '2026-10-24'),
    ];
    expect(records.filter(workspaceNeedsScheduling).map((i) => i.id)).toEqual([
      'gate:blocked',
      'inspection:failed',
    ]);
  });
});
