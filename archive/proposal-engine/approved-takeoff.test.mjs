import assert from 'node:assert/strict';
import { calculateQuantityPayloadSha256, readApprovedQuantityAuthority } from './approved-takeoff.mjs';

const jobId = 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const revisionId = 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX';

const revision = {
  revisionId,
  jobId,
  revisionNumber: 1,
  status: 'approved',
  engineVersion: 'designer-0.1.0',
  jobInputSha256: 'a'.repeat(64),
  calcLedgerSha256: 'b'.repeat(64),
  quantityPayloadSha256: '64a55c9b111bcacea62601aa6a93626a8b0717063ff402d3bb3be62bca99c50d',
  quantityModelVersion: 'designer-quantity-v1',
  createdAt: '2026-07-29T12:00:00.000Z',
  createdBy: 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2',
  approvedAt: '2026-07-29T12:05:00.000Z',
  approvedBy: 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2',
  blockingIssues: [],
  quantities: [
    { code: 'pool.water-volume', value: 12881, unit: 'gal', calcId: 'geom.total.volumeGal' },
  ],
  calcLedger: [
    {
      id: 'geom.total.volumeGal',
      label: 'Total water volume',
      formula: 'V_gal = V_cf x 7.48052',
      inputs: [{ symbol: 'V_cf', label: 'Total water volume', value: 1721.94, unit: 'cf' }],
      value: 12881,
      unit: 'gal',
    },
  ],
};

const authority = readApprovedQuantityAuthority(revision, {
  jobId,
  currentApprovedRevisionId: revisionId,
});
assert.equal(authority.get('pool.water-volume').value, 12881);
assert.equal(authority.revisionId, revisionId);
assert.equal(authority.quantityPayloadSha256, revision.quantityPayloadSha256);
assert.equal(Object.isFrozen(authority), true);
assert.equal(calculateQuantityPayloadSha256(revision.quantities), revision.quantityPayloadSha256);
assert.throws(
  () => calculateQuantityPayloadSha256([{ ...revision.quantities[0], value: Number.POSITIVE_INFINITY }]),
  /finite non-negative/i,
);
assert.throws(() => authority.get('pool.wetted-area'), /missing required/i);

assert.throws(
  () => readApprovedQuantityAuthority({ ...revision, status: 'draft' }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /approved/i,
);

assert.throws(
  () => readApprovedQuantityAuthority(revision, {
    jobId: 'job_01ARZ3NDEKTSV4RRFFQ69G5FB3',
    currentApprovedRevisionId: revisionId,
  }),
  /same job/i,
);

assert.throws(
  () => readApprovedQuantityAuthority(revision, {
    jobId,
    currentApprovedRevisionId: 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAY',
  }),
  /stale|superseded/i,
);

assert.throws(
  () => readApprovedQuantityAuthority({ ...revision, blockingIssues: ['gas-meter-capacity'] }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /blocking/i,
);

assert.throws(
  () => readApprovedQuantityAuthority({ ...revision, quantityPayloadSha256: 'c'.repeat(64) }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /quantity payload.*SHA-256|digest/i,
);

const secondQuantity = {
  code: 'pool.waterline-perimeter',
  value: 100,
  unit: 'ft',
  calcId: 'geom.total.waterlinePerimeter',
};
const secondCalc = {
  id: secondQuantity.calcId,
  label: 'Total waterline perimeter',
  formula: 'P = P_pool + P_spa',
  inputs: [],
  value: secondQuantity.value,
  unit: secondQuantity.unit,
};
const twoQuantityRevision = {
  ...revision,
  quantities: [...revision.quantities, secondQuantity],
  calcLedger: [...revision.calcLedger, secondCalc],
};
twoQuantityRevision.quantityPayloadSha256 = calculateQuantityPayloadSha256(twoQuantityRevision.quantities);
readApprovedQuantityAuthority(twoQuantityRevision, { jobId, currentApprovedRevisionId: revisionId });
assert.throws(
  () => readApprovedQuantityAuthority({
    ...twoQuantityRevision,
    quantities: [...twoQuantityRevision.quantities].reverse(),
  }, { jobId, currentApprovedRevisionId: revisionId }),
  /quantity payload.*SHA-256/i,
);
assert.throws(
  () => readApprovedQuantityAuthority({
    ...twoQuantityRevision,
    quantities: twoQuantityRevision.quantities.slice(0, 1),
  }, { jobId, currentApprovedRevisionId: revisionId }),
  /quantity payload.*SHA-256/i,
);
assert.throws(
  () => readApprovedQuantityAuthority({
    ...twoQuantityRevision,
    quantities: [twoQuantityRevision.quantities[0], { ...secondQuantity, value: 101 }],
    calcLedger: [twoQuantityRevision.calcLedger[0], { ...secondCalc, value: 101 }],
  }, { jobId, currentApprovedRevisionId: revisionId }),
  /quantity payload.*SHA-256/i,
);

assert.throws(
  () => readApprovedQuantityAuthority({
    ...revision,
    quantities: [revision.quantities[0], { ...revision.quantities[0] }],
  }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /duplicate/i,
);

assert.throws(
  () => readApprovedQuantityAuthority({
    ...revision,
    quantities: [{ ...revision.quantities[0], unit: 'sf' }],
  }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /must use gal/i,
);

assert.throws(
  () => readApprovedQuantityAuthority({
    ...revision,
    quantities: [{ ...revision.quantities[0], value: 99999 }],
  }, {
    jobId,
    currentApprovedRevisionId: revisionId,
  }),
  /Calc result/i,
);

console.log('approved quantity authority and digest verification passed');
