/**
 * The staff session token.
 *
 * WHERE IT LIVES, AND WHAT THAT COSTS. `localStorage`, deliberately — changed
 * from `sessionStorage` on 2026-08-07 after the first day of real use.
 *
 * The previous choice was defensible and is worth stating before it is
 * overruled: a tab-scoped token disappears when the browser closes, which
 * protects a shared machine in an office. What it also did was end the session
 * on every closed tab, with no refresh tokens behind it, so staff re-authenticated
 * constantly and the Gate field console — which shares this key — could not see a
 * session established in another tab at all. That pushed the field onto a
 * hand-pasted JWT, which is a worse credential practice than the one the
 * tab-scoping was protecting.
 *
 * So the trade is made in the open: **the session now survives a tab close and is
 * shared across tabs on this origin, and signing out is therefore something
 * somebody has to actually do.** Every surface carrying this token shows who is
 * signed in and offers Sign out. On a shared office machine an abandoned session
 * lasts until sign-out or until the provider's own expiry, and that is a real
 * exposure rather than a theoretical one.
 *
 * What has NOT changed: the token is still readable by any script on this origin,
 * which the `script-src 'self'` CSP is what makes acceptable. The PKCE verifier
 * and state stay in `sessionStorage` — they belong to one sign-in attempt in one
 * tab and must not outlive it.
 *
 * The stronger answer remains a backend-for-frontend holding an httpOnly cookie.
 * That is a real change to the API and is tracked in the deployment plan rather
 * than pretended away here.
 */
const TOKEN_KEY = 'apex-gate-token';

type Listener = (token: string) => void;
const listeners = new Set<Listener>();

const readStorage = (): string => {
  try {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored !== null) return stored;
    /*
     * One-time migration. Anyone signed in before this change has a token in the
     * old tab-scoped location; moving it across means the change does not sign
     * the whole company out mid-shift.
     */
    const legacy = sessionStorage.getItem(TOKEN_KEY);
    if (legacy !== null) {
      localStorage.setItem(TOKEN_KEY, legacy);
      sessionStorage.removeItem(TOKEN_KEY);
      return legacy;
    }
    return '';
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
    if (current === '') localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, current);
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

/*
 * Signing out in one tab has to sign out in the others. `storage` fires only in
 * OTHER tabs of this origin, which is exactly the audience that would otherwise
 * keep rendering a session that has been revoked — and, in the other direction,
 * lets a tab pick up a sign-in that happened somewhere else without a reload.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== TOKEN_KEY) return;
    const next = readStorage();
    if (next === current) return;
    current = next;
    for (const listener of listeners) listener(current);
  });
}
