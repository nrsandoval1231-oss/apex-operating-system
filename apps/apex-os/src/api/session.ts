/**
 * Pilot session token.
 *
 * The controlled pilot issues short-lived, role-correct HS256 tokens out of band
 * (see docs/runbooks/gate-controlled-pilot.md). The browser never mints one. The
 * storage key is shared with the Gate field console so a token pasted into either
 * surface works in both.
 *
 * This is pilot-grade only. Production requires asymmetric/JWKS identity, TLS,
 * provisioning, and rotation — tracked as a launch blocker in docs/status.md.
 */
const TOKEN_KEY = 'apex-gate-token';

type Listener = (token: string) => void;
const listeners = new Set<Listener>();

const readStorage = (): string => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    // Storage can be unavailable in hardened browser configurations.
    return '';
  }
};

let current = readStorage();

export const getToken = (): string => current;

export const setToken = (token: string): void => {
  current = token.trim();
  try {
    if (current === '') sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, current);
  } catch {
    // Keep the in-memory token even when it cannot be persisted.
  }
  for (const listener of listeners) listener(current);
};

export const subscribeToToken = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
