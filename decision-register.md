# Apex — Decision Register

**Written 2026-07-26.** Every open decision across the four repos and seven PRDs, in one place,
ranked by what it unlocks rather than by when it was discovered.

**The situation:** the build is roughly two sessions ahead of the decisions. Four repos are in good
shape and almost nothing is live — the website is finished through Phase 3 but can't launch, the
lead engine has four of six phases gated, and the commission engine that started this project is
blocked behind two unanswered questions. There are **28 open items**. Six of them unblock the rest.

> **⚠ For Nick before circulating.** Items marked **[MARGIN]** cannot be discussed without the
> 23.08% finding (Foundation §1), which was deliberately held back from the strategy deck. Decide
> whether this document goes to Travis whole, or whether those items get raised in conversation
> instead. Everything unmarked is safe to send as-is.

---

## The six that matter

Ranked by value unlocked. Everything else can wait behind these.

### 1. Cost-plus contract review — what does the agreement define as reimbursable "cost"? **[MARGIN]**

**Owner:** Travis (+ whoever drafted the contract)
**Unlocks:** All of Lever B — Foundation §3.1, the entire missing-cost program
**Worth:** **~$10,600 of absorbed cost and ~$13,800 of revenue per pool**, modelled on Whitaker

The single highest-value open question in the project, and the oldest. Right now gross profit is
absorbing costs the customer should be reimbursing: permits, geotech, structural engineering, a gas
line for the heater, fill and curing water, startup chemicals, rebound haul-off, labour burden, and
PM time. Every one is standard scope. None appears on the estimate.

Nothing can move until the contract's definition of cost is known. Expanding the base beyond what
the agreement covers looks like padding, and cost-plus contracts commonly carry audit rights.

*Caveat: the ~$13,800 uses placeholder rates for items with no invoice yet (geotech, structural,
gas line). The structure is solid; the total will move.*

### 2. QuickBooks setup — Projects on? Classes in use? One company file or three?

**Owner:** Travis / bookkeeper
**Unlocks:** PRD 03 (cost capture) → PRD 04 (commission engine)
**Worth:** the original ask. Commission standardization was the reason this project started

Three factual questions, probably ten minutes with whoever keeps the books. They block the entire
costing and commission chain. This is the cheapest high-value answer on the list.

### 3. Allowance mechanic — does the 30% fee recalculate when an allowance comes in different?

**Owner:** Travis (must match the contract)
**Unlocks:** PRD 04, and the definition of "actual GP"
**Worth:** determines what Stage 2 commission is actually paid on

Whitaker carries **$17,000 in allowances** — Concrete Diamonds $5,000, Turf $5,000, Fence $7,000 —
at 14.5% of job cost. When the turf comes in at $6,200, does the fee recalculate on the real number
or stay fixed at estimate?

This single mechanic defines "actual GP," which *is* the Stage 2 commission trigger. PRD 04 cannot
be written without it.

### 4. Access transfer from Monsoon

**Owner:** Nick to request, Monsoon to action
**Unlocks:** Website launch (Phase 5) **and** the Meta offline-conversion loop (lead engine Phase 5)
**Worth:** everything built for PRD 01 stays dark until this lands

Needed: domain registrar, hosting, GTM (`GTM-WSHKQ3X`), GA4, Meta Business Manager, Google Business
Profile. This is a relationship task with a lead time, not a technical one — start it now.

### 5. Airtable base — ten minutes, and the lead loop goes live

**Owner:** Nick
**Unlocks:** The entire lead flow, end to end
**Worth:** turns a finished, inert system into a working one

Pending across two sessions now. Create a base, import the two CSVs as `Leads` and `Quarantine`,
add a third table `JobEvents`, grant the stored token `data.records:read` + `write`, send the base
ID. Then the workflows activate, fixtures A–J run live, and the website's webhook points at
something real.

The single cheapest unblock on this list.

### 6. SMS provider + A2P 10DLC registration — start it now, it's slow

**Owner:** Nick
**Unlocks:** Speed-to-lead (Phase 2) · review requests (Phase 4) · **sub scheduling** (PRD 06)
**Worth:** speed-to-lead is the biggest conversion lever in home services

Recommend Twilio. The registration is the slow part — weeks, not days — and it now gates **three**
systems rather than two: PRD 06 established that subs never log into Monday, so scheduling the
gunite crew means outbound texts on the same rail.

---

## Free wins — no decision required, act this week

**Cap work-in-progress at three concurrent pool builds, not five.**
One crew saturates at three. Beyond that, annual output is flat at ~19 pools and only the queue
grows — at five, every customer waits **5.5 weeks longer for the same number of pools per year**.
Under cost-plus that is pure loss: no extra revenue, more PM time absorbed by GP, a longer
referral-risk window. Costs nothing to act on. *(PRD 06 §2; the exact cap firms up once two pools'
crew-days are logged.)*

