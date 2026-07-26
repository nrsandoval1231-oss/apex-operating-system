# PRD 04 — Commission Engine

> **STATUS: NOT WRITTEN — BLOCKED.** Placeholder only. The *formula* is settled; the *inputs* are not.
> **Depends on:** `00-foundation.md`, `03-cost-capture-allocation.md`

## The formula — already decided (Foundation §1, §3, §7)

Pools, 30% of gross profit, paid in two stages:

- **Stage 1 — at sale:** 15% of **estimated** GP from the accepted proposal.
- **Stage 2 — at reconciliation:** tops up to 30% of GP, floored at zero. A disaster job means the rep keeps Stage 1; it never goes negative.
- **GP is calculated before commission** (Foundation §1.4). Non-negotiable — otherwise the definition is circular.
- **The Lever B expanded cost base does not count toward commission GP** (Foundation §3.3). The rep didn't earn a fee on reclassified PM salary.

Remodel, coatings, and pool service commission structures are **undefined**. Recurring-revenue commission for Pool Service is a genuinely open design problem (Foundation §2 amendment needed — "one Job = one contract" doesn't describe a service account).

## Why it isn't written

Three inputs are missing, and each one changes the math.

1. **The allowance mechanic** (Foundation §6). Whitaker carried $17,000 in allowances — turf, decking, fence — with the 30% fee charged on top. When actuals land different, does the fee recalculate? That answer *is* the Stage 2 trigger definition. **Hard blocker.**
2. **Which §7 option** resolves the cost-plus perverse incentive (costs rise → fee rises → GP rises → commission rises). Recommendation on file: pay both stages on **estimated** GP and treat reconciliation as a release gate, not a recalculation. Needs Travis's sign-off.
3. **Actual GP has to be computable**, which requires PRD 03.

## Build note for when it unblocks

The engine is a **layer**, not a platform feature. Monday.com won't do two-stage margin-based commission natively. The mechanic: n8n pulls reconciled job-cost data, computes both stages, and writes the result back. Small, well-bounded, and genuinely the highest-value custom work in the engagement.

**Adoption angle worth remembering:** Stage 2 can't be calculated until every cost is logged and the job is reconciled. No cost data, no second check. The commission engine is therefore the enforcement mechanism that makes the whole costing system stick.
