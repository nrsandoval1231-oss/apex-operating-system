import {
  CUSTOMER_MILESTONES,
  type CustomerMilestoneKey,
  type JobSummary,
  type JobSummaryGate,
  type JobSummaryProject,
} from '@apex/contracts';

/**
 * Presentation helpers for the job read model.
 *
 * Missing facts are shown as "not recorded", never filled in with a guess. A
 * blank contract value means no proposal is signed yet, and the screen has to
 * say so rather than print $0.
 */

/** Last six characters of the ULID — enough to tell jobs apart by eye. */
export const shortId = (id: string): string => id.slice(-6);

export const jobTitle = (job: JobSummary): string =>
  job.customerName ?? `Job ${shortId(job.jobId)}`;

export const jobLocation = (job: JobSummary): string =>
  job.addressLine ?? 'Address not recorded';

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export const formatContract = (cents: number | null): string =>
  cents === null ? 'No signed contract' : dollars.format(cents / 100);

export const GATE_STATUS_LABEL: Record<JobSummaryGate['status'], string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  blocked: 'Blocked',
  'awaiting-countersign': 'Needs countersign',
  released: 'Released',
};

export const JOB_STATUS_LABEL: Record<JobSummary['status'], string> = {
  active: 'Active',
  'on-hold': 'On hold',
  complete: 'Complete',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const MILESTONE_TITLES = new Map(CUSTOMER_MILESTONES.map((m) => [m.key, m.title] as const));

export const milestoneTitle = (key: CustomerMilestoneKey): string =>
  MILESTONE_TITLES.get(key) ?? key;

/**
 * The target completion window, exactly as recorded. A half-open window says so
 * rather than inventing the missing end.
 */
export const targetWindow = (project: JobSummaryProject): string | null => {
  const { targetCompletionStart: start, targetCompletionEnd: end } = project;
  if (start === null && end === null) return null;
  if (start !== null && end !== null) return `${start} – ${end}`;
  return start !== null ? `From ${start}` : `By ${end}`;
};
