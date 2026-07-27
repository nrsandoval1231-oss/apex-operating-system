# Apex — Pool Proposal & Takeoff Engine (PRD 02)

The **quantity layer**: turn pool dimensions into a defensible takeoff — quantities per cost
code × unit cost = the same dollar figures the customer already sees, now substantiated.
Implements PRD 02 (`apex-prds/02-proposal-takeoff-engine.md`), grounded in `00-foundation.md`
and the reverse-engineered `reference/whitaker-oasis-quantity-takeoff.md`.

**Scope: pools only.** Not remodel/coatings, not commission (PRD 04), not CRM (PRD 05).

## What's here

| File | What it is |
|---|---|
| `engine.mjs` | Pure, dependency-free takeoff engine: geometry → assemblies → quantities → schedule → pricing → budget → hours → Lever B. Every formula cites its source. |
| `engine.test.mjs` | 87 checks validating the engine against the real Whitaker numbers. `node engine.test.mjs`. |
| `report.mjs` | CLI takeoff report — the substantiation test made runnable. `node report.mjs whitaker` / `sample` / `18x36 --deep 7 --spa 8x8`. |
| `calibrate.mjs` | Back-solves the unit-cost library from his real line dollars. Re-run whenever geometry changes. |
| `index.html` | The interactive builder UI. Live recompute, derived calendar, coverage, back-test, gated Lever-B panel, CSV/JSON export. |

## Apex build standards (confirmed 2026-07-26)

Three assumptions became known values, so a proposal now needs only **length × width**:

| Standard | Value | Was |
|---|---|---|
| Depth profile | always 3.5 → 6.0 ft slope | assumed |
| Spa | always 6 × 6 × 3.5 ft | **assumed 7×7** |
| Deck | always a 4 ft border | unquantified $5k allowance |

The spa correction is load-bearing. The reference takeoff published 921 sq ft / 104 LF /
13,222 gal from a 7×7 spa it flagged as "the biggest single unknown." The real 6×6 cuts wetted
area 3.7% and perimeter 3.8% — and since every unit cost is *back-solved* from his dollars ÷ our
quantity, **the whole library had to be re-derived** (`node calibrate.mjs`). Gunite went
$424 → $440/yd³, plaster $85 → $87/bag. Both still land inside published ranges, which is the
cross-check that the correction didn't break anything.

The 4 ft deck rule gives 4×76 + 4×4² = **368 sq ft** on Whitaker — inside the 280–415 sq ft the
reference had independently back-solved from the $5,000 allowance. Two different methods agreeing
is the strongest evidence in the model.

## Validation against the reference job

`node report.mjs whitaker` reproduces the takeoff from geometry alone, and every line multiplies
out to the dollar figure the customer actually saw:

| Measure | Model | Reference | |
|---|---|---|---|
| Wetted area | 887 sq ft | 887 | exact |
| Perimeter | 100 LF | 100 | exact |
| Water volume | 12,881 gal | 12,881 | exact |
| Excavation | 92.3 bank yd³ | 92.3 | exact |
| Gunite ordered | 27.3 yd³ | 27.3 | exact |
| Plaster bags | 43 | 43 | exact |
| Rebar steel | 1,061 lb | 1,061 | exact |

It also reproduces his line dollars: Excavation $5,500 · Gunite $12,000 · Rebar $4,000 ·
Coping $7,550 · Deck $5,000 · Plaster $8,750. Lines extend on the **rounded** quantity so that
`qty × unit cost = extended` exactly — otherwise the substantiation test fails on the customer's
own arithmetic.

## Milestone 4 — the back-test passes

`node backtest.mjs` compares the model against **his real estimate, line for line**
(`whitaker-actual.mjs`, extracted from the customer PDF; all 13 section subtotals and the grand
total reconcile, which is what verifies the read). Nothing is back-solved, so the gate means
something:

| Code | Category | Model | Actual | |
|---|---|---|---|---|
| 200 | Excavation | $7,000 | $7,000 | exact |
| 400 | Pool Shell | $16,801 | $16,800 | exact |
| 700 | Pool Plumbing | $8,101 | $8,100 | exact |
| 800 | Pool Finishes | $20,750 | $20,750 | exact |
| 1000 | Pool Deck | $10,001 | $10,000 | exact |
| 1300 | Additional Upgrades | $7,000 | $7,000 | exact |
| | **modelled codes** | **$69,653** | **$69,650** | **0.0%** |

Enter his direct-entry lines too and the whole job lands at **$116,958 against $116,955.18** —
89.7% of job cost substantiated, with only the 10.3% of remaining allowances carrying no quantity
(down from 14.5% once the Concrete Diamonds allowance was superseded by the deck takeoff).

Four gaps had to close to get there, all found by the back-test:

- **Tile labor** — the model priced material only ($1,950) and missed his separate $2,500 labor
  line. Material follows the band area, labor follows the waterline run.
- **Forming** — a $550 line no assembly had.
- **Site work** — backfill, driveway cleaning and haul-off, $1,500, separate from the dig.
- **Deck double-count** — the engine billed a $5,001 deck takeoff *and* kept the $5,000
  "Concrete Diamonds Budget" allowance. Allowances now carry `supersededBy`, so taking off a
  cost code drops the allowance covering it. This is PRD 02's thesis in miniature: same dollar
  figure, now with a quantity behind it.

