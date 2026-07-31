import type { JobSummary, JobSummaryGate } from '@apex/contracts';

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
  released: 'Released',
};

/** Maps a gate status onto the existing badge palette. */
export const gateBadgeClass = (status: JobSummaryGate['status']): string => {
  switch (status) {
    case 'blocked': return 'badge-urgent';
    case 'in-progress': return 'badge-warning';
    case 'released': return 'badge-success';
    case 'not-started': return 'badge-info';
  }
};

export const JOB_STATUS_LABEL: Record<JobSummary['status'], string> = {
  active: 'Active',
  'on-hold': 'On hold',
  complete: 'Complete',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/**
 * One-line description of where the job stands, derived only from stored facts.
 * This is not the §9.5 action card — that needs the card engine.
 */
export const gateSummaryLine = (job: JobSummary): string => {
  if (job.currentGate === null) {
    return job.approvedTakeoffRevisionId === null
      ? 'No gate yet — an approved takeoff revision is required first.'
      : 'No gate open.';
  }
  const { title, status } = job.currentGate;
  switch (status) {
    case 'not-started': return `${title} — not started.`;
    case 'in-progress': return `${title} — evidence in progress.`;
    case 'blocked': return `${title} — blocked on a failed requirement.`;
    case 'released': return `${title} — released.`;
  }
};
