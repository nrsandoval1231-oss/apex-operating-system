/**
 * consent-and-resilience.spec.ts — AC-3 (TCPA consent) and AC-4 (form resilience).
 *
 * AC-3 is the one with legal weight. The old site sent a pool lead a consent disclosure
 * naming "Apex Concrete Coating" — a person consented to be texted by a brand that was not
 * the one texting them. That is TCPA exposure, not a copy nit, and AC-3.4 exists specifically
 * to make that bug impossible to reintroduce. These tests assert the consent string is
 * rebuilt from the SELECTED vertical at submit time, and that the string shown on screen is
 * byte-identical to the one recorded in the payload.
 */
import { test, expect } from '@playwright/test';
import { mockWebhook, openQuoteForm, fillContact, selectVertical } from './helpers';

const CONSENT_BRAND: Record<string, string> = {
  'Designer Pools': 'Apex Designer Pools',
  'Concrete Coating': 'Apex Concrete Coating',
  'Design & Renovation': 'Apex Design & Renovation',
  'Pool Service': 'Apex Pool Service',
};

test.describe('AC-3 · consent correctness (TCPA)', () => {
  test('AC-3.1 / AC-3.2 · the disclosure names the currently-selected brand, and updates live', async ({
    page,
  }) => {
    await page.goto('/');
    await openQuoteForm(page);

    for (const [vertical, brand] of Object.entries(CONSENT_BRAND)) {
      await selectVertical(page, vertical);
      await expect(page.locator('.consent')).toContainText(brand);

      // And crucially it must name ONLY that brand — no stale text from a prior selection.
      const shown = (await page.locator('.consent').textContent()) ?? '';
      for (const other of Object.values(CONSENT_BRAND)) {
        if (other === brand) continue;
        expect(shown).not.toContain(other);
      }
    }
  });

  test('AC-3.3 · the exact string shown is what lands in consent_text', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await selectVertical(page, 'Design & Renovation');

    const shown = ((await page.locator('.consent').textContent()) ?? '').trim();
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.consent_text).toBe(shown);
    expect(body.consent_sms).toBe(true);
  });

  test('AC-3.4 · a pool lead never submits consent naming Concrete Coating', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/coating'); // start on the WRONG vertical on purpose
    await openQuoteForm(page);
    await selectVertical(page, 'Designer Pools'); // then switch to pools
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.vertical).toBe('Designer Pools');
    expect(body.consent_text).toContain('Apex Designer Pools');
    expect(body.consent_text).not.toContain('Concrete Coating');
  });

  test('declining consent records consent_sms:false and an empty consent_text', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { consent: false });
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.consent_sms).toBe(false);
    // No consent means no captured disclosure — recording one would imply consent was given.
    expect(body.consent_text).toBe('');
  });
});

