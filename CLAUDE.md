# CLAUDE.md — Apex Lead Engine (n8n)

You are building the **n8n automation layer** that receives leads from the Apex website and acts on them. This file loads on every task. Read `docs/prd.md` before working and `docs/decisions.md` before making any choice not specified here.

This repo is the **downstream half** of the Apex website. The website's entire job is to hand you a correctly-tagged lead object at a webhook. Your job starts there: validate it, route it, respond to it fast, and — as later phases unlock — stitch it into the CRM, request reviews, and push won-job value back to Meta.

The single most valuable thing this system does is **respond to a new lead within 5 minutes, automatically**. In home services that is the biggest conversion lever there is. Everything else is secondary to that working reliably.

---

## Hard rules — never break

1. **Idempotency.** A lead webhook can fire more than once (client retries, network). Dedupe on `lead_id`. **Never text or email a lead twice** for the same submission. A double-send is a serious bug, not a rare edge case.
2. **`lead_id` is the join key end to end.** It arrives from the website, and it must travel unchanged into the holding store, the CRM, and Meta offline conversions. Never regenerate it.
3. **Consent gate is absolute.** Send SMS only when `consent_sms === true`. No exceptions, no "just this once." This is TCPA, not a preference. (See `docs/decisions.md` D-14 on quiet hours.)
4. **The auto-response must not block on slow downstream steps.** Send the speed-to-lead text/email first, then do CRM writes, enrichment, and logging. If the CRM is slow or down, the lead still gets its reply. Order matters: respond, then record.
5. **Secrets live in n8n credentials, never in committed workflow files.** Webhook URLs, API keys, SMS tokens, Meta dataset IDs — all referenced by credential name or env var. Nothing sensitive in the repo.
6. **Test and staging never send to real people or fire real conversions.** Use sandbox SMS numbers and a test Meta dataset. (Hard rule, mirrors the website repo.)
7. **When a step depends on a `⚠ BLOCKED` decision, stop and surface it.** Build everything upstream and around it, leave `TODO(BLOCKED: D-xx)`, do not invent the missing piece (e.g. do not pick a CRM).

---

## Build method (decided — confirm before changing)

- **Target instance:** Apex runs **self-hosted n8n on Hostinger** (`n8n.srv1758862.hstgr.cloud`). Workflows deploy there.
- **Authoring:** use the **n8n Workflow SDK** (code-defined workflows), validated before creation. The maintainer has the n8n MCP connected — use `get_sdk_reference` and `validate_workflow` / `validate_node_config` as you build, and `create_workflow_from_code` to deploy. Prefer this over hand-writing raw workflow JSON: it validates.
- **Repo holds:** the SDK source for each workflow under `workflows/`, plus these docs. The repo is the source of truth; the live n8n instance is the deploy target. Do not treat manual UI edits as canonical — round-trip them back into `workflows/`.
- **One workflow per file**, named by phase (e.g. `workflows/01-intake.ts`, `workflows/02-speed-to-lead.ts`).

---

## What "done" means

A workflow is done when it passes `docs/acceptance-criteria.md` — those are written as checkable behaviors. Validate every node config as you write it. Test with the sample lead payloads in `docs/data-contract.md` before deploying to the live instance.

## Map

- `docs/prd.md` — phases, dependency graph, what's buildable now vs gated
- `docs/data-contract.md` — the lead object you receive (must match the website repo byte-for-byte) and what you add to it
- `docs/acceptance-criteria.md` — pass/fail behaviors; definition of done
- `docs/decisions.md` — locked decisions and `⚠ BLOCKED` gates
- `workflows/` — the SDK source for each n8n workflow
- `.env.example` — every credential each phase needs. Copy to `.env` before starting.

## Relationship to the other repos

- **Upstream:** `apex-website` — sends you the lead object. Its `docs/data-contract.md` and yours describe the same object and MUST stay identical. If they drift, that's a bug in whichever changed last.
- **Downstream / separate, not yours to build:** the CRM platform, commission engine, job costing, QuickBooks. You *write to* the CRM once it exists (D-10), but you do not choose or build it.
