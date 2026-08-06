# Apex — Decision Register

**Written 2026-07-26. Answered 2026-08-05.**
Every open decision across the four repos and seven PRDs, in one place, ranked by what it unlocks
rather than by when it was discovered.

**Where it stands. All 28 items are decided.** Eight were Nick's and he made them. **Travis signed
off on the remaining nineteen as written on 2026-08-05**, relayed by Nick — no document is on file,
which is what the provenance line under each section records. One item still needs counsel rather
than a decision.

That approval is what `docs/status.md` was holding out for. Its drift rule —
*"commission decisions presented as settled before recorded approval"* — is satisfied now, and only
now: these were carried as recommendations for exactly as long as they were unconfirmed.

**Three of the recommendations reversed positions already on file.** All three are resolved in §4 as
of 2026-08-05 and written through to Foundation §3.3, Foundation §7.1, and PRD 04. A reversal is a
legitimate act; a reversal nobody noticed is how two documents start disagreeing.

**PRD 03 and PRD 04 are both unblocked.** Their gates — the contract's cost definition, the
QuickBooks structure and the allowance mechanic — are answered and approved. See §6.

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

## 2. Decided — Travis's, approved as written

**Approved by Travis Sandoval on 2026-08-05, as written, with no corrections.** Relayed by Nick;
there is no signed document, and that is stated rather than implied. Three of these reverse
something already on file, and those reversals are worked through in §4.

**Item 1 carries its own precondition and Travis's approval does not discharge it:** the agreement
must be amended before the broad cost definition is relied on. Approving an interpretation is not
the same as the contract saying it.

### The three that unblock PRDs 03 and 04

| # | Question | Decided |
|---|---|---|
| 1 | **Reimbursable cost — what does the agreement define as cost?** **[MARGIN]** | **Broad direct-cost definition:** all direct, project-attributable costs required to deliver the pool — materials, subcontractors, permits, inspections, equipment rental, freight, disposal, project-specific labour burden, credit-card fees on reimbursable purchases, approved travel. **Excluded:** office overhead, general management salaries, marketing, financing costs, owner distributions, and costs caused by Apex's own negligence or rework. **Amend the agreement before relying on this** — and attach a written cost schedule so there is no ambiguity. |
| 2 | **QuickBooks structure** | **Projects on. One company file** unless the three operations are genuinely separate legal entities or tax books. **Classes for the three business lines** — Pool Construction, Concrete Coatings, Pool Service. Customers and Projects track individual jobs; Classes track business lines. Do not create three company files for reporting convenience. |
| 3 | **Allowance mechanic** | **The 30% fee recalculates against the final approved allowance cost**, in both directions. Customer-selected upgrades and approved changes carry the same fee unless expressly excluded. |

### Pricing and commission

| # | Question | Decided |
|---|---|---|
| 4 | **Fee rate** **[MARGIN]** | **Hold at 30% initially.** Do not move universally to 35% until job-level data proves 30% inadequate *after* all reimbursable costs are captured. Use 35% selectively — high complexity, compressed schedule, uncertain scope, unusually small jobs. |
| 5 | **Commission base** **[MARGIN]** | Pay on **collected gross profit** — not contract value, quoted fee, or recognised revenue. GP **includes** the fee earned on all legitimately reimbursable cost categories. Excluded: sales tax, pass-through amounts carrying no fee, financing charges, warranty rework, unapproved overruns, uncollected revenue. **Both conflicts this created are resolved — §4.1 and §4.2**: Stage 1 is an advance trueing up on collected GP, and the expanded base counts (Tier 1 only). Approved by Travis 2026-08-05. |
| 6 | **Permits showing $0.00 against a live line item** | **Treat as a control failure until proven otherwise.** Permits are an explicit allowance or reimbursable cost with the contractual fee applied. A live required cost may never sit at $0 without a note and an approval. |
| 8 | **Sales fee-rate discretion** | **None unilateral.** Sales may recommend a deviation; anything below the standard rate, or any unusual exclusion, needs written approval. |

### Operating model

| # | Question | Decided |
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

**PRD FINAL §20 — six items left.** §20.1 and §20.2 were closed 2026-08-05 by inheritance from this
register: item 24 makes **Monday Work Management** the active-project scheduling authority, and item
2 makes **QuickBooks** the invoice and payment authority. Neither needed its own decision.

Still open: which customer messages may be sent automatically; where existing project photos and
documents live; which team members need pilot access; whether customer pages use one stable link or
short-lived ones; the approved chemistry formula, threshold, and dosing policy; and which three to
five active projects are the pilot.

**One consequence of §20.1 worth watching.** Apex OS already holds dated subcontractor visits and
detects crew double-bookings (`docs/status.md`, 2026-08-02). Naming Monday the schedule authority
means those bookings are Apex OS's *view* of the schedule, not the schedule itself — so either
Monday feeds them, or the two will disagree the first time someone moves a gunite date in one and
not the other. `docs/status.md` still lists "schedule authority remains disconnected" as an open
Gate blocker; item 24 names the authority but does not connect it.

---

## 4. Reversals and conflicts — resolved 2026-08-05

**Resolved by Nick on 2026-08-05 and approved by Travis the same day**, along with item 5 that
created them. Recorded here with the reasoning and the cost, because each went against a
recommendation already on file and neither should be re-derived later from the answer alone.

| | Resolution | Where it now lives |
|---|---|---|
| §4.1 | **Stage 1 is an advance that trues up against collected GP.** Option 1 of the three below. | Foundation §7.1, PRD 04 |
| §4.2 | **The expanded Lever B base counts toward commission GP** — Tier 1 only. | Foundation §3.3, PRD 04 |

