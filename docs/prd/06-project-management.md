# PRD 06 — Job Execution & Crew Scheduling

**Status:** v0.1 — written 2026-07-26. Supersedes the placeholder.
**Depends on:** `00-foundation.md` (Job ID, cost codes, reconciliation), `02-proposal-takeoff-engine.md` (schedule and budget source)
**Scope:** Pools first. Three job shapes across four verticals (§3)

**Why this is being written now, having been deferred.** The placeholder deferred this on two
grounds: PRD 05 owned the platform decision, and PRD 03 defined the phases. Both have moved.
The platform is settled — Monday.com, Nick's call — and PRD 05 now owes only pipeline stages and
reporting, which job execution does not consume. PRD 02's engine already emits the phase schedule,
so the phases exist. What remains genuinely gated on PRD 03 is **actuals**, and §8 scopes that out
of the first phase rather than blocking the whole document on it.

A third reason: a small slice of this PRD unblocks two automations that have been stuck for weeks
(§7), and the capacity model (§2) produced a finding that should reach Travis before he starts
another job — not after a board gets built.

---

## 1. What project management is actually for here

In fixed-price construction, PM protects margin: overruns eat the builder, so every generic tool
centres budget-versus-actual.

**That is not this business.** Foundation §3 is explicit — under cost-plus, revenue derives from
cost, overruns pass to the customer, and GP percentage is structurally locked by the fee rate. A
$2,000 overrun does not hurt Travis.

Three things do:

1. **Cycle time.** A job running 13 weeks instead of 8 burns PM and supervision time that GP
   absorbs today (Foundation §5.3), ties up working capital, and delays the next start.
2. **Substantiation.** Cost-plus carries audit rights. A cost that arrives without a document
   attached is a cost he cannot defend billing (Foundation §8).
3. **Referral risk.** Lubbock's referral density is precisely why Lever B was chosen over a visible
   fee increase (Foundation §3.1). A change-order conversation that goes badly costs more than the
   change order.

Variance tracking still matters — for **calibrating unit costs** (PRD 02 Milestone 1) and for
**gating commission reconciliation** (§10). It does not matter as a margin-protection mechanism.

> **Design consequence:** if the daily screen leads with a budget chart, this PRD has been
> implemented wrong. Budget belongs on a weekly and end-of-job view.

---

## 2. The capacity finding — read this before designing anything

**Resourcing, confirmed 2026-07-26.** Subs handle **excavation, gunite, electrical and concrete
decking**. One in-house crew with one lead handles **everything else**. Maximum five jobs at once.

Running that through the schedule model (`apex-proposal-engine/crew.mjs`) separates elapsed
duration from crew effort — they are not the same, and conflating them breaks capacity planning.
Fill and startup runs 5.3 elapsed days but is mostly monitoring; a sub phase can run for days while
the crew spends an hour on site.

**A Whitaker-sized pool: 22.1 working days elapsed, but only 13.7 crew-days.**

The rest is sub work or waiting — and that waiting is exactly what allows one crew to carry more
than one job. **The 24 lag days per pool are not dead time; they are where capacity comes from.**

Applying Little's Law — N jobs in flight at cycle time T gives throughput N/T, each job costs C
crew-days, the crew supplies 5 per week, so `T = max(technical minimum, N × C / 5)`:

| Jobs in flight | Cycle time | Crew loaded | Pools / year |
|---|---|---|---|
| 2 | 7.8 wk | 70% | 13.3 |
| **3** | **8.2 wk** | **100%** | **19** ← knee |
| 4 | 11.0 wk | 100% | 19 |
| 5 | 13.7 wk | 100% | 19 |

**The crew saturates at three concurrent jobs.** Below that it idles and output is left on the
table. Above it, annual output is flat at ~19 pools and only the queue grows. At the stated
five-job maximum, **every customer waits 5.5 weeks longer for the same number of pools per year.**

