# PRD 03 — Cost Capture & Allocation

> **STATUS: WRITTEN (v0.1) — 2026-08-05.** Both gates cleared: Travis approved
> the QuickBooks structure and the reimbursable-cost definition as written on
> 2026-08-05 (`decision-register.md` items 1 and 2).
> **Depends on:** `00-foundation.md`, `02-proposal-takeoff-engine.md`
> **Gates:** `04-commission-engine.md`, `05-crm-pipeline-analytics.md`
>
> **One precondition is not discharged by that approval.** Item 1 requires the
> customer agreement to be amended before the broad cost definition is relied
> on. Approving an interpretation is not the contract saying it, and cost-plus
> agreements commonly carry audit rights. **Nothing in §5 may be billed until
> that amendment is signed.** Everything else here can be built in the meantime.

---

## 1. What this is for

**Actual gross profit per job, trustworthy enough to pay commission on.**

That is the whole test. Every rule below exists because a number downstream
depends on it: PRD 04 pays against actual GP, PRD 05 measures against it, and
the cost-plus contract bills against the cost half of it. A cost figure nobody
can substantiate is worse than no figure, because it gets used anyway.

Three things make it hard, and none of them is software:

1. Costs arrive as subcontractor invoices and material receipts that do not know
   what job they belong to.
2. A truckload of rebar spans four pools, so some costs genuinely belong to no
   single job until someone decides they do.
3. Under cost-plus, the cost number is also the **billing** number. Getting it
   wrong is not a reporting error, it is an invoicing error on a contract with
   audit rights.

---

## 2. QuickBooks structure — decided

Approved 2026-08-05 (item 2).

| Decision | Setting |
|---|---|
| **Projects** | **On.** One QuickBooks Project per Job ID. |
| **Company files** | **One**, unless the three operations are genuinely separate legal entities or keep separate tax books. |
| **Classes** | **Three**, one per business line: Pool Construction, Concrete Coatings, Pool Service. |

**Customers and Projects track individual jobs. Classes track business lines.**
Those are different axes and conflating them is the most common way a books
setup stops answering questions. A Project tells you what one pool cost; a Class
tells you what pool construction cost this quarter.

**Do not create three company files for reporting convenience.** Separate files
mean separate charts of accounts, separate reconciliations, and no consolidated
view without manual work. Three legal entities with separate tax filings is a
reason; wanting a clean report is not.

**One open item, and it is a discovery task rather than a decision:** nobody has
yet looked at whether subcontractor receipts are currently coded to a job or
landing as general expense. That determines how much history is recoverable and
how much of §8 is a migration rather than a going-forward rule. It is answered by
opening the file, not by deciding anything.

---

## 3. Job ID is the join, and it is typed once

**The same Job ID exists in Monday and in QuickBooks, identically.** Minted at
job creation, never edited, never re-keyed. Everything in this document joins on
it.

This is Foundation §2's rule and it is repeated here because this is the document
where it either holds or fails. A cost line with no Job ID is not a cost that is
slightly harder to analyse — it is a cost that does not exist for any purpose in
PRD 04 or PRD 05.

**The rule for anything that cannot be tagged:** it goes to the material pool
(§8) or to overhead. It does not go to "whichever job is closest".

---

## 4. Cost codes

Foundation §4's structure, adopted whole. Thirteen codes are Apex's existing
categories in Apex's own naming, which removes most of the adoption fight; five
are additions for costs that are currently invisible.

| | Code range | |
|---|---|---|
| **Existing** | 100–1300 | Permits · Excavation · Pool Equipment · Pool Shell Construction · Utilities · Lights · Pool Plumbing · Pool Finishes · Cover · Pool Deck · Water Features · Automation · Additional Upgrades |
| **Added** | 1400–1800 | Design & Engineering · Project Management & Supervision · Startup & Chemicals · Cleanup & Punch · Warranty & Callback |

**The same numbers in QuickBooks and in Monday.** Foundation calls this the
highest-leverage hygiene item in the project and that is not an overstatement: it
is what makes an estimate and an actual comparable without a translation table
that somebody has to maintain and will eventually get wrong.

Two of the additions exist because the estimate currently hides them:
**Cleanup & Punch** is buried inside the Excavation line, and **Project
Management & Supervision** appears nowhere at all despite someone running each
job for six to eight weeks.

---

## 5. What counts as reimbursable cost

Approved 2026-08-05 (item 1). **Subject to the contract amendment above.**

