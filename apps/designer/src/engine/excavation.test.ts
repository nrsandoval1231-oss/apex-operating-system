/**
 * Excavation engine.
 *
 * Hand check for the standard model, worked independently:
 *   shell offset = 0.5 ft from the finished waterline/floor
 *   L_exc,shell = 30 + 1 = 31 ft, W_exc,shell = 15 + 1 = 16 ft
 *   k = freeboard 0.5 + shell 0.5 = 1.0 ft added to every water depth
 *   base cut profile: 0.5@4.5 | 10@4.5 | 14: 4.5->7 | 6@7 | 0.5@7
 *   A_sec = 2.25 + 45 + 80.5 + 42 + 3.5 = 173.25 sf
 *   base shell cut = 173.25 x 16 = 2772 cf
 *   bond-beam-only cut = [(32 x 17) - (31 x 16)] x 1 = 48 cf
 *   total cut = 2820 cf = 104.44 BCY
 */

import { describe, expect, it } from 'vitest';
import { computeExcavation, ExcavationInputError } from './excavation.ts';
import { computeGeometry } from './geometry.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const POOL_ONLY: Job = { ...STANDARD_MODEL, spa: undefined };
const geom = computeGeometry(POOL_ONLY);
const run = (job: Job = POOL_ONLY) => {
  const g = computeGeometry(job);
  return computeExcavation(job, g.segments, g.totalVolumeCf.value, g.totalWettedArea.value);
};
const x = computeExcavation(
  POOL_ONLY,
  geom.segments,
  geom.totalVolumeCf.value,
  geom.totalWettedArea.value,
);

describe('excavation envelope', () => {
  it('ordinary shell length = 30 + 2 x 0.5 = 31 ft', () => close(x.excavationLength.value, 31));
  it('ordinary shell width = 15 + 2 x 0.5 = 16 ft', () => close(x.excavationWidth.value, 16));
  it('max cut = 0.5 + 6 + 0.5 = 7 ft below grade', () => close(x.maxCutDepth.value, 7));
  it('adds the attached spa cut beyond the pool excavation envelope', () => {
    const withSpa = run(STANDARD_MODEL);
    const withoutSpa = run();
    // Deep-end attachment: the pool over-dig already covers the shared-edge strip.
    // Full-depth spa cut = 6 x (6 + 2 x 0.5) x 4.5 = 189 cf.
    // Its bond-beam top band adds another 6 cf versus the pool-only envelope.
    close(withSpa.attachedSpaCutCf!.value, 189);
    close(withSpa.totalCutCf.value - withoutSpa.totalCutCf.value, 195);
  });
  it('total attached-spa cut = pool 2820 cf + spa/base-and-bond-beam 195 cf', () => {
    close(run(STANDARD_MODEL).totalCutCf.value, 3015);
  });

  it('the cut is deeper than the water everywhere — shell and over-dig are additive', () => {
    for (const s of x.cutSegments) {
      expect(s.d1).toBeGreaterThanOrEqual(STANDARD_MODEL.pool.profile.shallowDepth);
    }
  });
});

describe('field overdig regions', () => {
  const fieldRuleJob = {
    ...POOL_ONLY,
    excavation: {
      ...POOL_ONLY.excavation,
      bondBeamFormOffsetFt: 1,
      bondBeamDepthFt: 1,
    },
  } as Job;
  const corrected = run(fieldRuleJob) as ReturnType<typeof run> & {
    readonly bondBeamOverdigCutCf: { readonly value: number };
    readonly bondBeamFormPerimeter: { readonly value: number };
  };

  it('uses the 6-inch shell thickness as the ordinary full-depth offset', () => {
    close(corrected.excavationLength.value, 31);
    close(corrected.excavationWidth.value, 16);
    close(corrected.maxCutDepth.value, 7);
  });

  it('applies the 12-inch offset only through the bond-beam zone', () => {
    // Outer bond-beam rectangle 32x17 minus ordinary shell rectangle 31x16,
    // through the 1 ft bond-beam depth: (544 - 496) x 1 = 48 cf.
    close(corrected.bondBeamOverdigCutCf.value, 48);
    close(corrected.totalCutCf.value, 2820);
  });

  it('measures forming on the outer 12-inch bond-beam form line', () => {
    close(corrected.bondBeamFormPerimeter.value, 98);
  });
});

