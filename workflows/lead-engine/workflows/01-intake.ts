/**
 * workflows/01-intake.ts — Apex Lead Engine, Phase 1 (Intake).
 *
 * Receives the tagged lead object from the Apex website at the intake webhook, validates
 * it against docs/data-contract.md, dedupes on `lead_id` (idempotency — Hard rule 1 / D-16),
 * resolves routing from `vertical`, and writes the lead to the holding store (Airtable —
 * D-19 interim CRM). THIS PHASE SENDS NOTHING (no SMS/email/conversions) — Phase 2 owns the
 * speed-to-lead response. Every execution path ends in a Respond node so the website's POST
 * always gets a fast, meaningful reply.
 *
 * Config comes from n8n environment vars (nothing sensitive in this file — Hard rule 5):
 *   AIRTABLE_BASE_ID, AIRTABLE_TABLE_LEADS (default "Leads"),
 *   AIRTABLE_TABLE_QUARANTINE (default "Quarantine").
 * The webhook path is `apex-lead-intake` — it must match the website's PUBLIC_LEAD_WEBHOOK_URL.
 * Swapping the holding store to a real CRM later (D-10) is a change to the two Airtable
 * nodes only (D-19).
 *
 * Fixtures A–E in workflows/fixtures/ are the required test inputs (AC-1..AC-6).
 * Deploy: validated with validate_workflow, then create_workflow_from_code to the instance.
 * The workflow is created INACTIVE; it sends nothing, so activation is safe once the
 * Airtable base/tables and env vars are set.
 *
 * NOTE: the SDK parser is static — no helper functions / arrow fns / TS-only syntax here.
 */
import {
  workflow,
  trigger,
  node,
  ifElse,
  expr,
  newCredential,
} from '@n8n/workflow-sdk';

const airtableCred = { airtableTokenApi: newCredential('Airtable Personal Access Token account') };

const baseRl = { __rl: true, mode: 'id', value: expr('{{ $env.AIRTABLE_BASE_ID }}') };
const leadsTableRl = { __rl: true, mode: 'id', value: expr('{{ $env.AIRTABLE_TABLE_LEADS || "Leads" }}') };
const quarantineTableRl = { __rl: true, mode: 'id', value: expr('{{ $env.AIRTABLE_TABLE_QUARANTINE || "Quarantine" }}') };

const leadIntakeWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Lead Intake Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'apex-lead-intake',
      responseMode: 'responseNode',
      authentication: 'none',
    },
  },
  output: [
    { body: { lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools', email: 'jordan.w@email.com', phone: '8065550142', consent_sms: true } },
  ],
});

