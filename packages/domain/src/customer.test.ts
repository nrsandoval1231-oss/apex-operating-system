import { describe, expect, it } from 'vitest';
import { createCanonicalId, type CustomerDecision, type EvidenceId } from '@apex/contracts';
import { buildCustomerPage, buildMilestoneTrack, type CustomerPageInput } from './customer.js';

/**
 * The customer page projection — PRD §9.11.
 *
 * The tests that matter here are not about layout. They are about what a
 * homeowner is told and, above all, what they are never told.
 */

const base: CustomerPageInput = {
  customerName: 'Whitaker Oasis',
  addressLine: '4102 County Road 7500, Lubbock, TX',
  currentPhaseKey: 'gunite',
  jobComplete: false,
  decisions: [],
  photos: [],
  updates: [],
  contact: null,
  photoHref: (id) => `/c/token/photo/${id}`,
};

const page = (overrides: Partial<CustomerPageInput> = {}) =>
  buildCustomerPage({ ...base, ...overrides });

describe('the milestone track', () => {
  it('always shows all six, so the customer sees the whole build', () => {
    expect(buildMilestoneTrack('shell')).toHaveLength(6);
  });

  it('marks everything before the current one done and everything after upcoming', () => {
    const track = buildMilestoneTrack('shell');
    expect(track.map((step) => step.state)).toEqual([
      'done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming',
    ]);
  });

  it('marks nothing current before construction has been opened', () => {
    // Not "Design in progress". Nobody has said the build has started, and the
    // page must not be the thing that decides it has.
    expect(buildMilestoneTrack(null).every((step) => step.state === 'upcoming')).toBe(true);
  });
});

describe('handover', () => {
  it('is not reached by finishing the last phase', () => {
    const finished = page({ currentPhaseKey: 'plaster-fill', jobComplete: false });
    const handover = finished.milestones.find((step) => step.key === 'handover');
    // A pool sitting in phase nine with water in it has not been handed over.
    expect(handover?.state).toBe('upcoming');
    expect(finished.headline).not.toMatch(/finished/i);
  });

  it('is reached only by the job itself completing', () => {
    const done = page({ currentPhaseKey: 'plaster-fill', jobComplete: true });
    expect(done.milestones.find((step) => step.key === 'handover')?.state).toBe('current');
    expect(done.happeningNext).toBeNull();
  });
});

describe('what happens next', () => {
  it('names the next phase without promising a date', () => {
    const next = page({ currentPhaseKey: 'rough-in' }).happeningNext ?? '';
    expect(next).toMatch(/concrete shell/i);
    // Apex OS holds a target completion window, not a per-phase schedule anyone
    // committed to. A date here is a promise the system cannot keep.
    expect(next).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('describes handover as following the work, not as a step already underway', () => {
    expect(page({ currentPhaseKey: 'plaster-fill' }).happeningNext).toMatch(/walkthrough and handover/i);
  });
});

describe('what the page will not say', () => {
  const internalish = page({
    currentPhaseKey: 'gunite',
    decisions: [],
    photos: [],
    updates: [],
  });

  it('carries no field a cost, a crew, or a risk note could travel in', () => {
    // §9.11 hides costs, subcontractor names, internal checklists, risk scores,
    // and internal notes. The projection cannot leak them because it is built
    // from an input that never carried them — this asserts the shape stays that
    // way if someone widens `CustomerPageInput` later.
    expect(Object.keys(internalish).sort()).toEqual([
      'addressLine', 'contact', 'customerName', 'decisions', 'happeningNext',
      'happeningNow', 'headline', 'milestones', 'photos', 'updates',
    ]);
  });

  it('never names a phase key or a gate in customer wording', () => {
    for (const key of ['design-permitting', 'gunite', 'plaster-fill'] as const) {
      const rendered = page({ currentPhaseKey: key });
      const prose = `${rendered.headline} ${rendered.happeningNow} ${rendered.happeningNext ?? ''}`;
      expect(prose).not.toMatch(/gate|checklist|pre-gunite|draw|takeoff/i);
      expect(prose).not.toContain(key);
    }
  });
});

describe('an empty project', () => {
  it('renders a page that says so rather than a blank screen', () => {
    // The customer has just been sent this link. A blank page reads as broken.
    const empty = page({
      currentPhaseKey: null,
      customerName: null,
      addressLine: null,
    });
    expect(empty.headline).toBe('Getting ready to start');
    expect(empty.happeningNow).toMatch(/has not begun/i);
    expect(empty.milestones).toHaveLength(6);
  });
});

describe('photos', () => {
  const photo = (index: number) => ({
    evidenceId: createCanonicalId('evidence') as EvidenceId,
    caption: index === 0 ? 'Steel tied and ready' : null,
    takenOn: '2026-07-30',
  });

  it('routes every photo through the customer link, never the staff evidence route', () => {
    const rendered = page({ photos: [photo(0)] });
    expect(rendered.photos[0]?.href).toMatch(/^\/c\/token\/photo\/evidence_/);
  });

  it('shows no caption rather than substituting one', () => {
    // The internal caption may quote a checklist item or name a subcontractor.
    expect(page({ photos: [photo(1)] }).photos[0]?.caption).toBeNull();
  });

  it('shows the recent ones, not every footing photo ever taken', () => {
    const many = Array.from({ length: 30 }, (_, index) => photo(index));
    expect(page({ photos: many }).photos).toHaveLength(12);
  });
});

describe('decisions', () => {
  const decision: CustomerDecision = {
    decisionId: createCanonicalId('decision'),
    title: 'Waterline tile',
    detail: 'Three samples are at the office for you to look at.',
    consequence: 'Tile is installed next; without a choice the crew has nothing to set.',
    neededBy: '2026-08-12',
  };

  it('passes them through in the customer wording they were written in', () => {
    expect(page({ decisions: [decision] }).decisions).toEqual([decision]);
  });
});
