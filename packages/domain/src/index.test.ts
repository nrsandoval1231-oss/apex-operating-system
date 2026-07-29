import { describe, expect, it } from 'vitest';
import { createCanonicalId } from '@apex/contracts';
import {
  DomainRuleError,
  decideGateCommand,
  evolveGate,
  newGateState,
  type GateState,
} from './index.js';

const ids = {
  gateInstanceId: createCanonicalId('gate'),
  jobId: createCanonicalId('job'),
  takeoffRevisionId: createCanonicalId('revision'),
  fieldUserId: createCanonicalId('user'),
  officeUserId: createCanonicalId('user'),
  customerUserId: createCanonicalId('user'),
};

const readyState = (): GateState =>
  newGateState({
    gateInstanceId: ids.gateInstanceId,
    jobId: ids.jobId,
    definitionKey: 'pre-gunite',
    definitionVersion: 1,
    approvedTakeoffRevisionId: ids.takeoffRevisionId,
    requirements: [
      { key: 'steel-spacing', evidenceRequired: true },
      { key: 'bonding', evidenceRequired: true },
    ],
  });

const apply = (state: GateState, command: Parameters<typeof decideGateCommand>[1]) =>
  decideGateCommand(state, command).reduce(evolveGate, state);

const fieldActor = { kind: 'user' as const, userId: ids.fieldUserId, role: 'field' as const };

describe('Gate command authority and evidence separation', () => {
  it('starts a Gate without mutating requirement outcomes', () => {
    const state = apply(readyState(), { type: 'start-gate', actor: fieldActor, at: '2026-07-29T12:00:00.000Z' });
    expect(state.status).toBe('in-progress');
    expect([...state.requirements.values()].every((requirement) => requirement.status === 'pending')).toBe(true);
  });

  it('adding evidence does not pass the requirement', () => {
    let state = apply(readyState(), { type: 'start-gate', actor: fieldActor, at: '2026-07-29T12:00:00.000Z' });
    state = apply(state, {
      type: 'add-evidence',
      actor: fieldActor,
      at: '2026-07-29T12:01:00.000Z',
      requirementKey: 'steel-spacing',
      evidenceId: createCanonicalId('evidence'),
      kind: 'photo',
    });
    expect(state.requirements.get('steel-spacing')?.status).toBe('pending');
    expect(state.requirements.get('steel-spacing')?.evidenceIds).toHaveLength(1);
  });

  it('customers cannot evaluate or release a Gate', () => {
    const customer = { kind: 'user' as const, userId: ids.customerUserId, role: 'customer' as const };
    expect(() => decideGateCommand(readyState(), {
      type: 'evaluate-requirement',
      actor: customer,
      at: '2026-07-29T12:02:00.000Z',
      requirementKey: 'steel-spacing',
      outcome: 'passed',
    })).toThrow(DomainRuleError);
  });

  it('fails closed when required evidence is missing', () => {
    let state = apply(readyState(), { type: 'start-gate', actor: fieldActor, at: '2026-07-29T12:00:00.000Z' });
    for (const requirementKey of ['steel-spacing', 'bonding']) {
      state = apply(state, {
        type: 'evaluate-requirement',
        actor: fieldActor,
        at: '2026-07-29T12:02:00.000Z',
        requirementKey,
        outcome: 'passed',
      });
    }
    expect(() => decideGateCommand(state, {
      type: 'release-gate',
      actor: fieldActor,
      at: '2026-07-29T12:03:00.000Z',
    })).toThrow(/evidence/i);
  });

  it('releases only after every requirement passes with its own evidence', () => {
    let state = apply(readyState(), { type: 'start-gate', actor: fieldActor, at: '2026-07-29T12:00:00.000Z' });
    for (const requirementKey of ['steel-spacing', 'bonding']) {
      state = apply(state, {
        type: 'add-evidence',
        actor: fieldActor,
        at: '2026-07-29T12:01:00.000Z',
        requirementKey,
        evidenceId: createCanonicalId('evidence'),
        kind: 'photo',
      });
      state = apply(state, {
        type: 'evaluate-requirement',
        actor: fieldActor,
        at: '2026-07-29T12:02:00.000Z',
        requirementKey,
        outcome: 'passed',
      });
    }
    const releaseEvents = decideGateCommand(state, {
      type: 'release-gate',
      actor: fieldActor,
      at: '2026-07-29T12:03:00.000Z',
    });
    expect(releaseEvents.map((event) => event.eventType)).toEqual([
      'gate.released',
      'draw.eligible',
      'customer_update.published',
    ]);
    const released = releaseEvents.reduce(evolveGate, state);
    expect(released.status).toBe('released');
  });

  it('requires an approved takeoff revision even when every requirement passes', () => {
    const state = newGateState({
      gateInstanceId: ids.gateInstanceId,
      jobId: ids.jobId,
      definitionKey: 'pre-gunite',
      definitionVersion: 1,
      approvedTakeoffRevisionId: null,
      requirements: [],
    });
    expect(() => decideGateCommand(state, {
      type: 'release-gate',
      actor: fieldActor,
      at: '2026-07-29T12:03:00.000Z',
    })).toThrow(/approved takeoff revision/i);
  });
});
