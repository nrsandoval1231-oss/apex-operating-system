import {
  CONSTRUCTION_PHASES,
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

/** Maps a gate status onto the existing badge palette. */
export const gateBadgeClass = (status: JobSummaryGate['status']): string => {
  switch (status) {
    case 'blocked': return 'badge-urgent';
    case 'in-progress': return 'badge-warning';
    // A signed but unreleased Gate is work waiting on a person, not a problem
    // with the work — but it is holding up the pour, so it reads as urgent.
    case 'awaiting-countersign': return 'badge-urgent';
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

const MILESTONE_TITLES = new Map(CUSTOMER_MILESTONES.map((m) => [m.key, m.title] as const));

export const milestoneTitle = (key: CustomerMilestoneKey): string =>
  MILESTONE_TITLES.get(key) ?? key;

export const PHASE_COUNT = CONSTRUCTION_PHASES.length;

/** "Phase 5 of 11 · Gunite/Shotcrete Concrete Pour", or the absence of a project. */
export const phaseLine = (project: JobSummaryProject | null): string =>
  project === null
    ? 'Not opened as a construction project'
    : `Phase ${project.currentPhaseSequence} of ${PHASE_COUNT} · ${project.currentPhaseTitle}`;

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
    case 'awaiting-countersign':
      return `${title} — signed off, waiting on the owner's countersign before work may proceed.`;
    case 'released': return `${title} — released.`;
  }
};
