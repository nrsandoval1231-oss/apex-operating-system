/**
 * Hydraulics.
 *
 * Build order: safety rules as tests first, then the convergence loop. The
 * safety block below is written against the PRD's project-specific constraints
 * and is what the rest of the module has to satisfy.
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCKED_BRANCH_FPS,
  CODE_MAX_FPS,
  computeDesignFlow,
  computeHydraulics,
  findOperatingPoint,
  HydraulicsInputError,
  MIN_FLOW_GPM,
  ENERGY_SUCTION_FPS,
} from './hydraulics.ts';
import { frictionLossPer100Ft, smallestSizeForVelocity, velocityFps, SCH40_ID, HAYWARD_MAX_SYSTEM_FLOW_GPM } from './pipe.ts';
import { EXAMPLE_CURVE, headAtFlow, PUMP_CATALOG, HAYWARD_VS_PUMPS, findPumpModel } from './pumpCatalog.ts';
import { computeGeometry } from './geometry.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { HydraulicsParams, Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const VOLUME = computeGeometry(STANDARD_MODEL).totalVolumeGal.value; // 15,787.6 gal

const withHydraulics = (over: Partial<HydraulicsParams>): Job => ({
  ...STANDARD_MODEL,
  hydraulics: { ...STANDARD_MODEL.hydraulics!, ...over },
});

const run = (job: Job = STANDARD_MODEL) =>
  computeHydraulics(job, computeGeometry(job).totalVolumeGal.value)!;

/** The 800-series pump: real model, but no performance curve published with it. */
const NO_CURVE = withHydraulics({ pumpModel: findPumpModel('VSP32815') });

// --- safety rules ----------------------------------------------------------

describe('SAFETY: the tool never emits a single-suction-outlet configuration', () => {
  it('refuses one outlet outright, before computing anything', () => {
    expect(() =>
      run(withHydraulics({ mainDrains: { count: 1, separationFt: 0, onDifferentSurfaces: false } })),
    ).toThrow(HydraulicsInputError);
  });

  it('names the standard when it refuses', () => {
    expect(() =>
      run(withHydraulics({ mainDrains: { count: 1, separationFt: 0, onDifferentSurfaces: false } })),
    ).toThrow(/ANSI\/PHTA\/ICC-7/);
  });

  it('fails outlets closer than 3 ft on the same surface', () => {
    const r = run(
      withHydraulics({ mainDrains: { count: 2, separationFt: 2, onDifferentSurfaces: false } }),
    );
    expect(r.outletChecks.find((c) => c.standard.includes('separation'))!.status).toBe('fail');
  });

  it('accepts outlets on two different surfaces regardless of separation', () => {
    const r = run(
      withHydraulics({ mainDrains: { count: 2, separationFt: 0, onDifferentSurfaces: true } }),
    );
    expect(r.outletChecks.find((c) => c.standard.includes('separation'))!.status).toBe('pass');
  });
});

describe('SAFETY: branch suction is sized on the single-blocked condition', () => {
  const r = run();
  const branches = r.runs.filter((x) => x.run.role === 'suction-branch');

  it('sizes every branch for the whole system flow, not half of it', () => {
    for (const b of branches) {
      close(b.governingFlowGpm, r.systemFlowGpm, 0.001);
      expect(b.governingCondition).toMatch(/blocked/i);
    }
  });

  it('holds the blocked branch to 6 fps — stricter than the code and the energy standard', () => {
    for (const b of branches) {
      expect(b.velocity.value).toBeLessThanOrEqual(BLOCKED_BRANCH_FPS + 1e-9);
      const check = b.checks.find((c) => c.standard.includes('ICC-7'))!;
      expect(check.limitFps).toBe(BLOCKED_BRANCH_FPS);
      expect(check.status).toBe('pass');
    }
  });

  it('reports the normal both-open velocity too, which is about half', () => {
    const b = branches[0]!;
    const check = b.checks.find((c) => c.standard.includes('ICC-7'))!;
    expect(check.note).toMatch(/both outlets open/i);
    const normal = velocityFps(b.normalFlowGpm, b.idIn);
    expect(normal).toBeLessThan(b.velocity.value * 0.6);
  });

  it('a branch forced too small fails the blocked check rather than passing quietly', () => {
    // At the standard model's 36 gpm even 1.5 in clears 6 fps in the blocked
    // case, so this needs a flow where the undersize actually bites.
    const r2 = run(
      withHydraulics({
        turnoverHours: 3,
        runs: STANDARD_MODEL.hydraulics!.runs.map((x) =>
          x.role === 'suction-branch' ? { ...x, size: '1.5' as const } : x,
        ),
      }),
    );
    const b = r2.runs.find((x) => x.run.role === 'suction-branch')!;
    expect(b.checks.find((c) => c.standard.includes('ICC-7'))!.status).toBe('fail');
  });
});

