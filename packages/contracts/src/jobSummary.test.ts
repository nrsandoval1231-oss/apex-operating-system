import { describe, expect, it } from 'vitest';
import { JobSummarySchema, readLeadIdentity } from './jobSummary.js';
import { createCanonicalId } from './ids.js';

describe('readLeadIdentity', () => {
  it('returns nulls for payloads that carry no usable identity', () => {
    for (const payload of [null, undefined, {}, [], 'text', 42, { customerName: '   ' }]) {
      expect(readLeadIdentity(payload)).toEqual({ customerName: null, addressLine: null });
    }
  });

  it('reads the common camelCase and snake_case name spellings', () => {
    expect(readLeadIdentity({ customerName: 'John & Sarah Smith' }).customerName).toBe('John & Sarah Smith');
    expect(readLeadIdentity({ customer_name: 'Mike Johnson' }).customerName).toBe('Mike Johnson');
    expect(readLeadIdentity({ full_name: 'Robert Williams' }).customerName).toBe('Robert Williams');
    expect(readLeadIdentity({ name: 'Jennifer Davis' }).customerName).toBe('Jennifer Davis');
  });

  it('joins split first and last names only when no whole name is present', () => {
    expect(readLeadIdentity({ firstName: 'Jennifer', lastName: 'Davis' }).customerName).toBe('Jennifer Davis');
    expect(readLeadIdentity({ first_name: 'Mike' }).customerName).toBe('Mike');
    expect(readLeadIdentity({ customerName: 'Whole Name', firstName: 'Split' }).customerName).toBe('Whole Name');
  });

  it('reads a flat street address and appends city and state', () => {
    expect(readLeadIdentity({ streetAddress: '4502 19th St', city: 'Lubbock', state: 'TX' }).addressLine)
      .toBe('4502 19th St, Lubbock, TX');
    expect(readLeadIdentity({ address_line_1: '7821 Knoxville Ave' }).addressLine).toBe('7821 Knoxville Ave');
    expect(readLeadIdentity({ city: 'Lubbock' }).addressLine).toBe('Lubbock');
  });

  it('reads an address nested under address or property', () => {
    expect(readLeadIdentity({ address: { line1: '3405 98th St', city: 'Lubbock' } }).addressLine)
      .toBe('3405 98th St, Lubbock');
    expect(readLeadIdentity({ property: { street: '5602 89th St', state: 'TX' } }).addressLine)
      .toBe('5602 89th St, TX');
  });

  it('accepts a plain string address value', () => {
    expect(readLeadIdentity({ address: '4502 19th St, Lubbock' }).addressLine).toBe('4502 19th St, Lubbock');
  });

  it('collapses whitespace and clamps oversized values to the schema limits', () => {
    expect(readLeadIdentity({ customerName: '  John\n\t Smith  ' }).customerName).toBe('John Smith');
    const identity = readLeadIdentity({ customerName: 'x'.repeat(500), street: 'y'.repeat(500) });
    expect(identity.customerName).toHaveLength(200);
    expect(identity.addressLine).toHaveLength(300);
  });

  it('never throws on hostile or deeply malformed payloads', () => {
    expect(() => readLeadIdentity({ address: { line1: { nope: true } } })).not.toThrow();
    expect(readLeadIdentity({ customerName: ['array'], address: 12 })).toEqual({
      customerName: null, addressLine: null,
    });
  });
});

describe('JobSummarySchema', () => {
  const base = {
    jobId: createCanonicalId('job'),
    leadId: createCanonicalId('lead'),
    status: 'active',
    createdAt: '2026-07-31T12:00:00.000Z',
    customerName: 'John & Sarah Smith',
    addressLine: '4502 19th St, Lubbock, TX',
    contractCents: 18_500_000,
    approvedTakeoffRevisionId: createCanonicalId('revision'),
    currentGate: {
      gateInstanceId: createCanonicalId('gate'),
      definitionKey: 'pre-gunite',
      definitionVersion: 1,
      title: 'Pre-gunite Gate',
      phase: 'steel-underground',
      status: 'in-progress',
      customerMilestone: 'shell',
    },
  };

  it('accepts a fully populated summary', () => {
    expect(JobSummarySchema.parse(base)).toMatchObject({ jobId: base.jobId, contractCents: 18_500_000 });
  });

  it('accepts a job with no proposal, takeoff, gate, or lead identity yet', () => {
    expect(() => JobSummarySchema.parse({
      ...base,
      customerName: null,
      addressLine: null,
      contractCents: null,
      approvedTakeoffRevisionId: null,
      currentGate: null,
    })).not.toThrow();
  });

  it('admits every lifecycle value the jobs table permits', () => {
    for (const status of ['active', 'on-hold', 'complete', 'closed', 'cancelled']) {
      expect(() => JobSummarySchema.parse({ ...base, status })).not.toThrow();
    }
  });

  it('refuses non-canonical identifiers, negative money, and unknown keys', () => {
    expect(() => JobSummarySchema.parse({ ...base, jobId: 'job_not_a_ulid' })).toThrow();
    expect(() => JobSummarySchema.parse({ ...base, contractCents: -1 })).toThrow();
    expect(() => JobSummarySchema.parse({ ...base, marginCents: 100 })).toThrow();
  });
});
