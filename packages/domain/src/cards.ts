import {
  constructionPhase,
  type ActionCard,
  type JobInspection,
  type CardGroup,
  type CardUrgency,
  type ConstructionPhaseKey,
  type JobId,
} from '@apex/contracts';
import { describeInspection, inspectionPressure } from './inspections.js';

/**
 * The action-card derivation — PRD §9.5.
 *
 * Pure. No database, no clock, no I/O: `today` is passed in. This is the single
 * place that decides what deserves the owner's attention, so the Today feed, the
 * daily brief, and notifications cannot drift apart from each other.
 *
 * Two rules govern what is allowed to become a card:
 *
 * 1. It must be derivable from a fact the system actually holds. A card that
 *    guesses is worse than no card, because the owner learns to distrust the feed.
 * 2. It must be able to state a consequence. "Gate is in progress" is not a card;
 *    "eleven of eleven clear, signing releases Draw 2" is.
 */

export interface CardGateSnapshot {
  readonly definitionKey: string;
  readonly title: string;
  readonly sequence: number | null;
  readonly phaseKey: ConstructionPhaseKey | null;
  readonly drawCode: string | null;
  readonly requiresCountersign: boolean;
  readonly gateInstanceId: string | null;
  readonly status: 'not-started' | 'in-progress' | 'blocked' | 'awaiting-countersign' | 'released' | null;
  readonly requirementsTotal: number;
  readonly requirementsPassed: number;
  /** Every requirement that demands evidence has at least one piece. */
  readonly evidenceComplete: boolean;
  /** Set once someone has signed a Gate that awaits a countersign. */
  readonly signedByName: string | null;
  readonly signedAt: string | null;
}

export interface CardDrawSnapshot {
  readonly drawId: string;
  readonly drawCode: string;
  readonly label: string;
  /** Null when the job had no signed contract total to divide. */
  readonly amountCents: number | null;
  readonly percentBasisPoints: number | null;
  readonly status: 'scheduled' | 'eligible' | 'invoiced' | 'paid';
  readonly eligibleAt: string | null;
}

export interface CardProjectSnapshot {
  readonly currentPhaseKey: ConstructionPhaseKey;
  readonly superintendentName: string | null;
  readonly targetCompletionEnd: string | null;
  readonly riskNote: string | null;
}

/** A visit on this job, with any conflict already detected against it. */
export interface CardVisitSnapshot {
  readonly visitId: string;
  readonly subcontractorName: string;
  readonly trade: string;
  readonly phaseTitle: string;
  readonly startsOn: string;
  readonly endsOn: string;
  /** Plain-language conflict descriptions; empty when the visit is clean. */
  readonly conflicts: readonly { readonly kind: string; readonly description: string }[];
}

export interface CardJobSnapshot {
  readonly jobId: JobId;
  readonly customerName: string | null;
  readonly addressLine: string | null;
  readonly jobStatus: string;
  readonly approvedTakeoffRevisionId: string | null;
  /** The signed contract total, when a proposal has been signed. */
  readonly contractCents: number | null;
  /** True once the job has a draw schedule. */
  readonly hasDrawSchedule: boolean;
  readonly project: CardProjectSnapshot | null;
  readonly gates: readonly CardGateSnapshot[];
  readonly draws: readonly CardDrawSnapshot[];
  readonly visits: readonly CardVisitSnapshot[];
  /**
   * Every inspection on the job, recorded or not. Carried whole rather than
   * pre-filtered: the derivation decides what is urgent, and a caller that
   * filtered first would be making that judgment somewhere else.
   */
  readonly inspections: readonly JobInspection[];
}

/** Days before the target completion date that the job starts appearing in This Week. */
const DUE_SOON_DAYS = 14;

const URGENCY_RANK: Readonly<Record<CardUrgency, number>> = { urgent: 0, important: 1, routine: 2 };
const GROUP_RANK: Readonly<Record<CardGroup, number>> = { 'needs-you': 0, running: 1, 'this-week': 2 };