Under cost-plus that is pure loss: no extra revenue, more PM time absorbed by GP, a longer
referral-risk window.

**Honest caveat.** Crew effort per phase is estimated, not measured. Across plausible values
(8–17 crew-days) the saturation point lands between 3 and 5, so the exact cap is unsettled. The
*shape* holds everywhere — there is a knee, output is flat past it, and running above it buys only
wait. **Logging actual crew-days on the next two pools pins it down**, which is why §9 makes that
the highest-value field in the system.

---

## 3. Three shapes, not four boards

The placeholder called for four separate workflows. Refined: pools and renovation share a shape,
and service is not a project at all.

| Shape | Verticals | Model |
|---|---|---|
| **Project** | Designer Pools · Design & Renovation | Phased, multi-week, gunite-pivoted, crew-interleaved |
| **Job** | Concrete Coating | 1–2 days. Schedule → do → close. No phase machinery |
| **Route** | Pool Service | Recurring visits. Route and cadence, not a project |

Forcing Service onto a phase board is the failure mode the placeholder warned about; giving
Coating eleven phases is the same error in the other direction. **This PRD specifies the Project
shape only.** Job and Route shapes are named here so nobody builds them by extending Project, and
are deferred to their own scope.

---

## 4. Gunite is the pivot, and it is a queue

**There is one gunite crew in Lubbock.** That makes it the only hard external constraint in the
business, and it sits in the middle of every pool build:

- Everything **before** it is a deadline — dig, steel, plumbing rough and pre-gunite inspection
  must all clear or the slot is lost
- Everything **after** it depends on it — 10-day cure → tile and coping → deck → plaster → startup

**So jobs are not forward-scheduled from a start date. The gunite slot is booked first and the
schedule is built backward from it.** Missing the date does not cost a day; it costs a place in the
queue.

Two compounding factors:

- **Freeze season closes it entirely.** Gunite cannot be shot in a hard freeze (reference §0, §5.5),
  so the Lubbock calendar has a closed season and a pre-freeze rush against a single crew.
- **Cure is weather-coupled.** High Plains wind raises evaporative demand during the wet-down
  window, so the cure lag is a gate with conditions, not just a timer.

Gunite slots are therefore modelled as a **bookable resource with a waitlist**, not as a task
inside a job. It is the scarcest thing Apex touches and deserves its own object.

---

## 5. More than half the calendar is waiting

Whitaker derives as **22.1 working days + 24 lag days**: permit issuance 7, pre-gunite inspection 2,
shell cure 10, deck cure 5.

Task-completion tracking therefore covers a minority of the timeline. **Jobs slip in the lag**, and
the two failure modes that matter are both invisible on a per-job Gantt chart:

- **The crew goes idle** because no job is ready for them
- **A job sits finished-curing** while the crew is elsewhere and nobody noticed the gate opened

Both are obvious on a single crew timeline. So the primary operational view is **the crew, not the
job**, and the alerts that matter fire on *lag expiry and lag overrun* — "permit requested 9 days
ago, still not issued" — rather than on task completion.

---

## 6. Architecture

Travis runs the jobs himself. There is no dedicated PM, so the system gets opened once a day at
best and must **push** rather than wait to be curated.

**The daily screen answers four questions and nothing else:**

1. Where is the crew today and tomorrow?
2. What is blocked, and for how long? *(permit at day 9 · cure complete · inspection unscheduled)*
3. What gunite dates are booked, and which job still needs one?
4. What needs a decision from me right now?

**Boards:**

| Board | Item = | Purpose |
|---|---|---|
| **Jobs** | one job | Contract, customer, Job ID, budget by cost code, status, WIP gate. Visited weekly |
| **Schedule** | one phase instance | Crew timeline, sub assignment, lag watch. **The daily screen** |
| **Gunite slots** | one bookable date | Queue and waitlist against the single Lubbock crew |

