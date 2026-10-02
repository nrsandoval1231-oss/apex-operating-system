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
  DesignerTakeoffSubmissionSchema,
  EventActorSchema,
  readLeadIdentity,
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

/**
 * The staff app's policy — same as the console, plus self-hosted fonts.
 *
 * `connect-src` has to include the identity provider's origin. The PKCE token
 * exchange is a cross-origin POST from the browser to the provider's token
 * endpoint, and a bare `'self'` blocks it — silently, from the user's side, as
 * "sign-in does nothing". Only the origin is allowed, not the whole internet.
 *
 * `font-src` allows `data:` because the build inlines small font files as data
 * URIs. `'self'` alone blocked the app's OWN typeface on every page: the console
 * logged a CSP violation and the UI quietly fell back to a substitute face. The
 * allowance is narrow — a data URI is bytes the page already carries, not a
 * fetch to anywhere — and it buys back the typography the app ships with.
 */
const appCsp = (issuer: string | undefined): string => {
  const providerOrigin = issuer === undefined ? '' : ` ${new URL(issuer).origin}`;
  return "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self' data:; "
    + `connect-src 'self'${providerOrigin}; img-src 'self' blob: data:; `
    + "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
};

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

const UpdateTargetSchema = z.strictObject({
  targetCompletionStart: DaySchema.nullable(),
  targetCompletionEnd: DaySchema.nullable(),
});

/** Confirming an invoice records what a human did in the accounting system. */
/** Null clears the assignment: taking somebody off a job is a real intention. */
const AssignSuperintendentSchema = z.strictObject({
  superintendentUserId: idSchemas.user.nullable(),
});

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

