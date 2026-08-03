import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import type { Database } from '@apex/database';
import { StorageKeyError, type EvidenceStorage } from '@apex/storage';
import {
  ConstructionPhaseKeySchema,
  EventActorSchema,
  STAFF_ROLES,
  createCanonicalId,
  idSchemas,
  type AppRole,
  type CustomerContact,
  type EventActor,
  type GateInstanceId,
  type JobId,
} from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';
import { CustomerService, GateService, InspectionService } from '@apex/gate-service';
import { renderClosedPage, renderCustomerPage } from './customerPage.js';
import { log, redactPath } from './log.js';

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
const staffRoles: readonly AppRole[] = STAFF_ROLES;

/**
 * The built Apex OS app, served from this origin so it needs no dev proxy.
 *
 * The default is the workspace layout — `apps/apex-os/dist` relative to this
 * file's compiled location. `APEX_APP_DIR` overrides it, because a container
 * image is free to lay the two out differently and a relative path across
 * package boundaries is a coupling that should not decide the image layout.
 */
const appDirectory = process.env.APEX_APP_DIR?.trim()
  ? resolve(process.env.APEX_APP_DIR.trim())
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../apex-os/dist');

/** Same policy as the console, plus self-hosted font files. */
const APP_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; "
  + "connect-src 'self'; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const APP_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8',
};

const appContentType = (file: string): string =>
  APP_CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';

const readable = async (file: string): Promise<boolean> => {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
};

const OpenProjectSchema = z.strictObject({
  initialPhaseKey: ConstructionPhaseKeySchema.optional(),
  superintendentUserId: idSchemas.user.nullable().optional(),
});
const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ScheduleVisitSchema = z.strictObject({
  subcontractorId: idSchemas.subcontractor,
  phaseKey: ConstructionPhaseKeySchema,
  startsOn: DaySchema,
  endsOn: DaySchema,
  note: z.string().max(2000).optional(),
});

const MoveVisitSchema = z.strictObject({
  startsOn: DaySchema,
  endsOn: DaySchema,
  reason: z.string().min(1).max(2000).optional(),
});

/** Confirming an invoice records what a human did in the accounting system. */
const InvoiceConfirmationSchema = z.strictObject({
  invoiceReference: z.string().min(1).max(160),
  dueDate: DaySchema.optional(),
});

/** Shape only. Whether the definition exists is the service's call, not a regex's. */
const GateDefinitionKeySchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

const ChangePhaseSchema = z.strictObject({
  toPhaseKey: ConstructionPhaseKeySchema,
  reason: z.string().min(1).max(2000).optional(),
});

/** Calling an inspection in. The city may or may not give a date at the time. */
const RequestInspectionSchema = z.strictObject({
  requestedOn: DaySchema,
  scheduledFor: DaySchema.optional(),
  /** Overrides the deadline derived from crew bookings. */
  neededBy: DaySchema.optional(),
});

const InspectionResultInputSchema = z.strictObject({
  outcome: z.enum(['passed', 'failed', 'waived']),
  occurredOn: DaySchema,
  note: z.string().min(1).max(2000).optional(),
  corrections: z.string().min(1).max(2000).optional(),
});

const LinkReasonSchema = z.strictObject({
  reason: z.string().min(1).max(2000).optional(),
});

/** Publishing a photo to a customer, or taking it back down. */
const PhotoVisibilitySchema = z.strictObject({
  visible: z.boolean(),
  /** Written for the customer. The internal caption is never shown to them. */
  caption: z.string().min(1).max(300).nullable().optional(),
});

const RaiseDecisionSchema = z.strictObject({
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(2000),
  consequence: z.string().min(1).max(500),
  neededBy: DaySchema.optional(),
});

const ResolveDecisionSchema = z.strictObject({
  status: z.enum(['answered', 'withdrawn']),
  answerNote: z.string().min(1).max(2000).optional(),
});

/**
 * The customer link token, as it appears in a URL.
 *
 * 32 random bytes, base64url. Checked here so a malformed path never reaches a
 * query, and so the shape is stated in one place that the service also asserts.
 */
const CustomerTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * Headers every customer-facing response carries.
 *
 * `noindex` because a link forwarded into anything a crawler reads must not
 * become a search result. `no-referrer` because the token is in the path and a
 * referrer header would hand it to any host an image or link points at.
 * `no-store` on the HTML because a shared family laptop should not have the
 * page in its back-button cache.
 */
const CUSTOMER_HEADERS = {
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'self'; img-src 'self'; "
    + "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
} as const;
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

/**
 * Real identity — deployment plan slice 4.
 *
 * When present, staff tokens are verified against the provider's published
 * JWKS instead of a shared secret. Works with Auth0, Clerk, WorkOS, or anything
 * else OIDC: only these values differ.
 */
export interface OidcOptions {
  /** The `iss` every token must carry, e.g. https://apex.us.auth0.com/ */
  readonly issuer: string;
  /** The `aud` every token must carry. A token minted for another API is not
   *  a token for this one, and without this check it would be accepted. */
  readonly audience: string;
  /** Defaults to `<issuer>/.well-known/jwks.json`, which is where Auth0 and
   *  Clerk publish. Override for a provider that does not. */
  readonly jwksUri?: string;
}

interface GateApiOptions {
  readonly db: Database;
  /**
   * The pilot's symmetric secret. Required only when `oidc` is absent; a
   * deployment with a real provider configures no shared secret at all, so
   * there is none to leak or rotate.
   */
  readonly jwtSecret?: string;
  /** Set in any deployed environment; absent on a laptop. */
  readonly oidc?: OidcOptions;
  /**
   * The origin a customer reaches this server on, e.g. https://apex.example.com
   * — deployment plan slice 7.
   *
   * Absent on a laptop, where the issued link is a path and the staff screen
   * says plainly that it only works on this machine. Set in a deployment, the
   * issued link is a complete URL that can be texted to a homeowner.
   */
  readonly publicOrigin?: string;
  /**
   * Where gate evidence lives. A port, not a directory: the local adapter backs
   * development and the S3-compatible one backs deployment, and the API cannot
   * tell them apart.
   */
  readonly storage: EvidenceStorage;
  readonly maxEvidenceBytes?: number;
  /**
   * Canonical User ID to treat loopback requests as, with no token. Single-user
   * local pilot only — see `authenticate` for the guards and the warning.
   */
  readonly localUserId?: string;
  /**
   * How a customer reaches Apex from their progress page (§9.11's call/text
   * route). Omitted by default: the page prints no number rather than a wrong
   * one. Set from APEX_CUSTOMER_CONTACT_PHONE — see main.ts.
   */
  readonly customerContact?: CustomerContact;
}

const sendJson = (response: ServerResponse, status: number, value: unknown) => {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  response.end(body);
};

/**
 * What the access log records about a customer request.
 *
 * The address is coarsened to a network prefix inside the service, and the user
 * agent is truncated. Nothing else is taken: this log exists to notice a link
 * being passed around, not to profile the person reading it.
 */
