import { test, expect } from '@playwright/test';

test('approved family hero uses the Apex night photograph and usable pool/contact links', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.home-hero');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(/Their favorite memories\s*start at home\./);
  await expect(hero.locator('.home-hero-copy > p:not(.eyebrow)')).toHaveText('Summer afternoons. One more swim before bedtime. A backyard that brings everyone together.');
  const image = hero.locator('img');
  await expect(image).toHaveAttribute('alt', /pool and spa at night.*Apex gallery/);
  await expect(image).toHaveAttribute('loading', 'eager');
  await expect(image).toHaveAttribute('fetchpriority', 'high');
  await expect(image).toHaveAttribute('width', '1200');
  await expect(image).toHaveAttribute('height', '1600');
  expect(await image.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(/\/images\/projects\/apexdpv1-(480|800|1200)\.webp$/);
  const pools = hero.getByRole('link', { name: /Explore designer pools/ });
  await expect(pools).toHaveAttribute('href', '/designer-pools');
  await expect(hero.getByRole('link', { name: /Call Apex/ })).toHaveAttribute('href', 'tel:+18066050502');
  await pools.focus();
  await expect(pools).toBeFocused();
  expect(await pools.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  // Normal builds retain inquiry functionality; the call-only flag is staging-specific.
  await expect(page.locator('#quote form')).toHaveCount(1);
});
