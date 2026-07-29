/**
 * Equipment selection, gas demand and pad layout.
 *
 * Gas leads, because the PRD makes it safety-critical: a demand calculation,
 * never a design, and it must not emit a pipe size it cannot justify.
 */

import { describe, expect, it } from 'vitest';
import { BTU_PER_CF, computeEquipment, computeGasDemand, selectPump } from './equipment.ts';
import { computeGeometry } from './geometry.ts';
import { computeHydraulics } from './hydraulics.ts';
import { ALL_PUMP_MODELS, findPumpModel } from './pumpCatalog.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { GasParams, Job } from './types.ts';

const close = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

const geom = computeGeometry(STANDARD_MODEL);
const hyd = computeHydraulics(STANDARD_MODEL, geom.totalVolumeGal.value)!;
const eq = computeEquipment(STANDARD_MODEL, hyd)!;

const gasWith = (over: Partial<GasParams>): GasParams => ({
  ...STANDARD_MODEL.equipment!.gas!,
  ...over,
});

// --- gas: safety-critical --------------------------------------------------

describe('SAFETY: gas is a demand calculation, not a design', () => {
  const g = eq.gas!;

  it('labels itself as a demand calculation for a licensed contractor', () => {
    expect(g.disclaimer).toMatch(/DEMAND CALCULATION, not a gas system design/);
    expect(g.disclaimer).toMatch(/licensed gas contractor/i);
  });

  it('natural gas divides by 1,000: a 250,000 BTU/hr heater wants 250 cfh', () => {
    expect(BTU_PER_CF['natural-gas']).toBe(1000);
    close(g.heaterCfh.value, 250);
  });

  it('propane divides by 2,500, not 1,000', () => {
    expect(BTU_PER_CF.propane).toBe(2500);
    const lp = computeGasDemand(gasWith({ fuel: 'propane' }));
    close(lp.heaterCfh.value, 100);
    expect(lp.heaterCfh.source).toMatch(/NFPA 58/);
  });

  it('total connected load governs, not the heater alone', () => {
    // 250k heater + 100k furnace + 40k water heater + 65k range = 455k BTU/hr
    close(g.totalConnectedLoadBtu.value, 455000);
    close(g.totalConnectedLoadCfh.value, 455);
    expect(g.totalConnectedLoadBtu.value).toBeGreaterThan(g.heaterDemand.value);
    expect(g.totalConnectedLoadBtu.notes!.join(' ')).toMatch(/not the heater rating on its own/i);
  });

  it('counts existing appliances, not just the new ones', () => {
    const existing = STANDARD_MODEL.equipment!.gas!.connectedLoad.filter((a) => !a.isNew);
    expect(existing.length).toBeGreaterThan(0);
    const onlyNew = computeGasDemand(
      gasWith({ connectedLoad: STANDARD_MODEL.equipment!.gas!.connectedLoad.filter((a) => a.isNew) }),
    );
    expect(onlyNew.totalConnectedLoadCfh.value).toBeLessThan(g.totalConnectedLoadCfh.value);
    expect(onlyNew.notes.join(' ')).toMatch(/if there are existing appliances/i);
  });

  it('adds fitting equivalent length to the measured run before reading any table', () => {
    close(g.developedLength.value, 90); // 70 measured + 20 fittings
    expect(g.developedLength.notes!.join(' ')).toMatch(/never after/i);
  });
});

describe('SAFETY: meter capacity governs and the tool cannot know it', () => {
  it('fails when total connected load exceeds the meter, and says no pipe size fixes it', () => {
    const over = computeGasDemand(gasWith({ meterCapacityCfh: 400 }));
    expect(over.meterCheck.status).toBe('fail');
    expect(over.meterCheck.message).toMatch(/no pipe size fixes this/i);
  });

  it('passes when the load fits the meter', () => {
    expect(computeGasDemand(gasWith({ meterCapacityCfh: 800 })).meterCheck.status).toBe('pass');
  });

  it('reports unknown rather than assuming a meter when none is entered', () => {
    const unknown = computeGasDemand(gasWith({ meterCapacityCfh: undefined }));
    expect(unknown.meterCheck.status).toBe('unknown');
    expect(unknown.meterCheck.message).toMatch(/the tool cannot know it/i);
  });
});

