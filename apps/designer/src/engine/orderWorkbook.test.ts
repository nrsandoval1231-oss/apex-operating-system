import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildBom } from './bom.ts';
import { runTakeoff } from './index.ts';
import {
  buildOrderWorkbook,
  OrderWorkbookExportError,
  orderWorkbookFileName,
} from './orderWorkbook.ts';
import { SPORTS_POOL, TIGHT_LOT } from './jobs/scenarios.ts';

const metadata = {
  customerName: '=HYPERLINK("bad")',
  projectName: '+Sports / Pool',
  address: '@123 Main',
  opportunityId: '-LEAD-7',
  revision: 4,
  generatedAt: new Date('2026-08-13T12:00:00.000Z'),
};

async function open(bytes: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  return workbook;
}

describe('ordering takeoff workbook', () => {
  it('puts the stable operational sheets in order with Order List active', async () => {
    const workbook = await open(await buildOrderWorkbook(SPORTS_POOL, metadata));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Order List',
      'Project Summary',
      'Excavation',
      'Calculation Reference',
    ]);
    expect(workbook.views[0]?.activeTab).toBe(0);
    expect(workbook.worksheets[0]?.state).toBe('visible');
  });

  it('uses buildBom as the ordering authority', async () => {
    const takeoff = runTakeoff(SPORTS_POOL);
    const bom = buildBom(SPORTS_POOL, takeoff);
    const workbook = await open(await buildOrderWorkbook(SPORTS_POOL, metadata));
    const sheet = workbook.getWorksheet('Order List')!;
    expect(sheet.getRow(1).values).toEqual([
      undefined, 'Category', 'Item', 'Quantity', 'Unit', 'Waste Included', 'Basis', 'Vendor/Notes',
    ]);
    expect(sheet.rowCount - 1).toBe(bom.groups.flatMap((group) => group.lines).length);
    expect(sheet.getCell('A2').value).toBe(bom.groups[0]!.title);
    expect(sheet.getCell('C2').value).toBe(bom.groups[0]!.lines[0]!.quantity);
  });

  it('pins revisions and model versions and sanitizes metadata formula prefixes', async () => {
    const workbook = await open(await buildOrderWorkbook(SPORTS_POOL, metadata));
    const summary = workbook.getWorksheet('Project Summary')!;
    const values = summary.getColumn(2).values.map(String);
    expect(values).toContain("'=HYPERLINK(\"bad\")");
    expect(values).toContain("'+Sports / Pool");
    expect(values).toContain("'@123 Main");
    expect(values).toContain("'-LEAD-7");
    expect(values).toContain('designer-quantity-v5');
    expect(values).toContain('4');
  });

  it('contains concise excavation facts and an auditable calc ledger', async () => {
    const workbook = await open(await buildOrderWorkbook(SPORTS_POOL, metadata));
    const excavation = workbook.getWorksheet('Excavation')!;
    expect(excavation.getColumn(1).values.map(String)).toEqual(expect.arrayContaining([
      'Bank volume', 'Loose haul volume', 'Estimated truck loads',
    ]));
    expect(workbook.getWorksheet('Calculation Reference')!.rowCount).toBeGreaterThan(2);
  });

  it('refuses blocking checks and every missing BOM module', async () => {
    await expect(buildOrderWorkbook(TIGHT_LOT, metadata)).rejects.toBeInstanceOf(OrderWorkbookExportError);
    const incomplete = { ...SPORTS_POOL, hydraulics: undefined };
    await expect(buildOrderWorkbook(incomplete, metadata)).rejects.toMatchObject({
      blockers: expect.arrayContaining([expect.stringContaining('Plumbing')]),
    });
  });

  it('produces a deterministic sanitized filename', () => {
    expect(orderWorkbookFileName(metadata)).toBe('Apex_Sports_Pool_Takeoff_R4.xlsx');
  });
});
