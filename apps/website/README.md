# Apex Website

Marketing site for Apex (Lubbock, TX) — one brand, four verticals: Designer Pools, Concrete Coating, Design & Renovation, Pool Service.

**Its one job:** route visitors to the right vertical and capture every lead with a vertical + source tag, so conversion and ad spend can be measured per vertical. Everything else supports that.

## For the coding agent

Start with `CLAUDE.md` (loaded automatically), then `docs/prd.md`. Build order and gates are there.

## For a human

| File | What it's for |
|---|---|
| `CLAUDE.md` | Rules, stack, tokens, definition of done — the agent's standing instructions |
| `docs/prd.md` | Scope, phases, dependency graph |
| `docs/data-contract.md` | The lead object — the spine everything feeds |
| `docs/acceptance-criteria.md` | Pass/fail checklist + test skeleton |
| `docs/decisions.md` | What's locked, what's blocked on a human |
| `reference/apex-mockup.html` | Approved design + interaction spec — open in a browser |

## Status

**The site is built.** All five phases are done: five pages, four vertical landing pages, the quote form, SEO/analytics wiring, redirect tooling, and the cutover preflight gate. `npm test` runs 122 acceptance assertions across desktop and mobile, and `npm run check` and `npm run build` are clean on Astro 7.

What stands between this and launch is **not code**:

- **D-01 · access transfer from Monsoon** — registrar, GTM, GA4, Meta, Google Business Profile.
- **D-03 · canonical domain** — three domains in play; one has to win and the other two 301 in.
- **D-20 · photography** — 12 images are licensed stock. `npm run preflight` fails on this by design; it is the one blocker the build itself reports.
- **D-07 · content-editing model** — Markdown in `content/` vs a headless CMS.
- **D-21 · lead webhook** — the form needs a real `PUBLIC_LEAD_WEBHOOK_URL`.

Also open, and owned by the maintainer rather than the code: the speed-to-lead copy ("we'll text you back in minutes, not days") promises an automated response `workflows/lead-engine` has not built yet (`02-speed-to-lead.ts` does not exist). Either build the automation or change the promise — see `docs/decisions.md`.

Full detail in `docs/decisions.md`.

## Not in this app

This site is `apps/website` in the Apex monorepo, not a separate repository. CRM, commission engine, job costing, QuickBooks integration, and Meta offline conversions are outside this app, gated on their own decisions. This app ends at the n8n webhook handoff.
