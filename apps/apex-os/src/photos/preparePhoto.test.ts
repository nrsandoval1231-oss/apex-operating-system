import { describe, it, expect } from 'vitest';
import { exifCapture } from './preparePhoto';

function jpegExif(
  local = '2026:10:24 08:30:00',
  offset: string | null = '-05:00',
): ArrayBuffer {
  const buffer = new ArrayBuffer(95);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const text = (at: number, value: string) =>
    bytes.set(new TextEncoder().encode(value), at);
  view.setUint16(0, 0xffd8);
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 91);
  text(6, 'Exif\0\0');
  text(12, 'II');
  const short = (at: number, value: number) =>
    view.setUint16(12 + at, value, true);
  const long = (at: number, value: number) =>
    view.setUint32(12 + at, value, true);
  short(2, 42);
  long(4, 8);
  short(8, 1);
  short(10, 0x8769);
  short(12, 4);
  long(14, 1);
  long(18, 26);
  short(26, offset === null ? 1 : 2);
  short(28, 0x9003);
  short(30, 2);
  long(32, 20);
  long(36, 56);
  text(68, local + '\0');
  if (offset !== null) {
    short(40, 0x9011);
    short(42, 2);
    long(44, 7);
    long(48, 76);
    text(88, offset + '\0');
  }
  return buffer;
}
describe('reliable photo capture metadata', () => {
  it('uses the original camera date only with an explicit valid offset', () => {
    expect(exifCapture(jpegExif())).toEqual({
      originalCapturedAt: '2026-10-24T13:30:00.000Z',
    });
  });
  it('preserves camera-local EXIF as explicitly timezone-unknown', () => {
    expect(exifCapture(jpegExif('2026:10:24 08:30:00', null))).toEqual({
      capturedLocal: '2026:10:24 08:30:00',
    });
    expect(exifCapture(jpegExif('2026:10:24 08:30:00', '+99:99'))).toEqual({
      capturedLocal: '2026:10:24 08:30:00',
    });
  });
  it('refuses invalid calendar dates and ignores malformed metadata without inventing a timestamp', () => {
    expect(exifCapture(jpegExif('2026:02:30 08:30:00'))).toEqual({});
    expect(exifCapture(new Uint8Array([255, 216, 255]).buffer)).toEqual({});
  });
});
