# Foundation — Definitions & Data Model

**Status:** v0.2 — revised against the Whitaker Oasis estimate (14x24 pool w/ spa, Apex Designer Pools)
**Purpose:** Every downstream PRD references this document. Definitions get fixed once, here, so the proposal engine, cost tracking, and commission engine can't drift apart and disagree later.

**What changed in v0.2:** the markup question is answered (§1), the cost code list is rebuilt from his actual estimate (§4), and two new structural issues surfaced — allowances (§6) and cost-plus commission inflation (§7).

---

## 1. The pricing structure — confirmed, and it isn't what the brief says

The estimate is explicit:

```
JOB COST TOTAL        $116,955.18
Cost Plus at 30%      $ 35,086.55
ESTIMATED COSTS       $152,041.73
```

$35,086.55 ÷ $152,041.73 = **23.08% gross margin.** Not 30%.

This is markup, not margin, and the relationship is fixed: a 30% fee on cost is *always* a 23.08% margin, no matter what the job costs. The formula is `margin = fee ÷ (1 + fee)`.

### 1.1 Why this can't just be corrected

"Cost Plus at 30%" is printed on the customer-facing estimate. It's the **disclosed fee in a cost-plus agreement**, not an internal calculation. To net a true 30% margin, the customer would have to see a **42.9%** fee. That's a pricing and contract conversation with real competitive consequences — not a spreadsheet fix.

### 1.2 What it means for every number in the brief

"30% gross profit on pools" is the assumption under the commission plan and the financial targets. The real figure is 23%. On this job:

| | Amount | % of revenue |
|---|---|---|
| Revenue | $152,041.73 | 100% |
| Gross profit | $35,086.55 | 23.1% |
| Commission (30% of GP) | $10,525.97 | 6.9% |
| **Left after commission** | **$24,560.58** | **16.2%** |

That $24,560 is what covers project management, supervision, warranty, office overhead, marketing, and owner comp — none of which currently appear in job cost (see §5). It's thin, and it's the number he should be reacting to.

### 1.3 The two levers, and how they actually work

**Lever A — raise the disclosed fee.** The only way to move the margin percentage. 42.9% for a true 30%. Market-facing decision.

**Lever B — move legitimate costs into the cost base.** This does *not* change the margin percentage (still 23.08%), but it does two things: those costs get **reimbursed** by the customer instead of eaten by GP, and the fee grows in absolute dollars because the base is bigger.

Lever B is the more realistic one, and it's what §5 is about. But it only works if the cost-plus contract's definition of "cost" actually covers those items and it's disclosed. Expanding the cost base beyond what the contract defines looks like padding, and cost-plus contracts frequently carry audit rights. **This needs a contract review before anything moves.**

### 1.4 Commission must sit outside the GP calculation

Commission is paid *on* gross profit. If commission is also counted as a job cost inside gross profit, the definition eats its own tail.

**Rule: GP is calculated before sales commission.** Commission is below the line and never books to a job cost code. Not negotiable — build it into the code structure so it can't happen by accident.

### 1.5 Worked example — round numbers, for checking a commission statement

Whitaker (§1.2) is the real job, but its figures are awkward to verify in your head. This is the
same arithmetic on a clean $120,000, and it is the one to check a commission statement against.

**Today, on a $120,000 job cost:**

| | Amount | % of revenue |
|---|---|---|
| Job cost | $120,000 | 76.9% |
| Fee at 30% | $36,000 | 23.1% |
| **Contract total** | **$156,000** | 100% |
| **Gross profit** | **$36,000** | **23.08%** |
| Commission at 30% of GP | $10,800 | 6.9% |
| — Stage 1, at sale (15% of estimated GP) | $5,400 | |
| — Stage 2, true-up on collected GP (§7.1) | $5,400 | |
| **Left after commission** | **$25,200** | **16.2%** |

The fee is 30% and the margin is 23.08%, at every job size — `margin = fee ÷ (1 + fee)`. The
$25,200 is what covers PM, supervision, warranty, office overhead, and owner compensation.

**The same job after Lever B**, assuming the $120,000 excludes the ~$10,600 of Tier 1 items Apex
currently absorbs — permits, geotechnical, structural, gas line, labour burden:

