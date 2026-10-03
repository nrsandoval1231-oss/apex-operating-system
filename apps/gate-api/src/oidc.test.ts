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
 * Real identity — deployment plan slice 4.
 *
 * Verified against a locally generated keypair served from a local JWKS
 * endpoint, which is exactly what a provider does. No account needed, and the
 * cases worth testing are the refusals rather than the happy path.
 */

const ISSUER = 'https://apex-test.example.com';
const AUDIENCE = 'https://api.apex.test';

let db: PGlite;
let evidence: string;
let jwksServer: Server;
let api: Server;
let baseUrl: string;
let privateKey: CryptoKey;
let publicJwk: Record<string, unknown>;

const ids = {
  lead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  field: createCanonicalId('user'),
  owner: createCanonicalId('user'),
  inactive: createCanonicalId('user'),
};

/** A token as the provider would mint it, unless the test says otherwise. */
const sign = async (overrides: {
  subject?: string;
  issuer?: string;
  audience?: string;
  claims?: Record<string, unknown>;
} = {}) => new SignJWT({ ...overrides.claims })
  .setProtectedHeader({ alg: 'RS256', kid: publicJwk['kid'] as string })
  .setSubject(overrides.subject ?? 'auth0|field-lead')
  .setIssuer(overrides.issuer ?? ISSUER)
  .setAudience(overrides.audience ?? AUDIENCE)
  .setExpirationTime('5m')
  .sign(privateKey);

const get = (path: string, bearer?: string) => fetch(`${baseUrl}${path}`, {
  headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
});

beforeEach(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key-1', alg: 'RS256', use: 'sig' };

  // Stands in for the provider's published keys.
  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((done) => jwksServer.listen(0, '127.0.0.1', done));
  const jwksPort = (jwksServer.address() as AddressInfo).port;

  db = new PGlite();
  await applyOperationalMigrations(db);
  evidence = await mkdtemp(join(tmpdir(), 'apex-oidc-'));
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name, active, oidc_subject) values
     ($1, '00000000-0000-0000-0000-000000000031', 'field', 'Field Lead', true, 'auth0|field-lead'),
     ($2, '00000000-0000-0000-0000-000000000032', 'admin', 'Travis', true, 'auth0|travis'),
     ($3, '00000000-0000-0000-0000-000000000033', 'office', 'Departed', false, 'auth0|departed')`,
    [ids.field, ids.owner, ids.inactive],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'oidc', 'test:oidc', '{}')`,
    [ids.lead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.lead],
  );

  api = createGateApi({
    db,
    storage: new LocalEvidenceStorage(evidence),
    oidc: {
      issuer: ISSUER,
      audience: AUDIENCE,
      clientId: 'apex-staff-app',
      jwksUri: `http://127.0.0.1:${jwksPort}/jwks.json`,
      // Supplied directly so the test does not depend on a discovery document.
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/oauth/token`,
    },
  });
  await new Promise<void>((done) => api.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((done) => api.close(() => done()));
  await new Promise<void>((done) => jwksServer.close(() => done()));
  await rm(evidence, { recursive: true, force: true });
});

describe('verifying a provider-issued token', () => {
  it('accepts one signed by the published key', async () => {
    expect((await get('/api/jobs', await sign())).status).toBe(200);
  });

  it('refuses a request with no token', async () => {
    expect((await get('/api/jobs')).status).toBe(403);
  });

  it('refuses a token from a different issuer', async () => {
    // Same key, wrong issuer: a provider that signs for someone else is not
    // an authority for this system.
    expect((await get('/api/jobs', await sign({ issuer: 'https://evil.example.com' }))).status).toBe(403);
  });

  it('refuses a token minted for a different audience', async () => {
    // The common real-world mistake: a valid token for another API of the same
    // provider. Without the audience check it would be accepted here.
    expect((await get('/api/jobs', await sign({ audience: 'https://someone-elses.api' }))).status).toBe(403);
  });

  it('refuses an HS256 token signed with the public key as the secret', async () => {
    /*
     * The classic JWT algorithm-confusion attack. The public key is, by
     * definition, public; if the verifier accepted HS256 it would treat that
     * public value as a shared secret and anyone could mint an admin token.
     * The algorithm allow-list is what stops it, and this is the test that
     * proves the allow-list is actually applied.
     */
    const publicPem = JSON.stringify(publicJwk);
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('auth0|travis')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(publicPem));
    expect((await get('/api/jobs', forged)).status).toBe(403);
  });

  it('refuses an expired token', async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: publicJwk['kid'] as string })
      .setSubject('auth0|travis')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('-1m')
      .sign(privateKey);
    expect((await get('/api/jobs', expired)).status).toBe(403);
  });
});

describe('mapping an identity to an Apex user', () => {
  it('refuses a subject that maps to no Apex user', async () => {
    // A perfectly valid token from the provider for somebody who has not been
    // provisioned here. Authentication is not authorization.
    expect((await get('/api/jobs', await sign({ subject: 'auth0|stranger' }))).status).toBe(403);
  });

  it('refuses a user who has been deactivated', async () => {
    // Deactivating in Apex has to be sufficient. Waiting for the provider to
    // revoke would leave a departed employee with access until it did.
    expect((await get('/api/jobs', await sign({ subject: 'auth0|departed' }))).status).toBe(403);
  });

  it('ignores a role claim in the token and uses the database', async () => {
    /*
     * The property the whole design turns on: the token proves who, the
     * database decides what they may do.
     *
     * This token claims admin for the field lead. Creating a draw schedule is
     * restricted to admin and office. If the claim were trusted it would
     * succeed; because the role is read from `app_users`, it is refused as the
     * field lead it actually is.
     */
    const escalated = await sign({
      subject: 'auth0|field-lead',
      claims: { app_role: 'admin', role: 'admin', permissions: ['admin'] },
    });
    const response = await fetch(`${baseUrl}/api/jobs/${ids.job}/draws`, {
      method: 'POST',
      headers: { authorization: `Bearer ${escalated}`, 'content-type': 'application/json', 'idempotency-key': 'oidc-draw-0001' },
      body: '{}',
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toMatch(/may not|not authorized|role/i);
  });

  it('gives the owner the authority their database row carries', async () => {
    const response = await fetch(`${baseUrl}/api/jobs/${ids.job}/draws`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await sign({ subject: 'auth0|travis' })}`, 'content-type': 'application/json', 'idempotency-key': 'oidc-draw-0002' },
      body: '{}',
    });
    // Reaches the domain rule about needing a signed contract, rather than
    // being turned away at the door: the role was read and honoured.
    expect(response.status).toBe(409);
    expect(await response.text()).not.toMatch(/role .* may not/i);
  });
});