describe('SAFETY: no capacity table, no pipe size', () => {
  it('emits no size when the table is empty — the tables are not built in', () => {
    const noTable = computeGasDemand(gasWith({ capacityTable: [] }));
    expect(noTable.referenceSize.sizeLabel).toBeNull();
    expect(noTable.referenceSize.message).toMatch(/no pipe size is reported/i);
    expect(noTable.referenceSize.message).toMatch(/does not carry them/i);
  });

  it('reports a reference size once a table is entered', () => {
    const withTable = computeGasDemand(
      gasWith({
        capacityTable: [
          { sizeLabel: '1 in', lengthFt: 90, capacityCfh: 400 },
          { sizeLabel: '1 1/4 in', lengthFt: 90, capacityCfh: 820 },
        ],
      }),
    );
    // Needs 455 cfh at 90 ft: 1 in is short, 1 1/4 in carries it.
    expect(withTable.referenceSize.sizeLabel).toBe('1 1/4 in');
    expect(withTable.referenceSize.message).toMatch(/DEDICATED run/);
  });

  it('says so when no size in the table carries the load', () => {
    const tooSmall = computeGasDemand(
      gasWith({ capacityTable: [{ sizeLabel: '1 in', lengthFt: 90, capacityCfh: 400 }] }),
    );
    expect(tooSmall.referenceSize.sizeLabel).toBeNull();
    expect(tooSmall.referenceSize.message).toMatch(/no size in the entered table/i);
  });

  it('warns that CSST is sized on its own tables', () => {
    expect(eq.gas!.notes.join(' ')).toMatch(/CSST is sized on its own manufacturer tables/i);
  });
});

// --- pump selection --------------------------------------------------------

describe('pump selection against the converged system', () => {
  const sel = eq.pump!;

  it('evaluates every catalogued pump', () => {
    expect(sel.candidates).toHaveLength(ALL_PUMP_MODELS.length);
  });

  it('lists a curve-less pump as unevaluable rather than guessing at it', () => {
    const noCurve = sel.candidates.find((c) => c.model.id === 'VSP32815')!;
    expect(noCurve.meetsDesignFlow).toBe(false);
    expect(noCurve.note).toMatch(/no published performance curve/i);
    expect(noCurve.note).toMatch(/not a judgement on the pump/i);
  });

  it('selects a pump that actually makes the head the system needs', () => {
    expect(sel.selected).not.toBeNull();
    expect(sel.selected!.meetsDesignFlow).toBe(true);
    expect(sel.selected!.speedRpm).not.toBeNull();
  });

  it('prefers the smallest pump that does the job, not the biggest', () => {
    const workable = sel.candidates.filter((c) => c.meetsDesignFlow);
    for (const c of workable) {
      expect(sel.selected!.model.totalHp).toBeLessThanOrEqual(c.model.totalHp);
    }
    expect(sel.basis).toMatch(/an oversized pump is what pushes the operating point past/i);
  });

  it('a pump too small for the system is reported as short, with the numbers', () => {
    const tiny = selectPump(hyd, 200, [findPumpModel('SP32900VSPX1')!]);
    expect(tiny.selected).toBeNull();
    expect(tiny.candidates[0]!.note).toMatch(/short of|cannot reach/i);
  });
});

// --- pad -------------------------------------------------------------------

