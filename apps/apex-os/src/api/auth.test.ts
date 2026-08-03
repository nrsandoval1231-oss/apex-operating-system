import { describe, expect, it } from 'vitest';
import { pkceChallenge } from './auth';

/**
 * PKCE challenge derivation.
 *
 * Checked against the worked example in RFC 7636 Appendix B. This is worth a
 * test because getting it wrong fails silently from the user's side: the
 * provider rejects every code exchange, and the only symptom is that sign-in
 * does not work, with nothing in the browser to read.
 */
describe('the PKCE code challenge', () => {
  it('matches the RFC 7636 test vector', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('is base64url with no padding, which the query string requires', async () => {
    const challenge = await pkceChallenge('a'.repeat(43));
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).not.toContain('=');
  });
});
