# PRD — Apex Lead Engine (work order)

Read `../CLAUDE.md` and `data-contract.md` first. This is scope and sequence, written to execute.

## Goal

Turn a tagged lead into fast, reliable, measurable action: respond in under 5 minutes, route to the right crew, and keep every lead joined by `lead_id` from ad click to won job — so conversion and cost-per-job can be measured per vertical, and Meta can eventually optimize toward revenue instead of form fills.

## The one metric this exists to protect

**Time from lead submission to first automated response.** Target: under 5 minutes, ideally under 1. If a change makes the pipeline more capable but slower to first response, it's the wrong change.

---

## Buildable now vs gated

The intake and speed-to-lead layers depend on nothing external and should be built first. Later phases wait on decisions this repo doesn't own — build them as far as the gate allows, then stop.

| Phase | Buildable now? | Gate |
|---|---|---|
| 1 Intake + validate + route | ✅ yes | — |
| 2 Speed-to-lead response | ✅ yes | needs SMS provider (D-11) + inboxes confirmed (D-13) |
| 3 CRM stitch | ⚠ partial | CRM platform not chosen (D-10) — use holding store until then |
| 4 Review engine | ⚠ partial | ~~D-12~~ **resolved** · now only needs SMS provider (D-11) |
| 5 Meta offline-conversion loop | ⚠ partial | ~~D-12~~ **resolved** · now only needs Meta access (D-01) |
| 6 Reporting + monitoring | ✅ mostly | reporting needs whatever store Phases 1–3 write to |

**Job status (the D-12 signal) — built.** `workflows/02-job-status.ts` receives one event per
transition at `/apex-job-status`, validates, dedupes on a deterministic `event_id`, and records to
the `JobEvents` store. It **sends nothing**, so it can go live immediately and accumulate real
event history while D-11 and D-01 are still closed. Contract: `docs/job-status-contract.md`.
It computes `meta_eligible` and `review_eligible` once, so Phases 4 and 5 filter rather than
re-derive the rules.

---

## Phases

### Phase 1 — Intake (build first)
- Webhook trigger receiving the lead object.
- Validate against `data-contract.md`; quarantine malformed payloads to a review queue, don't drop or crash.
- **Dedupe on `lead_id`** — the idempotency guard. A repeat `lead_id` short-circuits before any send.
- Resolve routing from `vertical`.
- Write the lead to the **holding store** (Airtable or Google Sheet — D-10 interim) with enrichment fields initialized.
- This phase sends nothing. It just receives cleanly and records.

### Phase 2 — Speed-to-lead (the point of the whole system)
- **Respond before recording anything slow.** Immediately on a valid, non-duplicate lead:
  - SMS to the lead (consent-gated, per-vertical from-name) — D-11 provider, D-14 quiet hours.
  - Confirmation email to the lead.
  - Team notification to the routed inbox / Slack with the lead + attribution, so a human can call.
- Stamp `response_sent_at` and `response_channel`.
- If `consent_sms === false`: email + team notification only. SMS branch skipped.
- Non-blocking design: the CRM/holding-store write must not delay the response. Respond, then record.

### Phase 3 — CRM stitch  ⚠ gated on D-10 (CRM choice)
- Write/upsert the lead into the CRM keyed on `lead_id`.
- Merge across sources: a web form lead, a Facebook lead-ad lead, and an inbound call for the same person should resolve to one contact (match on phone/email, keep all `lead_id`s).
- Until D-10 resolves, the holding store IS the interim CRM; build the write so swapping the destination is a one-node change.

### Phase 4 — Review engine  ⚠ gated on D-12 (job-completion signal)
- On job completion, send a review request (SMS/email) per vertical, pointed at the right Google listing (D-09).
- Throttle: never more than one review request per customer per job; respect a cool-down.
- Reviews drive the map pack — this is the real local-SEO lever, which is why it's here and not in the website repo.

### Phase 5 — Meta offline conversions  ❌ gated on D-01 + D-12
- On job **won**, push the conversion (value = `won_value`, plus `vertical`) back to Meta, matched on `fbclid`/`lead_id`.
- This is what flips the ad algorithm from optimizing for form fills to optimizing for revenue.
- Expect spend to shift toward high-value verticals (pools) once live — flag to the maintainer before switching on.

### Phase 6 — Reporting + monitoring
- Nightly roll-up: leads, responses, response-time distribution, won jobs, cost-per-won-job **by vertical**.
- Alerts: webhook/intake failure, response-SLA breach (any lead not responded to in N minutes), site downtime, new review, form-submission drop-off.
- The SLA-breach alert is the most important — it's the early warning that the one metric is slipping.

---

## Dependency graph

```
Phase 1 (intake) ──► Phase 2 (speed-to-lead)  ◄── D-11 SMS, D-13 inboxes
     │                     │
     ▼                     ▼
Phase 3 (CRM) ◄─ D-10   Phase 6 (reporting/monitoring)
     │
     ▼
Phase 4 (reviews) ◄─ D-12 job signal
     │
     ▼
Phase 5 (Meta loop) ◄─ D-01 access + D-12 won signal
```

Build 1 → 2 → 6-monitoring immediately. 3/4/5 unlock as their gates clear. Do not stub a fake CRM or fake "job won" trigger and wire real sends to it.

## Reference

Sample payloads in `data-contract.md` (fixtures A–E) are the test inputs. Every phase must pass them, especially C (consent false → no SMS) and D (duplicate → no second send).
