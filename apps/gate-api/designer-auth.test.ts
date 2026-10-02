import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { applyOperationalMigrations } from '@apex/database';
import { LocalEvidenceStorage } from '@apex/storage';
import { createCanonicalId } from '@apex/contracts';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGateApi } from './src/server.ts';
import { APEX_STAFF_TOKEN_KEY, designerApi, type TokenStore } from '../designer/src/apexApi.ts';

/**
 * Designer → Gate API with real staff auth.
 *
 * The local bypass is not configured. The same client Designer uses
 * (`designerApi`) must carry the Apex OS staff token, or customer list,
 * intake, finish-estimate, and approved-takeoff all answer 403.
 */

const ISSUER = 'https://apex-designer-auth.example.com';
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
  jobLead: createCanonicalId('lead'),
  job: createCanonicalId('job'),
  office: createCanonicalId('user'),
};

const submission = {
  engineVersion: 'designer-auth-test',
  quantityModelVersion: 'designer-quantity-v5',
  jobModel: { shape: 'rectangle' },
  quantities: [{ code: 'pool.water-volume', value: 1, unit: 'gal', calcId: 'calc.pool' }],
  calcLedger: [{
    id: 'calc.pool', label: 'Pool volume', formula: 'Q = 1', inputs: [], value: 1, unit: 'gal',
  }],
  supersedeExisting: false,
};

const signOffice = () => new SignJWT({})
  .setProtectedHeader({ alg: 'RS256', kid: publicJwk['kid'] as string })
  .setSubject('auth0|office')
  .setIssuer(ISSUER)
  .setAudience(AUDIENCE)
  .setExpirationTime('5m')
  .sign(privateKey);

const store = (token: string): TokenStore => ({
  getItem: (key) => (key === APEX_STAFF_TOKEN_KEY ? token : null),
});

beforeEach(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'designer-auth-1', alg: 'RS256', use: 'sig' };

  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise<void>((done) => jwksServer.listen(0, '127.0.0.1', done));
  const jwksPort = (jwksServer.address() as AddressInfo).port;

  db = new PGlite();
  await applyOperationalMigrations(db);
  evidence = await mkdtemp(join(tmpdir(), 'apex-designer-auth-'));
  await db.query(
    `insert into app_users (user_id, auth_user_id, role, display_name, active, oidc_subject)
     values ($1, '00000000-0000-0000-0000-000000000041', 'office', 'Office', true, 'auth0|office')`,
    [ids.office],
  );
  await db.query(
    `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
     values ($1, 'test', 'designer-auth', 'test:designer-auth', '{"customerName":"Seeded Customer"}'),
            ($2, 'test', 'designer-auth-job', 'test:designer-auth-job', '{"customerName":"Job Customer"}')`,
    [ids.lead, ids.jobLead],
  );
  await db.query(
    `insert into jobs (job_id, lead_id, signed_proposal_version, status) values ($1, $2, 1, 'active')`,
    [ids.job, ids.jobLead],
  );

  api = createGateApi({
    db,
    storage: new LocalEvidenceStorage(evidence),
    oidc: {
      issuer: ISSUER,
      audience: AUDIENCE,
      clientId: 'apex-staff-app',
      jwksUri: `http://127.0.0.1:${jwksPort}/jwks.json`,
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

describe('Designer API calls with staff OIDC and the local bypass off', () => {
  const anonymous = { storage: store('') };

  it('refuses customer list, intake, finish-estimate, and takeoff without a token', async () => {
    expect((await designerApi(baseUrl, '/api/opportunities', anonymous)).status).toBe(403);
    expect((await designerApi(baseUrl, '/api/projects/intake', {
      ...anonymous,
      method: 'POST',
      body: {
        customerName: 'Jamie Referral', streetAddress: '123 Main Street',
        city: 'Lubbock', state: 'TX', postalCode: '79401',
      },
    })).status).toBe(403);
    expect((await designerApi(baseUrl, `/api/opportunities/${ids.lead}/finish-estimate`, {
      ...anonymous,
      method: 'POST',
      body: { submission, directLines: [], measuredLines: [], feeRateBps: 0 },
    })).status).toBe(403);
    expect((await designerApi(baseUrl, `/api/jobs/${ids.job}/approved-takeoff`, {
      ...anonymous,
      method: 'POST',
      body: submission,
    })).status).toBe(403);
  });

  it('lists and creates customers and sends a design to estimate with the staff token', async () => {
    const authed = { storage: store(await signOffice()) };

    const created = await designerApi(baseUrl, '/api/projects/intake', {
      ...authed,
      method: 'POST',
      body: {
        customerName: 'Jamie Referral', streetAddress: '123 Main Street',
        city: 'Lubbock', state: 'TX', postalCode: '79401',
      },
    });
    expect(created.status).toBe(201);
    const intake = await created.json() as { leadId: string; customerName: string };
    expect(intake.customerName).toBe('Jamie Referral');

    const listed = await designerApi(baseUrl, '/api/opportunities', authed);
    expect(listed.status).toBe(200);
    const opportunities = await listed.json() as Array<{ leadId: string; customerName: string | null }>;
    expect(opportunities.map((entry) => entry.leadId)).toContain(intake.leadId);
    expect(opportunities.map((entry) => entry.leadId)).toContain(ids.lead);

    const finished = await designerApi(baseUrl, `/api/opportunities/${ids.lead}/finish-estimate`, {
      ...authed,
      method: 'POST',
      body: { submission, directLines: [], measuredLines: [], feeRateBps: 0 },
    });
    expect(finished.status).toBe(201);
    const draft = await finished.json() as { proposal: { proposalVersionId: string; status: string } };
    expect(draft.proposal.status).toBe('draft');
    expect(draft.proposal.proposalVersionId).toMatch(/^proposal_version_/);

    const takeoff = await designerApi(baseUrl, `/api/jobs/${ids.job}/approved-takeoff`, {
      ...authed,
      method: 'POST',
      body: submission,
    });
    expect(takeoff.status).toBe(201);
    const revision = await takeoff.json() as { revisionId: string; status: string };
    expect(revision.status).toBe('approved');
    expect(revision.revisionId).toMatch(/^revision_/);
  });
});
