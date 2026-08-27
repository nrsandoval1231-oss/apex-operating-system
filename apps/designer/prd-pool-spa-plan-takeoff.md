# PRD: Pool & Spa Plan + Materials Takeoff Tool

**Status:** draft v4 — awaiting sign-off
**Jurisdiction:** City of Lubbock, Texas
**Date:** 2026-07-27
**Changes in v2:** engineering assumptions verified against ISPSC, ANSI/PHTA standards, and NFPA 54. Several v1 defaults were wrong. The structure module changed from "design" to "takeoff from a given design."
**Changes in v4:** confirmed no PE stamp is required for residential pools in Lubbock. Structure module input changes from per-job engineer's drawing to a stored standard detail. The out-of-envelope flag changes from a legal gate to a judgment gate Nick owns. One PE requirement survives: the 307.2.2.2 setback exception.
**Changes in v3:** retargeted from DFW to Lubbock. Lubbock's adopted code and local amendments were pulled and read. Several amendments add hard geometry rules that v2 had no concept of — most significantly a pool-depth-to-foundation setback ratio, amended step and bench dimensions, and a powered safety cover that can substitute for the pool barrier. Soil defaults changed from Blackland clay to Llano Estacado caliche profile. See *Lubbock jurisdiction rules*.

## Problem
Pool and spa layout, structural takeoff, hydraulic sizing, and materials counts are currently done by hand or in one-off spreadsheets, job by job. The math is repetitive but unforgiving — an undersized suction line or a miscounted rebar order costs real money and real days. There's no single artifact that shows both the answer and the inputs that produced it, so nothing is checkable after the fact.

## Goal
Enter pool and spa dimensions plus the engineer's structural spec, and get a dimensioned plan sheet and a materials takeoff where every number shows the formula and inputs behind it.

## Success criteria
- Entering the standard model (15×30 pool, 6×6×3.5 spa, 3.5–6 ft depth) produces a printable plan sheet + takeoff in under a minute of input
- Every quantity on the takeoff displays its formula and inputs inline — no bare numbers anywhere
- Excavation volume (all three states), gunite volume, rebar bar/tie count, tile LF, coping piece count, and plaster SF each land within 3% of a hand check on one completed job
- Hydraulics converge to a stated operating point (system curve × pump curve) and report velocity in every segment, not just a pass/fail
- Every Lubbock amendment check (foundation setback, tread, riser, bench, swimout) runs on every job and reports pass, fail, or the governing limit — never silently
- A job outside the stored standard detail's declared envelope returns a clear out-of-envelope stop and produces no structural quantities
- Plan sheet prints to PDF with correct scale and readable dimensions at 11×17

## Non-goals
- No pricing, labor hours, or estimating — quantities only
- No freeform or curved shapes, no 3D, no rendering or client-facing presentation views
- Not a permit submittal set and not a stamped engineering document
- **Not a structural design tool.** It does not size rebar, shell thickness, or piers. It reads them from a standard detail you supply and counts material. No stamp is required in Lubbock for residential, which makes this a discipline the tool enforces rather than a rule it inherits.
- No scheduling, no crew assignment, no purchase orders
- No site survey / existing-conditions import (no topo, no CAD import)

## Lubbock jurisdiction rules

Lubbock adopted the **2021 ISPSC** under Ordinance 2024-O0033 (3/26/2024), with local amendments in Code of Ordinances Article 28.18. The amendments are not cosmetic — several are hard geometry constraints the tool has to enforce, and a generic pool calculator would miss all of them. These are encoded as checks, not suggestions.

**Foundation setback — new local section 307.2.2.2.** Pool and spa depth must maintain a 1:1 ratio to the nearest building foundation or retaining wall footing. A 6 ft deep pool sits no closer than 6 ft. The only way out is a sealed engineered design drawing submitted for approval.

This is the single biggest addition in v3. It means **distance to nearest foundation is a required geometry input**, and depth is not freely choosable — the two are coupled. On a tight Lubbock lot this constraint will drive the design more often than anything else in the tool. The geometry module checks it on every run and reports the maximum allowable depth for the entered setback alongside the entered depth.

