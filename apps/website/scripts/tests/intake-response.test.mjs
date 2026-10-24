import test from 'node:test';
import assert from 'node:assert/strict';
import { isIntakeResponseAccepted } from '../../src/lib/intake-response.ts';

test('intake requires an exact persisted lead acknowledgement in every environment', () => {
  for (const status of ['accepted','duplicate']) {
    assert.equal(isIntakeResponseAccepted({status,lead_id:'lead-1',canonical_lead_id:'os-1'},'lead-1'),true);
    assert.equal(isIntakeResponseAccepted({status,lead_id:'other',canonical_lead_id:'os-1'},'lead-1'),false);
    assert.equal(isIntakeResponseAccepted({status,lead_id:'lead-1'},'lead-1'),false);
  }
});

test('empty, malformed, non-persisted, and wrong-shape responses fail closed', () => {
  for (const body of [null,undefined,{},true,{ok:true},{status:'accepted',lead_id:'lead-1'}, {status:'quarantined',lead_id:'lead-1',canonical_lead_id:'os-1'}]) {
    assert.equal(isIntakeResponseAccepted(body,'lead-1'),false);
  }
});
