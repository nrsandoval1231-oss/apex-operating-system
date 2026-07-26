# Apex — Pool Proposal & Takeoff Engine (PRD 02)

The **quantity layer**: turn pool dimensions into a defensible takeoff — quantities per cost
code × unit cost = the same dollar figures the customer already sees, now substantiated.
Implements PRD 02 (`apex-prds/02-proposal-takeoff-engine.md`), grounded in `00-foundation.md`
and the reverse-engineered `reference/whitaker-oasis-quantity-takeoff.md`.

**Scope: pools only.** Not remodel/coatings, not commission (PRD 04), not CRM (PRD 05).

## What's here

| File | What it is |
|---|---|
| `engine.mjs` | Pure, dependency-free takeoff engine: geometry → assemblies → quantities → pricing → budget → hours. Every formula cites its source. |
| `engine.test.mjs` | 23 checks validating the engine against the real Whitaker numbers. `node engine.test.mjs`. |
| `index.html` | The interactive builder UI. Live recompute, editable allowances/direct lines, budget + CSV/JSON export. |

Run the builder locally (module imports need a server, not `file://`):

```bash
npx serve apex-proposal-engine   # or any static server, then open the printed URL
```

## The two things this gets right on purpose (Foundation §1)

1. **"Cost Plus at 30%" is markup, not margin.** A 30% fee on cost is a **23.08%** gross
   margin, always (`margin = fee / (1 + fee)`). The tool shows the true margin, never the fee
   rate dressed up as one. To net a true 30% margin the disclosed fee would be **42.9%**.
2. **Commission is paid on GP and never books to a cost code** (§1.4). The engine keeps the
   fee/GP separate from job cost so this can't happen by accident.

## Deliberately provisional / gated (do not treat as final)

- **Unit-cost library** (`UNIT_COSTS` in `engine.mjs`) is seeded from ONE job (Whitaker) and the
  spa contaminates every line because it wasn't dimensioned separately. It's the **method**
  validated, not the numbers — confidence is flagged per line (high/medium/low). Re-derive from
  5–10 completed jobs (PRD 02 Milestone 1) and freeze with a named owner (Phase 1).
- **Allowances** ($17k default: Concrete Diamonds, Turf, Fence) are placeholders, **not takeoff**
  (§6). The fee is charged on top; whether it recalculates on actuals is **blocked** on the
  allowance-mechanic contract decision.
- **Missing / Lever-B costs** (permits, labor burden, PM/supervision, caliche contingency,
  geotech, structural, gas line, fill/curing water, rebound haul-off, startup chemicals,
  warranty) are surfaced via the "preview missing costs" toggle but **off by default** — they are
  **gated on the cost-plus contract review** (§3.1). Don't bill them until the contract defines
  reimbursable "cost."
- **Supervision hours** are duration-driven (build weeks × visits × hours), never a % of cost
  (§8). Production rates for crew hours are provisional and need calibration.
- **Layout-driven cost codes** (plumbing, equipment, cover, lights, automation) are direct-entry
  lines seeded at $0 — enter them from real quotes. They carry the least parametric confidence.
- **Phase 2 tool choice is deferred** (PRD 02). This is a self-contained tool precisely so it
  doesn't preempt Monday / Airtable / web-app — it can feed any of them (JSON/CSV export).

## Open questions (PRD 02 / Foundation) — for the maintainer

Dimensions recorded for past jobs? Spa sized separately? Sub vs in-house per line? Who builds
estimates? Fee-rate discretion? Pools/year? QuickBooks data quality? Contract's definition of
reimbursable cost (gates all Lever-B). See `apex-prds/00-foundation.md` §Open questions.
