/**
 * Lubbock amendment checks. Written before the geometry math, per the build
 * order: the checks constrain what geometry is even legal.
 */

import { describe, expect, it } from 'vitest';
import {
  checkFoundationSetback,
  checkSeats,
  checkSteps,
  runGeometryCodeChecks,
} from './codeChecks.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job, Seat, StepSet } from './types.ts';

const job = (over: Partial<Job>): Job => ({ ...STANDARD_MODEL, ...over });

const step = (over: Partial<StepSet>): StepSet => ({
  id: 'S1',
  treadCount: 4,
  treadRunIn: 12,
  treadWidthIn: 72,
  riserHeightsIn: [8, 10, 10, 10, 10],
  floorDepthFt: 3.5,
  isRequiredEntryExit: true,
  ...over,
});

const seat = (over: Partial<Seat>): Seat => ({
  id: 'B1',
  kind: 'bench',
  depthBelowWaterlineIn: 18,
  surfaceDepthIn: 16,
  surfaceWidthIn: 96,
  leadingEdgeLengthFt: 8,
  floorDepthFt: 4.5,
  isRequiredEntryExit: false,
  ...over,
});

describe('307.2.2.2 depth-to-foundation setback (1:1)', () => {
  it('passes when the setback is at least the depth', () => {
    const r = checkFoundationSetback(job({ site: { distanceToFoundationFt: 8, foundationDescription: 'house slab foundation' } }));
    expect(r.check.status).toBe('pass');
    expect(r.maxAllowableDepthFt).toBe(8);
  });

  it('is a hard fail when the pool is deeper than the setback', () => {
    const r = checkFoundationSetback(
      job({ site: { distanceToFoundationFt: 5, foundationDescription: 'house slab foundation' } }),
    );
    expect(r.check.status).toBe('fail');
    // Reports the maximum compliant depth, per the PRD success criteria.
    expect(r.maxAllowableDepthFt).toBe(5);
    expect(r.requiredSetbackFt).toBe(6);
    expect(r.check.message).toContain('5 ft');
  });

  it('names the sealed engineered drawing as the only compliance path', () => {
    const r = checkFoundationSetback(
      job({ site: { distanceToFoundationFt: 4, foundationDescription: 'retaining wall footing' } }),
    );
    expect(r.check.compliancePath).toMatch(/sealed engineered design drawing/i);
  });

  it('governs on the spa when the spa is the deeper body', () => {
    const shallowPool: Job = job({
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 3.5, shallowRun: 10, transitionRun: 14, deepRun: 6 },
      },
      spa: { ...STANDARD_MODEL.spa!, depthFt: 5 },
      site: { distanceToFoundationFt: 4, foundationDescription: 'house slab foundation' },
    });
    const r = checkFoundationSetback(shallowPool);
    expect(r.check.status).toBe('fail');
    expect(r.requiredSetbackFt).toBe(5);
    expect(r.check.actual).toContain('spa');
  });
});

