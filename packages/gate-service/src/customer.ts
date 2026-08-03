import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from '@apex/database';
import {
  CustomerLinkSchema,
  CustomerLinkStatusSchema,
  CustomerPageSchema,
  JobPhotoSchema,
  StaffCustomerDecisionSchema,
  createCanonicalId,
  readLeadIdentity,
  type ConstructionPhaseKey,
  type CustomerContact,
  type CustomerDecision,
  type CustomerLink,
  type CustomerLinkStatus,
  type CustomerPage,
  type CustomerUpdate,
  type EventActor,
  type EvidenceId,
  type IssuedCustomerLink,
  type JobId,
  type JobPhoto,
  type StaffCustomerDecision,
} from '@apex/contracts';
import { DomainRuleError, buildCustomerPage } from '@apex/domain';

/**
 * The customer progress page — PRD §9.11. Build-plan Step 7.
 *
 * Everything a person outside Apex can reach goes through this file. It is kept
 * apart from `GateService` for that reason: the boundary is easier to hold when
 * it is a file you can read end to end.
 *
 * Three properties this module is responsible for:
 *
 *   1. The token exists in the clear exactly once, in the return value of
 *      `issueLink`. Only its SHA-256 is stored, so a leaked database hands out
 *      no working links and `getPage` is the only thing that ever sees a token.
 *   2. Reads are recorded, including reads on a link that was revoked — that is
 *      how Apex learns an old link is still being passed around.
 *   3. The payload is assembled by @apex/domain's `buildCustomerPage` from a
 *      narrow input. Nothing internal is fetched here and then filtered out.
 */

/** Roles that may issue, rotate, or revoke a customer link. */
const LINK_AUTHORITY = ['admin', 'office'] as const;

/**
 * Roles that may publish a photo or raise a decision. The field lead takes the
 * photograph; deciding that a homeowner should see it is the company speaking.
 */
const PUBLISH_AUTHORITY = ['admin', 'office', 'superintendent'] as const;

/** 256 bits, URL-safe, 43 characters. Not guessable, and short enough to text. */
const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const requireRole = <T extends readonly string[]>(
  actor: EventActor,
  allowed: T,
  action: string,
): { userId: string } => {
  if (actor.kind !== 'user') throw new DomainRuleError(`${action} requires an authenticated human actor.`);
  if (!(allowed as readonly string[]).includes(actor.role)) {
    throw new DomainRuleError(`Role ${actor.role} may not ${action.toLowerCase()}.`);
  }
  return { userId: actor.userId };
};

/**
 * Coarsen a client address to a network prefix.
 *
 * The access log answers "is this link being read from somewhere unexpected",
 * not "where is this customer". An IPv4 /24 or IPv6 /48 answers the first and
 * cannot answer the second. Anything unrecognisable becomes null rather than
 * being stored raw.
 */
export const networkPrefix = (address: string | undefined): string | null => {
  if (!address) return null;
  const value = address.startsWith('::ffff:') ? address.slice(7) : address;
  const v4 = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  if (value.includes(':')) {
    const groups = value.split(':').slice(0, 3).filter((group) => group.length > 0);
    if (groups.length === 0) return '::/48';
    return `${groups.join(':')}::/48`;
  }
  return null;
};

/** Trimmed to what the log column holds; absent rather than truncated to noise. */
const readUserAgent = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed.slice(0, 300);
};

export interface AccessContext {
  readonly remoteAddress?: string;
  readonly userAgent?: string;
}

/** What a public request resolved to. `unknown-token` and `revoked` look the
 *  same to the caller on purpose — see `serveError` in the API. */
export type CustomerPageResult =
  | { readonly outcome: 'served'; readonly page: CustomerPage }
  | { readonly outcome: 'revoked' }
  | { readonly outcome: 'unknown' };

export type CustomerPhotoResult =
  | { readonly outcome: 'served'; readonly storageKey: string; readonly mimeType: string }
  | { readonly outcome: 'revoked' }
  | { readonly outcome: 'unknown' };

interface LinkRow {
  link_id: string;
  job_id: string;
  revoked_at: string | Date | null;
}

const asIso = (value: string | Date | null): string | null =>
  value === null ? null : new Date(value).toISOString();

