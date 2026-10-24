import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations } from '@apex/database';
import { LocalEvidenceStorage } from '@apex/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPublicLeadHandler } from './publicLeads.js';
import { createGateApi } from './server.js';

let db: PGlite; let dir: string; let server: ReturnType<typeof createServer>; let base: string;
const payload = (extra: Record<string, unknown> = {}) => ({
  schema_version: 2, lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools', first_name: 'Ada', last_name: 'Lovelace',
  email: 'ada@example.com', phone: '8065550100', consent_sms: true, consent_text: 'I agree to receive text messages from Apex Designer Pools about my quote. ~2 msgs/month, data rates may apply. Reply STOP to opt out.', source: 'direct',
  medium: 'none', campaign: '', landing_page: '/', referrer: '', fbclid: '', gclid: '', page_submitted: '/',
  device: 'desktop', submitted_at: new Date().toISOString(),
  project: { type: 'pool', city: 'Lubbock', timeline: '', budget: '', size: '', features: [], condition: '', description: '' },
  website: '', consent_version: 'website-2-20261024', ...extra,
});
const post = (body: unknown, headers: Record<string, string> = {}) => fetch(base + '/api/public/v1/leads', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://site.example', ...headers }, body: JSON.stringify(body),
});

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'apex-public-intake-'));
  db = new PGlite(`file://${join(dir, 'db')}`); await applyOperationalMigrations(db);
  const handler = createPublicLeadHandler({ db, enabled: true, origins: ['https://site.example'] });
  server = createServer((req, res) => { void handler(req, res).then((handled) => { if (!handled) { res.statusCode = 404; res.end(); } }); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number }; base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await db.close(); await rm(dir, { recursive: true, force: true }); });

describe('public website lead intake', () => {
  it('persists a lead in the existing OS table and replays idempotently', async () => {
    const body = payload();
    const first = await post(body, { 'idempotency-key': 'web-idem-0001' });
    expect(first.status).toBe(201);
    const accepted = await first.json();
    expect(accepted.status).toBe('accepted');
    expect(accepted.canonical_lead_id).toMatch(/^lead_/);
    const second = await post(body, { 'idempotency-key': 'different-untrusted-key' });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ status: 'duplicate', canonical_lead_id: accepted.canonical_lead_id });
    const rows = await db.query<{ count: string; customer_name: string; intake_source: string; payload: Record<string, unknown> }>(
      `select count(*)::text as count, max(accepted_payload->>'customerName') as customer_name, max(intake_source) as intake_source,
              (select accepted_payload from leads limit 1) as payload from leads`);
    expect(rows.rows[0]).toMatchObject({ count: '1', customer_name: 'Ada Lovelace', intake_source: 'website' });
    expect(rows.rows[0]?.payload).toMatchObject({ consent_sms: true, consent_text: payload().consent_text, consent_version: 'website-2-20261024' });
    expect(rows.rows[0]?.payload).not.toHaveProperty('website');
  });
  it('accepts tracking at the browser limit without relaxing contact validation or replay integrity', async () => {
    const bounded = 'c'.repeat(200);
    const body = payload({ source: bounded, medium: bounded, campaign: bounded,
      landing_page: bounded, referrer: bounded, fbclid: bounded, gclid: bounded, page_submitted: bounded });
    expect((await post(body)).status).toBe(201);
    expect((await post(body)).status).toBe(200);
    const rows = await db.query<{ accepted_payload: Record<string, string> }>('select accepted_payload from leads');
    expect(rows.rows).toHaveLength(1);
    for (const field of ['source', 'medium', 'campaign', 'landing_page', 'referrer', 'fbclid', 'gclid', 'page_submitted'])
      expect(rows.rows[0]!.accepted_payload[field]).toBe(bounded);
    expect((await post({ ...body, campaign: 'different campaign' })).status).toBe(409);
    expect((await post({ ...body, first_name: 'a'.repeat(201) })).status).toBe(422);
    expect((await post({ ...body, campaign: 'a'.repeat(201) })).status).toBe(422);
  });
  it('rejects changed content with the same idempotency key', async () => {
    const body = payload();
    await post(body);
    expect((await post({ ...body, email: 'other@example.com' })).status).toBe(409);
  });
  it('allows only the exact origin in preflight and POST', async () => {
    const options = await fetch(base + '/api/public/v1/leads', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    expect(options.status).toBe(403);
    expect(options.headers.get('access-control-allow-origin')).toBeNull();
    expect((await post(payload(), { origin: 'https://evil.example' })).status).toBe(403);
    const missing = await fetch(base + '/api/public/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) });
    expect(missing.status).toBe(403);
  });
  it('rejects honeypot, malformed data, and oversized bodies', async () => {
    expect((await post(payload({ website: 'bot' }))).status).toBe(400);
    expect((await post(payload({ consent_version: 'wrong' }))).status).toBe(422);
    expect((await post(payload({ vertical: 'Other' }))).status).toBe(422);
    expect((await post(payload({ consent_sms: true, consent_text: 'forged consent' }))).status).toBe(422);
    expect((await post(payload({ email: '', phone: '8065550100', consent_sms: false, consent_text: '' }))).status).toBe(201);
    expect((await post(payload({ email: '', phone: '555', consent_sms: false, consent_text: '' }))).status).toBe(422);
    const response = await fetch(base + '/api/public/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://site.example' }, body: ' '.repeat(17_000) });
    expect(response.status).toBe(413);
  });
  it('is disabled unless explicitly enabled', async () => {
    const disabled = createPublicLeadHandler({ db });
    const local = createServer((req, res) => { void disabled(req, res); });
    await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', resolve));
    const port = (local.address() as { port: number }).port;
    expect((await fetch(`http://127.0.0.1:${port}/api/public/v1/leads`, { method: 'POST' })).status).toBe(404);
    await new Promise<void>((resolve) => local.close(() => resolve()));
  });
  it('keeps staff routes behind authentication while the public route is reachable', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server = createGateApi({ db, jwtSecret: 'test-secret-long-enough-for-api-initialization', storage: new LocalEvidenceStorage(dir), publicLeadIntake: { enabled: true, origins: ['https://site.example'] } });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    expect((await post(payload())).status).toBe(201);
    expect((await fetch(base + '/api/me')).status).toBe(403);
  });
  it('handles concurrent identical submissions with one durable row', async () => {
    const body = payload();
    const results = await Promise.all([post(body, { 'idempotency-key': 'anything-a' }), post(body, { 'idempotency-key': 'anything-b' })]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
    const count = await db.query<{ count: string }>(`select count(*)::text as count from leads`);
    expect(count.rows[0]?.count).toBe('1');
  });
  it('returns no acceptance when persistence fails', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const handler = createPublicLeadHandler({
      db: { query: async () => { throw new Error('isolated persistence failure'); } } as unknown as PGlite,
      enabled: true, origins: ['https://site.example'],
    });
    server = createServer((req, res) => { void handler(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const response = await post(payload());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Intake unavailable.' });
  });
});
