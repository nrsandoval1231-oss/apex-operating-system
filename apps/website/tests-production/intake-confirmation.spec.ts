import { test, expect } from '@playwright/test';
import { LEAD_ENDPOINT, submitValid } from '../tests/helpers';

for (const response of [
  { name: 'empty response', contentType: 'application/json', body: '' },
  { name: 'HTML response', contentType: 'text/html', body: '<h1>OK</h1>' },
  { name: 'unknown status', contentType: 'application/json', body: '{"status":"unknown"}' },
  { name: 'another lead', contentType: 'application/json', body: '{"status":"accepted","lead_id":"other","canonical_lead_id":"os-1"}' },
  { name: 'missing canonical id', contentType: 'application/json', body: '{"status":"accepted","lead_id":"LEAD"}' },
]) {
  test(`${response.name} cannot claim production routing and retry retains the lead id`, async ({ page }) => {
    const leads: Record<string, unknown>[] = [];
    await page.route(LEAD_ENDPOINT, async route => {
      const lead = route.request().postDataJSON();
      leads.push(lead);
      await route.fulfill(leads.length === 1
        ? { status: 200, contentType: response.contentType, body: response.body }
        : { status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'duplicate', lead_id: lead.lead_id, canonical_lead_id: 'os-1' }) });
    });
    await page.goto('/');
    await submitValid(page);
    await expect(page.getByRole('alert').filter({ hasText: /call us/i })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByLabel('Email')).toHaveValue('dana.reyes@example.com');
    expect(await page.evaluate(() => (window as any).dataLayer?.filter((item: any) => item.event === 'lead_submit') ?? [])).toHaveLength(0);
    await page.getByRole('button', { name: /send|submit|request/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
    expect(leads).toHaveLength(2);
    expect(leads[1].lead_id).toBe(leads[0].lead_id);
    expect(await page.evaluate(() => (window as any).dataLayer?.filter((item: any) => item.event === 'lead_submit') ?? [])).toEqual([{ event: 'lead_submit', vertical: leads[0].vertical, source: leads[0].source }]);
  });
}

test('accepted production intake confirms the submitted lead', async ({ page }) => {
  await page.route(LEAD_ENDPOINT, async route => {
    const lead = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'accepted', lead_id: lead.lead_id, canonical_lead_id: 'os-1' }) });
  });
  await page.goto('/');
  await submitValid(page);
  await expect(page.getByRole('status')).toBeVisible();
});