const accessContext = (request: IncomingMessage) => ({
  ...(request.socket.remoteAddress ? { remoteAddress: request.socket.remoteAddress } : {}),
  ...(typeof request.headers['user-agent'] === 'string'
    ? { userAgent: request.headers['user-agent'] }
    : {}),
});

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
  /*
   * EXACTLY ONE IDENTITY MECHANISM, enforced here rather than in `main.ts`, so
   * the invariant lives with the thing it protects and is unit-testable.
   *
   * Accepting self-minted HS256 tokens alongside a real provider would be a
   * second, unaudited door into every staff endpoint — and from the outside the
   * deployment would look correctly configured.
   */
  if (options.oidc !== undefined && options.jwtSecret !== undefined) {
    throw new Error(
      'Configure an identity provider or a shared secret, not both: accepting self-minted '
      + 'tokens alongside a real provider is a second, unaudited door.',
    );
  }
  if (options.oidc === undefined) {
    if (!options.jwtSecret || Buffer.byteLength(options.jwtSecret) < 32) {
      throw new Error('GATE_JWT_SECRET must be at least 32 bytes when no identity provider is configured.');
    }
  }
  const secret = new TextEncoder().encode(options.jwtSecret ?? '');
  const service = new GateService(options.db);
  const customers = new CustomerService(options.db, {
    ...(options.customerContact ? { contact: options.customerContact } : {}),
    ...(options.publicOrigin ? { publicOrigin: options.publicOrigin } : {}),
    basePath: '/c',
  });
  const customerPhone = options.customerContact?.phone ?? null;
  const inspections = new InspectionService(options.db);
  const storage = options.storage;

  /**
   * The provider's signing keys, fetched lazily and cached by `jose`, which
   * refetches when a token arrives with an unknown `kid`. That is what makes
   * provider key rotation a non-event here rather than an outage.
   */
  const jwks: JWTVerifyGetKey | null = options.oidc
    ? createRemoteJWKSet(new URL(
      options.oidc.jwksUri ?? `${options.oidc.issuer.replace(/\/+$/, '')}/.well-known/jwks.json`,
    ))
    : null;
  const maxEvidenceBytes = options.maxEvidenceBytes ?? 25_000_000;

  /**
   * Single-machine pilot access.
   *
   * When `localUserId` is configured, a request arriving from this machine is
   * treated as that user and needs no token. It exists because pasting a
   * short-lived JWT to look at your own jobs on your own laptop is friction with
   * no security value: the server already binds to loopback, so anyone who can
   * reach it can read the database file directly.
   *
   * It is deliberately hard to switch on by accident:
   *   · off unless GATE_LOCAL_USER names a real, active user;
   *   · refused unless the connection came from a loopback address;
   *   · refused when the server is bound to anything but loopback (see main.ts).
   *
   * THIS IS NOT AN AUTHENTICATION MODEL. Production needs asymmetric/JWKS
   * identity, TLS, provisioning, and rotation — an open launch blocker in
   * docs/status.md. A deployment that reaches real users with this enabled has
   * no access control at all.
   */
  const isLoopback = (request: IncomingMessage): boolean => {
    const address = request.socket.remoteAddress ?? '';
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
  };

  const authenticate = async (request: IncomingMessage): Promise<EventActor> => {
    if (options.localUserId !== undefined && !request.headers.authorization) {
      if (!isLoopback(request)) {
        throw new AuthError('Local pilot access is limited to this machine.');
      }
      const users = await options.db.query<{ role: AppRole }>(
        `select role from app_users where user_id = $1 and active = true`,
        [options.localUserId],
      );
      const role = users.rows[0]?.role;
      if (role === undefined) throw new AuthError('The configured local pilot user is not active.');
      return EventActorSchema.parse({ kind: 'user', userId: options.localUserId, role });
    }

    try {
      const header = request.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw new AuthError('Bearer authentication is required.');
      const token = header.slice(7);

      /*
       * THE TOKEN PROVES WHO; THIS DATABASE DECIDES WHAT THEY MAY DO.
       *
       * Both paths below end the same way: resolve a row in `app_users` and take
       * the role from that row. A role claim is never trusted, on either path.
       * Putting Apex's authorization model inside the identity provider would
       * make adding a superintendent an IdP configuration change, and would make
       * a mis-set claim a privilege escalation.
       */
      const subject = jwks !== null
        ? await verifyWithProvider(token)
        : await verifyWithPilotSecret(token);

      const users = await options.db.query<{ user_id: string; role: AppRole }>(
        subject.kind === 'oidc'
          ? `select user_id, role from app_users where oidc_subject = $1 and active = true`
          : `select user_id, role from app_users where user_id = $1 and active = true`,
        [subject.value],
      );
      const row = users.rows[0];
      if (!row) throw new AuthError('No active Apex user is linked to this identity.');
      return EventActorSchema.parse({ kind: 'user', userId: row.user_id, role: row.role });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Authentication is invalid or expired.');
    }
  };

  /**
   * Verify against the provider's JWKS.
   *
   * `algorithms` is an allow-list of asymmetric signatures, and that is the
   * whole point: without it a token signed with HS256 using the *public* key as
   * the shared secret would verify, which is the classic JWT confusion attack.
   * Issuer and audience are both checked — a token minted by this provider for
   * a different API is not a token for this one.
   */
  const verifyWithProvider = async (token: string): Promise<{ kind: 'oidc'; value: string }> => {
    const oidc = options.oidc!;
    const { payload } = await jwtVerify(token, jwks!, {
      algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384'],
      issuer: oidc.issuer,
      audience: oidc.audience,
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AuthError('The identity provider issued a token with no subject.');
    }
    return { kind: 'oidc', value: payload.sub };
  };

  /**
   * The pilot's symmetric path, used only when no provider is configured.
   *
   * Kept so a laptop and the test suite have a way in without standing up an
   * identity provider. `main.ts` refuses to start with both configured, so this
   * cannot quietly remain reachable in a deployment.
   */
  const verifyWithPilotSecret = async (token: string): Promise<{ kind: 'pilot'; value: string }> => {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'apex-gate',
      audience: 'apex-gate-api',
    });
    if (typeof payload.sub !== 'string') throw new AuthError('Token has no subject.');
    return { kind: 'pilot', value: payload.sub };
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
      /*
       * Liveness: is this process running. Deliberately checks nothing else —
       * a platform restarting the container because the database blipped would
       * turn a recoverable outage into a crash loop.
       */
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, { status: 'ok' });
      }

      /*
       * Readiness: can this instance actually serve. Checks the two
       * dependencies it cannot work without, and answers 503 when either is
       * down so a load balancer stops sending traffic here.
       *
       * Booleans only. An unauthenticated endpoint should not describe *why*
       * something is broken.
       */
      if (request.method === 'GET' && url.pathname === '/ready') {
        const [database, evidence] = await Promise.all([
          options.db.query('select 1').then(() => true).catch(() => false),
          storage.isReachable(),
        ]);
        const ready = database && evidence;
        return sendJson(response, ready ? 200 : 503, { status: ready ? 'ready' : 'degraded', database, evidence });
      }
      // The Apex OS app, served from the same origin as the API it calls.
      //
      // In development Vite proxies /api to this server, which adds a hop that
      // can fail on its own and produces a "no connection" error that has
      // nothing to do with the API. Serving the built app here removes the hop:
      // one origin, one server, no proxy, and the same shape a deployment takes.
      if (request.method === 'GET' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
        const requested = url.pathname === '/app' ? '' : url.pathname.slice('/app/'.length);
        const target = resolve(appDirectory, requested);
        // Unknown paths fall back to index.html so client-side routes like
        // /app/today survive a refresh.
        const isAsset = requested !== '' && target.startsWith(`${appDirectory}${sep}`) && await readable(target);
        const file = isAsset ? target : resolve(appDirectory, 'index.html');
        const content = await readFile(file).catch(() => null);
        if (content === null) {
          return sendJson(response, 404, {
            error: 'The Apex OS app has not been built. Run: pnpm --filter @apex/os build',
          });
        }
        response.writeHead(200, {
          'content-type': appContentType(file),
          'content-length': content.length,
          'content-security-policy': APP_CSP,
          'referrer-policy': 'no-referrer',
          'x-content-type-options': 'nosniff',
          'cache-control': isAsset ? 'public, max-age=300' : 'no-store',
        });
        return response.end(content);
      }

      /* ------------------------------------------------------------------
       * The customer progress page — PRD §9.11.
       *
       * EVERYTHING BELOW THIS COMMENT AND ABOVE `authenticate` IS PUBLIC.
       * These two routes are the only ones in Apex OS that answer a request
       * carrying no identity at all. Authorization is the token: it names one
       * job, it can be revoked, and every read of it is recorded.
       *
       * They are placed here, ahead of `authenticate`, deliberately — a
       * customer has no account to authenticate with, and a route that fell
       * through to the staff authenticator would either 403 the customer or,
       * worse, treat a loopback request as the local pilot user.
       * ------------------------------------------------------------------ */

      const customerPhotoMatch = url.pathname.match(
        /^\/c\/([A-Za-z0-9_-]{43})\/photo\/(evidence_[0-9A-HJKMNP-TV-Z]{26})$/,
      );
      if (request.method === 'GET' && customerPhotoMatch) {
        const result = await customers.getPhoto(
          CustomerTokenSchema.parse(customerPhotoMatch[1]),
          idSchemas.evidence.parse(customerPhotoMatch[2]),
          accessContext(request),
        );
        if (result.outcome !== 'served') {
          response.writeHead(404, { ...CUSTOMER_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
          return response.end('Not found');
        }
        const content = await storage.get(result.storageKey);
        // A row can outlive its bytes if a restore was partial. The customer
        // gets the same "not found" as an unpublished photo rather than a 500.
        if (content === null) {
          response.writeHead(404, { ...CUSTOMER_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
          return response.end('Not found');
        }
        response.writeHead(200, {
          ...CUSTOMER_HEADERS,
          'content-type': result.mimeType,
          'content-length': content.length,
          // Ten minutes on the customer's own device. Re-downloading a gallery
          // over cellular every time they check the page is a real cost, and
          // the trade is stated rather than hidden: for that long after a
          // revocation, photos already on that device still open.
          'cache-control': 'private, max-age=600',
        });
        return response.end(content);
      }

      const customerPageMatch = url.pathname.match(/^\/c\/([A-Za-z0-9_-]{43})$/);
      if (request.method === 'GET' && customerPageMatch) {
        const result = await customers.getPage(
          CustomerTokenSchema.parse(customerPageMatch[1]),
          accessContext(request),
        );
        // A revoked link and a token that never existed render the same page
        // and return the same status. Distinguishing them would tell a stranger
        // that they had found a real link scheme.
        const body = result.outcome === 'served'
          ? renderCustomerPage(result.page)
          : renderClosedPage(customerPhone);
        response.writeHead(result.outcome === 'served' ? 200 : 404, {
          ...CUSTOMER_HEADERS,
          'content-type': 'text/html; charset=utf-8',
          'content-length': Buffer.byteLength(body),
          'cache-control': 'no-store',
        });
        return response.end(body);
      }

      if (request.method === 'GET' && ['/', '/gate-console.css', '/gate-console.js', '/favicon.svg', '/customer.css'].includes(url.pathname)) {
        const fileName = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const content = await readFile(resolve(publicDirectory, fileName));
        const contentType = appContentType(fileName);
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

      if (request.method === 'GET' && url.pathname === '/api/today') {
        requireStaff(actor);
        // The caller may pin the day for a reproducible feed; otherwise the
        // server's date is used. The derivation itself never reads a clock.
        const requested = url.searchParams.get('today');
        const today = requested === null ? new Date().toISOString().slice(0, 10) : DaySchema.parse(requested);
        return sendJson(response, 200, await service.getActionCards(today));
      }

      if (request.method === 'GET' && url.pathname === '/api/brief') {
        requireStaff(actor);
        const requested = url.searchParams.get('date');
        const briefDate = requested === null ? new Date().toISOString().slice(0, 10) : DaySchema.parse(requested);
        // Generates the day's brief on first read and returns the stored one
        // afterwards, so repeating this request is safe and always returns the
        // brief that was actually delivered that morning.
        return sendJson(response, 200, await service.getDailyBrief(briefDate));
      }

      if (request.method === 'GET' && url.pathname === '/api/jobs') {
        requireStaff(actor);
        return sendJson(response, 200, await service.listJobs());
      }

      const jobMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})$/);
      if (request.method === 'GET' && jobMatch) {
        requireStaff(actor);
        const summary = await service.getJob(idSchemas.job.parse(jobMatch[1]));
        if (summary === null) return sendJson(response, 404, { error: 'Job not found.' });
        return sendJson(response, 200, summary);
      }

      const projectMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/project$/);
      if (projectMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(projectMatch[1]);
        if (request.method === 'GET') {
          const project = await service.getProject(jobId);
          if (project === null) return sendJson(response, 404, { error: 'This job has no construction project yet.' });
          return sendJson(response, 200, project);
        }
        if (request.method === 'POST') {
          const body = OpenProjectSchema.parse(await readJson(request));
          const project = await service.openProject({
            jobId,
            actor,
            idempotencyKey: idempotency(request),
            ...(body.initialPhaseKey ? { initialPhaseKey: body.initialPhaseKey } : {}),
            ...(body.superintendentUserId !== undefined ? { superintendentUserId: body.superintendentUserId } : {}),
          });
          return sendJson(response, 201, project);
        }
      }

      const phaseMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/project\/phase$/);
      if (request.method === 'POST' && phaseMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(phaseMatch[1]);
        const body = ChangePhaseSchema.parse(await readJson(request));
        const project = await service.changeProjectPhase(jobId, {
          actor,
          at: new Date().toISOString(),
          toPhaseKey: body.toPhaseKey,
          ...(body.reason ? { reason: body.reason } : {}),
        }, { idempotencyKey: idempotency(request) });
        return sendJson(response, 200, project);
      }

      const historyMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/project\/history$/);
      if (request.method === 'GET' && historyMatch) {
        requireStaff(actor);
        return sendJson(response, 200, await service.getProjectPhaseHistory(idSchemas.job.parse(historyMatch[1])));
      }

      if (request.method === 'GET' && url.pathname === '/api/subcontractors') {
        requireStaff(actor);
        return sendJson(response, 200, await service.listSubcontractors());
      }

      const visitsMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/visits$/);
      if (visitsMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(visitsMatch[1]);
        if (request.method === 'GET') {
          return sendJson(response, 200, {
            visits: await service.listJobVisits(jobId),
            conflicts: await service.getJobVisitConflicts(jobId),
          });
        }
        if (request.method === 'POST') {
          const body = ScheduleVisitSchema.parse(await readJson(request));
          return sendJson(response, 201, await service.scheduleVisit({
            jobId,
            subcontractorId: body.subcontractorId,
            phaseKey: body.phaseKey,
            startsOn: body.startsOn,
            endsOn: body.endsOn,
            actor,
            ...(body.note ? { note: body.note } : {}),
          }));
        }
      }

      const moveMatch = url.pathname.match(/^\/api\/visits\/(visit_[0-9A-HJKMNP-TV-Z]{26})\/move$/);
      if (request.method === 'POST' && moveMatch) {
        requireStaff(actor);
        const body = MoveVisitSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.rescheduleVisit({
          visitId: idSchemas.visit.parse(moveMatch[1]),
          startsOn: body.startsOn,
          endsOn: body.endsOn,
          actor,
          ...(body.reason ? { reason: body.reason } : {}),
        }));
      }

      const drawsMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/draws$/);
      if (drawsMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(drawsMatch[1]);
        if (request.method === 'GET') {
          return sendJson(response, 200, await service.getDrawSchedule(jobId));
        }
        if (request.method === 'POST') {
          return sendJson(response, 201, await service.createDrawSchedule({
            jobId, actor, idempotencyKey: idempotency(request),
          }));
        }
      }

      const invoiceMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/draws\/([a-z0-9]+(?:-[a-z0-9]+)*)\/invoice$/,
      );
      if (request.method === 'POST' && invoiceMatch) {
        requireStaff(actor);
        const body = InvoiceConfirmationSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.markDrawInvoiced({
          jobId: idSchemas.job.parse(invoiceMatch[1]),
          drawCode: invoiceMatch[2] ?? '',
          invoiceReference: body.invoiceReference,
          actor,
          ...(body.dueDate ? { dueDate: body.dueDate } : {}),
        }));
      }

      const gateListMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/gates$/);
      if (request.method === 'GET' && gateListMatch) {
        requireStaff(actor);
        return sendJson(response, 200, await service.listJobGates(idSchemas.job.parse(gateListMatch[1])));
      }

      const createMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/gates\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
      if (request.method === 'POST' && createMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(createMatch[1]);
        const state = await service.createGate({
          gateInstanceId: createCanonicalId('gate'),
          jobId,
          definitionKey: GateDefinitionKeySchema.parse(createMatch[2]),
        });
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
        // Bytes first, then the row: an object with no row is invisible and
        // collectable, whereas a row with no object is a Gate citing evidence
        // that cannot be produced.
        await storage.put(storageKey, content, body.mimeType);
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
            await storage.remove(storageKey);
            return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
          }
          return sendJson(response, 201, { ...result, state: serializeGate(result.state), evidenceId });
        } catch (error) {
          await storage.remove(storageKey);
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

      const countersignMatch = url.pathname.match(/^\/api\/gates\/(gate_[0-9A-HJKMNP-TV-Z]{26})\/countersign$/);
      if (request.method === 'POST' && countersignMatch) {
        requireStaff(actor);
        const gateId = idSchemas.gate.parse(countersignMatch[1]);
        const result = await service.execute(gateId, {
          type: 'countersign-gate', actor, at: new Date().toISOString(),
        }, { idempotencyKey: idempotency(request) });
        return sendJson(response, 200, { ...result, state: serializeGate(result.state) });
      }


      /* ------------------------------------------------- inspections (§9.7) */

      if (request.method === 'GET' && url.pathname === '/api/inspection-types') {
        requireStaff(actor);
        return sendJson(response, 200, await inspections.listInspectionTypes());
      }

      const jobInspectionsMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/inspections$/,
      );
      if (request.method === 'GET' && jobInspectionsMatch) {
        requireStaff(actor);
        // All seven come back every time. An inspection nobody has touched is
        // returned with a null status, because "not requested" is a state the
        // feed has to act on rather than a row that is missing.
        return sendJson(response, 200, await inspections.listJobInspections(
          idSchemas.job.parse(jobInspectionsMatch[1]),
        ));
      }

      const requestInspectionMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/inspections\/([a-z0-9]+(?:-[a-z0-9]+)*)\/request$/,
      );
      if (request.method === 'POST' && requestInspectionMatch) {
        requireStaff(actor);
        const body = RequestInspectionSchema.parse(await readJson(request));
        return sendJson(response, 200, await inspections.requestInspection({
          jobId: idSchemas.job.parse(requestInspectionMatch[1]),
          inspectionKey: requestInspectionMatch[2] ?? '',
          requestedOn: body.requestedOn,
          actor,
          ...(body.scheduledFor ? { scheduledFor: body.scheduledFor } : {}),
          ...(body.neededBy ? { neededBy: body.neededBy } : {}),
        }));
      }

      const inspectionResultMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/inspections\/([a-z0-9]+(?:-[a-z0-9]+)*)\/result$/,
      );
      if (inspectionResultMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(inspectionResultMatch[1]);
        const key = inspectionResultMatch[2] ?? '';
        if (request.method === 'GET') {
          return sendJson(response, 200, await inspections.listResults(jobId, key));
        }
        if (request.method === 'POST') {
          const body = InspectionResultInputSchema.parse(await readJson(request));
          return sendJson(response, 200, await inspections.recordResult({
            jobId,
            inspectionKey: key,
            outcome: body.outcome,
            occurredOn: body.occurredOn,
            actor,
            ...(body.note ? { note: body.note } : {}),
            ...(body.corrections ? { corrections: body.corrections } : {}),
          }));
        }
      }

      /* --------------------------------------------- customer page, staff side */

      const linkMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/customer-link$/);
      if (linkMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(linkMatch[1]);
        if (request.method === 'GET') {
          return sendJson(response, 200, await customers.getLinkStatus(jobId));
        }
        if (request.method === 'POST') {
          // The response body carries the token in the clear. It is the only
          // time it exists outside the customer's browser, and it is not
          // recoverable afterwards — rotate to get a new one.
          return sendJson(response, 201, await customers.issueLink({ jobId, actor }));
        }
        if (request.method === 'DELETE') {
          const body = LinkReasonSchema.parse(await readJson(request).catch(() => ({})));
          return sendJson(response, 200, await customers.revokeLink({
            jobId, actor, ...(body.reason ? { reason: body.reason } : {}),
          }));
        }
      }

      const rotateMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/customer-link\/rotate$/,
      );
      if (request.method === 'POST' && rotateMatch) {
        requireStaff(actor);
        const body = LinkReasonSchema.parse(await readJson(request).catch(() => ({})));
        return sendJson(response, 201, await customers.rotateLink({
          jobId: idSchemas.job.parse(rotateMatch[1]),
          actor,
          ...(body.reason ? { reason: body.reason } : {}),
        }));
      }

      const previewMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/customer-preview$/,
      );
      if (request.method === 'GET' && previewMatch) {
        requireStaff(actor);
        // Exactly what the customer would see, without minting a token for a
        // staff screen and without logging Apex's own checks as customer reads.
        return sendJson(response, 200, await customers.previewPage(idSchemas.job.parse(previewMatch[1])));
      }

      const photosMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/photos$/);
      if (request.method === 'GET' && photosMatch) {
        requireStaff(actor);
        return sendJson(response, 200, await customers.listJobPhotos(idSchemas.job.parse(photosMatch[1])));
      }

      const visibilityMatch = url.pathname.match(
        /^\/api\/evidence\/(evidence_[0-9A-HJKMNP-TV-Z]{26})\/visibility$/,
      );
      if (request.method === 'POST' && visibilityMatch) {
        requireStaff(actor);
        const body = PhotoVisibilitySchema.parse(await readJson(request));
        return sendJson(response, 200, await customers.setPhotoVisibility({
          evidenceId: idSchemas.evidence.parse(visibilityMatch[1]),
          visible: body.visible,
          actor,
          ...(body.caption !== undefined ? { caption: body.caption } : {}),
        }));
      }

      const decisionsMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/decisions$/);
      if (decisionsMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(decisionsMatch[1]);
        if (request.method === 'GET') {
          return sendJson(response, 200, await customers.listDecisions(jobId));
        }
        if (request.method === 'POST') {
          const body = RaiseDecisionSchema.parse(await readJson(request));
          return sendJson(response, 201, await customers.raiseDecision({
            jobId,
            title: body.title,
            detail: body.detail,
            consequence: body.consequence,
            actor,
            ...(body.neededBy ? { neededBy: body.neededBy } : {}),
          }));
        }
      }

      const resolveMatch = url.pathname.match(
        /^\/api\/decisions\/(decision_[0-9A-HJKMNP-TV-Z]{26})\/resolve$/,
      );
      if (request.method === 'POST' && resolveMatch) {
        requireStaff(actor);
        const body = ResolveDecisionSchema.parse(await readJson(request));
        return sendJson(response, 200, await customers.resolveDecision({
          decisionId: idSchemas.customerDecision.parse(resolveMatch[1]),
          status: body.status,
          actor,
          ...(body.answerNote ? { answerNote: body.answerNote } : {}),
        }));
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
        const content = await storage.get(proof.storage_key);
        if (content === null) return sendJson(response, 404, { error: 'Evidence bytes are missing for this record.' });
        response.writeHead(200, { 'content-type': proof.mime_type, 'content-length': content.length, 'cache-control': 'private, no-store' });
        return response.end(content);
      }

      return sendJson(response, 404, { error: 'Route not found.' });
    } catch (error) {
      if (error instanceof AuthError) return sendJson(response, 403, { error: error.message });
      if (error instanceof StorageKeyError) return sendJson(response, 422, { error: error.message });
      if (error instanceof InputError || error instanceof z.ZodError) return sendJson(response, 422, { error: error instanceof Error ? error.message : 'Invalid input.' });
      if (error instanceof DomainRuleError) return sendJson(response, 409, { error: error.message });
      if (error instanceof Error && error.name === 'JWTExpired') return sendJson(response, 403, { error: 'Authentication expired.' });
      log.error('request.failed', error, {
        method: request.method ?? '',
        path: redactPath(new URL(request.url ?? '/', 'http://localhost').pathname),
      });
      return sendJson(response, 500, { error: 'Internal server error.' });
    }
  };

  /**
   * One line per request, after it completes.
   *
   * The path is redacted before it is written: a customer token lives in the
   * URL, and a log stream is retained and searchable. Health and readiness
   * checks are not logged — a platform probes them every few seconds and they
   * would bury everything else.
   */
  const logged = (request: IncomingMessage, response: ServerResponse) => {
    const started = Date.now();
    const path = redactPath(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (path === '/health' || path === '/ready') return void handler(request, response);
    response.on('finish', () => {
      log.info('request', {
        method: request.method ?? '',
        path,
        status: response.statusCode,
        durationMs: Date.now() - started,
      });
    });
    return void handler(request, response);
  };

  return createServer(logged);
}

class AuthError extends Error {}
class InputError extends Error {}
