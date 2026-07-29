/**
 * Structure takeoff.
 *
 * The safety rule is the first thing tested: no detail, or a job outside the
 * detail's envelope, produces NO quantities. The arithmetic is only reachable
 * once a detail covers the job.
 */

import { describe, expect, it } from 'vitest';
import { computeGeometry } from './geometry.ts';
import { computeStructure, optimizeCuts, buildBarSchedule } from './structure.ts';
import {
  APEX_STANDARD_DETAIL,
  EXAMPLE_DETAIL,
  matchEnvelope,
  selectDetail,
  STORED_DETAILS,
  type StandardDetail,
} from './standardDetail.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import { runTakeoff } from './index.ts';
import type { Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const geom = computeGeometry(STANDARD_MODEL);
const run = (details: readonly StandardDetail[], job: Job = STANDARD_MODEL) =>
  computeStructure(job, computeGeometry(job).segments, details);

const detail = (over: Partial<StandardDetail>): StandardDetail => ({ ...EXAMPLE_DETAIL, ...over });

describe('no detail, no numbers', () => {
  it('the store now holds the Apex standard detail', () => {
    expect(STORED_DETAILS).toHaveLength(1);
    expect(STORED_DETAILS[0]!.id).toBe('APEX-STD-01');
  });

  it('produces no structural quantities when nothing is stored', () => {
    const r = run([]);
    expect(r.outcome).toBe('no-detail');
    expect(r).not.toHaveProperty('quantities');
  });

  it('the default takeoff run now produces quantities from the stored detail', () => {
    const r = runTakeoff(STANDARD_MODEL);
    expect(r.structure.outcome).toBe('quantities');
    if (r.structure.outcome === 'quantities') {
      expect(r.structure.quantities.detail.id).toBe('APEX-STD-01');
    }
  });

  it('says what is missing, in the terms the detail is entered in', () => {
    const r = run([]);
    expect(r.outcome === 'no-detail' && r.message).toMatch(/envelope/i);
    expect(r.outcome === 'no-detail' && r.message).toMatch(/bond beam/i);
  });
});

describe('envelope is checked on every dimension and reported either way', () => {
  it('reports every dimension, pass or fail — never just the failing one', () => {
    const m = matchEnvelope(EXAMPLE_DETAIL, STANDARD_MODEL);
    expect(m.findings.map((f) => f.dimension)).toEqual(['Depth', 'Plan length', 'Plan width']);
    for (const f of m.findings) {
      expect(f.limit.length).toBeGreaterThan(0);
      expect(f.actual.length).toBeGreaterThan(0);
    }
  });

  it('accepts the standard model against a detail built for 3-7 ft', () => {
    expect(matchEnvelope(EXAMPLE_DETAIL, STANDARD_MODEL).status).toBe('in-envelope');
  });

  it('refuses a job deeper than the detail covers, and produces nothing', () => {
    const deep: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 8 },
      },
      site: { distanceToFoundationFt: 10, foundationDescription: 'house slab foundation' },
    };
    const r = run([EXAMPLE_DETAIL], deep);
    expect(r.outcome).toBe('out-of-envelope');
    expect(r).not.toHaveProperty('quantities');
    if (r.outcome === 'out-of-envelope') {
      expect(r.attempts[0]!.findings.find((f) => f.dimension === 'Depth')!.ok).toBe(false);
      // The other dimensions still report.
      expect(r.attempts[0]!.findings.find((f) => f.dimension === 'Plan width')!.ok).toBe(true);
    }
  });

  it('refuses a job longer than the detail covers', () => {
    const long: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        lengthFt: 45,
        profile: { ...STANDARD_MODEL.pool.profile, shallowRun: 25 },
      },
    };
    expect(run([detail({ envelope: { ...EXAMPLE_DETAIL.envelope, maxLengthFt: 40 } })], long).outcome).toBe(
      'out-of-envelope',
    );
  });

  it('the spa governs the envelope when it is the deeper body', () => {
    const deepSpa: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 4, transitionRun: 14 },
      },
      spa: { ...STANDARD_MODEL.spa!, depthFt: 9 },
      site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
    };
    expect(run([EXAMPLE_DETAIL], deepSpa).outcome).toBe('out-of-envelope');
  });

  it('the out-of-envelope message is a judgment gate, not a code requirement', () => {
    const deep: Job = {
      ...STANDARD_MODEL,
      pool: { ...STANDARD_MODEL.pool, profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 9 } },
      site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
    };
    const r = run([EXAMPLE_DETAIL], deep);
    expect(r.outcome === 'out-of-envelope' && r.message).toMatch(/no stamp is required/i);
    expect(r.outcome === 'out-of-envelope' && r.message).toMatch(/does not extrapolate/i);
  });

  it('selects by envelope match rather than asking, preferring the tighter depth band', () => {
    const wide = detail({ id: 'WIDE', envelope: { ...EXAMPLE_DETAIL.envelope, minDepthFt: 3, maxDepthFt: 10 } });
    const tight = detail({ id: 'TIGHT', envelope: { ...EXAMPLE_DETAIL.envelope, minDepthFt: 5, maxDepthFt: 7 } });
    const s = selectDetail([wide, tight], STANDARD_MODEL);
    expect(s.outcome).toBe('selected');
    if (s.outcome === 'selected') expect(s.match.detail.id).toBe('TIGHT');
  });

  it('reports every stored detail when none of them cover the job', () => {
    const a = detail({ id: 'A', envelope: { ...EXAMPLE_DETAIL.envelope, maxDepthFt: 4 } });
    const b = detail({ id: 'B', envelope: { ...EXAMPLE_DETAIL.envelope, maxWidthFt: 10 } });
    const r = run([a, b]);
    expect(r.outcome).toBe('out-of-envelope');
    if (r.outcome === 'out-of-envelope') expect(r.attempts).toHaveLength(2);
  });

  it('carries the soil condition forward as a human confirmation, not a machine check', () => {
    const m = matchEnvelope(EXAMPLE_DETAIL, STANDARD_MODEL);
    expect(m.confirmations.join(' ')).toMatch(/confirm the subsurface/i);
  });
});

