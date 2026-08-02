import { ulid } from 'ulid';
import { z } from 'zod';

export const ID_KINDS = [
  'lead',
  'proposal',
  'proposal_version',
  'job',
  'event',
  'revision',
  'gate',
  'evidence',
  'user',
  'draw',
  'customer_update',
  'brief',
] as const;

export type CanonicalIdKind = (typeof ID_KINDS)[number];

const canonicalIdSchema = <Prefix extends CanonicalIdKind>(prefix: Prefix) =>
  z.custom<`${Prefix}_${string}`>(
    (value) => typeof value === 'string' && new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`).test(value),
    { message: `Expected canonical ${prefix}_<ULID> identifier` },
  );

export const idSchemas = {
  lead: canonicalIdSchema('lead'),
  proposal: canonicalIdSchema('proposal'),
  proposal_version: canonicalIdSchema('proposal_version'),
  job: canonicalIdSchema('job'),
  event: canonicalIdSchema('event'),
  revision: canonicalIdSchema('revision'),
  gate: canonicalIdSchema('gate'),
  evidence: canonicalIdSchema('evidence'),
  user: canonicalIdSchema('user'),
  draw: canonicalIdSchema('draw'),
  customer_update: canonicalIdSchema('customer_update'),
  brief: canonicalIdSchema('brief'),
} as const;

export const createCanonicalId = <Kind extends CanonicalIdKind>(kind: Kind, timestamp?: number): `${Kind}_${string}` =>
  `${kind}_${ulid(timestamp)}`;

export type LeadId = z.infer<typeof idSchemas.lead>;
export type ProposalId = z.infer<typeof idSchemas.proposal>;
export type ProposalVersionId = z.infer<typeof idSchemas.proposal_version>;
export type JobId = z.infer<typeof idSchemas.job>;
export type EventId = z.infer<typeof idSchemas.event>;
export type RevisionId = z.infer<typeof idSchemas.revision>;
export type GateInstanceId = z.infer<typeof idSchemas.gate>;
export type EvidenceId = z.infer<typeof idSchemas.evidence>;
export type UserId = z.infer<typeof idSchemas.user>;
export type DrawId = z.infer<typeof idSchemas.draw>;
export type CustomerUpdateId = z.infer<typeof idSchemas.customer_update>;
export type BriefId = z.infer<typeof idSchemas.brief>;
