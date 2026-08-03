import { z } from 'zod';
import { idSchemas } from './ids.js';
import { CustomerMilestoneKeySchema } from './project.js';

/**
 * The customer progress page — PRD §9.11.
 *
 * This is the one payload in Apex OS that leaves the company. §9.11 lists what
 * it must hide: costs, subcontractor names, internal checklists, risk scores,
 * and internal notes. None of those appear below, and the reason they cannot
 * appear later by accident is structural rather than careful: `CustomerPage` is
 * built field by field from an explicit projection (see @apex/domain), never by
 * removing fields from an internal record. A new column on `projects` is
 * therefore invisible here until someone writes a line to include it.
 *
 * Every string on this page is written for a homeowner. There is no field that
 * holds internal wording "for reference".
 */

/** Where a milestone stands. Four states, because "late" is not the page's call. */
export const MilestoneStateSchema = z.enum(['done', 'current', 'upcoming']);
export type MilestoneState = z.infer<typeof MilestoneStateSchema>;

export const CustomerMilestoneStepSchema = z.strictObject({
  key: CustomerMilestoneKeySchema,
  title: z.string().min(1).max(80),
  state: MilestoneStateSchema,
});
export type CustomerMilestoneStep = z.infer<typeof CustomerMilestoneStepSchema>;

/**
 * A published progress photo.
 *
 * `href` is a path on the customer's own tokenized route, not the staff
 * evidence route: the bytes are re-served against the link, so revoking the
 * link closes the photos with it.
 */
export const CustomerPhotoSchema = z.strictObject({
  evidenceId: idSchemas.evidence,
  href: z.string().min(1).max(400),
  /** Written for the customer at publish time. Null when none was written — the
   *  internal evidence caption is never substituted. */
  caption: z.string().min(1).max(300).nullable(),
  takenOn: z.string().date(),
});
export type CustomerPhoto = z.infer<typeof CustomerPhotoSchema>;

/** A milestone update published when a Gate released. §9.11's progress history. */
export const CustomerUpdateSchema = z.strictObject({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  publishedOn: z.string().date(),
});
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

/**
 * Something Apex is waiting on from the customer.
 *
 * v1 shows it and asks for a call or a text. The page takes no answer: an
 * anonymous link holder submitting a binding selection is a trust decision
 * nobody has made, and a tile choice recorded from an unauthenticated request
 * is not evidence of anything.
 */
export const CustomerDecisionSchema = z.strictObject({
  decisionId: idSchemas.customerDecision,
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(2000),
  /** What waits on it, in the customer's terms. */
  consequence: z.string().min(1).max(500),
  neededBy: z.string().date().nullable(),
});
export type CustomerDecision = z.infer<typeof CustomerDecisionSchema>;

/** How to reach Apex. Configured per deployment; absent rather than invented. */
export const CustomerContactSchema = z.strictObject({
  label: z.string().min(1).max(120),
  /** E.164, so both `tel:` and `sms:` work from a phone. */
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
});
export type CustomerContact = z.infer<typeof CustomerContactSchema>;

export const CustomerPageSchema = z.strictObject({
  /** The customer's own name, as the lead recorded it. Null when none was given. */
  customerName: z.string().min(1).max(200).nullable(),
  /**
   * The address of the build. This is the customer's own property, and it is
   * how they know the page is theirs. Null when the lead carried none.
   */
  addressLine: z.string().min(1).max(300).nullable(),
  /** All six, always, so the customer sees the whole build and where they are. */
  milestones: z.array(CustomerMilestoneStepSchema).length(6),
  /** Plain-language current status. Never a phase key, never a gate name. */
  headline: z.string().min(1).max(200),
  /** What is happening now (§9.11). */
  happeningNow: z.string().min(1).max(1000),
  /** What happens next (§9.11). Null at the end of the build. */
  happeningNext: z.string().min(1).max(1000).nullable(),
  decisions: z.array(CustomerDecisionSchema),
  photos: z.array(CustomerPhotoSchema),
  updates: z.array(CustomerUpdateSchema),
  contact: CustomerContactSchema.nullable(),
});
export type CustomerPage = z.infer<typeof CustomerPageSchema>;

/* ------------------------------------------------------------------ staff view */