const asDay = (value: string | Date): string =>
  (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);

export interface CustomerServiceOptions {
  /**
   * How the customer reaches Apex (§9.11's call/text route). Absent by default:
   * a page that prints a phone number nobody configured is worse than a page
   * that says nothing, because a customer will dial it.
   */
  readonly contact?: CustomerContact;
  /** Path prefix the public page is mounted at. Used to build the link. */
  readonly basePath?: string;
}

export class CustomerService {
  private readonly contact: CustomerContact | null;
  private readonly basePath: string;

  constructor(private readonly db: Database, options: CustomerServiceOptions = {}) {
    this.contact = options.contact ?? null;
    this.basePath = options.basePath ?? '/c';
  }

  /* ------------------------------------------------------------------ links */

  /**
   * Issue this job's link, or return nothing if one is already live.
   *
   * Issuing twice is refused rather than silently rotating: "send the customer
   * their link" and "invalidate the link the customer already has" are
   * different intentions, and one must not be able to perform the other by
   * accident. Use `rotateLink` to replace a live link.
   */
  async issueLink(input: { jobId: JobId; actor: EventActor }): Promise<IssuedCustomerLink> {
    const { userId } = requireRole(input.actor, LINK_AUTHORITY, 'Issuing a customer link');
    const live = await this.activeLinkRow(input.jobId);
    if (live !== null) {
      throw new DomainRuleError(
        'This job already has a live customer link. Rotate it to replace the one the customer has.',
      );
    }
    return this.mintLink(input.jobId, userId);
  }

  /**
   * Replace the live link — §9.11's rotation.
   *
   * The old link is revoked in the same transaction as the new one is issued, so
   * there is never a moment with two working links or none.
   */
  async rotateLink(input: {
    jobId: JobId;
    actor: EventActor;
    reason?: string;
  }): Promise<IssuedCustomerLink> {
    const { userId } = requireRole(input.actor, LINK_AUTHORITY, 'Rotating a customer link');
    const live = await this.activeLinkRow(input.jobId);
    return this.mintLink(input.jobId, userId, live === null ? null : {
      linkId: live.link_id,
      reason: input.reason ?? 'Rotated',
    });
  }

  /** Close the page. There is no un-revoke; issue a new link instead. */
  async revokeLink(input: { jobId: JobId; actor: EventActor; reason?: string }): Promise<CustomerLinkStatus> {
    const { userId } = requireRole(input.actor, LINK_AUTHORITY, 'Revoking a customer link');
    const live = await this.activeLinkRow(input.jobId);
    if (live === null) throw new DomainRuleError('This job has no live customer link to revoke.');
    await this.db.query(
      `update customer_links set revoked_at = now(), revoked_by = $2, revoked_reason = $3
       where link_id = $1`,
      [live.link_id, userId, input.reason?.trim() || 'Revoked'],
    );
    return this.getLinkStatus(input.jobId);
  }

  /** The live link, everything ever issued, and the recorded reads. Staff view. */
  async getLinkStatus(jobId: JobId): Promise<CustomerLinkStatus> {
    const links = await this.db.query<{
      link_id: string;
      job_id: string;
      issued_at: string | Date;
      issued_by_name: string | null;
      revoked_at: string | Date | null;
      revoked_reason: string | null;
      page_views: string;
      last_page_view: string | Date | null;
    }>(
      `select l.link_id, l.job_id, l.issued_at, u.display_name as issued_by_name,
              l.revoked_at, l.revoked_reason,
              (select count(*) from customer_link_accesses a
                where a.link_id = l.link_id and a.resource = 'page')::text as page_views,
              (select max(a.occurred_at) from customer_link_accesses a
                where a.link_id = l.link_id and a.resource = 'page') as last_page_view
       from customer_links l
       left join app_users u on u.user_id = l.issued_by
       where l.job_id = $1
       order by l.issued_at desc`,
      [jobId],
    );

    const history = links.rows.map((row): CustomerLink => CustomerLinkSchema.parse({
      linkId: row.link_id,
      jobId: row.job_id,
      issuedAt: new Date(row.issued_at).toISOString(),
      issuedByName: row.issued_by_name,
      revokedAt: asIso(row.revoked_at),
      revokedReason: row.revoked_reason,
      pageViews: Number(row.page_views),
      lastViewedAt: asIso(row.last_page_view),
    }));

    const accesses = await this.db.query<{
      occurred_at: string | Date;
      resource: 'page' | 'photo';
      outcome: 'served' | 'refused-revoked';
      ip_prefix: string | null;
      user_agent: string | null;
    }>(
      `select a.occurred_at, a.resource, a.outcome, a.ip_prefix, a.user_agent
       from customer_link_accesses a
       join customer_links l on l.link_id = a.link_id
       where l.job_id = $1
       order by a.occurred_at desc
       limit 100`,
      [jobId],
    );

    return CustomerLinkStatusSchema.parse({
      jobId,
      active: history.find((link) => link.revokedAt === null) ?? null,
      history,
      recentAccesses: accesses.rows.map((row) => ({
        occurredAt: new Date(row.occurred_at).toISOString(),
        resource: row.resource,
        outcome: row.outcome,
        ipPrefix: row.ip_prefix,
        userAgent: row.user_agent,
      })),
    });
  }

