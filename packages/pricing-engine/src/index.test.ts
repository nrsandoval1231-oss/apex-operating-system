import { describe, expect, it } from 'vitest';
import {
  PRICE_LIBRARY_VERSION,
  MEASURED_LINE_DEFINITIONS,
  priceApprovedTakeoff,
  type DirectPriceInput,
} from './index.js';
import {
  calculateQuantityPayloadSha256,
  createCanonicalId,
  type ApprovedTakeoffRevision,
  type AuthoritativeQuantity,
} from '@apex/contracts';

const facts: AuthoritativeQuantity[] = [
  ['pool.water-volume', 15000, 'gal'],
  ['excavation.bank-volume', 100, 'BCY'],
  ['excavation.spoil-haul-volume', 110, 'LCY'],
  ['shell.gunite-ordered-volume', 40, 'cy'],
  ['shell.reinforcing-steel-weight', 1200, 'lb'],
  ['shell.forming-perimeter', 100, 'ft'],
  ['finishes.plaster-net-area', 900, 'sf'],
  ['finishes.plaster-ordered-area', 920, 'sf'],
  ['finishes.tile-net-length', 100, 'lf'],
  ['finishes.tile-ordered-area', 55, 'sf'],
  ['finishes.coping-ordered-length', 106, 'lf'],
  ['yard.deck-area', 360, 'sf'],
  ['plumbing.developed-run-length', 750, 'lf'],
  ['utilities.bonding-conductor-length', 220, 'lf'],
].map(([code, value, unit]) => ({
  code: code as AuthoritativeQuantity['code'], value: value as number, unit: unit as string,
  calcId: `calc.${String(code).replaceAll('-', '.')}`,
}));

const revision = (): ApprovedTakeoffRevision => ({
  revisionId: createCanonicalId('revision'), leadId: createCanonicalId('lead'), jobId: null,
  revisionNumber: 1, status: 'approved', engineVersion: 'designer-test',
  jobInputSha256: 'a'.repeat(64), calcLedgerSha256: 'b'.repeat(64),
  quantityPayloadSha256: calculateQuantityPayloadSha256(facts),
  quantityModelVersion: 'designer-quantity-v4', createdAt: new Date().toISOString(),
  createdBy: createCanonicalId('user'), approvedAt: new Date().toISOString(),
  approvedBy: createCanonicalId('user'), blockingIssues: [], quantities: facts,
  calcLedger: facts.map((fact) => ({
    id: fact.calcId, label: fact.code, formula: 'fixture', inputs: [], value: fact.value, unit: fact.unit,
  })),
});

const direct: DirectPriceInput[] = ([300, 500, 600, 900, 1100, 1200, 1300] as const).map((code) => ({
  code, name: `Direct ${code}`, scopeStatus: 'not-applicable' as const, amountCents: null,
  basis: 'Explicitly excluded from this scope.',
}));
const measured = MEASURED_LINE_DEFINITIONS.map(([id]) => ({
  id, amountCents: 100_00, basis: 'Approved fixture estimate.',
}));

describe('typed approved-takeoff pricing', () => {
  it('pins every measured line to the approved revision, digest, and model version', () => {
    const priced = priceApprovedTakeoff({ revision: revision(), directLines: direct, measuredLines: measured, feeRateBps: 3000 });
    expect(priced.pricingLibraryVersion).toBe(PRICE_LIBRARY_VERSION);
    expect(priced.canIssue).toBe(true);
    expect(priced.lines.filter((line) => line.quantityAuthority).length).toBeGreaterThan(0);
    for (const line of priced.lines.filter((candidate) => candidate.quantityAuthority)) {
      expect(line.quantityAuthority).toMatchObject({
        revisionId: priced.takeoffRevisionId,
        quantityPayloadSha256: priced.quantityPayloadSha256,
        quantityModelVersion: priced.quantityModelVersion,
      });
    }
  });

  it('fails closed with structured blockers instead of inventing missing direct prices', () => {
    const priced = priceApprovedTakeoff({ revision: revision(), directLines: [], measuredLines: [], feeRateBps: 3000 });
    expect(priced.canIssue).toBe(false);
    expect(priced.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-direct-price', lineCode: 300 }),
      expect.objectContaining({ code: 'missing-direct-price', lineCode: 1300 }),
    ]));
    expect(priced.lines.find((line) => line.code === 300)?.amountCents).toBeNull();
  });

  it('rejects tampered facts and missing canonical pricing quantities', () => {
    const approved = revision();
    expect(() => priceApprovedTakeoff({
      revision: { ...approved, quantities: approved.quantities.slice(1) },
      directLines: direct, measuredLines: measured,
      feeRateBps: 3000,
    })).toThrow(/digest|quantity/i);
  });
});