**In — all direct, project-attributable costs required to deliver the pool:**
materials · subcontractors · permits · inspections · equipment rental · freight ·
disposal · project-specific labour burden · credit-card fees on reimbursable
purchases · approved travel.

**Out:** office overhead · general management salaries · marketing · financing
costs · owner distributions · **and costs caused by Apex's own negligence or
rework.**

**Attach the written cost schedule to the agreement as an exhibit.** Item 1 asks
for this specifically, and the reason is that "direct, project-attributable" is a
phrase two people can read differently at exactly the moment it matters — during
an audit, about a job that has already been built and billed.

That last exclusion pairs with PRD 04's: warranty rework is out of the
reimbursable base **and** out of commission GP. Enforce it in the cost schedule
once rather than remembering it in two places.

### 5.1 Lever B, and what moves when

Foundation §3.1's tiers, with what this document does about each.

| Tier | Items | Treatment |
|---|---|---|
| **1** | permits · geotechnical · structural engineering · labour burden · job-specific equipment rental · rebound haul-off · fill and curing water · startup chemicals · warranty and callback actually performed | **Move into the base on amendment.** Direct and attributable without an allocation argument. |
| **2** | project management and supervision time · trucks and fuel · small-tool consumables | **Not yet.** Requires a documented allocation basis — see §6. |
| **3** | office overhead · admin · rent · marketing · owner compensation · sales commission · warranty *reserve* | **Never.** Billing a cost-plus customer for a reserve against costs not yet incurred is indefensible. |

Tier 1 is worth roughly **$10,600 of absorbed cost and $13,800 of revenue per
pool** on Whitaker's shape. Those are the figures the register carries, and they
carry a caveat worth repeating: the geotech, structural and gas-line numbers are
placeholders with no invoice behind them yet. The structure is sound; the total
will move.

### 5.2 Permits at $0.00 is a control failure

Approved 2026-08-05 (item 6). The estimate carries a live Permits line at zero.
It is either absorbed, billed separately, or forgotten, and under cost-plus all
three are problems.

**Rule: a live required cost may never sit at $0 without a note and an
approval.** Permits become an explicit allowance or a reimbursable cost with the
contractual fee applied. This is a validation on the estimate, not a reporting
convention — PRD 02 should refuse to issue with a zeroed live line.

---

## 6. Shared and bulk materials

Foundation §8's policy, unchanged, restated as the implementation rule.

1. **Bulk purchases hit a material pool, not a job.**
2. **Each job absorbs standard cost = takeoff quantity × current unit cost.** The
   takeoff quantity comes from the approved Designer revision (PRD 02), which is
   the same number that was billed.
3. **The gap is purchase price variance.** Reviewed monthly, carried as overhead,
   **never pushed onto a job.**

**Why standard cost rather than inventory tracking or an overhead burden:**
per-job GP stays stable and predictable, which matters precisely because
commission rides on it. Buying a truckload well or badly becomes management's
P&L problem instead of something that randomly moves a salesperson's cheque two
months after they sold the job. It also needs no yard system and no field
adoption battle — which is the difference between a policy that holds and one
that is quietly abandoned.

**The cost-plus sharpening.** The estimate bills $4,000 for "Rebar / Rebar
Labor" with no quantity behind it. Under a contract with audit rights that is a
number Apex cannot currently substantiate. **The takeoff is not an efficiency
project — it is the documentation that supports what is being billed.**

### 6.1 Tier 2 allocation is a scope expansion, and it is not free

Billing a customer for PM time requires a defensible basis for *how many hours
this job got*. That means the takeoff has to produce **labour and supervision
hours, not just material quantities** — a real expansion to PRD 02, flagged
there and not yet built.

Until it is, Tier 2 stays out of the base. **Do not approximate it.** A
percentage-of-cost PM allocation is exactly the kind of number that looks
reasonable until someone with audit rights asks how it was derived.

---

## 7. Allowances

Approved 2026-08-05 (item 3).

**The 30% fee recalculates against the final approved allowance cost, in both
directions.** Customer-selected upgrades and approved changes carry the same fee
unless expressly excluded.

Whitaker carries **$17,000** of allowances — Concrete Diamonds $5,000, Turf
$5,000, Fence $7,000 — at 14.5% of job cost. When the turf lands at $6,200 the
fee is charged on $6,200, and when it lands at $4,100 the fee falls with it.