| | Before | After | Change |
|---|---|---|---|
| Job cost | $120,000 | $130,600 | +$10,600 |
| Fee at 30% | $36,000 | $39,180 | +$3,180 |
| Contract total | $156,000 | $169,780 | +$13,780 |
| Gross profit | $36,000 | $39,180 | +$3,180 |
| Commission at 30% of GP | $10,800 | **$11,754** | **+$954** |
| Left after commission | $25,200 | $27,426 | +$2,226 |
| **…less Tier 1 still absorbed** | **$14,600** | **$27,426** | **+$12,826** |

Three things this makes concrete:

1. **Margin does not move.** $39,180 ÷ $169,780 is still 23.08%. Lever B stops GP absorbing costs
   the customer should reimburse; it does not make Apex a 30%-margin business (§3.1).
2. **The commission increase is $954**, not 30% of the added revenue. Commission is 30% of the added
   *GP* — the $3,180 fee — not of the $13,780. This is the arithmetic behind the ~$950/pool figure
   in §3.3, and getting it wrong overstates the cost of that decision roughly fivefold.
3. **The last row is the point of Lever B.** Apex is better off by about $12,826 on this job, almost
   all of it the $10,600 it stops absorbing rather than the fee it gains.

**Both tables assume the job is collected in full.** Under §7.1 Stage 2 is computed on *collected*
GP, so a job with an uncollected balance pays a smaller Stage 2 — and Stage 1 is never clawed back.

---

## 2. Entity model

```
Lead → Opportunity (Proposal) → Job → Phases → Cost lines
```

- **One Job = one contract = one GP calculation = one commission calculation.** Change orders and upgrades attach to the job; they never spawn a new job.
- **Job ID is the primary key across both systems** — the same ID in Monday and in QuickBooks, typed once at job creation, never edited.
- Everything downstream joins on Job ID. If this is sloppy, nothing else works.

---

## 3. Gross profit definition

**GP = contract revenue billed − direct job cost**

Under cost-plus, revenue is derived from cost, so GP percentage is structurally locked by the fee rate (§1). This is why Nick's read is right — they almost never miss on gross profit. Cost overruns pass to the customer.

**The consequence:** the commission risk here is *not* margin erosion. It's cost inflation (§7).

### 3.1 The expanded cost base (Lever B — decided)

**Decision: expand the reimbursable cost base rather than raise the disclosed fee.** Rationale in §1.3 — the Lubbock market's referral density makes a visible fee change costlier than it looks.

**Be clear on what this does and doesn't do.** It does not make him a 30% business. At a 30% fee, margin stays 23.08% no matter what sits in the base. What it does is stop GP from absorbing costs the customer should be reimbursing. If the Tier 1 items below total ~$12k on a job like Whitaker, moving them in is worth about **$15,600** — the $12k reimbursed, plus the fee earned on it. Real money, different mechanism.

**If 30% margin is a hard requirement, Lever B alone won't reach it.** The combined path is expand the base *and* move the fee to ~35%, yielding 25.9% without the sticker shock of 42.9%. His call, not ours.

**Tier 1 — clean, move in:**
permits · geotechnical report · structural engineering · labor burden · job-specific equipment rental · rebound haul-off · fill and curing water · startup chemicals · warranty and callback work actually performed

**Tier 2 — only with a documented allocation basis (§8):**
project management and supervision time · trucks and fuel · small-tool consumables

**Tier 3 — never in the base:**
office overhead, admin, rent · marketing · owner compensation · sales commission (§1.4) · **warranty reserve** — billing a cost-plus customer for a reserve against costs not yet incurred is hard to defend

### 3.2 Lever B creates a second allocation problem

Tier 2 items are shared across jobs in exactly the way the rebar truckload is. Billing a customer for PM time requires a defensible basis for *how many hours this job got* — which means the takeoff must now produce **labor and supervision hours, not just material quantities.** That's a scope expansion to PRD 02, flagged there.

### 3.3 Two decisions this forces — both answered 2026-08-05

