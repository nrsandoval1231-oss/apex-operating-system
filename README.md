# Apex Designer — pool & spa plan + materials takeoff

Lubbock, Texas. 2021 ISPSC as adopted by Ord. 2024-O0033, amended by Code of
Ordinances Art. 28.18.

Built to the PRD in [prd-pool-spa-plan-takeoff.md](prd-pool-spa-plan-takeoff.md).
Quantities only — no pricing, no design, not a permit set.

## Status

Build order steps **1 (geometry + volume + Lubbock amendment checks)**,
**2 (layered excavation)**, **3 (takeoff sheet on screen)**,
**4 (structure takeoff)**, **5 (hydraulics)**, **6 (equipment, gas demand and
pad)**, **7 (cover)**, **8 (finishes, yard and drainage)**,
**9 (SVG plan view)**, **10 (print stylesheet to PDF)** and **11 (input form and
JSON save/load)** are complete. Every step in the PRD's build order is done.

```bash
npm install
npm run dev     # takeoff sheet at localhost:5173
npm test        # 448 tests
npm run takeoff # same numbers, headless, for reconciliation
```

## Layout

```
src/engine/          pure TypeScript, no UI imports
  calc.ts            the show-your-work primitive — every number is a Calc
  profile.ts         piecewise-linear depth profile + depth-band integration
  codeChecks.ts      Lubbock amendments: 307.2.2.2, 411.2.1/.2, 411.5.1/.2
  geometry.ts        step 1 — volume, wetted area, perimeter, displacement
  excavation.ts      step 2 — layered cut, BCY/LCY/CCY, backfill, haul
  standardDetail.ts  step 4 — the stored detail, its envelope, and matching
  structure.ts       step 4 — gunite, bar schedule, cut plan, ties, piers
  pipe.ts            Sch 40 PVC, velocity, Hazen-Williams, fitting L/D
  pumpCatalog.ts     pump curve type + interpolation; ships empty
  hydraulics.ts      step 5 — flow, velocity, TDH, convergence, SOFA
  equipment.ts       step 6 — pump selection, gas demand, pad layout
  cover.ts           step 7 — barrier path, vault, shell constraints
  finishes.ts        step 8 — tile, coping, plaster, Lubbock contrast stripe
  yard.ts            step 8 — deck area, 306.5 slope band, drainage
  deck.ts            the slab as drawn, less whatever stands in it
  grid.ts            free 2-D placement: 6" lattice, corner and centre magnets
  planView.ts        step 9 — dimensioned SVG plan + step 10 print scale
  planRotation.ts    quarter-turn sheet rotation; the view transform, not the model
  jobFile.ts         step 11 — JSON save/load, versioned and validated
  standardModel.ts   15x30 pool, 6x6x3.5 spa, 3.5-6 ft — the test fixture
  types.ts           job input model
src/cli/takeoff.ts   headless report (--example-detail to exercise structure)
src/cli/renderSheet.ts  standalone HTML for sharing to a phone
src/ui/              step 3 — the takeoff sheet
  CalcTable.tsx      renders Calc records; contains no arithmetic of its own
  CodeCheckTable.tsx every check that ran, passes included
  TakeoffSheet.tsx   sheet layout, plan sheet, stops, notes
  JobEditor.tsx      step 11 — input form, save/load, soil layer editor
```

## Rules the code enforces

- **Nothing returns a bare number.** Every quantity is a `Calc` carrying its
  formula, its named inputs with units, and its result with a unit. The tests
  assert this structurally, so a bare number cannot be added later without
  breaking the suite.
- **Volume states are never conflated.** BCY / LCY / CCY are separate units on
  separate lines. Backfill balances in compacted; haul counts in loose.
- **Swell is per layer, has no default, and carries its provenance.**
  `computeExcavation` throws if a layer has no swell factor, and every layer's
  swell prints with the source it came from. A figure off your own haul tickets
  and a figure off a general reference are not the same evidence, and the sheet
  does not make them look alike.
