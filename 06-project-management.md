# PRD 06 — Project Management Boards

> **STATUS: NOT WRITTEN — deliberately deferred, lowest priority.** Placeholder only.
> **Depends on:** `05-crm-pipeline-analytics.md` (same platform, same Job ID)

## What this will cover

Per-vertical job execution boards in Monday.com — scheduling, phase tracking, crew assignment, and the job-status signal that several other systems depend on.

Scope when written:
- **Four separate workflows, not one board.** A pool build is a 6–8 week multi-phase sequence (dig → steel → plumb → gunite → tile → deck → plaster → equipment → startup). A coating job is one or two days. A service call is hours. Forcing one template across all four is the standard failure mode here.
- Phase templates driven by the cost codes in Foundation §4, so schedule and budget share a spine
- Crew and subcontractor scheduling — in Lubbock the binding constraint is sub availability, not price
- Seasonal constraints — gunite can't be shot in a hard freeze, so the Lubbock build calendar has a closed season
- **Job status transitions** (`lead → quoted → won → in progress → complete → reconciled`)
- Reconciliation gate — when a job is declared closed and Stage 2 commission unlocks

## Why it isn't written

Lowest leverage of the set, and it depends on decisions above it. Job costing (PRD 03) defines the phases; the CRM platform (PRD 05) defines where boards live. Building boards first produces something that has to be torn out.

## One dependency worth flagging early

Two other systems need a **job-status signal** from here:

- `apex-lead-engine` **Phase 4** (review requests) fires on *job completed*
- `apex-lead-engine` **Phase 5** (Meta offline conversions) fires on *job won*, with value

Both are logged in that repo as `⚠ BLOCKED — D-12`. This PRD is where that signal comes from. Worth knowing that a small piece of PRD 06 — just emitting status changes — unblocks two automations that are otherwise stuck, well before the full board build is needed.
