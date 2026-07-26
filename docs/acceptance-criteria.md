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

- [ ] **AC-5.1** Lighthouse Performance ≥ 90 and SEO ≥ 95 on the home page, mobile.
- [ ] **AC-5.2** Each vertical page has a unique `<title>`, meta description, and OG tags.
- [ ] **AC-5.3** Exactly one `<h1>` per page; heading order is not skipped.
- [ ] **AC-5.4** `sitemap.xml` and `robots.txt` exist and reference the canonical domain.
- [ ] **AC-5.5** `lead_submit` fires to GA4/GTM with `vertical` and `source` parameters on a real submit.

## AC-6 · Accessibility floor

- [ ] **AC-6.1** All interactive elements are keyboard reachable; focus is visible.
- [ ] **AC-6.2** Form inputs have associated labels; the service selector is operable by keyboard and screen reader.
- [ ] **AC-6.3** `prefers-reduced-motion` is respected (no animation when set).
- [ ] **AC-6.4** Color contrast meets WCAG AA for text.

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
```
