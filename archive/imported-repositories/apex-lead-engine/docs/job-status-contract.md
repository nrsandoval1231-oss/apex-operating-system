# Job Status Contract — the D-12 signal

This is the event the job-execution system emits when a job changes status, and what this engine
receives at `POST /apex-job-status`. It is the resolution of **D-12**, which blocked Phases 4 and 5.

Specified by `apex-prds/06-project-management.md` §7. The emitting side is a Monday board; this
contract is deliberately **platform-agnostic** so the board can be built, rebuilt or replaced
without touching the engine.

---

## Why this document exists separately

The engine cannot be built against "wherever job status lives." It needs a fixed shape. Once this
contract is fixed, **both sides build independently** — the board is one HTTP call away from being
correct, and Phases 4 and 5 can be written and tested against fixtures before any board exists.

---

## The status enum — reconciled

`data-contract.md` previously carried `job_status: lead → quoted → won → lost`. PRD 06 §7 specifies
`lead → quoted → won → in progress → complete → reconciled`. **Both were incomplete.** The union,
which is now canonical in both documents:

```
lead → quoted → won → in progress → complete → reconciled
                 └── lost (terminal, reachable from lead or quoted)
```

| Status | Means | Fires |
|---|---|---|
| `lead` | Captured, not yet quoted | — |
| `quoted` | Proposal issued | — |
| `won` | Proposal accepted. **Job ID mints here** (Foundation §2) | **Phase 5** — Meta offline conversion, with value |
| `in progress` | Work started | — |
| `complete` | Work finished, customer handed over | **Phase 4** — review request |
| `reconciled` | All costs in, actual GP final, Stage 2 commission released (Foundation §9) | — |
| `lost` | Terminal. Not won | — |

`reconciled` is a financial control with a checklist behind it, not a simple transition — see
PRD 06 §10. This engine only records it.

---

## The event

```json
{
  "event_id":       "evt_APX-2026-014_complete",
  "event":          "job.status_changed",
  "job_id":         "APX-2026-014",
  "lead_id":        "apex_1721925123_a1b9",
  "vertical":       "Designer Pools",
  "from_status":    "in progress",
  "to_status":      "complete",
  "changed_at":     "2026-07-26T14:32:11-05:00",
  "first_name":     "Jordan",
  "last_name":      "Whitaker",
  "email":          "jordan.w@email.com",
  "phone":          "8065550142",
  "contract_value": 152041.73,
  "job_cost":       116955.18,
  "source_system":  "monday",
  "source_item_id": "9876543210"
}
```

Flat, matching the lead object's shape.

### `event_id` is deterministic, and that is the idempotency guard

```
event_id = "evt_" + job_id + "_" + to_status
```

Hard rule 1 says a webhook can fire more than once and **a customer must never be texted twice for
the same thing**. Deriving `event_id` from `(job_id, to_status)` rather than minting a random one
means a retry, a double-click in Monday, or an automation that fires twice all collapse to the
same key.

It also handles the real edge case: a job that reopens and completes a second time. `complete` has
already been seen for that job, so **no second review request** — which is exactly the throttle
Phase 4 requires ("never more than one review request per customer per job").

The sender may omit `event_id`; the engine derives it. If the sender supplies one, it must match
the derived value or the event is quarantined.

---

## Validation

**Quarantine** (record, don't drop — same policy as lead intake) when:

| Rule | Why |
|---|---|
| `job_id` missing or not `APX-YYYY-NNN` | It's the primary key across Monday and QuickBooks (Foundation §2) |
| `to_status` not in the enum | Unknown status can't be routed |
| `vertical` not one of the four exact strings | Routing and review targets key off it |
| `changed_at` missing | Ordering and SLA reporting need it |
| `to_status = won` and `contract_value` is not a positive number | Phase 5 pushes **value** to Meta; a conversion without one is useless |
| `to_status = complete` and both `email` and `phone` empty | Phase 4 has no channel to send a review request on |
| `lead_id` present but malformed | It's the join key; a corrupt one is worse than none |

**Valid but flagged:**

- **`lead_id` absent.** Legitimate — a job can originate offline (walk-in, referral, phone call
  that never touched the website). The job still processes and Phase 4 still works, because a
  review request only needs customer contact details.
  **But Phase 5 must skip it.** Meta offline conversions match on `fbclid`/`lead_id`; with no
  lead there is nothing to match against and uploading it would corrupt attribution. The engine
  sets `meta_eligible: false` so Phase 5 can filter without re-deriving the rule.
- `job_cost` absent — only needed for margin reporting, not for either trigger.

---

## What the engine adds

```json
{
  "engine_received_at": "ISO 8601",
  "dedupe_status":      "new | duplicate",
  "meta_eligible":      true,
  "review_eligible":    true,
  "review_target":      "Google (pools GBP)",
  "routed_to":          "pools@apexgetsitdone.com",
  "meta_uploaded_at":   null,
  "review_sent_at":     null
}
```

`meta_eligible` is `to_status === 'won' && lead_id present`.
`review_eligible` is `to_status === 'complete' && (email || phone)`.

Both are computed once, in the same node that owns the enum and routing table, so Phases 4 and 5
never re-implement the rule.

---

## What Phase 1 does and does not do

**Does:** receive, validate, dedupe, enrich, record to the `JobEvents` store, always respond.

**Does not:** send anything. No review requests, no Meta uploads. Same discipline as lead intake —
this phase only makes the signal exist and be trustworthy. Phases 4 and 5 consume the store when
their own gates (D-11 SMS, D-01 Meta access) clear.

That is deliberate: it means this workflow can go live **immediately**, with no dependency on
Meta access or an SMS provider, and start accumulating a real event history.

---

## Fixtures

In `workflows/fixtures/`, continuing the A–E lead series:

| | Case | Must |
|---|---|---|
| **F** | `won`, full data, `lead_id` present | accept · `meta_eligible: true` |
| **G** | `complete`, `lead_id` present | accept · `review_eligible: true` |
| **H** | `won`, **no `lead_id`** (offline origin) | accept · **`meta_eligible: false`** |
| **I** | duplicate of G | `dedupe_status: duplicate` · no second event written |
| **J** | `won` with `contract_value: 0` | **quarantine** — Phase 5 needs a value |

---

## The emitting side

Whatever hosts job status sends one POST per transition. In Monday that is a status-change
automation calling the webhook. The board spec lives in
`apex-prds/reference/monday-jobs-board-spec.md`.

Requirements on the sender, in order of how badly they break things:

1. **`job_id` never changes** once minted at `won` (Foundation §2)
2. **`lead_id` is carried onto the job** at the point a lead converts, unchanged — this is the
   only thing that makes ad-click-to-won-job attribution possible (Hard rule 2)
3. One POST per transition — not a nightly sync of current state
4. Retries are safe and expected; the engine dedupes
