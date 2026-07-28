# Acceptance Criteria

Definition of done. Written as pass/fail assertions. A task is not complete until its criteria pass. Where a test framework exists, automate these; otherwise walk the manual checklist. Prefer Playwright for the browser assertions.

## AC-1 · Lead object completeness (the critical one)

- [ ] **AC-1.1** Submitting the form produces a JSON payload matching the schema in `data-contract.md` — every field present, correct types.
- [ ] **AC-1.2** `vertical` is never empty and is always one of the four exact enum strings.
- [ ] **AC-1.3** `lead_id` is unique across submissions and is generated exactly once per submit (not regenerated on retry).
- [ ] **AC-1.4** Visiting `/?utm_source=facebook&utm_medium=paid&utm_campaign=test123&fbclid=ABC` then submitting yields `source:"facebook"`, `medium:"paid"`, `campaign:"test123"`, `fbclid:"ABC"`.
- [ ] **AC-1.5** Landing on `/pools`, navigating to `/`, then submitting yields `landing_page:"/pools"` and `page_submitted:"/"` — first touch survives navigation.
- [ ] **AC-1.6** Direct visit (no utm, no referrer) yields `source:"direct"`, `medium:"none"`, not empty strings that break downstream.
- [ ] **AC-1.7** Payload posts to the env-var webhook. In non-production builds it targets the **test** webhook, never production. (Hard rule 6.)

## AC-2 · Vertical routing + selection

- [ ] **AC-2.1** The home router shows exactly four tiles, in enum order, each color-coded to its token.
- [ ] **AC-2.2** Clicking a vertical CTA (e.g. "Start my pool quote") pre-selects that vertical in the form.
- [ ] **AC-2.3** After a CTA pre-selects a vertical, the user can still change the selection, and the submitted `vertical` reflects their final choice.
- [ ] **AC-2.4** The four vertical name strings appear identically everywhere they're rendered (grep the build output — no "Renovation" where "Design & Renovation" belongs as a key).

## AC-3 · Consent correctness (TCPA)

- [ ] **AC-3.1** The consent disclosure names the brand of the **currently selected** vertical.
- [ ] **AC-3.2** Changing the selected vertical updates the consent brand name before submit.
- [ ] **AC-3.3** The exact consent string shown is captured in `consent_text` on the payload.
- [ ] **AC-3.4** A pool lead never submits consent naming "Concrete Coating" (the specific bug in the old site).

## AC-4 · Form resilience

- [ ] **AC-4.1** Webhook failure shows a clear error that tells the user what to do (call the phone number), not a silent failure or a raw stack trace.
- [ ] **AC-4.2** Success shows the confirmation/capture panel and the lead is not double-submitted on a second click.
- [ ] **AC-4.3** Email and phone are validated; phone is normalized to digits in the payload.

## AC-5 · Performance + SEO

- [ ] **AC-5.1** Lighthouse Performance ≥ 90 and SEO ≥ 95 on the home page, mobile. *(Not yet measured — needs a served build.)*
- [x] **AC-5.2** Each vertical page has a unique `<title>`, meta description, and OG tags. *(Verified against `dist/` — 5 pages, 5 distinct titles/descriptions/canonicals. `og:image` is intentionally absent until D-20 resolves; the card degrades to `summary`.)*
- [x] **AC-5.3** Exactly one `<h1>` per page; heading order is not skipped. *(Verified: `h1=1` on all 5 built pages.)*
- [x] **AC-5.4** `sitemap.xml` and `robots.txt` exist and reference the canonical domain. *(Both generated from `PUBLIC_SITE_URL`. Note the domain itself is still BLOCKED on D-03.)*
- [ ] **AC-5.5** `lead_submit` fires to GA4/GTM with `vertical` and `source` parameters on a real submit. *(Push is wired in QuoteForm and the dataLayer stub always renders; end-to-end confirmation needs a real container — gated on D-01.)*
- [x] **AC-5.6** A non-production build loads **no** tag container and serves `robots.txt` with `Disallow: /`. *(Verified both ways: default build has 0 `googletagmanager` references and disallows crawling; a `PUBLIC_ENV=production` build emits the GTM snippet, the `<noscript>` iframe, and `Allow: /` + the sitemap reference.)*

## AC-6 · Accessibility floor

