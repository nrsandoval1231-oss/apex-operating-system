# Apex Construction Model - Confirmed Decisions

**Recorded:** 2026-07-31

> **Superseded for active workflow (2026-08-13):** This document preserves the original nine-phase/seven-Gate/two-signature decision and must not be read as the current model. Active authority is the migration chain through `0030_equipment_automation_cover_gates.sql`, [`single-signature-gates.md`](single-signature-gates.md), and root [`STATUS.md`](../../STATUS.md). The current system has 11 phases, nine active Gate definitions, and one authorized release signature.
**Source:** Nick Sandoval, this session
**Status:** Confirmed for build. **All open flags resolved 2026-07-31** — see §5. **Inspection list, lead times, and the revised gate checklists approved by Travis Sandoval 2026-08-03** — see §6 and `docs/inspections-and-gate-checklists-2026-08-03.md`.
**Resolves:** PRD §20 Q3 (gate authority), Q4 (phases and gate templates), Q5 (draw schedules), Q6 (jurisdictions)
**Built:** migrations `0010_project_phase_model.sql` (phases, milestones, project record, superintendent role) and `0011_gate_countersign.sql` (two-signature pre-gunite, money-gate delegation)
**Unblocks:** Build plan Step 2 (project + phase model), Step 3 (generalize gate engine), Step 6 (draw schedule)

---

## 1. Construction phases

Nine phases, in order:

| # | Phase |
|---|---|
| 1 | Design, Engineering & Permitting |
| 2 | Layout & Excavation |
| 3 | Steel Reinforcement (Rebar) |
| 4 | Plumbing & Electrical Rough-In |
| 5 | Gunite/Shotcrete Concrete Pour |
| 6 | Waterline Tile & Coping Installation |
| 7 | Patio Decking & Hardscaping |
| 8 | Pool Pad Equipment Hookup |
| 9 | Interior Plaster Finish & Water Fill |

This replaces the "proposed baseline" 15-phase list in PRD §8.2, which was never confirmed and should not be built.

## 2. Draw schedule

**Source: Apex's actual contract schedule.** Confirmed authoritative 2026-07-31. Percentages total 100%.

| Draw | % | Released by | Covers |
|---|---|---|---|
| Deposit | 10% | Contract signing (no gate) | Architectural design, engineering plans, permit submission fees |
| Draw 1 | 30% | **Excavation gate** (end of Phase 2) | Heavy machinery rental, dirt hauling, initial steel rebar installation |
| Draw 2 | 30% | **Shell gate** (end of Phase 5) | Structural plumbing, structural electrical rough-in, concrete shell shoot |
| Draw 3 | 20% | **Deck & tile gate** (end of Phase 7) | Waterline tile, coping stones, patio decking |
| Final Draw | 10% | **Final gate** (end of Phase 9) | Plaster or pebble coat, water fill, mechanical equipment start-up |

**Confirmed:** Draw 1 releases on **excavation verified (end of Phase 2)**, not on rebar completion. It therefore funds Phase 3 rebar work in advance. This is the only draw that pays ahead of verified work; all others pay in arrears. This is contract behavior, not a modelling choice - do not "correct" it.

**Data model note:** the Deposit is not gate-triggered. The draw schedule table must permit a draw whose release condition is contract signing rather than a gate release.

**Evidence gap:** no signed contract document is currently held in the repo as evidence for these percentages. For a system whose premise is verified evidence, the governing contract should eventually be attached to the project record.

## 3. Gate templates

Seven gates. Four are draw-bearing.

**Authority updated 2026-07-31** per §5. Every gate takes one signature from the owner or a superintendent — except pre-gunite, which takes both.

| Gate | Position | Verifies | Releases | Authority |
|---|---|---|---|---|
| Permit | End of P1 | Plans approved, permit issued | - | Owner or Superintendent |
| **Excavation** | End of P2 | Depth, dimensions, layout vs. plan | **Draw 1** | Owner or Superintendent |
| **Pre-gunite** | Before P5 | Rebar (P3) + plumbing/electrical rough-in (P4), pressure test | - | **Superintendent signs + Owner countersigns** |
| **Shell** | End of P5 | Gunite placed, shell verified | **Draw 2** | Owner or Superintendent |
| **Deck & tile** | End of P7 | Tile, coping, decking complete | **Draw 3** | Owner or Superintendent |
| Equipment | End of P8 | Pad hookup, start-up | - | Owner or Superintendent |
| **Final** | End of P9 | Plaster, fill, commissioning | **Final Draw** | Owner or Superintendent |

Authority now follows **what cannot be undone**, not what can be credited. The only gate needing two people is the only one that buries its own evidence.

**Already built:** the pre-gunite gate exists as a tested vertical slice (`packages/domain`, `packages/gate-service`, migration `0004`). It sits exactly where this model places it. Generalizing to the remaining six is build-plan Step 3.

## 4. Authority model

