import { calculateQuantityPayloadSha256 } from './approved-takeoff.mjs';

const IDS = Object.freeze({
  jobId: 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW',
  revisionId: 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX',
  userId: 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2',
});

const DEFAULT_QUANTITIES = Object.freeze([
  ['pool.water-volume', 15001, 'gal'],
  ['pool.wetted-area', 901, 'sf'],
  ['pool.waterline-perimeter', 101, 'ft'],
  ['excavation.bank-volume', 95.5, 'BCY'],
  ['excavation.loose-volume', 119.4, 'LCY'],
  ['excavation.spoil-haul-volume', 80.2, 'LCY'],
  ['shell.gunite-ordered-volume', 28.4, 'cy'],
  ['shell.reinforcing-steel-weight', 1105, 'lb'],
  ['shell.forming-perimeter', 109, 'ft'],
  ['finishes.plaster-net-area', 901, 'sf'],
  ['finishes.plaster-ordered-area', 946.05, 'sf'],
  ['finishes.tile-net-length', 101, 'lf'],
  ['finishes.tile-ordered-area', 58.075, 'sf'],
  ['finishes.coping-ordered-length', 107.06, 'lf'],
  ['yard.deck-area', 401, 'sf'],
  ['plumbing.developed-run-length', 812, 'lf'],
  ['utilities.bonding-conductor-length', 225, 'lf'],
]);

export function approvedTakeoffFixture(overrides = {}) {
  const values = { ...Object.fromEntries(DEFAULT_QUANTITIES.map(([code, value]) => [code, value])), ...(overrides.values ?? {}) };
  const quantities = DEFAULT_QUANTITIES.map(([code, defaultValue, unit], index) => {
    const value = values[code] ?? defaultValue;
    return { code, value, unit, calcId: `fixture.quantity.${index + 1}` };
  });
  return {
    revisionId: overrides.revisionId ?? IDS.revisionId,
    jobId: overrides.jobId ?? IDS.jobId,
    revisionNumber: 1,
    status: overrides.status ?? 'approved',
    engineVersion: 'designer-0.1.0',
    jobInputSha256: 'a'.repeat(64),
    calcLedgerSha256: 'b'.repeat(64),
    quantityPayloadSha256: calculateQuantityPayloadSha256(quantities),
    quantityModelVersion: 'designer-quantity-v3',
    createdAt: '2026-07-29T12:00:00.000Z',
    createdBy: IDS.userId,
    approvedAt: '2026-07-29T12:05:00.000Z',
    approvedBy: IDS.userId,
    blockingIssues: overrides.blockingIssues ?? [],
    quantities,
    calcLedger: quantities.map((quantity) => ({
      id: quantity.calcId,
      label: quantity.code,
      formula: 'Q = Designer Calc result',
      inputs: [{ symbol: 'Q', label: 'Designer result', value: quantity.value, unit: quantity.unit }],
      value: quantity.value,
      unit: quantity.unit,
    })),
  };
}

export { IDS as APPROVED_TAKEOFF_IDS };