**Steps — amended 411.2.1 and 411.2.2.** Treads: minimum 12" horizontal run, minimum 20" width. Risers: maximum uniform 10", bottom riser may taper to zero. These differ from the base ISPSC values, so the step geometry has to be validated against the Lubbock numbers specifically.

**Benches and underwater seats — amended 411.5.2.** Horizontal surface no more than 20" below the waterline and at or below the waterline. Unobstructed surface minimum 10" deep × 24" wide. Cannot serve as the required entry and exit. Leading edge needs a 1" minimum contrasting, slip-resistant stripe. A tanning ledge used as required entry/exit sits no more than 12" below the waterline.

v2 treated benches purely as volume geometry. They are dimensionally regulated here, and the stripe is a finishes quantity (linear feet of contrasting tile or paint) that v2 never counted.

**Swimouts — amended 411.5.1.** Horizontal surface no more than 20" below waterline, unobstructed surface at least equal to the top tread requirement, stair compliance if used for entry/exit, same 1" leading-edge stripe.

**Safety cover can replace the barrier — amended 305.1 and 305.4.** For one- and two-family dwellings, a powered safety cover listed to ASTM F1346 exempts the pool from barrier Sections 305.2 through 305.7, and a listed safety cover also satisfies the structure-wall-as-barrier requirement.

This changes what the cover module is for. The Coverstar selection is not an accessory line item — it can be the code compliance path for the entire barrier. The tool flags which compliance path the job is using and, when the cover is the barrier, notes that the ASTM F1346 listing is load-bearing on that decision.

**Entrapment — amended 310.1.** Lubbock points directly at APSP 7 / ANSI/PHTA/ICC 7 for residential. Confirms the v2 correction. Public pools route to 25 TAC Chapter 265 Subchapter L instead.

**Diving envelopes — amended 804.1.** Table 804.1 and Figure 804.1, or the manufacturer's specification, whichever is greater. Negative construction tolerances are explicitly not allowed. Base Table 402.12 and Figure 402.12 were deleted outright and replaced with the TDSHS table. Diving is out of scope for v1, but if a board ever gets added the tool must use the greater-of rule and refuse to shave dimensions.

**Residential is outside the state public-pool rules.** Amended 102.9 confirms TDSHS Standards for Public Pools and Spas and the Texas Accessibility Standards do not apply to pools serving one- and two-family dwellings or townhouses. That keeps the tool's residential path clean.

**PE stamp — resolved.** No stamped engineered plans are required for residential pools in Lubbock. The stamped-plans language in the health-code article applies to public and semipublic pools, not one- and two-family dwellings.

**One exception survives.** Amended 307.2.2.2 requires a sealed engineered design drawing to go closer to a foundation than the 1:1 depth ratio. That is the only place in a residential job where a PE seal is mandatory, and it is triggered by geometry, not by the permit. The tool names it explicitly when the setback check fails, because it is the single actionable path around that rule.

**What this changes about the structure module.** v2 and v3 assumed an engineer's drawing always existed to take off from. It doesn't. But the answer is not to have the tool design the shell — caliche depth and profile vary lot to lot across Lubbock, and sizing rebar from first principles against an unknown subsurface is exactly the thing a takeoff tool should refuse to do. Instead:

- The structure module reads from a **stored standard detail** — shell thickness, bar size and spacing, bond beam section, dam wall, cove and stress-point spacing, gunite strength — entered once and versioned with a date.
- Each detail carries a **declared envelope**: the depth range, plan dimensions, and soil conditions it was built for.
- A job outside that envelope raises a flag and produces no structural quantities.

The flag's meaning changes. It is no longer "the code requires an engineer." It is "this job is outside what your standard detail covers, and you decide what to do about it." That is Nick's judgment call — bring in an engineer, extend the detail, or walk the job back inside the envelope. The tool states the condition and stops; it does not extrapolate.

Multiple details can be stored (for example, one per depth band) and the tool selects by envelope match rather than asking.

