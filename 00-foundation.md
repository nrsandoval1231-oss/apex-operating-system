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

### 3.3 Two decisions this forces

1. **Does the expanded base count toward commission GP?** Recommend **no** — the salesperson didn't earn the fee on reclassified PM salary. Otherwise Lever B hands out a raise nobody negotiated.
2. **How does the allowance mechanic (§6) interact** now that the base is larger?

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

The middle option is closest to what Nick described — Stage 2 as a cashflow gate rather than a performance adjustment — and is the simplest to build.

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
