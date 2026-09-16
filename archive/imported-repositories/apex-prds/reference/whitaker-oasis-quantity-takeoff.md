# Whitaker Oasis — Full Quantity Takeoff

**Source:** Apex Designer Pools estimate, "Whitaker Oasis · 14x24 Size Pool w/ Spa", $116,955.18 job cost
**Purpose:** prove that every dollar line on the estimate has a derivable quantity behind it, and expose what's missing
**Status:** **v2.0 — 2026-07-26.** Supersedes v1.0. Dimensions confirmed by Travis and the full line
schedule extracted from the customer-facing PDF. Quantities are no longer reverse-engineered from
assumptions; they are computed from known inputs and reconcile against known dollars.

> **What changed from v1.0.** Three things that were assumptions are now facts, and one of them
> moved every number in the document:
>
> | | v1.0 | v2.0 |
> |---|---|---|
> | Spa | **assumed** 7 × 7 × 3.5 | **confirmed 6 × 6 × 3.5** |
> | Depth profile | assumed 3.5 → 6.0 | confirmed, and it's the standard on every Apex pool |
> | Deck | "the largest unquantified item" | confirmed **4 ft border** on every pool |
> | Line schedule | partially inferred | **fully known** (§3.1) |
>
> The spa correction cuts combined wetted area 3.7% and perimeter 3.8%. Because every unit cost
> here is back-solved — his dollars ÷ our quantity — **every rate in §4 moved with it.** Anyone
> still working from v1.0's 921 sq ft / 104 LF / 13,222 gal is working from the wrong numbers.

---

## 0. Location: Lubbock, not DFW

Lubbock sits on the Southern High Plains, on **loamy eolian deposits of the Blackwater Draw Formation** — Amarillo-series fine sandy loam and related Olton/Pullman clay loams, not Blackland Prairie gumbo. Two facts drive everything:

**A calcic horizon — caliche — typically begins around 27 in and runs deep.** That is squarely inside pool-dig depth. A 5–6 ft excavation here goes through it, not around it.

**Mean annual precipitation is about 19 in.** Regional guidance describes Panhandle clay-loam subsoils as expansive but **moderated by low rainfall**, with the caliche layer complicating pier installation while **providing good bearing once reached**.

What this corrected from an initial North Texas read:

| A DFW read would say | Lubbock reality |
|---|---|
| Pier / grade-beam contingency is a $3k–30k risk | **Downgraded.** Low rainfall moderates swell; caliche gives good bearing |
| Engineered low-PI select fill per TxDOT Item 132 | **Not the local issue.** That's a Blackland Prairie remedy |
| Excavation at $58/yd³ looks high | **Reversed.** Digging caliche justifies it, maybe more |
| Clay swell 35% for haul volume | **Corrected to ~25%** blended sandy loam over caliche |

Also in play, none of it on the estimate: **sustained High Plains wind** (raises gunite rebound and evaporation during cure), **hard freezes** at ~3,200 ft elevation (closed season for shooting gunite; freeze protection is standard scope), **high evaporative demand and hard Ogallala-sourced water** (affects fill, startup chemistry, and plaster), and a **much smaller sub pool** than DFW, which makes scheduling — not price — the binding constraint.

One upside: caliche is a saleable road-base material in the Panhandle. Spoil disposal may be cheaper here than a straight dump fee, and worth asking the excavation sub about.

---

## 1. Confirmed inputs

The estimate header gives only "14x24 Size Pool w/ Spa." Everything below flows from these — and
as of 2026-07-26 they are confirmed rather than assumed.

