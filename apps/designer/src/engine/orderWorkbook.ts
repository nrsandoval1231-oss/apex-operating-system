import type ExcelJS from 'exceljs';
import { buildBom } from './bom.ts';
import { exportDesignerQuantityPayload } from './approvedTakeoff.ts';
import { runTakeoff, type TakeoffResult } from './index.ts';
import { depthStations } from './profile.ts';
import type { Job } from './types.ts';

export interface OrderWorkbookMetadata {
  readonly customerName?: string;
  readonly projectName?: string;
  readonly address?: string;
  readonly opportunityId?: string;
  readonly revision: number;
  readonly generatedAt?: Date;
}

export class OrderWorkbookExportError extends Error {
  constructor(readonly blockers: readonly string[]) {
    super(`Takeoff workbook blocked:\n${blockers.map((blocker) => `- ${blocker}`).join('\n')}`);
  }
}

export const sanitizeWorkbookText = (value: string): string =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

const safe = (value: string | number | boolean): string | number | boolean =>
  typeof value === 'string' ? sanitizeWorkbookText(value) : value;

export function workbookBlockers(job: Job, takeoff: TakeoffResult): string[] {
  const blockers = takeoff.codeFailureAreas.map((area) => `Blocking ${area} check failed.`);
  const bom = buildBom(job, takeoff);
  blockers.push(...bom.missing);
  if (bom.groups.length === 0) blockers.push('Order list has no material groups.');
  for (const group of bom.groups) {
    if (group.lines.length === 0) blockers.push(`${group.title}: no ordering lines were produced.`);
  }
  return blockers;
}

export function orderWorkbookFileName(metadata: OrderWorkbookMetadata): string {
  const source = metadata.projectName || metadata.customerName || metadata.opportunityId || 'Project';
  const slug = source.replace(/^[=+\-@]+/, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'Project';
  return `Apex_${slug}_Takeoff_R${metadata.revision}.xlsx`;
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF292B2E' } };
  row.alignment = { vertical: 'middle' };
}

export async function buildOrderWorkbook(
  job: Job,
  metadata: OrderWorkbookMetadata,
): Promise<Uint8Array> {
  const takeoff = runTakeoff(job);
  const blockers = workbookBlockers(job, takeoff);
  if (blockers.length > 0) throw new OrderWorkbookExportError(blockers);

  const bom = buildBom(job, takeoff);
  const payload = exportDesignerQuantityPayload(takeoff);
  const generatedAt = metadata.generatedAt ?? new Date();
  const { default: ExcelJSRuntime } = await import('exceljs');
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = 'Apex Designer';
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.views = [{ x: 0, y: 0, width: 12000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

  const order = workbook.addWorksheet('Order List', { views: [{ state: 'frozen', ySplit: 1 }] });
  order.addRow(['Category', 'Item', 'Quantity', 'Unit', 'Waste Included', 'Basis', 'Vendor/Notes']);
  styleHeader(order.getRow(1));
  for (const group of bom.groups) {
    for (const line of group.lines) {
      order.addRow([
        safe(group.title), safe(line.item), line.quantity, safe(line.unit), line.includesWaste ? 'Yes' : 'No',
        safe(line.basis), '',
      ]);
    }
  }
  order.columns = [22, 45, 14, 12, 17, 52, 34].map((width) => ({ width }));
  order.autoFilter = { from: 'A1', to: `G${order.rowCount}` };

  const summary = workbook.addWorksheet('Project Summary');
  summary.addRow(['Field', 'Value']);
  styleHeader(summary.getRow(1));
  const stations = depthStations(job.pool.profile);
  const summaryRows: Array<[string, string | number]> = [
    ['Customer', metadata.customerName ?? 'Not provided'],
    ['Project', metadata.projectName ?? job.name],
    ['Address', metadata.address ?? 'Not provided'],
    ['Opportunity', metadata.opportunityId ?? 'Not provided'],
    ['Revision', metadata.revision],
    ['Generated', generatedAt.toISOString()],
    ['Dimensions', `${job.pool.widthFt} ft × ${job.pool.lengthFt} ft`],
    ['Depth profile', stations.map((station) => `${station.stationFt} ft: ${station.depthFt} ft`).join(' | ')],
    ['Quantity model version', payload.quantityModelVersion],
    ['Engine version', 'apex-designer-0.1.0'],
  ];
  summaryRows.forEach(([field, value]) => summary.addRow([field, safe(value)]));
  summary.columns = [{ width: 28 }, { width: 90 }];

  const excavation = workbook.addWorksheet('Excavation');
  excavation.addRow(['Excavation fact', 'Quantity', 'Unit', 'Basis / assumption']);
  styleHeader(excavation.getRow(1));
  const x = takeoff.excavation;
  excavation.addRows([
    ['Bank volume', x.totalBankCy.value, 'BCY', 'Cut to the over-dig line'],
    ['Loose haul volume', x.spoilHaulLooseCy.value, 'LCY', 'After layer-specific swell and backfill balance'],
    ['Estimated truck loads', x.truckCount.value, 'loads', `${job.excavation.truckCapacityLcy} LCY truck; rounds up`],
    ['Assumptions status', 'Confirm before ordering', '', 'Soil layers and swell factors remain field assumptions'],
  ]);
  excavation.columns = [{ width: 28 }, { width: 22 }, { width: 14 }, { width: 72 }];

  const reference = workbook.addWorksheet('Calculation Reference');
  reference.addRow(['Calc ID', 'Label', 'Value', 'Unit', 'Formula', 'Inputs', 'Notes']);
  styleHeader(reference.getRow(1));
  for (const calc of payload.calcLedger) {
    reference.addRow([
      safe(calc.id), safe(calc.label), calc.value, safe(calc.unit), safe(calc.formula),
      safe(calc.inputs.map((input) => `${input.symbol}=${input.value} ${input.unit}`).join('; ')),
      safe(calc.notes?.join('; ') ?? ''),
    ]);
  }
  reference.columns = [34, 42, 16, 12, 56, 70, 70].map((width) => ({ width }));

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}
