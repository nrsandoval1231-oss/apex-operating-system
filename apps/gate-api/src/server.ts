import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import type { PGlite } from '@electric-sql/pglite';
import {
  EventActorSchema,
  createCanonicalId,
  idSchemas,
  type AppRole,
  type EventActor,
  type GateInstanceId,
  type JobId,
} from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { GateService } from '@apex/gate-service';

const EvidenceUploadSchema = z.strictObject({
  requirementKey: z.string().min(1).max(120),
  kind: z.enum(['photo', 'video', 'document', 'measurement', 'inspection']),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']),
  contentBase64: z.string().min(4),
  capturedAt: z.string().datetime({ offset: true }),
  caption: z.string().max(1000).optional(),
});
const EvaluationSchema = z.strictObject({
  outcome: z.enum(['passed', 'failed']),
  note: z.string().max(2000).optional(),
});

const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'application/pdf': '.pdf',
};
const staffRoles: readonly AppRole[] = ['admin', 'office', 'field'];
const publicDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

const matchesDeclaredMimeType = (content: Buffer, mimeType: string) => {
  switch (mimeType) {
    case 'image/jpeg': return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
    case 'image/png': return content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp': return content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'video/mp4': return content.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'application/pdf': return content.subarray(0, 5).toString('ascii') === '%PDF-';
    default: return false;
  }
};

interface GateApiOptions {
  readonly db: PGlite;
  readonly jwtSecret: string;
  readonly evidenceDirectory: string;
  readonly maxEvidenceBytes?: number;
}

const sendJson = (response: ServerResponse, status: number, value: unknown) => {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  response.end(body);
};

const readJson = async (request: IncomingMessage, limit = 35_000_000): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error('Request body exceeds the configured limit.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
};

const serializeGate = (state: Awaited<ReturnType<GateService['getGate']>>) => ({
  ...state,
  requirements: [...state.requirements.values()],
});

