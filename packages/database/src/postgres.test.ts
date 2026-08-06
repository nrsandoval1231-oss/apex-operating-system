/**
 * TLS resolution for the Postgres connection.
 *
 * This logic had no tests, and the first real deploy died on it: Render's database presents a
 * certificate signed by the provider's own CA, Node does not trust it, and the process exited
 * with DEPTH_ZERO_SELF_SIGNED_CERT before a single migration ran. The rules were sound — the
 * gap was that nothing exercised them and the blueprint never asked for a CA certificate.
 *
 * The property worth defending here is the one the implementation comment states: there is no
 * combination of inputs that produces TLS with verification disabled. Encrypted-but-
 * unauthenticated looks secure from the outside and authenticates nothing, so it must not be
 * reachable even by accident.
 */
import { describe, expect, it } from 'vitest';
import { resolveSsl } from './postgres.js';

const CA = '-----BEGIN CERTIFICATE-----\nMIIB…\n-----END CERTIFICATE-----\n';

describe('resolveSsl', () => {
  describe('local development', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      it(`is off for ${host}, which has no certificate to present`, () => {
        expect(resolveSsl(`postgres://apex:apex@${host}:5432/apex`)).toBe(false);
      });
    }
  });

  describe('anywhere else', () => {
    it('is on, and verifying, with no certificate supplied', () => {
      expect(resolveSsl('postgres://u:p@db.example.com:5432/apex')).toEqual({ rejectUnauthorized: true });
    });

    it('uses a supplied CA and still verifies', () => {
      expect(resolveSsl('postgres://u:p@db.example.com:5432/apex', CA))
        .toEqual({ rejectUnauthorized: true, ca: CA });
    });

    /**
     * Render's internal hostname has no dots and resolves only inside their network. It is
     * still not localhost, so it must still get TLS — the private network is not the same
     * claim as an authenticated peer.
     */
    it('treats a provider-internal hostname as remote, not local', () => {
      const ssl = resolveSsl('postgres://u:p@dpg-d9qaso3m8hqs7384al3g-a/apex', CA);
      expect(ssl).toEqual({ rejectUnauthorized: true, ca: CA });
    });
  });

  describe('sslmode=disable', () => {
    it('is honoured, because it is an explicit statement', () => {
      expect(resolveSsl('postgres://u:p@db.example.com:5432/apex?sslmode=disable')).toBe(false);
    });

    it('wins even when a CA is supplied, rather than half-applying both', () => {
      expect(resolveSsl('postgres://u:p@db.example.com:5432/apex?sslmode=disable', CA)).toBe(false);
    });
  });

  /**
   * The invariant, stated as a test rather than only as a comment. If someone later adds an
   * option that turns verification off while leaving TLS on, this fails.
   */
  it('never produces TLS with verification disabled, for any input', () => {
    const urls = [
      'postgres://u:p@db.example.com:5432/apex',
      'postgres://u:p@db.example.com:5432/apex?sslmode=require',
      'postgres://u:p@db.example.com:5432/apex?sslmode=verify-full',
      'postgres://u:p@dpg-internal-a/apex',
      'postgres://apex:apex@localhost:5432/apex',
      'postgres://u:p@db.example.com:5432/apex?sslmode=disable',
    ];
    for (const url of [...urls]) {
      for (const ca of [undefined, CA]) {
        const ssl = resolveSsl(url, ca);
        if (ssl === false) continue;
        expect(ssl, `${url} (ca: ${ca ? 'yes' : 'no'})`).toMatchObject({ rejectUnauthorized: true });
      }
    }
  });
});
