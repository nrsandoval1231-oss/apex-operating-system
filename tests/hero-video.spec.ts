/**
 * hero-video.spec.ts — the hero video must stay an enhancement, not a tax.
 *
 * The live Apex site ships the failure mode these tests exist to prevent: a 2.23 MB clip with
 * `preload="auto"`, no poster, and no viewport gate, so a phone on cellular pays full price
 * for a background that is then covered by a 64% black scrim.
 *
 * Every assertion here is about NOT spending someone's bandwidth. They're easy to regress —
 * one `preload="auto"`, one removed media query — and the regression is invisible in a
 * browser on a fast desktop connection, which is exactly where it would be reviewed.
 */
import { test, expect } from '@playwright/test';

const VIDEO = '.hero-video-el';
const POSTER = '.hero-video-poster';

test.describe('hero video', () => {
  test('the poster is a real image and carries the hero on its own', async ({ page }) => {
    await page.goto('/');
    const poster = page.locator(POSTER);
    await expect(poster).toBeAttached();
    // Reserved dimensions: the hero must not shift when the image lands.
    await expect(poster).toHaveAttribute('width', '1280');
    await expect(poster).toHaveAttribute('height', '720');
    await expect(poster).toHaveAttribute('fetchpriority', 'high');
    await expect
      .poll(() => poster.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });

  test('the video element ships with no src and preload=none', async ({ page }) => {
    // Before any script runs there must be nothing to download. This is what makes every
    // gate below cost exactly zero bytes when it declines.
    await page.route('**/*.mp4', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const video = page.locator(VIDEO);
    await expect(video).toHaveAttribute('preload', 'none');
    expect(await video.getAttribute('src')).toBeNull();
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('attaches and plays after load', async ({ page }) => {
      await page.goto('/');
      await expect
        .poll(() => page.locator(VIDEO).getAttribute('src'), { timeout: 15_000 })
        .toContain('.mp4');
      await expect(page.locator('.hero-video.is-playing')).toBeAttached({ timeout: 15_000 });
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('never fetches the video', async ({ page }) => {
      const requested: string[] = [];
      page.on('request', (r) => {
        if (r.url().endsWith('.mp4')) requested.push(r.url());
      });
      await page.goto('/');
      await page.waitForTimeout(2500);
      expect(await page.locator(VIDEO).getAttribute('src')).toBeNull();
      expect(requested, 'a phone must not download the hero video').toEqual([]);
      // ...and the hero still shows real imagery.
      await expect(page.locator(POSTER)).toBeVisible();
    });
  });

  test('reduced motion never fetches the video', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const requested: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.mp4')) requested.push(r.url());
    });
    await page.goto('/');
    await page.waitForTimeout(2500);
    expect(await page.locator(VIDEO).getAttribute('src')).toBeNull();
    expect(requested, 'reduced motion must not download the hero video').toEqual([]);
    await expect(page.locator(POSTER)).toBeVisible();
  });

  test('the served clip stays small', async ({ request }) => {
    const res = await request.get('/video/apex-hero-loop.mp4');
    expect(res.status()).toBe(200);
    const bytes = Number(res.headers()['content-length'] ?? (await res.body()).length);
    // The source was 2.23 MB. Trimmed to the pool segment it is ~593 KB; this guards against
    // someone swapping the full clip back in.
    expect(bytes, 'hero loop should stay under 1 MB').toBeLessThan(1_000_000);
  });

  test('og:image is a real Apex photo, not absent', async ({ page, request }) => {
    await page.goto('/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og, 'shared links must carry an image').toBeTruthy();
    expect(og).toContain('/images/apex/');

    /*
     * og:image must be ABSOLUTE — scrapers don't resolve relative URLs — so the tag points at
     * the canonical production domain, which doesn't serve this build. Fetching it verbatim
     * would test apexgetsitdone.com, not us. Verify the asset exists at that PATH on the
     * server under test; the absolute-ness is asserted separately below.
     */
    expect(og, 'og:image must be absolute for scrapers').toMatch(/^https?:\/\//);
    const res = await request.get(new URL(og!).pathname);
    expect(res.status(), 'the og:image asset must exist in this build').toBe(200);
  });
});