describe('pad layout', () => {
  const pad = eq.pad;

  // (2+2) + (2+2) + (2.5+3) + (1.5+2) = 4 + 4 + 5.5 + 3.5 = 17 ft
  it('pad length sums each item plus its clearance both sides: 17 ft', () => {
    close(pad.padLength.value, 17);
  });

  // max depth + clearance: heater 2.5 + 3 = 5.5 ft
  it('pad depth takes the deepest item plus clearance: 5.5 ft', () => {
    close(pad.padWidth.value, 5.5);
  });

  it('pad area = 17 x 5.5 = 93.5 sf', () => close(pad.padArea.value, 93.5));

  it('counts valves and actuators separately, one actuator per actuated valve', () => {
    close(pad.valveCount.value, 9);
    close(pad.actuatorCount.value, 3);
  });

  it('carries the pump straight-pipe requirement onto the pad', () => {
    expect(pad.notes.join(' ')).toMatch(/straight run of pipe into the suction inlet/i);
  });

  it('says which clearances it is NOT modelling', () => {
    expect(pad.notes.join(' ')).toMatch(/flue, electrical disconnect/i);
  });
});

describe('absent inputs', () => {
  it('returns nothing when the job carries no equipment inputs', () => {
    expect(computeEquipment({ ...STANDARD_MODEL, equipment: undefined }, hyd)).toBeNull();
  });

  it('cannot match a pump without hydraulics, and says so', () => {
    const noHyd: Job = { ...STANDARD_MODEL, hydraulics: undefined };
    const r = computeEquipment(noHyd, null)!;
    expect(r.pump).toBeNull();
    expect(r.notes.join(' ')).toMatch(/no pump can be matched/i);
  });

  it('still lays out the pad without hydraulics', () => {
    const r = computeEquipment({ ...STANDARD_MODEL, hydraulics: undefined }, null)!;
    expect(r.pad.padArea.value).toBeGreaterThan(0);
  });
});

describe('the pad has a real location, and the plumbing has to agree with it', () => {
  it('reports how far the pad sits from the pool', () => {
    expect(eq.pad.distanceFromPool.value).toBe(30);
    expect(eq.pad.notes.join(' ')).toMatch(/but never shorter/i);
  });

  it('accepts runs longer than the straight line, since they route', () => {
    expect(eq.pad.impossibleRuns).toEqual([]);
    const trunk = hyd.runs.find((r) => r.run.role === 'suction-trunk')!;
    expect(trunk.run.lengthFt).toBeGreaterThan(eq.pad.distanceFromPool.value);
  });

  it('fails a run entered shorter than the distance to the pad', () => {
    const short: Job = {
      ...STANDARD_MODEL,
      hydraulics: {
        ...STANDARD_MODEL.hydraulics!,
        runs: STANDARD_MODEL.hydraulics!.runs.map((r) =>
          r.role === 'suction-trunk' ? { ...r, lengthFt: 12 } : r,
        ),
      },
    };
    const h = computeHydraulics(short, computeGeometry(short).totalVolumeGal.value)!;
    const r = computeEquipment(short, h)!;
    expect(r.pad.impossibleRuns).toHaveLength(1);
    expect(r.pad.impossibleRuns[0]).toMatch(/cannot be shorter than the distance to the pad/i);
    expect(r.pad.impossibleRuns[0]).toMatch(/understated/i);
  });
});

describe('the shop-standard gas size is recorded, and checked only when it can be', () => {
  it('records the size but will not call it verified without a table', () => {
    const noTable = computeGasDemand(gasWith({ capacityTable: [] }));
    expect(noTable.intendedSize.label).toBe('1 1/4 in');
    expect(noTable.intendedSize.status).toBe('unverified');
    expect(noTable.intendedSize.message).toMatch(/NOT verified/);
    expect(noTable.intendedSize.message).toMatch(/shop practice is a starting point, not a check/i);
  });

  it('confirms the shop standard when the table carries the load', () => {
    const r = computeGasDemand(
      gasWith({
        connectedLoad: [{ label: 'Heater', btuPerHour: 150000, isNew: true }],
        capacityTable: [{ sizeLabel: '1 1/4 in', lengthFt: 90, capacityCfh: 200 }],
      }),
    );
    expect(r.intendedSize.status).toBe('confirmed');
    expect(r.intendedSize.message).toMatch(/holds on this job/i);
  });

  it('calls out the shop standard when the table says it is too small', () => {
    const r = computeGasDemand(
      gasWith({ capacityTable: [{ sizeLabel: '1 1/4 in', lengthFt: 90, capacityCfh: 200 }] }),
    );
    // 455 cfh of connected load against a 200 cfh row.
    expect(r.intendedSize.status).toBe('too-small');
    expect(r.intendedSize.message).toMatch(/does not hold on this job/i);
    expect(r.intendedSize.message).toMatch(/the case the table exists to catch/i);
  });

  it('says nothing when no shop standard is recorded', () => {
    expect(computeGasDemand(gasWith({ intendedSizeLabel: undefined })).intendedSize.status).toBe('none');
  });
});