describe('quantities, once a detail covers the job', () => {
  const r = run([EXAMPLE_DETAIL]);
  const q = r.outcome === 'quantities' ? r.quantities : null;

  it('produces quantities', () => expect(q).not.toBeNull());

  // Pool developed area = 15 x 30.2215 + 2 x 137.5 + 15 x 3.5 + 15 x 6 = 870.82 sf.
  it('develops the attached spa floor and three exterior walls from the same detail', () => {
    // Spa floor 6 x 6 + three exterior walls (6 + 6 + 6) x 3.5 = 99 sf.
    close(q!.attachedSpaDevelopedArea!.value, 99, 0.01);
    close(q!.developedArea.value, 969.822, 0.01);
  });

  it('shell gunite net includes the 99 sf attached spa shell at 6 in', () => {
    close(q!.shellVolume.value, 484.911, 0.01);
  });

  // Pool cove 90 ft + spa floor-to-wall cove 24 ft.
  it('cove fillet includes the attached spa perimeter', () => close(q!.coveVolume.value, 14.25));

  // Pool perimeter 90 ft + three exterior spa edges 18 ft; shared dam edge is already in pool perimeter.
  it('bond beam includes the three exterior attached-spa edges without double-counting the shared edge', () => {
    close(q!.bondBeamVolume.value, 54);
  });

  // 0.5 x 1.5 x 6 = 4.5 cf
  it('spa dam wall = 4.5 cf', () => close(q!.damWallVolume!.value, 4.5));

  it('rebound is a separate line, never folded into net', () => {
    close(q!.gunite.net.value, q!.shellVolume.value + 14.25 + 54 + 4.5, 0.01);
    close(q!.gunite.waste.value, q!.gunite.net.value * 0.15, 0.01);
    close(q!.gunite.ordered.value, q!.gunite.net.value * 1.15, 0.01);
    expect(q!.gunite.waste.id).not.toBe(q!.gunite.net.id);
  });

  it('gunite order converts to cubic yards', () => {
    close(q!.guniteCy.value, q!.gunite.ordered.value / 27, 0.001);
  });

  it('bond beam steel = 4 continuous bars x 108 ft effective perimeter = 432 lf', () => {
    close(q!.bondBeamBarLf.value, 432);
  });

  it('every structural line names the detail it came from', () => {
    expect(q!.shellVolume.source).toContain(EXAMPLE_DETAIL.id);
    expect(q!.barLinearFeet.source).toContain(EXAMPLE_DETAIL.versionDate);
  });

  it('reports ties against a stated intersection count and tie fraction', () => {
    expect(q!.tieCount.value).toBeGreaterThan(0);
    expect(q!.tieCount.inputs.map((i) => i.symbol)).toContain('f_tie');
  });

  it('halving the tie fraction halves the ties', () => {
    const half = run([detail({ tieFraction: 0.5 })]);
    const full = q!.tieCount.value;
    if (half.outcome === 'quantities') {
      expect(half.quantities.tieCount.value).toBeLessThanOrEqual(Math.ceil(full / 2) + 1);
    }
  });

  it('says explicitly that no pier schedule means no pier concrete', () => {
    expect(q!.pierVolume).toBeUndefined();
    expect(q!.notes.join(' ')).toMatch(/no pier schedule/i);
  });

  it('counts pier concrete when the detail carries a schedule', () => {
    const withPiers = run([
      detail({ piers: [{ label: 'Deep end', count: 4, diameterIn: 12, depthFt: 6 }] }),
    ]);
    if (withPiers.outcome !== 'quantities') throw new Error('expected quantities');
    // pi/4 x 1^2 x 6 x 4 = 18.85 cf
    close(withPiers.quantities.pierVolume!.value, 18.8496, 0.001);
  });

  it('states that the tool designed none of it', () => {
    expect(q!.notes.join(' ')).toMatch(/designed by the tool/i);
  });
});

