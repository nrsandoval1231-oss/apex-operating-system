# Decisions & Blocked Gates — Lead Engine

**LOCKED** = build to it. **⚠ BLOCKED** = needs a human (Nick); leave `TODO(BLOCKED: D-xx)`, build around it, don't guess.

---

## LOCKED

**D-15 · Respond before recording.** The speed-to-lead response fires before any slow downstream write. Non-negotiable ordering. (CLAUDE.md rule 4.)

**D-16 · Idempotency on `lead_id`.** Dedupe is mandatory; no double-sends. (CLAUDE.md rule 1.)

**D-17 · Consent-gated SMS.** SMS only when `consent_sms === true`. (CLAUDE.md rule 3.)

**D-18 · n8n Workflow SDK, deployed to the Hostinger-hosted instance.** Repo is source of truth; validate before deploy. (CLAUDE.md build method.)

**D-19 · Holding store is the interim CRM.** Until D-10 resolves, leads land in Airtable or a Google Sheet, and the write is built so the destination swaps in one node.

---

## ⚠ BLOCKED — needs Nick

**D-10 · CRM platform.** Not chosen (it's a separate project, gated on the cost/commission decisions). Until then, Phase 3 writes to the holding store. Do not pick a CRM here.
→ *Blocks full Phase 3. Phases 1–2 unaffected.*

**D-11 · SMS provider.** Recommend Twilio (mature, good n8n support, programmable quiet hours). Needs an account + number, and A2P 10DLC registration for business texting in the US — which takes time, so start it early. Alternatives: Telnyx, MessageBird.
→ *Blocks the SMS branch of Phase 2. Email + team notification can ship without it.*

**D-12 · Job-status signal source.** Reviews (Phase 4) need a "job completed" trigger; the Meta loop (Phase 5) needs "job won" + value. Both come from wherever job status lives — which is the gated CRM / job-costing system. No signal, no trigger.
→ *Blocks Phases 4 and 5.*

**D-13 · Inbox reality.** Confirm `pools@ / coating@ / reno@ / service@ apexgetsitdone.com` actually exist as monitored mailboxes (or decide the real routing targets). Team notifications are useless if they go to dead addresses.
→ *Blocks Phase 2 team-notification wiring.*

**D-14 · SMS quiet hours vs speed-to-lead.** TCPA restricts marketing texts to ~8am–9pm local. A lead at 11pm creates tension: respond instantly (speed) vs respect quiet hours (compliance). Recommended resolution: treat the immediate auto-reply as a **transactional response to the lead's own inquiry** (generally permissible) and hold any follow-up marketing texts for allowed hours — but this is a compliance call the maintainer should confirm, ideally with counsel.
→ *Affects Phase 2 send timing. Don't hardcode a policy until confirmed.*

**D-01 · Meta Business Manager access.** Same access item as the website repo — confirm ownership/access to Meta Business Manager and the ad account before the offline-conversion loop can be built. Held by the current agency until transferred.
→ *Blocks Phase 5.*

---

## Notes carried from the PRD conversation

- Turning on the Meta loop will likely shift ad spend toward pools (highest job value). Correct on gross profit, but set expectations with Travis first — it will look like coatings is being defunded.
- Speed-to-lead is partly a **staffing** question, not just automation: the auto-text buys time, but someone still has to call fast. The system can alert; it can't make the call.
