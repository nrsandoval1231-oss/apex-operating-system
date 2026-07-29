/**
 * helpers.ts — shared fixtures for the acceptance tests.
 *
 * The important one is `mockWebhook`. Every test that submits the form installs it, and it
 * does two jobs at once: it captures the exact JSON payload so the assertions can inspect the
 * real thing, and it guarantees the request never leaves the machine. Hard rule 6 says no test
 * build fires real traffic; the dev server already points at the TEST endpoint, and this makes
 * that belt-and-braces.
 */
import { expect, type Page, type Route } from '@playwright/test';

/** Matches whichever n8n endpoint the build resolved to — prod or test. */
export const WEBHOOK_GLOB = '**/webhook*/**';

export interface LeadCapture {
  /** Resolves with the parsed payload of the first submission. */
  payload: () => Promise<Record<string, unknown>>;
  /** How many times the form actually POSTed — the double-submit assertion (AC-4.2). */
  count: () => number;
}

/**
 * Intercept the lead webhook. `status` lets a test force a failure so the error path can be
 * exercised (AC-4.1) without depending on a real endpoint being down.
 */
export async function mockWebhook(page: Page, { status = 200 } = {}): Promise<LeadCapture> {
  const bodies: Record<string, unknown>[] = [];
  let resolveFirst: (v: Record<string, unknown>) => void;
  const first = new Promise<Record<string, unknown>>((r) => (resolveFirst = r));

  await page.route(WEBHOOK_GLOB, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    bodies.push(body);
    if (bodies.length === 1) resolveFirst(body);
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200 ? { ok: true } : { error: 'simulated failure' }),
    });
  });

  return { payload: () => first, count: () => bodies.length };
}

/**
 * Scroll the quote form into view and wait for the island to hydrate.
 *
 * The form is a `client:visible` island, so it does not exist as an interactive component
 * until it scrolls into the viewport. Every test needs this; forgetting it produces confusing
 * "element not found" failures on markup that is plainly in the DOM.
 */
export async function openQuoteForm(page: Page) {
  await page.locator('#quote').scrollIntoViewIfNeeded();
  const submit = page.getByRole('button', { name: /get my quote/i });
  await expect(submit).toBeVisible();

  /*
   * Wait for the island to actually HYDRATE, not merely to render.
   *
   * This is the subtle one, and getting it wrong produced four confusing failures: Astro
   * server-renders the React island, so the full form — including `aria-pressed` on every
   * service button — exists in the static HTML before any JavaScript runs. Waiting on those
   * attributes therefore proves nothing, and a click landing in that window is silently
   * swallowed: the markup is there, the handler is not.
   *
   * Astro's runtime stamps `ssr` on <astro-island> and removes it once the component is
   * hydrated, so its ABSENCE is the real signal.
   */
  await expect(page.locator('astro-island:not([ssr])').first()).toBeAttached();
  return submit;
}

/** Fill the contact fields with valid values. Vertical selection is left to the caller. */
export async function fillContact(
  page: Page,
  {
    first = 'Dana',
    last = 'Reyes',
    email = 'dana.reyes@example.com',
    phone = '806-555-0142',
    consent = true,
  } = {},
) {
  await page.fill('#fn', first);
  await page.fill('#ln', last);
  await page.fill('#em', email);
  await page.fill('#ph', phone);
  if (consent) await page.locator('.consent-check input[type="checkbox"]').check();
}

/** Click the service button for an exact vertical enum string. */
export async function selectVertical(page: Page, vertical: string) {
  await page.locator(`.svc button[data-v="${vertical}"]`).click();
  await expect(page.locator(`.svc button[data-v="${vertical}"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}
