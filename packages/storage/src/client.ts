/**
 * The evidence storage port — deployment plan slice 3.
 *
 * Gate evidence is the point of this system: photographs that prove a bar
 * spacing before gunite buried it, and that justify releasing money. Three
 * properties matter more than convenience, and they are enforced here rather
 * than left to each adapter to remember.
 *
 *   1. WRITE ONCE. Storing over an existing key is refused, not silently
 *      accepted. An evidence key contains the evidence id, so a collision means
 *      something has gone wrong upstream — and overwriting proof that a Gate was
 *      released against is the worst failure this component could have.
 *   2. KEYS ARE VALIDATED CENTRALLY. The key becomes a filesystem path in one
 *      adapter and a URL path in the other, so `..` or a leading slash is a
 *      traversal in both. `assertStorageKey` is an allow-list, checked before
 *      either adapter sees the value.
 *   3. A MISSING OBJECT IS `null`, NOT A THROW. Evidence can legitimately be
 *      absent — a database row can outlive its bytes if a restore was partial —
 *      and the caller has to render 404 rather than 500 for that case.
 */

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageKeyError';
  }
}

export class ObjectExistsError extends Error {
  constructor(key: string) {
    super(`An object already exists at ${key}; evidence storage is write-once.`);
    this.name = 'ObjectExistsError';
  }
}

/**
 * Slash-separated segments of unreserved characters, ending in an extension.
 *
 * Deliberately an allow-list. It admits exactly the shape the API produces —
 * `job_<ulid>/gate_<ulid>/evidence_<ulid>.jpg` — and nothing containing `..`,
 * a leading or doubled slash, a backslash, a control character, or a percent
 * escape that could decode into any of those.
 */
export const STORAGE_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)+\.[A-Za-z0-9]{1,8}$/;

/** Long enough for the real keys, short enough to rule out anything strange. */
const MAX_KEY_LENGTH = 300;

export function assertStorageKey(key: string): void {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new StorageKeyError('Evidence storage key is empty or too long.');
  }
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new StorageKeyError(`Evidence storage key is not a valid job-scoped path: ${key}`);
  }
}

export interface EvidenceStorage {
  /**
   * Store bytes at `key`. Throws `ObjectExistsError` if anything is already
   * there — see property 1 above.
   */
  put(key: string, content: Buffer, contentType: string): Promise<void>;

  /** The bytes, or null when nothing is stored at that key. */
  get(key: string): Promise<Buffer | null>;

  /**
   * Remove an object. Succeeds when the key is already absent, because the
   * only caller is a rollback path cleaning up after a failed write and it
   * cannot know how far the write got.
   */
  remove(key: string): Promise<void>;

  /** Used by the readiness check. Never throws. */
  isReachable(): Promise<boolean>;

  /** Shown at startup so the logs say where evidence is actually going. */
  describe(): string;
}
