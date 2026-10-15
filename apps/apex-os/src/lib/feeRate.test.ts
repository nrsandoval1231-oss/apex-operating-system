import { describe, expect, it } from 'vitest';
import { parseFeeRateBps } from './feeRate.js';

describe('approved fee entry', () => {
  it.each(['', ' ', '\t'])('refuses an unrecorded fee %j', (raw) => {
    expect(() => parseFeeRateBps(raw)).toThrow(/enter the approved fee/i);
  });

  it('accepts an explicit zero fee', () => {
    expect(parseFeeRateBps('0')).toBe(0);
  });
});
