#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPublicLeadHandler, PUBLIC_LEAD_PATH } from '../apps/gate-api/dist/publicLeads.js';

const requireFromApi = createRequire(resolve('apps/gate-api/package.json'));
const [{ PGlite }, { applyOperationalMigrations }] = await Promise.all([
  import(pathToFileURL(requireFromApi.resolve('@electric-sql/pglite')).href),
  import(pathToFileURL(requireFromApi.resolve('@apex/database')).href),
]);

const dataDir = resolve('var/website-review-db');
const defaultOrigins = [
  'http://localhost:4330',
  'http://127.0.0.1:4330',
  'https://website2-preview.apex-website-2-review.pages.dev',
  'https://apex-website-2-review.pages.dev',
];
const origins = (process.env.WEBSITE_REVIEW_ORIGINS ?? defaultOrigins.join(','))
  .split(',').map((origin) => origin.trim()).filter(Boolean);

async function receipt(websiteLeadId) {
  if (!websiteLeadId || websiteLeadId.length > 200) throw new Error('Usage: node tools/website-intake-fixture.mjs receipt <website-lead-id>');
  await mkdir(resolve(dataDir, '..'), { recursive: true });
  const db = new PGlite(`file://${dataDir}`);
  try {
    await applyOperationalMigrations(db);
    const result = await db.query(
      `select source_record_id as website_lead_id, lead_id as canonical_lead_id,
              status, accepted_payload_version, intake_source
       from leads where intake_source = 'website' and source_record_id = $1`,
      [websiteLeadId],
    );
    const row = result.rows[0];
    if (!row) {
      process.stdout.write(`${JSON.stringify({ found: false, website_lead_id: websiteLeadId })}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify({ found: true, ...row })}\n`);
  } finally {
    await db.close();
  }
}

async function serve() {
  await mkdir(resolve(dataDir, '..'), { recursive: true });
  const db = new PGlite(`file://${dataDir}`);
  await applyOperationalMigrations(db);
  const handlePublic = createPublicLeadHandler({ db, enabled: true, origins });
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path !== PUBLIC_LEAD_PATH) {
      res.writeHead(404, { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' });
      res.end('{"error":"Not found."}');
      return;
    }
    void handlePublic(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(503, { 'cache-control': 'no-store' });
      res.end();
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(4411, '127.0.0.1', resolveListen);
  });
  process.stdout.write(JSON.stringify({ status: 'listening', host: '127.0.0.1', port: 4411, path: PUBLIC_LEAD_PATH, origins, database: dataDir }) + '\n');
  const close = () => server.close(() => void db.close().then(() => process.exit(0)));
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

const [command, id] = process.argv.slice(2);
if (command === 'receipt') await receipt(id);
else if (command === 'start') await serve();
else throw new Error('Usage: node tools/website-intake-fixture.mjs <start|receipt <website-lead-id>>');