**Soil — Llano Estacado, not Blackland.** Lubbock sits on a layered profile of caliche, sandy loam, and clay-loam subsoils (Pullman and similar), under roughly 19 inches of annual rainfall. Practical differences from the DFW assumptions v2 carried:
- **Caliche complicates excavation** and behaves closer to rock than soil when ripped. Swell factor is higher and less predictable than clay, and the layer depth varies across the city. A single flat swell number is not defensible here.
- **Caliche gives excellent bearing once reached**, which is why it changes the pier picture relative to DFW.
- **Shrink-swell is moderated by the dry climate** compared to Blackland clay, but it is present and drought cycles plus irrigation drive movement.
- **Collapsible, hydro-compactive soils are the West Texas failure mode.** These settle abruptly when first wetted — by irrigation, drainage changes, or a leak. A pool is a large permanent water source next to a house, so this is the relevant risk, and it is a settlement problem rather than the heave problem DFW has.

Consequence for the tool: excavation takes a **layered profile input** (depth to caliche, thickness, material above and below) with a separate swell factor per layer, rather than one soil type and one number. Everything structural still comes from the engineer.

## Verified engineering basis

Everything below was checked before build. Sources and revision dates render on the printed sheet.

**Governing documents**
- **2021 ISPSC as adopted and amended by City of Lubbock**, Ordinance 2024-O0033, Code of Ordinances Article 28.18 — the governing code for this tool. Not the 2024 edition. Local amendments override the base text where they conflict.
- ANSI/PHTA/ICC-7 2020 — suction entrapment avoidance (this superseded the old "ANSI/APSP-7" name; v1 of this PRD cited the obsolete designation)
- ANSI/APSP-16 2017 — suction outlet fitting assemblies (SOFA), i.e. drain covers
- ANSI/PHTA/ICC-15 — residential energy efficiency, governs filtration piping velocity
- PHTA-5 2024 — residential inground pools, filtration flow rate bounds
- NFPA 54 / IFGC — natural gas piping. NFPA 58 for propane. CSST has its own tables.
- ACI 506 — shotcrete/gunite placement

**Flow rate is the root input and v1 omitted it.** Every hydraulic number depends on design flow, which comes from volume and turnover:
- Max filtration flow = pool volume ÷ 360 min (6-hour turnover)
- Min filtration flow = pool volume ÷ 720 min (12-hour turnover, per PHTA-5 2024)
- Absolute floor of 36 gpm regardless of what the turnover math says
- Federal energy provisions prohibit turnover faster than 6 hours for residential

**Velocity limits — v1 had these wrong.** They are not one number:
- ISPSC 311.3 residential: 8 fps in *both* suction and return. This is the code pass/fail.
- ISPSC 311.3 public: 6 fps suction, 8 fps return.
- ANSI/PHTA/ICC-15 residential energy standard: 6 fps suction, 8 fps discharge — applies to **filtration piping only**.
- GENESIS design guidance: 5 fps both sides.
- **Governing entrapment rule:** ANSI/PHTA/ICC-7 limits branch suction piping to 6 fps *when one of a pair is blocked*. With both drains open that means roughly 3 fps per branch in normal operation. This is stricter than anything above and is the number that actually sizes main drain branch lines.

Tool behavior: 8 fps residential is the hard fail. 6 fps is the design target and triggers a visible flag, not a failure. Branch suction is sized on the single-blocked condition. All three thresholds are labeled on the output so nobody confuses the energy standard with the code.

**Suction outlet cover rating is a lookup, not a calculation.** ANSI/PHTA/ICC-7 and ANSI/APSP-16 require the installed cover's certified flow rating to exceed maximum system flow. The tool reports required rating and makes the installer confirm the actual cover; it does not select one.

**Hydraulics are iterative, not a single pass.** Flow → pipe size → TDH → pump selection → actual flow read off the pump curve → re-check velocity. v1's build order treated this as linear and it isn't. The engine has to converge and then report the plotted operating point where the system curve meets the pump curve, which is how ANSI/PHTA/ICC-7 §4.4.5.1 defines maximum system flow rate.