test.describe('AC-4 · form resilience', () => {
  test('AC-4.1 · a webhook failure tells the user to call, and shows the real number', async ({
    page,
  }) => {
    await mockWebhook(page, { status: 500 });
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const error = page.locator('.form-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/call/i);
    // A phone number the user can actually tap — not a stack trace, not a silent failure.
    await expect(error.locator('a[href^="tel:"]')).toBeVisible();
  });

  test('AC-4.2 · success shows the capture panel and does not double-submit', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await selectVertical(page, 'Pool Service');
    await fillContact(page);

    const submit = page.getByRole('button', { name: /get my quote/i });
    await submit.click();

    const panel = page.locator('.capture[role="status"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Pool Service');

    // The submit button is replaced by the panel, so a second submit is impossible by
    // construction — assert the request count rather than trusting that.
    await page.waitForTimeout(300);
    expect(hook.count()).toBe(1);
  });

  test('AC-4.3 · invalid email and phone are rejected before any request is made', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { email: 'not-an-email', phone: '123' });
    await page.getByRole('button', { name: /get my quote/i }).click();

    await expect(page.locator('#em-err')).toBeVisible();
    await expect(page.locator('#ph-err')).toBeVisible();
    await page.waitForTimeout(300);
    expect(hook.count()).toBe(0);
  });

  /*
   * AC-4.5 — the form used to demand BOTH email and phone while intake quarantines a lead
   * only when both are missing. Every visitor who would give one but not the other was
   * turned away by our own validation, and the lead never reached the engine at all.
   */
  test('AC-4.5 · a phone with no email is a valid lead and is sent', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { email: '' });
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.email).toBe('');
    expect(body.phone).toBe('8065550142');
    await expect(page.locator('.capture[role="status"]')).toBeVisible();
  });

  test('AC-4.5 · an email with no phone is a valid lead and is sent', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { phone: '' });
    await page.getByRole('button', { name: /get my quote/i }).click();

    const body = await hook.payload();
    expect(body.email).toBe('dana.reyes@example.com');
    expect(body.phone).toBe('');
    await expect(page.locator('.capture[role="status"]')).toBeVisible();
  });

  test('AC-4.5 · neither email nor phone is refused before any request is made', async ({
    page,
  }) => {
    const hook = await mockWebhook(page);
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page, { email: '', phone: '' });
    await page.getByRole('button', { name: /get my quote/i }).click();

    await expect(page.locator('#em-err')).toContainText(/email or a phone/i);
    await expect(page.locator('#ph-err')).toContainText(/email or a phone/i);
    await page.waitForTimeout(300);
    expect(hook.count()).toBe(0);
  });

  /*
   * AC-4.4 — intake answers HTTP 200 whether it accepted the lead or set it aside, and says
   * which in the body. Reading only the status code showed "Lead captured & routed" to a
   * customer whose request had been quarantined: they stop chasing, and nobody is coming.
   */
  test('AC-4.4 · a quarantined 200 shows the call-us error, not the capture panel', async ({
    page,
  }) => {
    await mockWebhook(page, {
      status: 200,
      respondWith: { status: 'quarantined', lead_id: 'apex_test', reason: 'vertical not in enum' },
    });
    await page.goto('/');
    await openQuoteForm(page);
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();

    const error = page.locator('.form-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText(/call/i);
    await expect(error.locator('a[href^="tel:"]')).toBeVisible();
    await expect(page.locator('.capture[role="status"]')).toHaveCount(0);
  });

  for (const [label, respondWith] of [
    ['accepted', { status: 'accepted', lead_id: 'apex_test', routed_to: 'pools@apexgetsitdone.com' }],
    ['duplicate', { status: 'duplicate', lead_id: 'apex_test', dedupe_status: 'duplicate' }],
    // Not the intake contract at all — the shape a test endpoint answers with. Must still
    // read as delivered, or every pre-launch submission reports a false failure.
    ['an unrecognized body', { ok: true }],
  ] as const) {
    test(`AC-4.4 · ${label} still shows the capture panel`, async ({ page }) => {
      await mockWebhook(page, { status: 200, respondWith });
      await page.goto('/');
      await openQuoteForm(page);
      await fillContact(page);
      await page.getByRole('button', { name: /get my quote/i }).click();

      await expect(page.locator('.capture[role="status"]')).toBeVisible();
      await expect(page.locator('.form-error')).toHaveCount(0);
    });
  }
});

test.describe('AC-5.5 · analytics event', () => {
  test('lead_submit is pushed to the dataLayer with vertical and source', async ({ page }) => {
    const hook = await mockWebhook(page);
    await page.goto('/?utm_source=facebook&utm_medium=paid');
    await openQuoteForm(page);
    await selectVertical(page, 'Concrete Coating');
    await fillContact(page);
    await page.getByRole('button', { name: /get my quote/i }).click();
    await hook.payload();

    const events = await page.evaluate(() =>
      ((window as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer ?? []).filter(
        (e) => e.event === 'lead_submit',
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0].vertical).toBe('Concrete Coating');
    expect(events[0].source).toBe('facebook');
  });
});

test.describe('AC-6 · accessibility floor', () => {
  test('AC-6.2 · every form input has an associated label', async ({ page }) => {
    await page.goto('/');
    await openQuoteForm(page);
    for (const id of ['fn', 'ln', 'em', 'ph']) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('AC-6.1 · the service selector is operable by keyboard', async ({ page }) => {
    await page.goto('/');
    await openQuoteForm(page);
    const target = page.locator('.svc button[data-v="Pool Service"]');
    await target.focus();
    await expect(target).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(target).toHaveAttribute('aria-pressed', 'true');
  });
});
