import { describe, expect, it } from 'vitest';
import { DRAW_SCHEDULE_TEMPLATE, TOTAL_BASIS_POINTS, type DrawTemplate } from '@apex/contracts';
import { DomainRuleError } from './errors.js';
import { allocateDrawAmounts, drawCodeForGate } from './draws.js';

const total = (cents: number) =>
  allocateDrawAmounts(cents).reduce((sum, draw) => sum + draw.amountCents, 0);

const byCode = (cents: number) =>
  Object.fromEntries(allocateDrawAmounts(cents).map((draw) => [draw.template.code, draw.amountCents]));

describe("Apex's confirmed schedule", () => {
  it('is the 10 / 30 / 30 / 20 / 10 from the contract', () => {
    expect(DRAW_SCHEDULE_TEMPLATE.map((draw) => [draw.code, draw.percentBasisPoints])).toEqual([
      ['deposit', 1000],
      ['draw-1', 3000],
      ['draw-2', 3000],
      ['draw-3', 2000],
      ['draw-final', 1000],
    ]);
  });

  it('accounts for the whole contract and nothing more', () => {
    const sum = DRAW_SCHEDULE_TEMPLATE.reduce((acc, draw) => acc + draw.percentBasisPoints, 0);
    expect(sum).toBe(TOTAL_BASIS_POINTS);
  });

  it('releases the deposit by contract signing, not by a gate', () => {
    const deposit = DRAW_SCHEDULE_TEMPLATE[0]!;
    expect(deposit).toMatchObject({ releaseCondition: 'contract-signed', gateDefinitionKey: null });
  });

  it('binds the other four to the confirmed draw-bearing gates', () => {
    expect(DRAW_SCHEDULE_TEMPLATE.slice(1).map((draw) => draw.gateDefinitionKey))
      .toEqual(['excavation', 'shell', 'deck-tile', 'final']);
    expect(drawCodeForGate('shell')).toBe('draw-2');
    // Pre-gunite, Permit, and Equipment release work, not money.
    expect(drawCodeForGate('pre-gunite')).toBeNull();
    expect(drawCodeForGate('permit')).toBeNull();
  });
});

describe('splitting a contract into draws', () => {
  it('divides a round contract exactly', () => {
    expect(byCode(20_000_000)).toEqual({
      deposit: 2_000_000,
      'draw-1': 6_000_000,
      'draw-2': 6_000_000,
      'draw-3': 4_000_000,
      'draw-final': 2_000_000,
    });
  });

  it('never loses or invents a cent on an awkward total', () => {
    // The real Whitaker customer total, which does not divide evenly.
    expect(total(15_204_173)).toBe(15_204_173);
    for (const cents of [1, 2, 3, 7, 99, 101, 12_345_679, 99_999_999]) {
      expect(total(cents)).toBe(cents);
    }
  });

  it('puts the rounding remainder on the final draw', () => {
    const draws = allocateDrawAmounts(15_204_173);
    expect(draws.map((draw) => draw.amountCents)).toEqual([
      1_520_417, 4_561_251, 4_561_251, 3_040_834, 1_520_420,
    ]);
    // Every draw but the last is a clean floor of its percentage.
    expect(draws[0]?.amountCents).toBe(Math.floor(15_204_173 * 0.1));
    expect(draws[4]?.amountCents).toBeGreaterThan(Math.floor(15_204_173 * 0.1));
  });

  it('handles a zero contract without producing negative money', () => {
    expect(allocateDrawAmounts(0).every((draw) => draw.amountCents === 0)).toBe(true);
  });

  it('returns the draws in schedule order regardless of input order', () => {
    const shuffled = [...DRAW_SCHEDULE_TEMPLATE].reverse();
    expect(allocateDrawAmounts(20_000_000, shuffled).map((draw) => draw.template.code))
      .toEqual(['deposit', 'draw-1', 'draw-2', 'draw-3', 'draw-final']);
  });
});

describe('what the allocator refuses', () => {
  it('refuses a negative or fractional contract', () => {
    expect(() => allocateDrawAmounts(-1)).toThrow(DomainRuleError);
    expect(() => allocateDrawAmounts(10.5)).toThrow(/whole number of cents/i);
  });

  it('refuses a total beyond exact integer arithmetic', () => {
    expect(() => allocateDrawAmounts(Number.MAX_SAFE_INTEGER + 2)).toThrow(DomainRuleError);
  });

  it('refuses a schedule that does not add up to the whole contract', () => {
    const short: DrawTemplate[] = [
      { ...DRAW_SCHEDULE_TEMPLATE[0]!, percentBasisPoints: 1000 },
      { ...DRAW_SCHEDULE_TEMPLATE[1]!, percentBasisPoints: 3000 },
    ];
    expect(() => allocateDrawAmounts(20_000_000, short))
      .toThrow(/must account for the whole contract/i);
  });

  it('refuses an empty schedule', () => {
    expect(() => allocateDrawAmounts(20_000_000, [])).toThrow(DomainRuleError);
  });
});