describe('411.2.1 / 411.2.2 steps as amended by Lubbock', () => {
  it('accepts the standard model step set', () => {
    const checks = checkSteps([step({})]);
    expect(checks.every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails an 11 in tread run — base ISPSC would allow less, Lubbock requires 12', () => {
    const checks = checkSteps([step({ treadRunIn: 11 })]);
    const run = checks.find((c) => c.id.includes('411.2.1.run'))!;
    expect(run.status).toBe('fail');
    expect(run.governingLimit).toBe('min 12 in');
  });

  it('fails a tread narrower than 20 in', () => {
    const checks = checkSteps([step({ treadWidthIn: 18 })]);
    expect(checks.find((c) => c.id.includes('411.2.1.width'))!.status).toBe('fail');
  });

  it('fails a riser over 10 in', () => {
    const checks = checkSteps([step({ riserHeightsIn: [8, 10, 11, 10, 10] })]);
    expect(checks.find((c) => c.id.includes('411.2.2'))!.status).toBe('fail');
  });

  it('allows the bottom riser to taper but not the others', () => {
    expect(checkSteps([step({ riserHeightsIn: [0, 10, 10, 10, 10] })]).find((c) => c.id.includes('411.2.2'))!.status).toBe('pass');
    expect(checkSteps([step({ riserHeightsIn: [8, 10, 9, 10, 10] })]).find((c) => c.id.includes('411.2.2'))!.status).toBe('fail');
  });

  it('fails a bottom riser taller than the uniform height', () => {
    const checks = checkSteps([step({ riserHeightsIn: [10, 8, 8, 8, 8] })]);
    expect(checks.find((c) => c.id.includes('411.2.2'))!.status).toBe('fail');
  });

  it('fails when no means of entry and exit is defined', () => {
    const checks = checkSteps([]);
    expect(checks[0]!.status).toBe('fail');
  });
});

describe('411.5.1 / 411.5.2 benches, swimouts, tanning ledges', () => {
  it('accepts the standard model bench', () => {
    expect(checkSeats([seat({})]).every((c) => c.status === 'pass')).toBe(true);
  });

  it('fails a bench more than 20 in below the waterline', () => {
    const checks = checkSeats([seat({ depthBelowWaterlineIn: 22 })]);
    expect(checks.find((c) => c.id.includes('411.5.2.depth'))!.status).toBe('fail');
  });

  it('fails a bench surface under 10 in x 24 in', () => {
    expect(checkSeats([seat({ surfaceDepthIn: 9 })]).find((c) => c.id.includes('surface'))!.status).toBe('fail');
    expect(checkSeats([seat({ surfaceWidthIn: 20 })]).find((c) => c.id.includes('surface'))!.status).toBe('fail');
  });

  it('fails a bench flagged as the required entry and exit', () => {
    const checks = checkSeats([seat({ isRequiredEntryExit: true })]);
    expect(checks.find((c) => c.id.includes('411.5.2.entry'))!.status).toBe('fail');
  });

  it('holds a tanning ledge used for entry/exit to 12 in, not 20 in', () => {
    const ok = checkSeats([seat({ kind: 'tanningLedge', depthBelowWaterlineIn: 12, isRequiredEntryExit: true })]);
    expect(ok.find((c) => c.id.includes('depth'))!.status).toBe('pass');

    const bad = checkSeats([seat({ kind: 'tanningLedge', depthBelowWaterlineIn: 16, isRequiredEntryExit: true })]);
    expect(bad.find((c) => c.id.includes('depth'))!.status).toBe('fail');

    // Same ledge not used as entry/exit falls back to the 20 in rule.
    const notEntry = checkSeats([seat({ kind: 'tanningLedge', depthBelowWaterlineIn: 16, isRequiredEntryExit: false })]);
    expect(notEntry.find((c) => c.id.includes('depth'))!.status).toBe('pass');
  });

  it('holds a swimout to the top tread requirement', () => {
    const ok = checkSeats([seat({ id: 'SW1', kind: 'swimout', surfaceDepthIn: 12, surfaceWidthIn: 20 })]);
    expect(ok.find((c) => c.id.includes('411.5.1.surface'))!.status).toBe('pass');

    const bad = checkSeats([seat({ id: 'SW1', kind: 'swimout', surfaceDepthIn: 11, surfaceWidthIn: 20 })]);
    expect(bad.find((c) => c.id.includes('411.5.1.surface'))!.status).toBe('fail');
  });

  it('flags a swimout used for entry/exit for full stair compliance', () => {
    const checks = checkSeats([seat({ id: 'SW1', kind: 'swimout', isRequiredEntryExit: true })]);
    expect(checks.find((c) => c.id.includes('411.5.1.stair'))!.status).toBe('flag');
  });

  it('requires a leading-edge contrast stripe length on every seat', () => {
    const checks = checkSeats([seat({ leadingEdgeLengthFt: 0 })]);
    expect(checks.find((c) => c.id.includes('stripe'))!.status).toBe('fail');
  });
});

describe('every check runs on every job, never silently', () => {
  it('reports a status and a governing limit on every check for the standard model', () => {
    const checks = runGeometryCodeChecks(STANDARD_MODEL);
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(c.status).toBeDefined();
      expect(c.governingLimit.length).toBeGreaterThan(0);
      expect(c.actual.length).toBeGreaterThan(0);
      expect(c.section).toContain('Lubbock amendment');
    }
  });

  it('the standard model clears every Lubbock amendment check', () => {
    const checks = runGeometryCodeChecks(STANDARD_MODEL);
    const failures = checks.filter((c) => c.status !== 'pass');
    expect(failures.map((f) => f.id)).toEqual([]);
  });
});