/** Calendar days from `from` to `to`, both YYYY-MM-DD. Negative when `to` is past. */
const daysBetween = (from: string, to: string): number => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.round((end - start) / 86_400_000);
};

const asDay = (timestamp: string): string => timestamp.slice(0, 10);

/**
 * Whole dollars. Cards are read on a phone in the sun; the cents on a $45,612
 * draw are noise, and the exact figure lives on the draw schedule.
 */
const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100);

const formatPercent = (basisPoints: number): string => `${basisPoints / 100}%`;

const readableDay = (day: string): string => {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed)) return day;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
};

const dayCountLabel = (days: number, past: string, future: string, today: string): string => {
  if (days === 0) return today;
  const magnitude = Math.abs(days);
  const unit = magnitude === 1 ? 'day' : 'days';
  return days < 0 ? `${past} ${magnitude} ${unit}` : `${future} ${magnitude} ${unit}`;
};

interface CardDraft {
  readonly kind: ActionCard['kind'];
  readonly group: CardGroup;
  readonly urgency: CardUrgency;
  readonly subject: string;
  readonly title: string;
  readonly reason: string;
  readonly dueLabel?: string | null;
  readonly amountCents?: number | null;
  readonly actionLabel: string;
  readonly actionHref: string;
}

const build = (job: CardJobSnapshot, draft: CardDraft): ActionCard => ({
  cardId: `${draft.kind}:${job.jobId}:${draft.subject}`,
  kind: draft.kind,
  group: draft.group,
  urgency: draft.urgency,
  jobId: job.jobId,
  customerName: job.customerName,
  location: job.addressLine,
  title: draft.title,
  reason: draft.reason,
  dueLabel: draft.dueLabel ?? null,
  amountCents: draft.amountCents ?? null,
  actionLabel: draft.actionLabel,
  actionHref: draft.actionHref,
});

/**
 * Cards for one job.
 *
 * Closed, cancelled, and complete jobs produce nothing: a finished pool is not
 * an outstanding decision, and leaving its cards up trains the owner to ignore
 * the feed.
 */