  /* ----------------------------------------------------------- public reads */

  /**
   * The page behind a token.
   *
   * The token is looked up by hash, so an attacker who can time this learns the
   * hash comparison, not the token. A revoked link is recorded and refused; an
   * unknown token records nothing, because there is no link to attach it to and
   * a table of failed guesses against 256 bits is noise.
   */
  async getPage(token: string, context: AccessContext = {}): Promise<CustomerPageResult> {
    const link = await this.resolveToken(token);
    if (link === null) return { outcome: 'unknown' };
    if (link.revoked_at !== null) {
      await this.recordAccess(link.link_id, 'page', 'refused-revoked', context);
      return { outcome: 'revoked' };
    }
    await this.recordAccess(link.link_id, 'page', 'served', context);
    return { outcome: 'served', page: await this.readPage(link.job_id as JobId, token) };
  }

  /**
   * The bytes of one published photo.
   *
   * Three conditions, all required: the link is live, the photo belongs to that
   * link's job, and it has been published. A staff evidence ID pasted into a
   * customer URL therefore resolves to nothing.
   */
  async getPhoto(token: string, evidenceId: EvidenceId, context: AccessContext = {}): Promise<CustomerPhotoResult> {
    const link = await this.resolveToken(token);
    if (link === null) return { outcome: 'unknown' };
    if (link.revoked_at !== null) {
      await this.recordAccess(link.link_id, 'photo', 'refused-revoked', context);
      return { outcome: 'revoked' };
    }
    const photo = await this.db.query<{ storage_key: string; mime_type: string }>(
      `select storage_key, mime_type from evidence_records
       where evidence_id = $1 and job_id = $2 and customer_visible = true and kind = 'photo'`,
      [evidenceId, link.job_id],
    );
    const row = photo.rows[0];
    if (!row) return { outcome: 'unknown' };
    await this.recordAccess(link.link_id, 'photo', 'served', context);
    return { outcome: 'served', storageKey: row.storage_key, mimeType: row.mime_type };
  }

  /**
   * The page as staff would see it, without a token and without logging a read.
   *
   * This is what "preview what the customer sees" must call. Anything else would
   * either put a live token in a staff screen or record Apex's own checks as
   * customer visits.
   */
  async previewPage(jobId: JobId): Promise<CustomerPage> {
    return this.readPage(jobId, null);
  }

  /* --------------------------------------------------------------- photos */

