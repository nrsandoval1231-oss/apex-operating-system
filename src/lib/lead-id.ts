/**
 * lead-id.ts — the join key generator.
 *
 * Hard rule 2 (CLAUDE.md): `lead_id` is generated ONCE at submission, returned to the
 * client, and travels with the lead everywhere downstream (n8n, CRM, Meta offline
 * conversions). Never regenerate it — see AC-1.3 (unique per submission, not regenerated
 * on retry). This module only mints the id; Phase 3 (the quote form) calls it exactly
 * once per submit and reuses the same value across retries.
 *
 * Format: `apex_<unixSeconds>_<4charBase36>`  e.g. `apex_1721925123_a1b9`
 * (matches the example in docs/data-contract.md).
 */

const RAND_LEN = 4;

/** Generate a 4-char base36 suffix ([0-9a-z]) for uniqueness within a given second. */
function randomSuffix(): string {
  // Prefer crypto for stronger uniqueness; fall back to Math.random where unavailable.
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(RAND_LEN);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  }

  let out = '';
  while (out.length < RAND_LEN) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, RAND_LEN);
}

/**
 * Mint a new lead_id. Call this exactly once per submission and cache the result;
 * do NOT call it again on retry (that would break the downstream join key).
 */
export function generateLeadId(): string {
  const unixSeconds = Math.floor(Date.now() / 1000);
  return `apex_${unixSeconds}_${randomSuffix()}`;
}

/** Validate the shape of a lead_id — used by tests/acceptance checks (AC-1.3). */
export function isLeadId(value: unknown): value is string {
  return typeof value === 'string' && /^apex_\d+_[0-9a-z]{4}$/.test(value);
}