describe('SAFETY: three velocity thresholds, each labeled with its own standard', () => {
  const r = run();

  it('reports the code limit, the energy standard and the design guidance on every run', () => {
    for (const x of r.runs) {
      const standards = x.checks.map((c) => c.standard).join(' | ');
      expect(standards, x.run.id).toMatch(/ISPSC 311\.3/);
      expect(standards, x.run.id).toMatch(/ICC-15/);
      expect(standards, x.run.id).toMatch(/GENESIS/);
    }
  });

  it('8 fps is a hard fail and 6 fps is only a flag', () => {
    // 1.5 in carrying the whole ~88 gpm flow of a 3 h turnover: 33.9 fps.
    const forced = run(
      withHydraulics({
        turnoverHours: 3,
        runs: STANDARD_MODEL.hydraulics!.runs.map((x) =>
          x.role === 'return-branch' ? { ...x, size: '1.5' as const, flowBasis: 'full-system' as const } : x,
        ),
      }),
    );
    const rb = forced.runs.find((x) => x.run.role === 'return-branch')!;
    expect(rb.velocity.value).toBeGreaterThan(CODE_MAX_FPS);
    expect(rb.checks.find((c) => c.standard.includes('ISPSC'))!.status).toBe('fail');
    expect(rb.checks.find((c) => c.standard.includes('ICC-15'))!.status).toBe('flag');
  });

  it('labels the energy standard as filtration piping only, so it is not read as code', () => {
    const suction = r.runs.find((x) => x.run.role === 'suction-trunk')!;
    expect(suction.checks.find((c) => c.standard.includes('ICC-15'))!.note).toMatch(
      /filtration piping only/i,
    );
  });
});

describe('SAFETY: SOFA cover rating is reported, not selected', () => {
  const r = run();

  it('requires each cover to be certified for the whole system flow', () => {
    close(r.sofaRequirement.value, r.systemFlowGpm, 0.001);
    expect(r.sofaRequirement.notes!.join(' ')).toMatch(/does not select a cover/i);
  });

  it('flags an intended cover rated under the requirement', () => {
    const r2 = run(
      withHydraulics({
        mainDrains: { count: 2, separationFt: 3, onDifferentSurfaces: false, intendedCoverRatingGpm: 20 },
      }),
    );
    expect(r2.outletChecks.find((c) => c.standard.includes('APSP-16'))!.status).toBe('fail');
  });

  it('passes a cover rated above the requirement but still asks for confirmation', () => {
    const r2 = run(
      withHydraulics({
        mainDrains: { count: 2, separationFt: 3, onDifferentSurfaces: false, intendedCoverRatingGpm: 120 },
      }),
    );
    const c = r2.outletChecks.find((x) => x.standard.includes('APSP-16'))!;
    expect(c.status).toBe('pass');
    expect(c.note).toMatch(/actually installed/i);
  });
});

// --- flow -------------------------------------------------------------------

describe('design flow is the root input', () => {
  const f = computeDesignFlow(VOLUME, 8);

  // 15,787.64 / 360 = 43.85 gpm
  it('6 h turnover sets the maximum at 43.85 gpm', () => close(f.maxFlow.value, 43.854, 0.01));
  // 15,787.64 / 720 = 21.93 gpm
  it('12 h turnover sets the minimum at 21.93 gpm', () => close(f.minFlow.value, 21.927, 0.01));
  // 15,787.64 / 480 = 32.89 gpm
  it('the 8 h design turnover alone would give 32.89 gpm', () => close(f.turnoverFlow.value, 32.891, 0.01));

  it('the 36 gpm floor governs on this pool, not the turnover math', () => {
    close(f.designFlow.value, MIN_FLOW_GPM);
    expect(f.designFlow.value).toBeGreaterThan(f.turnoverFlow.value);
  });

  it('reports the turnover actually achieved: 7.31 h', () => close(f.achievedTurnover.value, 7.309, 0.01));

  it('flags the conflict when the 36 gpm floor beats the 6 h maximum', () => {
    const small = computeDesignFlow(6000, 8); // 6 h max = 16.7 gpm, floor 36
    const conflict = small.checks.find((c) => c.standard.includes('Federal'));
    expect(conflict?.status).toBe('flag');
    expect(conflict?.note).toMatch(/resolves neither/i);
  });

  it('does not flag a pool where the floor and the 6 h maximum agree', () => {
    expect(f.checks).toHaveLength(0);
  });
});