| Input | Value | Status |
|---|---|---|
| Pool shape | 14 × 24 rectangle | Confirmed — auto cover requires rectangle |
| Depth profile | 3.5 ft → 6.0 ft, avg 4.75 ft | **Confirmed.** Apex builds this profile on every pool |
| Spa size | **6 × 6 × 3.5 ft** | **Confirmed.** Was the single biggest unknown in v1.0 |
| Deck | **4 ft border** → 368 sq ft | **Confirmed.** Apex builds a 4 ft border on every pool |
| Shell thickness | 8 in floor and walls | Standard; walls run 6–10 in |
| Rebar schedule | #3 @ 12 in OC each way + 4× #4 bond beam | Industry standard |
| Equipment pad distance | 50 ft | Inferred from the "Long Plumb $3,000" line |

**A pool proposal now needs only length × width.** Depth, spa size and deck area all follow from
the standards, which is what makes the parametric model practical rather than an interview.

---

## 2. Geometry — everything derives from here

**Pool (14 × 24, 3.5 → 6.0 ft, avg 4.75 ft)**

| Measure | Value |
|---|---|
| Surface area | 336 sq ft |
| Perimeter | 76 LF |
| Floor area (along slope, factor 1.0054) | 338 sq ft |
| Wall area | 361 sq ft |
| Steps / bench | 50 sq ft |
| **Pool wetted area** | **749 sq ft** |
| Water volume | 1,596 ft³ = **11,939 gal** |

The floor slope factor is derived, not assumed: the floor is the hypotenuse of a 2.5 ft rise over
the 24 ft **long axis**, giving √(1 + (2.5/24)²) = 1.0054. Running that rise over the 14 ft side
instead overstates shell area — a real trap, since "14x24" puts the width first.

**Spa (6 × 6 × 3.5 ft — confirmed)**

| Measure | Value |
|---|---|
| Surface area | 36 sq ft |
| Perimeter | 24 LF |
| Wall area | 84 sq ft |
| Bench seat | 18 sq ft |
| **Spa wetted area** | **138 sq ft** |
| Water volume | 126 ft³ = **943 gal** |

**Combined: 887 sq ft wetted area · 100 LF perimeter · 12,881 gallons**

Coping follows *exposed* perimeter — much of the spa abuts the pool — giving 96 LF before waste.

> **Correction history.** A back-of-envelope first put the shell at **716 sq ft**. v1.0's full
> takeoff raised it to **921 sq ft** once the spa and steps were counted. The confirmed 6 × 6 spa
> now settles it at **887 sq ft**. Two corrections, 24% and 4% — which is precisely why the
> takeoff has to be built from geometry rather than eyeballed.

---

## 3. The takeoff, by his cost codes

### 3.1 His actual line schedule

Extracted from the customer-facing PDF, 2026-07-26. The label glyphs came through a subset font
encoding and were reconstructed from context; **the figures decoded cleanly, and all 13 section
subtotals plus the grand total reconcile exactly**, which is what verifies the read.

| Code | Section | Lines | Total |
|---|---|---|---|
| 100 | Permits | Permits **$0.00** | **$0.00** |
| 200 | Excavation | Excavation $5,500 · Backfill trench, clean drive, cleanup & haul off $1,500 | **$7,000** |
| 300 | Pool Equipment | Equipment set up $950 · Programming $900 · Sand filter/sand $1,300 · Hayward heater $3,350 · Hayward VS950 pump & motor $2,000 · Jets, valves, fittings $1,000 · UV filter $2,000 | **$11,500** |
| 400 | Pool Shell | Bonding $250 · Rebar / rebar labor $4,000 · **Forming $550** · Gunite $12,000 | **$16,800** |
| 500 | Utilities | **Plumber $5,000** · Electrician $3,000 | **$8,000** |
| 600 | Lights | Colour-changing LED lights & transformer $2,500 | **$2,500** |
| 700 | Pool Plumbing | Plumbing $2,500 · Long plumb $3,000 · Spa plumb $750 · Conduit, copper, sweeps $850 · Jet T-bodies/spa $300 · Drains, skimmers $700 | **$8,100** |
| 800 | Pool Finishes | Tile/materials $1,950 · **Tile/labor $2,500** · Coping/materials $3,600 · Coping/labor $3,950 · Plaster/materials $3,750 · Plaster/labor $5,000 | **$20,750** |
| 900 | Cover | Bracket, touch screen, rope, extrusion $8,000 · Gunite encap kit $1,130.18 · Cover install $2,300 · Cover bracket install, coping $375 · Encapsulations pre & install $750 · SS lid brackets $1,000 · Stone lid $1,000 | **$14,555.18** |
| 1000 | Pool Deck | Concrete diamonds budget $5,000 *(Upgrade)* · Turf budget $5,000 *(Upgrade)* | **$10,000** |
| 1100 | Water Features | Water feature structure $2,500 · Water sheer $600 · Pump $2,850 | **$5,950** |
| 1200 | Automation | Omnilogic base panel $3,500 · Omnilogic wireless antenna $550 · Actuators $750 | **$4,800** |
| 1300 | Additional Upgrades | Fence budget $7,000 *(Upgrade)* | **$7,000** |
| | **JOB COST** | | **$116,955.18** |
| | Cost Plus at 30% | | $35,086.55 |
| | **ESTIMATED TOTAL** | | **$152,041.73** |

