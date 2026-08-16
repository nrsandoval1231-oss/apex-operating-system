import { exportDesignerQuantityPayload } from './approvedTakeoff.ts';
import type { TakeoffResult } from './index.ts';
import type { Job } from './types.ts';

/**
 * The handover to Apex OS.
 *
 * Designer measures; Apex OS decides what is approved. This builds exactly what
 * the receiving contract accepts and nothing more — see
 * `DesignerTakeoffSubmissionSchema` in the apex-operating-system repository,
 * which is a strict object and will refuse anything extra.
 *
 * **What is deliberately absent.** No digest, no revision id, no approver, no
 * status. Designer does not get to assert any of them: the receiver computes the
 * hashes from the bytes it actually receives, and identity and authority are its
 * to assign. A drawing tool that could name its own approver could approve on
 * somebody else's behalf.
 *
 * `jobModel` travels verbatim because the receiver hashes it into
 * `jobInputSha256`. That column is meant to record the input the system saw, so
 * sending a summary or a hash computed here would defeat it.
 */

export const DESIGNER_ENGINE_VERSION = 'designer-0.1.0';

export interface ApexTakeoffSubmission {
  readonly engineVersion: string;
  readonly quantityModelVersion: string;
  readonly jobModel: Job;
  readonly quantities: ReturnType<typeof exportDesignerQuantityPayload>['quantities'];
  readonly calcLedger: ReturnType<typeof exportDesignerQuantityPayload>['calcLedger'];
}

/**
 * Throws for the same reasons the export does — a takeoff with a blocking code
 * failure, or a structural detail outside the stored envelope, is not something
 * to hand anyone as authority.
 */
export function buildApexSubmission(job: Job, takeoff: TakeoffResult): ApexTakeoffSubmission {
  const payload = exportDesignerQuantityPayload(takeoff);
  return {
    engineVersion: DESIGNER_ENGINE_VERSION,
    quantityModelVersion: payload.quantityModelVersion,
    jobModel: job,
    quantities: payload.quantities,
    calcLedger: payload.calcLedger,
  };
}

/**
 * A filename someone can recognise in a downloads folder a week later.
 *
 * No date: the file's meaning comes from the design it carries, and a stamp here
 * would be the moment it was exported rather than anything about the takeoff.
 */
export function draftEstimateStorageKey(leadId: string): string {
  return `apex-estimate-submission:${leadId}`;
}

/**
 * The lead-scoped browser key used to carry the exact Designer submission into
 * the estimate workspace without asking the estimator to download and re-upload
 * the JSON by hand.
 */
export function submissionFileName(job: Job): string {
  const slug = job.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `apex-takeoff-${slug === '' ? 'design' : slug}.json`;
}