export function createGateApi(options: GateApiOptions) {
  if (Buffer.byteLength(options.jwtSecret) < 32) throw new Error('GATE_JWT_SECRET must be at least 32 bytes.');
  const secret = new TextEncoder().encode(options.jwtSecret);
  const service = new GateService(options.db);
  const evidenceRoot = resolve(options.evidenceDirectory);
  const maxEvidenceBytes = options.maxEvidenceBytes ?? 25_000_000;

  const authenticate = async (request: IncomingMessage): Promise<EventActor> => {
    try {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new AuthError('Bearer authentication is required.');
      const { payload } = await jwtVerify(header.slice(7), secret, {
        algorithms: ['HS256'],
        issuer: 'apex-gate',
        audience: 'apex-gate-api',
      });
      const actor = EventActorSchema.parse({ kind: 'user', userId: payload.sub, role: payload.app_role });
      if (actor.kind !== 'user') throw new AuthError('User authentication is required.');
      const users = await options.db.query<{ role: AppRole }>(
        `select role from app_users where user_id = $1 and active = true`, [actor.userId],
      );
      if (users.rows[0]?.role !== actor.role) throw new AuthError('User access or role is no longer active.');
      return actor;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Authentication is invalid or expired.');
    }
  };

  const requireStaff = (actor: EventActor) => {
    if (actor.kind !== 'user' || !staffRoles.includes(actor.role)) throw new AuthError('Internal staff access is required.');
  };

  const idempotency = (request: IncomingMessage) => {
    const value = request.headers['idempotency-key'];
    if (typeof value !== 'string' || value.trim().length < 8) throw new InputError('Idempotency-Key with at least 8 characters is required.');
    return value;
  };

  const authorizeCustomerProjection = async (actor: EventActor, jobId: JobId) => {
    if (actor.kind !== 'user') throw new AuthError('User authentication is required.');
    if (staffRoles.includes(actor.role)) return;
    if (actor.role !== 'customer') throw new AuthError('Job access denied.');
    const access = await options.db.query(
      `select 1 from job_customer_access jca
       join app_users au on au.auth_user_id = jca.auth_user_id
       where jca.job_id = $1 and au.user_id = $2`,
      [jobId, actor.userId],
    );
    if (access.rows.length === 0) throw new AuthError('Job access denied.');
  };

  const handler = async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { status: 'ok' });
      }
      if (request.method === 'GET' && ['/', '/gate-console.css', '/gate-console.js'].includes(url.pathname)) {
        const fileName = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const content = await readFile(resolve(publicDirectory, fileName));
        const contentType = extname(fileName) === '.css'
          ? 'text/css; charset=utf-8'
          : extname(fileName) === '.js'
            ? 'text/javascript; charset=utf-8'
            : 'text/html; charset=utf-8';
        response.writeHead(200, {
          'content-type': contentType,
          'content-length': content.length,
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          'referrer-policy': 'no-referrer',
          'x-content-type-options': 'nosniff',
          'cache-control': fileName === 'index.html' ? 'no-store' : 'public, max-age=300',
        });
        return response.end(content);
      }
      const actor = await authenticate(request);

      const createMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/gates\/pre-gunite$/);
      if (request.method === 'POST' && createMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(createMatch[1]);
        const state = await service.createPreGuniteGate({ gateInstanceId: createCanonicalId('gate'), jobId });
        return sendJson(response, 201, serializeGate(state));
      }

      const gateMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})$/);
      if (request.method === 'GET' && gateMatch) {
        requireStaff(actor);
        return sendJson(response, 200, serializeGate(await service.getGate(idSchemas.gate.parse(gateMatch[1]))));
      }

      const startMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})\/start$/);
      if (request.method === 'POST' && startMatch) {
        requireStaff(actor);
        const gateId = idSchemas.gate.parse(startMatch[1]);
        const result = await service.execute(gateId, {
          type: 'start-gate', actor, at: new Date().toISOString(),
        }, { idempotencyKey: idempotency(request) });
        return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
      }

      const evidenceMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})\/evidence$/);
      if (request.method === 'POST' && evidenceMatch) {
        requireStaff(actor);
        const gateId = idSchemas.gate.parse(evidenceMatch[1]);
        const body = EvidenceUploadSchema.parse(await readJson(request));
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body.contentBase64)) throw new InputError('Evidence content is not valid base64.');
        const content = Buffer.from(body.contentBase64, 'base64');
        if (content.length === 0 || content.length > maxEvidenceBytes) throw new InputError('Evidence size is outside the allowed range.');
        if (!matchesDeclaredMimeType(content, body.mimeType)) throw new InputError('Evidence content does not match its declared MIME type.');
        const gate = await service.getGate(gateId);
        const evidenceId = createCanonicalId('evidence');
        const storageKey = `${gate.jobId}/${gateId}/${evidenceId}${extensions[body.mimeType]}`;
        const finalPath = resolve(evidenceRoot, storageKey);
        if (!finalPath.startsWith(`${evidenceRoot}${sep}`)) throw new InputError('Invalid evidence storage path.');
        const temporaryPath = `${finalPath}.upload`;
        await mkdir(dirname(finalPath), { recursive: true });
        await writeFile(temporaryPath, content, { flag: 'wx' });
        await rename(temporaryPath, finalPath);
        try {
          const result = await service.execute(gateId, {
            type: 'add-evidence', actor, at: body.capturedAt,
            requirementKey: body.requirementKey, evidenceId, kind: body.kind,
          }, {
            idempotencyKey: idempotency(request),
            evidence: {
              evidenceId,
              requirementKey: body.requirementKey,
              kind: body.kind,
              storageKey,
              sha256: createHash('sha256').update(content).digest('hex'),
              capturedAt: body.capturedAt,
              mimeType: body.mimeType,
              byteSize: content.length,
              ...(body.caption ? { caption: body.caption } : {}),
              metadata: {},
            },
          });
          if (result.duplicate) {
            await rm(finalPath, { force: true });
            return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
          }
          return sendJson(response, 201, { ...result, state: serializeGate(result.state), evidenceId });
        } catch (error) {
          await rm(finalPath, { force: true });
          throw error;
        }
      }

      const evaluationMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})\/requirements\/([^/]+)\/evaluate$/);
      if (request.method === 'POST' && evaluationMatch) {
        requireStaff(actor);
        const body = EvaluationSchema.parse(await readJson(request));
        const gateId = idSchemas.gate.parse(evaluationMatch[1]);
        const result = await service.execute(gateId, {
          type: 'evaluate-requirement', actor, at: new Date().toISOString(),
          requirementKey: decodeURIComponent(evaluationMatch[2] ?? ''), outcome: body.outcome,
          ...(body.note ? { note: body.note } : {}),
        }, { idempotencyKey: idempotency(request) });
        return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
      }

      const releaseMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})\/release$/);
      if (request.method === 'POST' && releaseMatch) {
        requireStaff(actor);
        const gateId = idSchemas.gate.parse(releaseMatch[1]);
        const result = await service.execute(gateId, {
          type: 'release-gate', actor, at: new Date().toISOString(),
        }, { idempotencyKey: idempotency(request) });
        return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
      }

      const customerMatch = url.pathname.match(/^\/api\/customer\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/milestones$/);
      if (request.method === 'GET' && customerMatch) {
        const jobId = idSchemas.job.parse(customerMatch[1]);
        await authorizeCustomerProjection(actor, jobId);
        return sendJson(response, 200, await service.getCustomerMilestones(jobId));
      }

      const proofMatch = url.pathname.match(/^\/api\/evidence\/(evidence_[0-9A-HJKMNP-TV-Z]{26})$/);
      if (request.method === 'GET' && proofMatch) {
        requireStaff(actor);
        const evidenceId = idSchemas.evidence.parse(proofMatch[1]);
        const rows = await options.db.query<{ storage_key: string; mime_type: string }>(
          `select storage_key, mime_type from evidence_records where evidence_id = $1`, [evidenceId],
        );
        const proof = rows.rows[0];
        if (!proof) return sendJson(response, 404, { error: 'Evidence not found.' });
        const path = resolve(evidenceRoot, proof.storage_key);
        if (!path.startsWith(`${evidenceRoot}${sep}`)) throw new InputError('Invalid evidence storage path.');
        const content = await readFile(path);
        response.writeHead(200, { 'content-type': proof.mime_type, 'content-length': content.length, 'cache-control': 'private, no-store' });
        return response.end(content);
      }

      return sendJson(response, 404, { error: 'Route not found.' });
    } catch (error) {
      if (error instanceof AuthError) return sendJson(response, 403, { error: error.message });
      if (error instanceof InputError || error instanceof z.ZodError) return sendJson(response, 422, { error: error instanceof Error ? error.message : 'Invalid input.' });
      if (error instanceof DomainRuleError) return sendJson(response, 409, { error: error.message });
      if (error instanceof Error && error.name === 'JWTExpired') return sendJson(response, 403, { error: 'Authentication expired.' });
      console.error(error);
      return sendJson(response, 500, { error: 'Internal server error.' });
    }
  };

  return createServer((request, response) => void handler(request, response));
}

class AuthError extends Error {}
class InputError extends Error {}
