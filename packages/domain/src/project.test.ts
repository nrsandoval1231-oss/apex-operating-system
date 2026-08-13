import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_PHASES,
  CONSTRUCTION_PHASE_KEYS,
  CUSTOMER_MILESTONES,
  createCanonicalId,
  customerMilestoneForPhase,
  nextConstructionPhase,
  type EventActor,
} from '@apex/contracts';
import {
  PhaseRuleError,
  classifyPhaseMove,
  customerMilestoneFor,
  decidePhaseChange,
  evolveProjectPhase,
  type ProjectPhaseState,
} from './project.js';

const jobId = createCanonicalId('job');
const owner: EventActor = { kind: 'user', userId: createCanonicalId('user'), role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: createCanonicalId('user'), role: 'superintendent' };
const fieldUser: EventActor = { kind: 'user', userId: createCanonicalId('user'), role: 'field' };
const customer: EventActor = { kind: 'user', userId: createCanonicalId('user'), role: 'customer' };

const at = '2026-07-31T15:00:00.000Z';
const state = (overrides: Partial<ProjectPhaseState> = {}): ProjectPhaseState => ({
  jobId,
  currentPhaseKey: 'layout-excavation',
  jobComplete: false,
  ...overrides,
});

describe('the confirmed construction model', () => {
  it('has exactly the eleven phases Apex builds, in order', () => {
    expect(CONSTRUCTION_PHASE_KEYS).toHaveLength(11);
    expect(CONSTRUCTION_PHASES.map((phase) => phase.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('collapses the eleven phases into the six customer milestones', () => {
    expect(CUSTOMER_MILESTONES).toHaveLength(6);
    expect(CONSTRUCTION_PHASES.map((phase) => phase.customerMilestone)).toEqual([
      'design', 'excavation', 'shell', 'shell', 'shell', 'finishes', 'finishes', 'water', 'water', 'water', 'water',
    ]);
  });

  it('never reaches handover from a phase — only a finished job does', () => {
    for (const key of CONSTRUCTION_PHASE_KEYS) {
      expect(customerMilestoneForPhase(key)).not.toBe('handover');
    }
    expect(customerMilestoneFor(state({ currentPhaseKey: 'plaster-fill' }))).toBe('water');
    expect(customerMilestoneFor(state({ currentPhaseKey: 'plaster-fill', jobComplete: true }))).toBe('handover');
  });

  it('ends the phase chain after plaster and fill', () => {
    expect(nextConstructionPhase('equipment-hookup')).toBe('automation-programming');
    expect(nextConstructionPhase('plaster-fill')).toBeNull();
  });
});

describe('phase change authority', () => {
  it('lets the owner and the superintendent advance a project', () => {
    for (const actor of [owner, superintendent]) {
      const [draft] = decidePhaseChange(state(), { actor, at, toPhaseKey: 'steel-reinforcement' });
      expect(draft.eventType).toBe('project.phase_changed');
      expect(draft.payload).toMatchObject({
        fromPhaseKey: 'layout-excavation',
        toPhaseKey: 'steel-reinforcement',
        reason: null,
      });
    }
  });

  it('refuses field users and customers', () => {
    for (const actor of [fieldUser, customer]) {
      expect(() => decidePhaseChange(state(), { actor, at, toPhaseKey: 'steel-reinforcement' }))
        .toThrow(PhaseRuleError);
    }
  });

  it('refuses a system actor', () => {
    expect(() => decidePhaseChange(state(), {
      actor: { kind: 'system', system: 'gate-api' },
      at,
      toPhaseKey: 'steel-reinforcement',
    })).toThrow(/authenticated human actor/i);
  });
});

describe('phase change rules', () => {
  it('classifies moves by direction and distance', () => {
    expect(classifyPhaseMove('rough-in', 'gunite')).toBe('advance');
    expect(classifyPhaseMove('rough-in', 'decking')).toBe('skip');
    expect(classifyPhaseMove('gunite', 'rough-in')).toBe('reverse');
  });

  it('records a skip when a reason is given and refuses it otherwise', () => {
    expect(() => decidePhaseChange(state(), { actor: owner, at, toPhaseKey: 'gunite' }))
      .toThrow(/skip and requires a recorded reason/i);
    const [draft] = decidePhaseChange(state(), {
      actor: owner, at, toPhaseKey: 'gunite', reason: 'Rebar and rough-in completed the same day.',
    });
    expect(draft.payload.reason).toBe('Rebar and rough-in completed the same day.');
  });

  it('records a reversal when a reason is given and refuses it otherwise', () => {
    const guniteState = state({ currentPhaseKey: 'gunite' });
    expect(() => decidePhaseChange(guniteState, { actor: owner, at, toPhaseKey: 'rough-in' }))
      .toThrow(/reverse and requires a recorded reason/i);
    const [draft] = decidePhaseChange(guniteState, {
      actor: owner, at, toPhaseKey: 'rough-in', reason: 'Failed pressure test; rough-in reopened.',
    });
    expect(draft.payload).toMatchObject({ fromPhaseKey: 'gunite', toPhaseKey: 'rough-in' });
  });

  it('treats a whitespace-only reason as no reason', () => {
    expect(() => decidePhaseChange(state(), { actor: owner, at, toPhaseKey: 'gunite', reason: '   ' }))
      .toThrow(/requires a recorded reason/i);
  });

  it('refuses a move to the phase the project is already in', () => {
    expect(() => decidePhaseChange(state(), { actor: owner, at, toPhaseKey: 'layout-excavation' }))
      .toThrow(/already in phase/i);
  });

  it('refuses any phase change once the job is complete', () => {
    expect(() => decidePhaseChange(state({ jobComplete: true }), { actor: owner, at, toPhaseKey: 'gunite' }))
      .toThrow(/completed job/i);
  });

  it('advances the state it decided', () => {
    const before = state();
    const [draft] = decidePhaseChange(before, { actor: owner, at, toPhaseKey: 'steel-reinforcement' });
    expect(evolveProjectPhase(before, draft).currentPhaseKey).toBe('steel-reinforcement');
  });
});
