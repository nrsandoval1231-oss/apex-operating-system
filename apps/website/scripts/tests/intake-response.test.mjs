import test from 'node:test';
import assert from 'node:assert/strict';
import { isIntakeResponseAccepted } from '../../src/lib/intake-response.ts';

test('production only confirms accepted or duplicate responses for the submitted lead', () => {
  for (const status of ['accepted', 'duplicate']) {
    assert.equal(isIntakeResponseAccepted({ status, lead_id: 'lead-1' }, 'lead-1', true), true);
    assert.equal(isIntakeResponseAccepted({ status, lead_id: 'other-lead' }, 'lead-1', true), false);
    assert.equal(isIntakeResponseAccepted({ status }, 'lead-1', true), false);
  }
  for (const body of [null, '', {}, { ok: true }, { status: 'quarantined', lead_id: 'lead-1' }, { status: 'unknown', lead_id: 'lead-1' }]) {
    assert.equal(isIntakeResponseAccepted(body, 'lead-1', true), false);
  }
});

test('non-production test hooks retain their permissive acknowledgement contract but reject quarantine', () => {
  assert.equal(isIntakeResponseAccepted({ ok: true }, 'lead-1', false), true);
  assert.equal(isIntakeResponseAccepted(null, 'lead-1', false), true);
  assert.equal(isIntakeResponseAccepted({ status: 'quarantined' }, 'lead-1', false), false);
});
