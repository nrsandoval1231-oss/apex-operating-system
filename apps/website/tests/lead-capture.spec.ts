/**
 * lead-capture.spec.ts — AC-1 (lead object completeness) and AC-2 (vertical routing).
 *
 * AC-1 is described in the acceptance criteria as "the critical one", and until now it had
 * never been executed. Everything downstream — n8n routing, the CRM write, Meta offline
 * conversions, per-vertical ad measurement — joins on the fields asserted here. A lead that
 * arrives without a `vertical`, or with a `campaign` of `""`, is not a cosmetic defect; it is
 * a lead that cannot be attributed to the spend that bought it.
 */
import { test, expect } from '@playwright/test';
import { mockWebhook, openQuoteForm, fillContact, selectVertical } from './helpers';

const VERTICALS = [
  'Designer Pools',
  'Concrete Coating',
  'Design & Renovation',
  'Pool Service',
] as const;

test.describe('AC-1 · lead object completeness', () => {
  test('AC-1.1 · payload matches the data contract — every field present, correct types', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await selectVertical(page, 'Designer Pools');
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();

    // Exact field set from docs/data-contract.md — no extras, no omissions.
    expect(Object.keys(body).sort()).toEqual(
      [
        'campaign', 'consent_sms', 'consent_text', 'device', 'email', 'fbclid', 'first_name',
        'gclid', 'landing_page', 'last_name', 'lead_id', 'medium', 'page_submitted', 'phone',
        'referrer', 'source', 'submitted_at', 'vertical',
      ].sort(),
    );

    expect(typeof body.lead_id).toBe('string');
    expect(body.lead_id).toBeTruthy();
    expect(typeof body.consent_sms).toBe('boolean');
    expect(['mobile', 'tablet', 'desktop']).toContain(body.device);
    // ISO 8601 with a timezone OFFSET, not a bare local time — n8n and the CRM both parse this.
    expect(body.submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(body.email).toBe('dana.reyes@example.com');
  });

  test('AC-1.2 · vertical is never empty and is always an exact enum string', async ({ page }) => {
    /*
     * This test does FOUR full page loads and four island hydrations in one body, so it needs a
     * budget that fits that — the 30s default does not once the home page carries seven
     * sections, and it was failing on total elapsed time rather than on any assertion about the
     * payload. The per-assertion timeout (10s, from playwright.config.ts) is unchanged, so a
     * genuinely stuck element still fails fast; this only relaxes the total for the loop.
     */
    test.setTimeout(120_000);

    for (const vertical of VERTICALS) {
      const hook = await mockWebhook(page);
      await page.goto('/');
      await openQuoteForm(page);
      await selectVertical(page, vertical);
      await fillContact(page);
      await page.getByRole('button', { name: /get my quote/i }).click();

      const body = await hook.payload();
      expect(body.vertical).toBe(vertical);
      await page.unrouteAll();
    }
  });

  test('AC-1.3 · lead_id is unique per submission and minted exactly once', async ({ page }) => {
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const hook = await mockWebhook(page);
      await page.goto('/');
      await openQuoteForm(page);
      await fillContact(page);
      await page.getByRole('button', { name: /get my quote/i }).click();
      const body = await hook.payload();
      ids.add(body.lead_id as string);
      await page.unrouteAll();
    }
    expect(ids.size).toBe(3);
  });

  test('AC-1.4 · utm parameters and fbclid survive to the payload', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/?utm_source=facebook&utm_medium=paid&utm_campaign=test123&fbclid=ABC');
    await openQuoteForm(page);
    await selectVertical(page, 'Concrete Coating');
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.source).toBe('facebook');
    expect(body.medium).toBe('paid');
    expect(body.campaign).toBe('test123');
    expect(body.fbclid).toBe('ABC');
  });

  test('AC-1.5 · first touch survives navigation (land on /pools, submit from /)', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/pools');
    // Navigate via a real in-page link, the way a visitor would. Matched on a loose pattern
    // rather than the exact accessible name: the brand link's label is copy, and pinning a
    // test to its exact punctuation means a wording tweak fails an attribution test for no
    // reason. What matters is that a visitor can get home from a vertical page.
    await page.getByRole('link', { name: /apex.*home/i }).click();
    await expect(page).toHaveURL(/\/$/);

    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.landing_page).toBe('/pools');
    expect(body.page_submitted).toBe('/');
  });

  test('AC-1.6 · a direct visit yields source:direct / medium:none, never empty strings', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.source).toBe('direct');
    expect(body.medium).toBe('none');
    // campaign falls back to the vertical default rather than "" — downstream groups on it.
    expect(body.campaign).toBeTruthy();
    expect(body.landing_page).toBe('/');
  });

  test('AC-1.7 · a non-production build posts to the TEST webhook, never production', async ({
    page,
  }) => {
    // Hard rule 6. The test suite runs against a dev build, so the resolved endpoint must be
    // the test one — asserted on the REQUEST URL, since that is what would actually have gone
    // out had the route not been mocked.
    let requestUrl = '';
    await page.route('**/webhook*/**', async (route) => {
      requestUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();
    await expect.poll(() => requestUrl).not.toBe('');

    expect(requestUrl).toContain('webhook-test');
  });

  test('AC-4.3 · phone is normalized to digits in the payload', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { phone: '(806) 555-0142' });
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.phone).toBe('8065550142');
  });
});