- **No detail, no structural quantities.** `computeStructure` returns a refusal —
  not a partial answer — when nothing is stored or when no stored detail's
  envelope covers the job. The return type has no quantities field in those
  cases, so the UI cannot render a number that wasn't produced.
- **A detail says which fields were stated and which were assumed**, and an
  unconfirmed envelope is called out on every job that uses it. A boundary nobody
  agreed to only refuses jobs outside a range the tool invented.
- **Dual suction outlets only.** `computeHydraulics` throws on a single-outlet
  job before computing anything. Branch suction is sized on the single-blocked
  condition at 6 fps, which is stricter than the code and the energy standard
  and is what actually sizes main drain branches.
- **Three velocity thresholds, each labeled with its standard.** 8 fps is the
  code hard fail, 6 fps is the design flag, 5 fps is GENESIS guidance that is
  reported but does not colour the segment. The energy standard is labeled
  filtration-piping-only so it is never read as code.
- **Turnover is re-checked at the converged flow**, not just the design flow. A
  pump that delivers more than the 6 h maximum fails even when the sizing was
  done at a compliant design flow.
- **Gas is a demand calculation, never a design.** Total connected load governs,
  not the heater alone. Meter capacity is a required input the tool cannot know.
  The NFPA 54/58 capacity tables are not built in — no table, no pipe size. Size
  selection is independent of row order, and a run beyond the entered table
  fails closed rather than reusing a shorter terminal row.
- **An attached spa is not free material.** Its excavation outside the pool
  envelope, shell area, cove, exterior bond beam, reinforcement families, and
  plan-view excavation/deck outlines are traceable. The shared dam wall remains
  separate from the three exterior spa walls and is not double-counted.
- **Safety failures roll up to the sheet.** Hydraulic hard failures, gas meter or
  intended-size failures, and impossible pad runs set the takeoff's global
  failure state; they cannot remain red inside a module while the sheet appears
  clear.
- **A cover used as the barrier must be ASTM F1346 listed.** Lubbock amended
  305.1 lets a powered safety cover exempt the pool from barrier sections 305.2
  through 305.7, so the listing is load-bearing: without it the job has no
  barrier at all, and the check hard-fails rather than degrading quietly.
- **Size is a drag, not a form field.** One corner grip resizes any object in
  both axes at once, snapped to the same 6" lattice positions use, so a bench and
  the ledge beside it can be made to match exactly. It replaces four separate
  grips — width and depth, for steps and for seats — each of which moved one
  dimension along an axis that depended on which wall the object was against.
  Grips are drawn **only on the selected object**: the old ones sat on every step
  and bench at all times and read as an extra tread, which is chrome masquerading
  as geometry on a drawing somebody builds from. Sizes floor at the code
  minimums — 20" stair width, 12" tread run, 24" bench width, 10" bench depth —
  because a drag that can draw a non-compliant stair is a drag that produces a
  drawing someone has to be told about later. Resizing adopts a free position
  first, so the corner you are not dragging stays put.
- **Everything on the plan moves in two dimensions, on a 6" lattice.** The pool's
  four inside corners, four outside corners, four wall centres and its centre
  pull harder than the rest, so freedom does not cost symmetry and the tool says
  which position it landed on. Objects also snap flush to **each other** —
  `abutMagnets` puts a stair exactly on the edge of a tanning ledge, because half
  an inch of gap between them is a gap somebody has to build and it will not be
  in the takeoff. Steps began wall-bound, which is right for a stair built into a
  pool wall and wrong for one coming off a ledge, where there is no pool wall
  involved at all. An
  **inset spa is clamped inside the water**, because `insetIntoPool` is what
  tells the excavation engine it needs no cut outside the pool envelope; a spa
  flagged inset but drawn on the deck would report quantities for a pool nobody
  is building. Its dam wall is drawn on every edge facing pool water — two in a
  corner, four in the middle — rather than the two that used to be hardcoded.
