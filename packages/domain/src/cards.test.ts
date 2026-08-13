import { describe, expect, it } from 'vitest';
import { ActionCardListSchema, createCanonicalId, type ActionCard } from '@apex/contracts';
import {
  deriveCards,
  deriveJobCards,
  type CardDrawSnapshot,
  type CardGateSnapshot,
  type CardJobSnapshot,
} from './cards.js';

const jobId = createCanonicalId('job');
const TODAY = '2026-07-31';

const gate = (overrides: Partial<CardGateSnapshot> = {}): CardGateSnapshot => ({
  definitionKey: 'shell',
  title: 'Shell',
  sequence: 4,
  phaseKey: 'gunite',
  drawCode: 'draw-2',
  requiresCountersign: false,
  gateInstanceId: createCanonicalId('gate'),
  status: 'in-progress',
  requirementsTotal: 3,
  requirementsPassed: 1,
  evidenceComplete: false,
  signedByName: null,
  signedAt: null,
  ...overrides,
});

const job = (overrides: Partial<CardJobSnapshot> = {}): CardJobSnapshot => ({
  jobId,
  customerName: 'Whitaker Oasis',
  addressLine: '4502 19th St, Lubbock, TX',
  jobStatus: 'active',
  approvedTakeoffRevisionId: createCanonicalId('revision'),
  contractCents: 15_204_173,
  hasDrawSchedule: true,
  project: {
    currentPhaseKey: 'gunite',
    superintendentName: 'Site Super',
    targetCompletionEnd: null,
    riskNote: null,
  },
  gates: [],
  draws: [],
  visits: [],
  inspections: [],
  ...overrides,
});

const kinds = (cards: readonly ActionCard[]) => cards.map((card) => card.kind);
const find = (cards: readonly ActionCard[], kind: ActionCard['kind']) =>
  cards.find((card) => card.kind === kind);

describe('every card is well formed', () => {
  it('satisfies the published contract', () => {
    const cards = deriveJobCards(job({
      gates: [gate({ status: 'awaiting-countersign', signedByName: 'Site Super', signedAt: '2026-07-29T12:00:00.000Z' })],
      draws: [{
        drawId: createCanonicalId('draw'), drawCode: 'draw-1', label: 'Draw 1',
        amountCents: 4_561_251, percentBasisPoints: 3000, status: 'eligible',
        eligibleAt: '2026-07-20T12:00:00.000Z',
      }],
      project: {
        currentPhaseKey: 'gunite',
        superintendentName: null,
        targetCompletionEnd: '2026-07-01',
        riskNote: 'Tile selection outstanding.',
      },
    }), TODAY);
    expect(ActionCardListSchema.safeParse(cards).success).toBe(true);
  });

  it('always states a reason and an action', () => {
    const cards = deriveJobCards(job({ gates: [gate()], approvedTakeoffRevisionId: null }), TODAY);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.reason.length).toBeGreaterThan(20);
      expect(card.actionHref).toContain(jobId);
    }
  });

  it('gives the same card the same id on every derivation', () => {
    const snapshot = job({ gates: [gate({ status: 'blocked' })] });
    expect(kinds(deriveJobCards(snapshot, TODAY))).toEqual(kinds(deriveJobCards(snapshot, TODAY)));
    expect(deriveJobCards(snapshot, TODAY)[0]?.cardId)
      .toBe(deriveJobCards(snapshot, TODAY)[0]?.cardId);
  });
});

