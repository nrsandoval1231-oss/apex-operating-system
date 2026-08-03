# Apex OS v1 — Build Plan

**Source PRD:** [`PRD FINAL.md`](../../PRD%20FINAL.md) (Apex OS v1, Designer Pools, powered by GATE v3)
**Written:** 2026-07-31
**Status:** Approved 2026-07-31. **Steps 1–8 are complete and every MVP item in §19 is built.** The inspection list, lead times, twelve added checklist items, and the nine customer-facing phase descriptions were approved as written by Travis Sandoval on 2026-08-03 (`docs/inspections-and-gate-checklists-2026-08-03.md`). **Nothing in this plan is blocked and no content is awaiting sign-off.** The only remaining gap before a pilot is deployment — see the launch blockers in `docs/status.md`.
**Construction model:** [`docs/decisions/construction-model.md`](../decisions/construction-model.md) — nine phases, seven gates, 10/30/30/20/10 draws, confirmed 2026-07-31.

---

## 1. The headline: this is ~40% built already

The PRD reads like a greenfield product. It is not. This repo already contains a
tested operational spine that covers a large part of the PRD's hard middle —
identity, gates, evidence, authorization, and draw eligibility.

What already exists and passes tests (`pnpm verify`, 50/50 root + 1 integration):

| PRD section | Existing asset | State |
|---|---|---|
| §12 Data model, key identity rule | `packages/contracts` — canonical IDs, versioned Zod records, event vocabulary | Built |
| §9.4 Gate engine | `packages/domain` + `packages/gate-service` — requirements, evidence, evaluation events, release authority, idempotent commands | Built, **pre-gunite only** |
| §9.9 Photos and field evidence | migrations `0003_evidence_storage`, private bucket, byte hashing, MIME refusal | Built |
| §13 Permissions / audit | migrations `0002_rls` — admin/office/field/customer row-level policies; append-only event history | Built |
| §9.8 Draw readiness | draw-eligibility projection on gate release | Partial — eligibility only, no draw schedule |
| §9.11 Customer progress page | tokenized link, access log, published photos, server-rendered page at `/c/<token>` | Built (Step 7) |
| §17 Idempotent ingestion | idempotency keys on Gate commands, intake idempotency tests | Built |
| Field UI | `apps/gate-api/public` — authenticated field console | Built, narrow |

And one thing that is **not** tracked in git and needs a decision (below):
`apex-os/` — a 959-line React + Vite mock of exactly the PRD's UI (Today feed,
Projects, Project detail, Owner brief, Customer view). It is pure `mockData.ts`.
No backend, no auth, not in the pnpm workspace.

**Recommendation: do not start over.** Build the PRD by extending the spine and
wiring the mock UI to it. Starting fresh throws away the tested authorization,
evidence, and event model — which is the part that is genuinely hard to get right.

---

## 2. What the MVP cut line (§19) actually costs

Against PRD §19, the true MVP is nine items. Here is the real gap:

| # | MVP item | Gap |
|---|---|---|
| 1 | Projects | Medium — `jobs` exists; needs project record per §9.3 (owner, phase, milestone, target window, risks) |
| 2 | Construction phases | Done — 9 confirmed phases + 6 customer milestones, migration `0010` |
| 3 | Gates with checklists and photos | **Small** — generalize the pre-gunite slice to the 7 confirmed gate templates |
| 4 | Today action feed | Large — card generation engine is entirely new; UI mock exists |
| 5 | Inspection deadlines | Done — migration `0018`, seven inspections, last-safe-request dates, release blocking |
| 6 | Sub conflict detection | Medium — new scheduled-visit entity + overlap detection |
| 7 | Draw-release cards | Medium — draw schedule table on top of existing eligibility |
| 8 | Customer progress page | Done — migration `0016`, tokenized link, rotation, access log, published photos, server-rendered page |
| 9 | Daily owner brief | Small — derives from #4 once cards exist |

