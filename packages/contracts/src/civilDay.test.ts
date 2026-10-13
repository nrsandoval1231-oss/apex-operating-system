import { describe, expect, it } from 'vitest';
import { civilDay } from './civilDay.js';

describe('civilDay', () => {
  it('uses America/Chicago rather than the UTC date', () => {
    // 03:00 UTC on 3 Oct is still 22:00 the previous evening in Central time.
    expect(civilDay(new Date('2026-10-03T03:00:00.000Z'))).toBe('2026-10-02');
    // Midnight Central (CDT, UTC-5) is the new local day.
    expect(civilDay(new Date('2026-10-03T05:00:00.000Z'))).toBe('2026-10-03');
  });
});
