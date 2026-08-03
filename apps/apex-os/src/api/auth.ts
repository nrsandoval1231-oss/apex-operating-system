import { z } from 'zod';
import { setToken } from './session';

/**
 * Staff sign-in — Authorization Code with PKCE.
 *
 * WHY PKCE AND NO CLIENT SECRET: a browser application cannot keep a secret.
 * Anything shipped to the browser is readable by anyone who opens the bundle, so
 * this is a public client and the proof of possession is a one-time code
 * verifier generated per attempt instead.
 *
 * WHERE THE CONFIG COMES FROM: `/api/auth/config`, on this app's own origin.
 * The server discovers the provider's endpoints once and hands them over, so the
 * browser makes one same-origin request rather than two cross-origin ones, and
 * nothing about which identity provider Apex uses is baked into this bundle.
 *
 * TOKEN STORAGE, AND WHAT IT COSTS: the access token goes in `sessionStorage`,
 * so it is scoped to the tab and gone when the browser closes — which matters on
 * a shared machine in an office. It is readable by JavaScript running on this
 * origin, so a script injection would expose it. The CSP served with this app is
 * `script-src 'self'` with no inline scripts and no third-party origins, which
 * is what makes that acceptable rather than merely convenient. The stronger
 * alternative is a backend-for-frontend holding an httpOnly cookie; that is a
 * real change to the API and is noted in the deployment plan rather than
 * pretended away here.
 *
 * NO REFRESH TOKENS. When the access token expires the app shows the sign-in
 * screen again. Refresh-token rotation in a public client is a meaningful amount
 * of machinery for a handful of staff who sign in once a day.
 */

const AuthConfigSchema = z.discriminatedUnion('mode', [
  /** Local development: tokens are issued out of band and pasted. */
  z.object({ mode: z.literal('pilot') }),
  z.object({
    mode: z.literal('oidc'),
    issuer: z.string().min(1),
    audience: z.string().min(1),
    clientId: z.string().min(1),
    authorizationEndpoint: z.string().url(),
    tokenEndpoint: z.string().url(),
  }),
]);

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const loadAuthConfig = async (): Promise<AuthConfig> => {
  const response = await fetch('/api/auth/config', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not read the sign-in configuration (HTTP ${response.status}).`);
  const parsed = AuthConfigSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('The sign-in configuration is not in a form this build understands.');
  return parsed.data;
};

/* ------------------------------------------------------------------- PKCE */

const VERIFIER_KEY = 'apex-pkce-verifier';
const STATE_KEY = 'apex-pkce-state';

const base64Url = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const randomUrlSafe = (byteLength: number): string =>
  base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

/**
 * S256, the only challenge method worth offering: `plain` proves nothing.
 *
 * Exported so it can be checked against the RFC 7636 test vector. A wrong
 * challenge does not fail loudly — the provider simply rejects every exchange,
 * and the symptom is "sign-in does not work" with nothing to read.
 */
export const pkceChallenge = async (verifier: string): Promise<string> =>
  base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

/** Where the provider sends the browser back. Must match the provider exactly. */
export const redirectUri = (): string => `${window.location.origin}/app/callback`;

/**
 * Start a sign-in.
 *
 * The verifier and state are kept in `sessionStorage` for the round trip: the
 * verifier so the token exchange can prove this browser started the flow, and
 * the state so a response that did not originate here is rejected.
 */
export const beginSignIn = async (config: Extract<AuthConfig, { mode: 'oidc' }>): Promise<void> => {
  const verifier = randomUrlSafe(32);
  const state = randomUrlSafe(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const authorize = new URL(config.authorizationEndpoint);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', config.clientId);
  authorize.searchParams.set('redirect_uri', redirectUri());
  authorize.searchParams.set('scope', 'openid profile email');
  // Without an audience the provider issues a token for its own userinfo
  // endpoint rather than for this API, and verification here would refuse it.
  authorize.searchParams.set('audience', config.audience);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', await pkceChallenge(verifier));
  authorize.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(authorize.toString());
};

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

/**
 * Finish a sign-in from the values the provider put in the URL.
 *
 * Returns the path to go to next. Throws with something a person can act on,
 * because the alternative on this screen is a blank page.
 */
export const completeSignIn = async (
  config: Extract<AuthConfig, { mode: 'oidc' }>,
  search: string,
): Promise<void> => {
  const params = new URLSearchParams(search);

  const providerError = params.get('error');
  if (providerError !== null) {
    // The provider refused. Its own description is more useful than anything
    // this app could invent.
    throw new Error(params.get('error_description') ?? `The identity provider refused the sign-in: ${providerError}`);
  }

  const code = params.get('code');
  const state = params.get('state');
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  // Cleared before anything else can fail, so a half-finished attempt cannot be
  // replayed by reloading the callback URL.
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (code === null) throw new Error('The identity provider did not return an authorization code.');
  if (verifier === null || expectedState === null) {
    throw new Error('This sign-in did not start in this tab. Start again from the sign-in screen.');
  }
  if (state !== expectedState) {
    // Either a stale tab or a response that did not originate here.
    throw new Error('The sign-in response did not match the request. Start again from the sign-in screen.');
  }

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`The token exchange failed (HTTP ${response.status}). ${detail.slice(0, 200)}`);
  }

  const parsed = TokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('The identity provider returned a token this build does not understand.');

  setToken(parsed.data.access_token);
};
