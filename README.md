# Apex — PRD Set

Operational modernization for Apex (Lubbock, TX). One brand, four verticals: **Designer Pools · Concrete Coating · Design & Renovation · Pool Service**.

**Numbered by build order, not by topic.** The sequence is dependency-driven: capture leads → price work → capture costs → pay people → measure → manage. Start at 00, then 01.

---

## Status

| # | Document | Status | Gate |
|---|---|---|---|
| **00** | [Foundation — Definitions & Data Model](00-foundation.md) | ✅ **Written** (v0.2) | — |
| **01** | [Lead Capture, Funnels & Marketing](01-lead-capture-funnels.md) | ✅ **Written** · handed off | Access transfer for launch only |
| **02** | [Pool Proposal & Takeoff Engine](02-proposal-takeoff-engine.md) | ✅ **Written** (v0.2) · engine built | Back-test passes on 1 job; needs a 2nd |
| **03** | [Cost Capture & Allocation](03-cost-capture-allocation.md) | ⚠ **Stub — blocked** | QuickBooks setup + contract review |
| **04** | [Commission Engine](04-commission-engine.md) | ⚠ **Stub — blocked** | Allowance mechanic + PRD 03 |
| **05** | [CRM & Pipeline Analytics](05-crm-pipeline-analytics.md) | ⏸ **Stub — deferred** | Needs ~60 days of real lead data |
| **06** | [Job Execution & Crew Scheduling](06-project-management.md) | ✅ **Written** (v0.1) | Phase 1 has **no** blockers |

> **Start here if you want to move the project, not read it:** [`decision-register.md`](decision-register.md) —
> all 28 open decisions across the four repos and seven PRDs, ranked by what they unlock and grouped
> by owner. Six of them unblock everything else. The build is roughly two sessions ahead of the
> decisions, and that register is how it gets unstuck.

**00 is the source of truth.** Every other document references it. Definitions live there once — cost codes, GP definition, allocation policy, the enum of verticals — so the PRDs can't drift apart and contradict each other at integration time.

---

## Read 00 first

It contains the two findings that reshape everything downstream:

- **§1** — the pricing structure is *markup*, not margin. "Cost Plus at 30%" is a **23.08%** gross margin. It's printed on customer estimates, so it's a disclosed contract fee, not an internal error. Decision on file: **Lever B** (expand the reimbursable cost base) rather than raising the disclosed rate.
- **§7** — under cost-plus, commission paid on GP *rewards cost overruns*. Costs rise → fee rises → GP rises → commission rises. Three fixes offered; needs sign-off.

A third finding now sits in **PRD 06 §2**: with one in-house crew, the business saturates at
**three concurrent pool builds**. Running the stated maximum of five produces the same ~19 pools
per year while making every customer wait 5.5 weeks longer — which under cost-plus is pure cost.

---

## Also in this set

- **`reference/whitaker-oasis-quantity-takeoff.md`** — a complete reverse-engineered takeoff of a real job (14×24 pool w/ spa). Proof that every dollar on a cost-plus estimate can trace to a quantity. Also the source of the derived starting unit costs, and the Lubbock-caliche geology correction.

## Related deliverables (separate packages)

- **`apex-website.zip`** — Claude Code-ready build package implementing PRD 01's site half. Includes the approved interactive mockup as the visual spec.
- **`apex-lead-engine.zip`** — Claude Code-ready n8n package implementing PRD 01's automation half.
- **`apex-strategy-deck.pptx`** — 13-slide exec strategy and roadmap deck. *The 23% margin finding is deliberately excluded from it.*
- **`apex-handoff.md`** — full context transfer for a new working session.

---

## Renumbering note (July 2026)

Numbers were reassigned to follow build order. Old references map as:

| Old | New |
|---|---|
| PRD 1 (Takeoff) | **PRD 02** |
| PRD 2 (Cost capture) | **PRD 03** |
| PRD 3 (Commission) | **PRD 04** |
| PRD 4 (Lead capture / marketing) | **PRD 01** |
| PRD 4 (CRM, earlier roadmap) | **PRD 05** |
| PRD 6 (PM boards) | **PRD 06** |

All internal cross-references have been updated. Conversations before this date may still use the old numbers.
