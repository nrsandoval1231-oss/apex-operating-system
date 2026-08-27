# Acceptance Criteria — Lead Engine

Definition of done, as pass/fail behaviors. Test each workflow against fixtures A–E in `data-contract.md` before deploying to the live Hostinger instance.

## AC-1 · Intake + validation

- [ ] **AC-1.1** A valid lead (fixture A) is accepted, deduped as `new`, routed, and written to the holding store with enrichment fields initialized.
- [ ] **AC-1.2** A malformed lead (fixture E, empty `vertical`) is quarantined to a review queue — not dropped, not crashed, and **no send fires**.
- [ ] **AC-1.3** A lead with neither email nor phone is quarantined (no way to respond).
- [ ] **AC-1.4** `vertical` outside the four-string enum is treated as invalid.

## AC-2 · Idempotency (critical)

- [ ] **AC-2.1** A duplicate `lead_id` (fixture D, arriving seconds after A) is detected and short-circuited. The lead is **not** processed twice.
- [ ] **AC-2.2** Exactly one SMS and one email are sent for a given `lead_id`, ever — even across webhook retries.
- [ ] **AC-2.3** Dedupe survives an n8n restart (state is in the store, not in-memory only).

## AC-3 · Consent gate (TCPA)

- [ ] **AC-3.1** `consent_sms === true` → SMS is sent.
- [ ] **AC-3.2** `consent_sms === false` (fixture C) → **no SMS is sent**; email + team notification still go out.
- [ ] **AC-3.3** SMS is never sent to a lead whose payload lacks a valid `consent_text`.
- [ ] **AC-3.4** (If D-14 quiet hours adopted) SMS outside the allowed window is queued to the next allowed time, not sent immediately.

## AC-4 · Speed-to-lead (the one metric)

- [ ] **AC-4.1** For a valid consented lead, the first response (SMS or email) is dispatched in **under 60 seconds** of webhook receipt under normal load; SLA ceiling is 5 minutes.
- [ ] **AC-4.2** A slow or failing CRM/holding-store write does **not** delay the response. Response fires first; recording follows.
- [ ] **AC-4.3** The team notification reaches the routed inbox/Slack with the lead's name, phone, vertical, source, and campaign.
- [ ] **AC-4.4** `response_sent_at` and `response_channel` are stamped accurately.

## AC-5 · Routing

- [ ] **AC-5.1** Each vertical routes to its correct inbox and uses its correct SMS from-name (per the routing table).
- [ ] **AC-5.2** The routing table lives in one place; adding/renaming a route is a single edit.

## AC-6 · Join integrity

- [ ] **AC-6.1** `lead_id` is present and unchanged on the record in the holding store / CRM.
- [ ] **AC-6.2** Enrichment fields are appended, never overwriting the original website-sent fields.
- [ ] **AC-6.3** (Phase 3) Two leads with the same phone/email resolve to one contact while retaining both `lead_id`s.

## AC-7 · Resilience + safety

- [ ] **AC-7.1** No secrets appear in any committed workflow file.
- [ ] **AC-7.2** Staging/test runs use sandbox SMS and a test dataset — no real person is contacted, no real conversion fires.
- [ ] **AC-7.3** An intake failure raises an alert (AC ties to Phase 6 monitoring), it doesn't fail silently.

## AC-8 · Monitoring (Phase 6)

- [ ] **AC-8.1** Any lead not responded to within the SLA window raises an alert.
- [ ] **AC-8.2** Nightly roll-up reports leads / responses / response-time / won jobs / cost-per-won-job, broken out by vertical.
- [ ] **AC-8.3** Webhook or site downtime raises an alert.

---

### Gated criteria (write when the gate clears)

- **Phase 5 / Meta:** a won job pushes exactly one offline conversion, with correct `value` and `vertical`, matched on `fbclid`/`lead_id`, and stamps `meta_uploaded_at`. No duplicate uploads.
- **Phase 4 / Reviews:** job completion sends exactly one review request per customer per job, to the correct listing, respecting cool-down.