**Phases are items on the Schedule board, not subitems under jobs.** This is the load-bearing
structural call. Subitems are the natural modelling choice and the wrong one here: Monday cannot
give a clean cross-job resource view from subitems, and *the cross-job crew view is the entire
product*. At five concurrent jobs the volume is trivial (~55 phase items at peak), so the
complexity has to be justified by views — and it is.

**Push, don't poll.** Monday automations drive the notifications that matter: cure completing
tomorrow, permit aging past normal, gunite booking window closing, job ready to reconcile.

---

## 7. The job-status signal — smallest slice, largest unblock

Status transitions: `lead → quoted → won → in progress → complete → reconciled`
(`lead` and `quoted` live in PRD 05's pipeline; Job ID mints at **won**, per Foundation §2, and is
never edited.)

Two systems are waiting on this and neither needs boards:

- `apex-lead-engine` **Phase 4** — review requests, fire on **complete**
- `apex-lead-engine` **Phase 5** — Meta offline conversions, fire on **won**, with value

Both are logged there as `⚠ BLOCKED — D-12`. **This is a status column plus two webhooks.** It
should ship before anyone designs a board layout, because it releases work that is otherwise stuck
and it is independent of every open question below.

---

## 8. Zero re-entry, and what is deliberately deferred

PRD 02's success criterion is that an accepted proposal generates a job budget **with zero
re-entry**. The engine already emits everything a job needs: eleven phases with elapsed durations,
lag days and crew-days; budget by cost code; crew and supervision hours.

**The board is generated from the accepted proposal, not typed.** If anyone re-keys the schedule by
hand, the takeoff argument collapses at the exact moment of handoff.

**Deferred to PRD 03, on purpose:** actual costs. Phase 1 of this PRD needs schedule and status
only. Estimate-versus-actual by cost code arrives when QuickBooks structure is settled (Foundation
open question 7), and blocking crew scheduling on that would be backwards — the scheduling problem
is live today and the costing problem is pinned.

---

## 9. Crew-days: the one field worth fighting for

Every phase carries **crew-days spent**, entered when the phase closes.

Two pools' worth retires the largest assumption in §2 and converts the WIP cap from a modelled
estimate into a measured number. It also feeds Tier 2 supervision allocation (Foundation §3.2 /
§8), which Lever B needs and which currently rests on a duration model rather than observation.

It is one numeric field. It is the highest-value data the system can start capturing on day one,
and it should be treated as non-optional even if everything else about a phase is skipped.

---

## 10. The reconciliation gate is a financial control

`complete → reconciled` is not a status change. It **releases Stage 2 commission** (Foundation §9,
PRD 04), so it needs an owner and a checklist, not a dropdown:

- All sub invoices received and attached
- All POs closed
- Allowances trued up against actual — and the fee mechanic applied per Foundation §6
- Warranty and callback items logged
- Estimate-versus-actual reviewed by cost code *(gated on PRD 03)*

Until the allowance mechanic is decided (Foundation open question 4) this gate can be built as a
checklist that a human closes; it cannot be automated, because what "actual GP" means is not yet
defined.

---

## Success criteria

Checked 90 days after rollout:

- **Crew utilisation is visible** — Travis can see idle crew days before they happen, not after
- **Zero jobs sitting past an expired gate** unnoticed for more than one working day
- Every pool build is created from an accepted proposal with **no hand-keyed schedule**
- **Actual crew-days captured on 100% of closed phases** — the §9 field
- Gunite dates booked ahead of the pre-freeze rush rather than negotiated into it
- Job status emits reliably enough that lead-engine Phases 4 and 5 run unattended
- **WIP against the knee is a decision Travis makes with the number in front of him**, not implicitly

---

## Scope

**In:** Project-shape execution for pools · crew timeline and load · gunite slot queue · phase
lag/gate tracking with push alerts · job status model and outbound signal · crew-days capture ·
WIP gate against crew capacity · reconciliation checklist · outbound sub scheduling messages