// --- pipe primitives --------------------------------------------------------

describe('pipe primitives', () => {
  it('velocity: 36 gpm in 2 in Sch 40 is 3.44 fps', () => {
    close(velocityFps(36, SCH40_ID['2']), 3.443, 0.005);
  });

  it('Hazen-Williams: 36 gpm in 2 in PVC is 2.19 ft per 100 ft', () => {
    close(frictionLossPer100Ft(36, SCH40_ID['2']), 2.19, 0.02);
  });

  it('friction rises steeply with flow — doubling flow more than triples the loss', () => {
    const a = frictionLossPer100Ft(30, SCH40_ID['2']);
    const b = frictionLossPer100Ft(60, SCH40_ID['2']);
    expect(b / a).toBeGreaterThan(3.4);
    expect(b / a).toBeLessThan(3.7);
  });

  it('picks the smallest size that meets a velocity limit', () => {
    // 36 gpm in 1.5 in is 5.6 fps; 80 gpm in 2 in is 7.7 fps, so 80 needs 2.5 in.
    expect(smallestSizeForVelocity(36, 6)).toBe('1.5');
    expect(smallestSizeForVelocity(80, 6)).toBe('2.5');
    expect(smallestSizeForVelocity(120, 6)).toBe('3');
  });

  it('returns null when no listed size meets the limit', () => {
    expect(smallestSizeForVelocity(1000, 6)).toBeNull();
  });
});

// --- convergence ------------------------------------------------------------

describe('the loop converges to an operating point', () => {
  it('ships with an empty pump catalog', () => {
    expect(PUMP_CATALOG).toHaveLength(0);
  });

  it('without a curve, reports no operating point instead of inventing one', () => {
    const r = run(NO_CURVE);
    expect(r.operatingPoint).toBeNull();
    expect(r.systemFlowBasis).toMatch(/no pump curve/i);
    expect(r.operatingPointNote).toMatch(/not at a converged flow/i);
    expect(r.notes.join(' ')).toMatch(/step 6/i);
  });

  it('with a curve, converges and reports the crossing', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    expect(r.operatingPoint).not.toBeNull();
    expect(r.iterations).toBeGreaterThanOrEqual(1);
    expect(r.convergenceLog.join(' ')).toMatch(/converged/i);
  });

  it('the operating point sits on both curves', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    const op = r.operatingPoint!;
    const pumpHead = headAtFlow(EXAMPLE_CURVE, op.gpm)!;
    close(pumpHead, op.headFt, 0.05);
  });

  it('the system flow follows the pump, not the design flow', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    close(r.systemFlowGpm, r.operatingPoint!.gpm, 0.001);
    expect(r.systemFlowGpm).not.toBeCloseTo(r.flow.designFlow.value, 1);
  });

  it('re-checks velocity at the converged flow, not the design flow', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    const branch = r.runs.find((x) => x.run.role === 'suction-branch')!;
    close(branch.governingFlowGpm, r.operatingPoint!.gpm, 0.001);
  });

  it('a more restrictive system lands at a lower flow and a higher head', () => {
    const restricted = run(
      withHydraulics({
        pumpCurve: EXAMPLE_CURVE,
        staticLiftFt: 25,
      }),
    );
    const base = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    expect(restricted.operatingPoint!.gpm).toBeLessThan(base.operatingPoint!.gpm);
    expect(restricted.operatingPoint!.headFt).toBeGreaterThan(base.operatingPoint!.headFt);
  });

  it('reports no crossing rather than extrapolating past the published curve', () => {
    const impossible = findOperatingPoint(
      { ...STANDARD_MODEL.hydraulics!, staticLiftFt: 500 },
      EXAMPLE_CURVE,
    );
    expect(impossible).toBeNull();
  });

  it('names the curve source and revision date on the operating point', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    expect(r.operatingPointNote).toContain(EXAMPLE_CURVE.revisionDate);
    expect(r.operatingPointNote).toMatch(/4\.4\.5\.1/);
  });
});