**A correction to the figure that was quoted while these were open.** §4.2 was described as costing
~$4,100 per pool and ~$78,000 a year. That took 30% of the added *revenue*; commission is 30% of the
added *GP*. Lever B adds ~$10,600 of reimbursed cost and ~$13,800 of revenue, so GP rises by the fee
on it — about **$3,200** — and commission rises by about **$950 per pool, ~$18,000 on a 19-pool
year.** Roughly a fifth of the figure the decision was weighed against.

**What §4.1 and §4.2 do together, stated once.** Both were designed to be answered separately and
they compound. Trueing up on collected GP makes reconciliation a *recalculation* rather than a
release gate, so cost overruns reach the cheque; counting the expanded base widens what overruns
apply to. Foundation §7 identified this incentive and offered three ways to blunt it — none was
taken. Foundation §7.1 records why that is defensible (commission is earned on *collected* GP, and
unapproved overruns are excluded outright) and which two mitigations remain available as engine
rules rather than redesigns.

### 4.1 Commission base: collected GP vs. Stage 1 at sale — RESOLVED

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

~~**Recommendation: option 1.**~~ **Decided 2026-08-05: option 1.** It preserves the existing
two-stage shape, keeps the rep paid at sale, and makes collection the thing that settles the number.
The advance is never clawed back — a disaster job means the rep keeps Stage 1 and Stage 2 floors at
zero, unchanged from the original formula.

### 4.2 Does the Lever B expanded base count toward commission GP? — RESOLVED

**What was on file, before 2026-08-05.** Foundation §3.3 *recommended* no — "the rep didn't earn a
fee on reclassified PM salary" — and PRD 04 had hardened that recommendation into a decided bullet
it never was. Both now record the opposite; PRD 04 also notes the overstatement it was making.

**Item 5 says** GP *includes* "the fee earned on all legitimately reimbursable cost categories" —
which is the expanded base.

**Decided 2026-08-05: yes, it counts — Tier 1 only.** It is defensible: under item 1, permits,
geotech, structural, gas line and labour burden become ordinary reimbursable scope rather than a
reclassification, and a fee genuinely is earned on them. Splitting commission GP from contract GP
would also mean two gross-profit figures per job, which is how a system starts disagreeing with
itself.

**Cost: about $950 per pool, ~$18,000 on a 19-pool year** — GP rises by the ~$3,200 fee on the moved
base, and commission is 30% of that. See the correction at the top of §4; the figure quoted while
this was open was roughly five times too high.

**The original objection survives for Tier 2 and is not overridden.** "The rep didn't earn a fee on
reclassified PM salary" is correct about PM time, supervision, trucks, and small tools. Tier 1 is
reimbursable scope; Tier 2 is allocated overhead wearing a cost code. If Foundation §3.2 ever moves
Tier 2 into the base, this decision is revisited rather than inherited.

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

Neither needs anyone to decide anything. They need one job to finish, and the
paperwork from it.

### 7.1 A second completed pool — exactly what to collect

The takeoff engine reproduces Whitaker exactly, **but Whitaker is what calibrated
it**, so that result is partly circular. One completed job the model has never
seen, landing within 10%, is what turns *method proven* into *numbers trusted*.

**Whitaker alone cannot do this**, and its own evidence README says so: it holds
dollars, not quantities. `$4,000` for "Rebar / Rebar Labor" with no pounds behind
it. So a second job needs more than Whitaker had.

**A — the money chain** (proposal → cost capture → reconciliation → commission):

- [ ] The customer estimate **as issued**
- [ ] The completed-job **transaction report** — every cost line
- [ ] **What was invoiced and collected, and when.** New requirement: PRD 04
      settles on *collected* GP and Whitaker carries no payment timeline
- [ ] **What the salesperson was actually paid**, so the engine's answer can be
      checked against reality rather than only against itself

**B — the takeoff** (the part Whitaker explicitly cannot support):

- [ ] Pool **length × width**, and the depth profile — shallow depth, deep depth,
      and the shallow / transition / deep runs
- [ ] **Spa** — size, and inset / attached / spillover
- [ ] **Steps and benches** — tread count, tread run, tread width; bench depth
      below waterline
- [ ] **The deck slab dimensions** — the actual poured area, not a border width
- [ ] **Quantities actually ordered** — gunite yards, rebar weight, plaster, tile,
      coping, excavation loads hauled

B is the half that matters most, because it is the half nothing has ever tested.

**Transcribe it the way Whitaker was transcribed:** manual, visually verified,
integer cents, blank source cells left `null` rather than inferred, and the
document's SHA-256 recorded. `classification` fields stay `null` until an
authorised owner maps them to cost codes — a guessed cost code is worse than an
unclassified one.

### 7.2 What a completed job cannot prove

**It proves the arithmetic, not the system.** Gates, evidence photos, draw
releases and the customer progress page all happen *during* construction, and a
finished pool cannot retroactively pass a pre-gunite gate with photos nobody
took.

So the second artefact is not paperwork at all: **name a pool that is about to
start.** That is PRD FINAL §20.12 and it is what tests everything the completed
job cannot. The two together are the pilot.

### 7.3 Crew-days on two pools

One number per phase. It retires the largest assumption in the capacity model and
feeds Tier 2 allocation, which PRD 03 §6.1 currently refuses to approximate.
Start before the tooling exists — a note on a phone is enough.