describe('the supplied sizing table, against real loads', () => {
  const table = STANDARD_MODEL.equipment!.gas!.capacityTable;

  it('carries every size and length off the sheet', () => {
    expect(table).toHaveLength(65);
    expect(new Set(table.map((r) => r.sizeLabel)).size).toBe(5);
    // Spot-check the highlighted 90 ft row.
    const at90 = table.filter((r) => r.lengthFt === 90);
    expect(at90.find((r) => r.sizeLabel === '1 1/4 in')!.capacityCfh).toBe(320);
    expect(at90.find((r) => r.sizeLabel === '1 1/2 in')!.capacityCfh).toBe(490);
    expect(at90.find((r) => r.sizeLabel === '1/2 in')!.capacityCfh).toBe(40);
  });

  it('capacity falls as the run gets longer, for every size', () => {
    for (const size of new Set(table.map((r) => r.sizeLabel))) {
      const rows = table.filter((r) => r.sizeLabel === size).sort((a, b) => a.lengthFt - b.lengthFt);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i]!.capacityCfh, `${size} at ${rows[i]!.lengthFt} ft`).toBeLessThan(
          rows[i - 1]!.capacityCfh,
        );
      }
    }
  });

  it('THE RECONCILIATION: 1 1/4 in carries a dedicated 250k heater run', () => {
    // 250,000 BTU/hr = 250 cfh. At the 90 ft row, 1 1/4 in carries 320.
    const dedicated = computeGasDemand(
      gasWith({ connectedLoad: [{ label: 'Pool heater', btuPerHour: 250000, isNew: true }] }),
    );
    close(dedicated.totalConnectedLoadCfh.value, 250);
    expect(dedicated.intendedSize.status).toBe('confirmed');
    expect(dedicated.referenceSize.sizeLabel).toBe('1 1/4 in');
    expect(dedicated.meterCheck.status).toBe('pass');
  });

  it('but not once the house appliances share the run', () => {
    // 455 cfh against 320 available at 90 ft.
    expect(eq.gas!.intendedSize.status).toBe('too-small');
    expect(eq.gas!.referenceSize.sizeLabel).toBe('1 1/2 in');
  });

  it('picks the smallest size that carries the load, independent of table row order', () => {
    const rows = [
      { sizeLabel: '1 1/2 in', lengthFt: 90, capacityCfh: 490 },
      { sizeLabel: '1 in', lengthFt: 90, capacityCfh: 160 },
      { sizeLabel: '1 1/4 in', lengthFt: 90, capacityCfh: 320 },
    ];
    const small = computeGasDemand(
      gasWith({
        connectedLoad: [{ label: 'Heater', btuPerHour: 120000, isNew: true }],
        capacityTable: rows,
      }),
    );
    // 120 cfh at 90 ft: 1 in carries 160, so 1 in wins even though 1 1/2 is first.
    expect(small.referenceSize.sizeLabel).toBe('1 in');
  });

  it('fails closed when the developed length is beyond every entered table row', () => {
    const overlong = computeGasDemand(gasWith({ runLengthFt: 1000, fittingEquivalentLengthFt: 0 }));
    expect(overlong.referenceSize.sizeLabel).toBeNull();
    expect(overlong.referenceSize.message).toMatch(/does not extend/i);
    expect(overlong.intendedSize.status).toBe('unverified');
    expect(overlong.intendedSize.message).toMatch(/does not extend/i);
  });
});
