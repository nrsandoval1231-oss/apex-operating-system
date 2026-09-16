# Workflows

SDK source for each n8n workflow. The repo is the source of truth (D-18); the live instance
is the deploy target. Round-trip any UI edits back into these files.

## 01-intake.ts — Phase 1 (Intake)

Receives the tagged lead from the website and records it. **Sends nothing** (Phase 2 owns
the speed-to-lead response).

```
Lead Intake Webhook (POST /apex-lead-intake, responseMode: responseNode)
  → Validate & Route (Code — the ONE place the enum, routing table, and validation live)
  → Is Valid?
      ├─ false → Quarantine Malformed Lead (Airtable) → Respond Quarantined (200)
      └─ true  → Find Existing Lead (Airtable search on lead_id)
                   → Is Duplicate?
                       ├─ true  → Respond Duplicate (200, no write)
                       └─ false → Write Lead to Store (Airtable) → Respond Accepted (200)
```

Every path ends in a Respond node, so the website's POST always gets a fast reply carrying
`status` (`accepted` | `duplicate` | `quarantined`) and `lead_id`.

### Deployed
- Instance: `n8n.srv1758862.hstgr.cloud` (Apex Hostinger).
- Workflow id: `CNWX9VjtK5gJJ6rG` — created **inactive**. It sends nothing, so activating it
  is safe once the store below exists.

### Before it can run — one-time setup (maintainer)
1. **Airtable base + tables.** Create a base with two tables:
   - `Leads` — columns matching the write mapping in `01-intake.ts` (lead_id, vertical,
     first_name, last_name, email, phone, consent_sms, consent_text, source, medium, campaign,
     landing_page, referrer, fbclid, gclid, page_submitted, device, submitted_at,
     engine_received_at, dedupe_status, routed_to, sms_from_name, review_target, job_status).
   - `Quarantine` — lead_id, vertical, quarantine_reason, raw_payload, engine_received_at.
2. **n8n environment vars** on the instance: `AIRTABLE_BASE_ID` (required),
   `AIRTABLE_TABLE_LEADS` (default `Leads`), `AIRTABLE_TABLE_QUARANTINE` (default `Quarantine`).
   Config lives here, not in the workflow file — swapping the store to a real CRM later (D-10)
   is a change to the two Airtable nodes only (D-19).
3. **Credential**: the Airtable Personal Access Token credential is already auto-linked.
4. **Activate** the workflow, then point the website's `PUBLIC_LEAD_WEBHOOK_URL` at
   `https://n8n.srv1758862.hstgr.cloud/webhook/apex-lead-intake` (test builds → the
   `-test` path per Hard rule 6).

### Testing against fixtures (fixtures/A–E) — maps to acceptance-criteria.md
Send each fixture as the POST body to the intake URL (or pin it on the webhook node and
execute). Expected results:

| Fixture | Expectation | AC |
|---|---|---|
| A — facebook pool, consent true | `accepted`, `dedupe_status: new`, written to Leads, `routed_to: pools@` | AC-1.1, AC-5.1, AC-6.1/6.2 |
| B — direct, phone only, consent true | `accepted` (valid on phone alone), `source: direct` | AC-1.1 |
| C — coating, consent false | `accepted` and written; **no SMS ever** (Phase 2) — SMS branch does not exist here | AC-3.2 (Phase 2 enforces the send gate) |
| D — duplicate of A (after A) | `duplicate`, **not** written again, no reprocessing | AC-2.1, AC-2.3 |
| E — empty vertical (malformed) | `quarantined` to the Quarantine table, no crash, no write to Leads | AC-1.2, AC-1.4 |

> Live fixture runs require the Airtable base + env vars above. Until then the workflow is
> structurally validated (validate_workflow) but not executed end-to-end.

### Not built here (later phases, gated)
Speed-to-lead SMS/email/team-notify (Phase 2 — D-11/D-13/D-14), CRM stitch (Phase 3 — D-10),
reviews (Phase 4 — D-12), Meta offline conversions (Phase 5 — D-01/D-12), monitoring
(Phase 6). See `../docs/prd.md` and `../docs/decisions.md`.