const ManualProjectIntakeSchema = z.strictObject({
  customerName: z.string().trim().min(1).max(200),
  streetAddress: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().min(5).max(20),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(240).optional(),
  referralSource: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const DirectPriceInputSchema = z.strictObject({
  code: z.union([z.literal(300), z.literal(500), z.literal(600), z.literal(900),
    z.literal(1100), z.literal(1200), z.literal(1300)]),
  name: z.string().trim().min(1).max(200),
  scopeStatus: z.enum(['quoted', 'not-applicable', 'unresolved']),
  amountCents: z.number().int().nonnegative().nullable(),
  basis: z.string().trim().min(1).max(1000),
});
  const FinishEstimateSchema = z.strictObject({
    submission: DesignerTakeoffSubmissionSchema,
    directLines: z.array(DirectPriceInputSchema),
    measuredLines: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), amountCents: z.number().int().nonnegative().nullable(), basis: z.string().trim().min(1).max(1000) })),
  feeRateBps: z.number().int().min(0).max(10000),
});
  const ExpectedProposalVersionSchema = z.strictObject({
    expectedVersionNumber: z.number().int().positive(),
    expectedDraftRevision: z.number().int().positive(),
  });
  const SignProposalSchema = ExpectedProposalVersionSchema.extend({
    customerAcceptanceConfirmed: z.literal(true),
  });
  const UpdateProposalDraftSchema = FinishEstimateSchema.pick({ directLines: true, measuredLines: true, feeRateBps: true }).extend({
  expectedVersionNumber: z.number().int().positive(),
  expectedDraftRevision: z.number().int().positive(),
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
  /**
   * The public client id the staff app authenticates with.
   *
   * Public by design: a browser application cannot keep a secret, which is why
   * the login flow is Authorization Code with PKCE and no client secret exists
   * anywhere in this system.
   */
  readonly clientId: string;
  /**
   * Overrides OIDC discovery. Normally absent — the endpoints are read from
   * `<issuer>/.well-known/openid-configuration`, because Auth0 and Clerk do not
   * agree on their paths and hard-coding either one would silently bind this to
   * a single vendor.
   */
  readonly authorizationEndpoint?: string;
  readonly tokenEndpoint?: string;
}

/**
 * Cloudflare Access — staging identity.
 *
 * Access already answered "is this browser the allowed Gmail?" at the edge and
 * injected `Cf-Access-Jwt-Assertion`. This server checks that assertion and
 * then loads the role from `app_users`. It does not accept a pasted gate token
 * at the same time: two ways in would be two doors.
 */
export interface AccessOptions {
  /** Team name only, the subdomain of `<team>.cloudflareaccess.com`. */
  readonly team: string;
  /** Access application AUD tag. */
  readonly audience: string;
  /** The one email allowed to act as staff. Compared case-insensitively. */
  readonly email: string;
  /** `app_users.user_id` for that person. The token does not choose the role. */
  readonly userId: string;
  /** Defaults to the team's Access certs URL. Tests point this at a local JWKS. */
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
   * Cloudflare Access as the only staff identity. Mutually exclusive with
   * `oidc` and `jwtSecret`. See `AccessOptions`.
   */
  readonly access?: AccessOptions;
  /**
   * Staging crawler block. Every response gets `X-Robots-Tag: noindex`, and
   * `GET /robots.txt` disallows the whole origin. Off unless the process was
   * started with `APEX_STAGING_NOINDEX=1`.
   */
  readonly disallowRobots?: boolean;
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
  response.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,idempotency-key',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
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
  const identityMechanisms = [
    options.oidc !== undefined,
    options.access !== undefined,
    options.jwtSecret !== undefined,
  ].filter(Boolean);
  if (identityMechanisms.length > 1) {
    throw new Error(
      'Configure an identity provider or a shared secret, not both: accepting self-minted '
      + 'tokens alongside a real provider is a second, unaudited door.',
    );
  }
  if (options.oidc === undefined && options.access === undefined) {
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
  /**
   * The provider's endpoints, discovered once and remembered.
   *
   * Discovery happens here rather than in the browser so the staff app makes one
   * request to its own origin instead of two to a third party, and so a provider
   * that is slow or down produces a server-side error with a log line rather
   * than a blank screen.
   *
   * ALL THREE endpoints come from the same document, including `jwks_uri`. An
   * earlier version discovered the authorize and token endpoints but guessed the
   * keys at `<issuer>/.well-known/jwks.json`. Auth0 and Clerk both happen to
   * publish there, so it worked — until it was pointed at a provider that does
   * not, and then every token failed verification with nothing to explain why.
   * Reading the value the provider states removes the guess.
   */
  interface ProviderEndpoints {
    readonly authorizationEndpoint: string;
    readonly tokenEndpoint: string;
    readonly jwksUri: string;
  }
  let endpoints: ProviderEndpoints | null = null;

  const providerEndpoints = async (): Promise<ProviderEndpoints> => {
    if (endpoints !== null) return endpoints;
    const oidc = options.oidc!;
    const base = oidc.issuer.replace(/\/+$/, '');

    // Fully stated: do not fetch at all. This is what the tests use, and what a
    // provider with no discovery document would need.
    if (oidc.authorizationEndpoint && oidc.tokenEndpoint && oidc.jwksUri) {
      endpoints = {
        authorizationEndpoint: oidc.authorizationEndpoint,
        tokenEndpoint: oidc.tokenEndpoint,
        jwksUri: oidc.jwksUri,
      };
      return endpoints;
    }

    const response = await fetch(`${base}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: ${response.status} at ${base}/.well-known/openid-configuration`);
    }
    const document = await response.json() as {
      authorization_endpoint?: string;
      token_endpoint?: string;
      jwks_uri?: string;
    };
    const authorizationEndpoint = oidc.authorizationEndpoint ?? document.authorization_endpoint;
    const tokenEndpoint = oidc.tokenEndpoint ?? document.token_endpoint;
    const jwksUri = oidc.jwksUri ?? document.jwks_uri;
    if (!authorizationEndpoint || !tokenEndpoint || !jwksUri) {
      throw new Error(
        'OIDC discovery document is missing authorization_endpoint, token_endpoint, or jwks_uri.',
      );
    }
    endpoints = { authorizationEndpoint, tokenEndpoint, jwksUri };
    return endpoints;
  };

  /**
   * The provider's signing keys, fetched on first use and cached by `jose`,
   * which refetches when a token arrives with an unknown `kid`. That is what
   * makes provider key rotation a non-event here rather than an outage.
   */
  let jwksSet: JWTVerifyGetKey | null = null;
  const providerJwks = async (): Promise<JWTVerifyGetKey> => {
    if (jwksSet === null) jwksSet = createRemoteJWKSet(new URL((await providerEndpoints()).jwksUri));
    return jwksSet;
  };

  let accessJwks: JWTVerifyGetKey | null = null;
  const accessKeys = (): JWTVerifyGetKey => {
    if (accessJwks === null) {
      const access = options.access!;
      const uri = access.jwksUri ?? `https://${access.team}.cloudflareaccess.com/cdn-cgi/access/certs`;
      accessJwks = createRemoteJWKSet(new URL(uri));
    }
    return accessJwks;
  };
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

  /**
   * Staging staff identity is the Access assertion, not a bearer token.
   *
   * The edge already required the one-time PIN. This check is what stops a
   * request that reached the process some other way, and what binds that
   * browser to one `app_users` row. A role claim in the JWT is ignored.
   */
  const authenticateAccess = async (request: IncomingMessage): Promise<EventActor> => {
    const access = options.access!;
    const header = request.headers['cf-access-jwt-assertion'];
    if (typeof header !== 'string' || header.length === 0) {
      throw new AuthError('Cloudflare Access authentication is required.');
    }
    let email = '';
    try {
      const { payload } = await jwtVerify(header, accessKeys(), {
        algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384'],
        issuer: `https://${access.team}.cloudflareaccess.com`,
        audience: access.audience,
      });
      email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('Authentication is invalid or expired.');
    }
    if (email !== access.email.trim().toLowerCase()) {
      throw new AuthError('This Access identity is not allowed to use staging.');
    }
    const users = await options.db.query<{ role: AppRole }>(
      `select role from app_users where user_id = $1 and active = true`,
      [access.userId],
    );
    const role = users.rows[0]?.role;
    if (role === undefined) throw new AuthError('No active Apex user is linked to this identity.');
    return EventActorSchema.parse({ kind: 'user', userId: access.userId, role });
  };

  const authenticate = async (request: IncomingMessage): Promise<EventActor> => {
    if (options.access !== undefined) return authenticateAccess(request);
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
      const subject = options.oidc !== undefined
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
    const { payload } = await jwtVerify(token, await providerJwks(), {
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
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'authorization,content-type,idempotency-key',
        });
        return response.end();
      }
      if (options.disallowRobots && request.method === 'GET' && url.pathname === '/robots.txt') {
        const body = 'User-agent: *\nDisallow: /\n';
        response.writeHead(200, {
          'content-type': 'text/plain; charset=utf-8',
          'content-length': Buffer.byteLength(body),
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow, noarchive',
        });
        return response.end(body);
      }
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
          'content-security-policy': appCsp(options.oidc?.issuer),
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


      /*
       * How the staff app should sign a person in — unauthenticated by
       * necessity, since it is what a signed-out browser asks for first.
       *
       * Everything here is public by design: an issuer, an audience, a public
       * client id, and two endpoint URLs the provider itself publishes. No
       * secret exists to leak, because a browser client cannot hold one.
       */
      if (request.method === 'GET' && url.pathname === '/api/auth/config') {
        if (options.oidc === undefined) {
          // Local development: the paste-a-token screen is still the way in.
          return sendJson(response, 200, { mode: 'pilot' });
        }
        const resolved = await providerEndpoints();
        return sendJson(response, 200, {
          mode: 'oidc',
          issuer: options.oidc.issuer,
          audience: options.oidc.audience,
          clientId: options.oidc.clientId,
          authorizationEndpoint: resolved.authorizationEndpoint,
          tokenEndpoint: resolved.tokenEndpoint,
        });
      }

      const actor = await authenticate(request);

      if (request.method === 'GET' && url.pathname === '/api/opportunities') {
        requireStaff(actor);
        const opportunities = await options.db.query<{ lead_id: string; status: string; accepted_payload: unknown; created_at: string | Date }>(
          `select lead_id, status, accepted_payload, created_at from leads order by created_at desc`,
        );
        const jobs = await options.db.query<{ job_id: string; lead_id: string }>(
          `select job_id, lead_id from jobs where status = 'active'`,
        );
        const jobByLead = new Map(jobs.rows.map((job) => [job.lead_id, job.job_id]));
        return sendJson(response, 200, opportunities.rows.map((row) => {
          const identity = readLeadIdentity(row.accepted_payload);
          return {
            leadId: row.lead_id,
            jobId: jobByLead.get(row.lead_id) ?? null,
            customerName: identity.customerName ?? null,
            addressLine: identity.addressLine,
            status: row.status,
          };
        }));
      }

      if (request.method === 'POST' && url.pathname === '/api/projects/intake') {
        requireStaff(actor);
        if (actor.kind !== 'user' || !['admin', 'office'].includes(actor.role)) throw new AuthError('Office access is required to create a design project.');
        const body = ManualProjectIntakeSchema.parse(await readJson(request, 100_000));
        const key = idempotency(request);
        const existing = await options.db.query<{ lead_id: string; accepted_payload: object; status: string }>(
          `select lead_id, status, accepted_payload from leads where idempotency_key = $1`,
          [key],
        );
        if (existing.rows[0]) {
          const leadRow = existing.rows[0];
          const leadIdentity = readLeadIdentity(leadRow.accepted_payload);
          return sendJson(response, 200, {
            leadId: leadRow.lead_id,
            customerName: leadIdentity.customerName ?? null,
            addressLine: leadIdentity.addressLine,
            status: leadRow.status,
            project: null,
          });
        }
        const leadId = createCanonicalId('lead');
        const acceptedPayload = {
          customerName: body.customerName,
          streetAddress: body.streetAddress,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          ...(body.phone ? { phone: body.phone } : {}),
          ...(body.email ? { email: body.email } : {}),
          ...(body.referralSource ? { referralSource: body.referralSource } : {}),
          ...(body.notes ? { notes: body.notes } : {}),
        };
        await options.db.query(
          `insert into leads (lead_id, intake_source, source_record_id, idempotency_key, accepted_payload)
           values ($1, 'manual-referral', $2, $3, $4::jsonb)`,
          [leadId, `manual:${key}`, key, JSON.stringify(acceptedPayload)],
        );
        return sendJson(response, 201, {
          leadId,
          customerName: body.customerName,
          addressLine: `${body.streetAddress}, ${body.city}, ${body.state} ${body.postalCode}`,
          status: 'accepted',
          project: null,
        });
      }

      const opportunityProposalsMatch = url.pathname.match(
        /^\/api\/opportunities\/(lead_[0-9A-HJKMNP-TV-Z]{26})\/proposals$/,
      );
      if (request.method === 'GET' && opportunityProposalsMatch) {
        requireStaff(actor);
        return sendJson(response, 200,
          await service.listProposalVersions(idSchemas.lead.parse(opportunityProposalsMatch[1])));
      }

      const finishEstimateMatch = url.pathname.match(
        /^\/api\/opportunities\/(lead_[0-9A-HJKMNP-TV-Z]{26})\/finish-estimate$/,
      );
      if (request.method === 'POST' && finishEstimateMatch) {
        requireStaff(actor);
        const body = FinishEstimateSchema.parse(await readJson(request, 2_000_000));
        return sendJson(response, 201, await service.finishEstimate({
          leadId: idSchemas.lead.parse(finishEstimateMatch[1]), actor,
            submission: body.submission, directLines: body.directLines,
            measuredLines: body.measuredLines,
          feeRateBps: body.feeRateBps, idempotencyKey: idempotency(request),
        }));
      }

      const proposalMatch = url.pathname.match(
        /^\/api\/proposals\/(proposal_version_[0-9A-HJKMNP-TV-Z]{26})$/,
      );
      if (request.method === 'GET' && proposalMatch) {
        requireStaff(actor);
        const proposal = await service.getProposalVersion(idSchemas.proposal_version.parse(proposalMatch[1]));
        return proposal ? sendJson(response, 200, proposal) : sendJson(response, 404, { error: 'Proposal version not found.' });
      }

      const issueProposalMatch = url.pathname.match(
        /^\/api\/proposals\/(proposal_version_[0-9A-HJKMNP-TV-Z]{26})\/issue$/,
      );
      if (request.method === 'POST' && issueProposalMatch) {
        requireStaff(actor);
        const body = ExpectedProposalVersionSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.issueProposal({
          proposalVersionId: idSchemas.proposal_version.parse(issueProposalMatch[1]),
          expectedVersionNumber: body.expectedVersionNumber, actor,
          expectedDraftRevision: body.expectedDraftRevision,
          idempotencyKey: idempotency(request),
        }));
      }

      const updateProposalMatch = url.pathname.match(
        /^\/api\/proposals\/(proposal_version_[0-9A-HJKMNP-TV-Z]{26})\/draft$/,
      );
      if (request.method === 'POST' && updateProposalMatch) {
        requireStaff(actor);
        const body = UpdateProposalDraftSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.updateProposalDraft({
          proposalVersionId: idSchemas.proposal_version.parse(updateProposalMatch[1]),
          expectedVersionNumber: body.expectedVersionNumber,
          expectedDraftRevision: body.expectedDraftRevision,
            directLines: body.directLines, feeRateBps: body.feeRateBps,
            measuredLines: body.measuredLines,
          actor, idempotencyKey: idempotency(request),
        }));
      }

      const signProposalMatch = url.pathname.match(
        /^\/api\/proposals\/(proposal_version_[0-9A-HJKMNP-TV-Z]{26})\/sign$/,
      );
      if (request.method === 'POST' && signProposalMatch) {
        requireStaff(actor);
        const body = SignProposalSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.signProposal({
          proposalVersionId: idSchemas.proposal_version.parse(signProposalMatch[1]),
          expectedVersionNumber: body.expectedVersionNumber, actor,
          expectedDraftRevision: body.expectedDraftRevision,
          customerAcceptanceConfirmed: body.customerAcceptanceConfirmed,
          idempotencyKey: idempotency(request),
        }));
      }

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
        const requestedView = url.searchParams.get('view') ?? 'all';
        if (requestedView !== 'all' && requestedView !== 'active' && requestedView !== 'historical') {
          throw new InputError('Job view must be all, active, or historical.');
        }
        return sendJson(response, 200, await service.listJobs(requestedView));
      }

      const jobMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})$/);
      if (request.method === 'GET' && jobMatch) {
        requireStaff(actor);
        const summary = await service.getJob(idSchemas.job.parse(jobMatch[1]));
        if (summary === null) return sendJson(response, 404, { error: 'Job not found.' });
        return sendJson(response, 200, summary);
      }

      /*
       * The job's approved Designer takeoff, quantities and Calc ledger included.
       *
       * Staff only, and deliberately so: this is the measured authority a customer proposal is
       * priced from, and the Proposal engine pins its digest into whatever it issues. Until
       * this route existed the quantities lived only in the database, so the Proposal builder
       * had nothing real to price against and its customer proposal could never be issued.
       *
       * 404 covers both "no such job" and "this job has no approved revision". They are the
       * same answer to the only question being asked — is there an approved takeoff to price
       * from — and splitting them would tell an unauthorised caller which job ids exist.
       */
      const approvedTakeoffMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/approved-takeoff$/,
      );
      if (request.method === 'GET' && approvedTakeoffMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(approvedTakeoffMatch[1]);
        let revision;
        try {
          revision = await service.getApprovedTakeoffRevision(jobId);
        } catch (error) {
          /*
           * A stored revision that fails its own contract is not a bad request, and letting it
           * fall through to the generic ZodError handler would answer 422 — "you sent something
           * invalid" — when the caller sent a job id and it was fine. The record is the problem.
           *
           * This is not hypothetical: rows seeded before the digest was enforced carry
           * placeholder hashes and quantities with no calcId, so they can never be served as
           * authority. Saying so plainly is the difference between someone fixing the data and
           * someone retrying the request.
           */
          if (error instanceof z.ZodError) {
            return sendJson(response, 409, {
              error: 'The stored approved takeoff revision for this job fails its own integrity '
                + 'contract and cannot be served as pricing authority.',
              detail: error.message,
            });
          }
          throw error;
        }
        if (revision === null) {
          return sendJson(response, 404, { error: 'This job has no approved takeoff revision.' });
        }
        return sendJson(response, 200, revision);
      }

      /*
       * The Designer bridge. Everything downstream of a takeoff — Gates, evidence,
       * releases, draws — was reachable long before there was any way to put one in;
       * until this existed, `takeoff_revisions` was written only by the test suite.
       */
      if (request.method === 'POST' && approvedTakeoffMatch) {
        requireStaff(actor);
        const jobId = idSchemas.job.parse(approvedTakeoffMatch[1]);
        const submission = DesignerTakeoffSubmissionSchema.parse(await readJson(request));
        const revision = await service.recordApprovedTakeoff({
          jobId,
          actor,
          submission,
          idempotencyKey: idempotency(request),
        });
        return sendJson(response, 201, revision);
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

      /*
       * The people a job can be assigned to. Superintendents only — this fills
       * the one field that names one, and offering the whole staff list would
       * invite assigning a pour to the office.
       */
      if (request.method === 'GET' && url.pathname === '/api/superintendents') {
        requireStaff(actor);
        return sendJson(response, 200, await service.listSuperintendents());
      }

      const superMatch = url.pathname.match(
        /^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/project\/superintendent$/,
      );
      if (request.method === 'POST' && superMatch) {
        requireStaff(actor);
        const body = AssignSuperintendentSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.assignSuperintendent({
          jobId: idSchemas.job.parse(superMatch[1]),
          superintendentUserId: body.superintendentUserId,
          actor,
          idempotencyKey: idempotency(request),
        }));
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

      const targetMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/project\/target$/);
      if (request.method === 'POST' && targetMatch) {
        requireStaff(actor);
        const body = UpdateTargetSchema.parse(await readJson(request));
        return sendJson(response, 200, await service.updateProjectTarget(
          idSchemas.job.parse(targetMatch[1]), body, { actor, idempotencyKey: idempotency(request) },
        ));
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

      if (request.method === 'GET' && url.pathname === '/api/calendar') {
        requireStaff(actor);
        return sendJson(response, 200, await service.listCalendarEntries());
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

      const closeJobMatch = url.pathname.match(/^\/api\/jobs\/(job_[0-9A-HJKMNP-TV-Z]{26})\/close$/);
      if (request.method === 'GET' && closeJobMatch) {
        requireStaff(actor);
        return sendJson(response, 200, await service.getJobCloseout(idSchemas.job.parse(closeJobMatch[1])));
      }
      if (request.method === 'POST' && closeJobMatch) {
        requireStaff(actor);
        return sendJson(response, 200, await service.closeJob({
          jobId: idSchemas.job.parse(closeJobMatch[1]),
          actor,
          idempotencyKey: idempotency(request),
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
        return sendJson(response, 410, { error: 'Countersign has been removed. Release Gates with one signature.' });
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
    if (options.disallowRobots) response.setHeader('x-robots-tag', 'noindex, nofollow, noarchive');
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