Biggest single new build is the **action-card engine** (#4). Everything on the
Today feed, the brief, and the notifications in §15 is one derived surface. Build
it once, as a query over project state, not as a per-feature to-do list.

---

## 3. Proposed sequence

Each step ends with something you can actually look at. No step starts until the
prior one's exit condition holds.

**Step 1 — Adopt the UI shell (small) — DONE 2026-07-31**
`apex-os/` moved to `apps/apex-os` and wired to `apps/gate-api`. Today, Projects,
and Project detail read the new `GET /api/jobs` read model; unwired screens
(Brief, Customer view) carry a visible sample-data banner. Exit condition met:
the Today feed renders real jobs, contract values, and Gate status from Postgres.

One departure from the plan: the wired screens do **not** fall back to sample
data. A load that fails or returns nothing shows an explicit signed-out, error,
or empty state. Rendering invented pools inside the system whose purpose is
trustworthy field evidence was the wrong trade.

**Step 2 — Project + phase model (medium) — DONE 2026-07-31**
Migration `0010_project_phase_model.sql` adds the nine confirmed construction
phases, the six customer milestones, the §9.3 project record, append-only phase
history, and the `superintendent` role the four-role model had no seat for.

Decisions taken during the build, each of which departs from a literal reading
of the PRD and should be challenged if wrong:

1. **The project record is keyed by `job_id`.** No `project_id` is minted. The
   canonical chain stays lead → job; a parallel identity would be a second thing
   to reconcile for no gain. "Project" is the PRD's word for the operational face
   of a Job.
2. **No project status column.** `jobs.status` already carries lifecycle. Two
   status columns on one thing is how a system starts disagreeing with itself.
3. **Handover is not reachable from a phase.** It is derived from job completion.
   A pool sitting in phase 9 with water in it has not been handed over, and the
   customer page must never say it has.
4. **Skips and reversals are allowed, with a mandatory reason.** A real jobsite
   backs up; refusing to record it only pushes the truth outside the system. The
   database enforces the reason, not just the service.
5. **Gate release authority moved onto the Gate definition** (`release_roles`,
   `countersign_roles`). This is Step 3's rule arriving early because Step 2 had
   to add the role anyway. The **field lead can no longer release any Gate** —
   that is the confirmed model, and it changed two existing tests.
6. **The phase and milestone tables refuse writes by statement.** They can only
   change by migration, which is the same discipline `events` already has.

Exit condition met: a job carries a current phase, a customer milestone, an
accountable superintendent, and a target window, all rendered from Postgres.

**Step 3 — Generalize the gate engine (small–medium) — DONE 2026-07-31**
Migration `0012_gate_templates.sql` seeds all seven confirmed templates and moves
pre-gunite to version 2 with the eleven-item PRD §9.4 baseline.

The engine changes that mattered more than the seeding:

1. **Release consequences became per-definition.** `draw.eligible` fires only for
   the four draw-bearing Gates. Every release used to create draw eligibility, so
   generalizing without this would have had Permit and Equipment inventing money.
2. **Customer wording moved onto the definition.** It was hardcoded to pre-gunite;
   seven Gates would otherwise have published the same sentence seven times.
3. **Gates are not sequenced.** A job imported mid-build opens whichever Gate it
   is actually at. Unopened Gates read as "not opened", never as skipped.

Exit condition met: Permit, Excavation, and pre-gunite all completed on one job
against the live local database — the three Gate types PRD §21 asks for.

**Caveat carried forward, and closed 2026-08-03:** the requirement checklists for
the six new Gates were written from the decision document's one-line "Verifies"
plus the draw schedule's "Covers", so they were never Apex's procedures. Migration
`0017` revised them against the 2021 ISPSC — adding twelve items, three of them
safety items that were missing entirely — and Travis approved the result as
written. They are now Apex's procedures. Definitions stay versioned, so a future
correction is a new version, not an edit.

**Step 4 — Action-card engine + Today feed (large) — DONE 2026-07-31**
One pure derivation in `packages/domain/src/cards.ts` produces twelve card kinds
across Things Need You / Running / This Week, each with reason, consequence,
urgency, and a link. `GET /api/today` serves it; the Today screen renders it.

Exit condition met: the feed shows cards nobody hand-wrote — an overdue target
window, two unbilled draws, a missing takeoff, and a gate part-way through — all
derived from what the database actually holds.

Three rules that shaped it, and are worth keeping as the feed grows:

1. **A card must state a consequence**, or it does not exist. This is what stops
   the feed becoming a list of statuses nobody reads.
2. **A card must never ask for the impossible.** Suppressing "open the gate" on a
   job with no approved takeoff was found by looking at real output, not by
   reasoning about it — worth re-checking every time a card kind is added.
3. **The derivation reads no clock.** `today` is an argument, so the same state
   always produces the same feed and every rule is testable without fixtures.

The daily brief (Step 8) and the §15 notifications should be views over these
cards, not new logic. Snooze, delegate, and acknowledge are not built; the derived
card id is the identity they will need.

**Step 5 — Inspections and scheduled visits (large) — DONE 2026-08-03**
The scheduled-visit half (§9.6) landed 2026-08-02. The inspection half (§9.7)
landed 2026-08-03 in migration `0018`, after the blocking question was answered:
the list, requesters, and lead times are derived from the 2021 ISPSC and NEC 680
— the adopted code, already confirmed — and approved as written by Travis on
2026-08-03. Built ahead of that approval by explicit instruction; the approval
arrived without corrections.

Four decisions worth challenging:

1. **Lead times are rounded up, not estimated.** Two business days routine,
   three for finals. The error is one-directional: too long warns a day early,
   which is harmless; too short warns a day late, which is a crew standing on a
   job that cannot work. This is the one value no code can derive.
2. **The deadline is anchored to the crew booking.** An inspection with no live
   visit booked into the phase its Gate guards shows *no deadline at all*.
   Without a planned date there is genuinely nothing to be late for, and
   inventing urgency is how a feed teaches its reader to ignore it.
3. **A release actually fails.** "Block dependent work" is enforced in the
   service, not surfaced as a warning — but *after* authority and the checklist,
   so someone with no right to release is told that rather than being handed the
   job's inspection state. Getting that order wrong was the one real bug in this
   step.
4. **An untouched inspection blocks.** Null status counts as outstanding,
   because "nobody wrote anything down" is the failure mode, not the safe case.

**Step 6 — Draw schedule and ready-to-bill (medium) — DONE 2026-07-31**
Migration `0013_draw_schedule.sql` renames `draw_eligibility` to `job_draws` and
gives it the confirmed 10/30/30/20/10 schedule, release conditions, invoice
status, and payment fields.

Exit condition met and exceeded: a passed Gate produces a ready-to-bill card
carrying the actual amount, and confirming the invoice clears it. On the live
database the real $152,041.73 contract splits exactly across the five draws.

Decisions worth challenging:

1. **One table, not two.** Renaming beat adding a schedule table beside the
   eligibility projection. Two tables tracking the same money is how a system
   starts disagreeing with itself about what it is owed.
2. **Regenerating a schedule adopts history rather than refusing it.** A job that
   released Gates before it had a schedule keeps those releases and gains its
   amounts. Real jobs are mid-build when a system arrives; a job that can never
   be given a schedule can never be billed correctly. Amounts on already-invoiced
   draws are never rewritten.
3. **Money authority is narrower than Gate authority.** A superintendent can
   release a draw-bearing Gate but cannot create a schedule or confirm an
   invoice. Those are the owner's and the office's.

**Step 7 — Customer progress page (small–medium) — DONE 2026-08-03**
Migration `0016_customer_page.sql` adds the tokenized link, its access log,
per-photo customer visibility, and the decisions Apex is waiting on. Exit
condition met: a link issued on the live database serves a real page — six
milestones, three published photos, two open decisions, and a call/text route —
to a request carrying no credentials at all.

It was the smallest step by volume and the one that needed the most care, because
it is the only surface a person outside the company can reach. Five decisions
shaped it, each worth challenging:

1. **The page is not part of the Apex OS bundle.** It is server-rendered by the
   Gate API at `/c/<token>` with no JavaScript. Routing it inside the staff SPA
   would have shipped every staff screen, the pilot-token sign-in, and the `/api`
   client to a homeowner's phone — and left them one refactor away from being
   reachable. What the customer receives is a string of HTML and nothing else.
2. **The payload is built, never filtered.** `buildCustomerPage` in
   `@apex/domain` constructs each field from a narrow input that never carries a
   contract value, a risk note, a visit, or a draw. §9.11's hide list is enforced
   by absence rather than by a deny-list somebody has to remember to extend. A
   new column on `projects` is invisible to a customer until a line is written to
   include it.
3. **Only the hash of the token is stored.** It exists in the clear once, in the
   response to issuing or rotating, and cannot be recovered — a leaked backup
   hands out no working links. Issuing twice is refused rather than silently
   rotating: "send them their link" must not be able to perform "invalidate the
   link they already have".
4. **A photo is invisible until someone publishes it**, and the internal caption
   is never shown. Gate evidence is photographed to prove a bar spacing, and its
   caption may name a subcontractor or quote a checklist item. Publishing asks
   for a caption written for the customer, or shows none.
5. **The page takes no input.** A tile selection submitted from a link with no
   login is not evidence that the customer made it. §9.11's decisions are shown
   and answered by phone or text, which a staff member writes down.

A revoked link and an invented one return the same status and the same bytes:
telling a stranger that a token used to be valid tells them the scheme is real.

**Copy caveat, same shape as the gate checklists:** the nine per-phase
descriptions in `packages/domain/src/customer.ts` are written from the
construction model, not dictated by Apex. They are the company's voice speaking
to its customers, and Travis approved them as written on 2026-08-03.

**Step 8 — Daily owner brief (small) — DONE 2026-08-02**
Step 4's cards rendered as one morning brief with links (§9.14). It turned out
to be small exactly because the card engine was built once as a derivation; the
brief adds no judgment of its own about what matters.

The decision that made it worth having: **the brief is generated once per day
and frozen, while Today stays live.** The feed answers "what is true now"; the
brief answers "what changed since yesterday". Without the freeze it would have
been a second copy of the feed with a date on it.

Verified across three consecutive days on the live database: a first brief with
nothing new, a second comparing against it, then a draw invoiced and the third
showing it cleared with ready-to-bill falling to zero and untouched items ageing.

One thing to carry into §15 notifications: `amountCents` now lives on the action
card. The brief's ready-to-bill total was briefly parsed out of card titles with
a regex, which a copy change would have broken silently.

Deferred to after the pilot, per §19's own cut list: full sales pipeline (§9.2),
lead/n8n sync (§9.1), AI summaries and change-order detection (§9.13, §10),
QuickBooks sync, chemistry/LSI (§9.12 — status.md already holds it out of field
deployment).

---

## 4. Where the PRD and the repo disagree — I need your call

1. **`apex-os/` mock — adopt or discard?** My recommendation is adopt as
   `apps/apex-os`. It's the right shape and it saves the layout work.
2. ~~**PRD §8.2 phases are "proposed baseline."**~~ **Resolved 2026-07-31** —
   nine confirmed phases, built in migration `0010`.
3. ~~**§20 open decisions Q3–Q6, and both authority flags in §5 of the decisions
   document.**~~ **All resolved 2026-07-31.** Pre-gunite takes a sign-off plus an
   owner countersign by a different person; the four draw-bearing gates take one
   signature from the owner or a superintendent, so draws no longer stall while
   Travis is away. Built in migration `0011`.
4. **The PRD doesn't mention the Designer or Proposal engines.** This repo already
   binds approved takeoff quantities to proposals with a pinned SHA-256. Apex OS
   should consume that binding, not re-enter contract values by hand. I've assumed
   it does.
5. **Deployment.** Everything today is loopback + embedded Postgres with a
   symmetric pilot JWT (`docs/status.md` launch blockers). A pilot with three to
   five real projects and a live customer link needs a managed environment, TLS,
   and real identity. That's real work not itemized in the PRD.

---

## 5. What I propose to do first

Steps 1–3, which is the shortest path to PRD §21's "at least three gate types
completed on real work." That is also the point at which the system stops being
a prototype.

Say go and I'll start with Step 1.
