/**
 * workflows/02-job-status.ts — Apex Lead Engine, the D-12 job-status signal.
 *
 * Receives one event per job status transition at `POST /apex-job-status`, validates it against
 * docs/job-status-contract.md, dedupes on a DETERMINISTIC `event_id` (Hard rule 1 / D-16), and
 * records it to the JobEvents store. Specified by apex-prds/06-project-management.md §7.
 *
 * THIS WORKFLOW SENDS NOTHING. It exists to make the signal exist and be trustworthy. Phase 4
 * (review requests, on `complete`) and Phase 5 (Meta offline conversions, on `won`) consume the
 * JobEvents store when their own gates clear — D-11 SMS provider and D-01 Meta access
 * respectively. Because it sends nothing, it can go live immediately and start accumulating a
 * real event history while those gates are still closed.
 *
 * IDEMPOTENCY. `event_id` is derived as `evt_<job_id>_<to_status>`, never random. A retry, a
 * double-click in Monday, or an automation firing twice all collapse to one key. It also covers
 * the real edge case: a job that reopens and completes again does NOT earn a second review
 * request, which is the throttle Phase 4 requires.
 *
 * PLATFORM-AGNOSTIC ON PURPOSE. The emitting side is a Monday board today
 * (apex-prds/reference/monday-jobs-board-spec.md), but nothing here depends on that — any system
 * that can POST the contract works, so the board can be rebuilt or replaced freely.
 *
 * Config from n8n environment vars (nothing sensitive in this file — Hard rule 5):
 *   AIRTABLE_BASE_ID, AIRTABLE_TABLE_JOB_EVENTS (default "JobEvents"),
 *   AIRTABLE_TABLE_QUARANTINE (default "Quarantine").
 *
 * Fixtures F–J in workflows/fixtures/ are the required test inputs.
 *
 * NOTE: the SDK parser is static — no helper functions / arrow fns / TS-only syntax out here.
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
const jobEventsTableRl = { __rl: true, mode: 'id', value: expr('{{ $env.AIRTABLE_TABLE_JOB_EVENTS || "JobEvents" }}') };
const quarantineTableRl = { __rl: true, mode: 'id', value: expr('{{ $env.AIRTABLE_TABLE_QUARANTINE || "Quarantine" }}') };

const jobStatusWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Job Status Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'apex-job-status',
      responseMode: 'responseNode',
      authentication: 'none',
    },
  },
  output: [
    { body: { job_id: 'APX-2026-014', lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools', to_status: 'complete', changed_at: '2026-07-26T14:32:11-05:00' } },
  ],
});

const validateStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validate & Classify',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      // Single string literal. This is the ONE place the status enum, the vertical enum, the
      // routing table, and the eligibility rules live — so Phases 4 and 5 never re-derive them.
      jsCode:
        "const ENUM = ['Designer Pools','Concrete Coating','Design & Renovation','Pool Service'];\n" +
        "const STATUSES = ['lead','quoted','won','in progress','complete','reconciled','lost'];\n" +
        "const ROUTING = {\n" +
        "  'Designer Pools':      { inbox: 'pools@apexgetsitdone.com',   review_target: 'Google (pools GBP)' },\n" +
        "  'Concrete Coating':    { inbox: 'coating@apexgetsitdone.com', review_target: 'Google (coating GBP)' },\n" +
        "  'Design & Renovation': { inbox: 'reno@apexgetsitdone.com',    review_target: 'Google' },\n" +
        "  'Pool Service':        { inbox: 'service@apexgetsitdone.com', review_target: 'Google' }\n" +
        "};\n" +
        "const src = ($json && $json.body) ? $json.body : $json;\n" +
        "const s = (v) => (v === undefined || v === null) ? '' : String(v).trim();\n" +
        "const num = (v) => (v === undefined || v === null || v === '') ? null : Number(v);\n" +
        "const job_id = s(src.job_id);\n" +
        "const lead_id = s(src.lead_id);\n" +
        "const vertical = s(src.vertical);\n" +
        "const to_status = s(src.to_status).toLowerCase();\n" +
        "const from_status = s(src.from_status).toLowerCase();\n" +
        "const changed_at = s(src.changed_at);\n" +
        "const email = s(src.email).toLowerCase();\n" +
        "const phone = s(src.phone).replace(/\\D/g, '');\n" +
        "const contract_value = num(src.contract_value);\n" +
        "const job_cost = num(src.job_cost);\n" +
        "const event_id = 'evt_' + job_id + '_' + to_status;\n" +
        "const supplied_event_id = s(src.event_id);\n" +
        "const reasons = [];\n" +
        "if (!/^APX-\\d{4}-\\d{3,}$/.test(job_id)) reasons.push('job_id missing or malformed');\n" +
        "if (STATUSES.indexOf(to_status) === -1) reasons.push('to_status not in enum');\n" +
        "if (ENUM.indexOf(vertical) === -1) reasons.push('vertical not in enum');\n" +
        "if (!changed_at) reasons.push('changed_at missing');\n" +
        "if (to_status === 'won' && !(typeof contract_value === 'number' && isFinite(contract_value) && contract_value > 0)) reasons.push('won requires a positive contract_value');\n" +
        "if (to_status === 'complete' && !email && !phone) reasons.push('complete requires an email or phone for the review request');\n" +
        "if (lead_id && !/^apex_\\d+_[0-9a-z]{4}$/.test(lead_id)) reasons.push('lead_id present but malformed');\n" +
        "if (supplied_event_id && supplied_event_id !== event_id) reasons.push('event_id does not match the derived value');\n" +
        "const valid = reasons.length === 0;\n" +
        "const route = ROUTING[vertical] || { inbox: '', review_target: '' };\n" +
        "return {\n" +
        "  valid,\n" +
        "  reason: reasons.join('; '),\n" +
        "  event_id,\n" +
        "  event: 'job.status_changed',\n" +
        "  job_id, lead_id, vertical, from_status, to_status, changed_at,\n" +
        "  first_name: s(src.first_name),\n" +
        "  last_name: s(src.last_name),\n" +
        "  email, phone,\n" +
        "  contract_value, job_cost,\n" +
        "  source_system: s(src.source_system) || 'monday',\n" +
        "  source_item_id: s(src.source_item_id),\n" +
        "  engine_received_at: new Date().toISOString(),\n" +
        "  dedupe_status: 'new',\n" +
        "  meta_eligible: valid && to_status === 'won' && lead_id !== '',\n" +
        "  review_eligible: valid && to_status === 'complete' && (email !== '' || phone !== ''),\n" +
        "  routed_to: route.inbox,\n" +
        "  review_target: route.review_target,\n" +
        "  meta_uploaded_at: null,\n" +
        "  review_sent_at: null,\n" +
        "  raw_payload: JSON.stringify(src)\n" +
        "};",
    },
  },
  output: [
    {
      valid: true, reason: '', event_id: 'evt_APX-2026-014_complete', event: 'job.status_changed',
      job_id: 'APX-2026-014', lead_id: 'apex_1721925123_a1b9', vertical: 'Designer Pools',
      from_status: 'in progress', to_status: 'complete', changed_at: '2026-07-26T14:32:11-05:00',
      first_name: 'Jordan', last_name: 'Whitaker', email: 'jordan.w@email.com', phone: '8065550142',
      contract_value: 152041.73, job_cost: 116955.18, source_system: 'monday', source_item_id: '9876543210',
      engine_received_at: '2026-07-26T19:32:12.000Z', dedupe_status: 'new',
      meta_eligible: false, review_eligible: true, routed_to: 'pools@apexgetsitdone.com',
      review_target: 'Google (pools GBP)', meta_uploaded_at: null, review_sent_at: null, raw_payload: '{}',
    },
  ],
});

const isValid = ifElse({
  version: 2.3,
  config: {
    name: 'Is Valid Event?',
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

const quarantineEvent = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Quarantine Malformed Event',
    parameters: {
      resource: 'record',
      operation: 'create',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: quarantineTableRl,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          lead_id: expr('{{ $("Validate & Classify").item.json.job_id }}'),
          vertical: expr('{{ $("Validate & Classify").item.json.vertical }}'),
          quarantine_reason: expr('{{ $("Validate & Classify").item.json.reason }}'),
          raw_payload: expr('{{ $("Validate & Classify").item.json.raw_payload }}'),
          engine_received_at: expr('{{ $("Validate & Classify").item.json.engine_received_at }}'),
        },
      },
      options: { typecast: true },
    },
    credentials: airtableCred,
  },
  output: [{ id: 'recQ2', fields: { quarantine_reason: 'won requires a positive contract_value' } }],
});

const respondQuarantined = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Event Quarantined',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "quarantined", "job_id": "{{ $("Validate & Classify").item.json.job_id }}", "reason": "{{ $("Validate & Classify").item.json.reason }}" }'),
      options: { responseCode: 200 },
    },
  },
});

const findExistingEvent = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Find Existing Event',
    alwaysOutputData: true,
    parameters: {
      resource: 'record',
      operation: 'search',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: jobEventsTableRl,
      filterByFormula: expr('={event_id}=\'{{ $("Validate & Classify").item.json.event_id }}\''),
      returnAll: false,
      limit: 1,
      options: {},
    },
    credentials: airtableCred,
  },
  output: [{ id: 'recE1', fields: { event_id: 'evt_APX-2026-014_complete' } }],
});

const isDuplicateEvent = ifElse({
  version: 2.3,
  config: {
    name: 'Is Duplicate Event?',
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

const respondDuplicateEvent = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Event Duplicate',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "duplicate", "event_id": "{{ $("Validate & Classify").item.json.event_id }}", "dedupe_status": "duplicate" }'),
      options: { responseCode: 200 },
    },
  },
});

const writeJobEvent = node({
  type: 'n8n-nodes-base.airtable',
  version: 2.2,
  config: {
    name: 'Write Job Event',
    parameters: {
      resource: 'record',
      operation: 'create',
      authentication: 'airtableTokenApi',
      base: baseRl,
      table: jobEventsTableRl,
      columns: {
        mappingMode: 'defineBelow',
        value: {
          event_id: expr('{{ $("Validate & Classify").item.json.event_id }}'),
          job_id: expr('{{ $("Validate & Classify").item.json.job_id }}'),
          lead_id: expr('{{ $("Validate & Classify").item.json.lead_id }}'),
          vertical: expr('{{ $("Validate & Classify").item.json.vertical }}'),
          from_status: expr('{{ $("Validate & Classify").item.json.from_status }}'),
          to_status: expr('{{ $("Validate & Classify").item.json.to_status }}'),
          changed_at: expr('{{ $("Validate & Classify").item.json.changed_at }}'),
          first_name: expr('{{ $("Validate & Classify").item.json.first_name }}'),
          last_name: expr('{{ $("Validate & Classify").item.json.last_name }}'),
          email: expr('{{ $("Validate & Classify").item.json.email }}'),
          phone: expr('{{ $("Validate & Classify").item.json.phone }}'),
          contract_value: expr('{{ $("Validate & Classify").item.json.contract_value }}'),
          job_cost: expr('{{ $("Validate & Classify").item.json.job_cost }}'),
          source_system: expr('{{ $("Validate & Classify").item.json.source_system }}'),
          source_item_id: expr('{{ $("Validate & Classify").item.json.source_item_id }}'),
          engine_received_at: expr('{{ $("Validate & Classify").item.json.engine_received_at }}'),
          dedupe_status: expr('{{ $("Validate & Classify").item.json.dedupe_status }}'),
          meta_eligible: expr('{{ $("Validate & Classify").item.json.meta_eligible }}'),
          review_eligible: expr('{{ $("Validate & Classify").item.json.review_eligible }}'),
          routed_to: expr('{{ $("Validate & Classify").item.json.routed_to }}'),
          review_target: expr('{{ $("Validate & Classify").item.json.review_target }}'),
        },
      },
      options: { typecast: true },
    },
    credentials: airtableCred,
  },
  output: [{ id: 'recE1', fields: { event_id: 'evt_APX-2026-014_complete', job_id: 'APX-2026-014' } }],
});

// Phase 4 (reviews, D-11) reads review_eligible from the store; Phase 5 (Meta, D-01) reads
// meta_eligible. Neither is wired here — this workflow sends nothing (Hard rule 7).
const respondRecorded = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Event Recorded',
    parameters: {
      respondWith: 'json',
      responseBody: expr('{ "status": "recorded", "event_id": "{{ $("Validate & Classify").item.json.event_id }}", "job_id": "{{ $("Validate & Classify").item.json.job_id }}", "to_status": "{{ $("Validate & Classify").item.json.to_status }}", "meta_eligible": {{ $("Validate & Classify").item.json.meta_eligible }}, "review_eligible": {{ $("Validate & Classify").item.json.review_eligible }} }'),
      options: { responseCode: 200 },
    },
  },
});

export default workflow('apex-02-job-status', 'Apex Lead Engine — 02 Job Status')
  .add(jobStatusWebhook)
  .to(validateStatus)
  .to(
    isValid
      .onFalse(quarantineEvent.to(respondQuarantined))
      .onTrue(
        findExistingEvent.to(
          isDuplicateEvent
            .onTrue(respondDuplicateEvent)
            .onFalse(writeJobEvent.to(respondRecorded)),
        ),
      ),
  );
