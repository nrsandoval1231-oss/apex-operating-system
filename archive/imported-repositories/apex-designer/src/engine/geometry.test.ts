/**
 * Geometry & volume engine.
 *
 * The expected values below are hand calculations for the standard model,
 * worked independently of the implementation. Each block states the arithmetic
 * so a failure tells you which term moved.
 */

import { describe, expect, it } from 'vitest';
import { buildSegments, computeGeometry, GeometryInputError } from './geometry.ts';
import { crossSectionArea, floorSlantLength, integrateDepthBand } from './profile.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const g = computeGeometry(STANDARD_MODEL);

/** PRD: quantities must land within 3% of a hand check. Engine math is exact, so tests are tight. */
const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe('depth profile', () => {
  it('rejects a profile whose runs do not sum to the pool length', () => {
    const bad: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { ...STANDARD_MODEL.pool.profile, deepRun: 8 },
      },
    };
    expect(() => buildSegments(bad.pool)).toThrow(GeometryInputError);
  });

  it('rejects a deep end shallower than the shallow end', () => {
    const bad: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        profile: { shallowRun: 10, transitionRun: 14, deepRun: 6, shallowDepth: 6, deepDepth: 3.5 },
      },
    };
    expect(() => buildSegments(bad.pool)).toThrow(GeometryInputError);
  });

  it('section area = 10x3.5 + 14x(3.5+6)/2 + 6x6 = 137.5 sf', () => {
    close(crossSectionArea(g.segments), 137.5);
    close(g.poolSectionArea.value, 137.5);
  });

  it('floor slope length = 10 + sqrt(14^2 + 2.5^2) + 6 = 30.2215 ft, longer than the 30 ft plan run', () => {
    close(floorSlantLength(g.segments), 10 + Math.sqrt(196 + 6.25) + 6, 0.0001);
    expect(floorSlantLength(g.segments)).toBeGreaterThan(30);
  });
});

describe('plan dimensions', () => {
  it('plan area = 30 x 15 = 450 sf', () => close(g.poolPlanArea.value, 450));
  it('perimeter = 2 x (30 + 15) = 90 ft', () => close(g.poolPerimeter.value, 90));
  it('waterline perimeter adds the spa: 90 + 24 = 114 ft', () =>
    close(g.waterlinePerimeter.value, 114));
});

describe('water volume', () => {
  it('gross = 137.5 sf x 15 ft = 2062.5 cf', () => close(g.poolGrossVolumeCf.value, 2062.5));

  // Steps: run 1 ft, width 6 ft, floor 3.5 ft, risers bottom-first 8/10/10/10/10 in.
  // Stack 48 in = 6 in freeboard + 42 in depth. Treads sit 0.3333 / 1.1667 / 2.0 /
  // 2.8333 ft below the waterline. Section = 1 x (3.1667 + 2.3333 + 1.5 + 0.6667)
  // = 7.6667 sf. Volume = 7.6667 x 6 = 46 cf.
  it('step displacement = 46 cf', () => close(g.stepDisplacement[0]!.value, 46));

  // Bench: 8 ft wide x 1.3333 ft deep x (4.5 - 1.5) ft tall = 32 cf.
  /*
   * 8 ft x 1'-4" x (5.6746 - 1'-6") = 44.53 cf.
   *
   * It read 32 while floorDepthFt was an entered number that said 4'-6". The
   * bench sits over water averaging 5.67 ft deep, so it was under-displacing by
   * roughly a third. The depth is derived from the footprint now.
   */
  it('bench displacement = 44.53 cf, from the floor actually under it',
    () => close(g.seatDisplacement[0]!.value, 44.5286));

  it('net pool = 2062.5 - 46 - 44.53 = 1971.97 cf', () => close(g.poolNetVolumeCf.value, 1971.9714));
  it('spa = 6 x 6 x 3.5 = 126 cf', () => close(g.spaVolumeCf!.value, 126));
  it('total = 2097.97 cf', () => close(g.totalVolumeCf.value, 2097.9714));
  it('total = 2097.97 x 7.48052 = 15,693.9 gal', () => close(g.totalVolumeGal.value, 15693.9172, 0.05));
  it('average depth = 1971.97 / 450 = 4.38 ft', () => close(g.averageDepth.value, 4.3822));

  it('displacement is a deduction — net is always under gross', () => {
    expect(g.poolNetVolumeCf.value).toBeLessThan(g.poolGrossVolumeCf.value);
  });
});

describe('wetted surface area', () => {
  // floor 15 x 30.2215 = 453.32; two side walls 2 x 137.5 = 275; end walls
  // 15 x 3.5 + 15 x 6 = 142.5; exposed side faces 2 x 7.6667 + 2 x 4.0 = 23.3333.
  it('pool = 894.16 sf', () => close(g.poolWettedArea.value, 894.156, 0.01));
  it('spa = 36 + 2 x 3.5 x 12 = 120 sf', () => close(g.spaWettedArea!.value, 120));
  it('total = 1014.16 sf', () => close(g.totalWettedArea.value, 1014.156, 0.01));

  it('a full-width step adds no wetted area — its faces trade against the wall it covers', () => {
    const fullWidth: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        steps: [{ ...STANDARD_MODEL.pool.steps[0]!, treadWidthIn: 15 * 12 }],
        seats: [],
      },
    };
    const r = computeGeometry(fullWidth);
    // 453.32 + 275 + 142.5, no face addition.
    close(r.poolWettedArea.value, 15 * floorSlantLength(r.segments) + 275 + 142.5, 0.01);
  });
});

