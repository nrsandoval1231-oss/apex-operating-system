import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the staff session is kept.
 *
 * This moved from `sessionStorage` to `localStorage` on 2026-08-07, which is a
 * deliberate loosening: the session now outlives the tab so that staff stop
 * re-authenticating all day and the Project workspace can see a sign-in that
 * happened in Apex OS. The parts worth testing are the ones that fail quietly —
 * a migration that drops the existing session would sign the company out
 * mid-shift, and a cross-tab listener that does not fire would leave a signed-out
 * tab still rendering somebody's jobs.
 *
 * There is no DOM in this suite, so storage and `window` are stubbed and the
 * module is re-imported per case: it reads storage once at import time.
 */

class FakeStorage {
  private readonly entries = new Map<string, string>();
  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

let local: FakeStorage;
let session: FakeStorage;
let storageListener: ((event: { key: string | null }) => void) | null;

const loadModule = async () => {
  vi.resetModules();
  return import('./session');
};

beforeEach(() => {
  local = new FakeStorage();
  session = new FakeStorage();
  storageListener = null;
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: (event: { key: string | null }) => void) => {
      if (type === 'storage') storageListener = listener;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the staff session token', () => {
  it('persists to localStorage so it survives a closed tab', async () => {
    const { setToken, getToken } = await loadModule();
    setToken('token-abc');

    expect(getToken()).toBe('token-abc');
    expect(local.getItem('apex-gate-token')).toBe('token-abc');
  });

  /**
   * The whole point of the change: the field console reads the same key on the
   * same origin, so signing in at /app signs you in there too.
   */
  it('is readable by anything else on this origin reading the shared key', async () => {
    const { setToken } = await loadModule();
    setToken('token-shared');
    expect(local.getItem('apex-gate-token')).toBe('token-shared');
  });

  /** Signing out has to actually remove it, not just blank the variable. */
  it('clears storage when signed out', async () => {
    const { setToken, getToken } = await loadModule();
    setToken('token-abc');
    setToken('');

    expect(getToken()).toBe('');
    expect(local.getItem('apex-gate-token')).toBeNull();
  });

  /**
   * Anyone signed in when this shipped had a token in the old tab-scoped place.
   * Without this they would have been signed out with no explanation.
   */
  it('migrates a token left in the old tab-scoped location', async () => {
    session.setItem('apex-gate-token', 'legacy-token');

    const { getToken } = await loadModule();

    expect(getToken()).toBe('legacy-token');
    expect(local.getItem('apex-gate-token')).toBe('legacy-token');
    // Moved rather than copied: two copies of a credential is one too many.
    expect(session.getItem('apex-gate-token')).toBeNull();
  });

  it('prefers the current location over a stale legacy value', async () => {
    local.setItem('apex-gate-token', 'current-token');
    session.setItem('apex-gate-token', 'legacy-token');

    const { getToken } = await loadModule();
    expect(getToken()).toBe('current-token');
  });

  /**
   * `storage` fires only in OTHER tabs, which is exactly the audience that would
   * otherwise keep showing a session that has been signed out.
   */
  it('picks up a sign-out performed in another tab', async () => {
    local.setItem('apex-gate-token', 'token-abc');
    const { getToken } = await loadModule();
    expect(getToken()).toBe('token-abc');

    local.removeItem('apex-gate-token');
    storageListener?.({ key: 'apex-gate-token' });

    expect(getToken()).toBe('');
  });

  it('notifies subscribers when another tab signs in', async () => {
    const { subscribeToToken, getToken } = await loadModule();
    const seen: string[] = [];
    subscribeToToken((token) => seen.push(token));

    local.setItem('apex-gate-token', 'token-from-other-tab');
    storageListener?.({ key: 'apex-gate-token' });

    expect(getToken()).toBe('token-from-other-tab');
    expect(seen).toEqual(['token-from-other-tab']);
  });

  /** An unrelated key changing is not a session event. */
  it('ignores storage events for other keys', async () => {
    local.setItem('apex-gate-token', 'token-abc');
    const { subscribeToToken } = await loadModule();
    const seen: string[] = [];
    subscribeToToken((token) => seen.push(token));

    storageListener?.({ key: 'apex-job-id' });

    expect(seen).toEqual([]);
  });

  /**
   * Hardened browsers can refuse storage entirely. Losing persistence is
   * survivable; throwing on sign-in is not.
   */
  it('keeps working in memory when storage is unavailable', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    });

    const { setToken, getToken } = await loadModule();
    expect(() => setToken('token-abc')).not.toThrow();
    expect(getToken()).toBe('token-abc');
  });
});
