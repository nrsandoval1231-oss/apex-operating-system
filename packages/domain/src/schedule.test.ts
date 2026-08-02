import { describe, expect, it } from 'vitest';
import { VisitConflictSchema, createCanonicalId, type ScheduledVisit } from '@apex/contracts';
import { describeConflict, detectVisitConflicts, type PhaseGuard } from './schedule.js';

const jobA = createCanonicalId('job');
const jobB = createCanonicalId('job');
const gunite = createCanonicalId('sub');
const plumber = createCanonicalId('sub');

const visit = (overrides: Partial<ScheduledVisit> = {}): ScheduledVisit => ({
  visitId: createCanonicalId('visit'),
  jobId: jobA,
  subcontractorId: gunite,
  subcontractorName: 'Lubbock Gunite',
  trade: 'Gunite',
  phaseKey: 'gunite',
  startsOn: '2026-08-10',
  endsOn: '2026-08-10',
  status: 'planned',
  note: null,
  rescheduleCount: 0,
  ...overrides,
});

const guard = (overrides: Partial<PhaseGuard> = {}): PhaseGuard => ({
  phaseKey: 'gunite',
  gateTitle: 'Pre-gunite hold point',
  gateStatus: 'in-progress',
  released: false,
  ...overrides,
});

const detect = (visits: readonly ScheduledVisit[], guards: readonly PhaseGuard[] = []) =>
  detectVisitConflicts({ visits, guards, jobNames: { [jobA]: 'Whitaker Oasis', [jobB]: 'Mike Johnson' } });

const kinds = (visits: readonly ScheduledVisit[], guards: readonly PhaseGuard[] = []) =>
  detect(visits, guards).map((conflict) => conflict.kind);

describe('the same crew in two places', () => {
  it('catches a crew booked on two jobs on the same day', () => {
    const conflicts = detect([
      visit({ visitId: createCanonicalId('visit'), jobId: jobA }),
      visit({ visitId: createCanonicalId('visit'), jobId: jobB }),
    ]);
    // Reported against both visits: each job has a problem.
    expect(conflicts).toHaveLength(2);
    expect(conflicts.every((c) => c.kind === 'crew-double-booked')).toBe(true);
    expect(VisitConflictSchema.safeParse(conflicts[0]).success).toBe(true);
  });

  it('reports the days both bookings actually claim', () => {
    const [conflict] = detect([
      visit({ jobId: jobA, startsOn: '2026-08-10', endsOn: '2026-08-14' }),
      visit({ jobId: jobB, startsOn: '2026-08-12', endsOn: '2026-08-18' }),
    ]);
    expect(conflict).toMatchObject({ overlapStartsOn: '2026-08-12', overlapEndsOn: '2026-08-14' });
  });

  it('names the other job so the owner knows who to call', () => {
    const [conflict] = detect([visit({ jobId: jobA }), visit({ jobId: jobB })]);
    expect(conflict?.kind === 'crew-double-booked' && conflict.otherJobName).toBe('Mike Johnson');
  });

  it('leaves ranges that merely touch end to end alone', () => {
    expect(kinds([
      visit({ jobId: jobA, startsOn: '2026-08-10', endsOn: '2026-08-11' }),
      visit({ jobId: jobB, startsOn: '2026-08-12', endsOn: '2026-08-13' }),
    ])).toEqual([]);
  });

  it('treats one crew on one job twice as a plan, not a clash', () => {
    expect(kinds([visit({ jobId: jobA }), visit({ jobId: jobA })])).toEqual([]);
  });

  it('does not confuse two different crews', () => {
    expect(kinds([
      visit({ jobId: jobA, subcontractorId: gunite }),
      visit({ jobId: jobB, subcontractorId: plumber }),
    ])).toEqual([]);
  });

  it('ignores cancelled and completed work, which cannot clash', () => {
    for (const status of ['cancelled', 'done'] as const) {
      expect(kinds([visit({ jobId: jobA }), visit({ jobId: jobB, status })])).toEqual([]);
    }
  });
});

describe('work booked ahead of its gate', () => {
  it('flags a visit whose guarding gate has not released', () => {
    const conflicts = detect([visit()], [guard()]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: 'before-gate', gateTitle: 'Pre-gunite hold point' });
  });

  it('says nothing once the gate has released', () => {
    expect(kinds([visit()], [guard({ released: true, gateStatus: 'released' })])).toEqual([]);
  });

  it('reports a gate that has not even been opened', () => {
    const [conflict] = detect([visit()], [guard({ gateStatus: null })]);
    expect(conflict?.kind === 'before-gate' && conflict.gateStatus).toBeNull();
    expect(describeConflict(conflict!)).toMatch(/has not been opened/i);
  });

  it('says nothing about a phase no gate guards', () => {
    expect(kinds([visit({ phaseKey: 'design-permitting' })], [guard()])).toEqual([]);
  });

  it('can report both problems against one visit', () => {
    const both = detect(
      [visit({ jobId: jobA }), visit({ jobId: jobB })],
      [guard()],
    );
    expect(both.filter((c) => c.kind === 'crew-double-booked')).toHaveLength(2);
    expect(both.filter((c) => c.kind === 'before-gate')).toHaveLength(2);
  });
});

describe('what a conflict says', () => {
  it('explains a double-booking in terms of the consequence', () => {
    const [conflict] = detect([visit({ jobId: jobA }), visit({ jobId: jobB })]);
    const text = describeConflict(conflict!);
    expect(text).toContain('Lubbock Gunite');
    expect(text).toContain('Mike Johnson');
    expect(text).toMatch(/one of the two will not happen/i);
  });

  it('explains a gated visit in terms of the crew arriving', () => {
    const [conflict] = detect([visit()], [guard()]);
    expect(describeConflict(conflict!)).toMatch(/not authorized yet/i);
  });
});

describe('what it refuses to guess', () => {
  it('reports nothing for a clean schedule', () => {
    expect(detect([visit()], [guard({ released: true })])).toEqual([]);
  });

  it('says nothing about material lead time, weather, or capacity', () => {
    // Five crews on one job in one day is unusual, and the system has no basis
    // to call it wrong. §9.6 does not ask it to optimise a schedule.
    const sameDay = Array.from({ length: 5 }, () =>
      visit({ subcontractorId: createCanonicalId('sub') }));
    expect(detect(sameDay, [guard({ released: true })])).toEqual([]);
  });
});
