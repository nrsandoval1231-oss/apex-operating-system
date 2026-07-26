# Decisions & Blocked Gates

Two kinds of entries: **LOCKED** (settled — build to these, don't relitigate) and **⚠ BLOCKED** (needs a human; do not guess, leave `TODO(BLOCKED: D-xx)` and build around it).

---

## LOCKED

**D-02 · Four verticals, promoted.** Pool Service is a full first-class vertical, not a sub-item of Designer Pools. Enum and order fixed in `data-contract.md`.

**D-04 · Astro + React islands.** Rationale in `CLAUDE.md`. Confirm with maintainer only if there's a reason it can't deploy to their environment.

**D-05 · Site hands off to n8n; owns nothing downstream.** No CRM writes, no auto-response, no Meta conversion from the site. Scope ends at the webhook.

**D-06 · Consent is per-vertical and captured verbatim.** Non-negotiable for TCPA. See AC-3.

**D-08 · Design tokens and copy come from the approved mockup.** Do not restyle or rewrite from scratch. `reference/apex-mockup.html` is the source.

---

## ⚠ BLOCKED — needs the maintainer (Nick), do not guess

**D-01 · Access transfer from Monsoon.** Before any DNS cutover, confirm ownership/access to: domain registrar, hosting, GTM container (GTM-WSHKQ3X), GA4 property, Meta Business Manager, Google Business Profile. Agencies often hold these in their own accounts; losing GBP ownership is slow to recover.
→ *Blocks Phase 5 launch. Does not block Phases 1–4.*

**D-03 · Canonical domain.** Three domains currently in play: `apexgetsitdone.com` (current site), `apexdesignandrenovation.com` (social image host), `apexcoatinglbk.com` (legal pages). Pick one canonical; the other two 301 in. Recommendation in-repo is to consolidate to one domain with vertical subfolders (`/pools`, `/coating`, `/renovation`, `/service`), but the choice of *which* domain is the maintainer's — it has brand and SEO-equity implications.
→ *Blocks the 301 map (AC-7.2) and sitemap canonical (AC-5.4). Build pages with relative paths so this can be set late.*

**D-07 · Content editing model.** Does the client (Travis) need to edit copy/testimonials/gallery himself, or does the maintainer edit via git? If self-serve, add a headless CMS (Sanity or Storyblok) in Phase 2; if maintainer-edited, Markdown/MDX in `content/` is enough. Build Phase 2 content as `content/` data files either way so a CMS can be layered on without rework.
→ *Does not block launch. Decides Phase 2 content architecture.*

**D-09 · GBP structure.** One Google Business Profile or several (one per vertical/brand)? Multiple listings sharing an address and phone risk suspension. Out of scope for the repo build, but it interacts with NAP consistency and the per-vertical tracking numbers, so flag it in the launch checklist and get an answer before citations go out.
→ *Out of repo scope; note in launch checklist.*

**D-20 · Photography.** ⚠ **The most likely thing to stall a finished build.** The approved mockup uses designed placeholder slots — correct for a pitch, not shippable. The current site has roughly two pool photos and a gallery that repeats six images twice, so there is no usable library to fall back on. Pools is the highest-ticket vertical and the least documented.

Options: (a) commission a half-day shoot at a completed pool — strongly recommended for Designer Pools, since real project photography is the primary conversion asset for a considered purchase at this price point; (b) AI-generated imagery — viable for atmosphere and secondary verticals, risky as a stand-in for "our work"; (c) licensed stock — fastest, weakest, and obviously generic to a local buyer.

**Agent behavior until this resolves:** build every image as a component with defined aspect ratio, `alt` text, and responsive `srcset`, fed from a `content/` manifest. Ship placeholders that are visibly labeled, never silently blank. Swapping in real photography must be a content change, never a layout change.
→ *Blocks launch. Does not block Phases 1–4.*

**D-21 · Lead webhook sequencing.** The form needs a real `PUBLIC_LEAD_WEBHOOK_URL`. Two valid orders: build `apex-lead-engine` Phase 1 first (intake only — nothing blocked there) and use its live endpoint, or point at a test endpoint and swap later. **Pick one explicitly; do not stub silently.** If a stub is unavoidable, it must log the full payload so AC-1 can still be verified against real data.
→ *Blocks AC-1.7 verification. Does not block form UI work.*

---

## Open product questions (not blocking the build, needed for the pitch/config)

These came from the PRD conversation and belong to the maintainer, not the agent. Listed so they're not lost:
- Current Facebook spend, campaign structure, which verticals.
- Current lead volume and mix.
- Who answers the phone, and how fast (speed-to-lead is a staffing question the site can't solve).
- Pool service account count, monthly rate, retention — needed to compute LTV and set acquisition budget.
- Revenue split across the four verticals — sets content priority.