/**
 * What staff see about the link. The token is absent: it exists in the clear
 * exactly once, in the response to issuing or rotating it, and nowhere else.
 */
export const CustomerLinkSchema = z.strictObject({
  linkId: idSchemas.customerLink,
  jobId: idSchemas.job,
  issuedAt: z.string().datetime({ offset: true }),
  issuedByName: z.string().min(1).max(200).nullable(),
  revokedAt: z.string().datetime({ offset: true }).nullable(),
  revokedReason: z.string().min(1).max(2000).nullable(),
  /**
   * Recorded loads of the page itself, not of its photos.
   *
   * Photo fetches are logged too, but they are a function of how many photos are
   * published and would swamp the number that answers the question staff
   * actually ask: has the customer opened this.
   */
  pageViews: z.number().int().nonnegative(),
  lastViewedAt: z.string().datetime({ offset: true }).nullable(),
});
export type CustomerLink = z.infer<typeof CustomerLinkSchema>;

/** Issue and rotate return this once. `url` cannot be recovered afterwards. */
export const IssuedCustomerLinkSchema = z.strictObject({
  link: CustomerLinkSchema,
  /**
   * What the customer opens, token included. Shown once and never recoverable.
   *
   * A complete URL when a public origin is configured; a path otherwise. The
   * flag below says which, so the staff screen never presents a loopback-only
   * link as something that can be sent to a homeowner.
   */
  url: z.string().min(1).max(400),
  /**
   * True when this URL is reachable from outside the machine serving it.
   *
   * False on a laptop. The distinction matters because the failure it prevents
   * is silent: a link that looks correct, sends cleanly, and opens nothing.
   */
  publiclyReachable: z.boolean(),
});
export type IssuedCustomerLink = z.infer<typeof IssuedCustomerLinkSchema>;

export const CustomerLinkAccessSchema = z.strictObject({
  occurredAt: z.string().datetime({ offset: true }),
  resource: z.enum(['page', 'photo']),
  outcome: z.enum(['served', 'refused-revoked']),
  /** Network prefix, not a full address. Coarse on purpose. */
  ipPrefix: z.string().min(1).max(64).nullable(),
  userAgent: z.string().min(1).max(300).nullable(),
});
export type CustomerLinkAccess = z.infer<typeof CustomerLinkAccessSchema>;

/** One job's link state, its history, and the recorded reads. */
export const CustomerLinkStatusSchema = z.strictObject({
  jobId: idSchemas.job,
  /** The live link, or null when none has been issued or all are revoked. */
  active: CustomerLinkSchema.nullable(),
  /** Every link ever issued for this job, newest first, including the live one. */
  history: z.array(CustomerLinkSchema),
  /** Recent accesses across every link on this job, newest first. */
  recentAccesses: z.array(CustomerLinkAccessSchema),
});
export type CustomerLinkStatus = z.infer<typeof CustomerLinkStatusSchema>;

/** A job's gate photos and whether each one is published. Staff view. */
export const JobPhotoSchema = z.strictObject({
  evidenceId: idSchemas.evidence,
  gateTitle: z.string().min(1).max(200),
  requirementKey: z.string().min(1).max(120),
  capturedAt: z.string().datetime({ offset: true }),
  /** The internal caption. Staff-only — the customer page never reads it. */
  internalCaption: z.string().max(1000).nullable(),
  customerVisible: z.boolean(),
  customerCaption: z.string().min(1).max(300).nullable(),
  visibilitySetAt: z.string().datetime({ offset: true }).nullable(),
  visibilitySetByName: z.string().min(1).max(200).nullable(),
});
export type JobPhoto = z.infer<typeof JobPhotoSchema>;
export const JobPhotoListSchema = z.array(JobPhotoSchema);

/** A decision as staff see it, including how it was resolved. */
export const StaffCustomerDecisionSchema = z.strictObject({
  decisionId: idSchemas.customerDecision,
  jobId: idSchemas.job,
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(2000),
  consequence: z.string().min(1).max(500),
  neededBy: z.string().date().nullable(),
  status: z.enum(['open', 'answered', 'withdrawn']),
  answerNote: z.string().min(1).max(2000).nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});
export type StaffCustomerDecision = z.infer<typeof StaffCustomerDecisionSchema>;
export const StaffCustomerDecisionListSchema = z.array(StaffCustomerDecisionSchema);
