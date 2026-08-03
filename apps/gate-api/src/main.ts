import { resolve } from 'node:path';
import {
  PostgresDatabase,
  applyOperationalMigrations,
  createLocalDatabase,
  type Database,
} from '@apex/database';
import { LocalEvidenceStorage, S3EvidenceStorage, type EvidenceStorage } from '@apex/storage';
import { createGateApi } from './server.js';

const secret = process.env.GATE_JWT_SECRET;
if (!secret) throw new Error('GATE_JWT_SECRET is required.');

const dataDirectory = resolve(process.env.GATE_DATA_DIRECTORY ?? './var/gate-db');
const evidenceDirectory = resolve(process.env.GATE_EVIDENCE_DIRECTORY ?? './var/gate-evidence');

/**
 * Evidence storage — object storage when configured, local filesystem otherwise.
 *
 * Same rule as the database: selected by the presence of configuration rather
 * than a mode flag, so there is no way to be pointed at a bucket and still be
 * writing to disk. Partial S3 configuration is a hard failure rather than a
 * silent fallback — evidence quietly landing on an ephemeral container disk is
 * exactly the kind of thing nobody notices until it is needed.
 */
const s3Endpoint = process.env.S3_ENDPOINT?.trim();
const s3Parts = {
  bucket: process.env.S3_BUCKET?.trim(),
  accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim(),
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim(),
};
if (s3Endpoint) {
  const missing = Object.entries(s3Parts).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`S3_ENDPOINT is set but these are missing: ${missing.join(', ')}.`);
  }
}
const storage: EvidenceStorage = s3Endpoint
  ? new S3EvidenceStorage({
    endpoint: s3Endpoint,
    bucket: s3Parts.bucket!,
    accessKeyId: s3Parts.accessKeyId!,
    secretAccessKey: s3Parts.secretAccessKey!,
    region: process.env.S3_REGION?.trim() || 'auto',
  })
  : new LocalEvidenceStorage(evidenceDirectory);
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

/**
 * The number a customer calls or texts from their progress page (§9.11).
 *
 * Unset by default. A page that prints a number nobody configured is worse than
 * one that prints none: a customer will dial it at the moment they most wanted
 * an answer and reach nobody.
 */
const contactPhone = process.env.APEX_CUSTOMER_CONTACT_PHONE?.trim();
if (contactPhone !== undefined && contactPhone !== '' && !/^\+[1-9]\d{6,14}$/.test(contactPhone)) {
  throw new Error('APEX_CUSTOMER_CONTACT_PHONE must be in E.164 form, e.g. +18065551234.');
}
const customerContact = contactPhone
  ? {
    phone: contactPhone,
    label: process.env.APEX_CUSTOMER_CONTACT_LABEL?.trim()
      || 'Call or text us any time — we would rather answer a question than have you wonder.',
  }
  : undefined;

/**
 * Managed Postgres when DATABASE_URL is set, embedded Postgres otherwise.
 *
 * Chosen by the presence of the variable rather than by a mode flag, so there is
 * no way to point at a real database and still be running the embedded one.
 * Migrations run under an advisory lock on the managed path: two instances
 * starting together would otherwise race the same migration, and the loser
 * would crash-loop.
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
let db: Database;
let closeDatabase: () => Promise<void> = async () => undefined;

if (databaseUrl) {
  const postgres = PostgresDatabase.create({
    url: databaseUrl,
    ...(process.env.DATABASE_CA_CERT ? { caCertificate: process.env.DATABASE_CA_CERT } : {}),
    ...(process.env.DATABASE_MAX_CONNECTIONS
      ? { maxConnections: Number(process.env.DATABASE_MAX_CONNECTIONS) }
      : {}),
  });
  await postgres.withMigrationLock((client) => applyOperationalMigrations(client));
  db = postgres;
  closeDatabase = () => postgres.close();
  console.log('Database            managed Postgres');
} else {
  db = await createLocalDatabase(dataDirectory);
  console.log(`Database            embedded Postgres at ${dataDirectory}`);
}
const server = createGateApi({
  db,
  jwtSecret: secret,
  storage,
  ...(localUserId ? { localUserId } : {}),
  ...(customerContact ? { customerContact } : {}),
});

/**
 * Finish what is in flight before exiting.
 *
 * An evidence upload cut off mid-write leaves a file with no row pointing at
 * it, which is the one kind of orphan this system should not create on a
 * routine deploy.
 */
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`\n${signal} received; finishing in-flight requests.`);
    server.close(() => {
      void closeDatabase().then(() => process.exit(0));
    });
  });
}

server.listen(port, HOST, () => {
  console.log(`Evidence            ${storage.describe()}`);
  console.log(`Apex OS             http://${HOST}:${port}/app`);
  console.log(`Gate field console  http://${HOST}:${port}/`);
  if (customerContact === undefined) {
    console.warn(
      '  !  No APEX_CUSTOMER_CONTACT_PHONE set: customer progress pages will show no call or text route.',
    );
  }
  if (localUserId) {
    console.warn(
      `\n  !  LOCAL PILOT MODE: requests from this machine act as ${localUserId} with no token.`
      + '\n     Single-user local use only. Never run this where anyone else can reach it.\n',
    );
  }
});