describe('telling the staff app how to sign someone in', () => {
  it('publishes the provider details a PKCE flow needs', async () => {
    const config = await (await fetch(`${baseUrl}/api/auth/config`)).json() as Record<string, unknown>;
    expect(config).toEqual({
      mode: 'oidc',
      issuer: ISSUER,
      audience: AUDIENCE,
      clientId: 'apex-staff-app',
      authorizationEndpoint: `${ISSUER}/authorize`,
      tokenEndpoint: `${ISSUER}/oauth/token`,
    });
  });

  it('is reachable without a token, because a signed-out browser asks first', async () => {
    // Everything it returns is public by design — an issuer, an audience, a
    // public client id, and two URLs the provider itself publishes. A browser
    // client cannot hold a secret, so there is none here to leak.
    expect((await fetch(`${baseUrl}/api/auth/config`)).status).toBe(200);
  });

  it('allows the provider origin in the staff app CSP', async () => {
    // The PKCE token exchange is a cross-origin POST to the provider. A bare
    // `connect-src 'self'` blocks it, and the symptom from the user's side is
    // that sign-in silently does nothing.
    const app = await fetch(`${baseUrl}/app`);
    const csp = app.headers.get('content-security-policy') ?? '';
    expect(csp).toContain(`connect-src 'self' ${new URL(ISSUER).origin}`);
    // Only that origin — not a wildcard.
    expect(csp).not.toContain('connect-src *');
  });
});

describe('refusing to run with two doors open', () => {
  it('will not start with both a provider and a shared secret', () => {
    // A deployment accepting self-minted tokens beside a real provider would
    // look configured from the outside while having a second, unaudited door.
    expect(() => createGateApi({
      db,
      storage: new LocalEvidenceStorage(evidence),
      jwtSecret: 'a-local-development-secret-that-is-long-enough',
      oidc: { issuer: ISSUER, audience: AUDIENCE, clientId: 'apex-staff-app' },
    })).toThrow(/not both/i);
  });

  it('will not start with neither', () => {
    expect(() => createGateApi({
      db,
      storage: new LocalEvidenceStorage(evidence),
    })).toThrow(/GATE_JWT_SECRET/);
  });
});