test.describe('AC-2 · vertical routing and selection', () => {
  /*
   * AC-2.1 · the home page offers all four verticals, in enum order.
   *
   * Homepage V2 moved these off the hero: the four-tile router (`.tiles .tile`) is gone,
   * because a brand-led, pools-led page cannot also be a four-way router above the fold. The
   * requirement AC-2.1 encodes — all four verticals are offered on the home page, in the exact
   * enum order — is unchanged and is now asserted against the capability index.
   *
   * The names are the horizontal rule: they must be the exact enum strings, in the order
   * VERTICAL_LIST produces, because those strings are what a lead is tagged with downstream
   * (AC-2.4). The index displays each vertical's own headline from the content modules rather
   * than the enum string, so the enum is read from the data-preselect attributes instead.
   */
  test('AC-2.1 · the home page offers exactly four verticals in enum order', async ({ page }) => {
    await page.goto('/');
    const preselects = page.locator('.index [data-preselect]');
    await expect(preselects).toHaveCount(4);
    const order = await preselects.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-preselect')),
    );
    expect(order).toEqual([...VERTICALS]);
  });

  test('AC-2.2 · a vertical CTA pre-selects that vertical in the form', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-preselect="Designer Pools"]').first().click();
    await openQuoteForm(page);
    await expect(page.locator('.svc button[data-v="Designer Pools"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('AC-2.3 · the user can still change a pre-selected vertical, and the change wins', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/coating'); // arrives pre-selected as Concrete Coating
    await openQuoteForm(page);
    await expect(page.locator('.svc button[data-v="Concrete Coating"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await selectVertical(page, 'Pool Service');
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.vertical).toBe('Pool Service');
  });
});

/**
 * AC-8.2 — the check that could never be run before. The in-editor preview pane reports
 * `document.visibilityState === 'hidden'`, so `client:visible` never fires there and the
 * island never mounts. Headless Chromium composites normally, so this finally exercises it.
 */
test.describe('AC-8.2 · vertical landing pages arrive pre-selected', () => {
  for (const [slug, vertical] of [
    ['pools', 'Designer Pools'],
    ['coating', 'Concrete Coating'],
    ['renovation', 'Design & Renovation'],
    ['service', 'Pool Service'],
  ] as const) {
    test(`/${slug} opens with "${vertical}" selected`, async ({ page }) => {
      await page.goto(`/${slug}`);
      await openQuoteForm(page);
      await expect(page.locator(`.svc button[data-v="${vertical}"]`)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  }
});

/**
 * Homepage V2 replaced the three-up testimonial CARD grid with a single large pull-quote in the
 * showcase section — the brief rules out card grids, and three boxed reviews is exactly that
 * pattern. The evidence is still on the page and still real, so the test now asserts the
 * quote is present, attributed, and readable, rather than asserting a grid it no longer uses.
 */
test('the proof section presents testimonials as an attributed pull-quote', async ({ page }) => {
  await page.goto('/');
  const quote = page.locator('.quote');
  await expect(quote).toHaveCount(1);
  await expect(quote.locator('blockquote')).toBeVisible();
  // A pull-quote with no attribution is an unattributed claim, which is worse than no quote.
  await expect(quote.locator('.who')).not.toBeEmpty();
  // And it must be a real blockquote, so assistive tech announces it as a quotation.
  await expect(quote.locator('blockquote')).toHaveJSProperty('tagName', 'BLOCKQUOTE');
});

/**
 * The financing partner is represented by its official logo and remains a real external link.
 *
 * Homepage V2 removed the pools-section badge that used to carry a second copy of this link
 * (the retired PoolsSection.astro). One clear link in the footer is correct; the assertion is
 * now about it being a real, attributed, external link rather than about a count that was
 * really counting a component that no longer exists.
 */
test('Lyon Financial logo is a clickable external link', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('footer a.fin-link').filter({
    has: page.locator('img[alt="Lyon Financial"]'),
  });
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', /lyonfinancial\.net/);
  await expect(links.first()).toHaveAttribute('rel', /noopener/);
  await expect(links.first().locator('img')).toHaveAttribute('alt', 'Lyon Financial');
});
