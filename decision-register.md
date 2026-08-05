# Apex — Decision Register

**Written 2026-07-26. Answered 2026-08-05.**
Every open decision across the four repos and seven PRDs, in one place, ranked by what it unlocks
rather than by when it was discovered.

**Where it stands.** All 28 items now carry an answer. Eight of them are **decided** — they were
Nick's to make and he made them. Nineteen are **recommended positions pending Travis**, because they
are his decisions and recording them as settled is exactly the drift `docs/status.md` warns against:
*"commission decisions presented as settled before recorded approval."* One is unchanged and needs
counsel.

**Three of the recommendations reverse decisions already on file.** They are flagged §4 below. A
reversal is a legitimate act; a reversal nobody noticed is how two documents start disagreeing.

> **⚠ For Nick before circulating.** Items marked **[MARGIN]** cannot be discussed without the
> 23.08% finding (Foundation §1), which was deliberately held back from the strategy deck. Decide
> whether this document goes to Travis whole, or whether those items get raised in conversation
> instead. Everything unmarked is safe to send as-is.

---

## 1. Decided — Nick's own, effective now

These need nobody else. They are decisions, not proposals, and downstream work may build on them.

| # | Decision | Recorded |
|---|---|---|
| 20 | **Airtable base — build now** as the interim intake and orchestration layer. Fields: source, campaign, service line, location, contact, consent status, owner, stage, urgency, estimated value, next action, appointment, CRM record ID. Tables kept narrow: Leads, Activities, Campaigns/Sources, Appointments, Jobs/Opportunities. **Explicitly not a second CRM.** | 2026-08-05 |
| 21 | **Monsoon — request full ownership transfer**, not shared access. Domain registrar, DNS, hosting, CMS, analytics, Search Console, Google Business Profile, Meta Business Manager, ad account, pixel/dataset, forms, call tracking, creative and source files, licenses. Plus credential inventory, vendor list, recurring charges, and a 30-day transition-support window. Screenshots and exported reports are not a substitute for account control. | 2026-08-05 |
| 22 | **Twilio for SMS; begin A2P 10DLC now.** Register the legal business, brand, and one defensible customer-care / lead-response campaign. Explicit consent, retained opt-in evidence, and STOP/HELP behaviour from day one. Review requests and subcontractor scheduling are added as separately governed workflows **after** the primary registration is stable. | 2026-08-05 |
| 23 | **Canonical domain — the shortest, clearest `.com` that exactly matches the operating brand and is already controlled by Apex.** No hyphens. The other two redirect permanently to it. **An unowned or Monsoon-controlled domain may not be canonical.** | 2026-08-05 |
| 24 | **Apex's own Monday account. Monday Work Management**, for estimating handoffs, jobs, scheduling, procurement, field updates, and delivery. Monday CRM only if it is formally selected as the long-term CRM — do not buy both by default. | 2026-08-05 |
| 25 | **HubSpot as the long-term CRM**, unless Apex already has a well-configured CRM with meaningful adoption. Cleaner path for contact history, pipelines, forms, email, and attribution than stretching Monday or Airtable into a CRM. | 2026-08-05 |
| 26 | **Four role inboxes: `sales@`, `estimates@`, `projects@`, `service@`.** `billing@` later if accounting volume warrants. Shared inboxes or groups with named owners — **no shared passwords**. | 2026-08-05 |
| 27 | **CMS for ordinary website content; Git for code and configuration only.** Marketing must not need a deployment workflow to change photos, team members, service pages, testimonials, or copy. | 2026-08-05 |

**Item 23 does not name the domain.** It sets the rule. The domain itself is still unregistered and
is the single item blocking Apex OS deployment — see §3.

**Item 25 supersedes nothing yet.** D-10 (CRM platform confirmation) was open; it is now answered,
but PRD 05 stays deferred on its own gate (~60 days of real lead data).

---

## 2. Recommended — Travis's to confirm

Nick's position on each, recorded 2026-08-05. **None of these is settled until Travis says so**, and
three of them reverse something already on file (§4).

### The three that unblock PRDs 03 and 04

| # | Question | Nick's recommendation |
|---|---|---|
| 1 | **Reimbursable cost — what does the agreement define as cost?** **[MARGIN]** | **Broad direct-cost definition:** all direct, project-attributable costs required to deliver the pool — materials, subcontractors, permits, inspections, equipment rental, freight, disposal, project-specific labour burden, credit-card fees on reimbursable purchases, approved travel. **Excluded:** office overhead, general management salaries, marketing, financing costs, owner distributions, and costs caused by Apex's own negligence or rework. **Amend the agreement before relying on this** — and attach a written cost schedule so there is no ambiguity. |
| 2 | **QuickBooks structure** | **Projects on. One company file** unless the three operations are genuinely separate legal entities or tax books. **Classes for the three business lines** — Pool Construction, Concrete Coatings, Pool Service. Customers and Projects track individual jobs; Classes track business lines. Do not create three company files for reporting convenience. |
| 3 | **Allowance mechanic** | **The 30% fee recalculates against the final approved allowance cost**, in both directions. Customer-selected upgrades and approved changes carry the same fee unless expressly excluded. |