## The number that matters most

**The parametric layer substantiates ~49% of Whitaker's real job cost** (59.6% counting the
tracked allowances). Run the back-test (`actualJobCost`) and the model lands at $69,653 against a
real $116,955.18 — a 40.4% shortfall that is *missing input, not model error*. The gap now sits in
the remaining layout-driven cost codes seeded at $0: equipment, cover, lights, water features,
automation, and code 500's flat "Plumber $5,000" labor line. (Code 700 Pool Plumbing — the other
half of the plumbing split, $8,100 — is now parametric; see below.) Milestone 4's "within 10%"
gate cannot be met until the rest carry real quotes. `t.coverage` reports this on every run so the
shortfall can never be mistaken for completeness.

## Pool plumbing (code 700) is now parametric

Ref §3.6 gives Whitaker's plumbing as six 2 in PVC runs from the equipment pad plus the spa jet
loop — ~755 LF at $8,100, previously a flat direct-entry $0. `plumbingLine()` derives all six from
one number: `runToPad` = equipment pad distance (Apex standard, 50 ft — still flagged **inferred**,
not confirmed) + 5 ft of local routing = 55 LF. Main drain, returns and spa suction/return are each
an exact multiple of it; skimmers add another 5 ft for the skimmer-box offset; spa jets scale with
jet count (8, standard spa) × an average per-jet run; the spillway stays a fixed short connector.
Reproduces Whitaker's 755 LF and $8,101 against $8,100 exactly.

**Still gated the same way as everything else here:** skimmer/drain/return *counts* are seeded from
this one job, not derived from pool size, so the method is validated, not the counts. Code 500's
"Plumber $5,000" stays direct-entry — it's a flat labor figure with no component list in the
reference to derive a rate from, unlike code 700's LF breakdown.

## v0.2 — what changed

- **Depth profile drives geometry.** Pass `depthShallow`/`depthDeep` and average depth plus the
  floor slope factor are derived. The slope run follows the long axis regardless of which field
  the dimension was typed into (Whitaker is "14×24" with 14 as the *width*).
- **Spa excavation is parametric.** Was hardcoded at 11 yd³ — spa dimensions were silently
  ignored. Now reproduces 11 for Whitaker's 7×7×3.5 and scales for anything else.
- **Steps and spa seat scale with size** instead of sitting at fixed 50/25 sq ft constants.
- **Build duration is derived, not typed.** `buildSchedule()` computes the calendar from
  quantities plus fixed cure/inspection lags; Whitaker lands at 7.9 weeks against the reference's
  6–8. Supervision hours follow from it, so the Tier 2 allocation basis is defensible rather than
  asserted. An explicit `buildWeeks` still overrides.
- **Lever B is quantified, still gated.** `leverBPreview()` prices each missing cost for *this*
  job — Whitaker recovers ~$10.5k of absorbed cost, ~$13.6k of revenue with the fee on top.
  Caliche is deliberately a *range*, not a point cost, and is excluded from the totals.
- **Caliche exposure modelled** (`calicheExposure()`): what fraction of the dig sits below the
  ~27 in calcic horizon. Not priced into the excavation line — the $58/yd³ seed rate was
  back-solved from a job that already dug caliche, so a premium on top would double-count.
- **Deck is a takeoff line** derived from the 4 ft border rule, instead of hiding in an allowance.
- **Coverage + back-test** reporting (above).

## v0.3 — build standards

- `APEX_STANDARDS` encodes the confirmed depth profile, spa size and deck border. A bare
  `{length, width}` now produces a complete takeoff; `spa: {}` opts a job into a standard spa.
- **Unit-cost library re-derived** against the corrected 6×6 spa (`calibrate.mjs`).
- **Lines extend on the rounded quantity**, so the printed numbers multiply out.
- **UI rebuilt** to match the engine: depth-profile and deck-border inputs, derived build
  duration (with an explicit override), coverage bars, back-test panel, and a costed Lever-B
  panel behind the gate toggle. Previously it passed `buildWeeks: 7` from a text box, which
  silently overrode the derived calendar.

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
- **Layout-driven cost codes** (equipment, cover, lights, water features, automation, and code
  500's flat "Plumber $5,000" labor line) are direct-entry lines seeded at $0 — enter them from
  real quotes. They carry the least parametric confidence. Code 700 Pool Plumbing moved out of
  this list — it's parametric now (pad-distance runs + spa jet loop, ref §3.6), still flagged
  **low** confidence since the run counts are seeded from one job.
- **Phase 2 tool choice is deferred** (PRD 02). This is a self-contained tool precisely so it
  doesn't preempt Monday / Airtable / web-app — it can feed any of them (JSON/CSV export).

## Open questions (PRD 02 / Foundation) — for the maintainer

Dimensions recorded for past jobs? Spa sized separately? Sub vs in-house per line? Who builds
estimates? Fee-rate discretion? Pools/year? QuickBooks data quality? Contract's definition of
reimbursable cost (gates all Lever-B). See `apex-prds/00-foundation.md` §Open questions.
