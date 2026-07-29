import { resolve } from 'node:path';
import { createLocalDatabase } from '@apex/database';
import { createGateApi } from './server.js';

const secret = process.env.GATE_JWT_SECRET;
if (!secret) throw new Error('GATE_JWT_SECRET is required.');

const dataDirectory = resolve(process.env.GATE_DATA_DIRECTORY ?? './var/gate-db');
const evidenceDirectory = resolve(process.env.GATE_EVIDENCE_DIRECTORY ?? './var/gate-evidence');
const port = Number(process.env.PORT ?? 4100);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');

const db = await createLocalDatabase(dataDirectory);
const server = createGateApi({ db, jwtSecret: secret, evidenceDirectory });
server.listen(port, '127.0.0.1', () => {
  console.log(`Apex Gate API listening on http://127.0.0.1:${port}`);
});
