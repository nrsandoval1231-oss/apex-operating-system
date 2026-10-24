# Website 2.0 discovery and provenance

Observed 2026-10-24. Dedicated branch `codex/apex-website-2-20261024`, base `f4421197de580028bfe53f9c7d50776b20a6a52b`. Repository `nrsandoval1231-oss/apex-operating-system`. Canonical checkout resolved from the non-Git outer Apex folder; clean new worktree. `origin/main` fetched before branching. Open PR32 `codex/apex-2-foundation` is ongoing OS work and excluded. Older standalone `07_Code/apex-website` has dirty presentation work and was read only. Existing worktrees and production preserved.

## Current application and baseline

Astro7 static site with one React quote island and existing Playwright infrastructure. pnpm11.18.0, Node24.21.0. Frozen-lockfile install passed. Before edits, `pnpm --filter apex-website exec astro check` returned zero errors/warnings, two deprecated FormEvent hints; `astro build` passed (7 HTML pages plus robots/sitemap). No framework replacement needed. Existing monorepo CI is scripts/ci.ps1 -> Git Bash scripts/ci.sh, not GitHub Actions; this task does not create automatic production deployments.

Current quote implementation posts to configured n8n/Airtable workflow `workflows/lead-engine/workflows/01-intake.ts`. This does **not** demonstrate APEX OS lead persistence. Existing OS staff intake is authenticated `POST /api/projects/intake` with a different contract. A narrow additive `POST /api/public/v1/leads` is implemented on the existing gate API to persist into its existing `leads` table. No duplicate database, CRM, migration, staff workflow, or production integration is introduced. The website ID stays the external source identity; the OS ID stays canonical `lead_…`.

## Source collection

Firecrawl map id `01a16cc0-05a1-7239-a346-ce93bbeb7252`; completed crawl id `01a16cc1-2864-7679-81cc-cc2a95d278eb`, 9 source records, plus a separate scrape of legacy privacy. `source-crawl.json` preserves full retrieved markdown, metadata, links, source URLs and fetch dates. `source-home.json` independently preserves the homepage and forms. `source-legacy-privacy.json` preserves the old policy. Actual source domain is https://apexgetsitdone.com/; no forms were submitted there.

Public routes discovered: homepage; `/concrete-coating/`; `/designer-pools/`; `/design-and-renovation/`; `/about-apex/`; `/apex-designer-pools-landing-page/`; `/apex-privacy-policy/`; `/terms-and-conditions/`; `/privacy-policy-apex-designer-pools/`; sitemap. The map also exposed `/privacy-policy/` via the historical repository redirect inventory. Existing `/pools`, `/coating`, `/renovation`, `/service`, `/privacy`, `/terms` remain compatibility routes. Reconcile with Search Console before cutover for unlinked indexed URLs that a site crawl cannot reveal.

## Media and brand

`asset-inventory.json` records 44 unique discoverable image URLs from crawl markdown, source pages, dimensions, original byte count and SHA256; duplicate thumbnail variants remain explicitly marked. All 44 originals (4,782,296 bytes total) are retained in `originals/`; the same legacy media paths are served under public/snapshot/media/uploads. 18 full-size project-image candidates have 54 responsive WebP variants, plus JPEG fallbacks; no source was upscaled. The source inventory is bounded to discoverable page image links, not an assertion of complete access to the former CMS media library.

Visual inspection: contact-sheet.png shows five pool images, coated porch, renovated double-vanity bathroom, and a matching garage before/after pair. Descriptions identify only visible work. No customer names, addresses, project locations, completion dates or counts inferred. Gallery publication on APEX's own source is the provenance evidence; independent job records are not available.

Exact source logo `Apex-Site-Logo-2x.png`,801×191,SHA256 `421e7a063b78adb7f47c69fce6d17e5c9f5186360060cf04e0c3fbdefb1688bb`, visually verified as geometric lion and angular APEX lettering. This byte-identical original is public/images/brand/apex-logo.png. Lossless WebP and favicon crops derive mechanically from it; no redraw, recolor or generative editing. The previous repository PNG differed in bytes. Original wins.

## Claims and authority

Current source verifies phone806-605-0502, email travis@apexgetsitdone.com, Lubbock focus, founder Travis Bouffard, named construction/coating/pool/maintenance services, original testimonials and Lyon dealer link. Source testimonials are preserved with original wording and attribution, without invented ratings. Source offers (`$500 off`, `first month free`) and numerical warranty/response guarantees are archived, not treated as verified current commercial terms. No financing terms or estimator formula inferred. Nearby-city lists in old code are not business verification: only Lubbock published until owner confirms coverage.

The checked-in reference/apex-mockup.html is an older amber/Oswald demo with a synthetic lion. It is not the latest Website2.0 authority. No new approved image was attached to this task or found in the scoped files/Downloads. User asked asynchronously for its location; textual master directive supplies implementation direction in the interim. Exact mockup fidelity remains an owner-verification gate and cannot be claimed from the textual brief alone.

## Deployment boundaries

Dedicated new Cloudflare Pages project `apex-website-2-review`; existing OS/website staging projects unchanged. Review-only local persisted PGlite uses canonical OS migrations and public-handler code, exposed through a temporary Cloudflare tunnel; it has no production credentials, staff UI or receipt-read HTTP endpoint. Only synthetic acceptance data permitted. This proves isolated persistence, not durable managed-host deployment. Production Access bypass, approved origins, distributed abuse protection, managed OS database integration and cutover approval remain separate release gates.
