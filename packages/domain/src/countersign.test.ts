import { describe, expect, it } from 'vitest';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import {
  DomainRuleError,
  decideGateCommand,
  evolveGate,
  newGateState,
  type GateState,
} from './index.js';

/** Legacy countersign data remains replayable, but active Gates release once. */

const ids = {
  gate: createCanonicalId('gate'),
  job: createCanonicalId('job'),
  revision: createCanonicalId('revision'),
  owner: createCanonicalId('user'),
  secondOwner: createCanonicalId('user'),
  superintendent: createCanonicalId('user'),
  field: createCanonicalId('user'),
};
const owner: EventActor = { kind: 'user', userId: ids.owner, role: 'admin' };
const secondOwner: EventActor = { kind: 'user', userId: ids.secondOwner, role: 'admin' };
const superintendent: EventActor = { kind: 'user', userId: ids.superintendent, role: 'superintendent' };
const fieldActor: EventActor = { kind: 'user', userId: ids.field, role: 'field' };
const at = '2026-07-31T16:00:00.000Z';

const gate = (options: {
  releaseRoles?: GateState['releaseRoles'];
  countersignRoles?: GateState['countersignRoles'];
  drawCode?: string | null;
} = {}): GateState => newGateState({
  gateInstanceId: ids.gate,
  jobId: ids.job,
  definitionKey: 'pre-gunite',
  definitionVersion: 2,
  approvedTakeoffRevisionId: ids.revision,
  releaseRoles: options.releaseRoles ?? ['admin', 'superintendent'],
  countersignRoles: options.countersignRoles ?? ['admin'],
  // Pre-gunite releases no draw. It publishes a customer milestone.
  drawCode: options.drawCode ?? null,
  customerMilestone: 'shell',
  requirements: [{ key: 'steel-spacing', evidenceRequired: true }],
});

const apply = (state: GateState, command: Parameters<typeof decideGateCommand>[1]) =>
  decideGateCommand(state, command).reduce(evolveGate, state);

/** A gate with its single requirement satisfied and ready for signature. */
const ready = (options: Parameters<typeof gate>[0] = {}): GateState => {
  let state = apply(gate(options), { type: 'start-gate', actor: superintendent, at });
  state = apply(state, {
    type: 'add-evidence', actor: fieldActor, at,
    requirementKey: 'steel-spacing', evidenceId: createCanonicalId('evidence'), kind: 'photo',
  });
  return apply(state, {
    type: 'evaluate-requirement', actor: superintendent, at,
    requirementKey: 'steel-spacing', outcome: 'passed',
  });
};

describe('active single-signature release', () => {
  it('releases on the first signature', () => {
    const events = decideGateCommand(ready(), { type: 'release-gate', actor: superintendent, at });
    expect(events.map((event) => event.eventType)).toEqual(['gate.released', 'customer_update.published']);
    expect(events.reduce(evolveGate, ready()).status).toBe('released');
  });

  it('still enforces evidence and requirements before release', () => {
    expect(() => decideGateCommand(gate(), { type: 'release-gate', actor: superintendent, at }))
      .toThrow(DomainRuleError);
  });

  it('rejects the retired countersign command', () => {
    expect(() => decideGateCommand(ready(), { type: 'countersign-gate', actor: owner, at }))
      .toThrow(/countersign has been removed/i);
  });
});

describe('the four draw-bearing gates', () => {
  const moneyGate = () => ready({
    releaseRoles: ['admin', 'superintendent'],
    countersignRoles: [],
    drawCode: 'draw-2',
  });

  it('release on one signature from the owner or a superintendent', () => {
    for (const actor of [owner, superintendent]) {
      const events = decideGateCommand(moneyGate(), { type: 'release-gate', actor, at });
      expect(events.map((event) => event.eventType)).toEqual([
        'gate.released', 'draw.eligible', 'customer_update.published',
      ]);
    }
  });

  it('do not stall when the owner is unavailable', () => {
    const released = apply(moneyGate(), { type: 'release-gate', actor: superintendent, at });
    expect(released.status).toBe('released');
  });

  it('reject a countersign attempt, having required none', () => {
    const released = apply(moneyGate(), { type: 'release-gate', actor: superintendent, at });
    expect(() => decideGateCommand(released, { type: 'countersign-gate', actor: owner, at }))
      .toThrow(/countersign has been removed/i);
  });

  it('are still closed to the field lead', () => {
    expect(() => decideGateCommand(moneyGate(), { type: 'release-gate', actor: fieldActor, at }))
      .toThrow(/not authorized/i);
  });
});

describe('release consequences follow the definition', () => {
  it('creates no draw eligibility for a Gate that bears no draw', () => {
    const events = decideGateCommand(
      ready({ countersignRoles: [], drawCode: null }),
      { type: 'release-gate', actor: superintendent, at },
    );
    expect(events.map((event) => event.eventType)).not.toContain('draw.eligible');
  });

  it('tells the customer nothing when the Gate maps no milestone', () => {
    let state = newGateState({
      gateInstanceId: ids.gate,
      jobId: ids.job,
      definitionKey: 'internal-only',
      definitionVersion: 1,
      approvedTakeoffRevisionId: ids.revision,
      releaseRoles: ['admin', 'superintendent'],
      requirements: [{ key: 'check', evidenceRequired: false }],
    });
    state = apply(state, { type: 'start-gate', actor: superintendent, at });
    state = apply(state, {
      type: 'evaluate-requirement', actor: superintendent, at, requirementKey: 'check', outcome: 'passed',
    });
    const events = decideGateCommand(state, { type: 'release-gate', actor: superintendent, at });
    expect(events.map((event) => event.eventType)).toEqual(['gate.released']);
  });

  it('publishes the milestone the definition names', () => {
    const events = decideGateCommand(
      ready({ countersignRoles: [], drawCode: 'draw-2' }),
      { type: 'release-gate', actor: owner, at },
    );
    const published = events.find((event) => event.eventType === 'customer_update.published');
    expect(published?.payload).toMatchObject({ milestone: 'shell' });
  });
});
