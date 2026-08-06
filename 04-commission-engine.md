# PRD 04 — Commission Engine

> **STATUS: NOT WRITTEN — UNBLOCKED 2026-08-05.** Placeholder only; do not build from it yet. But
> the formula is settled, every input is answered, and PRD 03 is written. Ready to write.
> **Depends on:** `00-foundation.md`, `03-cost-capture-allocation.md`
>
> All three inputs are answered and **approved by Travis on 2026-08-05**: the allowance mechanic
> recalculates against final approved cost (`decision-register.md` item 3), and both contested points
> in the formula are resolved below. **The remaining dependency is PRD 03 being written** — its own
> gates are open too, so nothing here is waiting on a decision.

## The formula — settled (Foundation §1, §3, §7)

Pools, 30% of gross profit, paid in two stages:

- **Stage 1 — at sale:** 15% of **estimated** GP from the accepted proposal, paid as an **advance**.
- **Stage 2 — at reconciliation:** trues up to 30% of **collected** GP, floored at zero. A disaster
  job means the rep keeps Stage 1; it never goes negative and the advance is never clawed back.
- **GP is calculated before commission** (Foundation §1.4). Non-negotiable — otherwise the
  definition is circular.
- **The Lever B expanded cost base counts toward commission GP** (Foundation §3.3, decided
  2026-08-05 against the recommendation on file). Worth about **$950 per pool**, ~$18,000 a year at
  19 pools. **Tier 1 only** — if Tier 2 (PM time, supervision, trucks) is ever moved into the base
  under Foundation §3.2, this is revisited, not inherited.
- **Excluded from the base:** sales tax, pass-through amounts carrying no fee, financing charges,
  warranty rework, unapproved overruns, and uncollected revenue.

**Two corrections this makes to earlier versions of this document.** It previously stated the Lever B
exclusion as decided; Foundation §3.3 only ever *recommended* it, and the decision has now gone the
other way. It also described Stage 2 as a top-up at reconciliation without saying against what —
which is now collected GP, making reconciliation a recalculation rather than a release gate.

**What that costs, stated once:** Foundation §7.1. The rep is now paid more when a job costs more,
on a wider base, because reconciliation recalculates rather than caps. Two mitigations are designed
and deliberately not adopted — capping Stage 2 at the lesser of estimated and collected GP, and
excluding Apex-initiated change orders. Both are engine rules, not redesigns, if the exposure proves
real.

Remodel, coatings, and pool service commission structures are **undefined**. Recurring-revenue commission for Pool Service is a genuinely open design problem (Foundation §2 amendment needed — "one Job = one contract" doesn't describe a service account).

## Why it isn't written

Three inputs were missing. **Two are now answered; one is not.**

1. ~~**The allowance mechanic** (Foundation §6).~~ **Answered 2026-08-05** — the fee recalculates
   against final approved allowance cost, in both directions, and approved changes and
   customer-selected upgrades carry the same fee unless expressly excluded. Whitaker's $17,000 of
   allowances therefore resolve at actuals, not at estimate.
2. ~~**Which §7 option**~~ **Answered 2026-08-05, and none of the three** — Foundation §7.1. Stage 1
   is an advance, Stage 2 trues up on collected GP, and the perverse incentive is accepted rather
   than blunted. Two mitigations stay on the shelf.
3. ~~**Actual GP has to be computable**, which requires PRD 03.~~ **PRD 03 is written as of
   2026-08-05**, including the payment-application input this formula needs. Nothing is blocking
   this document now.

**A collected-GP formula raises one input PRD 03 did not previously have to carry:** payment
application per job. Stage 2 cannot be computed from cost data alone — it needs to know what was
actually collected against the contract, by job, net of the exclusions above. `docs/status.md`
records that Apex OS holds draw status and a named human's invoice confirmation but is explicitly
**not** the financial authority, so this comes from QuickBooks. Worth naming in PRD 03's scope
before it is written rather than discovered while building the engine.

## Build note for when it unblocks

The engine is a **layer**, not a platform feature. Monday.com won't do two-stage margin-based commission natively. The mechanic: n8n pulls reconciled job-cost data, computes both stages, and writes the result back. Small, well-bounded, and genuinely the highest-value custom work in the engagement.

**Adoption angle worth remembering:** Stage 2 can't be calculated until every cost is logged and the job is reconciled. No cost data, no second check. The commission engine is therefore the enforcement mechanism that makes the whole costing system stick.
