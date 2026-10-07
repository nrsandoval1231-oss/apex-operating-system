/**
 * homepage-v2.spec.ts — the Homepage V2 acceptance bar, as executable assertions.
 *
 * The brief's acceptance list is qualitative ("the complete homepage composition looks
 * premium"), and a spec cannot judge taste. What it CAN do is pin the load-bearing structural
 * promises that the premium look is built on, so a future change can't quietly trade them away:
 *
 *   · all four verticals remain reachable from the home page
 *   · the seven sections exist, in narrative order
 *   · the hero media interface is a single element with a declared mode
 *   · nothing overflows horizontally at any of the three target widths
 *   · the hero is the LCP candidate and everything else is lazy
 *   · no client JS is shipped for the page's visual system
 *
 * The last one is a real constraint, not an aesthetic preference: this is an Astro site that
 * deliberately ships zero client JavaScript outside the quote form, and Homepage V2 is not
 * allowed to quietly introduce an animation runtime.
 */
import { test, expect } from '@playwright/test';

const SECTIONS = ['#top', '#craft', '#work', '#living', '#standard', '#capabilities', '#close'];

test.describe('Homepage V2 · structure', () => {
  test('the seven narrative sections render, in order', async ({ page }) => {
    await page.goto('/');

    for (const sel of SECTIONS) {
      await expect(page.locator(sel), `missing V2 section ${sel}`).toHaveCount(1);
    }

    // Order is the narrative: DESIRE → EMOTION → CRAFTSMANSHIP → PROOF → TRUST → CAPABILITY
    // → CONVERSION. Sections can be restyled freely; they cannot be reordered.
    const order = await page.evaluate((sels) =>
      sels.map((s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY),
    SECTIONS);
    const sorted = [...order].sort((a, b) => a - b);
    expect(order, 'V2 sections are out of narrative order').toEqual(sorted);
  });

  test('exactly one h1, and it is the hero promise', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toHaveCount(1);
    const h1 = page.locator('main h1');
    await expect(h1).toContainText(/built for the moments/i);
  });

  test('all four verticals stay reachable from the home page', async ({ page }) => {
    await page.goto('/');

    /*
     * The specific regression Homepage V2 could have caused. The old four-tile router was the
     * only set of links from the home page to /coating, /renovation and /service; removing it
     * in favour of a brand-led pools narrative would have orphaned three live verticals. The
     * replacement is the capability index — this asserts reachability, not its styling, so a
     * future redesign of that section can keep the same links.
     */
    for (const slug of ['pools', 'coating', 'renovation', 'service']) {
      const link = page.locator(`main a[href="/${slug}"]`).first();
      await expect(link, `/${slug} is not reachable from the home page`).toHaveCount(1);
    }
  });

  test('each vertical keeps a preselect link into the quote form (AC-2.2)', async ({ page }) => {
    await page.goto('/');
    // One data-preselect CTA per vertical — the contract the retired router tiles carried.
    const preselects = page.locator('main a[data-preselect]');
    await expect(preselects).toHaveCount(4);
  });
});

test.describe('Homepage V2 · hero media interface', () => {
  test('the hero background is a single media element in the declared mode', async ({ page }) => {
    await page.goto('/');

    /*
     * The architectural promise: poster, playback and scrub are three states of ONE element.
     * If a future change adds a second stacked media layer, or swaps the poster for a <video>
     * without going through the mode contract, this fails — which is the point. The mode is
     * rendered as data-hero-mode so a test (and a human) can tell which state shipped.
     */
    const media = page.locator('.hero-media');
    await expect(media).toHaveCount(1);
    await expect(media).toHaveAttribute('data-hero-mode', 'poster');

    // In poster mode there must be no <video> at all.
    await expect(page.locator('.hero-media video')).toHaveCount(0);

    const img = page.locator('.hero-media img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('loading', 'eager');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  test('the hero poster is a real, loaded image with alt text', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('.hero-media img');
    await expect.poll(
      () => img.evaluate((el: HTMLImageElement) => el.naturalWidth),
      { timeout: 10_000 },
    ).toBeGreaterThan(0);

    const alt = (await img.getAttribute('alt')) ?? '';
    expect(alt.length, 'hero poster has no alt text').toBeGreaterThan(10);
    // D-20: a stock photo must never be described as Apex's work (see imagery.spec.ts).
    expect(alt).not.toMatch(/apex/i);
  });
});

test.describe('Homepage V2 · responsive', () => {
  const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of VIEWPORTS) {
    test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Allow 1px for sub-pixel rounding, which browsers and the full-bleed calc() can both
      // produce without the page actually scrolling sideways.
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(
        overflow.scrollW - overflow.clientW,
        `horizontal overflow at ${vp.name}: content is ${overflow.scrollW}px in a ${overflow.clientW}px viewport`,
      ).toBeLessThanOrEqual(1);

      // And prove it in the way a user would experience it.
      const canScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(canScroll, `page scrolls horizontally at ${vp.name}`).toBe(false);
    });
  }

  test('the hero fills the viewport without overflowing it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const hero = page.locator('.hero');
    const box = (await hero.boundingBox())!;
    // At least a full screen tall, and never taller than the viewport by more than a hair —
    // the svh fix in Hero.astro is specifically about this.
    expect(box.height).toBeGreaterThanOrEqual(800);
    expect(box.height).toBeLessThanOrEqual(845);
  });
});

test.describe('Homepage V2 · performance posture', () => {
  test('the visual system ships no client JavaScript', async ({ page }) => {
    /*
     * "Do not add heavyweight animation libraries unless clearly justified by functionality we
     * are actually using." The enforceable version of that: the only script bundles on the home
     * page are the ones the site already had (attribution capture, analytics, and the quote
     * form island). If a future PR adds GSAP, Lenis, or a scroll library to drive the hero, this
     * fails and the PR has to justify it here.
     *
     * Dev-server entries are excluded because `astro dev` serves every component's CSS as an
     * injected <script src> for HMR, and serves component <script> blocks as module URLs. Those
     * are not extra client JavaScript — they are the same stylesheets and the same two
     * pre-existing scripts the production build emits. The authoritative check for what actually
     * ships is the production bundle, and `pnpm validate` asserts on dist/ directly, which is
     * where a real regression would surface.
     */
    await page.goto('/');
    const sources = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')]
        .map((el) => (el as HTMLScriptElement).src)
        // Stylesheets delivered as scripts by the dev server.
        .filter((src) => !/\.css($|\?)|type=style/.test(src))
        // The dev server's HMR plumbing.
        .filter((src) => !/\/@vite\/|\/@fs\/|\/@id\//.test(src)),
    );
    // The only permitted bundles: the lead-capture island, measurement, and the two
    // pre-existing inline scripts BaseLayout (attribution) and QuoteSection (preselect wiring).
    const unexpected = sources.filter(
      (src) =>
        !/QuoteForm|analytics|attribution|googletagmanager|BaseLayout|QuoteSection/i.test(src),
    );
    expect(unexpected, `unexpected client JS on the home page: ${unexpected.join(', ')}`).toEqual([]);
  });

  test('every non-hero image is lazy', async ({ page }) => {
    await page.goto('/');
    const eager = await page.evaluate(() =>
      [...document.querySelectorAll('.img-slot img')]
        .filter((el) => el.getAttribute('loading') !== 'lazy')
        .map((el) => (el as HTMLImageElement).currentSrc || el.getAttribute('src')),
    );
    expect(eager, 'only the hero may be eager — it is the LCP candidate').toEqual([]);
  });
});
