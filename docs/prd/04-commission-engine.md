# PRD 04 — Commission Engine

> **STATUS: WRITTEN (v0.1) — 2026-08-05.** Every input is answered and PRD 03 is
> written. The formula was settled long before this document; what took the time
> was three inputs, and all three closed on 2026-08-05 — the allowance mechanic
> and both contested points in the formula.
> **Depends on:** `00-foundation.md`, `03-cost-capture-allocation.md`
> **Gates:** nothing. This is the end of the chain the project started for.
>
> **It cannot run until one job is reconciled.** PRD 03 §13's ninth item — a
> single job carried all the way to a declared actual GP — is what Stage 2 reads.
> Until that exists this engine has nothing to compute against. That is a
> sequencing fact, not a missing decision.

---

## 1. What this is for

**Commission standardisation is the reason this project started.** Everything
else — the takeoff, the cost capture, the gates — sits underneath the question of
what a salesperson is owed and when.

The engine's job is narrow: take a reconciled job, compute two payments, and show
the arithmetic. It is a **layer, not a platform feature.** Monday will not do
two-stage margin-based commission natively and should not be made to.

---

## 2. The formula

Pools. **30% of gross profit**, in two stages.

| Stage | When | Amount |
|---|---|---|
| **1** | At sale, on the accepted proposal | 15% of **estimated** GP, paid as an **advance** |
| **2** | At reconciliation | Trues up to 30% of **collected** GP, floored at zero |

**Stage 1 is an advance.** It is money against a commission that is *earned* on
collection. That distinction is what resolved the conflict between paying at sale
and settling on collected GP — Foundation §7.1 records the three alternatives and
why this was chosen over them.

**The advance is never clawed back.** A disaster job means the rep keeps Stage 1
and Stage 2 floors at zero. Deliberate: a commission plan that can go negative is
one salespeople price into their behaviour, and the behaviour it buys is not the
one Apex wants.

### 2.1 What is in the base

**GP is calculated before sales commission** (Foundation §1.4). Non-negotiable —
commission paid on gross profit that already has commission inside it is a
definition eating its own tail. It never books to a job cost code, and PRD 03 §4
has no code for it precisely so that cannot happen by accident.

**The Lever B expanded base counts — Tier 1 only** (Foundation §3.3, decided
2026-08-05 against the recommendation that had been on file). Worth about **$950
per pool**, roughly **$18,000 on a 19-pool year**.

That figure is 30% of the added *gross profit* — the fee on the moved base, about
$3,200 — not 30% of the added revenue. Getting that wrong overstates the cost of
the decision roughly fivefold, which it did while the decision was being made.
Foundation §1.5 carries the worked example to check a statement against.

**If Tier 2 ever moves into the base, this is revisited rather than inherited.**
The original objection — that a rep did not earn a fee on reclassified PM salary —
is wrong about permits and geotech and still right about supervision time.

**Excluded outright:** sales tax · pass-through amounts carrying no fee ·
financing charges · warranty rework · unapproved overruns · uncollected revenue.

---

## 3. What "collected" requires

Stage 2 cannot be computed from cost data. It needs, per Job ID, what was
**invoiced**, what was **collected** and when, and what remains **outstanding** —
net of the exclusions above.

**QuickBooks is the authority.** PRD 03 §8 carries this input specifically
because this document forced it: Apex OS holds draw status and a named human's
invoice confirmation but is explicitly not the financial authority
(`docs/status.md`). Apex OS says a draw is *ready to bill*. QuickBooks says
whether it was billed and whether the money arrived.

**Partial collection is the normal case, not an edge case.** The draw schedule is
10 / 30 / 30 / 20 / 10, so a job is collected in five pieces over months. Stage 2
is computed on what has actually landed at the moment it runs — which means a job
can be reconciled for cost and still owe a further top-up as the final draw
clears.

**The engine must therefore be re-runnable per job, not a one-shot at close.**
Each run pays the difference between what is now earned and what has already been
paid. That single property is what keeps "settle on collected GP" from meaning
"wait until every dollar is in before paying anything".

