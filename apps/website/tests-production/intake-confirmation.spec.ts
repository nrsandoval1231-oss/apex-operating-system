import { test, expect } from '@playwright/test';
import { WEBHOOK_GLOB, openQuoteForm, fillContact } from '../tests/helpers';

for (const response of [
  { name: 'empty response', contentType: 'application/json', body: '' },
  { name: 'HTML response', contentType: 'text/html', body: '<h1>OK</h1>' },
  { name: 'unknown status', contentType: 'application/json', body: '{"status":"unknown"}' },
  { name: 'another lead', contentType: 'application/json', body: '{"status":"accepted","lead_id":"other"}' },
]) {
  test(`${response.name} cannot claim production routing and retry retains the lead id`, async ({ page }) => {
    const leads: Record<string, unknown>[] = [];
    await page.route(WEBHOOK_GLOB, async route => {
      const lead = route.request().postDataJSON();
      leads.push(lead);
      await route.fulfill(leads.length === 1
        ? { status: 200, contentType: response.contentType, body: response.body }
        : { status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'duplicate', lead_id: lead.lead_id, dedupe_status: 'duplicate' }) });
    });
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();
    await expect(page.getByRole('alert').filter({ hasText: /call us/i })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.locator('#em')).toHaveValue('dana.reyes@example.com');
    expect(await page.evaluate(() => (window as any).dataLayer?.filter((item: any) => item.event === 'lead_submit') ?? [])).toHaveLength(0);
    await page.getByRole('button', { name: /get my quote/i }).click();
    await expect(page.getByRole('status')).toBeVisible();
    expect(leads).toHaveLength(2);
    expect(leads[1].lead_id).toBe(leads[0].lead_id);
  });
}

test('accepted production intake confirms the submitted lead', async ({ page }) => {
  await page.route(WEBHOOK_GLOB, async route => {
    const lead = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'accepted', lead_id: lead.lead_id, routed_to: 'pools@example.test', dedupe_status: 'new' }) });
  });
  await page.goto('/');
  await openQuoteForm(page);
  await fillContact(page);
  await page.getByRole('button', { name: /get my quote/i }).click();
  await expect(page.getByRole('status')).toBeVisible();
});
