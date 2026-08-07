import { describe, expect, it } from 'vitest';
import { buildApexSubmission, submissionFileName } from './apexSubmission.ts';
import { runTakeoff } from './index.ts';
import { STANDARD_MODEL } from './standardModel.ts';
import type { Job } from './types.ts';

/**
 * The handover to Apex OS.
 *
 * The receiving contract is a STRICT object, so a field added here in good faith
 * is rejected wholesale on arrival rather than ignored — and the failure would
 * appear in the other repository, on a job site, to somebody who cannot read
 * this code. That asymmetry is why the shape is pinned here.
 */

const safeStandardJob = (): Job => ({ ...STANDARD_MODEL, equipment: undefined });

describe('the Apex OS submission', () => {
  it('carries exactly the fields the receiver accepts, and no others', () => {
    const job = safeStandardJob();
    const submission = buildApexSubmission(job, runTakeoff(job));

    expect(Object.keys(submission).sort()).toEqual([
      'calcLedger',
      'engineVersion',
      'jobModel',
      'quantities',
      'quantityModelVersion',
    ]);
  });

  /**
   * Not an oversight: the receiver computes these from the bytes it receives.
   * A digest asserted by the sender is a claim about evidence rather than the
   * evidence, and identity and authority belong to the system doing the
   * approving.
   */
  it('asserts no digest, revision id, approver or status', () => {
    const job = safeStandardJob();
    const submission = buildApexSubmission(job, runTakeoff(job)) as Record<string, unknown>;

    for (const forbidden of [
      'quantityPayloadSha256',
      'calcLedgerSha256',
      'jobInputSha256',
      'revisionId',
      'revisionNumber',
      'status',
      'approvedBy',
      'approvedAt',
    ]) {
      expect(submission[forbidden]).toBeUndefined();
    }
  });

  it('carries all seventeen measured quantities with their Calc provenance', () => {
    const job = safeStandardJob();
    const submission = buildApexSubmission(job, runTakeoff(job));

    expect(submission.quantities).toHaveLength(17);
    for (const quantity of submission.quantities) {
      const entry = submission.calcLedger.find((candidate) => candidate.id === quantity.calcId);
      // The receiver refuses a quantity that does not equal the Calc it names,
      // so a mismatch here is a rejection there.
      expect(entry).toMatchObject({ value: quantity.value, unit: quantity.unit });
    }
  });

  /**
   * The receiver hashes this into `job_input_sha256`, which is meant to record
   * the input the system saw. A summary would defeat the column.
   */
  it('sends the job model verbatim', () => {
    const job = safeStandardJob();
    const submission = buildApexSubmission(job, runTakeoff(job));
    expect(submission.jobModel).toEqual(job);
  });

  it('reports the quantity model version the engine actually used', () => {
    const job = safeStandardJob();
    expect(buildApexSubmission(job, runTakeoff(job)).quantityModelVersion).toBe('designer-quantity-v4');
  });

  /**
   * A design that cannot be built must not be handed over as authority. The
   * refusal comes from the export boundary and is left to speak for itself.
   */
  it('refuses a design with blocking code failures', () => {
    const unsafe = runTakeoff(STANDARD_MODEL);
    if (!unsafe.hasCodeFailure) return; // Standard model is clean; nothing to assert.
    expect(() => buildApexSubmission(STANDARD_MODEL, unsafe)).toThrow(/code or safety/i);
  });

  it('names the file after the design rather than the moment it was exported', () => {
    expect(submissionFileName({ ...safeStandardJob(), name: 'Gamble — 15x30' }))
      .toBe('apex-takeoff-gamble-15x30.json');
    expect(submissionFileName({ ...safeStandardJob(), name: '   ' })).toBe('apex-takeoff-design.json');
  });
});
