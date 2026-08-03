# Inspections and gate checklists — APPROVED

**Date:** 2026-08-03
**Approved:** 2026-08-03 by Travis Sandoval, as written, with no corrections.
**Status:** This document is no longer a proposal. It is the authority for the
inspection list, the lead times, and the seven gate checklists, and it is built —
migrations `0017_gate_checklist_v2.sql` and `0018_inspections.sql`.

Everything below stands as approved. The nine ⟨A1⟩-style markers and the register
at the end were the open assumptions at the time of writing; approval converted
each into a confirmed decision, and they are kept rather than deleted because
what a decision replaced is worth being able to read later.

Corrections after this point land as a **new checklist version and a new
migration**, never as an edit — a Gate already passed keeps the checklist its
field lead was actually asked for.

---

# Part 1 — Inspections

## The list

Seven inspections, in build order. Every column is populated.

| # | Inspection | Phase | Requested by | Lead time | Blocks | How requested |
|---|---|---|---|---|---|---|
| 1 | Pool steel & structural | 3 · Steel reinforcement | Apex | 2 business days | Gunite pour | City inspection portal ⟨A6⟩ |
| 2 | Equipotential bonding | 4 · Rough-in | Electrical sub ⟨A4⟩ | 2 business days | Gunite pour | City inspection portal |
| 3 | Pool plumbing pressure test | 4 · Rough-in | Plumbing sub ⟨A4⟩ | 2 business days | Gunite pour | City inspection portal |
| 4 | Deck pre-pour | 7 · Decking | Apex | 2 business days | Deck pour | City inspection portal |
| 5 | Gas line pressure test | 8 · Equipment hookup | Gas fitter ⟨A5⟩ | 2 business days | Equipment gate | City inspection portal |
| 6 | Electrical final | 8 · Equipment hookup | Electrical sub | 3 business days | Final gate | City inspection portal |
| 7 | Final & safety barrier | 9 · Plaster and fill | Apex | 3 business days | Handover | City inspection portal |

## How this list was derived

Lubbock adopts the **2021 ISPSC**, which is already confirmed in the construction
model document. That code, plus **NEC Article 680** for bonding and equipment,
determines what has to be inspected on a residential gunite pool. The list above
is what those two documents require, sequenced against Apex's nine phases. It is
not a guess at Lubbock's local practice — it is the code requirement, which local
practice implements.

The two places local practice *does* vary are marked as assumptions: whether the
city combines inspections 1–3 into one visit ⟨A2⟩, and the actual turnaround
⟨A3⟩.

## Three decisions inside the list

**Inspections 1, 2, and 3 are modelled separately, even though Lubbock may well
send one inspector to cover all three in a single pre-gunite visit.** ⟨A2⟩

This is deliberate and the risk is asymmetric. If the city combines them, three
rows with the same lead time and the same blocker collapse into one with no harm
done — you delete two lines. If the city treats them separately and the system
models one, it under-warns, and someone finds out on pour day. Modelling apart
and merging later is free; modelling together and splitting later is not.

**Lead times are rounded up, not estimated accurately.** ⟨A3⟩

Two business days for routine trade inspections, three for finals. Most
jurisdictions will do next-business-day if you request before the afternoon
cutoff, so these numbers are conservative on purpose.

The reason: the system uses lead time to compute the last day it is still safe to
request an inspection. A lead time that is too *long* makes the card appear a day
early — harmless. A lead time that is too *short* makes it appear a day late —
a crew arrives and cannot work. Given that the error is one-directional in cost,
every number here errs long.

If real turnaround is next-day, tightening these is a one-line change per row and
the system immediately gets sharper. Nothing breaks in the meantime.

**Nothing is scheduled at excavation.** The ISPSC has no excavation-stage
inspection for a residential pool; the first structural hold is at steel. If
Lubbock requires a pre-construction or erosion-control visit, that is a local
addition and belongs as row 0. ⟨A7⟩

## What this unblocks

With this list, build-plan Step 5's inspection half becomes buildable: last-safe-
request-date cards, blocking dependent work when a required inspection has not
passed, and recording failed inspections with their corrections. That is the last
unbuilt item in the plan.

---

**Part 1 approved as written — Travis Sandoval, 2026-08-03.**

---

# Part 2 — The seven gate checklists

All seven are built and running. What follows is the proposed final content:
six decisions confirmed, and **twelve additions** — three of which are safety items
that should not ship without them.

## The six open decisions, decided

**1. Utility locates stay on the Permit gate.** Locates have to clear before
anyone digs, and the Excavation gate is only reached once digging is finished.
Putting them on Excavation would mean the system checks for them after the risk
has already passed. **No change.**