**The structure module does not design anything.** This held for DFW's expansive clay and it holds for Lubbock's layered caliche profile for a different reason: shell thickness, reinforcement, and pier depth all follow from a geotechnical picture that varies lot to lot across the city, and caliche depth is the variable that matters most. The module ingests shell thickness, bar size, spacing, bond beam section, dam wall, and pier schedule from a stored standard detail (or an engineer's drawing where one exists) and converts them to quantities. It designs nothing. This is smaller, safer, and more useful than what v1 described.

**Rebar and shell defaults were light.** Reference values for the standard model, all of them overridable and all subordinate to the engineer's spec:
- 3" minimum concrete cover between steel and earth (a 6" shell with centered steel sits right at the limit; 8" is common where clay is active)
- #4 at 12" o.c. each way and #3 at 12" o.c. are both in common use; which one applies is the engineer's call, not the tool's, and Lubbock's moderated shrink-swell does not by itself justify the lighter option
- Bond beam roughly 12" wide × 12–14" deep with 4 × #4 continuous
- Tighter spacing (6–8") at coves, breakover, and stress points
- Gunite 4,000 psi typical; overspray/rebound allowance applied separately from net volume

**Excavation needs three volume states, not one.** v1 conflated them:
- Bank (BCY) — in place, what you dig
- Loose (LCY) — what rides in the truck, bank × swell
- Compacted (CCY) — what backfill actually yields
Swell references: sand 10–15%, common earth 20–30%, clay 20–40%, ripped rock 40–65%. Caliche falls between clay and rock and is not well characterized by a single published figure — see open question 2.

**Lubbock needs a layered input, not one soil type.** The profile is typically sandy loam or clay loam over caliche at a depth that varies by site. The engine takes a layer table (depth, thickness, material, swell factor per layer), computes cut volume per layer, and swells each independently. Haul truck default 12 CY, editable, always rounds up. Backfill balance uses compacted; haul count uses loose.

**Gas sizing is a whole-house problem.** The heater is never sized alone:
- CFH = BTU/hr ÷ 1,000 for natural gas; ÷ 2,500 for propane
- Total connected load on the shared run governs pipe size, not the heater's rating
- Meter capacity governs the whole system and the tool cannot know it
- NFPA 54 low-pressure tables (typically 0.5" w.c. drop) for NG; NFPA 58 for LP; CSST separate
- Fitting equivalent lengths must be added to measured run length
Tool behavior: outputs BTU/hr demand and a reference size for a dedicated run, requires total connected load and meter capacity as explicit inputs, and labels the result as a demand calculation for a licensed gas contractor to verify.

**Automatic cover couples backward into geometry, structure, and code compliance.** Coverstar construction specs drop the bond beam roughly 2" at the mechanism end, require the track layout to be rectangular, and set vault dimensions by cover size from published spec sheets — none of it derivable. Anything nonstandard needs distributor drawing approval before the shell is built. So the cover is an **input that constrains the shell**, not a downstream selection as v1 had it. In Lubbock it carries additional weight: an ASTM F1346 powered safety cover can serve as the barrier compliance path under amended 305.1.

**Deck slope is a band with a maximum.** ISPSC 306.5: minimum per Table 306.5, maximum 1/2" per foot for non-wood surfaces. Alternative compliance path is the performance test — no standing water deeper than 1/8" twenty minutes after water stops. The module checks the band and reports which path is being used.

**Hydrostatic relief valve** belongs in the plumbing module and was missing from v1. It matters in clay with perched groundwater.

**Product catalog data goes stale fast.** Hayward renumbered models recently (e.g. SP3210X15XE → VSP32815) and the automation line is now three products — OmniLogic, OmniPL, OmniHub. Catalog tables carry a source and revision date printed on every sheet.

## Scope (v1)

**Pilot / narrowest slice:** The calc engine for geometry → excavation only, headless, run against the standard model and validated line by line against a hand calc from one completed job. Three volume states reported separately. No UI, no PDF, no structure. If excavation doesn't reconcile, nothing downstream is worth building.

**Pieces / sub-flows:**

1. **Geometry & volume** — pool and spa rectangles, depth profile, steps and benches as prisms, spa dam wall. Wetted surface area, water volume in gallons, perimeter. Volume feeds every hydraulic calc downstream. Enforces the Lubbock amendments: 1:1 depth-to-foundation setback, 12"×20" minimum tread, 10" maximum riser, bench and swimout depth-below-waterline limits and minimum unobstructed dimensions.
2. **Excavation** — over-dig allowance on the outside face, layered soil profile (depth to caliche and thickness), cut volume in BCY per layer, swell to LCY per layer, haul truck count, backfill in CCY, spoil balance.
3. **Structure (takeoff only)** — reads shell thickness, bar size, spacing, bond beam section, dam wall, and pier schedule from a stored, versioned standard detail with a declared envelope. Outputs gunite volume with rebound allowance, bar count by length with stock-length cut optimization, tie count, pier concrete volume. Designs nothing; refuses outside the detail's envelope.
4. **Hydraulics** — design flow from volume and turnover, main drains (dual, single-blocked branch sizing), skimmers, returns, spa jets, hydrostatic relief valve. Iterative convergence to an operating point. Velocity reported per segment against all three thresholds. TDH via equivalent-length method.
5. **Equipment** — Hayward package matched to the converged operating point, actuator and valve count, heater gas demand, equipment pad layout with clearances.
6. **Cover** — Coverstar model and vault dimensions entered from the manufacturer spec sheet; constrains bond beam and track geometry upstream. Records whether the cover is serving as the ASTM F1346 barrier compliance path.
7. **Finishes** — tile LF, coping piece count, plaster SF, waterline band LF, and leading-edge contrast stripe LF on steps, benches, and swimouts, each with waste shown separately from net.
8. **Yard & drainage** — deck SF, slope band check, deck drain run footage, grade transitions.
9. **Output** — plan set PDF: dimensioned 2D top-down view plus materials takeoff sheet.

**Infra:** React + Vite. Calc engine as pure TypeScript modules with no UI imports, unit-tested independently. Plan view drawn as SVG. PDF via browser print with a `@page` stylesheet — no PDF library in v1. Fully client-side, no backend, no database; job inputs save/load as a JSON file. Built in Claude Code. Runs locally; deploy to Hostinger later if it needs to be shared.

## Out of scope (v1)
- Freeform / radius / vanishing-edge geometry
- 3D view or perspective rendering
- Multi-body-of-water systems on separate hydraulics
- Solar heat, in-floor cleaning, deck jets, laminars
- Auto-generated section and detail drawings — plan view only
- Server-side PDF generation
- Pricing layer (separate tool that consumes this one's output)
- Pier design, soil bearing analysis, uplift/buoyancy checks — engineer's scope, permanently

## Standing constraints
- Before anything hard to undo (delete, overwrite, mass change, push to shared remote): show the plan, flag what can't be undone, wait for explicit go-ahead
- Default to Claude Code for the actual build once this PRD is signed off
- No fully unattended end-to-end runs — no output leaves the tool as a construction document without a human reviewing it

## Project-specific constraints

**Safety-critical paths — own tests, cannot be silently overridden:**
- Dual suction outlets only, minimum 3 ft separation or on two different surfaces. Branch piping sized on the single-blocked condition at 6 fps. The tool never emits a single-suction-outlet configuration.
- 8 fps residential velocity is a hard fail. 6 fps raises a visible design flag. Both are labeled with their source standard.
- Required SOFA cover flow rating is reported and must be confirmed against the actual installed cover.
- Gas output is a demand calculation, not a design. Requires total connected load and meter capacity as inputs; labeled for licensed verification.
- Structural quantities are produced only from a stored standard detail with a declared envelope. No detail, or a job outside its envelope, means no numbers. The absence of a stamp requirement does not license the tool to extrapolate.
- Anything outside the default envelope returns "requires engineer review" and no quantities.
- The 1:1 depth-to-foundation setback is a hard fail. The tool reports the violation and the maximum compliant depth, and names the sealed engineered drawing as the only compliance path. It is never a checkbox that clears the flag.

**Other:**
- Manufacturer data (Hayward, Coverstar) is a hardcoded table with source and revision date printed on every sheet
- The code edition and ordinance number (2021 ISPSC, Lubbock Ord. 2024-O0033) print on every sheet. If Lubbock adopts a newer edition the amendment checks must be re-verified, not assumed forward.
- The tool is scoped to Lubbock. It is not a multi-jurisdiction product and must not be used on a job outside the city without re-checking the local amendments.
- Every calculation renders as: formula → inputs with units → result. Never the result alone.
- All quantities carry units. Volume states always labeled BCY / LCY / CCY.
- Waste factors shown as a separate line from net quantity, never baked in silently

**Visual style:**
- Paper background `#F7F6F2`, accents `#0081AF` and `#00ABE7`
- Near-square corners (2px max radius), hairline rules (1px, low contrast)
- Dense technical layout — tight leading, small type, high information density
- Monospace for every number, dimension, and unit; sans for labels and prose
- One bold moment per sheet (the plan drawing itself); everything else calm

## Plan / build order
1. **Geometry + volume engine, with the Lubbock amendment checks built in from the start.** Headless, unit-tested. Water volume in gallons and wetted area are the inputs to everything downstream, so they get proven first. The setback and step/bench checks are written as tests before the geometry math, because they constrain what geometry is even legal.
2. **Excavation engine.** Layered profile, BCY / LCY / CCY per layer, truck count. *Checkpoint: reconcile against a hand calc from a real Lubbock job, including whatever caliche was actually hit, before continuing.*
3. **Takeoff sheet on screen.** HTML table rendering steps 1–2 with formulas and inputs visible. Proves the "show the work" pattern before it has to survive a print stylesheet.
4. **Structure takeoff.** Standard detail editor with envelope declaration and version date, then quantity math, then the envelope match check. Low risk because nothing is being designed.
5. **Hydraulics engine.** Safety rules as tests first, then the convergence loop. Validate the operating point against a known pump curve and a job with a measured result.
6. **Equipment selection + gas demand + pad layout.**
7. **Cover module.** Wired back into geometry and bond beam constraints.
8. **Finishes + yard/drainage.** Lowest risk, straight area and perimeter math.
9. **SVG plan view.** Geometry, then dimension lines and leaders, then plumbing runs and pad.
10. **Print stylesheet → PDF.** 11×17 landscape plan, letter portrait takeoff.
11. **Input form + JSON save/load.** Last, deliberately — the engine defines what inputs exist.

## Open questions

Defaults set so the build isn't blocked. Redline any of these:

1. **Over-dig allowance** — 12" horizontal beyond the exterior gunite face, floor over-dig equal to shell thickness. Editable.
2. **Caliche swell factor.** This is the one I can't default honestly. Published tables cover clay and blasted rock but not ripped caliche, and Lubbock caliche varies in hardness and depth across the city. What swell have you actually seen on your hauls, and roughly what depth does caliche show up at on your typical job? Two or three real numbers from past jobs beats any published figure here.
3. **Turnover basis** — defaulting to 8-hour turnover as the design target, bounded by the 6-hour max and 12-hour min, floored at 36 gpm. Confirm what you design to.
4. **Waste factors** — tile 10%, coping 5%, plaster 5%.
5. **Velocity target** — 6 fps design flag, 8 fps hard fail. If you'd rather design to the GENESIS 5 fps recommendation, say so and I'll move the flag.
6. **The standard detail itself.** Resolved that no stamp is needed, which means the structure module needs your detail as its input. Send me the shell thickness, bar size and spacing, bond beam section, dam wall, and cove/stress-point spacing you actually build to, plus the depth and plan-size range you consider it good for. That last part is the envelope, and without it the module has nothing to check against.
7. **Does the standard model actually clear the setback rule on your typical lot?** A 6 ft deep pool needs 6 ft of clearance to the house foundation. If most of your jobs are tighter than that, the depth profile in the standard model may need to change, or the sealed-drawing exception is routine for you rather than exceptional — which would be worth knowing before the geometry module treats it as a hard fail.

## Note on prior art
Structure Studios (Pool Studio / VIP3D), RhinoPool, and Pool Draw all exist and all do 3D presentation design well. None of them are transparent calculators — they produce a picture and a bill of materials, not a formula with its inputs showing, and their hydraulic and structural math is either absent or buried. That gap is what justifies a custom build. If the actual goal turns out to be client-facing presentation drawings, buy Pool Studio instead; this tool is deliberately the opposite thing.