- **Floor depth is derived, not entered — and moving something changes the
  takeoff.** A step or a seat displaces water down to the floor beneath it, and
  that floor was an entered number: a new seat got `shallowDepth + 1` regardless
  of where it sat. On the standard model the bench claimed a 4'-6" floor while
  sitting over water averaging 5'-8", and under-displaced by about a third — 32
  cf against 44.53. The takeoff now derives it from the object's own footprint
  against the depth profile, **averaged across the footprint** because the floor
  slopes and a figure taken at one edge is wrong everywhere else.
  `floorDepthFt` stays on the record so old job files load, and is no longer read.
  **This gives up a property the tool used to have:** placement no longer leaves
  quantities alone. Dragging a bench from the shallow end to the deep end really
  does displace more water, and the drawing now says so — which is why the
  quantity model is **`designer-quantity-v4`**.
- **One definition of an object's footprint.** `stepFootprint` and
  `seatFootprint` serve the renderer, the drag handler and the takeoff. Three
  copies of that arithmetic is what produced a bench that flipped its shape the
  first time it was touched and a resize anchor that sat where the object was not
  drawn.
- **The deck is a drawn slab, not a border width.** `deck.ts` takes the
  rectangle someone drew around the concrete and subtracts everything standing
  in it — the water, and an attached spa — clipping each to the slab first, so a
  spa that overhangs the concrete only removes the part actually inside it. The
  old model was a constant-width ring, `(L + 2w)(W + 2w) - LW`, which could not
  describe a deck that is wider at the shallow end and **never subtracted an
  attached spa**: every such job over-ordered concrete by the area the spa stands
  on. Fixing that changes `yard.deck-area`, one of the seventeen signed
  quantities, which is why the quantity model is **`designer-quantity-v3`** — a
  consumer holding a v2 revision must not read it as meaning the same thing. Fall
  is now computed over the longest run from water to slab edge rather than over
  the one entered width. A slab drawn through the water is refused, not
  approximated.
- **The sheet rotates; the pool does not.** `planRotation.ts` turns the finished
  drawing a quarter turn at a time. The model is untouched — shallow is still
  where the water is 3'-6", the profile still runs shallow to deep, and every
  `Placement` still names a physical wall. That is deliberate: rotating the model
  instead would redefine "shallow" to achieve a presentation change, and
  `placement.ts` is imported by the renderer alone, so a view transform provably
  cannot reach the seventeen signed quantities. Labels counter-rotate about their
  own anchor so nothing ever prints upside down, dimensions stay aligned to their
  own dimension line, drags map back through one inverse, and the title block
  states the rotation because a printed sheet cannot show the button that turned
  it. **It cannot put the deep end toward the house** — the house is drawn off
  the top wall and turns with the pool. That is a different feature and a
  different data change, and rotation must not be made to fake it.
- **The section draws a stair that descends into the water.** It used to build
  from the shallow-end wall outward and upward, drawing the mirror image: the toe
  against the wall and the top tread furthest into the pool, so you would have
  climbed out of the water to reach the deck. And a bench was drawn from its top
  surface down to the seat's own stated floor depth while being positioned at the
  deep-end wall — two facts that disagree the moment they differ, which on the
  standard model left the bench hanging 1'-6" clear of the floor. A seat now
  rests on the floor the profile puts under it, and where the seat's stated depth
  disagrees the label says both rather than one quietly winning.
- **The plan prints at a real architectural scale.** `choosePrintScale` picks
  the largest standard scale (1" down to 1/16") that fits the drawing's actual
  extents on 11x17, and the title block states it. A job too big for any standard
  scale reports `fits: false` rather than shrinking to something unmeasurable.
- **The plan draws the code verdict, not just the dimension.** A setback that
  violates the 1:1 rule is drawn in the failure colour and labelled with the
  depth it would need. A plan that draws a violation as an ordinary dimension is
  how it gets built that way.
