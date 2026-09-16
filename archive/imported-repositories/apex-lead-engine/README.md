# Apex Lead Engine (n8n)

The automation layer that acts on leads from the Apex website. Receives a tagged lead at a webhook, responds within 5 minutes, routes it to the right crew, and — as later phases unlock — stitches it into the CRM, requests reviews, and pushes won-job value back to Meta.

**The one metric it protects:** time from lead submission to first automated response. Under 5 minutes, ideally under 1.

## For the coding agent

Start with `CLAUDE.md` (auto-loaded), then `docs/prd.md`. Build Phase 1 → 2 → monitoring now; Phases 3/4/5 unlock as gates clear.

## For a human

| File | Purpose |
|---|---|
| `CLAUDE.md` | Rules, build method, verification |
| `docs/prd.md` | Phases + what's buildable now vs gated |
| `docs/data-contract.md` | The lead object received (mirrors the website repo) + fixtures A–E |
| `docs/acceptance-criteria.md` | Pass/fail behaviors |
| `docs/decisions.md` | Locked + blocked gates |
| `workflows/` | n8n Workflow SDK source, one file per phase |

## Buildable now vs gated

- **Now:** intake/validate/route (Phase 1), speed-to-lead email + team alerts (Phase 2), monitoring (Phase 6).
- **Needs a decision first:** SMS provider (D-11), inbox confirmation (D-13), CRM choice (D-10), job-status signal (D-12), Meta access (D-01).

## Relationship to other repos

- **Upstream:** `apex-website` sends the lead object. The two data contracts must stay identical.
- **Separate, not built here:** CRM, commission engine, job costing, QuickBooks. This engine *writes to* the CRM once it exists — it doesn't choose or build it.