describe('bar schedule and stock-length cut optimization', () => {
  it('adds traceable floor and exterior-wall reinforcement families for an attached spa', () => {
    const withSpa = buildBarSchedule(STANDARD_MODEL, geom.segments, EXAMPLE_DETAIL);
    const poolOnlyJob: Job = { ...STANDARD_MODEL, spa: undefined };
    const poolOnly = buildBarSchedule(poolOnlyJob, computeGeometry(poolOnlyJob).segments, EXAMPLE_DETAIL);
    expect(withSpa.some((row) => row.family.startsWith('Attached spa — floor'))).toBe(true);
    expect(withSpa.some((row) => row.family.startsWith('Attached spa — exterior walls'))).toBe(true);
    const lf = (rows: ReturnType<typeof buildBarSchedule>) => rows.reduce((sum, row) => sum + row.count * row.lengthFt, 0);
    expect(lf(withSpa)).toBeGreaterThan(lf(poolOnly));
  });

  it('a tighter spacing puts more steel in the shell', () => {
    const at12 = buildBarSchedule(STANDARD_MODEL, geom.segments, EXAMPLE_DETAIL);
    const at6 = buildBarSchedule(STANDARD_MODEL, geom.segments, detail({ barSpacingIn: 6 }));
    const lf = (rs: ReturnType<typeof buildBarSchedule>) =>
      rs.reduce((a, r) => a + r.count * r.lengthFt, 0);
    expect(lf(at6)).toBeGreaterThan(lf(at12) * 1.5);
  });

  it('every bar family carries a count and a length, so the cut plan has something to pack', () => {
    for (const r of buildBarSchedule(STANDARD_MODEL, geom.segments, EXAMPLE_DETAIL)) {
      expect(r.count).toBeGreaterThan(0);
      expect(r.lengthFt).toBeGreaterThan(0);
      expect(r.family.length).toBeGreaterThan(0);
    }
  });

  it('packs two 10 ft bars into one 20 ft stock length with no drop', () => {
    const plan = optimizeCuts([{ family: 'test', count: 2, lengthFt: 10 }], 20);
    expect(plan.stockBars).toBe(1);
    close(plan.dropLf, 0);
    expect(plan.splices).toBe(0);
  });

  it('does not pretend two 11 ft bars fit in one 20 ft stock length', () => {
    const plan = optimizeCuts([{ family: 'test', count: 2, lengthFt: 11 }], 20);
    expect(plan.stockBars).toBe(2);
    close(plan.dropLf, 18);
  });

  it('counts a splice when a bar runs longer than stock', () => {
    const plan = optimizeCuts([{ family: 'test', count: 1, lengthFt: 31 }], 20);
    expect(plan.splices).toBe(1);
    expect(plan.stockBars).toBe(2);
  });

  it('drop is reported as a quantity, not hidden in a waste factor', () => {
    const r = run([EXAMPLE_DETAIL]);
    if (r.outcome !== 'quantities') throw new Error('expected quantities');
    const q = r.quantities;
    expect(q.cutPlan.dropLf).toBeGreaterThan(0);
    close(q.cutPlan.stockLf, q.cutPlan.stockBars * 20, 0.001);
    close(q.cutPlan.dropLf, q.cutPlan.stockLf - q.cutPlan.requiredLf, 0.001);
    expect(q.stockBars.notes!.join(' ')).toMatch(/drop/i);
  });

  it('stock bars ordered always cover the required length', () => {
    const r = run([EXAMPLE_DETAIL]);
    if (r.outcome !== 'quantities') throw new Error('expected quantities');
    expect(r.quantities.cutPlan.stockLf).toBeGreaterThanOrEqual(r.quantities.cutPlan.requiredLf);
  });
});