**Out:** Cost actuals and estimate-vs-actual (PRD 03) · commission calculation (PRD 04) · pipeline
stages and conversion reporting (PRD 05) · Job and Route shapes for Coating and Service (§3) ·
crew time clocks · inventory or yard tracking (Foundation §8 rejects it) · customer portal ·
auto-shifting Gantt dependency chains (§Risks)

---

## Approach

**Phase 1 — status signal (days, not weeks).** Status model on the Jobs board plus two webhooks.
Unblocks lead-engine Phases 4 and 5. No board design required.

**Phase 2 — Schedule board and the daily screen.** Phases as items, crew timeline, lag watch,
gunite slots. Generated from the takeoff engine's schedule. This is where Travis's day changes.

**Phase 3 — crew-days capture and the WIP gate.** One field per phase; capacity readout on the
Jobs board. After two pools, re-run §2 against measured effort and set the real cap.

**Phase 4 — reconciliation checklist.** Gated on the allowance mechanic (Foundation open
question 4).

**Phase 5 — cost actuals.** Gated on PRD 03.

---

## Risks

| Risk | Mitigation |
|---|---|
| Travis is the only user and stops opening it | One screen, four questions, and push notifications. If it needs curating it will be abandoned |
| Subs are off-platform, so assignment does nothing | Assignment **generates an outbound message**, it does not set a field. Shares the Twilio / A2P 10DLC rail with the lead engine (D-11) — worth starting that registration early, it is slow |
| Auto-shifting dependency chains break constantly | Don't build them. Real dependencies are gunite availability and cure, not task-to-task links |
| Phase templates drift from cost codes | Templates are generated from the takeoff, which is already keyed to Foundation §4 codes |
| Crew-days never get entered | It is one field, it is the point of Phase 3, and without it the WIP cap stays a guess |
| The WIP finding is resisted because five jobs *feels* more productive | Show the table, not the conclusion. Same pools per year, five weeks more wait each |
| Building boards before the engine feeds them | Phase 2 consumes the takeoff schedule directly; anything hand-built gets torn out |

---

## Milestones

| # | Deliverable | Gate |
|---|---|---|
| 1 | Job status model live, two webhooks emitting | Lead-engine Phases 4 and 5 unblocked (D-12) |
| 2 | Schedule board generated from an accepted proposal | Zero hand-keyed phases |
| 3 | Crew timeline and lag alerts in daily use | Travis stops asking "what's the crew on tomorrow" |
| 4 | Gunite slots booked from the queue | A season planned ahead of the freeze, not into it |
| 5 | Crew-days captured on two complete pools | §2 re-run on measured effort; WIP cap set |
| 6 | WIP gate live on the Jobs board | Starting job N+1 shows its cost to the others |
| 7 | Reconciliation checklist | Foundation open question 4 answered |

---

## Open questions

1. **Does the crew lead get Monday access?** The single most valuable non-Travis user — phase
   completion and crew-days entered from the field beat Travis entering them from memory. If not,
   both have to arrive by text and someone transcribes.
2. **How far ahead does the gunite crew book, and how firm are slots?** Sets whether the queue is a
   calendar or a waitlist, and how early the pre-freeze rush has to start.
3. **When does gunite actually close for freeze in Lubbock?** Needed to model the closed season
   rather than hand-wave it.
4. **Actual crew-days per pool** — the §2 assumption. Two logged pools settles it.
5. **Concrete Coating volume per month?** Determines whether the Job shape is a real board or a
   simple calendar.
6. **Is Pool Service in scope this year at all?** The Route shape is a different tool; knowing
   whether it's imminent affects nothing in Phase 1–3 but changes the workspace layout.
7. **Who else touches the system** — office admin for invoices and receipts? Affects the
   substantiation path in §1.2 more than the scheduling path.
8. **Does Travis want the WIP gate advisory or blocking?** Recommend advisory — surface the cost of
   starting job N+1 and let him decide. A hard block on the owner's own board gets disabled.
