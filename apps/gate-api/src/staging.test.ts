import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations } from '@apex/database';
import { LocalEvidenceStorage } from '@apex/storage';
import { createCanonicalId } from '@apex/contracts';
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGateApi } from './server.js';

/**
 * Staging identity is Cloudflare Access, and staging answers noindex.
 *
 * The keypair stands in for the Access certs endpoint. Nothing here talks to
 * Cloudflare. Local and CI servers that do not pass `access` or
 * `disallowRobots` are covered by the existing suites and stay unchanged.
 */

const TEAM = 'apex-test';
const ISSUER = `https://${TEAM}.cloudflareaccess.com`;
const AUDIENCE = 'aud-staging-test';
const ALLOWED_EMAIL = 'nick@example.com';
const secretText = 'a-local-development-secret-that-is-long-enough';

let db: PGlite;
let evidence: string;
let jwksServer: Server;
let api: Server;
let baseUrl: string;
let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;
let userId: string;

const sign = async (overrides: { email?: string; issuer?: string; audience?: string; role?: string } = {}) =>
  new SignJWT({
    email: overrides.email ?? ALLOWED_EMAIL,
    ...(overrides.role !== undefined ? { role: overrides.role } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid: publicJwk['kid'] as string })
    .setSubject('access-user')
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setExpirationTime('5m')
    .sign(privateKey);

const jobs = (headers: Record<string, string> = {}) =>
  fetch(`${baseUrl}/api/jobs`, { headers });

beforeEach(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'access-test-1', alg: 'RS256', use: 'sig' };

  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((done) => jwksServer.listen(0, '127.0.0.1', done));
  const jwksPort = (jwksServer.address() as AddressInfo).port;

  db = new PGlite();
  await applyOperationalMigrations(db);
  evidence = await mkdtemp(join(tmpdir(), 'apex-access-'));
  userId = createCanonicalId('user');
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name, active)
     values ($1, '00000000-0000-0000-0000-000000000041', 'admin', 'Nick', true)`,
    [userId],
  );

  api = createGateApi({
    db,
    storage: new LocalEvidenceStorage(evidence),
    access: {
      team: TEAM,
      audience: AUDIENCE,
      email: ALLOWED_EMAIL,
      userId,
      jwksUri: `http://127.0.0.1:${jwksPort}/certs`,
    },
    disallowRobots: true,
  });
  await new Promise<void>((done) => api.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((done) => api.close(() => done()));
  await new Promise<void>((done) => jwksServer.close(() => done()));
  await rm(evidence, { recursive: true, force: true });
});

describe('Cloudflare Access as the only staging identity', () => {
  it('tells the staff app this deployment uses Access', async () => {
    expect(await (await fetch(`${baseUrl}/api/auth/config`)).json()).toEqual({ mode: 'access' });
  });

  it('accepts the allowed email and uses the configured app_users role', async () => {
    const response = await jobs({ 'cf-access-jwt-assertion': await sign() });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('refuses a different email that has no app_users row', async () => {
    const response = await jobs({ 'cf-access-jwt-assertion': await sign({ email: 'other@example.com' }) });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'No active Apex user is linked to this identity.' });
  });

  it('refuses a missing Access assertion, including a bearer token', async () => {
    expect((await jobs()).status).toBe(403);
    const bearer = await jobs({ authorization: 'Bearer not-a-gate-token' });
    expect(bearer.status).toBe(403);
    expect(await bearer.json()).toEqual({ error: 'Cloudflare Access authentication is required.' });
  });

  it('refuses a token minted for another team', async () => {
    const response = await jobs({
      'cf-access-jwt-assertion': await sign({ issuer: 'https://other.cloudflareaccess.com' }),
    });
    expect(response.status).toBe(403);
  });

  it('serves a disallow-all robots.txt and noindex on health', async () => {
    const robots = await fetch(`${baseUrl}/robots.txt`);
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain('Disallow: /');
    expect(robots.headers.get('x-robots-tag')).toContain('noindex');

    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(health.headers.get('x-robots-tag')).toContain('noindex');
  });
});

