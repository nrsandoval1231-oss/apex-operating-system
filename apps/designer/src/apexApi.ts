/**
 * Designer's calls into the Gate API.
 *
 * They use the same staff session as Apex OS. The token lives in
 * `localStorage` under `apex-gate-token`, which is the key
 * `apps/apex-os/src/api/session.ts` writes after PKCE sign-in. Designer does
 * not import that module: Apex OS loads Designer, and the import would cycle.
 *
 * An empty token omits `Authorization`. That is what the loopback dev bypass
 * (`GATE_LOCAL_USER`) expects. A real staff session always sends
 * `Authorization: Bearer`. Without it the same routes answer 403 once the
 * bypass is off.
 */

export const APEX_STAFF_TOKEN_KEY = 'apex-gate-token';

export interface TokenStore {
  getItem(key: string): string | null;
}

const browserTokenStore = (): TokenStore | null => {
  const storage = (globalThis as { localStorage?: TokenStore }).localStorage;
  return storage ?? null;
};

/** The staff access token, or '' when nobody is signed in. */
export const readStaffToken = (storage?: TokenStore | null): string => {
  const source = storage === undefined ? browserTokenStore() : storage;
  if (source === null) return '';
  try {
    return source.getItem(APEX_STAFF_TOKEN_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
};

export const staffRequestHeaders = (
  headers: Readonly<Record<string, string>>,
  token: string = readStaffToken(),
): Record<string, string> => {
  if (token === '') return { ...headers };
  return { ...headers, authorization: `Bearer ${token}` };
};

export interface DesignerApiInit {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  /** When set, used instead of the stored staff session. */
  readonly token?: string;
  readonly storage?: TokenStore | null;
}

/**
 * One Gate API call from Designer.
 *
 * Writes carry an idempotency key, matching `apiSend` in Apex OS. Reads do not.
 */
export const designerApi = async (
  origin: string,
  path: string,
  init: DesignerApiInit = {},
): Promise<Response> => {
  const token = init.token ?? readStaffToken(init.storage);
  const hasBody = init.body !== undefined;
  const headers = staffRequestHeaders({
    accept: 'application/json',
    ...(hasBody
      ? { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }
      : {}),
  }, token);
  return fetch(`${origin}${path}`, {
    method: init.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
  });
};