---

## 4. The incentive this accepts

**Under cost-plus, commission on GP rewards cost overruns.** Costs rise → the 30%
fee rises → GP rises → commission rises. On a Whitaker-sized job a 10% overrun
adds roughly **$1,050** to the cheque. That is arithmetic, not a hypothetical.

Foundation §7 offered three ways to blunt it. **None was taken**, and §7.1
records that as a chosen position rather than an oversight. **The engine must not
quietly implement one of them:** reconciliation is a *recalculation*, not a cap.
Building in a cap "to be safe" would be reversing a decision in code that was
made in a document.

**What makes it defensible.** Commission is earned on *collected* GP, so a job
that overruns and cannot be collected pays nothing extra. Unapproved overruns are
excluded from the base outright. The residual exposure is *approved* overruns on
*collected* jobs — which under cost-plus is largely scope the customer asked for
and paid for.

**Two mitigations are designed and deliberately unadopted.** Both are engine
rules rather than redesigns if the exposure proves real:

1. Cap Stage 2 at the **lesser** of estimated and collected GP.
2. Exclude **Apex-initiated** change orders while including customer-initiated
   ones.

**The trigger to revisit is the first job whose commission is materially larger
than its estimate implied** — not a quarterly review, and not a feeling. That is
checkable: Stage 2 exceeding Stage 1 by more than the schedule predicts is a
report, and it should exist from day one.

---

## 5. Mechanics

**n8n pulls reconciled job-cost and payment data, computes both stages, writes
the result back.** Small, well-bounded, and genuinely the highest-value custom
work in the engagement.

The engine holds no state of its own. Given a Job ID it reads the accepted
proposal's estimated GP, the reconciled actual cost, the collected total, and
what has already been paid out. All four exist once PRD 03 holds.

**Every payment shows its arithmetic.** A commission statement a salesperson
cannot check is one they will dispute, and the dispute costs more than the
transparency buys. Foundation §1.5 exists to be checked against by hand.

### 5.1 It is also the enforcement mechanism

**Stage 2 cannot be calculated until every cost is logged and the job is
reconciled. No cost data, no second cheque.**

That is not a side effect to engineer around — it is what makes the whole costing
system stick. PRD 03 asks a real behaviour change of the office and the field,
and this is the reason anyone completes it.

---

## 6. What is not defined

**Remodel, coatings and pool service commission structures are undefined.** The
formula above is built from a pool estimate with a disclosed cost-plus fee, and
none of those three has that shape.

**Pool Service is a genuine design problem, not an omission.** Foundation §2's
rule — *one Job = one contract = one GP calculation = one commission
calculation* — does not describe a service account, which is recurring revenue
with no completion and no reconciliation. Amending §2 is a prerequisite to
commissioning service at all, and register item 15 keeps service out of the first
implementation for exactly this reason.

**Sales fee-rate discretion is settled and belongs here:** none unilateral
(register item 8). Sales may recommend a deviation; anything below the standard
rate, or any unusual exclusion, needs written approval. Without that rule the
commission base is whatever the rep negotiated, and the fee rate holding at 30%
(item 4) means nothing.

---

## 7. Definition of done

1. Stage 1 computes from an accepted proposal and pays 15% of estimated GP.
2. Stage 2 computes from a reconciled job and trues up to 30% of collected GP,
   floored at zero, with the advance never clawed back.
3. Tier 1 Lever B costs are in the base; Tier 2 is not.
4. The six exclusions in §2.1 are applied and visible as line items, not netted
   away silently.
5. Re-running Stage 2 after a later draw clears pays the additional top-up and
   nothing else (§3).
6. A report exists for Stage 2 exceeding what the estimate implied (§4).
7. One statement reconciles by hand against Foundation §1.5.
8. **One real job pays both stages end to end.**

**Item 8 is the one that matters, and it is the same job PRD 03 §13 ends on.**
The chain — takeoff → proposal → cost capture → reconciliation → commission — has
never been run once on real work. Running it once is worth more than any further
specification of it, including this document.
