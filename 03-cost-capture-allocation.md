# PRD 03 — Cost Capture & Allocation

> **STATUS: NOT WRITTEN — UNBLOCKED 2026-08-05.** Still a placeholder; do not build from it yet.
> But both gates are now answered and approved, so it is ready to be written.
> **Depends on:** `00-foundation.md`, `02-proposal-takeoff-engine.md`
>
> **QuickBooks structure** (`decision-register.md` item 2): Projects on, one company file, Classes
> for the three business lines — Customers/Projects track jobs, Classes track business lines.
> **Contract review** (item 1): a broad direct-cost definition, with a written cost schedule
> attached to the agreement. Both approved by Travis on 2026-08-05.
>
> **One precondition survives the approval.** Item 1 says *amend the agreement before relying on
> this interpretation* — approving an interpretation is not the same as the contract saying it, and
> cost-plus agreements commonly carry audit rights. The amendment is a prerequisite to using this
> document, not a follow-up to it.
>
> **One input this document must now carry that it did not before:** payment application per job.
> Commission is settled on collected GP (PRD 04), which cost data alone cannot supply.

## What this will cover

How actual job costs get captured, coded, and allocated so that **actual gross profit per job** is trustworthy. Everything about paying people (PRD 04) and measuring anything (PRD 05) sits on top of this.

Scope when written:
- QuickBooks structure — Projects vs. Classes, cost-code mapping to Foundation §4
- How subcontractor invoices and material purchases get tagged to a Job ID at entry
- Implementation of the standard-cost allocation policy (Foundation §8) for shared/bulk materials
- The purchase price variance bucket and its monthly review
- Lever B mechanics (Foundation §3.1) — moving Tier 1 costs into the reimbursable base
- Tier 2 allocation — PM/supervision hours from the takeoff onto jobs
- AP/AR flow and where reconciliation is declared "closed"

## Why it isn't written

**Nobody has looked at the QuickBooks setup yet.** Writing this now means inventing the current state and specifying against a guess.

Blocking questions:
1. Are QuickBooks **Projects** enabled? Are **Classes** in use?
2. One company file across all three legal entities, or three separate files?
3. Are subcontractor receipts currently coded to a specific job, or landing as general expense?
4. Is there enough clean cost history to build a unit cost library, or does it get rebuilt from invoices?
5. **What does the cost-plus contract define as reimbursable "cost"?** (Foundation open question 2 — gates all of Lever B)

Question 5 needs a contract review, not a software decision. It gates the largest financial item in the whole engagement.

## Interim state

Until this is written, PRD 02's takeoff produces **estimated** costs only. Actual GP remains uncomputable, which is why PRD 04 can't be written either.