describe('three volume states, never conflated', () => {
  // Lubbock is figured at 25% swell across the whole cut, so the standard model
  // carries one layer. The per-layer machinery is exercised further down.
  it('one layer covering the whole cut: 104.44 BCY -> 130.56 LCY at 25%', () => {
    expect(x.layers).toHaveLength(1);
    const l = x.layers[0]!;
    close(l.bankCy.value, 104.4444);
    close(l.looseCy.value, 130.5556);
    expect(l.bankCy.unit).toBe('BCY');
    expect(l.looseCy.unit).toBe('LCY');
  });

  it('the layer carries the provenance of its swell factor', () => {
    expect(x.layers[0]!.looseCy.source).toMatch(/builder's field figure for Lubbock/i);
    // And is honest about the part that was not measured.
    expect(x.layers[0]!.looseCy.source).toMatch(/compaction yield 0.87 is assumed/i);
  });

  it('layer cut volumes sum to the total cut — no gap, no double count', () => {
    const sum = x.layers.reduce((a, l) => a + l.cutCf.value, 0);
    close(sum, x.totalCutCf.value, 0.0001);
  });

  it('total = 104.44 BCY / 130.56 LCY', () => {
    close(x.totalBankCy.value, 104.4444);
    close(x.totalLooseCy.value, 130.5556);
  });

  it('still swells each layer on its own factor when a job is layered', () => {
    const layered = run({
      ...POOL_ONLY,
      excavation: {
        ...STANDARD_MODEL.excavation,
        soilLayers: [
          { name: 'Loam', topDepthFt: 0, thicknessFt: 2, swellFactor: 0.15, compactionYield: 0.9 },
          { name: 'Caprock', topDepthFt: 2, thicknessFt: 1, swellFactor: 0.3, compactionYield: 0.85 },
          { name: 'Chalky', topDepthFt: 3, thicknessFt: Infinity, swellFactor: 0.185, compactionYield: 0.85 },
        ],
      },
    });
    expect(layered.layers).toHaveLength(3);
    // The bond-beam-only 48 cf sits entirely in the first layer.
    close(layered.totalLooseCy.value, 124.5311, 0.01);
    // The hole is the hole: layering never moves the bank volume.
    close(layered.totalBankCy.value, x.totalBankCy.value, 0.0001);
  });
});

describe('backfill balance and haul', () => {
  it('backfill balance is compacted, haul is loose, and they are separate lines', () => {
    expect(x.backfillCompactedCy.unit).toBe('CCY');
    expect(x.spoilHaulLooseCy.unit).toBe('LCY');
  });

  it('void = 2820 cut - water - shell = 400.95 cf = 14.85 CCY', () => {
    close(x.backfillVoidCf.value, 400.951, 0.01);
    close(x.backfillCompactedCy.value, 14.85, 0.001);
  });

  it('haul = 130.56 total LCY - 21.34 LCY consumed as backfill = 109.22 LCY', () => {
    close(x.backfillLooseCy.value, 21.3363, 0.01);
    close(x.spoilHaulLooseCy.value, 109.219, 0.01);
  });

  it('truck count rounds up: ceil(109.22 / 12) = 10 loads', () => {
    expect(x.truckCount.value).toBe(10);
  });

  it('one cubic yard over a truckload is still another truck', () => {
    const tiny = run({
      ...POOL_ONLY,
      excavation: { ...STANDARD_MODEL.excavation, truckCapacityLcy: x.spoilHaulLooseCy.value / 2 - 0.001 },
    });
    expect(tiny.truckCount.value).toBe(3);
  });

  it('states that the backfill blend is an assumption, not a fact', () => {
    expect(x.notes.some((n) => /blended across layers/i.test(n))).toBe(true);
  });
});

describe('layered profile is required — no single soil type, no defaulted caliche', () => {
  it('rejects an empty soil profile', () => {
    expect(() =>
      run({ ...POOL_ONLY, excavation: { ...STANDARD_MODEL.excavation, soilLayers: [] } }),
    ).toThrow(ExcavationInputError);
  });

  it('rejects a layer with no swell factor rather than defaulting one', () => {
    expect(() =>
      run({
        ...POOL_ONLY,
        excavation: {
          ...STANDARD_MODEL.excavation,
          soilLayers: [
            {
              name: 'Caliche',
              topDepthFt: 0,
              thicknessFt: Infinity,
              swellFactor: Number.NaN,
              compactionYield: 0.85,
            },
          ],
        },
      }),
    ).toThrow(/swell/i);
  });

  it('rejects non-contiguous layers', () => {
    expect(() =>
      run({
        ...POOL_ONLY,
        excavation: {
          ...STANDARD_MODEL.excavation,
          soilLayers: [
            { name: 'Loam', topDepthFt: 0, thicknessFt: 3, swellFactor: 0.25, compactionYield: 0.9 },
            { name: 'Caliche', topDepthFt: 4, thicknessFt: Infinity, swellFactor: 0.45, compactionYield: 0.85 },
          ],
        },
      }),
    ).toThrow(/contiguous/i);
  });

  it('rejects a profile that does not reach the bottom of the cut', () => {
    expect(() =>
      run({
        ...POOL_ONLY,
        excavation: {
          ...STANDARD_MODEL.excavation,
          soilLayers: [
            { name: 'Loam', topDepthFt: 0, thicknessFt: 3, swellFactor: 0.25, compactionYield: 0.9 },
            { name: 'Caliche', topDepthFt: 3, thicknessFt: 2, swellFactor: 0.45, compactionYield: 0.85 },
          ],
        },
      }),
    ).toThrow(/cut goes to/i);
  });

  it('caliche depth moves the split without moving the total', () => {
    const base = [
      { name: 'Loam', topDepthFt: 0, thicknessFt: 3, swellFactor: 0.15, compactionYield: 0.9 },
      { name: 'Caprock', topDepthFt: 3, thicknessFt: Infinity, swellFactor: 0.3, compactionYield: 0.85 },
    ];
    const shallower = [
      { name: 'Loam', topDepthFt: 0, thicknessFt: 1, swellFactor: 0.15, compactionYield: 0.9 },
      { name: 'Caprock', topDepthFt: 1, thicknessFt: Infinity, swellFactor: 0.3, compactionYield: 0.85 },
    ];
    const deepCaliche = run({
      ...POOL_ONLY,
      excavation: { ...STANDARD_MODEL.excavation, soilLayers: base },
    });
    const shallowCaliche = run({
      ...POOL_ONLY,
      excavation: { ...STANDARD_MODEL.excavation, soilLayers: shallower },
    });
    close(shallowCaliche.totalBankCy.value, deepCaliche.totalBankCy.value, 0.0001);
    // Shallower caliche means more of the cut is in the higher-swell material.
    expect(shallowCaliche.totalLooseCy.value).toBeGreaterThan(deepCaliche.totalLooseCy.value);
  });
});

describe('show your work', () => {
  it('every excavation output carries a formula, named inputs with units, and a unit', () => {
    const outputs = [
      x.excavationLength,
      x.excavationWidth,
      x.maxCutDepth,
      x.totalCutCf,
      x.totalBankCy,
      x.totalLooseCy,
      x.backfillVoidCf,
      x.backfillCompactedCy,
      x.backfillBankCy,
      x.backfillLooseCy,
      x.spoilHaulLooseCy,
      x.truckCount,
      ...x.layers.flatMap((l) => [l.cutCf, l.bankCy, l.looseCy]),
    ];
    for (const c of outputs) {
      expect(c.formula.length, c.id).toBeGreaterThan(0);
      expect(c.unit.length, c.id).toBeGreaterThan(0);
      expect(c.inputs.length, c.id).toBeGreaterThan(0);
    }
  });

  it('volume states are labeled BCY / LCY / CCY everywhere they appear', () => {
    expect(x.totalBankCy.unit).toBe('BCY');
    expect(x.totalLooseCy.unit).toBe('LCY');
    expect(x.backfillCompactedCy.unit).toBe('CCY');
    expect(x.backfillBankCy.unit).toBe('BCY');
    expect(x.backfillLooseCy.unit).toBe('LCY');
  });
});
