# APEX homepage hero implementation plan

Goal: a luxury impression using existing APEX photography, homepage hero only. User authorized bounded implementation and preview redeployment.

Direction: existing `ApexDPv1.jpg`/WebP derivatives (1200×1600, illuminated pool/spa/fire bowls). Provenance: APEX source gallery and asset inventory; no invented client/location/awards. Alternatives: current harsh daylight photograph has less atmosphere; curved-pool photograph has distracting foreground. Selected night photograph is neither generated nor stock.

Tokens: existing sage#A1CCCA, charcoal#383838, white#FFFFFF; hero-only deep green#14201F and body#E7EBE8. Existing Barlow400 display/body. Quiet two-line headline, restrained overlay, offset photographic composition. No gold, new fonts or animation. Preserve all branding, other sections, call-only/noindex settings.

1. Add homepage-only image manifest entry: accurate alt,3:4 ratio, existing480/800/1200responsive files, eager/high-priority loading.
2. Modify only homepage hero markup/copy/styles: desktop dark copy area with image right; mobile image-led crop; pool route and existing phone CTAs. Remove meaningless ordinal.
3. Build/check/preflight; compare1440/820/390/320px, accessibility/contrast, image bytes/loading, CTA focus/44px targets, no overflow/forms and noindex. Run affected website regressions.
4. Retain local commit/manifest, upload existing preview branch only, verify served source/assets and live hero. Keep prior immutable deployment for rollback. No OS/DNS/auth/database changes.

Review: retain fire/water focal points on mobile; protect copy contrast; no large new downloads; rest of page unchanged. Inspection/contact sheet and before captures retained in external `release-evidence/hero-luxury`.
