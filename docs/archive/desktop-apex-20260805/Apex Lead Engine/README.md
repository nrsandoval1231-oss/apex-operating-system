# Apex Lead Engine

**Moved out of `Nick-Assistant/` on 2026-07-27** at Nick's direction. This is a
**side project** — Apex Get It Done, a separate business from 2G Energy Rental.
It was being tracked inside the 2G Marketing Activation program PRD, which was
wrong; it has no relationship to 2G BD work and is now removed from that scope.

---

## What this actually is

A website-lead intake pipeline for Apex Get It Done's four service verticals:

| Vertical | Routes to | Review target |
|---|---|---|
| Designer Pools | `pools@apexgetsitdone.com` | Google (pools GBP) |
| Concrete Coating | `coating@apexgetsitdone.com` | Google (coating GBP) |
| Design & Renovation | `reno@apexgetsitdone.com` | Google |
| Pool Service | `service@apexgetsitdone.com` | Google |

## Current state — honest version

**One workflow exists. It is inactive and has never run.**

- n8n workflow: `Apex Lead Engine — 01 Intake` (`CNWX9VjtK5gJJ6rG`)
- Created 2026-07-26, never modified, **0 executions**
- Lives on `https://n8n.srv1758862.hstgr.cloud`
- Webhook (only live when the workflow is active):
  `POST /webhook/apex-lead-intake`

**Phase 1 is built.** The flow is coherent and complete for what it claims:

```
Lead Intake Webhook
  → Validate & Route          (enum check, lead_id format, contact-method check,
                               consent_sms boolean check, vertical → inbox routing)
  → Is Valid?
      ├─ false → Quarantine Malformed Lead (Airtable) → Respond Quarantined
      └─ true  → Find Existing Lead (Airtable, by lead_id)
                   → Is Duplicate?
                       ├─ true  → Respond Duplicate
                       └─ false → Write Lead to Store (Airtable) → Respond Accepted
```

**Phases 2 and beyond were never written.** There is no auto-response, no SMS,
no CRM push, no review request, no Meta conversion upload — even though the
Phase 1 record schema reserves fields for all of them (`response_sent_at`,
`response_channel`, `crm_record_id`, `job_status`, `won_value`,
`meta_uploaded_at`).

So: a lead can arrive, be validated, deduped, and stored. **Nothing happens
after that.** It is a front door with no hallway.

## Dependencies

- **Airtable**, via `airtableTokenApi` auth in n8n.
- Base and table resolved from n8n **environment variables**, not hardcoded:
  - `AIRTABLE_BASE_ID` (required)
  - `AIRTABLE_TABLE_LEADS` (defaults to `Leads`)
  - `AIRTABLE_TABLE_QUARANTINE` (defaults to `Quarantine`)
- If those env vars aren't set on the n8n instance, both Airtable nodes fail.

## The data contract

`lead_id` must match `^apex_\d+_[0-9a-z]{4}$`. A lead is rejected to Quarantine
if any of these fail:

- `lead_id` missing or malformed
- `vertical` not one of the four exact strings above
- neither `email` nor `phone` present
- `consent_sms` is not a boolean

Phone is normalised to digits only; email is lowercased. Full original payload
is preserved as `raw_payload` on both the Leads and Quarantine records.

## Files here

- `Apex-Lead-Engine-01-Intake.json` — importable n8n workflow export, taken
  2026-07-27. Import via n8n → Workflows → Import from File. No credentials or
  secrets are in this file; you'll reattach the Airtable credential and set the
  env vars after import.
- `README.md` — this file.

## If you pick this back up

The open decision is unchanged and still yours: **finish it or kill it.** A
front door with no hallway is worse than no front door, because it looks
finished. Whichever you choose, do it deliberately rather than leaving it
inactive and half-built for another few months.

If finishing: Phase 2 is the auto-response (email and/or SMS, respecting
`consent_sms`), and it's the piece that makes Phase 1 worth anything.

If killing: delete the n8n workflow and the Airtable base, and keep this folder
as the record.