describe('staging switches stay off unless configured', () => {
  it('ignores an Access header when the pilot secret is the identity', async () => {
    await new Promise<void>((done) => api.close(() => done()));
    api = createGateApi({
      db,
      jwtSecret: secretText,
      storage: new LocalEvidenceStorage(evidence),
    });
    await new Promise<void>((done) => api.listen(0, '127.0.0.1', done));
    baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

    const response = await jobs({ 'cf-access-jwt-assertion': await sign() });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Bearer authentication is required.' });

    const health = await fetch(`${baseUrl}/health`);
    expect(health.headers.get('x-robots-tag')).toBeNull();
    const robots = await fetch(`${baseUrl}/robots.txt`);
    expect(robots.status).not.toBe(200);
    expect(await robots.text()).not.toContain('Disallow: /');
  });

  it('will not start with Access and a shared secret', () => {
    expect(() => createGateApi({
      db,
      storage: new LocalEvidenceStorage(evidence),
      jwtSecret: secretText,
      access: { team: TEAM, audience: AUDIENCE, email: ALLOWED_EMAIL, userId },
    })).toThrow(/not both/i);
  });
});

describe('Access email maps to app_users', () => {
  const ownerEmail = 'owner@example.com';
  const fieldEmail = 'field.hand@example.com';
  let ownerId = '';
  let fieldId = '';

  const listen = async (access: {
    team: string;
    audience: string;
    email?: string;
    userId?: string;
    jwksUri: string;
  }) => {
    await new Promise<void>((done) => api.close(() => done()));
    api = createGateApi({
      db,
      storage: new LocalEvidenceStorage(evidence),
      access,
      disallowRobots: true,
    });
    await new Promise<void>((done) => api.listen(0, '127.0.0.1', done));
    baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  };

  beforeEach(async () => {
    ownerId = createCanonicalId('user');
    fieldId = createCanonicalId('user');
    await db.query(
      `insert into app_users (user_id, auth_user_id, role, display_name, active, email) values
       ($1, '00000000-0000-0000-0000-000000000042', 'admin', 'Owner', true, $2),
       ($3, '00000000-0000-0000-0000-000000000043', 'field', 'Field', true, $4),
       ($5, '00000000-0000-0000-0000-000000000044', 'office', 'Former', false, 'former.staff@example.com')`,
      [ownerId, ownerEmail, fieldId, fieldEmail, createCanonicalId('user')],
    );
    await listen({
      team: TEAM,
      audience: AUDIENCE,
      jwksUri: `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/certs`,
    });
  });

  const intake = (token: string) => fetch(`${baseUrl}/api/projects/intake`, {
    method: 'POST',
    headers: {
      'cf-access-jwt-assertion': token,
      'content-type': 'application/json',
    },
    body: '{}',
  });

  it('gives each verified email the role stored on that row', async () => {
    const ownerToken = await sign({ email: 'Owner@Example.com', role: 'field' });
    const ownerJobs = await jobs({ 'cf-access-jwt-assertion': ownerToken });
    expect(ownerJobs.status).toBe(200);
    const today = await fetch(`${baseUrl}/api/today`, { headers: { 'cf-access-jwt-assertion': ownerToken } });
    expect(today.status).toBe(200);
    const me = await fetch(`${baseUrl}/api/me`, { headers: { 'cf-access-jwt-assertion': ownerToken } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ displayName: 'Owner', role: 'admin' });
    const ownerIntake = await intake(ownerToken);
    expect(ownerIntake.status).not.toBe(403);

    const fieldToken = await sign({ email: fieldEmail, role: 'admin' });
    const fieldJobs = await jobs({ 'cf-access-jwt-assertion': fieldToken });
    expect(fieldJobs.status).toBe(200);
    const fieldIntake = await intake(fieldToken);
    expect(fieldIntake.status).toBe(403);
    expect(await fieldIntake.json()).toEqual({ error: 'Office access is required to create a design project.' });
  });

  it('refuses an unknown email and an inactive email with the same 403', async () => {
    const unknown = await jobs({ 'cf-access-jwt-assertion': await sign({ email: 'nobody@example.com' }) });
    expect(unknown.status).toBe(403);
    expect(await unknown.json()).toEqual({ error: 'No active Apex user is linked to this identity.' });

    const inactive = await jobs({ 'cf-access-jwt-assertion': await sign({ email: 'Former.Staff@Example.com' }) });
    expect(inactive.status).toBe(403);
    expect(await inactive.json()).toEqual({ error: 'No active Apex user is linked to this identity.' });
  });

  it('prefers the email row over the legacy user id', async () => {
    await listen({
      team: TEAM,
      audience: AUDIENCE,
      email: ALLOWED_EMAIL,
      userId,
      jwksUri: `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/certs`,
    });
    const response = await intake(await sign({ email: fieldEmail, role: 'admin' }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Office access is required to create a design project.' });
  });

  it('still checks audience when the email is known', async () => {
    const response = await jobs({
      'cf-access-jwt-assertion': await sign({ email: ownerEmail, audience: 'some-other-app' }),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Authentication is invalid or expired.' });
  });
});