const validateAndRoute = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate & Route',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      // Single string literal (the SDK parser forbids .join and other method calls in SDK
      // code, but does not inspect string contents). This is the ONE place the enum, the
      // routing table, and validation live (AC-5.2). Sends nothing.
      jsCode:
        "const ENUM = ['Designer Pools','Concrete Coating','Design & Renovation','Pool Service'];\n" +
        "const ROUTING = {\n" +
        "  'Designer Pools':      { inbox: 'pools@apexgetsitdone.com',   sms_from_name: 'Apex Designer Pools',     review_target: 'Google (pools GBP)' },\n" +
        "  'Concrete Coating':    { inbox: 'coating@apexgetsitdone.com', sms_from_name: 'Apex Concrete Coating',   review_target: 'Google (coating GBP)' },\n" +
        "  'Design & Renovation': { inbox: 'reno@apexgetsitdone.com',    sms_from_name: 'Apex Design & Renovation', review_target: 'Google' },\n" +
        "  'Pool Service':        { inbox: 'service@apexgetsitdone.com', sms_from_name: 'Apex Pool Service',       review_target: 'Google' }\n" +
        "};\n" +
        "const src = ($json && $json.body) ? $json.body : $json;\n" +
        "const s = (v) => (v === undefined || v === null) ? '' : String(v).trim();\n" +
        "const lead_id = s(src.lead_id);\n" +
        "const vertical = s(src.vertical);\n" +
        "const email = s(src.email).toLowerCase();\n" +
        "const phone = s(src.phone).replace(/\\D/g, '');\n" +
        "const consent_sms = src.consent_sms;\n" +
        "const reasons = [];\n" +
        "if (!/^apex_\\d+_[0-9a-z]{4}$/.test(lead_id)) reasons.push('lead_id missing or malformed');\n" +
        "if (ENUM.indexOf(vertical) === -1) reasons.push('vertical not in enum');\n" +
        "if (!email && !phone) reasons.push('no email or phone to respond to');\n" +
        "if (typeof consent_sms !== 'boolean') reasons.push('consent_sms is not a boolean');\n" +
        "const valid = reasons.length === 0;\n" +
        "const route = ROUTING[vertical] || { inbox: '', sms_from_name: '', review_target: '' };\n" +
        "return {\n" +
        "  valid,\n" +
        "  reason: reasons.join('; '),\n" +
        "  lead_id, vertical,\n" +
        "  first_name: s(src.first_name),\n" +
        "  last_name: s(src.last_name),\n" +
        "  email, phone,\n" +
        "  consent_sms: consent_sms === true,\n" +
        "  consent_text: s(src.consent_text),\n" +
        "  source: s(src.source) || 'direct',\n" +
        "  medium: s(src.medium) || 'none',\n" +
        "  campaign: s(src.campaign),\n" +
        "  landing_page: s(src.landing_page),\n" +
        "  referrer: s(src.referrer),\n" +
        "  fbclid: s(src.fbclid),\n" +
        "  gclid: s(src.gclid),\n" +
        "  page_submitted: s(src.page_submitted),\n" +
        "  device: s(src.device),\n" +
        "  submitted_at: s(src.submitted_at),\n" +
        "  engine_received_at: new Date().toISOString(),\n" +
        "  dedupe_status: 'new',\n" +
        "  routed_to: route.inbox,\n" +
        "  sms_from_name: route.sms_from_name,\n" +
        "  review_target: route.review_target,\n" +
        "  response_sent_at: '',\n" +
        "  response_channel: '',\n" +
        "  crm_record_id: '',\n" +
        "  job_status: 'lead',\n" +
        "  won_value: null,\n" +
        "  meta_uploaded_at: null,\n" +
        "  raw_payload: JSON.stringify(src)\n" +
        "};",
    },
  },
  output: [
    {
      valid: true, reason: '', lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools',
      first_name: 'Jordan', last_name: 'Whitaker', email: 'jordan.w@email.com', phone: '8065550142',
      consent_sms: true, consent_text: 'I agree to receive text messages from Apex Designer Pools ...',
      source: 'facebook', medium: 'paid', campaign: 'summer-pools-2026', landing_page: '/pools',
      referrer: 'https://l.facebook.com/', fbclid: 'IwAR3', gclid: '', page_submitted: '/', device: 'mobile',
      submitted_at: '2026-07-25T14:32:11-05:00', engine_received_at: '2026-07-25T19:32:12.000Z',
      dedupe_status: 'new', routed_to: 'pools@apexgetsitdone.com', sms_from_name: 'Apex Designer Pools',
      review_target: 'Google (pools GBP)', response_sent_at: '', response_channel: '', crm_record_id: '',
      job_status: 'lead', won_value: null, meta_uploaded_at: null, raw_payload: '{}',
    },
  ],
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Is Valid?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.valid }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: '' },
        ],
        combinator: 'and',
      },
    },
  },
});

const quarantineLead = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Quarantine Malformed Lead',
    parameters: {
      resource: 'record',
      operation: 'create',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: quarantineTableRl,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          lead_id: expr('{{ $("Validate & Route").item.json.lead_id }}'),
          vertical: expr('{{ $("Validate & Route").item.json.vertical }}'),
          quarantine_reason: expr('{{ $("Validate & Route").item.json.reason }}'),
          raw_payload: expr('{{ $("Validate & Route").item.json.raw_payload }}'),
          engine_received_at: expr('{{ $("Validate & Route").item.json.engine_received_at }}'),
        },
      },
      options: {},
    },
    credentials: airtableCred,
  },
  output: [{ id: 'recQ1', fields: { lead_id: '', quarantine_reason: 'vertical not in enum' } }],
});

