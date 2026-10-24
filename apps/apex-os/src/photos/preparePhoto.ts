import type { JobPhotoUpload } from '@apex/contracts';
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Read only EXIF's camera date and offset. Never use file.lastModified as capture time. */
export function exifCapture(
  buffer: ArrayBuffer,
): Pick<JobPhotoUpload, 'originalCapturedAt' | 'capturedLocal'> {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return {};
    let cursor = 2;
    while (cursor + 4 < view.byteLength) {
      if (view.getUint8(cursor) !== 0xff) break;
      const marker = view.getUint8(cursor + 1),
        length = view.getUint16(cursor + 2);
      if (length < 2 || cursor + 2 + length > view.byteLength) break;
      if (marker === 0xe1 && view.getUint32(cursor + 4) === 0x45786966) {
        const start = cursor + 10;
        const little = view.getUint16(start) === 0x4949;
        if (!little && view.getUint16(start) !== 0x4d4d) return {};
        const u16 = (at: number) => view.getUint16(at, little);
        const u32 = (at: number) => view.getUint32(at, little);
        if (u16(start + 2) !== 42) return {};
        const tags = new Map<number, string>();
        const read = (offset: number, depth = 0) => {
          if (depth > 1) return;
          const at = start + offset,
            count = u16(at);
          if (count > 256) return;
          for (let i = 0; i < count; i++) {
            const entry = at + 2 + i * 12,
              tag = u16(entry),
              size = u32(entry + 4);
            if (tag === 0x8769) {
              read(u32(entry + 8), depth + 1);
              continue;
            }
            if (u16(entry + 2) !== 2 || size < 2 || size > 64) continue;
            const textAt = size <= 4 ? entry + 8 : start + u32(entry + 8);
            tags.set(
              tag,
              new TextDecoder().decode(
                new Uint8Array(buffer, textAt, size - 1),
              ),
            );
          }
        };
        read(u32(start + 4));
        const local = tags.get(0x9003),
          offset = tags.get(0x9011);
        if (!local || !/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(local))
          return {};
        const isoLocal =
          local.slice(0, 10).replaceAll(':', '-') + 'T' + local.slice(11);
        const civil = new Date(isoLocal + 'Z');
        if (
          Number.isNaN(civil.getTime()) ||
          civil.toISOString().slice(0, 19) !== isoLocal
        )
          return {};
        if (offset && /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset)) {
          const instant = new Date(isoLocal + offset);
          if (!Number.isNaN(instant.getTime()))
            return { originalCapturedAt: instant.toISOString() };
        }
        return { capturedLocal: local };
      }
      cursor += length + 2;
    }
  } catch {
    /* Absent or malformed EXIF is not a reliable timestamp. */
  }
  return {};
}

export async function preparePhoto(file: File): Promise<{
  payload: JobPhotoUpload;
  byteSize: number;
}> {
  if (!TYPES.includes(file.type))
    throw new Error(
      'Choose JPEG, PNG or WebP. Convert HEIC to JPEG before adding it. SVG is not supported.',
    );
  if (!file.size || file.size > MAX_BYTES)
    throw new Error(`${file.name}: photos must be no larger than 8 MB.`);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = (start: number, end: number) =>
    new TextDecoder().decode(bytes.slice(start, end));
  const signature =
    file.type === 'image/jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === 'image/png'
        ? [137, 80, 78, 71, 13, 10, 26, 10].every(
            (value, index) => bytes[index] === value,
          )
        : text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP';
  if (!signature)
    throw new Error(
      `${file.name}: photo bytes do not match the selected image type.`,
    );
  const metadata = exifCapture(buffer);
  const objectUrl = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 80_000_000
    ) {
      throw new Error('Image dimensions are invalid or exceed 80 megapixels.');
    }
  } catch {
    throw new Error(
      `${file.name}: the image is corrupt or its dimensions are unsupported.`,
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  const scale = Math.min(
    1,
    2048 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This device cannot prepare photos.');
  // Browser image decoding applies EXIF orientation before drawing.
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const encoded = canvas.toDataURL(mimeType, 0.85).split(',')[1];
  if (!encoded) throw new Error('This image could not be prepared.');
  const byteSize = Math.floor((encoded.length * 3) / 4);
  if (byteSize > MAX_BYTES)
    throw new Error('Prepared photo exceeds 8 MB. Choose a smaller image.');
  return {
    payload: { mimeType, contentBase64: encoded, ...metadata },
    byteSize,
  };
}
