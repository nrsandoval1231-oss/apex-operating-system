import { describe, expect, it } from 'vitest';
import { createCanonicalId, type EventActor } from '@apex/contracts';
import {
  DomainRuleError,
  decideGateCommand,
  evolveGate,
  newGateState,
  type GateState,
} from './index.js';

/**
 * The two-signature Gate — resolved 2026-07-31.
 *
 * Pre-gunite is the one hold point whose failure cannot be undone: gunite buries
 * the rebar and the plumbing. It takes a superintendent's sign-off and the
 * owner's countersign. Every other Gate, including all four draw-bearing ones,
 * takes one signature from either the owner or a superintendent.
 */

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

describe('the pre-gunite countersign', () => {
  it('does not release on the first signature', () => {
    const signed = decideGateCommand(ready(), { type: 'release-gate', actor: superintendent, at });
    expect(signed.map((event) => event.eventType)).toEqual(['gate.signoff_recorded']);

    const state = signed.reduce(evolveGate, ready());
    expect(state.status).toBe('awaiting-countersign');
    expect(state.releasedAt).toBeNull();
    expect(state.signoff).toMatchObject({ userId: ids.superintendent, role: 'superintendent' });
  });

  it('releases only once the owner countersigns', () => {
    const signed = apply(ready(), { type: 'release-gate', actor: superintendent, at });
    const events = decideGateCommand(signed, { type: 'countersign-gate', actor: owner, at });
    // Pre-gunite releases work, not money: no draw.eligible.
    expect(events.map((event) => event.eventType)).toEqual([
      'gate.countersigned', 'gate.released', 'customer_update.published',
    ]);

    const released = events.reduce(evolveGate, signed);
    expect(released.status).toBe('released');
  });

  it('refuses a countersign by the same person who signed', () => {
    // An owner who signs first cannot then countersign himself.
    const signed = apply(ready(), { type: 'release-gate', actor: owner, at });
    expect(() => decideGateCommand(signed, { type: 'countersign-gate', actor: owner, at }))
      .toThrow(/different person than the signer/i);
  });

  it('accepts a countersign from a second owner', () => {
    const signed = apply(ready(), { type: 'release-gate', actor: owner, at });
    const events = decideGateCommand(signed, { type: 'countersign-gate', actor: secondOwner, at });
    expect(events.map((event) => event.eventType)).toContain('gate.released');
  });

  it('refuses a countersign from a role that does not hold it', () => {
    const signed = apply(ready(), { type: 'release-gate', actor: superintendent, at });
    for (const actor of [fieldActor, { kind: 'user' as const, userId: ids.field, role: 'office' as const }]) {
      expect(() => decideGateCommand(signed, { type: 'countersign-gate', actor, at }))
        .toThrow(/not authorized/i);
    }
  });

  it('refuses a countersign before anyone has signed', () => {
    expect(() => decideGateCommand(ready(), { type: 'countersign-gate', actor: owner, at }))
      .toThrow(/must be signed off before/i);
  });

  it('still enforces evidence and requirements before the first signature', () => {
    expect(() => decideGateCommand(gate(), { type: 'release-gate', actor: superintendent, at }))
      .toThrow(DomainRuleError);
  });

  it('refuses a second countersign on a released Gate', () => {
    let state = apply(ready(), { type: 'release-gate', actor: superintendent, at });
    state = apply(state, { type: 'countersign-gate', actor: owner, at });
    expect(() => decideGateCommand(state, { type: 'countersign-gate', actor: secondOwner, at }))
      .toThrow(/immutable/i);
  });

  it('refuses a definition whose countersign role is its only release role', () => {
    expect(() => gate({ releaseRoles: ['admin'], countersignRoles: ['admin'] }))
      .toThrow(/release role that is not also a countersign role/i);
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
      .toThrow(/does not require a countersign/i);
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
