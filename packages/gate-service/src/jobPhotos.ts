import { createHash } from 'node:crypto';
import type { Database, Queryable } from '@apex/database';
import {
  createCanonicalId,
  JobPhotoSchema,
  JobPhotoUploadSchema,
  STAFF_ROLES,
  type EventActor,
  type JobId,
  type JobPhoto,
} from '@apex/contracts';
import { DomainRuleError, RoleRefusalError } from '@apex/domain';
import { ObjectExistsError, type EvidenceStorage } from '@apex/storage';
import { assertJobMutable } from './jobState.js';
import { canonicalJson } from './canonicalJson.js';

export const MAX_JOB_PHOTO_BYTES = 8 * 1024 * 1024;
const extensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function decodeJobPhoto(base64: string, mime: string): Buffer {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new DomainRuleError('Photo content must be strict base64.');
  }
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > MAX_JOB_PHOTO_BYTES) {
    throw new DomainRuleError('Photos must be no larger than 8 MB.');
  }
  const matches =
    mime === 'image/jpeg'
      ? bytes.length >= 4 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      : mime === 'image/png'
        ? bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/webp' &&
          bytes.length >= 12 &&
          bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!matches || bytes.toString('base64') !== base64) {
    throw new DomainRuleError(
      'Photo bytes do not match their JPEG, PNG or WebP type. Convert HEIC to JPEG first.',
    );
  }
  return bytes;
}

export class JobPhotoService {
  constructor(
    private readonly db: Database,
    private readonly storage: EvidenceStorage,
  ) {}

  private async staff(tx: Queryable, actor: EventActor) {
    if (
      actor.kind !== 'user' ||
      !STAFF_ROLES.includes(actor.role as (typeof STAFF_ROLES)[number])
    ) {
      throw new RoleRefusalError('Active staff access is required for photos.');
    }
    // Keep the authenticated staff row active throughout the write transaction.
    const result = await tx.query<{ display_name: string }>(
      'select display_name from app_users where user_id=$1 and active=true and role=any($2::text[]) for share',
      [actor.userId, [...STAFF_ROLES]],
    );
    if (!result.rows[0])
      throw new RoleRefusalError('Active staff access is required for photos.');
    return { id: actor.userId, name: result.rows[0].display_name };
  }

  async upload(
    actor: EventActor,
    jobId: JobId,
    key: string,
    input: unknown,
  ): Promise<JobPhoto> {
    const body = JobPhotoUploadSchema.parse(input);
    if (key.trim().length < 8 || key.length > 200) {
      throw new DomainRuleError(
        'Idempotency key requires 8 to 200 characters.',
      );
    }
    const bytes = decodeJobPhoto(body.contentBase64, body.mimeType);
    const digest = createHash('sha256')
      .update(canonicalJson({ jobId, body }))
      .digest('hex');
    let ownedKey: string | null = null;
    try {
      return await this.db.transaction(async (tx) => {
        const user = await this.staff(tx, actor);
        await tx.query('select pg_advisory_xact_lock(hashtext($1))', [
          `photo:${key}`,
        ]);
        const saved = await tx.query<{
          actor_id: string;
          job_id: string;
          request_digest: string;
          response: unknown;
        }>(
          'select actor_id,job_id,request_digest,response from jobsite_photo_uploads where idempotency_key=$1',
          [key],
        );
        const prior = saved.rows[0];
        if (prior) {
          if (
            prior.actor_id !== user.id ||
            prior.job_id !== jobId ||
            prior.request_digest !== digest
          ) {
            throw new DomainRuleError(
              'This upload key is already bound to another photo, metadata, project or user.',
            );
          }
          return JobPhotoSchema.parse(prior.response);
        }
        // Historical exact retries above remain readable. New writes lock before storage.
        await assertJobMutable(tx, jobId);
        const id = createCanonicalId('evidence');
        const storageKey = `${jobId}/photos/${id}.${extensions[body.mimeType]}`;
        try {
          ownedKey = storageKey;
          await this.storage.put(storageKey, bytes, body.mimeType);
        } catch (error) {
          // Never delete a pre-existing object's bytes, even in a collision.
          if (
            error instanceof ObjectExistsError ||
            (error instanceof Error && error.name === 'ObjectExistsError')
          )
            ownedKey = null;
          throw error;
        }
        const metadata = {
          stage: body.stage ?? null,
          category: body.category ?? null,
          originalCapturedAt: body.originalCapturedAt ?? null,
          capturedLocal: body.capturedLocal ?? null,
        };
        const inserted = await tx.query<{ created_at: Date | string }>(
          `insert into evidence_records
           (evidence_id,job_id,kind,purpose,storage_key,sha256,captured_at,captured_by,mime_type,byte_size,caption,metadata)
           values($1,$2,'photo','jobsite-photo',$3,$4,coalesce($5::timestamptz,now()),$6,$7,$8,$9,$10::jsonb)
           returning created_at`,
          [
            id,
            jobId,
            storageKey,
            createHash('sha256').update(bytes).digest('hex'),
            body.originalCapturedAt ?? null,
            user.id,
            body.mimeType,
            bytes.length,
            body.caption ?? null,
            JSON.stringify(metadata),
          ],
        );
        const uploadedAt = new Date(inserted.rows[0]!.created_at).toISOString();
        const photo = JobPhotoSchema.parse({
          evidenceId: id,
          purpose: 'jobsite-photo',
          gateTitle: null,
          requirementKey: null,
          capturedAt: body.originalCapturedAt ?? uploadedAt,
          uploadedAt,
          uploaderName: user.name,
          ...metadata,
          objectReference: storageKey,
          internalCaption: body.caption ?? null,
          customerVisible: false,
          customerCaption: null,
          visibilitySetAt: null,
          visibilitySetByName: null,
        });
        await tx.query(
          `insert into jobsite_photo_uploads(idempotency_key,actor_id,job_id,evidence_id,request_digest,response)
           values($1,$2,$3,$4,$5,$6::jsonb)`,
          [key, user.id, jobId, id, digest, JSON.stringify(photo)],
        );
        return photo;
      });
    } catch (error) {
      if (ownedKey) {
        // An uncertain COMMIT must never delete a referenced object. If DB lookup
        // also fails, leave an invisible orphan for later reconciliation.
        try {
          const referenced = await this.db.query(
            'select 1 from evidence_records where storage_key=$1',
            [ownedKey],
          );
          if (referenced.rows.length === 0) await this.storage.remove(ownedKey);
        } catch {
          /* Preserve the original error; storage reconciliation is safe later. */
        }
      }
      throw error;
    }
  }
}
