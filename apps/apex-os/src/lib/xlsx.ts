import type { AuthoritativeQuantity } from '@apex/contracts';

interface WorkbookInput {
  readonly revisionId: string;
  readonly quantityPayloadSha256: string;
  readonly quantityModelVersion: string;
  readonly orderList: readonly AuthoritativeQuantity[];
}

const encoder = new TextEncoder();
const xml = (value: string | number): string => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const cell = (ref: string, value: string | number): string => typeof value === 'number'
  ? `<c r="${ref}"><v>${value}</v></c>`
  : `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (view: DataView, offset: number, value: number) => view.setUint16(offset, value, true);
const u32 = (view: DataView, offset: number, value: number) => view.setUint32(offset, value, true);
const join = (chunks: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
};

const zip = (files: readonly { name: string; content: string }[]): Uint8Array => {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    u32(view, 0, 0x04034b50); u16(view, 4, 20); u16(view, 6, 0); u16(view, 8, 0);
    u16(view, 10, 0); u16(view, 12, 0); u32(view, 14, crc); u32(view, 18, data.length);
    u32(view, 22, data.length); u16(view, 26, name.length); u16(view, 28, 0); header.set(name, 30);
    local.push(header, data);

    const directory = new Uint8Array(46 + name.length);
    const centralView = new DataView(directory.buffer);
    u32(centralView, 0, 0x02014b50); u16(centralView, 4, 20); u16(centralView, 6, 20);
    u16(centralView, 8, 0); u16(centralView, 10, 0); u16(centralView, 12, 0); u16(centralView, 14, 0);
    u32(centralView, 16, crc); u32(centralView, 20, data.length); u32(centralView, 24, data.length);
    u16(centralView, 28, name.length); u16(centralView, 30, 0); u16(centralView, 32, 0);
    u16(centralView, 34, 0); u16(centralView, 36, 0); u32(centralView, 38, 0); u32(centralView, 42, offset);
    directory.set(name, 46); central.push(directory);
    offset += header.length + data.length;
  }
  const centralBytes = join(central);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50); u16(endView, 4, 0); u16(endView, 6, 0);
  u16(endView, 8, files.length); u16(endView, 10, files.length);
  u32(endView, 12, centralBytes.length); u32(endView, 16, offset); u16(endView, 20, 0);
  return join([...local, centralBytes, end]);
};

export function buildOrderWorkbook(input: WorkbookInput): Uint8Array {
  const rows = [
    `<row r="1">${cell('A1', 'Code')}${cell('B1', 'Quantity')}${cell('C1', 'Unit')}${cell('D1', 'Calc ID')}</row>`,
    ...input.orderList.map((item, index) => {
      const row = index + 2;
      return `<row r="${row}">${cell(`A${row}`, item.code)}${cell(`B${row}`, item.value)}${cell(`C${row}`, item.unit)}${cell(`D${row}`, item.calcId)}</row>`;
    }),
  ].join('');
  const metadataRow = input.orderList.length + 4;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}<row r="${metadataRow}">${cell(`A${metadataRow}`, 'Takeoff revision')}${cell(`B${metadataRow}`, input.revisionId)}</row><row r="${metadataRow + 1}">${cell(`A${metadataRow + 1}`, 'Quantity digest')}${cell(`B${metadataRow + 1}`, input.quantityPayloadSha256)}</row><row r="${metadataRow + 2}">${cell(`A${metadataRow + 2}`, 'Model version')}${cell(`B${metadataRow + 2}`, input.quantityModelVersion)}</row></sheetData></worksheet>`;
  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Order List" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: 'xl/worksheets/sheet1.xml', content: sheet },
  ]);
}