describe('TDH by the equivalent-length method', () => {
  const r = run();

  it('adds suction, return, equipment and static lift', () => {
    const sum = r.tdhBreakdown.reduce((a, c) => a + c.value, 0);
    close(r.tdh.value, sum, 0.001);
  });

  it('parallel branches do not add — the worst one governs', () => {
    const suctionHead = r.tdhBreakdown[0]!;
    const branchLosses = r.runs
      .filter((x) => x.run.role === 'suction-branch')
      .map((x) => x.frictionLoss.value);
    const trunk = r.runs
      .filter((x) => x.run.role === 'suction-trunk')
      .reduce((a, x) => a + x.frictionLoss.value, 0);
    const skimmerLosses = r.runs
      .filter((x) => x.run.role === 'skimmer')
      .map((x) => x.frictionLoss.value);
    close(suctionHead.value, Math.max(...branchLosses, ...skimmerLosses) + trunk, 0.001);
    // Strictly less than adding every parallel path together.
    const allParallel = [...branchLosses, ...skimmerLosses].reduce((a, b) => a + b, 0);
    expect(suctionHead.value).toBeLessThan(allParallel + trunk);
  });

  it('fitting equivalent length is added to measured pipe length, never ignored', () => {
    const trunk = r.runs.find((x) => x.run.id === 'MD-TRUNK')!;
    expect(trunk.equivalentLength.value).toBeGreaterThan(trunk.run.lengthFt);
    expect(trunk.equivalentLength.notes!.join(' ')).toMatch(/equivalent-length/i);
  });

  it('equipment losses scale as the square of flow and name their source', () => {
    const equip = r.tdhBreakdown[2]!;
    expect(equip.notes!.join(' ')).toMatch(/square of flow/i);
    expect(equip.inputs.map((i) => i.label).join(' ')).toMatch(/PLACEHOLDER/);
  });

  it('the system curve rises with flow', () => {
    for (let i = 1; i < r.systemCurve.length; i++) {
      expect(r.systemCurve[i]!.headFt).toBeGreaterThan(r.systemCurve[i - 1]!.headFt);
    }
  });
});

describe('plumbing items', () => {
  it('carries the hydrostatic relief valve, which v1 of the PRD omitted', () => {
    const r = run();
    expect(r.hydrostaticValves.value).toBe(1);
    expect(r.hydrostaticValves.notes!.join(' ')).toMatch(/collapsible/i);
  });

  it('keeps spa jets out of the pool TDH and says so', () => {
    const r = run();
    expect(r.runs.some((x) => x.run.role === 'spa-jet')).toBe(true);
    expect(r.notes.join(' ')).toMatch(/spa mode is a separate operating condition/i);
  });
});

describe('show your work', () => {
  it('every hydraulic output carries a formula, named inputs with units, and a unit', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    const outputs = [
      r.flow.maxFlow,
      r.flow.minFlow,
      r.flow.turnoverFlow,
      r.flow.designFlow,
      r.flow.achievedTurnover,
      r.tdh,
      ...r.tdhBreakdown,
      r.sofaRequirement,
      r.hydrostaticValves,
      ...r.runs.flatMap((x) => [x.velocity, x.equivalentLength, x.frictionLoss]),
    ];
    for (const c of outputs) {
      expect(c.formula.length, c.id).toBeGreaterThan(0);
      expect(c.unit.length, c.id).toBeGreaterThan(0);
      expect(c.inputs.length, c.id).toBeGreaterThan(0);
      for (const i of c.inputs) expect(i.unit.length, `${c.id}:${i.symbol}`).toBeGreaterThan(0);
    }
  });
});

