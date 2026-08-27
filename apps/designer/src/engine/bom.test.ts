/**
 * Bill of materials.
 *
 * The BOM is what gets ordered from, so the risk is not a wrong number — the
 * engine's own tests cover those — it is a line quietly going missing. These
 * check that a refusing module is named rather than dropped.
 */

import { describe, expect, it } from 'vitest';
import { buildBom } from './bom.ts';
import { runTakeoff } from './index.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import { APEX_STANDARD_DETAIL } from './standardDetail.ts';
import { LUBBOCK_12X24 } from './jobs/lubbockStandards.ts';
import type { Job } from './types.ts';

const bom = buildBom(STANDARD_MODEL, runTakeoff(STANDARD_MODEL, [APEX_STANDARD_DETAIL]));
const line = (item: RegExp) => bom.groups.flatMap((g) => g.lines).find((l) => item.test(l.item));

describe('what a builder orders', () => {
  it('gives rebar as a length and as stock bars', () => {
    const rebar = line(/rebar$/);
    expect(rebar?.item).toBe('#3 rebar');
    expect(rebar?.unit).toBe('ft');
    expect(rebar!.quantity).toBeGreaterThan(0);
    expect(line(/stock bars/)!.quantity).toBeGreaterThan(0);
  });

  it('counts the plumbing the way it is installed', () => {
    // The standard model carries two skimmers, four returns and two outlets.
    expect(line(/^Skimmers/)!.quantity).toBe(2);
    expect(line(/^Return inlets/)!.quantity).toBe(4);
    expect(line(/^Suction outlets/)!.quantity).toBe(2);
  });

  it('names the actual pump rather than a horsepower guess', () => {
    const pump = line(/^Pump/);
    expect(pump?.item).toMatch(/hp/);
    expect(pump?.quantity).toBe(1);
  });

  it('groups pipe by the size the engine selected', () => {
    const pipe = bom.groups.flatMap((g) => g.lines).filter((l) => /PVC pipe$/.test(l.item));
    expect(pipe.length).toBeGreaterThan(0);
    // Every run's length lands in exactly one size bucket.
    const total = pipe.reduce((sum, l) => sum + l.quantity, 0);
    const runs = STANDARD_MODEL.hydraulics!.runs.reduce((sum, r) => sum + r.lengthFt, 0);
    expect(total).toBe(runs);
  });

  it('marks the figures that already carry waste', () => {
    expect(line(/^Gunite/)?.includesWaste).toBe(true);
    expect(line(/^Plaster/)?.includesWaste).toBe(true);
    // A count of pieces is not a waste-bearing quantity.
    expect(line(/^Coping pieces/)?.includesWaste).toBeUndefined();
  });

  it('rounds truck loads up, because half a load is a load', () => {
    const loads = line(/^Truck loads/)!;
    expect(Number.isInteger(loads.quantity)).toBe(true);
    expect(loads.quantity).toBeGreaterThanOrEqual(
      Math.ceil(
        runTakeoff(STANDARD_MODEL, [APEX_STANDARD_DETAIL]).excavation.spoilHaulLooseCy.value
        / STANDARD_MODEL.excavation.truckCapacityLcy,
      ),
    );
  });
});

describe('what it refuses to invent', () => {
  it('names the shell as missing when no detail is stored, rather than dropping it', () => {
    const none = buildBom(STANDARD_MODEL, runTakeoff(STANDARD_MODEL, []));
    expect(none.groups.some((g) => g.title === 'Shell')).toBe(false);
    expect(none.missing.join(' ')).toMatch(/no standard detail/i);
  });

  it('names plumbing as missing when the job has no hydraulics', () => {
    const dry: Job = { ...STANDARD_MODEL, hydraulics: undefined };
    const result = buildBom(dry, runTakeoff(dry, [APEX_STANDARD_DETAIL]));
    expect(result.groups.some((g) => g.title === 'Plumbing')).toBe(false);
    expect(result.missing.join(' ')).toMatch(/no hydraulics/i);
  });

  it('says nothing is missing on a complete job', () => {
    expect(bom.missing).toEqual([]);
  });
});


describe('water features', () => {
  const preset = buildBom(LUBBOCK_12X24, runTakeoff(LUBBOCK_12X24, [APEX_STANDARD_DETAIL]));
  const find = (item: RegExp) => preset.groups.flatMap((g) => g.lines).find((l) => item.test(l.item));

  it('gives every spa its six wall jets', () => {
    expect(find(/^Spa jets/)?.quantity).toBe(6);
  });

  it('plumbs the spa as its own body of water', () => {
    // A spa needs a suction and a return of its own, not just a jet supply.
    const runs = LUBBOCK_12X24.hydraulics!.runs.map((r) => r.id);
    expect(runs).toContain('SPA-SUCTION');
    expect(runs).toContain('SPA-RETURN');
    // The preset therefore carries one more return than the base fixture.
    expect(find(/^Return inlets/)!.quantity).toBe(5);
  });

  it('counts bubblers and deck jets only when the job has them', () => {
    expect(find(/^Bubblers/)).toBeUndefined();
    const withFeatures: Job = {
      ...LUBBOCK_12X24,
      pool: {
        ...LUBBOCK_12X24.pool,
        accessories: [
          { id: 'BB1', kind: 'bubbler' },
          { id: 'BB2', kind: 'bubbler' },
          { id: 'DJ1', kind: 'deck-jet' },
        ],
      },
    };
    const bom2 = buildBom(withFeatures, runTakeoff(withFeatures, [APEX_STANDARD_DETAIL]));
    const line2 = (item: RegExp) => bom2.groups.flatMap((g) => g.lines).find((l) => item.test(l.item));
    expect(line2(/^Bubblers/)?.quantity).toBe(2);
    expect(line2(/^Deck jets/)?.quantity).toBe(1);
  });

  it('drops the spa jet line with the spa', () => {
    const noSpa: Job = { ...LUBBOCK_12X24, spa: undefined };
    const bom3 = buildBom(noSpa, runTakeoff(noSpa, [APEX_STANDARD_DETAIL]));
    expect(bom3.groups.flatMap((g) => g.lines).some((l) => /^Spa jets/.test(l.item))).toBe(false);
  });
});
