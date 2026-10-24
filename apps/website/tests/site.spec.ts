import { test, expect } from '@playwright/test';

const routes = ['/', '/designer-pools', '/concrete-coating', '/design-and-renovation', '/service', '/about-apex', '/work', '/contact', '/process', '/service-areas', '/privacy', '/terms', '/legacy-privacy', '/pools', '/coating', '/renovation'];
test('published and legacy routes render useful pages', async ({ page }) => {
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth > innerWidth,
      dimensions: { viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth },
      offenders: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1)
        .slice(0, 8)
        .map((el) => ({ tag: el.tagName, className: String(el.className).slice(0, 100), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right), width: Math.round(el.getBoundingClientRect().width), client: el.clientWidth, scroll: el.scrollWidth })),
    }));
    expect(overflow.page, `${route}: ${JSON.stringify(overflow)}`).toBe(false);
  }
});

test('division navigation works on mobile and menu closes with Escape', async ({ page, isMobile }) => {
  await page.goto('/');
  if (!isMobile) test.skip();
  const toggle = page.getByRole('button', { name: 'Menu' });
  await toggle.click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  const link = nav.getByRole('link', { name: 'Concrete Coating' });
  await expect(link).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(link).toBeHidden();
});

test('home and division imagery uses local project assets without stock or video embeds', async ({ page }) => {
  for (const route of ['/', '/designer-pools', '/concrete-coating', '/design-and-renovation', '/service']) {
    await page.goto(route);
    const imageSources = await page.locator('img, source').evaluateAll((imgs) => imgs.flatMap((el) => {
      const node = el as HTMLImageElement | HTMLSourceElement;
      const current = node instanceof HTMLImageElement ? node.currentSrc : node.src;
      return [current || node.src, ...node.srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0])].filter(Boolean);
    }));
    expect(imageSources.length, route).toBeGreaterThan(0);
    expect(imageSources.every((src) => new URL(src, page.url()).origin === new URL(page.url()).origin), route).toBe(true);
    expect(imageSources.join(' '), route).not.toMatch(/stock|pexels|unsplash/i);
    await expect(page.locator('video, iframe[src*="youtube"], iframe[src*="vimeo"]')).toHaveCount(0);
  }
});

test('pool service remains a distinct supporting route', async ({ page }) => {
  await page.goto('/service');
  await expect(page.locator('h1')).toContainText(/pool/i);
  await expect(page.getByRole('link', { name: /quote|contact/i }).first()).toBeVisible();
});