describe('turnover is re-checked at the flow the pump actually delivers', () => {
  it('fails an oversized pump that beats the 6 h maximum, even though sizing was done at the design flow', () => {
    const r = run(withHydraulics({ pumpCurve: EXAMPLE_CURVE }));
    const c = r.operatingChecks.find((x) => x.standard.includes('6 h maximum'));
    expect(c?.status).toBe('fail');
    expect(c?.note).toMatch(/oversized for this plumbing/i);
    // The design flow was compliant; the delivered flow is not.
    expect(r.flow.designFlow.value).toBeLessThanOrEqual(r.flow.maxFlow.value);
    expect(r.systemFlowGpm).toBeGreaterThan(r.flow.maxFlow.value);
  });

  it('passes when the delivered flow sits inside the 6 h to 12 h band', () => {
    const gentle = { ...EXAMPLE_CURVE, points: [
      { gpm: 0, headFt: 30 },
      { gpm: 20, headFt: 26 },
      { gpm: 40, headFt: 18 },
      { gpm: 55, headFt: 6 },
    ] };
    const r = run(withHydraulics({ pumpCurve: gentle }));
    const c = r.operatingChecks[0]!;
    expect(c.status).toBe('pass');
    expect(c.note).toMatch(/inside the 6 h to 12 h band/i);
  });

  it('reports nothing about operating turnover when there is no operating point', () => {
    expect(run(NO_CURVE).operatingChecks).toHaveLength(0);
  });
});

describe('Hayward manufacturer data, IS3200OX Rev B', () => {
  it('carries the real current model numbers, not the superseded ones', () => {
    expect(findPumpModel('VSP32815')?.series).toBe('TriStar VS 800');
    expect(findPumpModel('VSP32815')?.totalHp).toBe(1.85);
    // The retail W3 variant and the power end resolve to the same pump.
    expect(findPumpModel('W3VSP32815')?.id).toBe('VSP32815');
    expect(findPumpModel('VSX32815PE')?.id).toBe('VSP32815');
  });

  it('has no curve attached, because the owner\'s manual carries none', () => {
    for (const p of HAYWARD_VS_PUMPS) expect(p.curve).toBeUndefined();
  });

  it('names the pump but still refuses to converge without a curve', () => {
    const r = run(NO_CURVE);
    expect(r.pumpModel?.id).toBe('VSP32815');
    expect(r.operatingPoint).toBeNull();
    expect(r.notes.join(' ')).toMatch(/no head\/flow performance curve is attached/i);
  });

  it('checks every run against the manufacturer flow chart as its own threshold', () => {
    const r = run();
    for (const x of r.runs) {
      const c = x.checks.find((y) => y.standard.includes('Hayward'))!;
      expect(c).toBeDefined();
      expect(c.note).toMatch(/Hayward/);
    }
  });

  it('the manufacturer limit sits between the design target and the code limit', () => {
    // 45 gpm through 1.5 in is 7.09 fps: over the 6 fps target, under 8 fps code.
    const v = velocityFps(HAYWARD_MAX_SYSTEM_FLOW_GPM['1.5'], SCH40_ID['1.5']);
    expect(v).toBeGreaterThan(ENERGY_SUCTION_FPS);
    expect(v).toBeLessThan(CODE_MAX_FPS);
  });

  it('flags a run over the manufacturer recommendation without calling it a code failure', () => {
    const fast = run(
      withHydraulics({
        turnoverHours: 3, // ~88 gpm
        runs: STANDARD_MODEL.hydraulics!.runs.map((x) =>
          x.role === 'suction-trunk' ? { ...x, size: '1.5' as const } : x,
        ),
      }),
    );
    const trunk = fast.runs.find((x) => x.run.role === 'suction-trunk')!;
    const c = trunk.checks.find((y) => y.standard.includes('Hayward'))!;
    expect(c.status).toBe('flag');
    expect(c.note).toMatch(/not a code limit/i);
  });

  it('reports the 5-diameter straight pipe requirement into the pump', () => {
    const r = run();
    expect(r.installationRequirements.join(' ')).toMatch(/5 pipe diameters/);
    expect(r.installationRequirements.join(' ')).toMatch(/IS3200OX Rev B/);
  });
});

