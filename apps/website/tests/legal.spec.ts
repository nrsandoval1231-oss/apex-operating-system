/**
 * legal.spec.ts — the legal pages must be reachable and must say the SMS things.
 *
 * These aren't cosmetic pages. The quote form captures SMS consent, and A2P 10DLC
 * registration is gated on a reachable privacy policy that actually describes the messaging
 * programme — frequency, STOP, HELP, and rates. A broken footer link or a policy that omits
 * those keywords doesn't fail visibly; it fails weeks later when the carrier rejects the
 * campaign and the texts silently stop sending.
 */
import { test, expect } from '@playwright/test';

test.describe('legal pages', () => {
  for (const [path, heading] of [
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms and Conditions'],
  ] as const) {
    test(`${path} renders with one H1 and real content`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.locator('main h1')).toHaveText(heading);
      await expect(page.locator('main h1')).toHaveCount(1);
      // Guard against a page that renders its chrome but loses the transcribed body.
      const words = ((await page.locator('.legal-body').textContent()) ?? '').split(/\s+/).length;
      expect(words, `${path} body looks empty`).toBeGreaterThan(80);
    });
  }

  test('the footer links to both, from every page, and they resolve', async ({ page }) => {
    for (const from of ['/', '/pools', '/coating', '/renovation', '/service']) {
      await page.goto(from);
      const privacy = page.locator('footer a', { hasText: 'Privacy Policy' });
      const terms = page.locator('footer a', { hasText: 'Terms' });
      await expect(privacy, `no privacy link in footer on ${from}`).toHaveAttribute(
        'href',
        '/privacy',
      );
      await expect(terms, `no terms link in footer on ${from}`).toHaveAttribute('href', '/terms');
    }
  });

  test('the SMS programme disclosure carriers check for is present', async ({ page }) => {
    await page.goto('/terms');
    const body = ((await page.locator('.legal-body').textContent()) ?? '').toUpperCase();
    // The four things an A2P 10DLC review looks for.
    for (const required of ['STOP', 'HELP', 'MESSAGE AND DATA RATES', 'CARRIERS']) {
      expect(body, `terms is missing "${required}"`).toContain(required);
    }
  });

  test('the privacy policy covers SMS and the right to deletion', async ({ page }) => {
    await page.goto('/privacy');
    const body = ((await page.locator('.legal-body').textContent()) ?? '').toLowerCase();
    expect(body).toContain('right to deletion');
    expect(body).toContain('personal information');
  });

  test('both are indexable and in the sitemap', async ({ page, request }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots, `${path} must not be noindex`).not.toContain('noindex');
    }
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/privacy');
    expect(sitemap).toContain('/terms');
  });
});
