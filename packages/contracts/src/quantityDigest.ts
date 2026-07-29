import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const QUANTITY_PAYLOAD_DIGEST_SCHEMA = 'apex-approved-quantity-payload-v1' as const;

export interface QuantityDigestFact {
  readonly code: string;
  readonly value: number;
  readonly unit: string;
  readonly calcId: string;
}

/**
 * Canonical, order-sensitive bytes for the approved quantity evidence.
 * Tuple encoding prevents object-key order from becoming part of the contract.
 */
export function serializeQuantityPayload(quantities: readonly QuantityDigestFact[]): string {
  quantities.forEach((quantity, index) => {
    if (!Number.isFinite(quantity.value) || quantity.value < 0) {
      throw new TypeError(`Quantity fact ${index} must carry a finite non-negative value.`);
    }
  });
  return JSON.stringify({
    schema: QUANTITY_PAYLOAD_DIGEST_SCHEMA,
    quantities: quantities.map((quantity) => [
      quantity.code,
      quantity.value,
      quantity.unit,
      quantity.calcId,
    ]),
  });
}

export function calculateQuantityPayloadSha256(quantities: readonly QuantityDigestFact[]): string {
  return bytesToHex(sha256(new TextEncoder().encode(serializeQuantityPayload(quantities))));
}
