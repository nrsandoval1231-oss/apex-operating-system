# PRD 05 — CRM & Pipeline Analytics

> **STATUS: NOT WRITTEN — deliberately deferred.** Placeholder only.
> **Depends on:** `01-lead-capture-funnels.md` (live lead data), `03-cost-capture-allocation.md` (job costs)

## What this will cover

The pipeline layer and the reporting Travis originally asked for: **lead conversion %, close rates, by vertical.**

Scope when written:
- CRM platform decision — Monday.com is the working assumption (Nick's call, already made); this PRD confirms it against real requirements rather than re-litigating
- Pipeline stages per vertical — four verticals with genuinely different sales cycles (a pool is months, a coating job is days, a service call is hours)
- Lead → Opportunity → Job progression, keyed on `lead_id` → Job ID (Foundation §2)
- Conversion and close-rate reporting by vertical, source, and campaign
- Cost per **won job** by vertical — and cost per **acquired account measured against LTV** for Pool Service, where first-job value badly understates worth
- Deduplication across web form, Facebook lead ads, and inbound calls

## Why it isn't written

**Not blocked — deferred on purpose.** Designing pipeline stages and reports before any tagged lead data exists means designing against assumptions.

PRD 01 Phase 1 instruments the site and starts capturing real vertical mix, source mix, and volume. Roughly 60 days of that data makes this PRD specific instead of speculative. Writing it now would produce a generic CRM spec that gets rebuilt on contact with reality.

Secondary reason: cost-per-**won-job** requires actual job costs, which requires PRD 03.

## What already exists toward this

The `apex-lead-engine` repo's Phase 3 writes leads into a holding store (Airtable or Sheets) as the interim CRM, built so the destination swaps in a single node once this PRD lands. So lead capture and stitching aren't waiting on this document — only the pipeline and reporting layer are.
