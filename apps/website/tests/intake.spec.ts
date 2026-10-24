import { test, expect } from '@playwright/test';
import { advanceToContact, fillContact, interceptLead, submitValid } from './helpers';

const ids = { lead_id: 'web-123', canonical_lead_id: 'os-456' };
test('posts frozen v2 project payload and confirms only matching accepted response', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/?utm_source=referral&utm_medium=partner&utm_campaign=spring');
  await submitValid(page);
  await expect(page.getByRole('status')).toContainText(/request received/i);
  expect(requests).toHaveLength(1);
  const { body, url } = requests[0];
  expect(url).toContain('/api/public/v1/leads');
  expect(body.schema_version).toBe(2);
  expect(body.consent_version).toBe('website-2-20261024');
  expect(body.website).toBe('');
  expect(body.project).toMatchObject({ type: 'New pool', city: 'Lubbock', features: [] });
  expect(body).toMatchObject({ first_name: 'Dana', last_name: 'Reyes', email: 'dana.reyes@example.com', source: 'referral', medium: 'partner', campaign: 'spring' });
  expect(body.lead_id).toBeTruthy();
});

test('requires name, project type, city and at least email or phone before posting', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/'); await advanceToContact(page);
  await fillContact(page, { email: '', phone: '' });
  await page.getByRole('button', { name: /send|submit|request/i }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('rejects a blank project city without contacting the API', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/');
  await page.locator('#quote').scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr])').first()).toBeAttached();
  await page.getByRole('button', { name: 'Designer Pools', exact: true }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel('Project type').selectOption({ index: 1 });
  await page.getByLabel('Project city').fill('');
  await page.getByRole('button', { name: /continue/i }).click();
  await fillContact(page);
  await page.getByRole('button', { name: /send|submit|request/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /project city/i })).toBeVisible();
  expect(requests).toHaveLength(0);
});

test('rejects blank first and last names without contacting the API', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/');
  await advanceToContact(page);
  await fillContact(page, { first: '', last: '' });
  await page.getByRole('button', { name: /send|submit|request/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /first and last name/i })).toBeVisible();
  expect(requests).toHaveLength(0);
});

for (const [label, response, status] of [
  ['wrong lead id', { status: 'accepted', lead_id: 'other', canonical_lead_id: ids.canonical_lead_id }, 200],
  ['missing canonical id', { status: 'accepted', lead_id: 'web-123' }, 200],
  ['unrecognized response', { ok: true }, 200],
  ['HTML response', '<html>ok</html>', 200],
  ['server failure', { error: 'unavailable' }, 503],
] as const) {
  test(`does not claim success for ${label}`, async ({ page }) => {
    await interceptLead(page, response, status);
    await page.goto('/'); await submitValid(page);
    await expect(page.locator('.form-error')).toContainText(/not confirmed|unavailable|retry/i);
    await expect(page.locator('.quote-success')).toHaveCount(0);
  });
}

test('keeps the same id and payload on retry after a network failure', async ({ page }) => {
  const seen: Record<string, any>[] = [];
  let attempt = 0;
  await page.route('**/api/public/v1/leads', async (route) => {
    seen.push(route.request().postDataJSON()); attempt++;
    if (attempt === 1) await route.abort();
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'duplicate', lead_id: seen[0].lead_id, canonical_lead_id: ids.canonical_lead_id }) });
  });
  await page.goto('/'); await submitValid(page);
  await expect(page.locator('.form-error')).toBeVisible();
  await page.getByRole('button', { name: /send|submit|request/i }).click();
  await expect(page.getByRole('status')).toContainText(/request received/i);
  expect(seen).toHaveLength(2);
  expect(seen[1]).toEqual(seen[0]);
});

test('consent is optional and recorded accurately', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/'); await submitValid(page, 'Designer Pools', { consent: false });
  await expect(page.getByRole('status')).toBeVisible();
  expect(requests[0].body.consent_sms).toBe(false);
});

for (const [label, contact] of [
  ['email only', { email: 'only.email@example.com', phone: '' }],
  ['phone only', { email: '', phone: '806-555-0188' }],
] as const) {
  test(`accepts ${label} contact`, async ({ page }) => {
    const requests = await interceptLead(page, { status: 'accepted', ...ids });
    await page.goto('/'); await submitValid(page, 'Designer Pools', contact);
    await expect(page.locator('.quote-success')).toBeVisible();
    expect(requests).toHaveLength(1);
  });
}

test('first-touch attribution survives navigation to the home form', async ({ page }) => {
  const requests = await interceptLead(page, { status: 'accepted', ...ids });
  await page.goto('/designer-pools?utm_source=partner&utm_medium=referral&utm_campaign=summer');
  await page.getByRole('link', { name: /home/i }).first().click();
  await submitValid(page);
  expect(requests).toHaveLength(1);
  expect(requests[0].body.landing_page).toBe('/designer-pools');
  expect(requests[0].body.page_submitted).toBe('/');
  expect(requests[0].body).toMatchObject({ source: 'partner', medium: 'referral', campaign: 'summer' });
});

test('division-specific project fields adapt for coating and renovation', async ({ page }) => {
  await page.goto('/');
  for (const [division, label] of [['Concrete Coating', /surface condition/i], ['Design & Renovation', /project scope/i]] as const) {
    await page.goto('/');
    await page.locator('#quote').scrollIntoViewIfNeeded();
    await expect(page.locator('astro-island:not([ssr])').first()).toBeAttached();
    await page.getByRole('button', { name: division, exact: true }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByLabel(label)).toBeVisible();
  }
});