describe('variable-speed selection, TriStar VS 900 curves', () => {
  const r = run();

  it('carries a curve for every published speed', () => {
    expect(r.speedOptions.map((o) => o.rpm)).toEqual([1000, 1725, 2400, 3000, 3450]);
  });

  it('picks the LOWEST speed that makes design flow, not the biggest', () => {
    expect(r.selectedSpeed).not.toBeNull();
    const chosen = r.selectedSpeed!;
    expect(chosen.meetsDesignFlow).toBe(true);
    for (const o of r.speedOptions) {
      if (o.rpm < chosen.rpm) expect(o.meetsDesignFlow).toBe(false);
    }
    expect(r.speedSelectionNote).toMatch(/lowest published speed/i);
  });

  it('converges to an operating point on the chosen speed', () => {
    expect(r.operatingPoint).not.toBeNull();
    expect(r.operatingPoint!.gpm).toBeGreaterThanOrEqual(r.flow.designFlow.value);
  });

  it('the operating point lies on the chosen speed curve', () => {
    const op = r.operatingPoint!;
    const head = headAtFlow(r.selectedSpeed!.curve, op.gpm)!;
    close(head, op.headFt, 0.05);
  });

  it('a more restrictive system forces a higher speed', () => {
    const restricted = run(withHydraulics({ staticLiftFt: 30 }));
    expect(restricted.selectedSpeed!.rpm).toBeGreaterThan(r.selectedSpeed!.rpm);
  });

  it('says so plainly when no speed can make design flow', () => {
    const impossible = run(withHydraulics({ staticLiftFt: 200 }));
    expect(impossible.selectedSpeed).toBeNull();
    expect(impossible.speedSelectionNote).toMatch(/no published speed/i);
  });

  it('curve points are monotonically falling, as a pump curve must be', () => {
    for (const o of r.speedOptions) {
      const pts = o.curve.points;
      for (let i = 1; i < pts.length; i++) {
        expect(pts[i]!.headFt).toBeLessThanOrEqual(pts[i - 1]!.headFt + 0.3);
        expect(pts[i]!.gpm).toBeGreaterThan(pts[i - 1]!.gpm);
      }
    }
  });

  it('a faster speed makes more head at every flow', () => {
    const at1725 = r.speedOptions.find((o) => o.rpm === 1725)!.curve;
    const at3450 = r.speedOptions.find((o) => o.rpm === 3450)!.curve;
    for (const q of [10, 30, 50, 70]) {
      expect(headAtFlow(at3450, q)!).toBeGreaterThan(headAtFlow(at1725, q)!);
    }
  });

  it('every curve names the sell sheet and how it was read', () => {
    for (const o of r.speedOptions) {
      expect(o.curve.source).toMatch(/LITTS90095026/);
      expect(o.curve.source).toMatch(/plotted path coordinates/i);
    }
  });
});

describe('speed selection and pipe sizing are solved together', () => {
  const r = run();

  it('re-checks the speed against the pipe the converged flow actually needs', () => {
    // First pass sizes at design flow and lands on 2400 rpm; once the pipe is
    // sized for the flow that results, 1725 rpm carries it.
    expect(r.convergenceLog.join(' ')).toMatch(/re-checked speed against the pipe sized for/i);
    expect(r.selectedSpeed!.rpm).toBe(1725);
  });

  it('settles on a self-consistent answer: the pipe suits the flow and the flow suits the pipe', () => {
    const branch = r.runs.find((x) => x.run.role === 'suction-branch')!;
    // Sizing is done at the converged flow, and that flow is what the pump makes.
    close(branch.governingFlowGpm, r.systemFlowGpm, 0.001);
    close(r.operatingPoint!.gpm, r.systemFlowGpm, 0.001);
    // And the size chosen is the one the converged flow requires.
    expect(branch.size).toBe(smallestSizeForVelocity(r.systemFlowGpm, BLOCKED_BRANCH_FPS));
  });

  it('lands inside the turnover band once the speed is solved against the right pipe', () => {
    expect(r.operatingChecks[0]!.status).toBe('pass');
    expect(r.recommendedRpm).toBeNull();
  });
});

describe('a variable-speed pump between two published curves', () => {
  // The VS 950 is a bigger pump on the same plumbing: its lowest speed overshoots.
  const big = run(withHydraulics({ pumpModel: findPumpModel('SP32950VSPX1') }));

  it('recommends an interpolated speed when the lowest published speed overshoots turnover', () => {
    expect(big.selectedSpeed!.operatingPoint!.gpm).toBeGreaterThan(big.flow.maxFlow.value);
    expect(big.recommendedRpm).not.toBeNull();
    expect(big.recommendedRpm!).toBeLessThan(big.selectedSpeed!.rpm);
  });

  it('labels the recommendation as interpolated and asks for a meter reading', () => {
    const note = big.notes.join(' ');
    expect(note).toMatch(/interpolated between two published curves/i);
    expect(note).toMatch(/verify the actual flow with a meter/i);
  });

  it('the bigger pump is the one that overshoots, not the smaller', () => {
    expect(big.systemFlowGpm).toBeGreaterThan(run().systemFlowGpm);
  });
});
