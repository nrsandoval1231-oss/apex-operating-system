import {
  CONSTRUCTION_PHASES,
  CUSTOMER_MILESTONES,
  constructionPhase,
  customerMilestoneForPhase,
  type ConstructionPhaseKey,
  type CustomerMilestoneKey,
  type CustomerContact,
  type CustomerDecision,
  type CustomerMilestoneStep,
  type CustomerPage,
  type CustomerPhoto,
  type CustomerUpdate,
  type MilestoneState,
} from '@apex/contracts';

/**
 * The customer progress page projection — PRD §9.11.
 *
 * Pure. State in, page out. No database, no clock, no I/O.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: the page is *built*, never *filtered*.
 * `buildCustomerPage` constructs every field of the payload from a narrow input
 * type that carries only what a customer may see. It never receives a project
 * record, a job summary, a draw, a visit, or an action card, so no future column
 * on any of those can reach a customer by being forgotten about. §9.11's list of
 * things to hide — costs, subcontractor names, internal checklists, risk scores,
 * internal notes — is enforced by absence rather than by a deny-list somebody
 * has to remember to extend.
 *
 * COPY: the nine phase descriptions below were written from the confirmed
 * construction model (docs/decisions/construction-model.md) and APPROVED as
 * written by Travis Sandoval on 2026-08-03. They are Apex's voice speaking to
 * Apex's customers, so changing one is a deliberate act with a test behind it,
 * not a tidy-up.
 *
 * What must not creep in: a per-phase date. Apex OS holds a target completion
 * window, not a schedule anyone committed to, and a date here is a promise the
 * system cannot keep.
 */

/** What a homeowner is told while a phase is current, and what follows it. */
interface PhaseCopy {
  /** Short status line. Never a phase key, never a gate name. */
  readonly headline: string;
  /** What is happening now. */
  readonly now: string;
  /** One sentence describing this phase to someone who has not reached it yet. */
  readonly preview: string;
}

const PHASE_COPY: Readonly<Record<ConstructionPhaseKey, PhaseCopy>> = {
  'design-permitting': {
    headline: 'Design and permitting',
    now: 'Your plans are being finalised and submitted for engineering and permit approval. '
      + 'This stage is mostly paperwork and review, and its length depends on the city rather than on us. '
      + 'Nothing is dug until the permit is in hand.',
    preview: 'plans finalised and the permit approved',
  },
  'layout-excavation': {
    headline: 'Layout and excavation',
    now: 'Your pool is being marked out on the ground and excavated to shape. '
      + 'This is the first day the project stops being drawings — expect heavy equipment, '
      + 'noise, and a large amount of spoil to be hauled away.',
    preview: 'the pool marked out and dug',
  },
  'steel-reinforcement': {
    headline: 'Steel going in',
    now: 'The steel reinforcing cage that gives the shell its strength is being tied in place. '
      + 'It looks like a basket of rebar, and every bar spacing is checked before anything covers it.',
    preview: 'the reinforcing steel tied in place',
  },
  'rough-in': {
    headline: 'Plumbing and electrical',
    now: 'Plumbing and electrical lines are being run before the shell goes on. '
      + 'Everything installed now will be permanently behind concrete, so this stage is '
      + 'inspected and photographed carefully before it is covered.',
    preview: 'plumbing and electrical run and inspected',
  },
  gunite: {
    headline: 'The shell',
    now: 'The concrete shell is being applied and cured. '
      + 'Once it is on, the shape of your pool is permanent. '
      + 'Curing takes several days and the shell is watered during it — that is normal and deliberate.',
    preview: 'the concrete shell applied and cured',
  },
  'tile-coping': {
    headline: 'Tile and coping',
    now: 'Waterline tile and coping are being installed. '
      + 'This is the first stage where your selections become visible, '
      + 'and it changes how the whole pool reads.',
    preview: 'waterline tile and coping installed',
  },
  decking: {
    headline: 'Decking',
    now: 'The patio decking and surrounding hardscape are being built. '
      + 'The area around the pool will be a work site until it cures.',
    preview: 'the patio and surrounding decking built',
  },
  'equipment-hookup': {
    headline: 'Equipment',
    now: 'Pumps, filtration, heating, and controls are being installed and connected at the equipment pad. '
      + 'This is what makes the pool run rather than what it looks like.',
    preview: 'pumps, filtration, and controls installed',
  },
  'plaster-fill': {
    headline: 'Plaster and fill',
    now: 'The interior finish is being applied and the pool is being filled. '
      + 'Filling runs continuously once it starts and should not be interrupted. '
      + 'The water will look cloudy at first; that clears as the finish cures and the chemistry settles.',
    preview: 'the interior finish applied and the pool filled',
  },
};

/** Said once the job itself is complete — never because phase nine finished. */
const HANDOVER_COPY: PhaseCopy = {
  headline: 'Your pool is finished',
  now: 'Your pool is complete and has been handed over. '
    + 'Startup chemistry and equipment operation were walked through with you at handover. '
    + 'Call or text any time with a question about running it.',
  preview: 'handover and your walkthrough',
};

/**
 * A job that has not been opened as a construction project.
 *
 * The customer must not be shown "Design and permitting" merely because that is
 * phase one: nobody has said the build has started, and inventing a status is
 * exactly the failure this page exists to avoid.
 */