1. ~~**Does the expanded base count toward commission GP?** Recommend **no**~~ — **Decided: yes, it
   counts.** Nick, 2026-08-05, **against the recommendation on file.** The reasoning that carries it:
   under the broad direct-cost definition (`decision-register.md` item 1), Tier 1 items are ordinary
   reimbursable scope rather than reclassified overhead, and a fee genuinely is earned on them.
   Splitting commission GP from contract GP would also mean maintaining two gross-profit figures per
   job, which is how a system starts disagreeing with itself.

   **What it costs.** GP rises by the fee on the moved base — about **$3,200 per pool** on the
   ~$10,600 / ~$13,800 figures in the register — so commission at 30% of GP rises by roughly
   **$950 per pool**, about **$18,000 on a 19-pool year**. Note this is 30% of the added *GP*, not
   of the added revenue; an earlier working figure of ~$4,100/pool made exactly that mistake.

   **The original objection still stands for Tier 2 and is not overridden.** "The rep didn't earn a
   fee on reclassified PM salary" is right about PM time and supervision. Tier 1 is reimbursable
   scope; Tier 2 is allocated overhead wearing a cost code. If Tier 2 is ever moved into the base
   under §3.2, this decision should be revisited rather than inherited.

2. **How does the allowance mechanic (§6) interact** now that the base is larger? — **Answered:**
   the fee recalculates against the final approved allowance cost, in both directions, and
   customer-selected upgrades and approved changes carry the same fee unless expressly excluded
   (`decision-register.md` item 3, approved by Travis 2026-08-05).

**All of 3.1 is gated on the contract review.** Until his agreement's definition of reimbursable "cost" is known, none of it can be implemented.

---

## 4. Cost code structure — rebuilt from his estimate

His existing categories are already a working spine, and they're in his language. Adopting them as-is rather than imposing new ones removes most of the adoption fight.

**Existing (keep his order and naming):**

| Code | Category | Source |
|---|---|---|
| 100 | Permits | his sheet |
| 200 | Excavation | his sheet |
| 300 | Pool Equipment | his sheet |
| 400 | Pool Shell Construction | his sheet |
| 500 | Utilities | his sheet |
| 600 | Lights | his sheet |
| 700 | Pool Plumbing | his sheet |
| 800 | Pool Finishes | his sheet |
| 900 | Cover | his sheet |
| 1000 | Pool Deck | his sheet |
| 1100 | Water Features | his sheet |
| 1200 | Automation | his sheet |
| 1300 | Additional Upgrades | his sheet |

**Missing — currently nowhere in the estimate:**

| Code | Category | Note |
|---|---|---|
| 1400 | Design & Engineering | not present |
| 1500 | Project Management & Supervision | not present — see §5 |
| 1600 | Startup & Chemicals | not present |
| 1700 | Cleanup & Punch | currently buried inside the Excavation line |
| 1800 | Warranty & Callback | not present |

**The same codes exist in QuickBooks and Monday, with the same numbers.** Highest-leverage hygiene item in the entire project.

---

## 5. What the estimate leaves out

Beyond the missing codes above, three specific gaps:

1. **Permits shows $0.00** with a live line item. Either they're absorbed, billed separately, or forgotten. Any of the three is a problem for a cost-plus job.
2. **No labor burden line anywhere.** Direct field labor appears bundled into sub line items ("Rebar / Rebar Labor," "Tile - Labor"). If those are subcontracted, fine. If any is in-house crew, burden is invisible.
3. **No PM, supervision, or warranty reserve.** Someone runs these jobs for 6–8 weeks. That cost currently comes out of the 23%.

Each of these is now a **Lever B candidate** (§3.1), pending the contract review.

---

## 6. Allowances — the mechanic nobody has defined

The estimate carries **$17,000 in budget allowances**, marked "**** Upgrade":

| Item | Amount |
|---|---|
| Concrete Diamonds Budget | $5,000 |
| Turf Budget | $5,000 |
| Fence Budget | $7,000 |

That's **14.5% of job cost** that is not a cost — it's a placeholder. And the 30% fee is being charged on top of it.

**Unanswered:** when the actual turf comes in at $6,200, does the fee recalculate on the real number, or is the estimate's fee fixed? This single mechanic determines what "actual GP" means at reconciliation, which means it *is* the Stage 2 commission trigger. It has to be answered before PRD 04 can be written, and it has to match the contract.

---

## 7. Cost-plus + commission-on-GP creates a perverse incentive

Structural, and it needs a decision:

> Costs rise → fee rises (30% of a bigger number) → GP rises → **commission rises.**

