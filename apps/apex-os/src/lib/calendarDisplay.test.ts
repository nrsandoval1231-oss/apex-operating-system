import { describe, expect, it } from 'vitest';
import type { CalendarEntry } from '@apex/contracts';
import { needsScheduling } from './calendarDisplay';

const entry = (taskType: CalendarEntry['taskType'], status: string, startsOn: string | null = null): CalendarEntry => ({
  taskId: `${taskType}:${status}`,
  taskType,
  title: 'Task',
  visitId: null,
  gateInstanceId: null,
  inspectionKey: null,
  jobId: 'job_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  customerName: 'Customer',
  address: 'Address',
  subcontractorName: null,
  trade: null,
  phaseKey: null,
  startsOn,
  endsOn: startsOn,
  status,
  conflict: false,
  movable: false,
});

describe('calendar scheduling queue', () => {
  it('keeps only unfinished tasks without a date', () => {
    expect(needsScheduling(entry('gate', 'blocked'))).toBe(true);
    expect(needsScheduling(entry('inspection', 'failed'))).toBe(true);
    expect(needsScheduling(entry('visit', 'planned'))).toBe(true);
    expect(needsScheduling(entry('gate', 'released'))).toBe(false);
    expect(needsScheduling(entry('inspection', 'passed'))).toBe(false);
    expect(needsScheduling(entry('inspection', 'waived'))).toBe(false);
    expect(needsScheduling(entry('visit', 'done'))).toBe(false);
    expect(needsScheduling(entry('visit', 'cancelled'))).toBe(false);
    expect(needsScheduling(entry('gate', 'blocked', '2026-08-18'))).toBe(false);
  });
});

