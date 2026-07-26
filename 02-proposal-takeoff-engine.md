# PRD 02 — Pool Proposal & Takeoff Engine

**Status:** v0.2 — revised against the Whitaker Oasis estimate
**Depends on:** `00-foundation.md`
**Scope:** Pools only

**What changed in v0.2:** the blocking question is answered — he has no takeoff, so this is **invent, not digitize**. The approach is rebuilt around adding a hidden quantity layer to his existing sheet rather than replacing it.

---

## Problem

The estimate is a **price list, not a takeoff.** There is not a single quantity anywhere in the document:

| Line | What it says | What's missing |
|---|---|---|
| Rebar / Rebar Labor | $4,000.00 | linear feet, tons |
| Gunite | $12,000.00 | cubic yards |
| Plaster - Materials | $3,750.00 | square feet |
| Coping - Labor | $3,950.00 | linear feet |
| Excavation | $5,500.00 | cubic yards |

Consequences:

- **Pricing consistency is personal.** These numbers live in someone's head. They don't scale, they don't transfer, and they can't be checked.
- **No allocation basis.** The rebar truckload has nothing to divide across.
- **No substantiation.** This is a cost-plus contract. He is billing $4,000 for rebar with no documented basis, on an agreement that likely carries audit rights. This is the sharpest version of the problem.
- **No budget handoff.** Nothing flows from the accepted proposal into a job budget.
- **No estimate-vs-actual.** Which blocks the commission engine and every analytic downstream.

## Why this comes before costing and commissions

The takeoff is one data structure doing three jobs: it sets the **customer price**, provides the **allocation basis** for shared materials, and **substantiates the billing**. Build it once and the rebar problem dissolves as a byproduct.

---

## The critical design constraint

**His estimate is the customer-facing document.** It's branded, it's structured the way his customers read it, and it carries the disclaimer. Replacing it means retraining customers and staff simultaneously — that's how these projects die.

**So: don't replace it. Add a layer behind it.**

The quantity layer sits in hidden columns. The customer-facing view stays pixel-identical. Every dollar figure the customer sees becomes a computed cell instead of a typed one.

| Qty | Unit | Unit cost | → Extended (what shows today) |
|---|---|---|---|
| 27.3 | yd³ gunite | $439.56 | **$12,000.00** — Gunite |
| 106 | LF | $33.96 | **$3,600.00** — Coping / Materials |
| 106 | LF | $37.26 | **$3,950.00** — Coping / Labor |
| 43 | bags | $87.21 | **$3,750.00** — Plaster / Materials |

Same document. Same number. Now with a defensible basis behind it.

This is the entire adoption strategy, and it's why this is buildable.

---

## Success criteria

Checked 90 days after rollout:

- 100% of new pool proposals produced from the quantity layer — no typed dollar figures in cost lines
- Accepted proposal generates a job budget by cost code with **zero re-entry**
- Every bulk material has a documented allocation basis
- **Substantiation test:** any line item on a customer estimate can be traced to quantity × unit cost in under a minute
- **Every job outputs estimated crew hours and supervision hours**, giving Tier 2 costs a defensible allocation basis
- **Consistency test:** two people estimating the same pool land within 5%
- Estimate vs. actual variance visible per cost code, per job

---

## Scope

**In:** parametric takeoff model for pools · unit cost library and its maintenance process · **labor and supervision hour estimates by cost code** (added — see below) · quantity layer behind the existing estimate format · budget handoff into Monday at job creation

**Out:** remodel and coatings estimating · commission calculation (PRD 04) · CRM, pipeline, analytics (PRD 05) · marketing and lead capture (PRD 01) · any automated QuickBooks↔Monday sync · customer portal · e-signature · redesigning the customer-facing estimate

---

## Approach

### Phase 0 — build the quantity layer in his existing spreadsheet (3–4 weeks)

Not new software. His sheet, plus hidden columns.

Three parallel workstreams:

**A. Define the drivers.** The header already says "14x24 Size Pool w/ Spa" — he's *already* thinking in dimensions. They're just not connected to anything. For a 14x24: 336 sq ft surface, 76 LF perimeter. The parametric inputs are sitting right there.

**B. Back-solve unit costs from completed jobs.** Take 5–10 finished pools and divide known dollars by known dimensions to derive starting unit costs. Then validate against QuickBooks actuals.

**C. Audit for missing costs.** Permits at $0.00, no burden line, no PM or warranty — per Foundation §5.

### Phase 1 — freeze

Assemblies and unit costs locked. Named owner. Update cadence set.

### Phase 2 — productize

Tool choice **deliberately deferred**. Monday items with formula columns, Airtable, or a small web app all stay live. The right answer depends on what Phase 0 reveals about complexity. Don't decide early.

---

## The parametric model

**Inputs:** length × width · average depth · perimeter LF · spa (yes/no + dimensions) · shape complexity · deck sq ft · equipment tier · site access · soil · feature list

**Derived quantities:**