describe('gate cards', () => {
  it('does not create a countersign action card for legacy state', () => {
    const cards = deriveJobCards(job({
      gates: [gate({
        definitionKey: 'pre-gunite', title: 'Pre-gunite hold point', drawCode: null,
        requiresCountersign: true, status: 'awaiting-countersign',
        signedByName: 'Site Super', signedAt: '2026-07-29T12:00:00.000Z',
      })],
    }), TODAY);
    expect(find(cards, 'gate.countersign')).toBeUndefined();
  });

  it('treats a blocked gate as urgent and says what it stops', () => {
    const card = find(deriveJobCards(job({ gates: [gate({ status: 'blocked' })] }), TODAY), 'gate.blocked');
    expect(card).toMatchObject({ group: 'needs-you', urgency: 'urgent' });
    expect(card?.reason).toMatch(/cannot release/i);
  });

  it('names the draw a ready gate would release', () => {
    const card = find(deriveJobCards(job({
      gates: [gate({ requirementsPassed: 3, evidenceComplete: true })],
    }), TODAY), 'gate.ready');
    expect(card).toMatchObject({ group: 'needs-you', urgency: 'important' });
    expect(card?.reason).toContain('Draw 2');
  });

  it('warns that signing a countersigned gate does not release it', () => {
    const card = find(deriveJobCards(job({
      gates: [gate({ requiresCountersign: true, drawCode: null, requirementsPassed: 3, evidenceComplete: true })],
    }), TODAY), 'gate.ready');
    expect(card?.reason).toMatch(/releasing it authorizes the next phase/i);
  });

  it('reports progress rather than an action while requirements are outstanding', () => {
    const cards = deriveJobCards(job({ gates: [gate({ requirementsPassed: 1 })] }), TODAY);
    const card = find(cards, 'gate.in-progress');
    expect(card).toMatchObject({ group: 'running', urgency: 'routine' });
    expect(card?.title).toBe('Shell: 1 of 3 clear');
  });

  it('distinguishes unevaluated requirements from missing evidence', () => {
    const withEvidence = find(deriveJobCards(job({
      gates: [gate({ requirementsPassed: 2, evidenceComplete: true })],
    }), TODAY), 'gate.in-progress');
    expect(withEvidence?.reason).toMatch(/still need evaluating/i);

    const withoutEvidence = find(deriveJobCards(job({
      gates: [gate({ requirementsPassed: 2, evidenceComplete: false })],
    }), TODAY), 'gate.in-progress');
    expect(withoutEvidence?.reason).toMatch(/photos and other evidence are optional/i);
  });

  it('asks to open the gate for the phase the job is actually in', () => {
    const cards = deriveJobCards(job({
      gates: [gate({ gateInstanceId: null, status: null })],
    }), TODAY);
    expect(find(cards, 'gate.not-opened')).toMatchObject({ group: 'running' });
  });

  it('previews the next phase gate under This Week', () => {
    const cards = deriveJobCards(job({
      project: { currentPhaseKey: 'decking', superintendentName: 'Site Super', targetCompletionEnd: null, riskNote: null },
      gates: [gate({
        definitionKey: 'equipment', title: 'Equipment', phaseKey: 'equipment-hookup',
        drawCode: null, gateInstanceId: null, status: null,
      })],
    }), TODAY);
    expect(find(cards, 'gate.not-opened')).toMatchObject({ group: 'this-week' });
  });

  it('says nothing about a gate two or more phases out', () => {
    const cards = deriveJobCards(job({
      project: { currentPhaseKey: 'design-permitting', superintendentName: 'Site Super', targetCompletionEnd: null, riskNote: null },
      gates: [gate({ definitionKey: 'final', title: 'Final', phaseKey: 'plaster-fill', gateInstanceId: null, status: null })],
    }), TODAY);
    expect(kinds(cards)).not.toContain('gate.not-opened');
  });

  it('never asks to open a gate that cannot be opened', () => {
    // A Gate needs an approved takeoff. Without one, "open the gate" is an
    // impossible instruction, and the takeoff card already names the blocker.
    const cards = deriveJobCards(job({
      approvedTakeoffRevisionId: null,
      gates: [gate({ gateInstanceId: null, status: null })],
    }), TODAY);
    expect(kinds(cards)).toContain('takeoff.missing');
    expect(kinds(cards)).not.toContain('gate.not-opened');
  });

  it('says nothing about a released gate', () => {
    const cards = deriveJobCards(job({ gates: [gate({ status: 'released' })] }), TODAY);
    expect(cards).toEqual([]);
  });
});

describe('draw cards', () => {
  const draw = (overrides: Partial<CardDrawSnapshot> = {}): CardDrawSnapshot => ({
    drawId: createCanonicalId('draw'),
    drawCode: 'draw-1',
    label: 'Draw 1',
    amountCents: 4_561_251,
    percentBasisPoints: 3000,
    status: 'eligible',
    eligibleAt: '2026-07-30T12:00:00.000Z',
    ...overrides,
  });

  it('puts the amount in the title so the feed shows what is at stake', () => {
    const card = find(deriveJobCards(job({ draws: [draw()] }), TODAY), 'draw.uninvoiced');
    expect(card?.title).toBe('Bill the Draw 1 — $45,613');
    expect(card?.reason).toContain('30% of the contract');
  });

  it('escalates the longer money sits unbilled', () => {
    expect(find(deriveJobCards(job({ draws: [draw()] }), TODAY), 'draw.uninvoiced'))
      .toMatchObject({ urgency: 'important' });
    expect(find(deriveJobCards(job({ draws: [draw({ eligibleAt: '2026-07-10T12:00:00.000Z' })] }), TODAY), 'draw.uninvoiced'))
      .toMatchObject({ urgency: 'urgent', dueLabel: 'Billable for 21 days' });
  });

  it('says nothing about a draw that is not earned yet', () => {
    const cards = deriveJobCards(job({ draws: [draw({ status: 'scheduled', eligibleAt: null })] }), TODAY);
    expect(kinds(cards)).not.toContain('draw.uninvoiced');
  });

  it('disappears once a human confirms the invoice', () => {
    for (const status of ['invoiced', 'paid'] as const) {
      expect(kinds(deriveJobCards(job({ draws: [draw({ status })] }), TODAY)))
        .not.toContain('draw.uninvoiced');
    }
  });

  it('says the system will not invoice on its own', () => {
    const card = find(deriveJobCards(job({ draws: [draw()] }), TODAY), 'draw.uninvoiced');
    expect(card?.reason).toMatch(/does not invoice on its own/i);
  });

  it('admits when it does not know the amount rather than printing a figure', () => {
    const card = find(deriveJobCards(job({
      draws: [draw({ amountCents: null, percentBasisPoints: null })],
    }), TODAY), 'draw.uninvoiced');
    expect(card?.title).toBe('Bill the Draw 1');
    expect(card?.reason).toMatch(/figure has to come from the contract/i);
  });

  it('flags a signed contract with no schedule at all', () => {
    const card = find(deriveJobCards(job({ hasDrawSchedule: false }), TODAY), 'draw.unscheduled');
    expect(card).toMatchObject({ group: 'needs-you', urgency: 'important' });
    expect(card?.reason).toContain('$152,042');
  });

  it('says nothing about a schedule for a job with no signed contract', () => {
    const cards = deriveJobCards(job({ hasDrawSchedule: false, contractCents: null }), TODAY);
    expect(kinds(cards)).not.toContain('draw.unscheduled');
  });
});