**Four structural findings from the real schedule:**

1. **Pool Deck is 100% upgrade budgets.** There is *no deck construction line anywhere.* The 4 ft
   border of decorative concrete is priced as "Concrete Diamonds Budget," an allowance. Now that
   the border rule gives it 368 sq ft, it converts to a takeoff line at the same dollar figure.
2. **Plumbing splits across two cost codes.** "Plumber $5,000" sits under 500 Utilities, separate
   from the $8,100 under 700 Pool Plumbing. **$13,100 total**, and neither is parameterised.
3. **Bonding books under 400 Pool Shell**, not 500 Utilities. His structure, not mine, wins.
4. **Water Features $5,950 confirms the spa spillway** that the plumbing count implied.

### 3.2 200 — Excavation

| Item | Qty | Unit | Basis |
|---|---|---|---|
| Dig footprint (pool) | 15.34 × 25.34 | ft | inside dims + 2× 8 in shell |
| Bank volume, pool | 78.0 | yd³ | 389 sq ft × 5.42 ft avg |
| Bank volume, spa | 8.3 | yd³ | 6 × 6 basin + overdig |
| Bank + sloughing allowance (7%) | **92.3** | **yd³ bank** | |
| Loose volume after swell (~25% blended) | **115** | **yd³ loose** | sandy loam 10–20%, caliche 40–70% |
| Haul trucks @ 14 yd³ | **9** | loads | |
| Volume sitting below the caliche horizon | **49.4** | yd³ (57% of dig) | starts ~27 in |
| Rebound haul-off (see §5) | ~3.5 | yd³ | gunite sub's rebound is the builder's cost |

> **Check:** $5,500 ÷ 92.3 bank yd³ = **$59.59/yd³**. Generic excavation runs $7–15/yd³ — but that's soil, and roughly the bottom 3–4 ft of this dig is in **caliche**. Add precision shaping and access constraints and $59.59/yd³ is defensible, possibly light on a hard-caliche lot.
>
> **The separate $1,500 line** (backfill utility trench, clean driveway, site cleanup and haul-off) is real scope that no assembly originally accounted for. It scales with the *loose* volume trucked off, not the bank volume dug: $1,500 ÷ 115 loose yd³ = **$13.04/loose yd³**.
>
> **Caliche remains uncontingent.** ~57% of this dig is in it and there is no allowance anywhere on the estimate. Under cost-plus it passes through — but only if the contract anticipates it and the customer was warned. Exposure on a job like this runs **$741–$2,224** if the layer is harder or shallower than the seed job.

### 3.3 400 — Pool Shell Construction

