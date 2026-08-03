import { describe, expect, it } from 'vitest';
import { createCanonicalId, type JobInspection } from '@apex/contracts';
import {
  blockingInspections,
  daysBetween,
  describeInspection,
  inspectionPressure,
  lastSafeRequestOn,
  subtractBusinessDays,
} from './inspections.js';

/**
 * Inspection deadlines — PRD §9.7.
 *
 * The value the whole feature turns on is the last day a request can still go
 * in. These tests are mostly about that date being right, and about the system
 * declining to invent one when nothing has been planned.
 */

const inspection = (overrides: Partial<JobInspection> = {}): JobInspection => ({
  inspectionId: createCanonicalId('inspect'),
  jobId: createCanonicalId('job'),
  inspectionKey: 'pool-steel-structural',
  title: 'Pool steel & structural',
  phaseKey: 'steel-reinforcement',
  requestedBy: 'apex',
  requesterTrade: null,
  leadTimeBusinessDays: 2,
  blocksDefinitionKey: 'pre-gunite',
  blocksGateTitle: 'Pre-gunite hold point',
  requestMethod: 'City of Lubbock inspection portal',
  authority: '2021 ISPSC structural',
  status: 'requested',
  requestedOn: null,
  scheduledFor: null,
  resultOn: null,
  resultNote: null,
  corrections: null,
  neededBy: '2026-08-13',
  neededBySource: 'crew-booking',
  lastSafeRequestOn: '2026-08-11',
  failureCount: 0,
  ...overrides,
});

describe('business-day arithmetic', () => {
  it('skips weekends going backwards', () => {
    // 2026-08-10 is a Monday. Two business days back is the previous Thursday,
    // not the Saturday a calendar subtraction would land on.
    expect(subtractBusinessDays('2026-08-10', 2)).toBe('2026-08-06');
  });

  it('lands on a working day even at zero lead time', () => {
    // Requesting "on" a Sunday means requesting the Friday before it; saying
    // Sunday would give a deadline nobody can meet.
    expect(subtractBusinessDays('2026-08-09', 0)).toBe('2026-08-07');
  });

  it('crosses a full weekend when the lead time demands it', () => {
    // Wednesday minus three business days is the Friday before.
    expect(subtractBusinessDays('2026-08-12', 3)).toBe('2026-08-07');
  });

  it('counts calendar days between two dates', () => {
    expect(daysBetween('2026-08-03', '2026-08-13')).toBe(10);
    expect(daysBetween('2026-08-13', '2026-08-03')).toBe(-10);
  });
});

describe('the last safe request date', () => {
  it('is the lead time back from when the work is needed', () => {
    expect(lastSafeRequestOn('2026-08-13', 2)).toBe('2026-08-11');
  });

  it('does not exist when nothing has been planned', () => {
    // An inspection whose work nobody has booked has no deadline. Inventing one
    // would manufacture urgency the system cannot justify, which is how a feed
    // teaches its reader to ignore it.
    expect(lastSafeRequestOn(null, 2)).toBeNull();
  });
});

describe('how much trouble an inspection is in', () => {
  it('is clear once it has passed', () => {
    expect(inspectionPressure(inspection({ status: 'passed' }), '2026-08-20')).toBe('clear');
  });

  it('is clear once it has been waived', () => {
    expect(inspectionPressure(inspection({ status: 'waived' }), '2026-08-20')).toBe('clear');
  });

  it('is ahead while there is still room', () => {
    expect(inspectionPressure(inspection(), '2026-08-03')).toBe('ahead');
  });

  it('becomes due on the last safe day, not a week of nagging before it', () => {
    expect(inspectionPressure(inspection(), '2026-08-11')).toBe('due');
  });

  it('is overdue the day after', () => {
    expect(inspectionPressure(inspection(), '2026-08-12')).toBe('overdue');
  });

  it('treats an untouched inspection the same as a requested one', () => {
    // Null status is "not requested" — a real state, and the one most likely to
    // be the reason a pour slips.
    expect(inspectionPressure(inspection({ status: null }), '2026-08-11')).toBe('due');
  });

  it('is unscheduled, not overdue, when there is no deadline to miss', () => {
    expect(inspectionPressure(
      inspection({ neededBy: null, neededBySource: null, lastSafeRequestOn: null }),
      '2026-12-25',
    )).toBe('unscheduled');
  });

  it('treats a failure as at least due, even with time on the clock', () => {
    // Corrections have to happen and then the inspector has to come back, so a
    // failed inspection with slack is still the likeliest thing to stop the job.
    expect(inspectionPressure(inspection({ status: 'failed' }), '2026-08-03')).toBe('due');
  });

  it('treats a failure with no planned date as overdue rather than ignorable', () => {
    expect(inspectionPressure(
      inspection({ status: 'failed', neededBy: null, lastSafeRequestOn: null }),
      '2026-08-03',
    )).toBe('overdue');
  });
});

describe('what a person is told', () => {
  it('names who books it and what it holds up', () => {
    const text = describeInspection(inspection(), '2026-08-03');
    expect(text).toContain('Apex books this one');
    expect(text).toContain('Pre-gunite hold point');
    expect(text).toContain('2 working days');
  });

  it('names the trade when the sub books it', () => {
    const text = describeInspection(
      inspection({ requestedBy: 'subcontractor', requesterTrade: 'Electrical' }),
      '2026-08-03',
    );
    expect(text).toContain('Electrical books this one');
  });

  it('says the deadline has passed rather than repeating a future date', () => {
    expect(describeInspection(inspection(), '2026-08-20')).toMatch(/last safe day to request it was/i);
  });

  it('says plainly that there is no deadline yet', () => {
    const text = describeInspection(
      inspection({ status: null, neededBy: null, neededBySource: null, lastSafeRequestOn: null }),
      '2026-08-03',
    );
    expect(text).toMatch(/no deadline yet/i);
  });
});

describe('what blocks a gate', () => {
  const steel = inspection();
  const bonding = inspection({ inspectionKey: 'equipotential-bonding', status: 'passed' });
  const deck = inspection({ inspectionKey: 'deck-pre-pour', blocksDefinitionKey: 'deck-tile' });

  it('returns only the outstanding ones for that gate', () => {
    expect(blockingInspections([steel, bonding, deck], 'pre-gunite').map((i) => i.inspectionKey))
      .toEqual(['pool-steel-structural']);
  });

  it('counts an untouched inspection as blocking', () => {
    // The dangerous case: nobody called it in, so there is nothing on record,
    // and a system that only looked at recorded rows would let the pour proceed.
    expect(blockingInspections([inspection({ status: null })], 'pre-gunite')).toHaveLength(1);
  });

  it('lets a waived inspection through', () => {
    expect(blockingInspections([inspection({ status: 'waived' })], 'pre-gunite')).toHaveLength(0);
  });
});