- [ ] **AC-6.1** All interactive elements are keyboard reachable; focus is visible.
- [ ] **AC-6.2** Form inputs have associated labels; the service selector is operable by keyboard and screen reader.
- [ ] **AC-6.3** `prefers-reduced-motion` is respected (no animation when set).
- [ ] **AC-6.4** Color contrast meets WCAG AA for text.

## AC-8 · Vertical landing pages (Phase 4)

Added with the pages themselves — the PRD required per-vertical SEO and per-vertical ad landing, which a single-page site cannot provide.

- [x] **AC-8.1** A route exists at `/pools`, `/coating`, `/renovation`, `/service`, generated from `VERTICAL_LIST` — adding a vertical to the enum produces its page, sitemap entry, and schema without a second edit.
- [ ] **AC-8.2** Landing on a vertical page opens the quote form with **that** vertical already selected, before any click (AC-2.2), and the selection is still changeable (AC-2.3). *(Partially verified. Confirmed in a live dev server that `/coating` sets `window.__apexPreselect === "Concrete Coating"` in markup order **before** the island, which is the input QuoteForm reads on mount. The final hop — the mounted form reflecting it — could NOT be exercised: the preview browser pane runs with `document.visibilityState === "hidden"`, so the `client:visible` IntersectionObserver never fires and the island never hydrates. Verify manually in a real browser, or with the Playwright test below, before calling this done.)*
- [x] **AC-8.3** Each vertical page's visible FAQ and its `FAQPage` JSON-LD are generated from the same content object — they cannot drift apart.
- [x] **AC-8.4** Exactly one `LocalBusiness` node exists across the whole site (home page); vertical pages emit `Service` nodes that reference it by `@id`.
- [x] **AC-8.5** Every vertical page is reachable from the home page by a crawlable `<a href>` — router tile and, for the three shallow verticals, a "Details" link on the card.

## AC-7 · Migration safety (Phase 5, gated)

- [ ] **AC-7.1** Every URL from the old site maps to a new URL or an intentional 301. No orphaned rankings.
- [ ] **AC-7.2** The two legacy domains 301 to the canonical domain once D-03 is resolved.
- [ ] **AC-7.3** Access to domain/hosting/GTM/GA4/Meta is confirmed transferred (D-01) before DNS cutover.

## AC-9 · Imagery (D-20)

- [ ] **AC-9.1** Every image renders through a shared component with a defined aspect ratio — no layout shift when a real photo replaces a placeholder.
- [ ] **AC-9.2** Every image has meaningful `alt` text; decorative images are explicitly marked as such.
- [ ] **AC-9.3** Image sources come from a `content/` manifest, not hardcoded in components. Swapping in real photography is a content change only.
- [ ] **AC-9.4** Placeholders are visibly labeled (never silently blank), and a build-time check lists every unfilled slot so none ship by accident.
- [ ] **AC-9.5** Responsive `srcset` and lazy-loading below the fold; images do not regress AC-5.1 (Lighthouse ≥ 90).

---

### Test skeleton (Playwright) — starting point, not exhaustive

```ts
test('lead payload is complete and correctly tagged', async ({ page }) => {
  await page.goto('/?utm_source=facebook&utm_medium=paid&utm_campaign=test123&fbclid=ABC');
  await page.getByRole('button', { name: 'Concrete Coating' }).click();
  await page.fill('#email', 'a@b.com');
  await page.fill('#phone', '806-555-0142');
  const req = page.waitForRequest(r => r.url().includes(process.env.PUBLIC_LEAD_WEBHOOK_URL!));
  await page.getByRole('button', { name: /get my quote/i }).click();
  const body = JSON.parse((await req).postData()!);
  expect(body.vertical).toBe('Concrete Coating');
  expect(body.source).toBe('facebook');
  expect(body.campaign).toBe('test123');
  expect(body.consent_text).toContain('Apex Concrete Coating');
  expect(body.phone).toBe('8065550142');
  expect(body.lead_id).toBeTruthy();
});

// AC-8.2 — the check the preview pane cannot run (client:visible needs a visible viewport).
test('a vertical landing page opens with its own vertical pre-selected', async ({ page }) => {
  await page.goto('/coating');
  await page.getByRole('button', { name: 'Get my quote →' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Concrete Coating' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.consent')).toContainText('Apex Concrete Coating');
  // ...and it is still changeable (AC-2.3).
  await page.getByRole('button', { name: 'Pool Service' }).click();
  await expect(page.locator('.consent')).toContainText('Apex Pool Service');
});
```