describe('show your work', () => {
  it('every geometry output carries a formula, named inputs with units, and a unit', () => {
    const outputs = [
      g.poolPlanArea,
      g.poolPerimeter,
      g.poolSectionArea,
      g.poolGrossVolumeCf,
      g.poolNetVolumeCf,
      g.totalVolumeCf,
      g.totalVolumeGal,
      g.averageDepth,
      g.poolWettedArea,
      g.totalWettedArea,
      g.waterlinePerimeter,
      ...g.stepDisplacement,
      ...g.seatDisplacement,
    ];
    for (const c of outputs) {
      expect(c.formula.length, c.id).toBeGreaterThan(0);
      expect(c.unit.length, c.id).toBeGreaterThan(0);
      expect(c.inputs.length, c.id).toBeGreaterThan(0);
      for (const i of c.inputs) {
        expect(i.unit.length, `${c.id}:${i.symbol}`).toBeGreaterThan(0);
        expect(i.label.length, `${c.id}:${i.symbol}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('input reconciliation notes', () => {
  it('warns when the riser count does not match the tread count', () => {
    const j: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        steps: [{ ...STANDARD_MODEL.pool.steps[0]!, riserHeightsIn: [10, 10, 10, 10] }],
      },
    };
    const r = computeGeometry(j);
    expect(r.notes.some((n) => n.id.includes('riserCount'))).toBe(true);
  });

  it('warns when a seat surface sits at or below the floor', () => {
    // Provoked by the seat, not by the floor: floorDepthFt is derived from where
    // the seat sits now, so it cannot be edited into disagreeing with the pool.
    // A ledge hung 8 ft below the waterline in 3'-6" of water is the real shape
    // of this mistake.
    const j: Job = {
      ...STANDARD_MODEL,
      pool: {
        ...STANDARD_MODEL.pool,
        seats: [{
          ...STANDARD_MODEL.pool.seats[0]!,
          depthBelowWaterlineIn: 96,
          placement: { wall: 'shallow', alongFt: 2 },
        }],
      },
    };
    const r = computeGeometry(j);
    expect(r.notes.some((n) => n.id.includes('seats.height'))).toBe(true);
  });
});

describe('depth band integration (the layered-soil primitive)', () => {
  const flat = [{ name: 'flat', length: 10, d1: 5, d2: 5 }];

  it('a band entirely above a flat floor takes its full thickness', () => {
    close(integrateDepthBand(flat, 0, 3), 30);
  });

  it('a band below the floor takes nothing', () => {
    close(integrateDepthBand(flat, 6, 8), 0);
  });

  it('a band straddling the floor takes only the part above it', () => {
    close(integrateDepthBand(flat, 4, 8), 10);
  });

  it('bands partition the whole section area with no gap or overlap', () => {
    const segs = g.segments;
    const whole = crossSectionArea(segs);
    const parts =
      integrateDepthBand(segs, 0, 2) + integrateDepthBand(segs, 2, 4) + integrateDepthBand(segs, 4, 10);
    close(parts, whole, 0.0001);
  });

  it('splits a sloped segment at the band boundary analytically', () => {
    // 10 ft run sloping 0 -> 10 ft deep. Band 0-5 catches the full 5 ft over the
    // lower half (25 sf) plus the triangle over the upper half (12.5 sf) = 37.5.
    const slope = [{ name: 'slope', length: 10, d1: 0, d2: 10 }];
    close(integrateDepthBand(slope, 0, 5), 37.5, 0.0001);
    close(integrateDepthBand(slope, 5, 10), 12.5, 0.0001);
    close(integrateDepthBand(slope, 0, 10), 50, 0.0001);
  });
});

describe('a spa set into the pool footprint', () => {
  const inset: Job = {
    ...STANDARD_MODEL,
    spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true },
  };
  const r = computeGeometry(inset);

  it('takes its footprint out of the pool water', () => {
    // 6 x 6 x 3.5 ft of shallow end = 126 cf
    close(r.spaInsetDeduction!.value, 126);
  });

  it('is worth 126 cf against an attached spa — the same spa, 942 gallons apart', () => {
    const attached = computeGeometry(STANDARD_MODEL);
    close(attached.totalVolumeCf.value - r.totalVolumeCf.value, 126, 0.01);
    close(attached.totalVolumeGal.value - r.totalVolumeGal.value, 942.5, 0.5);
  });

  it('cancels out exactly when the spa is as deep as the water it replaces', () => {
    // 3.5 ft spa in a 3.5 ft shallow end: the water it adds is the water it took.
    close(r.totalVolumeCf.value, r.poolNetVolumeCf.value, 0.01);
  });

  it('does not cancel when the spa is deeper than the pool where it sits', () => {
    const deeper: Job = {
      ...STANDARD_MODEL,
      spa: { ...STANDARD_MODEL.spa!, insetIntoPool: true, depthFt: 4.5 },
    };
    const d = computeGeometry(deeper);
    expect(d.totalVolumeCf.value).toBeGreaterThan(d.poolNetVolumeCf.value);
  });

  it('takes the spa footprint off the pool floor in the wetted area', () => {
    const attached = computeGeometry(STANDARD_MODEL);
    close(attached.poolWettedArea.value - r.poolWettedArea.value, 36);
  });

  it('an attached spa deducts nothing', () => {
    expect(computeGeometry(STANDARD_MODEL).spaInsetDeduction).toBeUndefined();
  });
});