describe('show your work', () => {
  it('every structural output carries a formula, named inputs with units, and a unit', () => {
    const r = run([EXAMPLE_DETAIL]);
    if (r.outcome !== 'quantities') throw new Error('expected quantities');
    const q = r.quantities;
    const outputs = [
      q.developedArea,
      q.shellVolume,
      q.coveVolume,
      q.bondBeamVolume,
      q.damWallVolume!,
      q.gunite.net,
      q.gunite.waste,
      q.gunite.ordered,
      q.guniteCy,
      q.barLinearFeet,
      q.bondBeamBarLf,
      q.barWeight,
      q.stockBars,
      q.tieCount,
    ];
    for (const c of outputs) {
      expect(c.formula.length, c.id).toBeGreaterThan(0);
      expect(c.unit.length, c.id).toBeGreaterThan(0);
      expect(c.inputs.length, c.id).toBeGreaterThan(0);
      for (const i of c.inputs) expect(i.unit.length, `${c.id}:${i.symbol}`).toBeGreaterThan(0);
    }
  });
});


describe('the Apex standard detail as supplied', () => {
  const r = run([APEX_STANDARD_DETAIL]);
  const q = r.outcome === 'quantities' ? r.quantities : null;

  it('carries what the builder actually stated', () => {
    expect(APEX_STANDARD_DETAIL.shellThicknessIn).toBe(6);
    expect(APEX_STANDARD_DETAIL.barSize).toBe('#3');
    expect(APEX_STANDARD_DETAIL.bondBeamDepthIn).toBe(12);
    expect(APEX_STANDARD_DETAIL.suppliedFields!.join(' ')).toMatch(/Shell thickness 6 in/);
  });

  it('keeps the assumed fields separate from the supplied ones', () => {
    expect(APEX_STANDARD_DETAIL.assumedFields!.length).toBeGreaterThan(5);
    const notes = q!.notes.join(' ');
    expect(notes).toMatch(/supplied by the builder/i);
    expect(notes).toMatch(/filled in on instruction and open to redline/i);
  });

  it('has a confirmed envelope, so the refusal means something', () => {
    expect(APEX_STANDARD_DETAIL.envelopeConfirmed).toBe(true);
    expect(q!.notes.join(' ')).not.toMatch(/ENVELOPE NOT CONFIRMED/);
  });

  it('still warns on a detail whose envelope was never confirmed', () => {
    const unconfirmed = run([{ ...APEX_STANDARD_DETAIL, envelopeConfirmed: false }]);
    if (unconfirmed.outcome !== 'quantities') throw new Error('expected quantities');
    expect(unconfirmed.quantities.notes.join(' ')).toMatch(/ENVELOPE NOT CONFIRMED/);
    expect(unconfirmed.quantities.notes.join(' ')).toMatch(/only as good as a range nobody has checked/i);
  });

  it('flags that a 6 in shell sits at the 3 in cover minimum', () => {
    expect(q!.notes.join(' ')).toMatch(/right at the 3 in minimum cover/i);
  });

  it('#3 shell steel weighs a lot less than #4 would', () => {
    const asFour = run([{ ...APEX_STANDARD_DETAIL, barSize: '#4' }]);
    if (asFour.outcome !== 'quantities') throw new Error('expected quantities');
    expect(q!.barWeight.value).toBeLessThan(asFour.quantities.barWeight.value * 0.7);
  });

  it('weighs the #4 bond beam on its own unit weight, not the shell bar', () => {
    expect(APEX_STANDARD_DETAIL.bondBeamBarSize).toBe('#4');
    const shellLf = q!.barSchedule.reduce((sum, row) => sum + row.count * row.lengthFt, 0);
    close(q!.barWeight.value, shellLf * 0.376 + q!.bondBeamBarLf.value * 0.668, 0.5);
    expect(q!.barWeight.notes!.join(' ')).toMatch(/each is weighed on its own unit weight/i);
    // Treating every bar as #3 would understate the #4 bond beam.
    expect(q!.barWeight.value).toBeGreaterThan((shellLf + q!.bondBeamBarLf.value) * 0.376);
  });

  it('still refuses a job outside the assumed envelope', () => {
    const tooDeep: Job = {
      ...STANDARD_MODEL,
      pool: { ...STANDARD_MODEL.pool, profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 9 } },
      site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
    };
    expect(run([APEX_STANDARD_DETAIL], tooDeep).outcome).toBe('out-of-envelope');
  });
});