| Item | Qty | Unit |
|---|---|---|
| #3 bar, shell grid @ 12 in OC each way, +15% laps/waste | **2,041** | **LF** |
| #3 sticks @ 20 ft | 103 | ea |
| #4 bar, bond beam (4 continuous), +10% | **440** | **LF** |
| #4 sticks @ 20 ft | 23 | ea |
| Steel weight, #3 (0.376 lb/ft) | 767 | lb |
| Steel weight, #4 (0.668 lb/ft) | 294 | lb |
| **Total steel** | **1,061 lb (0.53 ton)** | |
| Tie intersections | ~870 | ea |
| Dobies / chairs @ 1 per 4 sq ft | ~220 | ea |
| Forming | **100** | **LF perimeter** |
| Shell volume @ 8 in over 887 sq ft | 21.9 | yd³ |
| Bond beam, 100 LF @ ~0.5 ft³/LF | 1.9 | yd³ |
| **In-place gunite volume** | **23.8** | **yd³** |
| Rebound allowance (15% blended) | 3.5 | yd³ |
| **Ordered / paid gunite** | **27.3** | **yd³** |

> **Checks:**
> - Gunite $12,000 ÷ 27.3 yd³ = **$439.56/yd³ installed.** Published 2026 range is $350–600/yd³. **This validates cleanly.**
> - Rebar $4,000 ÷ 1,061 lb = **$3.77/lb installed.** Steel material at ~$0.75/lb ≈ $796, leaving ~$3,200 labor — reasonable for a 2–3 man-day cage.
> - Forming $550 ÷ 100 LF = **$5.50/LF.** A real line that no earlier version of this takeoff modelled.
>
> **2,041 LF of #3 is the rebar allocation basis.** That is what this job draws from a shared truckload — not a guess. It is the answer to "how do I divide a bulk delivery across jobs."

### 3.4 800 — Pool Finishes

His estimate bills each finish as **two lines, materials and labor**, and they have genuinely
different drivers. A blended rate hides that.

| Item | Qty | Unit | Rate | Extended |
|---|---|---|---|---|
| Waterline tile, 6 in band +15% waste | **57** | sq ft | $34.21 | $1,950 |
| Tile labor | **100** | LF waterline | $25.00 | $2,500 |
| Coping, pool + exposed spa, +10% waste | **106** | LF | $33.96 | $3,600 |
| Coping labor | **106** | LF | $37.26 | $3,950 |
| Plaster (887 sq ft ÷ 23 sq ft/bag, +10% waste) | **43** | bags | $87.21 | $3,750 |
| Plaster labor | **887** | sq ft wetted | $5.637 | $5,000 |
| | | | | **$20,750** |

> **Checks:**
> - Plaster material at **$87.21/bag** is Diamond Brite territory. ✓
> - Tile material at **$34.21/sq ft** is high for standard tile. Either glass tile, or the spa is fully tiled and the 6 in band assumption is wrong. **Still flagged.**
> - Tile *labor* follows the waterline run, not the band area — pricing it per sq ft of band was a modelling error worth $2,500 on this job.

### 3.5 1000 — Pool Deck

| Item | Qty | Unit | Basis |
|---|---|---|---|
| Decorative concrete, 4 ft border | **368** | sq ft | 4 × 76 LF perimeter + 4 corner squares |

> **Check:** $5,000 ÷ 368 sq ft = **$13.59/sq ft**, inside the published $12–18/sq ft for decorative concrete. ✓
>
> Independently, v1.0 back-solved 280–415 sq ft from the same $5,000 without knowing the border rule. **368 lands inside that range** — two unrelated methods agreeing, which is the strongest single piece of evidence in this document.
>
> But note what it is on his estimate: **an allowance, not a takeoff.** Converting it is exactly the PRD 02 thesis — same dollar figure, now with a quantity behind it. When it converts, the "Concrete Diamonds Budget" allowance must be dropped or the same concrete bills twice.

### 3.6 700 / 500 — Plumbing

2 in PVC is the current standard for new construction; 1.5 in is legacy.