| Cost code | Driver |
|---|---|
| 200 Excavation | pool volume + overdig factor → yd³ |
| 400 Shell — rebar | shell area (floor + walls) → LF or tons |
| 400 Shell — gunite | shell area × thickness → yd³ |
| 700 Plumbing | perimeter + equipment run distance → LF |
| 800 Finishes — tile | perimeter → LF |
| 800 Finishes — coping | perimeter → LF |
| 800 Finishes — plaster | bags from interior surface area; labor → sq ft |
| 1000 Deck | **4 ft border rule** → w×perimeter + 4w² → sq ft |

**Worked example — Whitaker Oasis.** 14x24 = 336 sq ft surface, 76 LF perimeter, 3.5 → 6.0 ft profile. With the confirmed 6 × 6 spa: **887 sq ft wetted · 100 LF perimeter · 12,881 gallons.**

**Correction history — read this before trusting any older figure.** A back-of-envelope first put the shell at **716 sq ft**. The full takeoff raised it to **921 sq ft** once the spa and steps were counted (a 28% error). Travis then confirmed the spa is **6 × 6**, not the assumed 7 × 7, settling it at **887 sq ft**. Because every unit cost is back-solved from his dollars ÷ our quantity, **each correction moved the whole rate library.** Use `whitaker-oasis-quantity-takeoff.md` v2.0 and nothing earlier.

**Reading the estimate for signal:** "Gunite Encap Kit $1,130.18" sits among round numbers everywhere else. The odd cents mean that line came off a real invoice; the round numbers are rules of thumb. That's the map for which unit costs are trustworthy today and which need rebuilding from scratch.

### Scope expansion: labor and supervision hours

Per Foundation §3.2, the Lever B decision means PM and supervision time may become billable to cost-plus jobs. That requires a defensible basis for how many hours *this* job absorbed — so the takeoff has to output hours, not just material quantities.

| Output | Driver | Use |
|---|---|---|
| **Crew hours by cost code** | quantity ÷ production rate (e.g. LF of rebar tied per man-hour) | direct labor + burden |
| **Supervision hours** | build duration × visits per week × hours per visit | Tier 2 allocation basis |

Supervision is the harder one, and the instinct to allocate it as a percentage of job cost is wrong. **It's duration-driven.** A $150k pool and a $90k pool on the same 7-week calendar consume similar PM time; a percentage basis overcharges the expensive job and would be hard to defend under audit. Estimate a build calendar in Phase 0 and allocate against that.

Adds roughly a week to Phase 0. Worth it — without hours, Tier 2 stays unbillable and Lever B delivers only its Tier 1 half.

---

## Risks

| Risk | Mitigation |
|---|---|
| Slower than typing a number from memory | Hidden layer means the visible workflow barely changes; measure the delta honestly in Phase 0 |
| Back-solved unit costs are contaminated by spa/upgrade scope | Sample of 5–10 jobs, mixed with and without spas |
| Unit costs go stale and silently corrupt pricing | Named owner + cadence, defined in Phase 1 |
| Garbage unit costs in → garbage everything out | Source from QuickBooks history, not vendor list prices |
| Scope creep into a full estimating suite | Pools only; the Out list is enforced |
| Allowance lines can't be parameterized | Correct — they stay allowances. Flag them explicitly rather than faking a takeoff (Foundation §6) |

---

## Milestones

| # | Deliverable | Gate | Status |
|---|---|---|---|
| 0 | Foundation v0.2 signed off | Fee-rate and allowance decisions made | open |
| 1 | 5–10 completed pools pulled with dimensions + actuals | — | **1 of 5–10** (Whitaker) |
| 2 | Unit costs back-solved and validated against QB | Traceable to real invoices | back-solved from the estimate; **not yet QB-validated** |
| 3 | Quantity layer built into his existing sheet | Customer view unchanged | **done** — every line reproduces, split materials/labor to match his format |
| 4 | Back-test: model vs. actuals on the sample | Within 10% | **passes at 0.0% on Whitaker** — but Whitaker is what calibrated it. Needs a job the model has never seen |
| 5 | Missing-cost audit complete | Permits, burden, PM, warranty resolved | audited and quantified (~$10.6k); **gated on the contract review** |
| 6 | Live on 3 real proposals | Budget generated with zero re-entry | not started |
| 7 | Phase 2 tool decision | — | deliberately deferred |

---

## Open questions

1. ~~**Does he have dimensions recorded** for past jobs?~~ **Partly resolved 2026-07-26.** Three build standards are confirmed — depth is always a 3.5 → 6.0 slope, the spa is always 6 × 6 × 3.5, the deck is always a 4 ft border. A proposal now needs only length × width, so Milestone 1 needs far less archaeology than feared. Still open: whether length × width is recorded for past jobs.
2. ~~**Is the spa sized separately?**~~ **Resolved 2026-07-26: 6 × 6 × 3.5, standard on every pool.** This corrected the takeoff's assumed 7 × 7 and moved the entire unit-cost library.
3. **Which lines are subcontracted vs. in-house crew?** "Rebar / Rebar Labor" as one line suggests sub, but this needs confirming before burden can be handled.
4. **Who builds estimates** — owner, estimator, or salesperson?
5. **Do salespeople have discretion** on the fee rate, or is 30% fixed? Directly affects PRD 04.
6. **How many pools per year?** Sets how much automation is justified in Phase 2.
7. **Quality of historical cost data in QuickBooks** — good enough for a unit cost library, or does it get rebuilt from invoices?
