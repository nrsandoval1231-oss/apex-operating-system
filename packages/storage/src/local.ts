import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  ObjectExistsError,
  assertStorageKey,
  type EvidenceStorage,
} from './client.js';

/**
 * Evidence on the local filesystem.
 *
 * This is what the loopback pilot has always used, lifted out of `server.ts`
 * unchanged in behaviour. It stays the development adapter after deployment:
 * needing object-storage credentials to run the app on a laptop would be a tax
 * on every change.
 */
export class LocalEvidenceStorage implements EvidenceStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  /**
   * Resolve a key to a path inside the root.
   *
   * `assertStorageKey` has already ruled out traversal, but this check stays as
   * well. It costs nothing, and it is the last line before a write lands
   * somewhere on the disk — the one place in this file where being wrong is
   * unrecoverable rather than merely broken.
   */
  private pathFor(key: string): string {
    assertStorageKey(key);
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new Error('Evidence storage key escaped the storage root.');
    }
    return path;
  }

  /**
   * Write to a temporary name and rename into place.
   *
   * `wx` fails rather than truncating if the temporary file exists, and
   * `rename` is atomic within a filesystem — so a reader never sees a partial
   * object, and a concurrent writer for the same key loses at `wx` instead of
   * interleaving bytes.
   */
  async put(key: string, content: Buffer, _contentType: string): Promise<void> {
    const path = this.pathFor(key);
    if (await this.exists(path)) throw new ObjectExistsError(key);
    const temporary = `${path}.upload`;
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(temporary, content, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new ObjectExistsError(key);
      throw error;
    }
    await rename(temporary, path);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async isReachable(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  describe(): string {
    return `local filesystem at ${this.root}`;
  }

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
