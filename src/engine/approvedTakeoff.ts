import { calc, inp, type Calc } from './calc.ts';
import type { TakeoffResult } from './index.ts';

export type CanonicalQuantityCode =
  | 'pool.water-volume'
  | 'pool.wetted-area'
  | 'pool.waterline-perimeter'
  | 'excavation.bank-volume'
  | 'excavation.loose-volume'
  | 'excavation.spoil-haul-volume'
  | 'shell.gunite-ordered-volume'
  | 'shell.reinforcing-steel-weight'
  | 'shell.forming-perimeter'
  | 'finishes.plaster-net-area'
  | 'finishes.plaster-ordered-area'
  | 'finishes.tile-net-length'
  | 'finishes.tile-ordered-area'
  | 'finishes.coping-ordered-length'
  | 'yard.deck-area'
  | 'plumbing.developed-run-length'
  | 'utilities.bonding-conductor-length';

export interface ExportedAuthoritativeQuantity {
  readonly code: CanonicalQuantityCode;
  readonly value: number;
  readonly unit: string;
  readonly calcId: string;
}

export interface DesignerQuantityPayload {
  readonly quantityModelVersion: 'designer-quantity-v1';
  readonly quantities: readonly ExportedAuthoritativeQuantity[];
  readonly calcLedger: readonly Calc[];
}

export class ApprovedTakeoffExportError extends Error {}

const cloneCalc = (entry: Calc): Calc => ({
  ...entry,
  inputs: entry.inputs.map((input) => ({ ...input })),
  ...(entry.notes ? { notes: [...entry.notes] } : {}),
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

export function exportDesignerQuantityPayload(takeoff: TakeoffResult): DesignerQuantityPayload {
  if (takeoff.hasCodeFailure) {
    throw new ApprovedTakeoffExportError('A takeoff with blocking code or safety failures cannot be exported for approval.');
  }
  if (takeoff.structure.outcome !== 'quantities') {
    throw new ApprovedTakeoffExportError('Approved quantity export requires an in-envelope stored structural detail.');
  }

  const bondingConductorLength = calc({
    id: 'electrical.bonding.conductorLength',
    label: 'Bonding conductor developed length',
    formula: 'LF = P_waterline + LF_offset + LF_jumpers',
    unit: 'lf',
    inputs: [
      inp('P_waterline', 'Waterline perimeter', takeoff.geometry.waterlinePerimeter.value, 'lf'),
      inp('LF_offset', 'Perimeter-offset allowance', 24, 'lf'),
      inp('LF_jumpers', 'Equipment and component jumpers', 100, 'lf'),
    ],
    compute: (values) => values.P_waterline! + values.LF_offset! + values.LF_jumpers!,
    source: 'NEC 680.26 bonding layout basis',
  });

  const measured: Array<readonly [CanonicalQuantityCode, Calc]> = [
    ['pool.water-volume', takeoff.geometry.totalVolumeGal],
    ['pool.wetted-area', takeoff.geometry.totalWettedArea],
    ['pool.waterline-perimeter', takeoff.geometry.waterlinePerimeter],
    ['excavation.bank-volume', takeoff.excavation.totalBankCy],
    ['excavation.loose-volume', takeoff.excavation.totalLooseCy],
    ['excavation.spoil-haul-volume', takeoff.excavation.spoilHaulLooseCy],
    ['shell.gunite-ordered-volume', takeoff.structure.quantities.guniteCy],
    ['shell.reinforcing-steel-weight', takeoff.structure.quantities.barWeight],
    ['shell.forming-perimeter', takeoff.geometry.waterlinePerimeter],
    ['utilities.bonding-conductor-length', bondingConductorLength],
  ];

  if (takeoff.finishes) {
    measured.push(
      ['finishes.plaster-net-area', takeoff.finishes.plasterSf.net],
      ['finishes.plaster-ordered-area', takeoff.finishes.plasterSf.ordered],
      ['finishes.tile-net-length', takeoff.finishes.waterlineTileLf.net],
      ['finishes.tile-ordered-area', takeoff.finishes.waterlineTileSf],
      ['finishes.coping-ordered-length', takeoff.finishes.copingLf.ordered],
    );
  }
  if (takeoff.yard) measured.push(['yard.deck-area', takeoff.yard.deckArea]);
  if (takeoff.job.hydraulics) {
    const runs = takeoff.job.hydraulics.runs;
    const developedRunLength = calc({
      id: 'hyd.runs.developedLength',
      label: 'Developed plumbing run length',
      formula: 'LF = SUM(run layout lengths)',
      unit: 'lf',
      inputs: runs.map((run) => inp(run.id, run.label, run.lengthFt, 'lf')),
      compute: (inputs) => Object.values(inputs).reduce((total, length) => total + length, 0),
      notes: ['Physical layout lengths only. Hydraulic fitting equivalent length is not purchasing footage.'],
    });
    measured.push(['plumbing.developed-run-length', developedRunLength]);
  }

  const ledgerById = new Map<string, Calc>();
  const quantities = measured.map(([code, sourceCalc]) => {
    ledgerById.set(sourceCalc.id, cloneCalc(sourceCalc));
    return { code, value: sourceCalc.value, unit: sourceCalc.unit, calcId: sourceCalc.id };
  });

  return deepFreeze({
    quantityModelVersion: 'designer-quantity-v1',
    quantities,
    calcLedger: [...ledgerById.values()],
  });
}