  /**
   * Publish or unpublish a gate photo — §9.11's per-photo visibility toggle.
   *
   * Unpublishing clears the customer caption with it: a caption is written for
   * a photo that is being shown, and leaving it behind would mean the next
   * person to publish inherits wording they never read.
   */
  async setPhotoVisibility(input: {
    evidenceId: EvidenceId;
    visible: boolean;
    caption?: string | null;
    actor: EventActor;
  }): Promise<JobPhoto> {
    const { userId } = requireRole(input.actor, PUBLISH_AUTHORITY, 'Publishing a photo to a customer');
    const existing = await this.db.query<{ kind: string }>(
      'select kind from evidence_records where evidence_id = $1',
      [input.evidenceId],
    );
    const kind = existing.rows[0]?.kind;
    if (kind === undefined) throw new DomainRuleError(`Unknown evidence: ${input.evidenceId}.`);
    if (input.visible && kind !== 'photo') {
      throw new DomainRuleError(
        `Only a photo can be published to a customer; this evidence is a ${kind}.`,
      );
    }

    const caption = input.caption?.trim();
    await this.db.query(
      `update evidence_records
       set customer_visible = $2,
           customer_caption = case when $2 then $3 else null end,
           visibility_set_at = case when $2 then now() else null end,
           visibility_set_by = case when $2 then $4 else null end
       where evidence_id = $1`,
      [input.evidenceId, input.visible, caption || null, userId],
    );

    const photo = (await this.listJobPhotos(await this.jobOfEvidence(input.evidenceId)))
      .find((row) => row.evidenceId === input.evidenceId);
    if (!photo) throw new Error('Photo disappeared after its visibility changed.');
    return photo;
  }

  /** Every gate photo on a job, published or not. Staff view. */
  async listJobPhotos(jobId: JobId): Promise<readonly JobPhoto[]> {
    const rows = await this.db.query<{
      evidence_id: string;
      gate_title: string;
      requirement_key: string;
      captured_at: string | Date;
      caption: string | null;
      customer_visible: boolean;
      customer_caption: string | null;
      visibility_set_at: string | Date | null;
      visibility_set_by_name: string | null;
    }>(
      `select e.evidence_id, gd.title as gate_title, e.requirement_key, e.captured_at,
              e.caption, e.customer_visible, e.customer_caption, e.visibility_set_at,
              u.display_name as visibility_set_by_name
       from evidence_records e
       join gate_instances gi on gi.gate_instance_id = e.gate_instance_id
       join gate_definitions gd
         on gd.definition_key = gi.definition_key and gd.version = gi.definition_version
       left join app_users u on u.user_id = e.visibility_set_by
       where e.job_id = $1 and e.kind = 'photo'
       order by e.captured_at desc, e.evidence_id`,
      [jobId],
    );
    return rows.rows.map((row) => JobPhotoSchema.parse({
      evidenceId: row.evidence_id,
      gateTitle: row.gate_title,
      requirementKey: row.requirement_key,
      capturedAt: new Date(row.captured_at).toISOString(),
      internalCaption: row.caption,
      customerVisible: row.customer_visible,
      customerCaption: row.customer_caption,
      visibilitySetAt: asIso(row.visibility_set_at),
      visibilitySetByName: row.visibility_set_by_name,
    }));
  }

  /* ------------------------------------------------------------- decisions */