### Pricing and commission

| # | Question | Nick's recommendation |
|---|---|---|
| 4 | **Fee rate** **[MARGIN]** | **Hold at 30% initially.** Do not move universally to 35% until job-level data proves 30% inadequate *after* all reimbursable costs are captured. Use 35% selectively — high complexity, compressed schedule, uncertain scope, unusually small jobs. |
| 5 | **Commission base** **[MARGIN]** | Pay on **collected gross profit** — not contract value, quoted fee, or recognised revenue. GP **includes** the fee earned on all legitimately reimbursable cost categories. Excluded: sales tax, pass-through amounts carrying no fee, financing charges, warranty rework, unapproved overruns, uncollected revenue. **⚠ Reverses two decisions on file — see §4.1 and §4.2.** |
| 6 | **Permits showing $0.00 against a live line item** | **Treat as a control failure until proven otherwise.** Permits are an explicit allowance or reimbursable cost with the contractual fee applied. A live required cost may never sit at $0 without a note and an approval. |
| 8 | **Sales fee-rate discretion** | **None unilateral.** Sales may recommend a deviation; anything below the standard rate, or any unusual exclusion, needs written approval. |

### Operating model

| # | Question | Nick's recommendation |
|---|---|---|
| 7 | **Who builds estimates** | **Estimator owns the estimate. Owner approves exceptions. Salesperson owns discovery and presentation.** A salesperson does not independently build technical cost estimates. |
| 9 | **Pools per year** | Plan on **19 completed pools/year**. Build systems that reach **24–30 without redesign.** |
| 10 | **Historical cost-data quality** | Assume **medium-to-low reliability until tested.** Validate the last **10–15 completed pools** against invoices, sub bills, payroll/crew logs, and contracts before any average is used for estimating. |
| 11 | **Gunite booking horizon** | **3–4 weeks ahead normally; 6+ near freeze season**, until the crew gives real lead-time data. |
| 12 | **Freeze closure** | Plan a **mid-November risk cutoff.** Weather-dependent work extends only on the gunite contractor's confirmation. **Do not promise winter dates from a fixed calendar.** |
| 13 | **Crew lead Monday access** | **Yes — limited mobile access.** Phase completion, blockers, photos, crew-days, next-step readiness. **No** margin, commissions, or customer financials. |
| 14 | **Concrete Coating board** | Own board once it regularly exceeds **five concurrent jobs or ~eight per month.** Below that, same Job structure with a Business Line field and filtered views. |
| 15 | **Pool Service scope** | **Not in the first implementation** unless it is already producing meaningful recurring volume. Preserve the Class and workspace structure; defer route optimisation, recurring billing, and technician dispatch. |
| 16 | **Who else touches the system** | At minimum an **office administrator / bookkeeper** — receipts, bills, permit documents, change orders, deposits, cost substantiation. Travis must not remain the information bottleneck. |
| 17 | **WIP gate** | **Advisory at three; hard approval required above three.** Any override documents staffing, subcontractor capacity, and customer impact. |
| 18 | **Facebook baseline** | Until real data lands: **one consolidated Meta account**, campaign-level separation by service line, location/service segmentation only where volume supports it. **Do not fragment a small budget across many campaigns.** Capture spend, leads, qualified leads, appointments, sold jobs, revenue, collected GP. |
| 19 | **Lead response** | One accountable **lead-response owner in business hours, a named backup after hours.** Target first human contact within five minutes for inbound calls and forms during coverage. **Automation assists; it must not hide an unanswered staffing problem.** |

---

## 3. Still genuinely open

**The domain is not registered.** Item 23 sets the rule for choosing it; nothing has been bought. It
is the only item blocking Apex OS deployment — Render, Cloudflare R2, and the Auth0 tenant are all
downstream of it (`docs/runbooks/deployment.md` §1–2). Apex OS should get **its own** domain rather
than wait on the canonical marketing one, which is entangled in item 21.

**SMS consent UX + quiet hours (D-14) — needs counsel, unchanged.** The form uses an explicit
unchecked-by-default checkbox: TCPA-forward, but it deviates from the approved mockup, and
unchecked-default means fewer opt-ins, which directly reduces the biggest conversion lever.
Separately, a lead at 11pm sets responding instantly against respecting quiet hours. Reading on
file: the immediate auto-reply is a *transactional response to the customer's own inquiry*, while
marketing follow-ups wait for allowed hours. **Ten minutes with a lawyer, not a judgement call from
us.**

**Real photography (D-20), item 28.** Unanswered. Placeholders ship, but they look like
placeholders.

