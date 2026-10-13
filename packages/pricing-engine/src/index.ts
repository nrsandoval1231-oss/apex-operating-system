import {
  ApprovedTakeoffRevisionSchema,
  calculateQuantityPayloadSha256,
  type ApprovedTakeoffRevision,
  type AuthoritativeQuantityCode,
} from '@apex/contracts';

/** Pricing is entered from an approved estimate; this package has no inferred rate card. */
export const PRICE_LIBRARY_VERSION = 'manual-approved-pricing-v1';

export const DIRECT_LINE_DEFINITIONS = [
  { code: 300, name: 'Pool Equipment' },
  { code: 500, name: 'Utilities - Plumber & Electrician' },
  { code: 600, name: 'Lights' },
  { code: 900, name: 'Cover' },
  { code: 1100, name: 'Water Features' },
  { code: 1200, name: 'Automation' },
  { code: 1300, name: 'Additional Upgrades' },
] as const;

export type DirectLineCode = (typeof DIRECT_LINE_DEFINITIONS)[number]['code'];
export interface DirectPriceInput {
  readonly code: DirectLineCode;
  readonly name: string;
  readonly scopeStatus: 'quoted' | 'not-applicable' | 'unresolved';
  readonly amountCents: number | null;
  readonly basis: string;
}

export interface MeasuredPriceInput {
  readonly id: string;
  readonly amountCents: number | null;
  readonly basis: string;
}

export interface PricingBlocker {
  readonly code: 'missing-direct-price' | 'missing-measured-price' | 'missing-canonical-quantity';
  readonly message: string;
  readonly lineCode?: number;
  readonly quantityCode?: AuthoritativeQuantityCode;
}

interface QuantityAuthority {
  readonly revisionId: string;
  readonly quantityPayloadSha256: string;
  readonly quantityModelVersion: string;
  readonly code: AuthoritativeQuantityCode;
  readonly value: number;
  readonly unit: string;
  readonly calcId: string;
}

export interface PricedLine {
  readonly code: number;
  readonly name: string;
  readonly quantity: number | null;
  readonly unit: string | null;
  readonly amountCents: number | null;
  readonly scopeStatus?: 'quoted' | 'not-applicable' | 'unresolved';
  readonly quantityAuthority?: QuantityAuthority;
}

export interface PricedTakeoff {
  readonly takeoffRevisionId: string;
  readonly quantityPayloadSha256: string;
  readonly quantityModelVersion: string;
  readonly pricingLibraryVersion: typeof PRICE_LIBRARY_VERSION;
  readonly lines: readonly PricedLine[];
  readonly directCostCents: number;
  readonly feeRateBps: number;
  readonly feeCents: number;
  readonly totalCents: number;
  readonly blockers: readonly PricingBlocker[];
  readonly canIssue: boolean;
}

export const MEASURED_LINE_DEFINITIONS = [
  ['excavation-bank', 200, 'Excavation', 'excavation.bank-volume', 'BCY'],
  ['excavation-haul', 200, 'Excavation - Site Work & Haul-off', 'excavation.spoil-haul-volume', 'LCY'],
  ['shell-rebar', 400, 'Pool Shell - Rebar', 'shell.reinforcing-steel-weight', 'lb'],
  ['shell-forming', 400, 'Pool Shell - Forming', 'shell.forming-perimeter', 'ft'],
  ['shell-gunite', 400, 'Pool Shell - Gunite', 'shell.gunite-ordered-volume', 'cy'],
  ['finish-tile-material', 800, 'Pool Finishes - Tile / Materials', 'finishes.tile-ordered-area', 'sf'],
  ['finish-tile-labor', 800, 'Pool Finishes - Tile / Labor', 'finishes.tile-net-length', 'lf'],
  ['finish-coping-material', 800, 'Pool Finishes - Coping / Materials', 'finishes.coping-ordered-length', 'lf'],
  ['finish-coping-labor', 800, 'Pool Finishes - Coping / Labor', 'finishes.coping-ordered-length', 'lf'],
  ['finish-plaster-material', 800, 'Pool Finishes - Plaster / Materials', 'finishes.plaster-ordered-area', 'sf'],
  ['finish-plaster-labor', 800, 'Pool Finishes - Plaster / Labor', 'finishes.plaster-net-area', 'sf'],
  ['utilities-bonding', 500, 'Utilities - Bonding', 'utilities.bonding-conductor-length', 'lf'],
  ['deck-decorative-concrete', 1000, 'Pool Deck - Decorative Concrete', 'yard.deck-area', 'sf'],
  ['pool-plumbing', 700, 'Pool Plumbing', 'plumbing.developed-run-length', 'lf'],
] as const satisfies readonly (readonly [string, number, string, AuthoritativeQuantityCode, string])[];

