import { describe, expect, it } from 'vitest';
import {
  exportDesignerQuantityPayload,
  runTakeoff,
  STANDARD_MODEL,
} from '../Apex Designer/src/engine/index.ts';
import { ApprovedTakeoffRevisionSchema } from '../packages/contracts/src/records.ts';

const jobId = 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const revisionId = 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const actorId = 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2';

describe('Designer to canonical contract compatibility', () => {
  it('accepts the real Designer export without translation or quantity recomputation', () => {
    const takeoff = runTakeoff({ ...STANDARD_MODEL, equipment: undefined });
    const payload = exportDesignerQuantityPayload(takeoff);

    const revision = ApprovedTakeoffRevisionSchema.parse({
      revisionId,
      jobId,
      revisionNumber: 1,
      status: 'approved',
      engineVersion: 'designer-0.1.0',
      jobInputSha256: 'a'.repeat(64),
      calcLedgerSha256: 'b'.repeat(64),
      quantityModelVersion: payload.quantityModelVersion,
      createdAt: '2026-07-29T12:00:00.000Z',
      createdBy: actorId,
      approvedAt: '2026-07-29T12:05:00.000Z',
      approvedBy: actorId,
      blockingIssues: [],
      quantities: payload.quantities,
      calcLedger: payload.calcLedger,
    });

    expect(revision.quantities).toHaveLength(17);
    expect(revision.quantities.find((quantity) => quantity.code === 'shell.gunite-ordered-volume')?.value)
      .toBe(takeoff.structure.outcome === 'quantities' ? takeoff.structure.quantities.guniteCy.value : undefined);
  });
});
