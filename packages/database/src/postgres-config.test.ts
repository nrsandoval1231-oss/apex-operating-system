import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { PostgresDatabase } from './postgres.js';

describe('effective PostgreSQL TLS configuration', () => {
  for (const url of ['postgres://u:p@localhost/apex', 'postgres://u:p@db.example.com/apex?sslmode=disable']) {
    it(`preserves explicitly unencrypted or local connections: ${new URL(url).hostname}`, async () => {
      const db = PostgresDatabase.create({ url });
      try {
        const pool = (db as unknown as { pool: pg.Pool }).pool;
        const client = new pg.Client(pool.options);
        expect((client as unknown as { connectionParameters: { ssl: unknown } }).connectionParameters.ssl).toBe(false);
      } finally { await db.close(); }
    });
  }

  for (const query of ['sslmode=require', 'sslmode=no-verify', 'sslmode=verify-full', 'sslmode=require&uselibpqcompat=true', 'ssl=false', 'sslrootcert=/missing-audit-ca.pem', 'sslkey=/missing-audit-key.pem&sslcert=/missing-audit-cert.pem']) {
    it(`preserves peer verification and the configured CA with ${query}`, async () => {
      const db = PostgresDatabase.create({ url: `postgres://u:p@db.example.com/apex?${query}`, caCertificate: 'audit-ca' });
      try {
        // Exercise the driver's connection-string parsing, not just resolveSsl.
        const pool = (db as unknown as { pool: pg.Pool }).pool;
        const client = new pg.Client(pool.options);
        const effective = (client as unknown as { connectionParameters: { ssl: unknown } }).connectionParameters.ssl;
        expect(effective).toEqual({ rejectUnauthorized: true, ca: 'audit-ca' });
      } finally { await db.close(); }
    });
  }
});
