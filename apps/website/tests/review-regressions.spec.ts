import { test, expect } from '@playwright/test';
import { interceptLead, submitValid } from './helpers';

const conversions = (page: import('@playwright/test').Page) => page.evaluate(() =>
  ((window as unknown as { dataLayer?: { event?: string }[] }).dataLayer ?? []).filter(item => item.event === 'lead_submit'));

test('confirmed acceptance emits one conversion with frozen attribution and no contact data', async ({ page }) => {
  await interceptLead(page, { status: 'accepted', lead_id: 'web-123', canonical_lead_id: 'os-456' });
  await page.goto('/?utm_source=partner');
  await submitValid(page);
  await expect(page.locator('.quote-success')).toBeVisible();
  expect(await conversions(page)).toEqual([{ event: 'lead_submit', vertical: 'Designer Pools', source: 'partner' }]);
});

for (const phase of ['sending', 'error'] as const) {
  test(`hero preselection during ${phase} preserves the frozen request and retry`, async ({ page }) => {
    const seen: Record<string, unknown>[] = [];
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/public/v1/leads', async route => {
      seen.push(route.request().postDataJSON());
      if (seen.length === 1) { await held; await route.abort(); }
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'duplicate', lead_id: seen[0].lead_id, canonical_lead_id: 'os-456' }) });
    });
    await page.goto('/designer-pools?utm_source=partner');
    await submitValid(page);
    await expect(page.getByRole('button', { name: 'Sending…', exact: true })).toBeVisible();
    if (phase === 'error') { release(); await expect(page.locator('.form-error')).toBeVisible(); }
    await page.locator('a[data-preselect][href="#quote"]').first().click();
    if (phase === 'sending') release();
    await expect(page.locator('.form-error')).toBeVisible();
    expect(await conversions(page)).toEqual([]);
    await page.getByRole('button', { name: 'Retry request', exact: true }).click();
    await expect(page.locator('.quote-success')).toBeVisible();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(seen[0]);
    expect(await conversions(page)).toEqual([{ event: 'lead_submit', vertical: 'Designer Pools', source: 'partner' }]);
  });
}

for (const stored of [false, true]) {
  test(`bounds long attribution from ${stored ? 'existing session' : 'URL'} without blocking the quote`, async ({ page }) => {
    const long = 'campaign-'.repeat(80);
    if (stored) await page.addInitScript(value => sessionStorage.setItem('apex_attribution', JSON.stringify({ source: value, medium: value, campaign: value, landing_page: '/' + value, referrer: 'https://example.com/' + value, fbclid: value, gclid: value })), long);
    const seen = await interceptLead(page, { status: 'accepted', lead_id: 'web-123', canonical_lead_id: 'os-456' });
    await page.goto('/?' + new URLSearchParams({ utm_source: 'x'.repeat(199) + '😀', utm_medium: long, utm_campaign: long, fbclid: long, gclid: long }));
    await submitValid(page);
    await expect(page.locator('.quote-success')).toBeVisible();
    for (const key of ['source', 'medium', 'campaign', 'landing_page', 'referrer', 'fbclid', 'gclid', 'page_submitted']) expect(seen[0].body[key].length).toBeLessThanOrEqual(200);
    expect(seen[0].body.campaign).toBe(long.slice(0, 200));
    if (!stored) expect(seen[0].body.source).toBe('x'.repeat(199));
    expect(seen[0].body.first_name).toBe('Dana');
  });
}

test('unavailable analytics cannot turn accepted intake into an error', async ({ page }) => {
  await page.addInitScript(() => { (window as any).dataLayer = Object.freeze([]); });
  await interceptLead(page, { status: 'accepted', lead_id: 'web-123', canonical_lead_id: 'os-456' });
  await page.goto('/');
  await submitValid(page);
  await expect(page.locator('.quote-success')).toBeVisible();
  await expect(page.locator('.form-error')).toHaveCount(0);
});