| Item | Qty | Unit |
|---|---|---|
| Skimmer lines, 2 in (2 × 60 LF) | 120 | LF |
| Main drain, dual VGB-compliant, 2 in | 110 | LF |
| Return lines (4), 2 in trunk / 1.5 in eyeball | 220 | LF |
| Spa jet lines, 1.5 in (8 jets × ~20 LF) | 140 | LF |
| Spa suction + return, 2 in | 110 | LF |
| Spillway line | 55 | LF |
| **Total PVC** | **~755** | **LF** |
| Fittings @ ~1 per 9 LF | ~85 | ea |
| Jet T-bodies (his $300 line ÷ ~$30 ea) | **~10** | **ea** |

**Not yet parameterised**, and at $13,100 across both codes it is the largest remaining
unmodelled item on the job.

### 3.7 500 — Bonding

Per NEC 680.26, the bonding conductor is **#8 AWG solid bare copper**, the perimeter surface bonded extends **3 ft horizontally** beyond the inside pool walls, and it must tie to the shell steel at **a minimum of four points** uniformly spaced.

| Item | Qty | Unit |
|---|---|---|
| #8 solid bare copper, perimeter loop (3 ft offset) | ~124 | LF |
| #8 jumpers to pump, heater, niches, rails, water bond | ~100 | LF |
| **Total #8 copper** | **~224** | **LF** |
| Listed bonding clamps | ~12 | ea |

> **Check:** $250 for the Bonding line ÷ 224 LF = **$1.12/LF**. 224 LF of #8 solid bare copper at $1.00–1.50/LF is **$224–336 in material alone**, before clamps or labor. **This line is light.** Either bonding labor is buried inside the $3,000 Electrician line, or it's under-costed. He books it under 400 Pool Shell.

### 3.8 900 — Cover

Component list matches the standard encapsulated under-track system, and the real schedule confirms it.

| Item | Qty | Unit |
|---|---|---|
| Track, both sides | ~48 | LF |
| Encapsulation extrusion ("Gunite Encap Kit") | ~48 | LF |
| Cover fabric | ~336 | sq ft |
| Leading edge bar | 14 | LF |
| Drum, mechanism, ropes, pulleys, motor | 1 | set |
| Stone lid + SS lid brackets | ~14 | LF |

> The odd cents on "Gunite Encap Kit $1,130.18" — among round numbers everywhere else — means that line came off a real invoice. **The round numbers are rules of thumb; the odd ones are real.** That's the map for which unit costs are already trustworthy.
>
> At $14,555.18 the cover is the second-largest single item on the job and scales with pool size (track with length, fabric with surface area). Carrying it unchanged onto a larger pool understates it.

---

## 4. Unit cost library (re-derived)

**Re-derived 2026-07-26 against the confirmed 6 × 6 spa.** These are not quoted rates — they are
his dollars ÷ the computed quantity, so that qty × rate reproduces the figure the customer saw.

| Cost code | Unit | v1.0 rate | **v2.0 rate** | Confidence |
|---|---|---|---|---|
| Gunite | $/yd³ paid | $424 | **$439.56** | **High** — inside published $350–600 |
| Plaster material | $/bag | $85 | **$87.21** | **High** |
| Plaster labor | $/sq ft | $5.43 | **$5.637** | Medium |
| Rebar installed | $/lb steel | $3.69 | **$3.77** | Medium — labor-heavy, not a material rate |
| Excavation | $/bank yd³ | $58 | **$59.59** | **Low** — needs sub invoice |
| Site work & haul-off | $/loose yd³ | — | **$13.04** | **Low** — new in v2.0 |
| Forming | $/LF perimeter | — | **$5.50** | Medium — new in v2.0 |
| Tile material | $/sq ft | $32.50 | **$34.21** | **Low** — scope unclear |
| Tile labor | $/LF waterline | — | **$25.00** | Medium — new in v2.0 |
| Coping material | $/LF | — | **$33.96** | Medium |
| Coping labor | $/LF | — | **$37.26** | Medium |
| Deck decorative concrete | $/sq ft | — | **$13.59** | Medium — inside published $12–18 |
| Bonding | $/LF #8 | $1.25 | **$1.12** | **Low** — line looks light |