**PRD FINAL §20 — eight items**, none of which this register covers: authoritative tool for
scheduling; authoritative tool for invoice and payment status; which customer messages may be sent
automatically; where existing project photos and documents live; which team members need pilot
access; whether customer pages use one stable link or short-lived ones; the approved chemistry
formula, threshold, and dosing policy; and which three to five active projects are the pilot.

---

## 4. Reversals and conflicts to resolve before building

### 4.1 Commission base: collected GP vs. Stage 1 at sale

**On file** (PRD 04, *"The formula — already decided"*):

> **Stage 1 — at sale:** 15% of **estimated** GP from the accepted proposal.

**Item 5 says** commission is paid on **collected** gross profit.

Nothing is collected at sale. These cannot both hold. Three ways out, and the choice is Travis's:

1. **Keep Stage 1 as an advance.** Pay 15% of estimated GP at sale, then true up against collected
   GP at reconciliation. Stage 1 becomes a draw against a commission that is *earned* on collection.
2. **Move Stage 1 to first collection.** The rep is paid when the deposit lands, not at signature.
   Honest to "collected," and slower for the rep.
3. **Drop "collected."** Pay on reconciled GP regardless of collection, and handle non-payment
   separately. Simplest; leaves Apex paying commission on money it never received.

**Recommendation: option 1.** It preserves the existing two-stage shape, keeps the rep paid at sale,
and still makes collection the thing that settles the number.

### 4.2 Does the Lever B expanded base count toward commission GP?

**On file** (Foundation §3.3, and restated in PRD 04):

> **The Lever B expanded cost base does not count toward commission GP.** The rep didn't earn a fee
> on reclassified PM salary.

**Item 5 says** GP *includes* "the fee earned on all legitimately reimbursable cost categories" —
which is the expanded base. This is a straight reversal.

It is defensible: under item 1, permits, geotech, structural, gas line and labour burden become
ordinary reimbursable scope rather than a reclassification, and a fee genuinely is earned on them.
But it is not free. The register modelled Lever B at **~$13,800 of additional revenue per pool**;
routing that through commission GP hands roughly 30% of it — **~$4,100 per pool** — back out as
commission. On a 19-pool year that is about **$78,000**.

**This needs to be an explicit choice, not a side effect of how item 1 was worded.**

### 4.3 Item 1 vs. item 5 on rework — consistent, worth stating

Item 1 excludes "costs caused by Apex's own negligence or rework" from reimbursable cost. Item 5
excludes "warranty rework" from commission GP. These agree. Worth writing into the cost schedule
explicitly so the two exclusions are enforced in one place rather than remembered in two.

---

## 5. Free wins — no decision required, act this week

**Cap work-in-progress at three concurrent pool builds, not five.** One crew saturates at three.
Beyond that, annual output is flat at ~19 pools and only the queue grows — at five, every customer
waits **5.5 weeks longer for the same number of pools per year**. Under cost-plus that is pure loss:
no extra revenue, more PM time absorbed by GP, a longer referral-risk window. Costs nothing to act
on. *(PRD 06 §2. Item 17 now makes the cap advisory at three and approval-gated above it.)*

**Book gunite slots ahead of the freeze rush.** One gunite crew in Lubbock, and the season closes.
Slots should be booked first and schedules built backward from them. Missing a date doesn't cost a
day, it costs a place in the queue. *(Item 11 sets the horizon; item 12 sets the cutoff.)*

**Log crew-days on the next two pools.** One number per phase. It retires the largest assumption in
the capacity model and feeds Tier 2 allocation for Lever B. Start before the tooling exists — a note
on a phone is enough.

---

## 6. What's genuinely done

So the register isn't mistaken for the whole picture:

- **Website** — Phases 1–3, Lighthouse 96 / 100 / 100 / 100, 39 tests. Waiting on access + domain
- **Lead engine** — intake built and deployed inactive; job-status signal built and validated,
  which resolved D-12 and freed Phases 4 and 5 from their signal dependency
- **Proposal engine** — reproduces Whitaker's real estimate line for line, back-test exact.
  Current verified baseline is 119 engine checks plus 11 hash-pinned evidence checks
- **Apex OS** — build plan Steps 1–8 complete, every MVP item in PRD FINAL §19 built,
  436 root tests passing. Not deployed; see §3
- **PRDs** — 00, 01, 02, 06 written. **03 and 04 unblock the moment Travis confirms items 1, 2 and
  3** and resolves §4.1 and §4.2. 05 stays deferred on real lead data

---

## 7. Two things that need a second data point, not a decision

**A second completed pool.** The takeoff engine reproduces Whitaker exactly — but Whitaker is what
calibrated it, so that result is partly circular. One completed job the model has never seen,
landing within 10%, is what turns "method proven" into "numbers trusted."

**Crew-days on two pools.** Fixes the WIP cap at a measured number instead of a modelled one.

Neither needs anyone to decide anything. They need one job to finish.
