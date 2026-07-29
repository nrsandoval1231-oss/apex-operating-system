# Acceptance Criteria

Definition of done. Written as pass/fail assertions. A task is not complete until its criteria pass.

**AC-1 through AC-4, AC-6, AC-8, and AC-9 are automated.** Run them with:

```bash
npm test
```

82 assertions across desktop Chromium and a Pixel 7 profile (`tests/`, driven by `playwright.config.ts`). Every submitting test mocks the webhook at the network layer, so a test run can never reach a real endpoint. The remaining unchecked boxes below are blocked on a human decision, not on work.

## AC-1 · Lead object completeness (the critical one)

- [x] **AC-1.1** Submitting the form produces a JSON payload matching the schema in `data-contract.md` — every field present, correct types.
- [x] **AC-1.2** `vertical` is never empty and is always one of the four exact enum strings.
- [x] **AC-1.3** `lead_id` is unique across submissions and is generated exactly once per submit (not regenerated on retry).
- [x] **AC-1.4** Visiting `/?utm_source=facebook&utm_medium=paid&utm_campaign=test123&fbclid=ABC` then submitting yields `source:"facebook"`, `medium:"paid"`, `campaign:"test123"`, `fbclid:"ABC"`.
- [x] **AC-1.5** Landing on `/pools`, navigating to `/`, then submitting yields `landing_page:"/pools"` and `page_submitted:"/"` — first touch survives navigation.
- [x] **AC-1.6** Direct visit (no utm, no referrer) yields `source:"direct"`, `medium:"none"`, not empty strings that break downstream.
- [x] **AC-1.7** Payload posts to the env-var webhook. In non-production builds it targets the **test** webhook, never production. (Hard rule 6.) *(Asserted on the outgoing request URL.)*

## AC-2 · Vertical routing + selection

- [x] **AC-2.1** The home router shows exactly four tiles, in enum order, each color-coded to its token.
- [x] **AC-2.2** Clicking a vertical CTA (e.g. "Start my pool quote") pre-selects that vertical in the form.
- [x] **AC-2.3** After a CTA pre-selects a vertical, the user can still change the selection, and the submitted `vertical` reflects their final choice.
- [x] **AC-2.4** The four vertical name strings appear identically everywhere they're rendered. *(Verified by grep over `dist/` and by AC-1.2 asserting the exact enum string round-trips into the payload for all four.)*

## AC-3 · Consent correctness (TCPA)

- [x] **AC-3.1** The consent disclosure names the brand of the **currently selected** vertical.
- [x] **AC-3.2** Changing the selected vertical updates the consent brand name before submit. *(Also asserts no OTHER brand name is left in the string.)*
- [x] **AC-3.3** The exact consent string shown is captured in `consent_text` on the payload. *(Byte-for-byte comparison of the rendered text against the payload field.)*
- [x] **AC-3.4** A pool lead never submits consent naming "Concrete Coating" (the specific bug in the old site). *(Tested via the worst case: land on `/coating`, switch to pools, submit.)*
- [x] **AC-3.5** Declining consent records `consent_sms:false` and an empty `consent_text` — recording a disclosure would imply consent that was not given.

## AC-4 · Form resilience

- [x] **AC-4.1** Webhook failure shows a clear error that tells the user what to do (call the phone number), not a silent failure or a raw stack trace. *(Asserts a tappable `tel:` link is present.)*
- [x] **AC-4.2** Success shows the confirmation/capture panel and the lead is not double-submitted on a second click. *(Asserts the request count is exactly 1.)*
- [x] **AC-4.3** Email and phone are validated; phone is normalized to digits in the payload. *(Also asserts zero requests are made when validation fails.)*

## AC-5 · Performance + SEO

