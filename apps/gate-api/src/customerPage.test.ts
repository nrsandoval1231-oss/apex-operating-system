import { describe, expect, it } from 'vitest';
import { createCanonicalId, CUSTOMER_MILESTONES, type CustomerPage } from '@apex/contracts';
import { renderCustomerPage } from './customerPage.js';

const page = (contact: CustomerPage['contact']): CustomerPage => ({
  customerName: 'Casey Rivera',
  addressLine: '1400 Demo Basin Lane, Lubbock, TX',
  milestones: CUSTOMER_MILESTONES.map((milestone) => ({
    key: milestone.key,
    title: milestone.title,
    state: milestone.key === 'design' ? 'current' : 'upcoming',
  })),
  headline: 'Design is underway',
  happeningNow: 'We are drawing the pool.',
  happeningNext: 'Excavation comes next.',
  decisions: [{
    decisionId: createCanonicalId('decision'),
    title: 'Tile color',
    detail: 'Which waterline tile do you want?',
    consequence: 'Tile cannot be ordered until you choose.',
    neededBy: null,
  }],
  photos: [],
  updates: [],
  contact,
});

describe('customer decision copy', () => {
  it('asks the customer to call only when a phone number is configured', () => {
    expect(renderCustomerPage(page(null))).not.toContain('Call or text us');
    const withPhone = renderCustomerPage(page({
      phone: '+18065550100',
      label: 'Call or text us any time.',
    }));
    expect(withPhone).toContain('Call or text us with your answer');
    expect(withPhone).toContain('tel:+18065550100');
  });
});