**2. Draw 1 releasing at Excavation is correct and is not ours to change.** It
funds machinery, hauling, and the initial steel — work that follows it. Paying
forward at that point is the signed 10/30/30/20/10 contract structure from the
construction model, not a system choice. **No change.**

**3. Two signatures stay on pre-gunite only.** The countersign exists to stop
irreversible concealment, not to police money. The four draw-bearing gates
already have a separate money control — confirming an invoice is restricted to
you and the office, and a superintendent cannot do it. Adding a countersign to
those gates would stall draws whenever you travel, which is the exact problem the
authority model was changed to solve. **No change.**

**4. Pre-gunite keeps 11 items, not 12.** Every item already requires its own
photo, so a separate "photos attached" checkbox is a second place recording the
same fact — and a second place to disagree with itself. **No change.**

**5. The office keeps "installed materials match customer selections."** The
record of what the customer chose lives in the office; a field lead cannot verify
against a document they do not hold. The field photographs, the office confirms
the match. **No change.**

**6. The Final gate records startup and gives no chemistry guidance.** Dosing
advice requires validation Apex has not done, and the system says so rather than
implying it. **No change.**

## The two safety gaps — these matter

Reviewing all thirty-four items against the ISPSC turned up two omissions that
are not stylistic.

### Anti-entrapment (VGB-compliant) outlet covers — missing entirely

Not on any of the seven checklists. This is the single most consequential
omission on the list: suction entrapment is the failure mode the federal
Virginia Graeme Baker Act exists to prevent, and ISPSC Section 310 requires
compliant covers on every suction outlet.

It needs to appear **twice**, because it can go wrong at two different moments:

- **Pre-gunite** — the outlet and its cover are installed before the shell buries
  the plumbing. Verifying afterwards means verifying something you cannot see.
- **Final** — the cover actually fitted at the end is the one the customer swims
  over, and covers get swapped.

**Proposed additions:**
- Pre-gunite item 12: *Suction outlets and anti-entrapment covers installed* —
  "Document each suction outlet and its VGB-compliant cover before concealment."
- Final item 6: *Anti-entrapment covers verified* — "Confirm the installed covers
  are VGB-compliant, unbroken, and correctly fastened."

### Safety barrier, gates, and alarms — missing entirely

Also on no checklist. ISPSC Section 305 governs barriers, self-closing and
self-latching gates, and door alarms, and it is what the final inspection turns
on. A pool that passes every gate in Apex OS today could be handed over with no
compliant barrier and the system would not have noticed.

**Proposed addition:**
- Final item 7: *Safety barrier, gates, and alarms verified* — "Document the
  barrier height and openings, self-closing and self-latching gates, and any
  required door or gate alarms."

## The nine other proposed additions

Ordinary quality items, each one a callback Apex would otherwise absorb.

| Gate | Add | Why |
|---|---|---|
| Permit | HOA or deed-restriction approval on file ⟨A8⟩ | Not a code item, but a common reason a Lubbock pool job stops after permitting |
| Excavation | Soil and bearing condition acceptable | Caliche and expansive clay are local facts; the shell is designed against a soil assumption |
| Excavation | Open excavation secured overnight | An open hole on a residential lot between the dig and the steel is a liability with no current record |
| Shell | Rebound and trimmings removed | Standard gunite QC; rebound left in a corner becomes a weak point nobody can see later |
| Shell | Bond beam elevation verified | Wrong elevation is discovered at tile, when it is expensive |
| Deck & tile | Deck drains and slopes away from the pool | ISPSC drainage requirement and a routine callback |
| Deck & tile | Expansion joint at coping verified | Omitted joints crack decks in a West Texas temperature swing |
| Equipment | Heater clearances and venting verified ⟨A9⟩ | Only applies to gas heaters; manufacturer clearance is the usual failure |
| Equipment | Equipment pad labelled — valves and disconnect | The customer operates this pool for twenty years |

## Two structural questions, answered

**Is any gate in the wrong place?** No. Each sits at the end of its phase except
pre-gunite, which sits on the gunite phase and holds it — correct, because it
guards the pour rather than following it.

**Is there a hold point with no gate?** One candidate: **pre-plaster surface
prep**, between decking and interior finish. I recommend **not** adding an eighth
gate for it. The Final gate's "interior finish complete" already captures the
outcome, and a gate whose only job is to check preparation for the next step
tends to become a formality that gets clicked through. Worth adding only if Apex
has actually been burned by a plaster job over a bad surface — you would know.

