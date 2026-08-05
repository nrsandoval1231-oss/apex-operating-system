# Handoff — Apex (Lubbock) Operational Modernization

**How to use this:** paste this whole document as the first message in a new chat, or upload it as a file. It re-establishes everything — decisions made, findings, open questions, and what's been built — without redoing the work.

**Files you should re-upload if you want to keep editing them directly** (a new chat has no access to this session's file system): the `apex-prds/` folder (or `apex-prds.zip`) — it contains the full renumbered PRD set plus the Whitaker takeoff under `reference/`. The two zipped repos (`apex-website.zip`, `apex-lead-engine.zip`) and `apex-strategy-deck.pptx` are finished deliverables — re-upload only if you want them modified further, not just to keep the context alive.

---

## 1. Who and what

**Client:** Travis, owner of **Apex** (Lubbock, TX). One brand, historically three businesses — now framed as **four verticals**: Designer Pools, Concrete Coating, Design & Renovation, **Pool Service** (promoted from a buried bullet to a full vertical — see §5). Revenue ~$2–5M across all lines. Currently running on spreadsheets and manual tracking — no CRM, no job costing system.

**Original ask from Nick:** commission standardization, cost tracking, profit-margin commissions, "30% GP on pools," "15 and 15" staged commission, sales/lead/close-rate tracking across verticals, full CRM, marketing (Facebook ads), project management.

**The reframe that's held throughout:** this is not an AI problem, it's a **data spine** problem. AI multiplies value once systems are connected; bolted onto disconnected spreadsheets it just makes the mess run faster. Work is split into several small, sequenced PRDs off one shared foundation doc, not one giant PRD.

**"15 and 15" defined:** 30% of a pool job's gross profit, paid in two stages — 15% at sale (on *estimated* GP), 15% at reconciliation (trued up to *actual* GP, floored at zero — under cost-plus, actual GP is almost always ≥ estimate, so this rarely goes negative for the salesperson).

**Tooling decided:** Monday.com as CRM + project management spine (not building custom CRM). QuickBooks for accounting. Subs are reliable about turning in receipts.

---

## 2. The critical finding from his real estimate (held back from the pitch deck, per Nick's instruction — still true and load-bearing for internal work)

Analyzed a real completed estimate (**Whitaker Oasis**, 14×24 pool w/ spa). It says "Cost Plus at 30%" — but that's **markup**, not margin. $35,086.55 fee on $116,955.18 cost = **23.08% actual gross margin**, not 30%. The relationship is fixed: `margin = fee ÷ (1 + fee)`. To get a true 30% margin the disclosed fee would need to be 42.9%.

**This can't be quietly fixed** — "Cost Plus at 30%" is printed on the customer-facing estimate; it's the disclosed contract fee, not an internal error.

**Two levers exist:**
- **Lever A** — raise the disclosed fee (to 42.9% for true 30%, or ~35% as a partial move).
- **Lever B** — expand what counts as reimbursable "cost" in the cost-plus agreement, so GP doesn't have to absorb costs the customer should pay. Doesn't change the margin *percentage*, but recovers real dollars (est. ~$15,600 on a job like Whitaker if ~$12k of currently-absorbed costs move into the base).

**Decision made: Lever B.** Lubbock's referral density makes a visible fee hike riskier than it looks in a bigger market. If 30% margin is a hard requirement, the honest answer is *both* — expand the base and nudge the fee toward ~35%.

**Lever B cost tiers (in Foundation doc §3):**
- **Tier 1, clean, move in:** permits, geotech report, structural engineering, labor burden, job-specific equipment rental, rebound haul-off, fill/curing water, startup chemicals, warranty work actually performed.
- **Tier 2, needs a documented allocation basis:** PM/supervision time, trucks/fuel, small-tool consumables. This is why PRD 02 now has to output **labor and supervision hours**, not just material quantities — supervision should allocate by **build duration**, not cost percentage (a $150k and $90k pool on the same 7-week calendar eat similar PM time).
- **Tier 3, never in the base:** office overhead, marketing, owner comp, sales commission, and a warranty *reserve* (billing for costs not yet incurred is hard to defend under cost-plus).

**Also decided:** the expanded Lever B base should **not** count toward commission GP — the salesperson didn't earn a fee on reclassified PM salary.

**Gating everything in Lever B: a contract review.** Nobody has yet confirmed what his actual cost-plus agreement defines as reimbursable cost. Nothing here can be implemented until that's answered.

**A second structural problem found:** under cost-plus, commission paid on GP creates a perverse incentive — costs rise → fee rises → GP rises → commission rises. The salesperson is financially rewarded when a job costs more. Foundation §7 has three fix options; the one that matches what Nick described is paying both commission stages on **estimated** GP and treating reconciliation as a pure release gate rather than a recalculation.

---

## 3. The quantity takeoff — proof of method

Built a full reverse-engineered takeoff for Whitaker Oasis to prove every dollar line on a cost-plus estimate can trace to a real quantity (`whitaker-oasis-quantity-takeoff.md`). Key numbers: 921 sq ft wetted area (pool + spa + steps — corrected from an earlier 716 sq ft estimate, which was off by 28%), 104 LF perimeter, 13,222 gallons, 95 bank yd³ excavation, **2,070 LF of #3 rebar** (this is the allocation basis that solves the "shared truckload of rebar" problem), 28.3 yd³ gunite ordered, 44 bags plaster.

**Cross-checks against published rates:** gunite at $424/yd³ and plaster at $85/bag both validate — his pricing instincts are good, just undocumented and untransferable.

**Correction mid-project:** the estimate was first assumed to be DFW-area (expansive clay, pier/grade-beam risk). Travis confirmed **Lubbock**, which flips the geology read: the real cost driver is **caliche** (starts ~27" deep, right in the dig zone), rainfall is low enough (19"/yr) that clay-swell/pier risk is much smaller than DFW, and real gaps are a caliche excavation contingency, a gas line for the heater (never on the estimate), and freeze/seasonal build-calendar constraints.

**Never resolved:** spa dimensions (assumed 7×7×3.5 ft — never stated anywhere on his estimate, contaminates every derived unit cost) and deck square footage (never stated, largest unquantified line item, currently just a $10,000 allowance).

---

## 4. PRD 02 — Pool Proposal & Takeoff Engine (`apex-prds/02-proposal-takeoff-engine.md`, v0.2)

**Approach:** don't replace his customer-facing estimate — it's branded and familiar. Add a **hidden quantity layer** behind it (qty × unit cost → the same dollar figure the customer already sees), so pricing gets documented without retraining anyone. Phase 0 builds this in his existing spreadsheet, not new software; tool choice (Monday/Airtable/custom) is deliberately deferred to Phase 2, after the method is proven.

**Blocked on:** whether he has recorded dimensions for past jobs (only found out he has estimate sheets like Whitaker's — never confirmed if dimensions exist anywhere else). This is the unblock needed to start Milestone 1.

---

## 5. Pool Service — the fourth vertical

Was buried as a bullet ("Weekly Maintenance & Cleaning") under Designer Pools. Promoted to a full vertical because it's structurally different from the other three: **recurring revenue** (so acquisition cost should be judged against LTV, not first-job value), **urgent/short buyer journey** (green pool, dead pump — phone call, not a quote form, so speed-to-lead matters most here), and it's the **cross-sell engine** — every pool build should become a service account, and every service account is a standing prospect for coatings and remodel work.

**Two things this breaks that aren't resolved yet:** Foundation's "one Job = one contract = one commission calc" model doesn't fit a recurring account (needs an amendment), and recurring-revenue commission structure is completely undefined (deliberately out of scope for now — flagged, not solved).

---

## 6. Website / lead capture — PRD 01 (`apex-prds/01-lead-capture-funnels.md`)

Site is `apexgetsitdone.com`, built by an agency (**Monsoon**) — **decision made to replace them**, Nick owns the rebuild. The "Which Apex" vertical router works structurally, but everything converges into **one untagged form, one phone number, one inbox** — so close rate and conversion % by vertical (the explicit original ask) are currently impossible to compute, no matter what CRM gets chosen. A TCPA-relevant bug: the SMS consent checkbox always names "Apex Concrete Coating" regardless of which vertical the customer is inquiring about (fixed in the mockup demo). Domain sprawl across three domains — canonical choice deliberately left open for Nick.

**Facebook is the live paid channel.** The highest-value single automation identified: push **won-job value back to Meta as an offline conversion**, so the algorithm optimizes toward revenue instead of form fills. Flagged risk: this will likely shift ad spend toward pools (highest value) and away from coatings, which may look wrong to Travis if coatings currently drives lead volume — worth setting expectations before flipping it on.

**n8n was redirected away from AI content-generation SEO** (Lubbock's search volume is too thin to matter, and scaled AI content risks Google's spam policies) **toward operations**: speed-to-lead auto-response, review-request automation, Google Business Profile posting, lead-to-CRM stitching, attribution reporting, the Meta offline-conversion upload. A human still writes the actual words.

---

## 7. What's been built (Claude Code-ready handoffs)

Two things are fully packaged for an AI coding agent to execute — repo layout, `CLAUDE.md` standing rules, a data contract, checkable acceptance criteria, and explicit `⚠ BLOCKED` gates so the agent stops instead of guessing:

**`apex-website/`** (zipped) — Astro + React-islands site. The spine is a strict lead-object schema (vertical + full attribution captured on every submit, `lead_id` as the join key). Reference spec is `apex-mockup.html`, a live interactive HTML mockup already built — four-vertical color-coded router, deep pools section, shallow treatment for the other three, a live "CRM capture" demo panel that shows exactly what gets tagged when a lead submits (this is PRD 01's whole argument as a four-second interaction). Blocked on: access transfer from Monsoon (D-01), canonical domain choice (D-03), content-editing model (D-07).

**`apex-lead-engine/`** (zipped) — the n8n automation layer, same lead object contract, deploys to Apex's self-hosted n8n on Hostinger via the Workflow SDK. Hard rule: the speed-to-lead response must fire *before* any slow CRM write — respond first, record second. Phases 1–2 (intake, speed-to-lead) and monitoring are buildable now; Phases 3–5 (CRM stitch, reviews, Meta loop) are blocked on CRM choice (D-10), SMS provider (D-11 — Twilio recommended, start A2P 10DLC registration early, it's slow), a job-status signal source (D-12), inbox confirmation (D-13), and Meta access (D-01).

**`apex-strategy-deck.pptx`** — 13-slide exec strategy/roadmap deck in Apex's brand (charcoal `1B1C1E` + amber `E0901B`, four vertical accent colors). Built as an exec summary that works for both Travis and internal use. **The 23%-margin finding is deliberately not in it** — commission language stays at "true, reconciled profit" without the reveal. Closes on the four-phase roadmap (Capture & Convert → Price & Prove → Pay & Manage → Compound), no pricing slide, per explicit instruction.

---

## 8. Consolidated open questions (blocking, not yet answered)

1. Does he have recorded pool dimensions anywhere, or only price-list estimates like Whitaker's? *(blocks PRD 02)*
2. QuickBooks setup — Projects on? Classes in use? One company file across all three legal businesses, or three? *(blocks PRD 03, pinned)*
3. What does the actual cost-plus contract define as reimbursable "cost"? *(gates all of Lever B)*
4. Does the 30% fee recalculate when allowance line items (turf, decking, fence — currently $17k of "budget" on Whitaker) come in different from estimate? *(blocks the commission engine, PRD 04)*
5. Final call on fee rate — stay at 30% disclosed, or pair Lever B with a bump toward ~35%?
6. Why does "Permits" show $0.00 on his estimate with a live line item?
7. Access transfer from Monsoon — who currently holds domain registrar, hosting, GTM, GA4, Meta Business Manager, Google Business Profile?
8. Canonical domain choice among the three currently in play.
9. Current Facebook ad spend, structure, and which verticals it targets.
10. Current lead volume/mix, and who answers the phone today (speed-to-lead is partly a staffing question, not just a tooling one).

---

## 9. Parked / not started

**Numbering note:** PRDs were renumbered by build order in July 2026. Old → new: Takeoff 1→02, Cost capture 2→03, Commission 3→04, Lead capture/marketing 4→01, CRM→05, PM boards→06. See `apex-prds/README.md` for the full mapping.

**PRD 03** (QuickBooks cost-capture structure) — explicitly pinned, waiting on Q2 above. **PRD 04** (commission engine) — waiting on Q3/Q4 above; the formula itself (15%/15% staged, floored at zero, non-negative) is already spec'd, just not gated open. **CRM platform selection** and the **recurring-service commission model** — not started.

---

## 10. How to resume

Most likely next steps, in rough order of what unblocks the most: (a) get QuickBooks and contract-review answers from Nick so PRD 03 and Lever B can move, (b) start Phase 1 of the website repo in Claude Code since it has zero blockers, (c) once dimensions data comes back, unblock PRD 02 Milestone 1. If Nick opens a new chat without re-uploading anything, this document alone is enough to keep advising at the same depth — the underlying files just aren't editable until re-uploaded.
