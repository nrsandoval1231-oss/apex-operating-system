import { resolve } from 'node:path';
import { createLocalDatabase } from '@apex/database';
import { createGateApi } from './server.js';

const secret = process.env.GATE_JWT_SECRET;
if (!secret) throw new Error('GATE_JWT_SECRET is required.');

const dataDirectory = resolve(process.env.GATE_DATA_DIRECTORY ?? './var/gate-db');
const evidenceDirectory = resolve(process.env.GATE_EVIDENCE_DIRECTORY ?? './var/gate-evidence');
const port = Number(process.env.PORT ?? 4100);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');

/**
 * The host is fixed to loopback and is deliberately not configurable:
 * GATE_LOCAL_USER below removes authentication for anything that can reach this
 * server, and that trade is only defensible while "anything that can reach it"
 * means a process on this machine.
 */
const HOST = '127.0.0.1';

/**
 * Single-machine pilot: treat local requests as this user, with no token.
 * Unset it and every request needs a signed JWT again.
 */
const localUserId = process.env.GATE_LOCAL_USER?.trim() || undefined;
if (localUserId !== undefined && !/^user_[0-9A-HJKMNP-TV-Z]{26}$/.test(localUserId)) {
  throw new Error('GATE_LOCAL_USER must be a canonical user_<ULID> identifier.');
}

const db = await createLocalDatabase(dataDirectory);
const server = createGateApi({
  db,
  jwtSecret: secret,
  evidenceDirectory,
  ...(localUserId ? { localUserId } : {}),
});

server.listen(port, HOST, () => {
  console.log(`Apex OS             http://${HOST}:${port}/app`);
  console.log(`Gate field console  http://${HOST}:${port}/`);
  if (localUserId) {
    console.warn(
      `\n  !  LOCAL PILOT MODE: requests from this machine act as ${localUserId} with no token.`
      + '\n     Single-user local use only. Never run this where anyone else can reach it.\n',
    );
  }
});
