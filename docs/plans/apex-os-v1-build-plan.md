# Apex OS v1 — Build Plan

**Source PRD:** [`PRD.md`](../../PRD.md) (Apex OS v1, Designer Pools, powered by GATE v3)
**Written:** 2026-07-31
**Status:** Approved 2026-07-31. Step 1 complete; Step 2 next.

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
| §9.11 Customer progress page | customer-safe projection + `/customer` endpoint that refuses internal state | Partial — data layer only |
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
| 2 | Construction phases | Medium — 15-phase model + 6 customer milestones, none built |
| 3 | Gates with checklists and photos | **Small** — generalize the pre-gunite slice to the 9 gate templates in §9.4 |
| 4 | Today action feed | Large — card generation engine is entirely new; UI mock exists |
| 5 | Inspection deadlines | Large — new entity, new lead-time/deadline logic |
| 6 | Sub conflict detection | Medium — new scheduled-visit entity + overlap detection |
| 7 | Draw-release cards | Medium — draw schedule table on top of existing eligibility |
| 8 | Customer progress page | Small–medium — projection exists; needs tokenized link, rotation, access log, UI |
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

**Step 2 — Project + phase model (medium)**
Migration for the project record (§9.3) and the 15-phase / 6-milestone model
(§8.2, §8.3). Exit: a real pilot pool exists with a current phase and next gate.

**Step 3 — Generalize the gate engine (small–medium)**
Lift the pre-gunite slice to the 9 gate templates (§9.4), with per-gate required
checklist items, evidence slots, blocking vs non-blocking, and override-with-reason.
Exit: three gate types run on real work — PRD §21 requires exactly this.

**Step 4 — Action-card engine + Today feed (large)**
One derivation layer producing Things Need You / Running / This Week (§9.5), with
reason, consequence, urgency, and a link to the smallest workflow. Exit: the feed
shows a card you didn't hand-write.

**Step 5 — Inspections and scheduled visits (large)**
Inspection entity with jurisdiction, lead time, last-safe-request date (§9.7).
Scheduled visits with same-crew overlap and prerequisite-gate warnings (§9.6).
Both emit cards into step 4. Exit: a real conflict on a real schedule surfaces.

**Step 6 — Draw schedule and ready-to-bill (medium)**
Draw schedule per project, each draw bound to a gate release condition, human
confirms invoicing (§9.8). Exit: one passed gate produces one ready-to-bill card.

**Step 7 — Customer progress page (small–medium)**
Tokenized no-login link, rotation and revocation, access log, six milestones,
approved-photo gallery, per-photo visibility toggle (§9.11). Exit: one real
customer link is live.

**Step 8 — Daily owner brief (small)**
Render step 4's cards as one morning brief with links (§9.14). Exit: you use it.

Deferred to after the pilot, per §19's own cut list: full sales pipeline (§9.2),
lead/n8n sync (§9.1), AI summaries and change-order detection (§9.13, §10),
QuickBooks sync, chemistry/LSI (§9.12 — status.md already holds it out of field
deployment).

---

## 4. Where the PRD and the repo disagree — I need your call

1. **`apex-os/` mock — adopt or discard?** My recommendation is adopt as
   `apps/apex-os`. It's the right shape and it saves the layout work.
2. **PRD §8.2 phases are "proposed baseline."** `SESSION-HANDOFF.md` says gunite
   is the pivot and a booked queue, and PRD 06 says phases are Schedule-board
   items. I can build the 15-phase list as written, but Travis should confirm it
   before it's cemented in a migration.
3. **§20 open decisions.** Four of these block real work: who may pass each gate
   (Q3), exact phases and gate templates (Q4), standard vs contract-specific draw
   schedules (Q5), and which jurisdictions vary inspections (Q6). Steps 3, 5 and 6
   above stall without them. I'll build against documented defaults and flag each
   assumption in the code rather than wait — but they need Travis eventually.
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