describe('project record cards', () => {
  it('flags a job with no approved takeoff as blocking every gate', () => {
    const card = find(deriveJobCards(job({ approvedTakeoffRevisionId: null }), TODAY), 'takeoff.missing');
    expect(card).toMatchObject({ group: 'needs-you', dueLabel: 'Blocking every Gate' });
  });

  it('asks to open a signed job that is not yet a construction project', () => {
    const cards = deriveJobCards(job({ project: null }), TODAY);
    expect(kinds(cards)).toContain('project.unopened');
    // Nothing further can be said about a job with no phase, so nothing is.
    expect(kinds(cards)).not.toContain('project.unassigned');
  });

  it('flags a job nobody is accountable for', () => {
    const cards = deriveJobCards(job({
      project: { currentPhaseKey: 'gunite', superintendentName: null, targetCompletionEnd: null, riskNote: null },
    }), TODAY);
    expect(kinds(cards)).toContain('project.unassigned');
  });

  it('surfaces a recorded risk as its own reason', () => {
    const card = find(deriveJobCards(job({
      project: { currentPhaseKey: 'gunite', superintendentName: 'Site Super', targetCompletionEnd: null, riskNote: 'Tile selection outstanding.' },
    }), TODAY), 'project.risk');
    expect(card).toMatchObject({ group: 'running', reason: 'Tile selection outstanding.' });
  });

  it('escalates a passed target date and names the phase it is stuck in', () => {
    const card = find(deriveJobCards(job({
      project: { currentPhaseKey: 'rough-in', superintendentName: 'Site Super', targetCompletionEnd: '2026-07-24', riskNote: null },
    }), TODAY), 'project.overdue');
    expect(card).toMatchObject({ group: 'needs-you', urgency: 'urgent', dueLabel: 'Overdue by 7 days' });
    expect(card?.reason).toContain('Plumbing & Electrical Rough-In');
  });

  it('previews an approaching target date without demanding anything', () => {
    const card = find(deriveJobCards(job({
      project: { currentPhaseKey: 'decking', superintendentName: 'Site Super', targetCompletionEnd: '2026-08-07', riskNote: null },
    }), TODAY), 'project.due-soon');
    expect(card).toMatchObject({ group: 'this-week', dueLabel: 'In 7 days' });
  });

  it('ignores a target date further out than a fortnight', () => {
    const cards = deriveJobCards(job({
      project: { currentPhaseKey: 'decking', superintendentName: 'Site Super', targetCompletionEnd: '2026-10-01', riskNote: null },
    }), TODAY);
    expect(kinds(cards)).not.toContain('project.due-soon');
  });
});

describe('the feed as a whole', () => {
  it('produces nothing for a finished or cancelled job', () => {
    for (const jobStatus of ['complete', 'closed', 'cancelled']) {
      expect(deriveJobCards(job({ jobStatus, approvedTakeoffRevisionId: null, project: null }), TODAY)).toEqual([]);
    }
  });

  it('orders by section, then urgency, then id', () => {
    const cards = deriveCards([job({
      gates: [
        gate({ definitionKey: 'shell', status: 'blocked' }),
        gate({ definitionKey: 'permit', title: 'Permit', phaseKey: 'gunite', requirementsPassed: 3, evidenceComplete: true, drawCode: null }),
      ],
      project: { currentPhaseKey: 'gunite', superintendentName: 'Site Super', targetCompletionEnd: '2026-08-05', riskNote: 'Watch the tile lead time.' },
    })], TODAY);

    expect(cards.map((card) => card.group)).toEqual([
      'needs-you', 'needs-you', 'running', 'this-week',
    ]);
    expect(cards.map((card) => card.urgency).slice(0, 2)).toEqual(['urgent', 'important']);
  });

  it('is stable across repeated derivations of the same state', () => {
    const jobs = [job({ gates: [gate({ status: 'blocked' })] }), job({ project: null })];
    expect(deriveCards(jobs, TODAY).map((card) => card.cardId))
      .toEqual(deriveCards(jobs, TODAY).map((card) => card.cardId));
  });

  it('reads no clock — the same state on a later day changes only what is time-based', () => {
    const snapshot = job({ gates: [gate({ status: 'blocked' })] });
    expect(deriveJobCards(snapshot, '2027-01-01')).toEqual(deriveJobCards(snapshot, TODAY));
  });
});
