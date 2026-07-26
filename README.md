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

Docs and the approved visual mockup are done. Code is not started. Three items are blocked on the maintainer before **launch** (not before building): access transfer from the current agency, canonical-domain choice, and the content-editing model. See `docs/decisions.md`.

## Not in this repo

CRM, commission engine, job costing, QuickBooks integration, Meta offline conversions. Separate projects, gated on separate decisions. This repo ends at the n8n webhook handoff.