## The full checklists as proposed

Additions marked **NEW**.

**Gate 1 — Permit** *(no draw)*
1. Engineered plans approved
2. Permit issued
3. Utility locates cleared
4. **NEW** HOA or deed-restriction approval on file

**Gate 2 — Excavation** *(releases Draw 1, 30%)*
1. Layout verified against plan
2. Depths verified against plan
3. Dimensions verified against plan
4. Spoil handled
5. **NEW** Soil and bearing condition acceptable
6. **NEW** Open excavation secured overnight

**Gate 3 — Pre-gunite hold point** *(two signatures · no draw)*
1. Layout and dimensions reverified
2. Depths and spa dimensions match plan
3. Steel size, spacing, cover, laps, and chairs verified
4. Lowered sections and structural details verified
5. Plumbing pressure test recorded
6. Electrical niches and bonding verified
7. Equipment vault / pad alignment verified
8. Hydrostatic relief installed where required
9. Substrate condition acceptable
10. Nozzleman / crew qualification confirmed
11. Mix design / strength confirmed
12. **NEW** Suction outlets and anti-entrapment covers installed

**Gate 4 — Shell** *(releases Draw 2, 30%)*
1. Gunite placed to plan
2. Shell dimensions verified
3. Curing started and recorded
4. **NEW** Rebound and trimmings removed
5. **NEW** Bond beam elevation verified

**Gate 5 — Deck & tile** *(releases Draw 3, 20%)*
1. Waterline tile complete
2. Coping set
3. Patio decking complete
4. Installed materials match customer selections
5. **NEW** Deck drains and slopes away from the pool
6. **NEW** Expansion joint at coping verified

**Gate 6 — Equipment** *(no draw)*
1. Equipment set and plumbed
2. Electrical connected and bonded
3. Pressure and leak check passed
4. System runs through its modes
5. **NEW** Heater clearances and venting verified
6. **NEW** Equipment pad labelled

**Gate 7 — Final** *(releases the Final Draw, 10%)*
1. Interior finish complete
2. Fill complete
3. Equipment commissioned
4. Startup recorded
5. Customer walkthrough completed
6. **NEW** Anti-entrapment covers verified
7. **NEW** Safety barrier, gates, and alarms verified

Thirty-four items become forty-six — the two safety omissions account for three
of the additions, because anti-entrapment is checked at both pre-gunite and
final. Correcting any of them later creates a new
version of that checklist and never rewrites a gate already passed.

---

**Part 2 approved as written — Travis Sandoval, 2026-08-03.**

---

# Assumptions register

Nine values were derived rather than confirmed by Apex. Each is safe to be wrong
about in the stated direction, and each is a small change to correct.

| # | Assumption | If wrong |
|---|---|---|
| A1 | Apex builds only inside Lubbock city limits | **Confirmed.** County work would be a second regime and a new migration, not a column default |
| A2 | Steel, bonding, and pressure test are separate inspections | If combined, delete two rows — no other effect |
| A3 | 2 business days routine / 3 for finals | **Confirmed as the planning numbers.** Still deliberately long: if observed turnaround is next-day, tightening each row is one number and only sharpens the warnings |
| A4 | Electrical and plumbing inspections are requested by the sub who holds that licence | Change the "requested by" column; it only decides whose card it is |
| A5 | Gas heater is common enough to warrant a standing gas inspection | If Apex rarely fits gas heat, mark rows 5 and Equipment item 5 conditional |
| A6 | Requests go through a city portal | Free-text field; correct in place |
| A7 | No pre-construction or erosion-control inspection | If one exists, it is a new row 0 blocking excavation |
| A8 | HOA approval is worth tracking on the Permit gate | Drop the item if Apex does not handle this |
| A9 | Heater clearance check applies only to gas heaters | Reword for electric or heat-pump equipment |

**A3 remains the one worth revisiting.** Every other assumption is a naming or
routing detail. Lead time is the number the whole inspection feature computes
from, and it is the one thing no code can derive — it is however long Lubbock
actually takes. Approved as a conservative planning figure, not as a measurement;
the first few real inspections will say whether it can be tightened.

---

# The customer-facing wording

Also approved 2026-08-03, as written. The nine per-phase descriptions a homeowner
reads on their progress page (`packages/domain/src/customer.ts`, `PHASE_COPY`)
are now Apex's approved voice rather than a draft awaiting review.

Same rule as the checklists: changing the wording is a code change with a test,
not a database edit, and the page will never carry a per-phase date — Apex OS
holds a target completion window, not a schedule anyone committed to.
