import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const astro = readFileSync(path.join(process.cwd(), 'src/components/HeroVideo.astro'), 'utf8');
const controller = astro.match(/<script is:inline>\s*([\s\S]*?)\s*<\/script>/)?.[1];
if (!controller) throw new Error('HeroVideo inline controller was not found');

type Options = { mobile?: boolean; reduced?: boolean; saveData?: boolean; type?: string; noMobile?: boolean; reject?: boolean };
async function fixture(page: Page, options: Options = {}) {
  const { mobile = false, reduced = false, saveData = false, type = '4g', noMobile = false, reject = false } = options;
  await page.setContent(`<style>[hidden]{display:none!important}.hero-video-poster{display:block;width:10px;height:10px}</style><div class="hero-media"><picture class="hero-video-poster"><img src="/poster.jpg" alt=""></picture><video class="hero-video" autoplay muted loop playsinline preload="none" hidden data-video-master="/hero-video-runtime.mp4" data-video-webm="/hero-video-runtime.webm" ${noMobile ? '' : 'data-video-mobile="/hero-video-mobile.mp4"'}></video><button class="hero-video-toggle" type="button" aria-label="Pause background video" aria-pressed="false"><span class="hero-video-toggle-icon">Ⅱ</span><span class="hero-video-toggle-label">Pause motion</span></button></div>`);
  await page.evaluate(({ mobile, reduced, saveData, type, reject }) => {
    type Listener = (event: Event) => void;
    const state = { mobile, reduced, saveData, type, reject };
    const listeners = new Map<string, Set<Listener>>();
    const connectionListeners = new Set<Listener>();
    window.matchMedia = ((query: string) => ({
      media: query, get matches() { return query.includes('max-width') ? state.mobile : state.reduced; }, onchange: null,
      addEventListener: (_: string, listener: Listener) => { const key = `m:${query}`; if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)?.add(listener); },
      removeEventListener: (_: string, listener: Listener) => listeners.get(`m:${query}`)?.delete(listener),
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => true,
    })) as typeof window.matchMedia;
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { get saveData() { return state.saveData; }, get effectiveType() { return state.type; }, addEventListener: (_: string, fn: Listener) => connectionListeners.add(fn) } });
    const video = document.querySelector('.hero-video') as HTMLVideoElement;
    let paused = true;
    Object.defineProperty(video, 'paused', { configurable: true, get: () => paused });
    video.load = () => undefined;
    video.pause = () => { paused = true; video.dispatchEvent(new Event('pause')); };
    video.play = () => { if (state.reject) return Promise.reject(new DOMException('blocked', 'NotAllowedError')); paused = false; video.dispatchEvent(new Event('playing')); return Promise.resolve(); };
    (window as unknown as { __hero: { change(next: Partial<typeof state>): void } }).__hero = { change(next) { Object.assign(state, next); listeners.forEach((set) => set.forEach((fn) => fn(new Event('change')))); connectionListeners.forEach((fn) => fn(new Event('change'))); } };
  }, { mobile, reduced, saveData, type, reject });
  await page.addScriptTag({ content: controller });
}

test.describe('HeroVideo production controller', () => {
  test('autoplays the master and provides an accessible pause and resume control', async ({ page }) => {
    await fixture(page);
    const video = page.locator('.hero-video');
    const toggle = page.locator('.hero-video-toggle');
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video.locator('source')).toHaveCount(2);
    await expect(toggle).toHaveAttribute('aria-label', 'Pause background video');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Play background video');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('does not load video for reduced motion, save-data, or slow networks', async ({ page }) => {
    for (const options of [{ reduced: true }, { saveData: true }, { type: 'slow-2g' }, { type: '2g' }]) {
      await fixture(page, options);
      await expect(page.locator('.hero-video source')).toHaveCount(0);
      await expect(page.locator('.hero-video-toggle')).toBeHidden();
    }
  });

  test('uses mobile media only when it is supplied, and preserves the poster when playback fails', async ({ page }) => {
    await fixture(page, { mobile: true });
    await expect(page.locator('.hero-video source')).toHaveAttribute('src', '/hero-video-mobile.mp4');
    await fixture(page, { mobile: true, noMobile: true });
    await expect(page.locator('.hero-video source')).toHaveCount(0);
    await fixture(page, { reject: true });
    await expect(page.locator('.hero-video')).toBeHidden();
    await expect(page.locator('.hero-video-poster')).toBeVisible();
  });
});

test('the native MP4 fixture is playable by Chromium', async ({ page }) => {
  await page.route('**/hero-video-runtime.mp4', (route) =>
    route.fulfill({ path: path.join(process.cwd(), 'tests/fixtures/hero-video-runtime.mp4') }),
  );
  await page.setContent('<video id="fixture" muted loop playsinline src="http://localhost:4329/hero-video-runtime.mp4"></video>');
  await page.locator('#fixture').evaluate(async (element) => {
    await (element as HTMLVideoElement).play();
  });
  await expect(page.locator('#fixture')).toHaveJSProperty('paused', false);
});
