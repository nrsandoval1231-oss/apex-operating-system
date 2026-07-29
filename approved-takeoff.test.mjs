import assert from 'node:assert/strict';
import { readApprovedQuantityAuthority } from './approved-takeoff.mjs';

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
assert.equal(Object.isFrozen(authority), true);
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

console.log('9 pass / 0 fail');
