import type { Queryable } from '@apex/database';
import type { JobId } from '@apex/contracts';
import { DomainRuleError } from '@apex/domain';

const immutableStatuses = new Set(['closed', 'cancelled']);

/** Shared service boundary for every command that can change a job record. */
export const assertJobMutable = async (db: Queryable, jobId: JobId): Promise<void> => {
  const result = await db.query<{ status: string }>('select status from jobs where job_id = $1', [jobId]);
  const status = result.rows[0]?.status;
  if (status === undefined) throw new DomainRuleError(`Unknown Job: ${jobId}.`);
  if (immutableStatuses.has(status)) {
    throw new DomainRuleError('This job is closed or cancelled and cannot be edited.');
  }
};