**Both directions matters.** A mechanic that only ratchets up is a mechanic a
customer will eventually notice, and it is not what was approved.

An allowance is a **placeholder, not a cost.** Until it resolves it must be
visible as such on every report, or actual GP is being computed against a number
nobody has spent. PRD 02 already hard-blocks customer issuance on unresolved
direct-entry scope; the same discipline applies here at reconciliation.

---

## 8. Payment application — the input this document did not previously carry

**New as of 2026-08-05, and it exists because PRD 04 changed underneath this
document.**

Commission now settles on **collected** gross profit (Foundation §7.1). Cost data
alone cannot supply that. This document must therefore also capture, per Job ID:

- what has been **invoiced**
- what has been **collected**, and when
- what remains **outstanding**

net of the exclusions PRD 04 names: sales tax, pass-through amounts carrying no
fee, financing charges, warranty rework, and unapproved overruns.

**QuickBooks is the authority for all of it.** `docs/status.md` records that Apex
OS holds draw status and a named human's invoice confirmation but is explicitly
**not** the financial authority. Apex OS says a draw is ready to bill; QuickBooks
says whether it was billed and whether the money arrived.

Naming this here was the point of surfacing it during the PRD 04 work — it is far
cheaper as a line in this document than as a discovery while building the
commission engine.

---

## 9. Historical data — assume it is not clean

Approved 2026-08-05 (item 10). **Assume medium-to-low reliability until tested.**

Before any average from history is used for estimating, validate the most recent
**10–15 completed pools** against invoices, subcontractor bills, payroll or crew
logs, and customer contracts.

This is not pessimism about the bookkeeping. It is that the codes in §4 did not
exist until now, so historical costs were coded against a structure that had no
place for PM time, cleanup, or warranty work. Those costs went *somewhere*, and
where they went determines whether a historical average means anything.

**The unit-cost library is downstream of this validation, not of this document.**

---

## 10. When a job is closed

A job is **reconciled** when:

1. Every cost line carries a Job ID and a cost code from §4.
2. Every allowance has resolved to an actual, and the fee has been recalculated
   against it (§7).
3. The material pool has allocated standard cost for every takeoff quantity, and
   the residual has been posted to purchase price variance (§6).
4. No line sits at $0 against a live scope item (§5.2).
5. Invoiced, collected and outstanding are stated (§8).

**Reconciliation is a declared act with a name against it, not a date that
arrives.** PRD 04's Stage 2 cannot be computed until it happens, which makes the
commission engine the enforcement mechanism that keeps the whole costing system
honest: no cost data, no second cheque.

---

## 11. Who touches this

Approved 2026-08-05 (item 16). **At minimum an office administrator or
bookkeeper**, for receipts, bills, permit documents, change-order records,
deposits and cost substantiation.

**Travis must not remain the information bottleneck.** That is the vision's test
applied to this document: a costing system that only works when the owner is
personally entering receipts has moved the problem rather than solved it.

---

## 12. What this document does not cover

- **Pricing authority.** The unit-cost library derived from this data is not a
  rate card until §9's validation passes and a second completed pool has tested
  it. `docs/status.md`'s use restriction still stands.
- **Tier 2 allocation**, until PRD 02 produces labour hours (§6.1).
- **Remodel, coatings and pool service cost structures.** The codes in §4 are
  built from a pool estimate. Coatings and service will need their own review,
  and PRD 06's Business Line field is how they stay separable in the meantime.
- **QuickBooks implementation mechanics** — chart of accounts mapping, item
  lists, bank rules. Those follow the discovery task in §2.

---

## 13. Definition of done

1. Projects on, one company file, three Classes (§2).
2. Codes 100–1800 present in QuickBooks and Monday with identical numbers (§4).
3. The written cost schedule attached to the customer agreement as an exhibit,
   and the agreement amended (§5).
4. Every cost line on one completed pool carries a Job ID and a code.
5. One truckload of a bulk material allocated by standard cost, with the residual
   visible in the purchase price variance bucket (§6).
6. One allowance resolved to an actual with the fee recalculated (§7).
7. Invoiced, collected and outstanding readable per job (§8).
8. Ten to fifteen historical pools validated, or explicitly declared unusable
   (§9).
9. One job declared reconciled by a named person (§10).

**Item 9 is the one that matters.** Everything above it is setup; a single job
carried all the way to a reconciled actual GP is what proves the chain works —
and it is what PRD 04 has been waiting for.