**Book gunite slots ahead of the freeze rush.**
One gunite crew in Lubbock, and the season closes. Slots should be booked first and schedules built
backward from them. Missing a date doesn't cost a day, it costs a place in the queue.

**Log crew-days on the next two pools.**
One number per phase. It retires the largest assumption in the capacity model and feeds Tier 2
allocation for Lever B. Start before the tooling exists — a note on a phone is enough.

---

## By owner

### Travis

| # | Question | Blocks |
|---|---|---|
| 1 | **Contract review** — definition of reimbursable cost **[MARGIN]** | All of Lever B |
| 2 | **QuickBooks** — Projects? Classes? One file or three? | PRD 03 → 04 |
| 3 | **Allowance mechanic** — fee recalculates on actual? | PRD 04 |
| 4 | **Fee rate** — stay at 30% disclosed, or pair Lever B with ~35%? **[MARGIN]** | Foundation §3.1 |
| 5 | **Commission base** — which of the three §7 options, and does the expanded base count toward GP? **[MARGIN]** | PRD 04 |
| 6 | **Permits show $0.00** with a live line item — absorbed, billed separately, or forgotten? | Cost-plus exposure |
| 7 | Who builds estimates — owner, estimator, or salesperson? | PRD 02 rollout |
| 8 | Do salespeople have fee-rate discretion, or is 30% fixed? | PRD 04 |
| 9 | How many pools per year? | Sizes Phase 2 automation |
| 10 | Quality of historical cost data in QuickBooks | Unit-cost library |
| 11 | Gunite crew — how far ahead do they book, how firm are slots? | PRD 06 scheduling |
| 12 | When does gunite actually close for freeze in Lubbock? | PRD 06 season model |
| 13 | Does the crew lead get Monday access? | PRD 06 — field entry beats Travis from memory |
| 14 | Concrete Coating volume per month? | Whether the Job shape needs a real board |
| 15 | Is Pool Service in scope this year? | Route shape, workspace layout |
| 16 | Who else touches the system — office admin for receipts? | Substantiation path |
| 17 | WIP gate advisory or blocking? *(recommend advisory)* | PRD 06 |
| 18 | Current Facebook spend, structure, and which verticals it targets | Attribution baseline |
| 19 | Current lead volume/mix, and who answers the phone today | Speed-to-lead is partly staffing |

### Nick

| # | Decision | Blocks |
|---|---|---|
| 20 | **Airtable base** *(10 min)* | Live lead loop |
| 21 | **Access transfer from Monsoon** | Website launch + Meta loop |
| 22 | **SMS provider + A2P registration** *(slow — start now)* | Phases 2, 4, PRD 06 subs |
| 23 | **Canonical domain** among the three in play | Website launch |
| 24 | **Monday account** — Apex's own, and CRM vs Work Management | PRD 06 Phase 2 |
| 25 | CRM platform confirmation (D-10) | Lead engine Phase 3 |
| 26 | Confirm the four inboxes exist (D-13) | Phase 2 team notifications |
| 27 | Content-editing model — CMS or git (D-07) *(doesn't block)* | — |
| 28 | Real photography (D-20) | Placeholders ship, but they look like placeholders |

### Needs counsel

**SMS consent UX + quiet hours (D-14).** The form currently uses an explicit unchecked-by-default
checkbox — TCPA-forward, but it deviates from the approved mockup and unchecked-default means fewer
opt-ins, which directly reduces the biggest conversion lever. Separately, a lead at 11pm creates
tension between responding instantly and respecting quiet hours. Recommended reading: the immediate
auto-reply is a *transactional response to the customer's own inquiry*; marketing follow-ups wait
for allowed hours. **Worth ten minutes with a lawyer, not a judgement call from us.**

---

## What's genuinely done

So the register isn't mistaken for the whole picture:

- **Website** — Phases 1–3, Lighthouse 96 / 100 / 100 / 100, 39 tests. Waiting on access + domain
- **Lead engine** — intake built and deployed inactive; job-status signal built and validated,
  which resolved D-12 and freed Phases 4 and 5 from their signal dependency
- **Proposal engine** — reproduces Whitaker's real estimate line for line, back-test exact, 82 tests.
  Usable today
- **PRDs** — 00, 01, 02, 06 written. 03, 04, 05 blocked on items above

---

## Two things that need a second data point, not a decision

**A second completed pool.** The takeoff engine reproduces Whitaker exactly — but Whitaker is what
calibrated it, so that result is partly circular. One completed job the model has never seen,
landing within 10%, is what turns "method proven" into "numbers trusted."

**Crew-days on two pools.** Fixes the WIP cap at a measured number instead of a modelled one.

Neither needs anyone to decide anything. They need one job to finish.