**Confirmed, as revised 2026-07-31:**

- Two roles pass gates: **Owner (Travis)** and **Superintendent**.
- **Either** may release any gate on one signature, including all four draw-bearing gates.
- **Pre-gunite requires two signatures**: a sign-off and an owner countersign, by two different people.

Superseded on 2026-07-31 (kept for history): owner alone on the four draw-bearing gates, superintendent alone on pre-gunite.

~~**Role mapping required.**~~ **Done 2026-07-31.** Migration `0010` added `superintendent` to the role set alongside `admin`, `office`, `field`, and `customer`. `admin` is the owner (Travis); `superintendent` is PRD §5.2's Project Manager / Superintendent, which the four-role model had been collapsing into `field`.

## 5. Resolved authority flags

**Both resolved by Nick Sandoval, 2026-07-31.** Built in migration `0011_gate_countersign.sql`.

### 5.1 Irreversibility vs. financial consequence — RESOLVED

**Decision: pre-gunite requires an owner countersign.**

Authority was allocated by *financial* consequence. It is now allocated by *physical* irreversibility, which is the option "reframe: owner authority on irreversible gates" from the original flag.

Pre-gunite is the hold point protecting against pouring concrete over defective rebar or un-pressure-tested plumbing. That outcome cannot be undone; a bad draw can be credited. So pre-gunite is the one gate that takes two people.

As built:

- The superintendent (or the owner) signs off once every requirement passes and every required photo is attached.
- The Gate does **not** release. Its status becomes `awaiting-countersign`.
- The owner countersigns, and only then does the Gate release.
- **The countersigner must be a different person than the signer.** A countersign by the same human is not a countersign. Enforced in the domain and again by a database constraint, because an authority control that lives only in application code is one refactor away from not existing.
- The countersign **blocks** the release rather than confirming it afterwards. A confirmation that arrives after the pour protects nothing.

### 5.2 Single-authority stall risk — RESOLVED

**Decision: the four draw-bearing gates may be released by the owner or a superintendent.**

This is the delegation option, made permanent rather than conditional on the owner marking himself away. Draws no longer stall when Travis is unavailable, which is what the vision requires.

Consequence worth naming: a superintendent can now release a draw on his own signature. The controls that remain are the gate's own evidence requirements, the append-only audit trail, and the fact that invoicing still takes a separate human confirmation (PRD §9.8). If that turns out to be too loose in practice, the fix is a countersign on the money gates too — the mechanism now exists and is one data change per definition.

## 6. Jurisdictions

**Confirmed: no jurisdictional variation.** All Apex work falls under a single inspection regime (City of Lubbock, 2021 ISPSC per `Apex Designer/README.md`). PRD §20 Q6 is closed. The inspection entity does not need a jurisdiction dimension.

~~**Still open for build-plan Step 5:** which inspections exist, who requests each one, and what lead time each requires.~~ **RESOLVED 2026-08-03.** Approved by Travis Sandoval against `docs/inspections-and-gate-checklists-2026-08-03.md`: seven inspections, their requesters, and their lead times, derived from the 2021 ISPSC and NEC 680 and built in migration `0018_inspections.sql`.

Two things that approval also settled:

- **Apex builds inside city limits only.** The county question is closed, and the inspection model correctly has no jurisdiction dimension. If Apex ever takes county work, that is a new migration and not a column default.
- **Lead times are two business days for routine trade inspections, three for finals.** These are deliberately conservative planning numbers rather than measured turnaround — the error is one-directional, so a lead time that is too long warns a day early rather than a day late. They can be tightened to observed turnaround at any time, one number per row, and doing so only sharpens the warnings.

## 7. Still open

| PRD §20 | Question | Blocks |
|---|---|---|
| Q12 | Which 3-5 active projects provide the best pilot coverage? | §21 Definition of Done - nothing real enters the system until answered |
| Q1 | Authoritative tool for active-project scheduling | Step 5 |
| Q2 | Authoritative tool for invoice and payment status | Step 6 |
| Q7 | Which customer messages may be sent automatically | Step 7 |
| Q8 | Where existing project photos and documents are stored | Evidence migration |
| Q9 | Which team members need pilot access | Step 2 provisioning |
| Q10 | Customer pages: stable link or short-lived secure links | Step 7 |

**Q11 (chemistry formula/dosing) is not open.** `docs/status.md` holds chemistry out of field deployment until separately approved.

## 8. What this changes in the plan

- **Step 2** can now build the real 9-phase model instead of PRD §8.2's unconfirmed 15-phase baseline.
- **Step 3** has a concrete target: six additional gate templates against the existing pre-gunite slice.
- **Step 6** has a real draw schedule with named release conditions.
- ~~**Step 5** remains blocked on the inspection list~~ — unblocked and built 2026-08-03; see §6.

PRD §8.2 should be updated to match §1 above, and PRD §20 Q3-Q6 marked resolved with a pointer to this document.