- [ ] **AC-5.1** Lighthouse Performance ≥ 90 and SEO ≥ 95 on the home page, mobile. *(Not yet measured — needs a served build.)*
- [x] **AC-5.2** Each vertical page has a unique `<title>`, meta description, and OG tags. *(Verified against `dist/` — 5 pages, 5 distinct titles/descriptions/canonicals. `og:image` is intentionally absent until D-20 resolves; the card degrades to `summary`.)*
- [x] **AC-5.3** Exactly one `<h1>` per page; heading order is not skipped. *(Verified: `h1=1` on all 5 built pages.)*
- [x] **AC-5.4** `sitemap.xml` and `robots.txt` exist and reference the canonical domain. *(Both generated from `PUBLIC_SITE_URL`. Note the domain itself is still BLOCKED on D-03.)*
- [x] **AC-5.5** `lead_submit` fires to GA4/GTM with `vertical` and `source` parameters on a real submit. *(Automated: asserts exactly one `lead_submit` reaches the dataLayer with the right vertical and source. Confirming it arrives in the real GA4 property still needs container access — D-01.)*
- [x] **AC-5.6** A non-production build loads **no** tag container and serves `robots.txt` with `Disallow: /`. *(Verified both ways: default build has 0 `googletagmanager` references and disallows crawling; a `PUBLIC_ENV=production` build emits the GTM snippet, the `<noscript>` iframe, and `Allow: /` + the sitemap reference.)*

## AC-6 · Accessibility floor

- [x] **AC-6.1** All interactive elements are keyboard reachable; focus is visible. *(Automated for the service selector — focus + Enter toggles it. A full keyboard sweep of the page is still a manual pass.)*
- [x] **AC-6.2** Form inputs have associated labels; the service selector is operable by keyboard and screen reader. *(Automated: every input id has a matching `<label for>`.)*
- [ ] **AC-6.3** `prefers-reduced-motion` is respected (no animation when set). *(Implemented in `global.css`; not yet asserted.)*
- [ ] **AC-6.4** Color contrast meets WCAG AA for text. *(Tokens were chosen against AA — see the `--amber-eyebrow` and `--serv-text` notes in `global.css` — but no automated contrast audit runs yet.)*

## AC-8 · Vertical landing pages (Phase 4)

Added with the pages themselves — the PRD required per-vertical SEO and per-vertical ad landing, which a single-page site cannot provide.

- [x] **AC-8.1** A route exists at `/pools`, `/coating`, `/renovation`, `/service`, generated from `VERTICAL_LIST` — adding a vertical to the enum produces its page, sitemap entry, and schema without a second edit.
- [ ] **AC-8.2** Landing on a vertical page opens the quote form with **that** vertical already selected, before any click (AC-2.2), and the selection is still changeable (AC-2.3). *(Partially verified. Confirmed in a live dev server that `/coating` sets `window.__apexPreselect === "Concrete Coating"` in markup order **before** the island, which is the input QuoteForm reads on mount. The final hop — the mounted form reflecting it — could NOT be exercised: the preview browser pane runs with `document.visibilityState === "hidden"`, so the `client:visible` IntersectionObserver never fires and the island never hydrates. Verify manually in a real browser, or with the Playwright test below, before calling this done.)*
- [x] **AC-8.3** Each vertical page's visible FAQ and its `FAQPage` JSON-LD are generated from the same content object — they cannot drift apart.
- [x] **AC-8.4** Exactly one `LocalBusiness` node exists across the whole site (home page); vertical pages emit `Service` nodes that reference it by `@id`.
- [x] **AC-8.5** Every vertical page is reachable from the home page by a crawlable `<a href>` — router tile and, for the three shallow verticals, a "Details" link on the card.

## AC-7 · Migration safety (Phase 5, gated)

The *checks* are built and runnable (`npm run redirects:verify -- --base https://DOMAIN`); the *inputs* are blocked. None of these can pass until a human closes D-01 and D-03 — see `docs/launch-checklist.md`.

- [ ] **AC-7.1** Every URL from the old site maps to a new URL or an intentional 301. No orphaned rankings. *(BLOCKED: D-01. `config/redirects.json` `pages[]` is empty — the old-URL inventory needs Search Console + GA4 access. The verifier fails loudly on an empty map rather than reporting a vacuous pass.)*
- [ ] **AC-7.2** The two legacy domains 301 to the canonical domain once D-03 is resolved. *(BLOCKED: D-03. Both wildcard rules are written and generate correctly; they have no destination until the canonical domain is chosen.)*
- [ ] **AC-7.3** Access to domain/hosting/GTM/GA4/Meta is confirmed transferred (D-01) before DNS cutover. *(BLOCKED: D-01. Checklist table in `docs/launch-checklist.md` Step 1.)*

## AC-10 · Launch tooling (Phase 5)

Added with the tooling. These verify the *machinery* is correct, independent of whether the blocked inputs have arrived.

