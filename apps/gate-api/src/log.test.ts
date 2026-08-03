import { describe, expect, it } from 'vitest';
import { redactPath } from './log.js';

/**
 * Log redaction — deployment plan slice 6.
 *
 * A customer link token is a bearer credential that lives in the URL path. A
 * log stream is retained, searchable, and visible to anyone with dashboard
 * access, so writing a raw path there would hand out working links and undo the
 * point of storing only the hash.
 */

const token = 'Hgt9_Z4VolKhsOhfPbxMpoOdwJryGHhuV9EiTdowkOw';

describe('redacting a request path', () => {
  it('removes a customer token from the page route', () => {
    expect(redactPath(`/c/${token}`)).toBe('/c/[token]');
  });

  it('removes it from a photo route without losing the rest of the path', () => {
    expect(redactPath(`/c/${token}/photo/evidence_01ARZ3NDEKTSV4RRFFQ69G5FB2`))
      .toBe('/c/[token]/photo/evidence_01ARZ3NDEKTSV4RRFFQ69G5FB2');
  });

  it('redacts by token shape, so a route that does not exist still redacts', () => {
    // A mistyped or probing request is exactly where a token would otherwise
    // leak, because it never reaches a handler that knows to be careful.
    expect(redactPath(`/c/${token}/../admin`)).toBe('/c/[token]/../admin');
    expect(redactPath(`/api/c/${token}`)).toBe('/api/c/[token]');
  });

  it('leaves ordinary staff paths untouched', () => {
    expect(redactPath('/api/jobs/job_01ARZ3NDEKTSV4RRFFQ69G5FAW/draws'))
      .toBe('/api/jobs/job_01ARZ3NDEKTSV4RRFFQ69G5FAW/draws');
    expect(redactPath('/health')).toBe('/health');
  });

  it('does not mangle a short segment that merely starts with /c/', () => {
    expect(redactPath('/c/short')).toBe('/c/short');
  });
});
