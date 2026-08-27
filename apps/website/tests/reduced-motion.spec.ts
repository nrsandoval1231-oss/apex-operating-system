/**
 * reduced-motion.spec.ts — AC-6.3, and the bug that made it necessary.
 *
 * This exists because `prefers-reduced-motion: reduce` used to blank the hero completely.
 * The entrance animation was written as `.anim { opacity: 0; animation: rise ... forwards }`,
 * and the global reduced-motion reset (`* { animation: none !important }`) removed the only
 * rule that ever restored opacity. The result was not "the hero doesn't animate" — it was
 * "the headline, subhead, warranty stats, and router question do not exist", on the most
 * important screen of the site, for exactly the users who most need it to work.
 *
 * Nothing caught it: it builds, it type-checks, it looks perfect in a normal browser, and it
 * is invisible in a screenshot taken without the media query set. AC-6.3 had been marked as
 * "implemented in global.css" on the strength of reading the code. It was implemented
 * backwards. Hence a test rather than a note.
 */
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/pools', '/coating', '/renovation', '/service'];

test.describe('AC-6.3 · prefers-reduced-motion', () => {
  /*
   * Explicit per-page emulation rather than `test.use({ reducedMotion: 'reduce' })`. The
   * fixture form did not take effect here — the premise check below caught it — and an
   * emulation that quietly fails to apply turns this whole spec into a green light for
   * behaviour nobody tested. `emulateMedia` is unambiguous and verifiable.
   */
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const path of PAGES) {
    test(`${path} · all content is visible with reduced motion`, async ({ page }) => {
      await page.goto(path);

      /*
       * Verify the test's own premise before asserting anything.
       *
       * Without this, the spec silently passes for the wrong reason: if the emulation is not
       * applied, the entrance animation runs and finishes at opacity 1, so a naive check sees
       * "everything visible" and reports green while never having exercised reduced motion at
       * all. That is worse than no test. An earlier hand-run probe made exactly this mistake —
       * it waited long enough for the animation to complete and read the result as proof.
       */
      const emulated = await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
      expect(emulated, 'reduced-motion emulation is not active — this test proves nothing').toBe(
        true,
      );

      // Anything that opts into entrance motion must still be fully opaque and un-offset.
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('.anim')]
          .map((el) => ({
            text: (el.textContent || '').trim().slice(0, 40),
            opacity: parseFloat(getComputedStyle(el).opacity),
          }))
          .filter((x) => x.opacity < 1),
      );
      expect(hidden, 'elements hidden when reduced motion is on').toEqual([]);

      // The H1 specifically — the single thing a visitor must always see. Scoped to <main>
      // so it can only ever match the page's own heading.
      const h1 = page.locator('main h1');
      await expect(h1).toBeVisible();
      expect(await h1.evaluate((el) => parseFloat(getComputedStyle(el).opacity))).toBe(1);
    });
  }

  test('/ · the four router tiles are readable with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const tiles = page.locator('.tiles .tile');
    await expect(tiles).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(tiles.nth(i)).toBeVisible();
    }
  });
});

test.describe('AC-6 · touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('primary CTAs meet the 44px touch-target floor on a phone', async ({ page }) => {
    await page.goto('/');

    /*
     * Scoped to the CTAs deliberately. Inline links inside running prose (the footer's phone
     * and email, the legal links) sit in generous line-height and are not thumb-first targets;
     * padding them to 44px would visibly break an approved layout for little real gain. The
     * things a visitor actually taps to convert are what must clear the floor.
     */
    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll('.btn, .tlink, .pool-more, .tile')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            cls: el.className,
            text: (el.textContent || '').trim().slice(0, 30),
            h: Math.round(r.height),
          };
        })
        .filter((x) => x.h > 0 && x.h < 44),
    );
    expect(undersized, 'CTAs under the 44px touch-target floor').toEqual([]);
  });
});