The salesperson is financially rewarded when a job costs more. Under cost-plus that's not theoretical — it's the arithmetic. On this job, a 10% cost overrun adds roughly $1,050 to the commission.

**Options, for PRD 04:**
- Pay Stage 2 on the **lesser** of estimated and actual GP (removes the upside, keeps the truing-down)
- Pay both stages on **estimated** GP only, and use reconciliation purely as the release gate
- Exclude **change-order and allowance-driven** GP growth from the commission base, but include it if the customer initiated the change

~~The middle option is closest to what Nick described~~ — **superseded 2026-08-05.**

### 7.1 Decided: a fourth path, and it accepts the incentive

**Nick, 2026-08-05.** Stage 1 is an **advance**; Stage 2 **trues up against collected gross
profit**, with the expanded Lever B base included (§3.3).

None of the three options above describes this. All three were built to *blunt* the incentive; this
one does not. Stating the consequence plainly, because it is now a chosen position rather than an
oversight:

**The salesperson is paid more when a job costs more, and on a wider base than before.** A 10% cost
overrun on a Whitaker-sized job adds roughly **$1,050** to the commission. Moving Tier 1 into the
base adds about **$950 per pool** on top. Reconciliation is now a recalculation, not a release gate,
so overruns flow through to the cheque rather than being capped at the estimate.

What makes it defensible: commission is earned on **collected** GP, so a job that overruns and
cannot be collected pays nothing extra, and unapproved overruns are excluded from the base outright
(`decision-register.md` item 5). The exposure is therefore *approved* overruns on *collected* jobs —
which under cost-plus is largely scope the customer asked for and paid for.

**Two mitigations remain available and are not adopted:** capping Stage 2 at the lesser of estimated
and collected GP, and excluding Apex-initiated change orders while including customer-initiated ones
(option 3 above). Either can be added later as a rule in the engine rather than a redesign. Revisit
the first time a job's commission is materially larger than its estimate implied.

---

## 8. Shared material allocation policy

**The problem:** a truckload of rebar spans four pools. Which job absorbs it?

**The rule — standard cost from the takeoff:**

1. Bulk purchases hit a **material pool**, not a job.
2. Each job absorbs **standard cost = takeoff quantity × current unit cost**.
3. The gap between what the truckload actually cost and the total allocated out is a **purchase price variance** — reviewed monthly, treated as overhead, never pushed onto a job.

**Why this and not inventory tracking or an overhead burden:** per-job GP stays stable and predictable, which matters because commission rides on it. Buying well or badly becomes management's P&L problem rather than something that randomly moves a salesperson's check. And it requires no yard system and no field adoption battle.

**The cost-plus complication is now sharper.** The estimate bills $4,000 for "Rebar / Rebar Labor" with no quantity behind it. Under a cost-plus contract with audit rights, that is a number he currently cannot substantiate. The takeoff (PRD 02) isn’t just an efficiency project — it's the documentation that supports what he's billing.

---

## 9. Vocabulary

| Term | Means |
|---|---|
| **Takeoff** | Itemized quantity list derived from the pool design |
| **Unit cost** | Current cost per unit of a material or sub scope |
| **Budget** | Takeoff × unit costs by cost code, created when a proposal is accepted |
| **Allowance** | A placeholder dollar figure with no takeoff behind it (§6) |
| **Actual** | What was really spent, from QuickBooks |
| **Reconciled** | Job closed, all costs in, actual GP final, Stage 2 unlocked |
| **Estimated GP** | GP at time of sale, from the proposal |
| **Actual GP** | GP at reconciliation |

---

## Open questions

1. ~~Markup or margin?~~ **Answered:** markup, 23.08% actual. Lever B chosen (§3.1).
2. **Contract review** — what does the cost-plus agreement define as reimbursable "cost"? **Now the gate on everything in §3.1.**
3. **Fee rate** — does he stay at 30%, or pair Lever B with a move to ~35%? (§3.1)
4. **Allowance mechanic** — does the fee recalculate on actual? (§6) Blocks PRD 04.
5. **Commission base** — which of the three §7 options, and does the expanded base count? (§3.3)
6. **Tier 2 allocation basis** — how are PM hours assigned to a job? Drives the PRD 02 scope expansion.
7. **QuickBooks setup** — Projects on? Classes in use? One company file for all three businesses, or three?
8. **Permits** — why $0.00?
