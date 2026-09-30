# Monday — Jobs Board Spec (PRD 06 Phase 1)

Build spec for the board that emits the job-status signal. Scope is **Phase 1 only**: the status
model and its outbound event. The Schedule board, crew timeline and gunite queue are Phase 2
(PRD 06 §6) and deliberately not here — building them before the status signal works produces
something that gets torn out.

**Consumes:** nothing. **Emits:** one event per status transition to
`POST https://n8n.example.hstgr.cloud/webhook/apex-job-status` (replace the host with
the n8n instance base URL; do not commit the live hostname), per
`workflows/lead-engine/docs/job-status-contract.md`.

---

## Before building — two account decisions

**1. This must live in Apex's own Monday account.** Not a personal or agency trial workspace. The
Job ID is the primary key shared with QuickBooks (Foundation §2) and this board becomes the system
of record for job status; it should not sit in an account Apex doesn't control or that expires.

**2. Monday CRM and Monday Work Management are different products.** Monday CRM ships opinionated
Contacts / Deals / Leads boards and is shaped for pipeline, not for job execution with phases and
resource views. PRD 06 Phase 2 needs Work Management behaviour (Workload and Calendar views across
items). Confirm which product the Apex account is on **before** Phase 2 — Phase 1 works on either,
because it is only a status column and a webhook.

---

## Board: `Apex — Jobs`

One item per job. **Not** one per lead — leads live in the pipeline board (PRD 05). An item is
created here when a proposal is accepted, and **the Job ID mints at that moment and never changes**
(Foundation §2).

### Groups

Group by lifecycle, not vertical — with five concurrent jobs the vertical fits in a column and
grouping by it fragments the board.

| Group | Holds |
|---|---|
| **Active** | `won` · `in progress` |
| **Closing** | `complete` · awaiting reconciliation |
| **Closed** | `reconciled` · `lost` |

### Columns

| Column | Type | Notes |
|---|---|---|
| *Item name* | — | Job name, e.g. "Whitaker Oasis" |
| **Job ID** | Text | `APX-YYYY-NNN`. Minted at `won`. **Never edited** — it joins Monday to QuickBooks |
| **Lead ID** | Text | Carried from the lead, unchanged. Empty for offline-origin jobs (walk-in, referral) |
| **Vertical** | Status | Exactly four labels, exact strings — see below |
| **Job Status** | Status | Seven labels, exact strings — see below. **This column drives the automations** |
| Customer First Name | Text | |
| Customer Last Name | Text | |
| Customer Email | Email | Required before `complete` — Phase 4 sends the review request here |
| Customer Phone | Phone | Alternative channel for the review request |
| **Contract Value** | Numbers | Customer price. **Required before `won`** — Phase 5 pushes it to Meta |
| Job Cost | Numbers | Reimbursable job cost. Reporting only |
| Status Changed | Date (with time) | Set by automation on every transition |

> **`Contract Value` and `Customer Email` are not optional fields with a nice-to-have flavour.**
> The engine quarantines a `won` event with no positive contract value, and a `complete` event with
> no email or phone. That is deliberate — a Meta conversion without a value trains the algorithm on
> nothing, and a review request needs somewhere to go.

### `Vertical` — exact labels

```
Designer Pools
Concrete Coating
Design & Renovation
Pool Service
```

Order-sensitive and string-exact. The engine's routing table and review targets key off these; a
renamed label silently breaks routing rather than erroring.

### `Job Status` — exact labels

```
lead · quoted · won · in progress · complete · reconciled · lost
```

| Label | Colour | Meaning |
|---|---|---|
| `lead` | grey | Captured, not yet quoted. Usually lives in the pipeline board, not here |
| `quoted` | light blue | Proposal issued |
| `won` | green | Accepted. **Job ID mints here.** Fires Meta conversion (Phase 5) |
| `in progress` | orange | Work started |
| `complete` | dark green | Work finished, handed over. Fires review request (Phase 4) |
| `reconciled` | purple | All costs in, actual GP final, Stage 2 commission released |
| `lost` | red | Terminal |

`reconciled` has a checklist behind it (PRD 06 §10) — it releases commission money and should not
be a casual click.

---

## Automations

### 1. Stamp the transition time

```
When Job Status changes → set Status Changed to now
```

### 2. Emit the event

```
When Job Status changes → send webhook to
https://n8n.example.hstgr.cloud/webhook/apex-job-status
```

**Implementation note — Monday's native webhook is not the contract.** Monday sends its own
compact shape (`boardId`, `pulseId`, the changed column value) and does not include contract value,
lead ID or customer details. Two ways to bridge that, and the choice does not affect the engine:

- **A — adapter workflow (recommended).** Monday's native webhook hits a thin n8n workflow which
  queries the item's column values via the Monday API, maps them to the contract, and calls
  `/apex-job-status`. Keeps the contract clean and platform-agnostic; the adapter is the only piece
  that knows anything about Monday.
- **B — HTTP-request action.** If the plan's integration actions allow a custom JSON body, build
  the contract payload directly in the automation. Fewer moving parts, but the mapping then lives
  in Monday's UI where it is neither version-controlled nor reviewable.

Recommend **A**. It costs one small workflow and keeps everything about the payload in the repo.

### 3. Guard rails

```
When Job Status changes to won and Contract Value is empty → notify Travis, revert to quoted
When Job Status changes to complete and Customer Email is empty and Customer Phone is empty → notify Travis
```

Cheaper to catch at the board than to read a quarantine table later.

---

## Rules the emitting side must hold

In order of how badly breaking them hurts:

1. **`Job ID` never changes once minted.** Everything downstream joins on it — QuickBooks, the
   commission engine, cost allocation. A changed Job ID silently orphans a job's entire cost history.
2. **`Lead ID` is carried onto the job when a lead converts, unchanged.** This is the only thing
   that makes ad-click-to-won-job attribution possible. Losing it does not break the job; it breaks
   the ability to ever measure cost per won job by vertical, which is the original ask.
3. **One event per transition** — not a nightly sync of current state. The engine records events,
   not snapshots.
4. **Retries are safe.** The engine derives `event_id` from `job_id + to_status` and dedupes, so a
   double-fire, a retry, or a mis-click that re-enters the same status collapses to one event. Do
   not build retry suppression in Monday; it is already handled and doing it twice risks dropping a
   real transition.

---

## Testing

Fixtures F–J in `apex-lead-engine/workflows/fixtures/` are the required cases. Against a live
board, the sequence worth walking once:

1. Create a job, set `won` with a contract value → expect `{"status":"recorded","meta_eligible":true}`
2. Set the same job `complete` → expect `review_eligible: true`
3. Set it back to `in progress`, then `complete` again → expect `{"status":"duplicate"}` and
   **no second event.** This is the one that proves a customer can't be asked for a review twice
4. Create a job with no Lead ID, set `won` → expect `meta_eligible: false`
5. Set a job `won` with contract value 0 → expect `{"status":"quarantined"}`

---

## Not in this spec

The Schedule board, phases as items, crew timeline, gunite slot queue, crew-days capture and the
WIP gate — all PRD 06 Phase 2 and 3. The reconciliation checklist is Phase 4 and gated on the
allowance mechanic (Foundation open question 4).
