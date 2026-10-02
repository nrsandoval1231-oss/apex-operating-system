import { beforeAll, describe, expect, it } from 'vitest';
import {
  ObjectExistsError,
  S3EvidenceStorage,
  StorageKeyError,
} from '../packages/storage/src/index.ts';

/**
 * The S3-compatible adapter against a real object store — deployment slice 3.
 *
 * `scripts/ci.sh` runs these when an S3-compatible endpoint is configured. The local adapter is covered by unit
 * tests; what cannot be covered there is the part that only exists over HTTP —
 * signing, status-code mapping, and whether the write-once guard actually holds
 * against a server rather than against a filesystem.
 *
 * Runs only when S3_ENDPOINT is set. Skipping locally is deliberate: needing a
 * running object store to `pnpm verify` on a laptop taxes every other change.
 */

const endpoint = process.env.S3_ENDPOINT?.trim();
const bucket = process.env.S3_BUCKET?.trim() ?? 'apex-evidence';
const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() ?? '';
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim() ?? '';
const region = process.env.S3_REGION?.trim() ?? 'us-east-1';
const available = Boolean(endpoint && accessKeyId && secretAccessKey);

if (!available) {
  console.warn(
    '\n  !  SKIPPING the S3 storage tests: S3_ENDPOINT is not set.'
    + '\n     scripts/ci.sh runs them when S3_ENDPOINT is set. Skipping is NOT a pass — the adapter'
    + '\n     is simply unverified in this environment.\n',
  );
}

let storage: S3EvidenceStorage;

/** A fresh key per run, so a rerun never trips the write-once guard on itself. */
const keyFor = (suffix: string) =>
  `job_01ARZ3NDEKTSV4RRFFQ69G5FAW/gate_01ARZ3NDEKTSV4RRFFQ69G5FAX/evidence_${suffix}.jpg`;
const unique = () => Math.abs(Date.now() % 1e9).toString(36).toUpperCase().padStart(26, 'A').slice(0, 26);

beforeAll(() => {
  if (!available) return;
  // The bucket is created by the CI setup, not here. Bucket creation is a
  // deployment act: the adapter has no CreateBucket call, and the credentials
  // the deployed app runs with should not carry that permission.
  storage = new S3EvidenceStorage({
    endpoint: endpoint!,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
  });
});

describe.skipIf(!available)('the S3-compatible adapter', () => {
  it('reports the bucket as reachable', async () => {
    expect(await storage.isReachable()).toBe(true);
  });

  it('round-trips bytes unchanged', async () => {
    const key = keyFor(unique());
    const content = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    await storage.put(key, content, 'image/jpeg');
    const read = await storage.get(key);
    // Byte-exact: evidence is hashed on the way in and the digest is what a
    // Gate release is signed against.
    expect(read?.equals(content)).toBe(true);
  });

  it('refuses to overwrite existing evidence', async () => {
    const key = keyFor(unique());
    await storage.put(key, Buffer.from('original'), 'image/jpeg');
    await expect(storage.put(key, Buffer.from('replacement'), 'image/jpeg'))
      .rejects.toThrow(ObjectExistsError);
    expect((await storage.get(key))?.toString()).toBe('original');
  });

  it('reports a missing object as null rather than throwing', async () => {
    expect(await storage.get(keyFor(unique()))).toBeNull();
  });

  it('removes idempotently', async () => {
    const key = keyFor(unique());
    await storage.put(key, Buffer.from('proof'), 'image/jpeg');
    await storage.remove(key);
    expect(await storage.get(key)).toBeNull();
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });

  it('validates the key before signing anything', async () => {
    // The same allow-list as the local adapter. Over HTTP a traversal would be
    // a path in a URL rather than on a disk, and it is refused in both.
    await expect(storage.get('../../escape.jpg')).rejects.toThrow(StorageKeyError);
    await expect(storage.put('/absolute.jpg', Buffer.from('x'), 'image/jpeg'))
      .rejects.toThrow(StorageKeyError);
  });

  it('reports a bad bucket as unreachable instead of throwing', async () => {
    const wrong = new S3EvidenceStorage({
      endpoint: endpoint!,
      bucket: 'apex-does-not-exist',
      region,
      accessKeyId,
      secretAccessKey,
    });
    // The readiness check has to answer false, not blow up the health endpoint.
    expect(await wrong.isReachable()).toBe(false);
  });
});
