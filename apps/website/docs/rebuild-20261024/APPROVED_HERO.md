# Owner-approved homepage hero — October 25, 2026

The owner approved the evening pool photograph and the family-focused copy, then explicitly requested “Love it! Save this in the repo” at 01:58 UTC. This note records approval of this homepage hero/photo/copy only; it does not freeze other design decisions or authorize a main merge, production cutover or OS changes. Future owner-directed revisions remain possible.

## Approved content

Headline: **Their favorite memories start at home.**

Supporting copy: **Summer afternoons. One more swim before bedtime. A backyard that brings everyone together.**

Retain the APEX logo/sage branding, concise Lubbock/pools/outdoor-living identifier, pool-route CTA and phone contact. Evening composition, responsive crops and quieter Barlow typography are implemented only in the homepage hero. Other rendered pages were byte-identical at the preview release.

## Existing authentic asset and provenance

`public/snapshot/media/uploads/2024/09/ApexDPv1.jpg` is the existing APEX source-gallery photograph (pool/spa, tiled water wall and fire bowls),1200×1600,152123bytes. Source-publication references and original SHA256 `fc45350c950570d4e4f1473e49ff3e441d80bfee24f94e95008ebb314c1390e4` are recorded in [asset-inventory.json](asset-inventory.json), referencing apexgetsitdone.com and its designer-pools gallery. No new generated/stock/paid media or invented project/client/location was added.

The homepage-only manifest slot `home-night-pool-hero` reuses tracked480/800/1200WebP derivatives, accurate alt text and3:4 intrinsic dimensions. Largest WebP74414bytes versus prior hero167996bytes. No new font, motion or client dependency. This byte comparison is not a field performance claim.

## Saved source versus preview configuration

Approved live source: `7b464b0ae0beb6938da667b141243784f380e86f`, after photo/design source `9620a60c2c43f9e727c13f47a9d6ffc91a106923`. Preview: https://website2-preview.apex-website-2-review.pages.dev ; immutable approved release: https://a7f0eef6.apex-website-2-review.pages.dev . Documentation/test commits save this approval without redeploying it.

Call-only behavior is an explicit opt-in: `PUBLIC_PREVIEW_INTAKE_DISABLED=1` requires `PUBLIC_ENV=staging` and both inquiry endpoints unset. Normal builds still render the inquiry form; production still requires its verified endpoint and refuses call-only mode. See [CALL_ONLY_PREVIEW.md](CALL_ONLY_PREVIEW.md). Preview noindex remains; this does not disable intended production functionality or configure public ingress.

## Validation boundaries

Base main `9ae9686` passed full **local** CI1324cases/3disclosed skips. Hero design passed49website browser cases/1expected skip; final family copy passed7focused site regressions/1expected skip and local/live checks at1440/390/320px for exact text, wrapping, contrast, nooverflow, CTA focus/reachability and48px+targets. Longer copy puts hero CTAs below the initial phone viewport; normal scrolling/keyboard reaches them and fixed phone contact remains available. At the approved preview release, all216public file hashes matched, production homepage hash was unchanged, inquiries were disabled and noindex retained.

`tests/home-hero.spec.ts` covers the approved content, existing responsive asset, eager loading, CTA destinations/focus, no overflow and normal-build form retention in desktop/mobile projects. The save branch passed 51 website browser cases and 12 production-intake cases locally, with one expected desktop invocation of a mobile-only test skipped. Commands: `corepack pnpm --filter apex-website test` and `corepack pnpm --filter apex-website test:production`. No GitHub Actions, paid model calls, OS/database/DNS/auth changes, customer submissions or new deployment are part of saving this work.
