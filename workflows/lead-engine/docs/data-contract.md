# Data Contract — n8n side

This is the **receiving** view of the same lead object the website sends. It MUST match `apex-website/docs/data-contract.md` exactly. If the website changes a field, this changes too. Treat any mismatch as a bug.

## What you receive (POST body at the intake webhook)

```json
{
  "lead_id":      "apex_1721925123_a1b9",
  "vertical":     "Designer Pools",
  "first_name":   "Jordan",
  "last_name":    "Whitaker",
  "email":        "jordan.w@email.com",
  "phone":        "8065550142",
  "consent_sms":  true,
  "consent_text": "I agree to receive text messages from Apex Designer Pools ...",
  "source":       "facebook",
  "medium":       "paid",
  "campaign":     "summer-pools-2026",
  "landing_page": "/pools",
  "referrer":     "https://l.facebook.com/",
  "fbclid":       "IwAR3...",
  "gclid":        "",
  "page_submitted":"/",
  "device":       "mobile",
  "submitted_at": "2026-07-25T14:32:11-05:00"
}
```

## Validation on intake (Phase 1, before anything else)

Reject / quarantine (don't silently drop) any payload where:
- `lead_id` is missing or malformed
- `vertical` is not one of the four enum strings
- both `email` and `phone` are empty (no way to respond)
- `consent_sms` is not a boolean

Valid-but-flagged (process, but note it):
- `source`/`medium` are `direct`/`none` (fine, just unattributed)
- `consent_sms === false` (process the lead, but the SMS branch is skipped — email only)

## The vertical enum — exact strings (keys for routing)

```
Designer Pools
Concrete Coating
Design & Renovation
Pool Service
```

## Routing table (this repo owns it — the website only sends `vertical`)

| vertical | inbox | SMS from-name | review platform target |
|---|---|---|---|
| Designer Pools | pools@apexgetsitdone.com | Apex Designer Pools | Google (pools GBP) |
| Concrete Coating | coating@apexgetsitdone.com | Apex Concrete Coating | Google (coating GBP) |
| Design & Renovation | reno@apexgetsitdone.com | Apex Design & Renovation | Google |
| Pool Service | service@apexgetsitdone.com | Apex Pool Service | Google |

⚠ Confirm these inboxes exist and the GBP structure (D-09/D-13) before wiring sends.

## What the engine adds to the lead (enrichment fields)

As the lead moves through the pipeline, append — never overwrite the originals:

```json
{
  "engine_received_at": "ISO 8601",
  "dedupe_status":      "new | duplicate",
  "response_sent_at":   "ISO 8601",        // when the speed-to-lead text/email actually went out
  "response_channel":   "sms | email | both",
  "routed_to":          "pools@apexgetsitdone.com",
  "crm_record_id":      "",                 // set in Phase 3, once a CRM exists (D-10)
  "job_status":         "lead",             // see the enum below — updated by the job-status signal
  "won_value":          null,               // set when job is won; feeds Meta offline conversion
  "meta_uploaded_at":   null                // Phase 5
}
```

### `job_status` enum — canonical

```
lead → quoted → won → in progress → complete → reconciled
                 └── lost (terminal, reachable from lead or quoted)
```

This document previously carried `lead → quoted → won → lost`, and `apex-prds/06-project-management.md`
§7 specified `lead → quoted → won → in progress → complete → reconciled`. **Both were incomplete.**
The union above is now canonical in both, and is enforced in one place — the `Validate & Classify`
node of `workflows/02-job-status.ts`.

`won` fires the Meta offline conversion (Phase 5). `complete` fires the review request (Phase 4).
Transitions arrive as events — see `job-status-contract.md`.

`lead_id` + these fields are what make per-vertical conversion and cost-per-won-job computable. The whole point of the system is that this object stays complete and joined from ad click to won job.

## Sample payloads for testing

Keep these in `workflows/fixtures/` and test every workflow against them:
- **A.** Facebook paid pool lead, full attribution, consent true (the happy path)
- **B.** Direct visit, phone only, consent true (unattributed but valid)
- **C.** Consent false (email-only branch must be taken; SMS must NOT fire)
- **D.** Duplicate `lead_id` arriving 3s after A (dedupe must catch it; no second send)
- **E.** Malformed — `vertical` empty (must quarantine, not crash, not send)