export function deriveJobCards(job: CardJobSnapshot, today: string): readonly ActionCard[] {
  if (job.jobStatus !== 'active' && job.jobStatus !== 'on-hold') return [];

  const cards: ActionCard[] = [];
  const project = job.project;
  const detail = `/projects/${job.jobId}`;

  // --- Gates ---------------------------------------------------------------

  // Legacy countersign states are retained only for historical replay. Active
  // Gate definitions cannot produce this state, so no action card is emitted.
  for (const gate of job.gates) {
    if (gate.status === 'blocked') {
      cards.push(build(job, {
        kind: 'gate.blocked',
        group: 'needs-you',
        urgency: 'urgent',
        subject: gate.definitionKey,
        title: `Clear the block on ${gate.title}`,
        reason: 'A requirement failed its evaluation. The Gate cannot release, so everything downstream of it is stopped.',
        dueLabel: 'Blocking work',
        actionLabel: 'Open the Gate',
        actionHref: detail,
      }));
      continue;
    }

    if (gate.status === 'in-progress') {
      const ready = gate.requirementsTotal > 0
        && gate.requirementsPassed === gate.requirementsTotal
        && gate.evidenceComplete;
      if (ready) {
        const consequence = gate.drawCode === null
          ? 'Releasing it authorizes the next phase of work.'
          : `Releasing it makes ${gate.drawCode.replace('draw-', 'Draw ')} eligible to bill.`;
        cards.push(build(job, {
          kind: 'gate.ready',
          group: 'needs-you',
          urgency: 'important',
          subject: gate.definitionKey,
          title: `Sign off ${gate.title}`,
          reason: `All ${gate.requirementsTotal} requirements passed with evidence attached. ${consequence}`,
          dueLabel: 'Ready now',
          actionLabel: 'Review and sign',
          actionHref: `${detail}?gate=${encodeURIComponent(gate.definitionKey)}`,
        }));
      } else {
        cards.push(build(job, {
          kind: 'gate.in-progress',
          group: 'running',
          urgency: 'routine',
          subject: gate.definitionKey,
          title: `${gate.title}: ${gate.requirementsPassed} of ${gate.requirementsTotal} clear`,
          reason: gate.evidenceComplete
            ? 'The remaining requirements still need evaluating.'
            : 'Requirements are still outstanding. Photos and other evidence are optional documentation.',
          dueLabel: null,
          actionLabel: 'Open the Gate',
          actionHref: `${detail}?gate=${encodeURIComponent(gate.definitionKey)}`,
        }));
      }
      continue;
    }

    // Not opened, and the project has reached the phase this Gate sits on.
    //
    // Suppressed without an approved takeoff: a Gate cannot open without one, so
    // asking would be asking for something impossible. The takeoff card below
    // already names the real blocker, and one accurate card beats two.
    if (
      gate.gateInstanceId === null
      && project !== null
      && gate.phaseKey !== null
      && job.approvedTakeoffRevisionId !== null
    ) {
      const gatePhase = constructionPhase(gate.phaseKey).sequence;
      const currentPhase = constructionPhase(project.currentPhaseKey).sequence;
      if (gatePhase === currentPhase) {
        cards.push(build(job, {
          kind: 'gate.not-opened',
          group: 'running',
          urgency: 'routine',
          subject: gate.definitionKey,
          title: `Open the ${gate.title} gate`,
          reason: `The job is in ${constructionPhase(project.currentPhaseKey).title} and this Gate has not been started, `
            + 'so no evidence is being collected against it.',
          dueLabel: null,
          actionLabel: 'Open the Gate',
          actionHref: `${detail}?gate=${encodeURIComponent(gate.definitionKey)}`,
        }));
      } else if (gatePhase === currentPhase + 1) {
        cards.push(build(job, {
          kind: 'gate.not-opened',
          group: 'this-week',
          urgency: 'routine',
          subject: `${gate.definitionKey}:upcoming`,
          title: `${gate.title} comes next`,
          reason: gate.drawCode === null
            ? 'The Gate after the current phase. Nothing to do yet.'
            : `The next Gate on this job, and it releases ${gate.drawCode.replace('draw-', 'Draw ')}.`,
          dueLabel: null,
          actionLabel: 'View project',
          actionHref: `${detail}?gate=${encodeURIComponent(gate.definitionKey)}`,
        }));
      }
    }
  }

  // --- Money ---------------------------------------------------------------
  //
  // A released draw that has not been billed is work Apex has done and not been
  // paid for. PRD §9.8 deliberately keeps invoicing a human step, so this card
  // is the only thing standing between a passed Gate and an invoice.

  for (const draw of job.draws) {
    if (draw.status !== 'eligible') continue;
    const days = draw.eligibleAt === null ? Number.NaN : daysBetween(asDay(draw.eligibleAt), today);
    // Never assert *why* an amount is missing: it may be a job with no signed
    // contract, or a draw recorded before the schedule existed. Say what is
    // known, which is that the figure has to come from a person.
    const money = draw.amountCents === null
      ? 'This draw carries no amount, so the figure has to come from the contract rather than from here.'
      : `${formatMoney(draw.amountCents)}${draw.percentBasisPoints === null ? '' : ` — ${formatPercent(draw.percentBasisPoints)} of the contract`}.`;
    cards.push(build(job, {
      kind: 'draw.uninvoiced',
      group: 'needs-you',
      // Money that has been earned and not billed gets more urgent with age.
      urgency: Number.isNaN(days) || days < 3 ? 'important' : 'urgent',
      subject: draw.drawCode,
      title: draw.amountCents === null
        ? `Bill the ${draw.label}`
        : `Bill the ${draw.label} — ${formatMoney(draw.amountCents)}`,
      reason: `${money} It is earned and unbilled. `
        + 'Apex OS does not invoice on its own, so it waits here until someone confirms it.',
      dueLabel: Number.isNaN(days)
        ? 'Ready to bill'
        : dayCountLabel(days, 'Billable for', 'Billable for', 'Billable today'),
      amountCents: draw.amountCents,
      actionLabel: 'Confirm invoice',
      actionHref: detail,
    }));
  }

  // A signed contract with no schedule means nothing is tracking what is owed.
  if (!job.hasDrawSchedule && job.contractCents !== null) {
    cards.push(build(job, {
      kind: 'draw.unscheduled',
      group: 'needs-you',
      urgency: 'important',
      subject: 'schedule',
      title: 'Set up the draw schedule',
      reason: `This job has a signed contract of ${formatMoney(job.contractCents)} and no draw schedule, `
        + 'so no Gate release can make anything billable and nothing is tracking what is owed.',
      dueLabel: null,
      actionLabel: 'Create schedule',
      actionHref: detail,
    }));
  }

  // --- Schedule -----------------------------------------------------------
  //
  // A conflict is urgent whatever the date: a crew double-booked next week is
  // still a phone call that has to happen today, because the other job's owner
  // is planning around the same day.

  for (const visit of job.visits) {
    const window = visit.startsOn === visit.endsOn
      ? readableDay(visit.startsOn)
      : `${readableDay(visit.startsOn)} – ${readableDay(visit.endsOn)}`;
    const startsIn = daysBetween(today, visit.startsOn);

    for (const conflict of visit.conflicts) {
      cards.push(build(job, {
        kind: conflict.kind === 'crew-double-booked' ? 'schedule.crew-conflict' : 'schedule.before-gate',
        group: 'needs-you',
        urgency: 'urgent',
        subject: `${visit.visitId}:${conflict.kind}`,
        title: conflict.kind === 'crew-double-booked'
          ? `${visit.subcontractorName} is double-booked`
          : `${visit.trade} booked before its gate`,
        reason: conflict.description,
        dueLabel: Number.isNaN(startsIn)
          ? window
          : `${window} · ${dayCountLabel(startsIn, 'started', 'in', 'starts today')}`,
        actionLabel: 'Open project',
        actionHref: detail,
      }));
    }

    // Clean visits are worth knowing about, but only the imminent ones and only
    // as something to expect rather than something to do.
    if (visit.conflicts.length === 0 && !Number.isNaN(startsIn) && startsIn >= 0 && startsIn <= 7) {
      cards.push(build(job, {
        kind: 'schedule.upcoming',
        group: 'this-week',
        urgency: 'routine',
        subject: visit.visitId,
        title: `${visit.subcontractorName} — ${visit.trade}`,
        reason: `${visit.phaseTitle}. Booked and clear of conflicts.`,
        dueLabel: `${window} · ${dayCountLabel(startsIn, 'started', 'in', 'starts today')}`,
        actionLabel: 'View project',
        actionHref: detail,
      }));
    }
  }

  // --- Inspections --------------------------------------------------------
  //
  // This is the card the whole inspection feature exists to produce. The
  // deadline is not the inspection date; it is the last day the request can go
  // in and still arrive before the work needs it, which is `lastSafeRequestOn`.
  //
  // Nothing is emitted for an inspection with no deadline. An inspection whose
  // work nobody has booked genuinely has no last safe day, and a card that
  // cannot state one would be urgency the system cannot justify.

  for (const inspection of job.inspections) {
    const pressure = inspectionPressure(inspection, today);
    if (pressure === 'clear' || pressure === 'ahead' || pressure === 'unscheduled') continue;

    const kind = inspection.status === 'failed'
      ? 'inspection.failed'
      : pressure === 'overdue' ? 'inspection.overdue' : 'inspection.due';

    cards.push(build(job, {
      kind,
      group: 'needs-you',
      // A failed inspection and a missed request date both stop the same work.
      urgency: 'urgent',
      subject: `inspection:${inspection.inspectionKey}`,
      title: inspection.status === 'failed'
        ? `${inspection.title} failed — corrections needed`
        : `Request ${inspection.title.toLowerCase()}`,
      reason: describeInspection(inspection, today),
      dueLabel: inspection.lastSafeRequestOn === null
        ? null
        : `Request by ${readableDay(inspection.lastSafeRequestOn)}`,
      actionLabel: 'Open inspection',
      actionHref: `${detail}?focus=inspections`,
    }));
  }

  // --- The project record itself ------------------------------------------

  if (job.approvedTakeoffRevisionId === null) {
    cards.push(build(job, {
      kind: 'takeoff.missing',
      group: 'needs-you',
      urgency: 'important',
      subject: 'takeoff',
      title: 'Approve a takeoff revision',
      reason: 'No approved Designer takeoff is attached, so no Gate can be opened on this job and no evidence can be collected.',
      dueLabel: 'Blocking every Gate',
      actionLabel: 'View project',
      actionHref: detail,
    }));
  }

  if (project === null) {
    cards.push(build(job, {
      kind: 'project.unopened',
      group: 'needs-you',
      urgency: 'important',
      subject: 'project',
      title: 'Open this job as a construction project',
      reason: 'The job exists but has no construction phase, so it has no place in the schedule and no customer milestone.',
      dueLabel: null,
      actionLabel: 'Open project',
      actionHref: detail,
    }));
    return sortCards(cards);
  }

  if (project.superintendentName === null) {
    cards.push(build(job, {
      kind: 'project.unassigned',
      group: 'needs-you',
      urgency: 'important',
      subject: 'superintendent',
      title: 'Assign a superintendent',
      reason: 'Nobody is accountable for this job, so there is no one to chase when it stalls.',
      dueLabel: null,
      actionLabel: 'Assign',
      actionHref: detail,
    }));
  }

  if (project.riskNote !== null) {
    cards.push(build(job, {
      kind: 'project.risk',
      group: 'running',
      urgency: 'routine',
      subject: 'risk',
      title: 'Recorded risk on this job',
      reason: project.riskNote,
      dueLabel: null,
      actionLabel: 'View project',
      actionHref: detail,
    }));
  }

  if (project.targetCompletionEnd !== null) {
    const days = daysBetween(today, project.targetCompletionEnd);
    const phase = constructionPhase(project.currentPhaseKey);
    if (!Number.isNaN(days)) {
      if (days < 0) {
        cards.push(build(job, {
          kind: 'project.overdue',
          group: 'needs-you',
          urgency: 'urgent',
          subject: 'target',
          title: 'Target completion has passed',
          reason: `The target window ended and the job is still in ${phase.title} (phase ${phase.sequence} of 11). `
            + 'The customer is working from the old date until someone tells them otherwise.',
          dueLabel: dayCountLabel(days, 'Overdue by', 'Overdue by', 'Due today'),
          actionLabel: 'View project',
          actionHref: detail,
        }));
      } else if (days <= DUE_SOON_DAYS) {
        cards.push(build(job, {
          kind: 'project.due-soon',
          group: 'this-week',
          urgency: 'routine',
          subject: 'target',
          title: `Target completion ${readableDay(project.targetCompletionEnd)}`,
          reason: `Currently in ${phase.title}, phase ${phase.sequence} of 11.`,
          dueLabel: dayCountLabel(days, 'In', 'In', 'Due today'),
          actionLabel: 'View project',
          actionHref: detail,
        }));
      }
    }
  }

  return sortCards(cards);
}

/**
 * Deterministic ordering: section, then urgency, then card id. No clock and no
 * insertion-order dependence, so the same state always renders the same feed.
 */
export const sortCards = (cards: readonly ActionCard[]): readonly ActionCard[] =>
  [...cards].sort((a, b) =>
    GROUP_RANK[a.group] - GROUP_RANK[b.group]
    || URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]
    || a.cardId.localeCompare(b.cardId));

/** Every card across every job, ordered as one feed. */
export const deriveCards = (
  jobs: readonly CardJobSnapshot[],
  today: string,
): readonly ActionCard[] =>
  sortCards(jobs.flatMap((job) => deriveJobCards(job, today)));
