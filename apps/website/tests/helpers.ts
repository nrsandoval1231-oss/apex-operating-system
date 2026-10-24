import { expect, type Page } from '@playwright/test';

export const LEAD_ENDPOINT = '**/api/public/v1/leads';
export async function openQuoteForm(page: Page) {
  await page.locator('#quote').scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:not([ssr])').first()).toBeAttached({ timeout: 20_000 });
  return page.getByRole('button', { name: /continue/i });
}

export async function advanceToContact(page: Page, division = 'Designer Pools') {
  await openQuoteForm(page);
  await page.getByRole('button', { name: division, exact: true }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel('Project type').selectOption({ index: 1 });
  await page.getByRole('button', { name: /continue/i }).click();
}

export async function fillContact(page: Page, options: { first?: string; last?: string; email?: string; phone?: string; consent?: boolean } = {}) {
  await page.getByLabel('First name').fill(options.first ?? 'Dana');
  await page.getByLabel('Last name').fill(options.last ?? 'Reyes');
  if (options.email !== '') await page.getByLabel('Email').fill(options.email ?? 'dana.reyes@example.com');
  if (options.phone !== '') await page.getByLabel('Phone').fill(options.phone ?? '806-555-0142');
  if (options.consent) await page.locator('.consent-check input').check();
}

export async function interceptLead(page: Page, response: unknown, status = 200) {
  const requests: { url: string; body: Record<string, any> }[] = [];
  await page.route(LEAD_ENDPOINT, async (route) => {
    const body = route.request().postDataJSON();
    requests.push({ url: route.request().url(), body });
    const reply = typeof response === 'object' && response !== null &&
      ((response as any).status === 'accepted' || (response as any).status === 'duplicate') &&
      (response as any).lead_id === 'web-123'
      ? { ...(response as object), lead_id: body.lead_id }
      : response;
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  return requests;
}

export async function submitValid(page: Page, division = 'Designer Pools', contact: Parameters<typeof fillContact>[1] = {}) {
  await advanceToContact(page, division);
  await fillContact(page, contact);
  await page.getByRole('button', { name: /send|submit|request/i }).click();
}