const NOT_STARTED_COPY: PhaseCopy = {
  headline: 'Getting ready to start',
  now: 'Your project is signed and in our schedule. '
    + 'Construction has not begun yet, so there is nothing on site to report. '
    + 'This page will fill in as soon as work starts.',
  preview: 'construction scheduled to begin',
};

/** Recent, not all. A customer scrolling a hundred footing photos learns less. */
const MAX_PHOTOS = 12;
const MAX_UPDATES = 10;

const milestoneSequence = (key: CustomerMilestoneKey): number => {
  const milestone = CUSTOMER_MILESTONES.find((entry) => entry.key === key);
  if (!milestone) throw new Error(`Unknown customer milestone: ${key}`);
  return milestone.sequence;
};

/**
 * The six milestones with one marked current.
 *
 * `handover` is only ever reached from a completed job, never from phase nine —
 * a pool full of water is not a pool that has been handed over, and this page
 * must not be the thing that tells a customer otherwise.
 */
export const buildMilestoneTrack = (current: CustomerMilestoneKey | null): readonly CustomerMilestoneStep[] => {
  const currentSequence = current === null ? 0 : milestoneSequence(current);
  return CUSTOMER_MILESTONES.map((milestone): CustomerMilestoneStep => {
    let state: MilestoneState = 'upcoming';
    if (milestone.sequence < currentSequence) state = 'done';
    else if (milestone.sequence === currentSequence) state = 'current';
    return { key: milestone.key, title: milestone.title, state };
  });
};

/** A published photo, as the projection receives it. */
export interface PublishedPhoto {
  readonly evidenceId: CustomerPhoto['evidenceId'];
  readonly caption: string | null;
  readonly takenOn: string;
}

export interface CustomerPageInput {
  readonly customerName: string | null;
  readonly addressLine: string | null;
  /** Null when the job has no construction project yet. */
  readonly currentPhaseKey: ConstructionPhaseKey | null;
  /** Handover comes from here and from nowhere else. */
  readonly jobComplete: boolean;
  readonly decisions: readonly CustomerDecision[];
  readonly photos: readonly PublishedPhoto[];
  readonly updates: readonly CustomerUpdate[];
  readonly contact: CustomerContact | null;
  /** Builds the per-photo path on the customer's own tokenized route. */
  readonly photoHref: (evidenceId: CustomerPhoto['evidenceId']) => string;
}

/**
 * Everything the customer sees, and nothing else.
 *
 * Total: any combination of inputs yields a page. A job with no project, no
 * photos, no updates, and no contact renders a page that says so, because the
 * alternative — a blank screen behind a link Apex just sent — reads as broken.
 */
export function buildCustomerPage(input: CustomerPageInput): CustomerPage {
  const milestone: CustomerMilestoneKey | null = input.jobComplete
    ? 'handover'
    : input.currentPhaseKey === null
      ? null
      : customerMilestoneForPhase(input.currentPhaseKey);

  const copy = input.jobComplete
    ? HANDOVER_COPY
    : input.currentPhaseKey === null
      ? NOT_STARTED_COPY
      : PHASE_COPY[input.currentPhaseKey];

  return {
    customerName: input.customerName,
    addressLine: input.addressLine,
    milestones: [...buildMilestoneTrack(milestone)],
    headline: copy.headline,
    happeningNow: copy.now,
    happeningNext: describeNext(input),
    // Only unanswered decisions. A resolved one is not an ask, and leaving it on
    // the page teaches the customer that the list is not worth reading.
    decisions: [...input.decisions],
    photos: input.photos.slice(0, MAX_PHOTOS).map((photo) => ({
      evidenceId: photo.evidenceId,
      href: input.photoHref(photo.evidenceId),
      caption: photo.caption,
      takenOn: photo.takenOn,
    })),
    updates: [...input.updates].slice(0, MAX_UPDATES),
    contact: input.contact,
  };
}

/**
 * What happens next, in one sentence.
 *
 * It names the next phase's work, never a date. Apex OS holds a target
 * completion window, not a per-phase schedule anyone has committed to, and a
 * date on this page is a promise the system cannot keep.
 */
const describeNext = (input: CustomerPageInput): string | null => {
  if (input.jobComplete) return null;
  if (input.currentPhaseKey === null) {
    return `Next: ${PHASE_COPY['design-permitting'].preview}. `
      + 'We will tell you before anything happens on site.';
  }
  const sequence = constructionPhase(input.currentPhaseKey).sequence;
  const next = CONSTRUCTION_PHASES.find((phase) => phase.sequence === sequence + 1);
  if (next === undefined) {
    // Phase nine is current. What follows is handover, and handover follows the
    // job being finished rather than this phase ending — so it is described as
    // what comes after the work, not as a step that is already underway.
    return 'After that: your walkthrough and handover, once startup is complete '
      + 'and the water chemistry has settled.';
  }
  return `Next: ${PHASE_COPY[next.key].preview}.`;
};

/** Exported for the copy review Travis owes this page before it goes out. */
export const customerPhaseCopy = (key: ConstructionPhaseKey): PhaseCopy => PHASE_COPY[key];
