/**
 * imagery.spec.ts — AC-9 (imagery) and the accessibility floor around it.
 *
 * The load-bearing assertion here is AC-9.1: every image sits in a box with a declared
 * aspect-ratio, and the file it loads matches that ratio. That is what makes replacing the
 * D-20 stock placeholders with real Apex photography a content change and not a layout change.
 * It is easy to believe this is true and easy for it to quietly stop being true, which is
 * exactly the kind of thing worth a test.
 */
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/pools', '/coating', '/renovation', '/service'];

for (const path of PAGES) {
  test.describe(`${path}`, () => {
    test('AC-9.1 · every image reserves space with an aspect-ratio, matching the file', async ({
      page,
    }) => {
      await page.goto(path);
      const slots = page.locator('.img-slot');
      const count = await slots.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const slot = slots.nth(i);
        const declared = await slot.evaluate((el) => getComputedStyle(el).aspectRatio);
        expect(declared, `.img-slot #${i} on ${path} has no aspect-ratio`).not.toBe('auto');

        const img = slot.locator('img');
        if ((await img.count()) === 0) continue;

        /*
         * Scroll the slot in and wait for a real decode before measuring. Lazy images below
         * the fold have not started loading, so `naturalWidth` is 0 and `decode()` never
         * settles — measuring without this hangs the test rather than failing it.
         */
        await slot.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 10_000 })
          .toBeGreaterThan(0);

        const { natural, box } = await img.evaluate((el: HTMLImageElement) => ({
          natural: el.naturalWidth / el.naturalHeight,
          box: (() => {
            const [w, h] = getComputedStyle(el.parentElement!).aspectRatio.split('/').map(Number);
            return w / h;
          })(),
        }));
        // Within 1% — a mismatch here means a real-photo swap would shift the layout.
        expect(Math.abs(natural - box) / box).toBeLessThan(0.01);
      }
    });

    test('AC-9.2 · every image has meaningful alt text', async ({ page }) => {
      await page.goto(path);
      const imgs = page.locator('.img-slot img');
      for (let i = 0; i < (await imgs.count()); i++) {
        const alt = await imgs.nth(i).getAttribute('alt');
        expect(alt, `image #${i} on ${path} has no alt`).toBeTruthy();
        expect(alt!.length).toBeGreaterThan(10);
      }
    });

    test('AC-9.5 · images carry a srcset, and anything below the fold is lazy', async ({ page }) => {
      await page.goto(path);
      const imgs = page.locator('.img-slot img');
      for (let i = 0; i < (await imgs.count()); i++) {
        await expect(imgs.nth(i)).toHaveAttribute('srcset', /\d+w/);
      }

      /*
       * The real rule, stated correctly. An earlier version of this test demanded at least one
       * lazy image per page, which failed the four vertical pages — each has exactly one image,
       * in the hero, and eager-loading THAT one is right: it is the LCP candidate. What matters
       * is the inverse — nothing below the fold should be eager, because that competes with the
       * hero for bandwidth and regresses AC-5.1.
       */
      const eagerBelowFold = await page.evaluate(() => {
        const vh = window.innerHeight;
        return [...document.querySelectorAll('.img-slot img')]
          .filter((el) => el.getBoundingClientRect().top > vh)
          .filter((el) => el.getAttribute('loading') !== 'lazy')
          .map((el) => (el as HTMLImageElement).currentSrc || el.getAttribute('src'));
      });
      expect(eagerBelowFold, 'below-the-fold images must be lazy').toEqual([]);
    });
  });
}

test('stock placeholders never claim the work is Apex\'s (D-20)', async ({ page }) => {
  await page.goto('/');
  const stock = page.locator('img[data-stock="true"]');
  const count = await stock.count();
  test.skip(count === 0, 'no stock images left — real photography is in place');

  for (let i = 0; i < count; i++) {
    const alt = (await stock.nth(i).getAttribute('alt')) ?? '';
    // A stock photo described as Apex's work is a claim to a customer about work Apex did.
    expect(alt, `stock image #${i} alt asserts Apex authorship: "${alt}"`).not.toMatch(/apex/i);
    // And the owner portrait must not name a real person it does not depict.
    expect(alt).not.toMatch(/travis/i);
  }
});
