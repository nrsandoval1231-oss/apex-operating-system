import { describe, expect, it } from 'vitest';
import { buildOrderWorkbook } from './xlsx.js';

describe('canonical order workbook', () => {
  it('creates an XLSX zip with metadata and no formulas', () => {
    const bytes = buildOrderWorkbook({ revisionId: 'revision_test', quantityPayloadSha256: 'a'.repeat(64),
      quantityModelVersion: 'quantity-v4', orderList: [
        { code: 'pool.water-volume', value: 15000, unit: 'gal', calcId: 'pool.volume' },
      ] });
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe('PK');
    const raw = new TextDecoder().decode(bytes);
    expect(raw).toContain('pool.water-volume');
    expect(raw).toContain('revision_test');
    expect(raw).not.toContain('<f>');
  });
});
