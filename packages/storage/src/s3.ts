import { AwsClient } from 'aws4fetch';
import {
  ObjectExistsError,
  assertStorageKey,
  type EvidenceStorage,
} from './client.js';

/**
 * Evidence in S3-compatible object storage.
 *
 * Works against Cloudflare R2, AWS S3, Backblaze B2, and DigitalOcean Spaces —
 * anything speaking the S3 API — because the only thing provider-specific is the
 * endpoint.
 *
 * WHY NOT THE AWS SDK: four operations are needed (put, get, delete, head) and
 * none of them needs multipart, since evidence is capped well below the 5 GB
 * single-PUT limit. `aws4fetch` signs a `fetch` and weighs a few kilobytes,
 * against tens of megabytes of SDK. The requests below are the whole surface, so
 * they are worth being able to read.
 *
 * WHAT IS DELIBERATELY NOT HERE: presigned URLs. Evidence is served through the
 * API on both the staff and customer paths, which is where authorization already
 * lives. Handing out a URL that works without passing through those checks would
 * put an unrevokable, unlogged door on the one thing this system exists to keep
 * trustworthy.
 */

export interface S3Options {
  /** e.g. https://<account>.r2.cloudflarestorage.com or https://s3.<region>.amazonaws.com */
  readonly endpoint: string;
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export class S3EvidenceStorage implements EvidenceStorage {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(private readonly options: S3Options) {
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
      service: 's3',
    });
    this.base = `${options.endpoint.replace(/\/+$/, '')}/${options.bucket}`;
  }

  /**
   * The key is safe to interpolate because `assertStorageKey` has already
   * restricted it to unreserved characters and single slashes — there is
   * nothing left for a URL to misread.
   */
  private urlFor(key: string): string {
    assertStorageKey(key);
    return `${this.base}/${key}`;
  }

  /**
   * Store bytes, refusing to replace anything already there.
   *
   * Two guards, because neither is sufficient alone:
   *
   *   · `If-None-Match: *` makes the write conditional at the server. S3 and R2
   *     support it and answer 412 when the object exists. A provider that does
   *     not support it *ignores the header silently*, which is why it is not the
   *     only guard.
   *   · A HEAD first, which catches the ordinary case everywhere but is racy
   *     under genuine contention.
   *
   * In practice the key carries a freshly minted evidence ULID, so a real
   * collision means a bug upstream rather than two writers competing. These
   * guards exist to make that bug loud instead of silently destroying proof a
   * Gate was released against.
   */
  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    const url = this.urlFor(key);
    const existing = await this.client.fetch(url, { method: 'HEAD' });
    if (existing.ok) throw new ObjectExistsError(key);

    const response = await this.client.fetch(url, {
      method: 'PUT',
      body: new Uint8Array(content),
      headers: {
        'content-type': contentType,
        'content-length': String(content.length),
        'if-none-match': '*',
      },
    });
    if (response.status === 412) throw new ObjectExistsError(key);
    if (!response.ok) {
      throw new Error(`Evidence upload failed: ${response.status} ${await this.detail(response)}`);
    }
  }

  async get(key: string): Promise<Buffer | null> {
    const response = await this.client.fetch(this.urlFor(key), { method: 'GET' });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Evidence read failed: ${response.status} ${await this.detail(response)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    const response = await this.client.fetch(this.urlFor(key), { method: 'DELETE' });
    // S3 answers 204 whether or not the object was there, which is the
    // idempotence the port asks for.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Evidence delete failed: ${response.status} ${await this.detail(response)}`);
    }
  }

  async isReachable(): Promise<boolean> {
    try {
      // Listing zero keys proves credentials and bucket without reading data.
      const response = await this.client.fetch(`${this.base}?list-type=2&max-keys=0`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  describe(): string {
    return `S3-compatible bucket ${this.options.bucket} at ${this.options.endpoint}`;
  }

  /** Providers return XML on error; the first 200 characters is enough to act on. */
  private async detail(response: Response): Promise<string> {
    try {
      return (await response.text()).slice(0, 200);
    } catch {
      return '(no body)';
    }
  }
}