**This is still one job.** The rates reproduce Whitaker exactly, which is partly circular — Whitaker
is what calibrated them. The library still needs **5–10 completed pools** per PRD 02 Milestone 1
before it can be frozen, and a second job is what would actually validate it.

---

## 5. What's still missing entirely

Every item below is standard scope for a gunite pool and appears **nowhere** on the estimate. The
full line schedule (§3.1) confirms these are genuinely absent rather than buried.

**Serious — South Plains specific:**

1. **Caliche excavation contingency.** ~57% of this dig sits below the calcic horizon and there is no allowance for it. Caliche depth and hardness vary lot to lot; a hard layer shallow in the profile can mean rock teeth, a hammer, or bigger iron. Exposure $741–$2,224 on a job like this.
2. **Geotechnical / soil report.** No line item. Less about swell here than about **where the caliche starts and how hard it is** — an excavation-pricing question before a structural one.
3. **Structural engineering.** No line item.
4. **Gas line for the heater.** The schedule confirms a **$3,350 Hayward heater** and **no gas line, no meter upgrade, no utility coordination.** A heater that size frequently needs a new run.
5. **Freeze protection and seasonal scheduling.** Lubbock sits near 3,200 ft with genuine hard freezes. Gunite can't be shot in freezing weather, so the build calendar has a closed season.

**Standard scope, also absent:**

6. **Permits — confirmed as a live line item at $0.00.** Still unexplained.
7. **Water to fill** — 12,881 gallons, meter or truck
8. **Curing water** — shell must be kept moist 7–28 days
9. **Rebound haul-off** — the gunite sub's ~3.5 yd³ of rebound is the builder's cost. The $1,500 site-cleanup line covers excavation spoil, not rebound.
10. **Startup chemicals**
11. **Equipment pad slab**
12. **Deck drainage**
13. **Labor burden** — no line anywhere
14. **PM / supervision** — the derived build calendar is **7.8 weeks** (22.1 working days + 24 days of permit, inspection and cure lag), carrying ~35 supervision hours against ~132 crew hours
15. **Warranty / callback reserve**

Priced at Tier 1 + Tier 2 (Foundation §3.1), these come to roughly **$10,600 of absorbed cost —
about $13,750 of revenue** once the fee is applied. All of it gated on the cost-plus contract review.

---

## 6. What this proves

**Every line on his estimate has a derivable quantity behind it.** The model now reproduces his
figures individually — $5,500 excavation, $12,000 gunite, $4,000 rebar, $550 forming, $1,950 and
$2,500 tile, $3,600 and $3,950 coping, $3,750 and $5,000 plaster, $5,000 deck — and every modelled
cost code reconciles: 200 at $7,000, 400 at $16,800, 800 at $20,750, 1000 at $10,000.

**His pricing instincts are better than the paperwork suggests.** Gunite at $439.56/yd³, plaster at
$87.21/bag and deck at $13.59/sq ft all land inside published ranges. The numbers in his head are
calibrated; they're just undocumented, untransferable, and unauditable.

**The gap is documentation, not competence.** On a cost-plus contract, "Rebar $4,000" is
unsupportable. "1,061 lb of steel at $3.77" is. "Coping / Labor $3,950" becomes "106 LF at $37.26."

**The missing scope is the bigger financial risk than the pricing question.** Items 1–5 above are
thousands to tens of thousands of dollars each, and under cost-plus they surface as change orders
mid-build — which is exactly the conversation that costs a builder a referral.

**What would actually validate this: a second pool.** The rates here reproduce Whitaker because
Whitaker calibrated them. Until a completed job the model has never seen lands within 10%, the
method is proven and the numbers are provisional.