  /** Raise something Apex is waiting on from the customer — §9.11. */
  async raiseDecision(input: {
    jobId: JobId;
    title: string;
    detail: string;
    consequence: string;
    neededBy?: string;
    actor: EventActor;
  }): Promise<StaffCustomerDecision> {
    const { userId } = requireRole(input.actor, PUBLISH_AUTHORITY, 'Raising a customer decision');
    const decisionId = createCanonicalId('decision');
    await this.db.query(
      `insert into customer_decisions
       (decision_id, job_id, title, detail, consequence, needed_by, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [decisionId, input.jobId, input.title.trim(), input.detail.trim(),
        input.consequence.trim(), input.neededBy ?? null, userId],
    );
    const decision = (await this.listDecisions(input.jobId)).find((row) => row.decisionId === decisionId);
    if (!decision) throw new Error('Decision was not persisted.');
    return decision;
  }

  /**
   * Record the customer's answer, or withdraw the question.
   *
   * The answer arrives by phone or text (§9.11's contact route) and a person
   * writes it down here. The page itself takes no input: a selection submitted
   * from an unauthenticated link is not evidence that the customer made it.
   */
  async resolveDecision(input: {
    decisionId: string;
    status: 'answered' | 'withdrawn';
    answerNote?: string;
    actor: EventActor;
  }): Promise<StaffCustomerDecision> {
    const { userId } = requireRole(input.actor, PUBLISH_AUTHORITY, 'Resolving a customer decision');
    const note = input.answerNote?.trim();
    if (input.status === 'answered' && !note) {
      throw new DomainRuleError('Recording an answer requires writing down what the customer said.');
    }
    const updated = await this.db.query<{ job_id: string }>(
      `update customer_decisions
       set status = $2, answer_note = $3, resolved_at = now(), resolved_by = $4
       where decision_id = $1 and status = 'open'
       returning job_id`,
      [input.decisionId, input.status, note ?? null, userId],
    );
    const jobId = updated.rows[0]?.job_id;
    if (jobId === undefined) {
      throw new DomainRuleError('That decision does not exist or has already been resolved.');
    }
    const decision = (await this.listDecisions(jobId as JobId))
      .find((row) => row.decisionId === input.decisionId);
    if (!decision) throw new Error('Decision disappeared after being resolved.');
    return decision;
  }

  /** Every decision on a job, open first. Staff view. */
  async listDecisions(jobId: JobId): Promise<readonly StaffCustomerDecision[]> {
    const rows = await this.db.query<{
      decision_id: string; job_id: string; title: string; detail: string; consequence: string;
      needed_by: string | Date | null; status: 'open' | 'answered' | 'withdrawn';
      answer_note: string | null; resolved_at: string | Date | null; created_at: string | Date;
    }>(
      `select decision_id, job_id, title, detail, consequence, needed_by, status,
              answer_note, resolved_at, created_at
       from customer_decisions where job_id = $1
       order by (status = 'open') desc, needed_by nulls last, created_at`,
      [jobId],
    );
    return rows.rows.map((row) => StaffCustomerDecisionSchema.parse({
      decisionId: row.decision_id,
      jobId: row.job_id,
      title: row.title,
      detail: row.detail,
      consequence: row.consequence,
      neededBy: row.needed_by === null ? null : asDay(row.needed_by),
      status: row.status,
      answerNote: row.answer_note,
      resolvedAt: asIso(row.resolved_at),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  /* ---------------------------------------------------------------- internals */

  /**
   * Assemble the page.
   *
   * Note what is queried: the customer's own name and address, the phase key,
   * whether the job is finished, the open decisions, the published photos, and
   * the milestone updates. Nothing else is read — not the contract value, not
   * the risk note, not a visit, not a draw. Filtering is not involved because
   * the internal facts never enter this method.
   */
  private async readPage(jobId: JobId, token: string | null): Promise<CustomerPage> {
    const job = await this.db.query<{
      status: string; accepted_payload: unknown; current_phase_key: string | null;
    }>(
      `select j.status, l.accepted_payload, p.current_phase_key
       from jobs j
       join leads l on l.lead_id = j.lead_id
       left join projects p on p.job_id = j.job_id
       where j.job_id = $1`,
      [jobId],
    );
    const row = job.rows[0];
    if (!row) throw new DomainRuleError(`Unknown job: ${jobId}.`);
    const identity = readLeadIdentity(row.accepted_payload);

    const decisions = await this.db.query<{
      decision_id: string; title: string; detail: string; consequence: string;
      needed_by: string | Date | null;
    }>(
      `select decision_id, title, detail, consequence, needed_by
       from customer_decisions where job_id = $1 and status = 'open'
       order by needed_by nulls last, created_at`,
      [jobId],
    );

    const photos = await this.db.query<{
      evidence_id: string; customer_caption: string | null; captured_at: string | Date;
    }>(
      `select evidence_id, customer_caption, captured_at
       from evidence_records
       where job_id = $1 and customer_visible = true and kind = 'photo'
       order by captured_at desc, evidence_id`,
      [jobId],
    );

    const updates = await this.db.query<{ title: string; summary: string; published_at: string | Date }>(
      `select title, summary, published_at from customer_milestone_projections
       where job_id = $1 order by published_at desc`,
      [jobId],
    );

    return CustomerPageSchema.parse(buildCustomerPage({
      customerName: identity.customerName,
      addressLine: identity.addressLine,
      currentPhaseKey: (row.current_phase_key as ConstructionPhaseKey | null) ?? null,
      // Handover comes from the job being finished and from nothing else.
      jobComplete: row.status === 'complete',
      decisions: decisions.rows.map((decision): CustomerDecision => ({
        decisionId: decision.decision_id as CustomerDecision['decisionId'],
        title: decision.title,
        detail: decision.detail,
        consequence: decision.consequence,
        neededBy: decision.needed_by === null ? null : asDay(decision.needed_by),
      })),
      photos: photos.rows.map((photo) => ({
        evidenceId: photo.evidence_id as EvidenceId,
        caption: photo.customer_caption,
        takenOn: asDay(photo.captured_at),
      })),
      updates: updates.rows.map((update): CustomerUpdate => ({
        title: update.title,
        summary: update.summary,
        publishedOn: asDay(update.published_at),
      })),
      contact: this.contact,
      // A preview has no token, so it renders the gallery without hrefs that
      // would work. The staff screen shows photos from the staff route instead.
      photoHref: (evidenceId) =>
        token === null ? `#${evidenceId}` : `${this.basePath}/${token}/photo/${evidenceId}`,
    }));
  }

  private async mintLink(
    jobId: JobId,
    userId: string,
    revoke: { linkId: string; reason: string } | null = null,
  ): Promise<IssuedCustomerLink> {
    const jobs = await this.db.query('select 1 from jobs where job_id = $1', [jobId]);
    if (jobs.rows.length === 0) throw new DomainRuleError(`Unknown job: ${jobId}.`);

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const linkId = createCanonicalId('clink');
    await this.db.transaction(async (tx) => {
      if (revoke !== null) {
        await tx.query(
          `update customer_links set revoked_at = now(), revoked_by = $2, revoked_reason = $3
           where link_id = $1 and revoked_at is null`,
          [revoke.linkId, userId, revoke.reason],
        );
      }
      await tx.query(
        `insert into customer_links (link_id, job_id, token_sha256, issued_by)
         values ($1, $2, $3, $4)`,
        [linkId, jobId, hashToken(token), userId],
      );
    });

    const status = await this.getLinkStatus(jobId);
    const link = status.history.find((entry) => entry.linkId === linkId);
    if (!link) throw new Error('Customer link was not persisted.');
    // The only moment the token exists outside the customer's browser.
    return { link, url: `${this.basePath}/${token}` };
  }

  private async activeLinkRow(jobId: JobId): Promise<LinkRow | null> {
    const rows = await this.db.query<LinkRow>(
      'select link_id, job_id, revoked_at from customer_links where job_id = $1 and revoked_at is null',
      [jobId],
    );
    return rows.rows[0] ?? null;
  }

  /**
   * A token to its link, live or revoked.
   *
   * Shape is checked before the database is touched so a malformed value costs
   * nothing, and the stored digest is compared in constant time — the lookup is
   * by unique index, but comparing digests with `===` is a habit worth not
   * having in the file that guards the public surface.
   */
  private async resolveToken(token: string): Promise<LinkRow | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    const digest = hashToken(token);
    const rows = await this.db.query<LinkRow & { token_sha256: string }>(
      'select link_id, job_id, revoked_at, token_sha256 from customer_links where token_sha256 = $1',
      [digest],
    );
    const row = rows.rows[0];
    if (!row) return null;
    const stored = Buffer.from(row.token_sha256, 'hex');
    const offered = Buffer.from(digest, 'hex');
    if (stored.length !== offered.length || !timingSafeEqual(stored, offered)) return null;
    return { link_id: row.link_id, job_id: row.job_id, revoked_at: row.revoked_at };
  }

  private async recordAccess(
    linkId: string,
    resource: 'page' | 'photo',
    outcome: 'served' | 'refused-revoked',
    context: AccessContext,
  ): Promise<void> {
    await this.db.query(
      `insert into customer_link_accesses (link_id, resource, outcome, ip_prefix, user_agent)
       values ($1, $2, $3, $4, $5)`,
      [linkId, resource, outcome, networkPrefix(context.remoteAddress), readUserAgent(context.userAgent)],
    );
  }

  private async jobOfEvidence(evidenceId: EvidenceId): Promise<JobId> {
    const rows = await this.db.query<{ job_id: string }>(
      'select job_id from evidence_records where evidence_id = $1',
      [evidenceId],
    );
    const jobId = rows.rows[0]?.job_id;
    if (jobId === undefined) throw new DomainRuleError(`Unknown evidence: ${evidenceId}.`);
    return jobId as JobId;
  }
}