- **A job file is refused, not repaired.** `parseJob` validates nested steps,
  seats, spa geometry, hydraulic runs, and gas loads before returning, and
  reports every problem at once. A file with no version, a newer format, a
  different jurisdiction or a single suction outlet does not load. Infinity on
  the bottom soil layer survives the round trip; the pump is stored by id and
  re-resolved, so manufacturer data is never frozen into a saved job.
- **Waste is never folded into net.** `withWaste` emits net, waste and ordered
  as three separate Calc lines, and the tests assert ordered = net + waste.
- **The 1:1 foundation setback is a hard fail**, reports the maximum compliant
  depth, and names the sealed engineered drawing as the only path. It is not a
  checkbox that clears.
- **Every amendment check runs on every job** and reports pass / fail / flag
  with its governing limit and the job's actual value.

## Editing a job

The left panel edits the job live — every field is a path into the `Job` type,
so a field that does not correspond to a real engine input cannot exist here.
Edits recompute the sheet and redraw the plan immediately. Bad input stops the
takeoff with the engine's own message and produces no quantities.

`Save JSON` downloads the job; `Load JSON` reads one back; `Reset` returns to
the selected scenario.

## Printing

`Ctrl/Cmd-P` on the sheet. Two page sizes in one job, via CSS named pages:

- Plan sheet — ANSI B (17x11) landscape, 0.5 in margin, drawing at 1/8" = 1'-0"
  for the standard model, with a title block naming the scale and code basis.
- Takeoff — letter portrait, 0.6 in margin, repeating table headers, and no
  calc row, check or run split across a page break.

Named pages need Chrome 110+. Elsewhere both sheets fall back to the first
`@page` size; the plan still prints and the stated scale makes the mismatch
visible rather than silent.

## Verified against a hand calc (standard model)

| | |
|---|---|
| Section area | 137.50 sf |
| Water volume | 2,110.5 cf = 15,787.6 gal |
| Wetted area | 1,014.16 sf |
| Total cut, pool + attached spa | 3,892.5 cf = 144.17 BCY |
| Loose, at Lubbock's 25% swell | 180.21 LCY |
| Haul | 112.36 LCY = 10 loads |

## Open — data still needed

- **Compaction yield.** Swell is now the builder's own 25% for Lubbock, but the
  0.87 compacted yield sitting beside it is still assumed and says so on the
  sheet. It only moves the backfill balance, not the haul.
- **The existing gas appliances on the shared run.** The furnace, water heater
  and range figures are still invented and labelled PLACEHOLDER. They are what
  decides whether 1 1/4 in holds: a dedicated 250k heater run is fine on it, the
  shared run as currently entered is not.
- **Equipment head losses** (filter, heater, valves) in `standardModel.ts` are
  placeholders labeled PLACEHOLDER on the sheet; read them off each product's
  head loss curve.
- **A curve for the 400/600/800 series pumps.** Their owner's manual carries
  none, so those models list as unevaluable. The VS 900/950 curves came from the
  sell sheet.

## The standard detail

`APEX_STANDARD_DETAIL` is live. Supplied by the builder: 6 in shell, 3/8 in (#3)
bar, 12 in bond beam, and the envelope — depth 3–8 ft, plan up to 45 x 20 ft,
loam over caliche. The rest was filled in on instruction and is listed in
`assumedFields`, printed on every sheet so the two never look alike.

Still open to redline: bond beam reinforcement is 4 x #4, stress-point spacing
8 in over a 2 ft zone, and no pier schedule.

## Open — blocks quantity-authority approval

The engine is safer but is not yet the approved quantity authority. It still
needs a line-by-line reconciliation against controlled real jobs, an approved
attached-spa reinforcement/detail interpretation, measured compaction yield,
and replacement of every equipment-loss and existing-appliance placeholder.
