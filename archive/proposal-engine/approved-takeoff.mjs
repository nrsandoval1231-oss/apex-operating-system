// Not node:crypto — a browser cannot resolve it, and importing it here broke
// every handler on index.html. See sha256.mjs.
import { sha256Hex } from './sha256.mjs';

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

export const AUTHORITATIVE_QUANTITY_UNITS = Object.freeze({
  'pool.water-volume': 'gal',
  'pool.wetted-area': 'sf',
  'pool.waterline-perimeter': 'ft',
  'excavation.bank-volume': 'BCY',
  'excavation.loose-volume': 'LCY',
  'excavation.spoil-haul-volume': 'LCY',
  'shell.gunite-ordered-volume': 'cy',
  'shell.reinforcing-steel-weight': 'lb',
  'shell.forming-perimeter': 'ft',
  'finishes.plaster-net-area': 'sf',
  'finishes.plaster-ordered-area': 'sf',
  'finishes.tile-net-length': 'lf',
  'finishes.tile-ordered-area': 'sf',
  'finishes.coping-ordered-length': 'lf',
  'yard.deck-area': 'sf',
  'plumbing.developed-run-length': 'lf',
  'utilities.bonding-conductor-length': 'lf',
});

const QUANTITY_PAYLOAD_DIGEST_SCHEMA = 'apex-approved-quantity-payload-v1';

export function serializeQuantityPayload(quantities) {
  quantities.forEach((quantity, index) => {
    if (!Number.isFinite(quantity.value) || quantity.value < 0) {
      throw new TypeError(`Quantity fact ${index} must carry a finite non-negative value.`);
    }
  });
  return JSON.stringify({
    schema: QUANTITY_PAYLOAD_DIGEST_SCHEMA,
    quantities: quantities.map((quantity) => [quantity.code, quantity.value, quantity.unit, quantity.calcId]),
  });
}

export function calculateQuantityPayloadSha256(quantities) {
  return sha256Hex(serializeQuantityPayload(quantities));
}

export function calculateStringPayloadSha256(payloadString) {
  return sha256Hex(payloadString);
}

export function readApprovedQuantityAuthority(revision, context = {}) {
  if (revision?.status !== 'approved') {
    throw new Error('Proposal pricing requires an approved Designer takeoff revision.');
  }
  if (context.jobId && revision.jobId !== context.jobId) {
    throw new Error('Proposal and approved Designer takeoff revision must belong to the same job.');
  }
  if (context.currentApprovedRevisionId && revision.revisionId !== context.currentApprovedRevisionId) {
    throw new Error('The supplied Designer takeoff revision is stale or superseded. Reprice from the current approved revision.');
  }
  if (!Array.isArray(revision.blockingIssues) || revision.blockingIssues.length > 0) {
    throw new Error('An approved Designer takeoff revision cannot carry unresolved blocking issues.');
  }
  if (!Array.isArray(revision.quantities)) throw new Error('Approved Designer quantities are required.');
  if (!Array.isArray(revision.calcLedger)) throw new Error('The Designer Calc ledger is required.');
  const calcById = new Map(revision.calcLedger.map((entry) => [entry.id, entry]));
  const byCode = new Map();
  for (const quantity of revision.quantities) {
    if (byCode.has(quantity.code)) throw new Error(`Duplicate authoritative quantity code: ${quantity.code}`);
    const expectedUnit = AUTHORITATIVE_QUANTITY_UNITS[quantity.code];
    if (!expectedUnit) throw new Error(`Unsupported authoritative quantity code: ${quantity.code}`);
    if (quantity.unit !== expectedUnit) {
      throw new Error(`${quantity.code} must use ${expectedUnit}, received ${quantity.unit}`);
    }
    const calcEntry = calcById.get(quantity.calcId);
    if (!calcEntry || calcEntry.value !== quantity.value || calcEntry.unit !== quantity.unit) {
      throw new Error(`${quantity.code} must equal its referenced Designer Calc result.`);
    }
    byCode.set(quantity.code, quantity);
  }
  if (!/^[a-f0-9]{64}$/.test(revision.quantityPayloadSha256 ?? '')
      || revision.quantityPayloadSha256 !== calculateQuantityPayloadSha256(revision.quantities)) {
    throw new Error('Approved Designer quantity payload SHA-256 does not match its ordered quantity facts.');
  }
  return deepFreeze({
    revisionId: revision.revisionId,
    jobId: revision.jobId,
    quantityModelVersion: revision.quantityModelVersion,
    quantityPayloadSha256: revision.quantityPayloadSha256,
    get(code) {
      const quantity = byCode.get(code);
      if (!quantity) throw new Error(`Approved Designer revision is missing required quantity: ${code}`);
      return quantity;
    },
  });
}