export function priceApprovedTakeoff(input: {
  readonly revision: ApprovedTakeoffRevision;
  readonly directLines: readonly DirectPriceInput[];
  readonly measuredLines: readonly MeasuredPriceInput[];
  readonly feeRateBps: number;
}): PricedTakeoff {
  const revision = ApprovedTakeoffRevisionSchema.parse(input.revision);
  if (calculateQuantityPayloadSha256(revision.quantities) !== revision.quantityPayloadSha256) {
    throw new Error('Approved quantity digest does not match its canonical facts.');
  }
  if (!Number.isInteger(input.feeRateBps) || input.feeRateBps < 0 || input.feeRateBps > 10000) {
    throw new Error('feeRateBps must be an integer from 0 through 10000.');
  }

  const quantities = new Map(revision.quantities.map((fact) => [fact.code, fact] as const));
  const blockers: PricingBlocker[] = [];
  const measured: PricedLine[] = [];
  const suppliedMeasured = new Map(input.measuredLines.map((line) => [line.id, line] as const));
  for (const [id, code, name, quantityCode, unit] of MEASURED_LINE_DEFINITIONS) {
    const fact = quantities.get(quantityCode);
    if (!fact) {
      blockers.push({ code: 'missing-canonical-quantity', quantityCode,
        message: `Approved takeoff is missing ${quantityCode}; no price was inferred.` });
      continue;
    }
    const quote = suppliedMeasured.get(id);
    const amountCents = quote?.amountCents;
    const validEstimate = quote !== undefined && typeof amountCents === 'number'
      && Number.isSafeInteger(amountCents) && amountCents >= 0 && quote.basis.trim().length > 0;
    if (!validEstimate) {
      blockers.push({ code: 'missing-measured-price', lineCode: code,
        message: `${name} needs an approved estimate; no price was inferred from quantities.` });
    }
    measured.push({
      code, name, quantity: fact.value, unit,
      amountCents: validEstimate && typeof amountCents === 'number' ? amountCents : null,
      quantityAuthority: {
        revisionId: revision.revisionId,
        quantityPayloadSha256: revision.quantityPayloadSha256,
        quantityModelVersion: revision.quantityModelVersion,
        code: fact.code, value: fact.value, unit: fact.unit, calcId: fact.calcId,
      },
    });
  }

  const supplied = new Map(input.directLines.map((line) => [line.code, line] as const));
  const direct = DIRECT_LINE_DEFINITIONS.map((definition): PricedLine => {
    const line = supplied.get(definition.code);
    const validQuote = line?.scopeStatus === 'quoted'
      && line.amountCents !== null && Number.isSafeInteger(line.amountCents) && line.amountCents > 0;
    const excluded = line?.scopeStatus === 'not-applicable'
      && (line.amountCents === null || line.amountCents === 0);
    if (!validQuote && !excluded) {
      blockers.push({ code: 'missing-direct-price', lineCode: definition.code,
        message: `${definition.name} needs a real quote or an explicit not-applicable decision.` });
    }
    return { code: definition.code, name: line?.name.trim() || definition.name,
      quantity: null, unit: null,
      amountCents: validQuote ? line.amountCents : excluded ? 0 : null,
      ...(line ? { scopeStatus: line.scopeStatus } : {}),
    };
  });
  const lines = [...measured, ...direct];
  const directCostCents = lines.reduce((sum, line) => sum + (line.amountCents ?? 0), 0);
  const feeCents = Math.round(directCostCents * input.feeRateBps / 10000);
  return {
    takeoffRevisionId: revision.revisionId,
    quantityPayloadSha256: revision.quantityPayloadSha256,
    quantityModelVersion: revision.quantityModelVersion,
    pricingLibraryVersion: PRICE_LIBRARY_VERSION,
    lines, directCostCents, feeRateBps: input.feeRateBps, feeCents,
    totalCents: directCostCents + feeCents,
    blockers, canIssue: blockers.length === 0,
  };
}
