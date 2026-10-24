# Production cutover and rollback — approval required

This is a runbook, not cutover authorization. Website2.0 is developed on a dedicated branch. Production DNS, existing website, main and the OS release remain unchanged during this work.

## Gates before proposing cutover

1. Owner compares the running staging homepage with the latest approved mockup and confirms authentic logo, photography, copy and three-division hierarchy. The mockup file has not yet been located; no claim of visual acceptance follows from a successful build.
2. Confirm Lubbock business identity/contact details, any additional service areas, financing dealer destination, current warranty terms and any historical offers. Only verified terms should enter public copy; do not release speculative city pages or pool pricing.
3. Review the migrated current and legacy legal documents and SMS disclosure for this final intake purpose. Preserve original disclosures, effective dates and URLs. Legal text transcription does not itself certify compliance.
4. Reconcile source route/media inventory with Search Console and analytics for orphaned URLs. Verify current canonical URLs, short aliases, redirects, navigation, forms, image URLs, sitemap and metadata. Remove all staging `noindex` directives from the production artifact only.
5. Deploy the additive gate API change through the existing OS release process with independent approval. Keep intake disabled by default until exact public origins, trusted edge abuse controls, and an Access bypass for **only** `/api/public/v1/leads` are configured. Never expose staff endpoints or place an API credential in the browser.
6. Point the production build at that canonical public endpoint; its database is the existing APEX OS database. The temporary review fixture/tunnel must never be used for production. Demonstrate a synthetic isolated lead with exact consent, attribution and all division fields; inspect persistence through approved non-production credentials before switching traffic.
7. Run `scripts/ci.ps1` on the frozen source; review explicit Postgres/S3 integration skips rather than converting them to PASS. Run browser/keyboard/mobile checks against built output, strict acknowledgement/retry/race/failure tests, accessibility and Lighthouse. Record exact source SHA/tree, build environment, artifact hashes and independent review.

## Cutover sequence after explicit owner approval

1. Save the existing production deployment/artifact, its host/project/domain configuration, current DNS records and TTL, redirect rules and rollback identifiers. Hash backups and verify restoration instructions without removing existing content. Do not infer backup success from a screenshot.
2. Build the approved exact candidate with `PUBLIC_ENV=production`, `PUBLIC_SITE_URL=https://apexgetsitdone.com`, and the verified canonical `PUBLIC_LEAD_WEBHOOK_URL`. Retain a copy of environment **names and safe metadata**, never secret values. Run production preflight; require crawlable robots/sitemap and absence of staging `_headers`/review notices. Confirm leads cannot target the disposable fixture.
3. Upload to an independent inactive deployment, verify security/caching/media/redirect configuration and compare code/artifact hashes with accepted evidence. Keep the old deployment available.
4. Switch only the approved website hosting/domain route. This should not alter the internal OS release. Do not change registrar or DNS if the host can switch the active artifact directly.
5. Verify homepage, all divisions, old URLs, legal pages, phone links, galleries and quote error state from an external browser and a phone. Do not create fabricated production customer records for verification; use an explicitly approved controlled test procedure or an approved genuine lead. Check persisted lead and receipt before claiming conversion success.
6. Monitor API errors, unknown acknowledgements, duplicate conflicts, spam rates, real lead volume, delivery and storage health. Measure real-user CWV when enough traffic exists. Lab Lighthouse cannot prove field LCP/INP compliance.

## Rollback triggers and actions

Triggers: lost/misrouted leads, persistence ambiguity, broken established URLs, unavailable media, wrong legal/brand content, severe mobile/accessibility regression or elevated error rate. Preserve diagnostic IDs and exact candidate; do not log customer payloads or blindly replay an uncertain submission.

Restore the prior website artifact/domain binding (or the saved DNS records if DNS was changed), verify public routing and the original contact flow, then mark the new deployment inactive. Leave the canonical leads table intact: rollback must not delete accepted leads or reverse unrelated OS changes. If public ingress is the fault, disable its feature flag through the approved API deployment process while retaining accepted data and stable idempotency keys. Confirm restoration externally, report the exact restored deployment and separately reconcile any UNKNOWN submissions with the owner.

The review website is a separate Cloudflare Pages project. Its temporary local ingress depends on this machine and tunnel, has no uptime guarantee, and serves synthetic isolated review submissions only. A durable managed staging ingress remains a release dependency; local disk-PGlite proof does not establish managed OS deployment or production readiness.
