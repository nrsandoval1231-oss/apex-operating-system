import { describe, expect, it } from 'vitest';
import { exportDesignerQuantityPayload, runTakeoff } from './index.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

const safeStandardJob = (): Job => ({
  ...STANDARD_MODEL,
  equipment: undefined,
});

describe('approved quantity export boundary', () => {
  it('exports Designer-owned quantities with their exact Calc provenance', () => {
    const takeoff = runTakeoff(safeStandardJob());
    expect(takeoff.hasCodeFailure).toBe(false);

    const payload = exportDesignerQuantityPayload(takeoff);
    const byCode = new Map(payload.quantities.map((quantity) => [quantity.code, quantity]));

    expect(byCode.get('pool.water-volume')?.value).toBe(takeoff.geometry.totalVolumeGal.value);
    expect(byCode.get('excavation.bank-volume')?.value).toBe(takeoff.excavation.totalBankCy.value);
    expect(byCode.get('shell.gunite-ordered-volume')?.value).toBe(
      takeoff.structure.outcome === 'quantities' ? takeoff.structure.quantities.guniteCy.value : -1,
    );
    expect(byCode.get('shell.reinforcing-steel-weight')?.value).toBe(
      takeoff.structure.outcome === 'quantities' ? takeoff.structure.quantities.barWeight.value : -1,
    );
    expect(byCode.get('finishes.plaster-net-area')?.value).toBe(takeoff.finishes?.plasterSf.net.value);
    expect(byCode.get('yard.deck-area')?.value).toBe(takeoff.yard?.deckArea.value);
    expect(byCode.get('plumbing.developed-run-length')?.value).toBe(
      safeStandardJob().hydraulics?.runs.reduce((total, run) => total + run.lengthFt, 0),
    );
    expect(byCode.get('utilities.bonding-conductor-length')).toMatchObject({
      value: takeoff.geometry.waterlinePerimeter.value + 124,
      unit: 'lf',
    });
    expect(payload.quantities).toHaveLength(17);

    for (const quantity of payload.quantities) {
      const calcEntry = payload.calcLedger.find((entry) => entry.id === quantity.calcId);
      expect(calcEntry).toMatchObject({ value: quantity.value, unit: quantity.unit });
    }
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.quantities)).toBe(true);
  });

  it('refuses to export a takeoff carrying any blocking code or safety failure', () => {
    const unsafeTakeoff = runTakeoff(STANDARD_MODEL);
    expect(unsafeTakeoff.hasCodeFailure).toBe(true);

    expect(() => exportDesignerQuantityPayload(unsafeTakeoff)).toThrow(/code or safety/i);
  });
});