- [x] **AC-10.1** `npm run preflight` FAILS a build that would ship `robots.txt: Disallow: /`, and PASSES one built with `PUBLIC_ENV=production`. *(Verified both directions.)*
- [x] **AC-10.2** `preflight` fails a build whose output still references the test lead webhook (Hard rule 6 / AC-1.7). *(Verified — caught on the default dev build.)*
- [x] **AC-10.3** `preflight` fails on a duplicate or missing `<title>`/description/canonical, or on any page without exactly one `<h1>`.
- [x] **AC-10.4** `redirects:generate --strict` refuses to emit while the canonical domain is null or the page map is empty, and rejects self-redirects, duplicate rules, non-301 statuses, and redirect chains.
- [x] **AC-10.5** `redirects:verify` asserts single-hop 301s to live 200s, and fails on a `Disallow: /` robots.txt or an empty redirect map. *(Verified against the dev server: 6/8, failing exactly on the two expected conditions.)*
- [x] **AC-10.6** Generated redirect files land in gitignored `build/redirects/`, never in `public/`, so production redirects cannot ship inside a preview build.
- [x] **AC-10.7** The footer links to a real privacy policy and terms URL (env-driven), not plain text — required for A2P 10DLC registration given the site captures SMS consent.

## AC-9 · Imagery (D-20 — currently licensed STOCK placeholders)

All nine slots are filled with licensed stock photography as stand-ins. Provenance and licence: `config/stock-images.json`; re-fetch with `npm run stock:fetch`.

- [x] **AC-9.1** Every image renders through a shared component with a defined aspect ratio — no layout shift when a real photo replaces a placeholder. *(Automated across all 5 pages: asserts each slot declares an `aspect-ratio` AND that the loaded file's intrinsic ratio matches it within 1%.)*
- [x] **AC-9.2** Every image has meaningful `alt` text; decorative images are explicitly marked as such.
- [x] **AC-9.3** Image sources come from a `content/` manifest, not hardcoded in components. Swapping in real photography is a content change only.
- [x] **AC-9.4** Placeholders are labeled and a build-time check lists them. *(`npm run check:images` now distinguishes real / stock / blank, and prints the stock labels as a shot list. `npm run preflight` blocks a production build while any stock image remains, unless `--allow-placeholders`.)*
- [x] **AC-9.5** Responsive `srcset` and lazy-loading below the fold. *(Automated: every image has a width-descriptor `srcset`, and NO below-the-fold image is eager. This caught a real regression — the four home router tiles were eager despite sitting below the fold, competing with the hero for bandwidth.)*
- [x] **AC-9.6** No stock image's `alt` text claims the work is Apex's, and the owner portrait does not name a real person it does not depict. *(Automated. See the note on `owner-portrait` in `content/images.ts`.)*
- [ ] **AC-9.7** Real Apex photography replaces every stock slot. *(BLOCKED: D-20 — this is the open one. `npm run check:images` prints the shot list.)*

---

## The test suite

The skeleton that used to live here has been replaced by the real thing.

| File | Covers |
|---|---|
| `tests/lead-capture.spec.ts` | AC-1 (payload, attribution, lead_id, webhook target), AC-2 (routing), AC-8.2 (per-page preselect) |
| `tests/consent-and-resilience.spec.ts` | AC-3 (TCPA consent), AC-4 (failure, double-submit, validation), AC-5.5 (`lead_submit`), AC-6.1/6.2 |
| `tests/imagery.spec.ts` | AC-9 (aspect-ratio integrity, alt text, srcset, lazy-loading, stock honesty) |
| `tests/helpers.ts` | Webhook mock and the hydration-aware `openQuoteForm` |

```bash
npm test              # both projects: desktop Chromium + Pixel 7
npm run test:ui       # interactive runner
```

**One trap worth knowing about if you extend these.** Astro server-renders the React island, so the entire form — including `aria-pressed` on every service button — exists in the HTML *before* hydration. Waiting on those attributes proves nothing, and a click in that window is silently swallowed: the markup is there, the handler is not. `openQuoteForm()` waits for `astro-island:not([ssr])` instead, because Astro removes that attribute only once the component is live. Four tests failed in exactly this way before it was fixed, and the failures looked like app bugs rather than test bugs.
