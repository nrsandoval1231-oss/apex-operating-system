import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/**
 * What every write carries.
 *
 * The commanding routes refuse a POST without an `Idempotency-Key` of at least
 * eight characters. For most of this app's life no route it could reach was one
 * of them, so the omission sat here harmlessly and surfaced as a 422 the first
 * time somebody attached a takeoff — in the browser, on a real job, rather than
 * in a test. That is the failure this file exists to stop repeating.
 */

class FakeStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string): string | null { return this.entries.get(key) ?? null; }
  setItem(key: string, value: string): void { this.entries.set(key, value); }
  removeItem(key: string): void { this.entries.delete(key); }
}

let sent: RequestInit & { headers: Record<string, string> };

const loadClient = async () => {
  vi.resetModules();
  return import('./client');
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new FakeStorage());
  vi.stubGlobal('sessionStorage', new FakeStorage());
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-3333-4444-555555555555' });
  vi.stubGlobal('fetch', (_path: string, init: RequestInit) => {
    sent = init as typeof sent;
    return Promise.resolve({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ ok: true }),
    } as Response);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiSend', () => {
  it('sends an idempotency key long enough for the API to accept', async () => {
    const { apiSend } = await loadClient();
    await apiSend('/api/jobs/x/approved-takeoff', z.object({ ok: z.boolean() }), {
      method: 'POST',
      body: { a: 1 },
    });

    const key = sent.headers['idempotency-key'];
    expect(key).toBeDefined();
    // The server's floor is eight characters; asserting the rule, not the UUID.
    expect((key ?? '').trim().length).toBeGreaterThanOrEqual(8);
  });

  it('still sends the body and content type', async () => {
    const { apiSend } = await loadClient();
    await apiSend('/api/thing', z.object({ ok: z.boolean() }), { method: 'POST', body: { a: 1 } });

    expect(sent.headers['content-type']).toBe('application/json');
    expect(sent.body).toBe(JSON.stringify({ a: 1 }));
  });

  /** A DELETE is a command too, and the same routes refuse it without a key. */
  it('sends one on DELETE as well', async () => {
    const { apiSend } = await loadClient();
    await apiSend('/api/thing', z.object({ ok: z.boolean() }), { method: 'DELETE' });
    expect((sent.headers['idempotency-key'] ?? '').length).toBeGreaterThanOrEqual(8);
  });
});
