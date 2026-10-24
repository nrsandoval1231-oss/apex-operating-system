# Apex Website 2.0

Mobile-first construction website for Apex in Lubbock, Texas. The home page introduces the three primary divisions—Designer Pools, Concrete Coating, and Design & Renovation—using the official Apex logo and owner-provided project photography. Pool Service remains available as a supporting service page.

## Routes

- `/` — home, featured and recent work, division links, process, exact customer quotes, and project request form.
- `/designer-pools`, `/concrete-coating`, `/design-and-renovation` — primary division pages with service details, FAQ, five-step process, project gallery, and a preselected quote form.
- `/pools`, `/coating`, `/renovation` — compatibility paths for the primary divisions.
- `/service`, `/work`, `/about-apex`, `/contact`, `/process`, `/service-areas` — supporting pages.
- `/privacy`, `/terms` — current legal text transcribed from the 2026-10-24 source crawl. `/legacy-privacy` preserves the earlier policy.

All pages in non-production builds are noindexed. Published service-area copy is limited to Lubbock. Marketing pages use the self-hosted Barlow and Bebas Neue font families and authentic locally stored images.

## Project requests

The React island collects the division, project details, contact information, and optional SMS consent in three steps. It posts the existing LeadPayload plus `schema_version: 2`, `project`, `website` honeypot, and `consent_version: website-2-20261024` to the build-time endpoint. Only a persisted acknowledgement matching the submitted website lead ID and containing the canonical OS lead ID confirms success. HTTP 400/422 responses permit editing and a new ID; timeouts, network failures, server errors, conflicts, and unknown acknowledgements preserve the same payload and ID for retry. Keep the form page open during an uncertain retry; after reload, call Apex before submitting again.

Preview builds show “Website preview — use test details only.” A missing endpoint leaves the form in a clear call-us fallback state; it is never treated as success.

## Source and media

`docs/rebuild-20261024/` contains the dated source crawl and image inventory. `src/content/testimonials.ts` holds the eight exact source testimonials and attributions, with no invented ratings or project locations. `public/images/projects/` contains the supplied optimized project images and JPEG fallbacks.

## Local checks

From `apps/website`:

```sh
npm run check
npm run build
npm run validate
npm run test
npm run test:production
npm run test:unit
npm run redirects:generate
```

`npm run preflight` checks the built output. For preview use `PUBLIC_ENV=preview` and `PUBLIC_LEAD_WEBHOOK_URL_TEST`; production requires `PUBLIC_ENV=production` and `PUBLIC_LEAD_WEBHOOK_URL`. Browser tests intercept the endpoint and never write real leads. Redirect files are generated into `build/redirects/`; copy only the target-host file as part of the separately authorized staging/release process.
