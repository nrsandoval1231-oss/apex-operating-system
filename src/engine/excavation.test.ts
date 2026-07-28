/**
 * Excavation engine.
 *
 * Hand check for the standard model, worked independently:
 *   ext   = t_shell 0.5 + o_h 1.0                    = 1.5 ft each side
 *   L_exc = 30 + 3 = 33 ft,  W_exc = 15 + 3 = 18 ft
 *   k     = freeboard 0.5 + shell 0.5 + floor o-dig 0.5 = 1.5 ft added to every depth
 *   cut profile: 1.5@5.0 | 10@5.0 | 14: 5.0->7.5 | 6@7.5 | 1.5@7.5
 *   A_sec = 7.5 + 50 + 87.5 + 45 + 11.25            = 201.25 sf
 *   V_cut = 201.25 x 18                             = 3622.5 cf = 134.17 BCY
 */

import { describe, expect, it } from 'vitest';
import { computeExcavation, ExcavationInputError } from './excavation.ts';
import { computeGeometry } from './geometry.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const geom = computeGeometry(STANDARD_MODEL);
const run = (job: Job = STANDARD_MODEL) => {
  const g = computeGeometry(job);
  return computeExcavation(job, g.segments, g.totalVolumeCf.value, g.totalWettedArea.value);
};
const x = computeExcavation(
  STANDARD_MODEL,
  geom.segments,
  geom.totalVolumeCf.value,
  geom.totalWettedArea.value,
);

describe('excavation envelope', () => {
  it('length = 30 + 2 x (0.5 + 1.0) = 33 ft', () => close(x.excavationLength.value, 33));
  it('width = 15 + 2 x (0.5 + 1.0) = 18 ft', () => close(x.excavationWidth.value, 18));
  it('max cut = 0.5 + 6 + 0.5 + 0.5 = 7.5 ft below grade', () => close(x.maxCutDepth.value, 7.5));
  it('total cut = 201.25 sf x 18 ft = 3622.5 cf', () => close(x.totalCutCf.value, 3622.5));

  it('the cut is deeper than the water everywhere — shell and over-dig are additive', () => {
    for (const s of x.cutSegments) {
      expect(s.d1).toBeGreaterThanOrEqual(STANDARD_MODEL.pool.profile.shallowDepth);
    }
  });
});

describe('three volume states, never conflated', () => {
  // Lubbock is figured at 25% swell across the whole cut, so the standard model
  // carries one layer. The per-layer machinery is exercised further down.
  it('one layer covering the whole cut: 134.17 BCY -> 167.71 LCY at 25%', () => {
    expect(x.layers).toHaveLength(1);
    const l = x.layers[0]!;
    close(l.bankCy.value, 134.1667);
    close(l.looseCy.value, 167.7083);
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

  it('total = 134.17 BCY / 167.71 LCY', () => {
    close(x.totalBankCy.value, 134.1667);
    close(x.totalLooseCy.value, 167.7083);
  });

  it('still swells each layer on its own factor when a job is layered', () => {
    const layered = run({
      ...STANDARD_MODEL,
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
    // 44 x 1.15 + 22 x 1.30 + 68.1667 x 1.185 = 50.6 + 28.6 + 80.78
    close(layered.totalLooseCy.value, 44 * 1.15 + 22 * 1.3 + 68.1667 * 1.185, 0.01);
    // The hole is the hole: layering never moves the bank volume.
    close(layered.totalBankCy.value, x.totalBankCy.value, 0.0001);
  });
});

describe('backfill balance and haul', () => {
  it('backfill balance is compacted, haul is loose, and they are separate lines', () => {
    expect(x.backfillCompactedCy.unit).toBe('CCY');
    expect(x.spoilHaulLooseCy.unit).toBe('LCY');
  });

  it('void = 3622.5 - 2110.5 water - 507.08 shell = 1004.92 cf = 37.22 CCY', () => {
    close(x.backfillVoidCf.value, 1004.922, 0.01);
    close(x.backfillCompactedCy.value, 37.219, 0.001);
  });

  it('haul = 167.71 total LCY - 53.48 LCY consumed as backfill = 114.23 LCY', () => {
    close(x.backfillLooseCy.value, 53.476, 0.01);
    close(x.spoilHaulLooseCy.value, 114.2323, 0.01);
  });

  it('truck count rounds up: ceil(114.23 / 12) = 10 loads', () => {
    expect(x.truckCount.value).toBe(10);
  });

  it('one cubic yard over a truckload is still another truck', () => {
    const tiny = run({
      ...STANDARD_MODEL,
      excavation: { ...STANDARD_MODEL.excavation, truckCapacityLcy: 114.2323 / 2 - 0.001 },
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
      run({ ...STANDARD_MODEL, excavation: { ...STANDARD_MODEL.excavation, soilLayers: [] } }),
    ).toThrow(ExcavationInputError);
  });

  it('rejects a layer with no swell factor rather than defaulting one', () => {
    expect(() =>
      run({
        ...STANDARD_MODEL,
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
        ...STANDARD_MODEL,
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
        ...STANDARD_MODEL,
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
      ...STANDARD_MODEL,
      excavation: { ...STANDARD_MODEL.excavation, soilLayers: base },
    });
    const shallowCaliche = run({
      ...STANDARD_MODEL,
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