const respondQuarantined = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Quarantined',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "quarantined", "lead_id": "{{ $("Validate & Route").item.json.lead_id }}", "reason": "{{ $("Validate & Route").item.json.reason }}" }'),
      options: { responseCode: 200 },
    },
  },
});

const findExisting = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Find Existing Lead',
    alwaysOutputData: true,
    parameters: {
      resource: 'record',
      operation: 'search',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: leadsTableRl,
      filterByFormula: expr('={lead_id}=\'{{ $("Validate & Route").item.json.lead_id }}\''),
      returnAll: false,
      limit: 1,
      options: {},
    },
    credentials: airtableCred,
  },
  // On a match Airtable returns the record (has `id`); on no match alwaysOutputData emits {}.
  output: [{ id: 'recL1', fields: { lead_id: 'apex_1721925123_a1b9' } }],
});

const isDuplicate = ifElse({
  version: 2.3,
  config: {
    name: 'Is Duplicate?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.id }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' },
        ],
        combinator: 'and',
      },
    },
  },
});

const respondDuplicate = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Duplicate',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "duplicate", "lead_id": "{{ $("Validate & Route").item.json.lead_id }}", "dedupe_status": "duplicate" }'),
      options: { responseCode: 200 },
    },
  },
});

const writeLead = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Write Lead to Store',
    parameters: {
      resource: 'record',
      operation: 'create',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: leadsTableRl,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          lead_id: expr('{{ $("Validate & Route").item.json.lead_id }}'),
          vertical: expr('{{ $("Validate & Route").item.json.vertical }}'),
          first_name: expr('{{ $("Validate & Route").item.json.first_name }}'),
          last_name: expr('{{ $("Validate & Route").item.json.last_name }}'),
          email: expr('{{ $("Validate & Route").item.json.email }}'),
          phone: expr('{{ $("Validate & Route").item.json.phone }}'),
          consent_sms: expr('{{ $("Validate & Route").item.json.consent_sms }}'),
          consent_text: expr('{{ $("Validate & Route").item.json.consent_text }}'),
          source: expr('{{ $("Validate & Route").item.json.source }}'),
          medium: expr('{{ $("Validate & Route").item.json.medium }}'),
          campaign: expr('{{ $("Validate & Route").item.json.campaign }}'),
          landing_page: expr('{{ $("Validate & Route").item.json.landing_page }}'),
          referrer: expr('{{ $("Validate & Route").item.json.referrer }}'),
          fbclid: expr('{{ $("Validate & Route").item.json.fbclid }}'),
          gclid: expr('{{ $("Validate & Route").item.json.gclid }}'),
          page_submitted: expr('{{ $("Validate & Route").item.json.page_submitted }}'),
          device: expr('{{ $("Validate & Route").item.json.device }}'),
          submitted_at: expr('{{ $("Validate & Route").item.json.submitted_at }}'),
          engine_received_at: expr('{{ $("Validate & Route").item.json.engine_received_at }}'),
          dedupe_status: expr('{{ $("Validate & Route").item.json.dedupe_status }}'),
          routed_to: expr('{{ $("Validate & Route").item.json.routed_to }}'),
          sms_from_name: expr('{{ $("Validate & Route").item.json.sms_from_name }}'),
          review_target: expr('{{ $("Validate & Route").item.json.review_target }}'),
          job_status: expr('{{ $("Validate & Route").item.json.job_status }}'),
        },
      },
      options: { typecast: true },
    },
    credentials: airtableCred,
  },
  output: [{ id: 'recL1', fields: { lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools' } }],
});

const respondAccepted = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Accepted',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "accepted", "lead_id": "{{ $("Validate & Route").item.json.lead_id }}", "routed_to": "{{ $("Validate & Route").item.json.routed_to }}", "dedupe_status": "new" }'),
      options: { responseCode: 200 },
    },
  },
});

export default workflow('apex-01-intake', 'Apex Lead Engine — 01 Intake')
  .add(leadIntakeWebhook)
  .to(validateAndRoute)
  .to(
    isValid
      .onFalse(quarantineLead.to(respondQuarantined))
      .onTrue(
        findExisting.to(
          isDuplicate
            .onTrue(respondDuplicate)
            .onFalse(writeLead.to(respondAccepted)),
        ),
      ),
  );
