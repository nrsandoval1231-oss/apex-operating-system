# Authorized call-only Cloudflare preview

Website-only review release based on main9ae9686. Existing project `apex-website-2-review`, branch `website2-preview`; no public-domain or OS change.

Set `PUBLIC_ENV=staging`, `PUBLIC_PREVIEW_INTAKE_DISABLED=1`, and `PUBLIC_SITE_URL=https://website2-preview.apex-website-2-review.pages.dev`. Unset both `PUBLIC_LEAD_WEBHOOK_URL` and `PUBLIC_LEAD_WEBHOOK_URL_TEST`. Run `scripts/build-website-staging.sh`, then website preflight with the same environment. The builder retains noindex headers/robots/meta and site-relative redirects. Publish only to the existing preview branch.

This explicit mode replaces the inquiry island with an unavailable notice and verified phone link (`+18066050502`). There are no inquiry fields or submission controls. The mode refuses production or either configured endpoint. Preflight allows the missing endpoint only for this exact staging mode, checks rendered call-only markers, phone link and absence of forms; all other missing-endpoint/production guards remain.

This preview cannot accept online inquiries. Enabling public intake, changing Access, migrating OS data or switching apexgetsitdone.com requires its separate release decision. Existing Pages deployments remain retained for rollback; this release changes only the preview alias.

Live Pages verification exposed an inherited extra308 after legacy redirects to directory pages. The staging builder now emits trailing-slash destinations, preserving the configured301 and destination while reaching the page in one hop. Production redirect configuration is unchanged.
