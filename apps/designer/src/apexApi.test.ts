import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APEX_STAFF_TOKEN_KEY, designerApi, readStaffToken, staffRequestHeaders } from './apexApi.ts';

describe('Designer staff auth', () => {
  it('reads the same localStorage key Apex OS writes', () => {
    const storage = {
      getItem: (key: string) => (key === APEX_STAFF_TOKEN_KEY ? '  staff-token  ' : null),
    };
    expect(APEX_STAFF_TOKEN_KEY).toBe('apex-gate-token');
    expect(readStaffToken(storage)).toBe('staff-token');
    expect(readStaffToken({ getItem: () => null })).toBe('');
    expect(staffRequestHeaders({ accept: 'application/json' }, '')).toEqual({ accept: 'application/json' });
    expect(staffRequestHeaders({ accept: 'application/json' }, 'abc')).toEqual({
      accept: 'application/json',
      authorization: 'Bearer abc',
    });
  });

  it('sends the staff bearer token and omits it when the session is empty', async () => {
    const seen: Array<string | null> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('authorization'));
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      await designerApi('http://apex.local', '/api/opportunities', {
        storage: { getItem: () => null },
      });
      await designerApi('http://apex.local', '/api/projects/intake', {
        method: 'POST',
        body: { customerName: 'Ada' },
        storage: {
          getItem: (key) => (key === APEX_STAFF_TOKEN_KEY ? 'staff-token' : null),
        },
      });
    } finally {
      globalThis.fetch = original;
    }
    expect(seen).toEqual([null, 'Bearer staff-token']);
  });

  it('routes customer list, intake, finish-estimate, and takeoff through that client', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    expect(source).toContain("designerApi(APEX_OS_ORIGIN, '/api/opportunities')");
    expect(source).toContain("designerApi(APEX_OS_ORIGIN, '/api/projects/intake'");
    expect(source).toContain('/finish-estimate');
    expect(source).toContain('/approved-takeoff');
    expect(source).not.toMatch(/fetch\(`\$\{APEX_OS_ORIGIN\}/);
  });
});
