/**
 * engine.mjs — Apex Pool Proposal & Takeoff Engine (PRD 02).
 *
 * The "quantity layer": turn pool dimensions into a defensible takeoff — quantities per
 * cost code × unit cost = the same dollar figures the customer already sees, but now
 * substantiated. Pure and dependency-free (Phase 2 tool choice is deliberately deferred,
 * PRD 02 §Phase 2 — this engine can drive a spreadsheet, Airtable, Monday, or the bundled
 * web UI without committing to any).
 *
 * SOURCES (every formula/number is cited):
 *   - reference/whitaker-oasis-quantity-takeoff.md  → geometry, assemblies, seed unit costs
 *   - 00-foundation.md                              → cost codes (§4), markup math (§1),
 *                                                     allowances (§6), Lever B / missing
 *                                                     costs (§3.1, §5), allocation (§8)
 *
 * LOAD-BEARING RULES (do not "fix" these — they are the point):
 *   - Foundation §1: "Cost Plus at 30%" is MARKUP on cost, = 23.08% gross margin. Always.
 *     margin = fee / (1 + fee). The tool must show the true margin, not the fee rate.
 *   - Foundation §1.4: commission is paid ON gross profit and never books to a cost code.
 *   - Foundation §6: allowances are placeholders with no takeoff — flagged, never faked.
 *   - PRD 02 §risks: allowance lines are NOT parameterized. Pools only.
 *
 * PROVISIONAL DATA: the seed unit costs come from ONE job (Whitaker) and the spa contaminates
 * every line because it wasn't dimensioned separately (reference §4). They are the METHOD
 * validated, not the numbers. Confidence is flagged per line; the library is meant to be
 * re-derived from 5–10 completed jobs (PRD 02 Milestone 1) and owner-maintained (Phase 1).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Cost codes — Foundation §4 (his order and naming; the missing ones are additive)
// ─────────────────────────────────────────────────────────────────────────────
export const COST_CODES = [
  { code: 100, name: 'Permits', status: 'existing' },
  { code: 200, name: 'Excavation', status: 'existing' },
  { code: 300, name: 'Pool Equipment', status: 'existing' },
  { code: 400, name: 'Pool Shell Construction', status: 'existing' },
  { code: 500, name: 'Utilities', status: 'existing' },
  { code: 600, name: 'Lights', status: 'existing' },
  { code: 700, name: 'Pool Plumbing', status: 'existing' },
  { code: 800, name: 'Pool Finishes', status: 'existing' },
  { code: 900, name: 'Cover', status: 'existing' },
  { code: 1000, name: 'Pool Deck', status: 'existing' },
  { code: 1100, name: 'Water Features', status: 'existing' },
  { code: 1200, name: 'Automation', status: 'existing' },
  { code: 1300, name: 'Additional Upgrades', status: 'existing' },
  { code: 1400, name: 'Design & Engineering', status: 'missing' },
  { code: 1500, name: 'Project Management & Supervision', status: 'missing' },
  { code: 1600, name: 'Startup & Chemicals', status: 'missing' },
  { code: 1700, name: 'Cleanup & Punch', status: 'missing' },
  { code: 1800, name: 'Warranty & Callback', status: 'missing' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pricing — Foundation §1. Markup, not margin.
// ─────────────────────────────────────────────────────────────────────────────

/** Gross margin implied by a cost-plus FEE (markup) rate. 0.30 → 0.2308 (Foundation §1). */
export function marginFromFee(feeRate) {
  return feeRate / (1 + feeRate);
}

/** The disclosed FEE rate needed to net a target true margin. 0.30 margin → 0.4286 fee. */
export function feeForMargin(targetMargin) {
  return targetMargin / (1 - targetMargin);
}

/**
 * Cost-plus pricing. `cost` is the reimbursable job-cost total (incl. allowances, which the
 * fee is charged on — Foundation §6). Returns the customer-facing revenue and the TRUE margin.
 */
export function price(cost, feeRate) {
  const fee = cost * feeRate;
  const revenue = cost + fee;
  return {
    cost,
    feeRate,
    fee,
    revenue,
    grossProfit: fee, // under cost-plus, GP == fee (Foundation §3)
    trueMargin: revenue === 0 ? 0 : fee / revenue,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry — reference §2. Everything derives from here.
// ─────────────────────────────────────────────────────────────────────────────

const GAL_PER_CUFT = 7.48052;

/**
 * Steps/bench wetted area as a fraction of pool surface — calibrated to Whitaker
 * (50 sq ft ÷ 336 sq ft surface = 0.149). Scaling beats a fixed constant: a 20×40 pool
 * does not have the same entry step set as a 14×24. Override with an explicit `stepsArea`.
 */
const STEPS_AREA_FRACTION = 0.149;

/**
 * Pool wetted-surface + volume geometry.
 * Validates against Whitaker (14×24, avg 4.75): surface 336, perimeter 76, floor ~338,
 * walls 361, +steps 50 → wetted 749 sq ft; volume 1,596 ft³ ≈ 11,939 gal.
 *
 * Depth: pass `depthShallow` + `depthDeep` (reference §1: 3.5 → 6.0) and both `avgDepth`
 * and `slopeFactor` are DERIVED — the floor of a deep-end pool is longer than its plan
 * length, and that relationship is geometric, not a constant. `avgDepth` alone still works
 * for backward compatibility and falls back to the Whitaker-calibrated 1.006 slope factor.
 */
export function poolGeometry({
  length,
  width,
  avgDepth,
  depthShallow,
  depthDeep,
  stepsArea,
  slopeFactor,
}) {
  const hasProfile = depthShallow != null && depthDeep != null;
  const depth = hasProfile ? (depthShallow + depthDeep) / 2 : avgDepth;
  // Floor runs down the slope: hypotenuse of (run, rise = deep − shallow). The run is the LONG
  // axis — the deep end sits at one end of the swim length — regardless of which field the
  // estimator typed it into. Whitaker is "14×24" with 14 as the width; using `length` blindly
  // would slope 2.5 ft over 14 ft instead of 24 and overstate shell area.
  const slopeRun = Math.max(length, width);
  const slope = slopeFactor ?? (hasProfile ? Math.sqrt(1 + ((depthDeep - depthShallow) / slopeRun) ** 2) : 1.006);

  const surfaceArea = length * width;
  const perimeter = 2 * (length + width);
  const steps = stepsArea ?? surfaceArea * STEPS_AREA_FRACTION;
  const floorArea = surfaceArea * slope; // deep-end slope adds a little length
  const wallArea = perimeter * depth;
  const wettedArea = floorArea + wallArea + steps;
  const volumeCuFt = surfaceArea * depth;
  return {
    surfaceArea,
    perimeter,
    floorArea,
    wallArea,
    stepsArea: steps,
    avgDepth: depth,
    slopeFactor: slope,
    depthShallow,
    depthDeep,
    wettedArea,
    volumeCuFt,
    gallons: volumeCuFt * GAL_PER_CUFT,
  };
}

/**
 * Spa geometry. Whitaker (7×7×3.5, assumed): surface 49, perimeter 28, +seat → 172 sq ft;
 * volume 171.5 ft³ ≈ 1,283 gal. Spa is the single biggest unknown (reference §1) — off by
 * default; a bundled-spa price contaminates unit costs, so dimension it explicitly when known.
 */
export function spaGeometry({ length = 7, width = 7, depth = 3.5, seatArea }) {
  const surfaceArea = length * width;
  const perimeter = 2 * (length + width);
  // Bench seat wraps most of the spa: calibrated to Whitaker (25 sq ft ÷ 49 = 0.51).
  const seat = seatArea ?? surfaceArea * 0.51;
  const wallArea = perimeter * depth;
  const wettedArea = surfaceArea + wallArea + seat;
  const volumeCuFt = surfaceArea * depth;
  return {
    length,
    width,
    surfaceArea,
    perimeter,
    wallArea,
    seatArea: seat,
    depth,
    wettedArea,
    volumeCuFt,
    gallons: volumeCuFt * GAL_PER_CUFT,
  };
}

/** Combine pool (+optional spa) into the totals the assemblies consume. */
export function combinedGeometry(inputs) {
  const pool = poolGeometry(inputs);
  const spa = inputs.spa ? spaGeometry(inputs.spa) : null;
  const wettedArea = pool.wettedArea + (spa ? spa.wettedArea : 0);
  const perimeter = pool.perimeter + (spa ? spa.perimeter : 0);
  // Coping follows EXPOSED perimeter — much of the spa perimeter abuts the pool (reference §800).
  const copingPerimeter = pool.perimeter + (spa ? Math.round(spa.perimeter * 0.85) : 0);
  const gallons = pool.gallons + (spa ? spa.gallons : 0);
  return { pool, spa, wettedArea, perimeter, copingPerimeter, gallons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit cost library — seed from reference §4. PROVISIONAL. confidence per line.
// Editable: this is what Phase 1 freezes and an owner maintains.
// ─────────────────────────────────────────────────────────────────────────────
export const UNIT_COSTS = {
  excavation: { rate: 58, unit: '$/bank yd³', confidence: 'low', note: 'caliche dig; needs sub invoice (ref §0/§4)' },
  gunite: { rate: 424, unit: '$/yd³ paid', confidence: 'high', note: 'inside published $350–600 (ref §4)' },
  rebarInstalled: { rate: 3.69, unit: '$/lb steel', confidence: 'medium', note: 'labor-heavy, not a material rate' },
  plasterMaterial: { rate: 85, unit: '$/bag', confidence: 'high', note: 'Diamond Brite territory' },
  plasterLabor: { rate: 5.43, unit: '$/sq ft', confidence: 'medium' },
  tileMaterial: { rate: 32.5, unit: '$/sq ft', confidence: 'low', note: 'high — scope unclear, possibly glass/spa fully tiled (ref §800 flag)' },
  copingInstalled: { rate: 75.5, unit: '$/LF', confidence: 'medium', note: 'stone + auto-cover encapsulation' },
  bondingCopper: { rate: 1.25, unit: '$/LF #8', confidence: 'low', note: 'estimate line looked light (ref §500)' },
  fillWater: { rate: 0.012, unit: '$/gal', confidence: 'low', note: 'meter/truck; hard Ogallala water (ref §5)' },
  deckConcrete: { rate: 15, unit: '$/sq ft', confidence: 'low', note: 'ref §1000 back-solves $12–18/sq ft from a $5k allowance; never measured' },
};

// Production rates for crew hours — PROVISIONAL, needs calibration (PRD 02 §scope expansion).
// Foundation §3.2: hours are required so Tier 2 (PM/supervision) has a defensible basis.
export const PRODUCTION = {
  rebarTieHrsPerLb: 0.022, // ~24 man-hrs for the 1,084 lb Whitaker cage ("2–3 man-day", ref §300)
  plasterHrsPerSqFt: 0.03,
  guniteHrsPerYd3: 1.2,
  excavationHrsPerYd3: 0.35,
  deckHrsPerSqFt: 0.045,
};

// Allowances — Foundation §6. Placeholders, NOT takeoff. Fee is charged on top; flagged.
export const DEFAULT_ALLOWANCES = [
  { name: 'Concrete Diamonds Budget', amount: 5000 },
  { name: 'Turf Budget', amount: 5000 },
  { name: 'Fence Budget', amount: 7000 },
];

// Missing-cost catalog — reference §5 + Foundation §3.1. Lever B candidates, GATED on the
// contract review (Foundation §3.1, open question 2). Off by default; surfaced so nothing is
// silently omitted, never auto-added to the base.
export const MISSING_COSTS = [
  { code: 100, name: 'Permits', tier: 1, note: 'shows $0.00 on the estimate — resolve (ref §5.6)' },
  { code: 200, name: 'Caliche excavation contingency', tier: 1, note: 'biggest Lubbock variable, no allowance (ref §5.1)' },
  { code: 1400, name: 'Geotechnical / soil report', tier: 1, note: 'where caliche starts + how hard (ref §5.2)' },
  { code: 1400, name: 'Structural engineering', tier: 1, note: 'no line item (ref §5.3)' },
  { code: 300, name: 'Gas line / meter for heater', tier: 1, note: '$3,350 heater, no gas run (ref §5.4)' },
  { code: 200, name: 'Freeze protection / seasonal', tier: 1, note: 'hard freezes at 3,200 ft (ref §5.5)' },
  { code: 1600, name: 'Fill water', tier: 1, note: '~13k gal, meter or truck (ref §5.7)' },
  { code: 1600, name: 'Curing water', tier: 1, note: 'keep shell moist 7–28 days (ref §5.8)' },
  { code: 200, name: 'Rebound haul-off', tier: 1, note: "gunite sub's rebound is the builder's cost (ref §5.9)" },
  { code: 1600, name: 'Startup chemicals', tier: 1, note: 'not present (ref §5.10)' },
  { code: 'burden', name: 'Labor burden', tier: 1, note: 'no burden line anywhere (Foundation §5.2)' },
  { code: 1500, name: 'PM / supervision', tier: 2, note: 'duration-driven; needs allocation basis (Foundation §8, §3.1)' },
  { code: 1800, name: 'Warranty / callback', tier: 1, note: 'work performed is Tier 1; a reserve is Tier 3 (Foundation §3.1)' },
];

// Lever B rates — PROVISIONAL placeholders so the gated preview can be QUANTIFIED rather than
// left as a checklist. Every one needs a real invoice or quote before it is billed.
export const LEVER_B_RATES = {
  waterPerGal: 0.012, // meter or truck (ref §5.7)
  curingWaterFraction: 0.3, // shell kept moist 7–28 days (ref §5.8)
  startupChemPerGal: 0.028, // (ref §5.10)
  reboundHaulPerYd3: 95, // gunite sub's rebound is the builder's cost (ref §5.9)
  laborBurdenPerCrewHour: 14, // incremental burden — NO burden line exists anywhere (Foundation §5.2)
  supervisionLoadedPerHour: 58, // Tier 2, duration-allocated (Foundation §8)
  geotechReport: 1200, // (ref §5.2)
  structuralEngineering: 1500, // (ref §5.3)
  gasLineForHeater: 2500, // $3,350 heater with no gas run (ref §5.4)
  freezeProtection: 600, // (ref §5.5)
};

/**
 * Quantify the Lever B / missing-cost base for THIS job (Foundation §3.1, reference §5).
 *
 * Foundation decided Lever B — expand what counts as reimbursable "cost" — over Lever A
 * (raise the disclosed fee), because Lubbock's referral density makes a visible fee hike
 * riskier than it looks. But the decision was made without a per-job number attached, which
 * makes it hard to argue. This produces that number.
 *
 * STILL GATED. Nothing here may be billed until the cost-plus contract review confirms what
 * the agreement defines as reimbursable cost (Foundation §3.1, open question 2). This function
 * exists to size the prize, not to authorize charging it.
 *
 * Tier 1 = clean, move into the base. Tier 2 = needs a documented allocation basis.
 * Tier 3 = never in the base (returned for completeness, excluded from every total).
 */
export function leverBPreview({ geo, lines, hours, caliche, feeRate = 0.3, opts = {} }) {
  const rate = { ...LEVER_B_RATES, ...(opts.leverBRates ?? {}) };
  const gunite = lines.find((l) => l.name.includes('Gunite'));
  const reboundYd3 = gunite ? gunite.qty - gunite.qty / 1.15 : 0;

  const mk = (code, name, tier, qty, unit, unitCost, note, confidence = 'low') => ({
    code, name, tier, qty: qty == null ? null : r(qty, 1), unit, unitCost,
    extended: qty == null ? null : r(qty * unitCost), note, confidence, estimable: qty != null,
  });

  const tier1 = [
    mk(100, 'Permits', 1, opts.permitFee != null ? 1 : null, 'ea', opts.permitFee ?? 0,
      'Shows $0.00 on the estimate with a live line item (ref §5.6). Enter the real fee — cannot be derived.'),
    mk(1400, 'Geotechnical / soil report', 1, 1, 'ea', rate.geotechReport,
      'Where the caliche starts and how hard it is — an excavation-pricing question before a structural one (ref §5.2).'),
    mk(1400, 'Structural engineering', 1, 1, 'ea', rate.structuralEngineering, 'No line item exists (ref §5.3).'),
    mk(300, 'Gas line / meter for heater', 1, 1, 'ea', rate.gasLineForHeater,
      'A $3,350 heater with no gas run, no meter upgrade, no utility coordination (ref §5.4).'),
    mk(200, 'Freeze protection / seasonal', 1, 1, 'ls', rate.freezeProtection,
      'Hard freezes near 3,200 ft; standard scope, not an upgrade (ref §5.5).'),
    mk(1600, 'Fill water', 1, geo.gallons, 'gal', rate.waterPerGal, `${r(geo.gallons)} gal, meter or truck (ref §5.7).`),
    mk(1600, 'Curing water', 1, geo.gallons * rate.curingWaterFraction, 'gal', rate.waterPerGal,
      'Shell kept moist 7–28 days; High Plains wind raises evaporative demand (ref §5.8/§0).'),
    mk(1600, 'Startup chemicals', 1, geo.gallons, 'gal', rate.startupChemPerGal,
      'Not present on the estimate; hard Ogallala water affects startup chemistry (ref §5.10/§0).'),
    mk(200, 'Rebound haul-off', 1, reboundYd3, 'yd³', rate.reboundHaulPerYd3,
      "The gunite sub's rebound is the builder's cost and cannot be back-charged as unused material (ref §5.9)."),
    mk('burden', 'Labor burden', 1, hours.crewHours, 'crew hr', rate.laborBurdenPerCrewHour,
      'No burden line anywhere (Foundation §5.2). Applies to IN-HOUSE crew only — split sub vs in-house before billing (PRD 02 open Q3).'),
  ];

  if (caliche) {
    tier1.push({
      code: 200, name: 'Caliche excavation contingency', tier: 1,
      qty: caliche.calicheBankYd3, unit: 'bank yd³ in caliche', unitCost: null,
      extended: null, range: [caliche.contingencyLow, caliche.contingencyHigh],
      note: `${caliche.note} Range shown rather than a point estimate — bill actual, disclose the exposure up front (ref §5.1).`,
      confidence: 'low', estimable: false,
    });
  }

  const tier2 = [
    mk(1500, 'PM / supervision', 2, hours.supervisionHours, 'hr', rate.supervisionLoadedPerHour,
      'Duration-allocated, never a % of job cost (Foundation §8). Needs a documented allocation basis before billing (Foundation §3.1).', 'medium'),
  ];

  const tier3 = [
    { code: null, name: 'Office overhead', tier: 3, note: 'Never in the cost-plus base (Foundation §3.1).' },
    { code: null, name: 'Marketing', tier: 3, note: 'Never in the base.' },
    { code: null, name: 'Owner compensation', tier: 3, note: 'Never in the base.' },
    { code: null, name: 'Sales commission', tier: 3, note: 'Paid on GP; never books to a cost code (Foundation §1.4).' },
    { code: 1800, name: 'Warranty reserve', tier: 3, note: 'Billing for costs not yet incurred is hard to defend under cost-plus. Warranty work ACTUALLY PERFORMED is Tier 1 and bills as incurred (Foundation §3.1).' },
  ];

  const sum = (arr) => arr.reduce((s, l) => s + (l.extended || 0), 0);
  const tier1Total = sum(tier1);
  const tier2Total = sum(tier2);
  const billableTotal = tier1Total + tier2Total;

  return {
    tier1, tier2, tier3,
    tier1Total: r(tier1Total),
    tier2Total: r(tier2Total),
    billableTotal: r(billableTotal),
    feeOnLeverB: r(billableTotal * feeRate),
    revenueUplift: r(billableTotal * (1 + feeRate)),
    calicheRange: caliche ? [caliche.contingencyLow, caliche.contingencyHigh] : null,
    unquantified: tier1.filter((l) => !l.estimable).map((l) => l.name),
    gated: true,
    warnings: [
      'GATED: nothing here is billable until the cost-plus contract review defines reimbursable cost (Foundation §3.1, open question 2).',
      'The expanded Lever B base must NOT count toward commission GP — the salesperson did not earn a fee on reclassified PM salary (Foundation §7).',
      'Lever B does not change the margin PERCENTAGE. It recovers real dollars the GP was absorbing. To move the true margin you still need Lever A (fee rate).',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemblies — reference §3. Each returns a takeoff line: qty × unit cost = extended.
// `crewHours` populated where a defensible production rate exists.
// ─────────────────────────────────────────────────────────────────────────────

/** Round helper. */
const r = (n, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

/**
 * Bank volume for one basin. Over-dig on each side plus the floor shell thickness — the hole
 * is bigger than the water. Whitaker check (ref §200): pool 78 yd³, spa 11 yd³.
 */
function basinBank(length, width, depth, overdig, shellFt) {
  const digDepth = depth + shellFt;
  const footprint = (length + 2 * overdig) * (width + 2 * overdig);
  return { bank: (footprint * digDepth) / 27, footprint, digDepth };
}

/**
 * Caliche exposure (reference §0, §5.1). The calcic horizon typically starts ~27 in down and
 * runs deep — squarely inside pool-dig depth. This is the single biggest cost variable on a
 * Lubbock pool and carries NO allowance on his estimate.
 *
 * Deliberately NOT priced into the excavation line: the $58/bank yd³ seed rate was back-solved
 * from Whitaker, which already dug caliche, so adding a premium on top would double-count.
 * What's modelled instead is the VARIANCE — how much of this dig sits in caliche, and what a
 * harder or shallower layer than assumed would cost. Surfaced as a contingency range.
 */
export function calicheExposure(basins, opts = {}) {
  const startIn = opts.calicheDepthIn ?? 27; // ref §0
  let calicheBank = 0;
  let totalBank = 0;
  for (const b of basins) {
    const digIn = b.digDepth * 12;
    const frac = Math.min(1, Math.max(0, (digIn - startIn) / digIn));
    calicheBank += b.bank * frac;
    totalBank += b.bank;
  }
  // Incremental $/yd³ over ordinary soil if the layer is harder/shallower than the seed job.
  // PROVISIONAL — needs a real Lubbock excavation sub quote (open question).
  const lo = opts.calicheContingencyLow ?? 15;
  const hi = opts.calicheContingencyHigh ?? 45;
  return {
    calicheStartIn: startIn,
    calicheBankYd3: r(calicheBank, 1),
    fractionOfDig: totalBank ? r(calicheBank / totalBank, 3) : 0,
    contingencyLow: r(calicheBank * lo),
    contingencyHigh: r(calicheBank * hi),
    confidence: 'low',
    note: `~${r((calicheBank / (totalBank || 1)) * 100)}% of the dig sits below the ~${startIn}in calcic horizon. No allowance exists on the estimate (ref §5.1).`,
  };
}

function excavationLine(geo, opts) {
  const overdig = opts.overdigFt ?? 0.67; // ~8in shell + working room each side
  const shellFt = (opts.shellThicknessIn ?? 8) / 12;

  const poolDig = basinBank(opts.length, opts.width, geo.pool.avgDepth, overdig, shellFt);
  // Parametric — a 10×10 spa digs more than a 7×7. (Was hardcoded at 11 yd³, which silently
  // ignored spa dimensions; this reproduces 11 for Whitaker's 7×7×3.5.)
  const spaDig = geo.spa ? basinBank(geo.spa.length, geo.spa.width, geo.spa.depth, overdig, shellFt) : null;

  const bank = (poolDig.bank + (spaDig ? spaDig.bank : 0)) * 1.07; // +7% sloughing
  const swell = opts.swellPct ?? 0.25; // blended sandy loam over caliche (ref §0)
  const loose = bank * (1 + swell);
  const trucks = Math.ceil(loose / 14);
  const rate = UNIT_COSTS.excavation.rate;
  const caliche = calicheExposure([poolDig, ...(spaDig ? [spaDig] : [])], opts);

  return {
    code: 200,
    name: 'Excavation',
    qty: r(bank, 1),
    unit: 'bank yd³',
    unitCost: rate,
    extended: r(bank * rate),
    confidence: UNIT_COSTS.excavation.confidence,
    basis: `pool ${r(poolDig.bank, 1)} + spa ${r(spaDig ? spaDig.bank : 0, 1)} yd³ (footprint ${r(poolDig.footprint)} sq ft × ${r(poolDig.digDepth, 2)} ft dig) +7% sloughing; ${r(loose)} loose yd³, ${trucks} trucks @14`,
    crewHours: r(bank * PRODUCTION.excavationHrsPerYd3, 1),
    extra: { looseYd3: r(loose), trucks, poolBank: r(poolDig.bank, 1), spaBank: r(spaDig ? spaDig.bank : 0, 1), caliche },
  };
}

function guniteLine(geo) {
  const shellThicknessFt = 8 / 12;
  const shellVol = (geo.wettedArea * shellThicknessFt) / 27;
  const bondBeam = (geo.perimeter * 0.5) / 27; // ~0.5 ft³/LF
  const inPlace = shellVol + bondBeam;
  const ordered = inPlace * 1.15; // +15% blended rebound
  const rate = UNIT_COSTS.gunite.rate;
  return {
    code: 400,
    name: 'Pool Shell — Gunite',
    qty: r(ordered, 1),
    unit: 'yd³ paid',
    unitCost: rate,
    extended: r(ordered * rate),
    confidence: UNIT_COSTS.gunite.confidence,
    basis: `${r(geo.wettedArea)} sq ft @ 8in = ${r(shellVol, 1)} + bond beam ${r(bondBeam, 1)} = ${r(inPlace, 1)} in-place +15% rebound`,
    crewHours: r(ordered * PRODUCTION.guniteHrsPerYd3, 1),
  };
}

function rebarLine(geo) {
  const gridLF = geo.wettedArea * 2 * 1.15; // #3 @12in OC each way ≈ 2 LF/sq ft, +15% laps/waste
  const bondBeamLF = geo.perimeter * 4 * 1.1; // 4 continuous #4, +10%
  const wt3 = gridLF * 0.376; // lb/ft #3
  const wt4 = bondBeamLF * 0.668; // lb/ft #4
  const steelLb = wt3 + wt4;
  const rate = UNIT_COSTS.rebarInstalled.rate;
  return {
    code: 400,
    name: 'Pool Shell — Rebar',
    qty: r(steelLb),
    unit: 'lb steel',
    unitCost: rate,
    extended: r(steelLb * rate),
    confidence: UNIT_COSTS.rebarInstalled.confidence,
    basis: `${r(gridLF)} LF #3 grid + ${r(bondBeamLF)} LF #4 bond beam = ${r(steelLb)} lb (${r(steelLb / 2000, 2)} ton)`,
    crewHours: r(steelLb * PRODUCTION.rebarTieHrsPerLb, 1),
    // THE allocation basis (ref §300): what this job draws from a shared truckload. Promoted to
    // a first-class field — dividing a bulk delivery across jobs is the problem this solves.
    allocationBasis: { metric: 'LF #3 bar', value: r(gridLF), sticks20ft: Math.ceil(gridLF / 20) },
    extra: { gridLF: r(gridLF), bondBeamLF: r(bondBeamLF), sticks3: Math.ceil(gridLF / 20), sticks4: Math.ceil(bondBeamLF / 20) },
  };
}

function plasterLine(geo) {
  const area = geo.wettedArea;
  // ref §800: 921 sq ft ÷ 23 = 40 bags, +10% waste = 44. Waste applies to the bag count, not
  // to the coverage rate — rounding up before the waste factor over-orders by a bag.
  const baseBags = Math.round(area / 23); // 22–25 sq ft/bag @ ⅜–½ in
  const bags = Math.ceil(baseBags * 1.1);
  const mat = bags * UNIT_COSTS.plasterMaterial.rate;
  const labor = area * UNIT_COSTS.plasterLabor.rate;
  return {
    code: 800,
    name: 'Pool Finishes — Plaster',
    qty: r(area),
    unit: 'sq ft wetted',
    unitCost: r((mat + labor) / area, 2),
    extended: r(mat + labor),
    confidence: 'medium',
    basis: `${bags} bags @ $${UNIT_COSTS.plasterMaterial.rate} + labor ${r(area)} sq ft @ $${UNIT_COSTS.plasterLabor.rate}`,
    crewHours: r(area * PRODUCTION.plasterHrsPerSqFt, 1),
    extra: { bags },
  };
}

function tileLine(geo) {
  const band = geo.perimeter * 0.5 * 1.15; // 6in waterline band, +15% waste
  const rate = UNIT_COSTS.tileMaterial.rate;
  return {
    code: 800,
    name: 'Pool Finishes — Waterline Tile',
    qty: r(band),
    unit: 'sq ft',
    unitCost: rate,
    extended: r(band * rate),
    confidence: UNIT_COSTS.tileMaterial.confidence,
    basis: `${r(geo.perimeter)} LF × 0.5 ft band +15% waste`,
  };
}

function copingLine(geo) {
  const lf = geo.copingPerimeter * 1.1; // +10% waste
  const rate = UNIT_COSTS.copingInstalled.rate;
  return {
    code: 800,
    name: 'Pool Finishes — Coping',
    qty: r(lf),
    unit: 'LF',
    unitCost: rate,
    extended: r(lf * rate),
    confidence: UNIT_COSTS.copingInstalled.confidence,
    basis: `${r(geo.copingPerimeter)} LF exposed perimeter +10% waste`,
  };
}

/**
 * Pool deck (code 1000) — PRD 02 lists this as "direct input → sq ft".
 *
 * Reference §1000 calls it "the largest unquantified item on the sheet": Whitaker carries a
 * $5,000 allowance which back-solves to only 280–415 sq ft of decorative concrete, a minimal
 * 3–4 ft surround. Once someone measures the deck it stops being an allowance and becomes a
 * takeoff line — which is the whole point of the exercise. Emitted only when sq ft is supplied.
 */
function deckLine(opts) {
  const sf = opts.deckSqFt ?? 0;
  if (!sf) return null;
  const rate = opts.deckRate ?? UNIT_COSTS.deckConcrete.rate;
  return {
    code: 1000,
    name: 'Pool Deck — Decorative Concrete',
    qty: r(sf),
    unit: 'sq ft',
    unitCost: rate,
    extended: r(sf * rate),
    confidence: UNIT_COSTS.deckConcrete.confidence,
    basis: `${r(sf)} sq ft measured deck @ $${rate}/sq ft (ref §1000 back-solves $12–18/sq ft)`,
    crewHours: r(sf * PRODUCTION.deckHrsPerSqFt, 1),
  };
}

function bondingLine(geo) {
  // NEC 680.26: #8 solid bare copper, 3 ft perimeter offset + jumpers (ref §500).
  const loopLF = geo.perimeter + 8 * 3; // rough perimeter loop at 3 ft offset
  const jumpers = 100;
  const lf = loopLF + jumpers;
  const rate = UNIT_COSTS.bondingCopper.rate;
  return {
    code: 500,
    name: 'Utilities — Bonding',
    qty: r(lf),
    unit: 'LF #8 Cu',
    unitCost: rate,
    extended: r(lf * rate),
    confidence: UNIT_COSTS.bondingCopper.confidence,
    basis: `perimeter loop ${r(loopLF)} LF + ~${jumpers} LF jumpers (material only; labor may sit in Electrician line)`,
  };
}

/**
 * Cost codes that are layout/spec-driven rather than cleanly parametric (plumbing, equipment,
 * cover, deck, lights, features, automation). Reference treats these as component lists or
 * allowances. Represented as DIRECT-ENTRY lines seeded with Whitaker's figures — flagged so the
 * estimator knows these carry the least parametric confidence and want real numbers.
 */
export const DIRECT_LINES_SEED = [
  { code: 300, name: 'Pool Equipment', extended: 0, confidence: 'direct', basis: 'pump/filter/heater/UV per spec — enter from quote' },
  { code: 600, name: 'Lights', extended: 0, confidence: 'direct', basis: 'fixture count × unit — enter from quote' },
  { code: 700, name: 'Pool Plumbing', extended: 0, confidence: 'direct', basis: '~755 LF PVC on Whitaker; layout-driven, enter or component-estimate (ref §700)' },
  { code: 900, name: 'Cover', extended: 0, confidence: 'direct', basis: 'encapsulated under-track system; "Gunite Encap Kit" is a real invoice line (ref §900)' },
  { code: 1200, name: 'Automation', extended: 0, confidence: 'direct', basis: 'controller + valves — enter from quote' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Supervision — Foundation §8: DURATION-driven, never a % of job cost.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Estimate supervision hours from the build calendar (Foundation §8 / PRD 02 scope expansion).
 * A $150k and a $90k pool on the same 7-week calendar consume similar PM time — so % of cost
 * would overcharge the expensive job and fail an audit.
 */
export function supervisionHours({ buildWeeks = 7, visitsPerWeek = 3, hoursPerVisit = 1.5 }) {
  return r(buildWeeks * visitsPerWeek * hoursPerVisit, 1);
}

// Crew-day production rates for the build calendar. PROVISIONAL — calibrate against real jobs.
export const SCHEDULE_RATES = {
  digYd3PerDay: 45, // caliche-slowed; ordinary soil runs higher
  rebarLFPerDay: 900,
  copingLFPerDay: 40,
  deckSfPerDay: 350,
  fillGalPerDay: 10000,
};

/**
 * Derive the build calendar from the takeoff (Foundation §8 / PRD 02 scope expansion).
 *
 * This is what makes supervision defensible. Treating `buildWeeks` as a typed input means
 * supervision is really just a number someone chose; deriving duration from quantities plus
 * fixed cure/inspection lags means a $150k and a $90k pool on the same calendar get similar
 * PM hours — which is the whole argument for duration over percent-of-cost.
 *
 * Lag days (permit wait, gunite cure, deck cure, inspection) are calendar time nobody works
 * but the PM still carries, so they count toward duration and are tracked separately.
 * Whitaker lands ~8 weeks against the reference's "6–8 weeks" (§5.14).
 */
export function buildSchedule(geo, lines, opts = {}) {
  const rates = { ...SCHEDULE_RATES, ...(opts.scheduleRates ?? {}) };
  const exc = lines.find((l) => l.code === 200);
  const rebar = lines.find((l) => l.name.includes('Rebar'));
  const bankYd3 = exc ? exc.qty : 0;
  const gridLF = rebar?.extra?.gridLF ?? 0;
  const deckSf = opts.deckSqFt ?? 0;

  const phases = [
    { name: 'Layout & permit', days: 1, lag: opts.permitLagDays ?? 7, lagWhy: 'permit issuance' },
    { name: 'Excavation', days: bankYd3 / rates.digYd3PerDay, lag: 0 },
    { name: 'Steel', days: gridLF / rates.rebarLFPerDay, lag: 0 },
    { name: 'Plumbing rough', days: 2, lag: 2, lagWhy: 'pre-gunite inspection' },
    { name: 'Gunite', days: 1, lag: opts.guniteCureDays ?? 10, lagWhy: 'shell cure (wet-down window)' },
    { name: 'Tile & coping', days: geo.copingPerimeter / rates.copingLFPerDay, lag: 0 },
    { name: 'Deck', days: deckSf / rates.deckSfPerDay, lag: deckSf > 0 ? 5 : 0, lagWhy: 'deck cure' },
    { name: 'Equipment & electrical', days: 3, lag: 0 },
    { name: 'Plaster', days: 1, lag: 0 },
    { name: 'Fill & startup', days: geo.gallons / rates.fillGalPerDay + 4, lag: 0 },
    { name: 'Punch & handover', days: 1, lag: 0 },
  ].map((p) => ({ ...p, days: r(p.days, 2) }));

  const workingDays = phases.reduce((s, p) => s + p.days, 0);
  const lagDays = phases.reduce((s, p) => s + p.lag, 0);
  const calendarDays = workingDays * (7 / 5) + lagDays; // working days land Mon–Fri
  const buildWeeks = calendarDays / 7;

  return {
    phases,
    workingDays: r(workingDays, 1),
    lagDays: r(lagDays, 1),
    calendarDays: r(calendarDays, 1),
    buildWeeks: r(buildWeeks, 1),
    note: 'Derived from quantities + fixed cure/inspection lags. Excludes the Lubbock freeze season — gunite cannot be shot in freezing weather (ref §0/§5.5), which closes the calendar seasonally.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The takeoff — assemble everything.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produce a full proposal takeoff.
 * @param inputs.length, .width, .avgDepth  — pool dims (ft)
 * @param inputs.spa                          — {length,width,depth,seatArea} or null
 * @param inputs.feeRate                      — disclosed cost-plus fee (default 0.30 — Foundation §1)
 * @param inputs.allowances                   — [{name,amount}] flagged placeholders (default §6 set)
 * @param inputs.directLines                  — [{code,name,extended}] layout-driven entries
 * @param inputs.buildWeeks/.visitsPerWeek/.hoursPerVisit — supervision calendar
 * @param inputs.includeMissing               — false; Lever B costs are GATED on contract review
 */
export function takeoff(inputs) {
  const opts = { avgDepth: 4.75, ...inputs };
  const geo = combinedGeometry(opts);

  const parametricLines = [
    excavationLine(geo, opts),
    rebarLine(geo),
    guniteLine(geo),
    tileLine(geo),
    copingLine(geo),
    plasterLine(geo),
    bondingLine(geo),
    deckLine(opts),
  ].filter(Boolean);

  const directLines = (inputs.directLines ?? DIRECT_LINES_SEED).map((l) => ({
    qty: null,
    unit: null,
    unitCost: null,
    crewHours: null,
    ...l,
  }));

  const allowances = inputs.allowances ?? DEFAULT_ALLOWANCES;
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0);

  const takeoffCost = parametricLines.reduce((s, l) => s + l.extended, 0);
  const directCost = directLines.reduce((s, l) => s + (l.extended || 0), 0);

  // Reimbursable cost the fee is charged on: takeoff + direct + allowances (Foundation §6).
  const jobCost = takeoffCost + directCost + allowanceTotal;
  const pricing = price(jobCost, opts.feeRate ?? 0.3);

  const crewHours = parametricLines.reduce((s, l) => s + (l.crewHours || 0), 0);
  // Duration is DERIVED from the takeoff (Foundation §8). An explicit `buildWeeks` still wins,
  // so an estimator who knows this job runs long can override — but the default is computed,
  // not typed, which is what makes the Tier 2 allocation defensible.
  const schedule = buildSchedule(geo, parametricLines, opts);
  const buildWeeks = opts.buildWeeks ?? schedule.buildWeeks;
  const supHours = supervisionHours({ ...opts, buildWeeks });
  const hours = { crewHours: r(crewHours, 1), supervisionHours: supHours, totalHours: r(crewHours + supHours, 1), buildWeeks };

  const caliche = parametricLines.find((l) => l.code === 200)?.extra?.caliche ?? null;
  const leverB = leverBPreview({ geo, lines: parametricLines, hours, caliche, feeRate: opts.feeRate ?? 0.3, opts });

  // Budget by cost code (Foundation vocabulary: "Budget" = takeoff × unit costs). Zero re-entry
  // handoff target (PRD 02 success criteria).
  const budget = {};
  for (const l of [...parametricLines, ...directLines]) {
    budget[l.code] = budget[l.code] || { code: l.code, name: codeName(l.code), extended: 0, crewHours: 0 };
    budget[l.code].extended += l.extended || 0;
    budget[l.code].crewHours += l.crewHours || 0;
  }

  return {
    inputs: opts,
    geometry: geo,
    lines: parametricLines,
    directLines,
    allowances,
    allowanceTotal,
    allowancePctOfCost: jobCost ? allowanceTotal / jobCost : 0,
    takeoffCost: r(takeoffCost),
    directCost: r(directCost),
    jobCost: r(jobCost),
    pricing: {
      ...pricing,
      fee: r(pricing.fee),
      revenue: r(pricing.revenue),
      trueMarginPct: r(pricing.trueMargin * 100, 2),
    },
    hours,
    schedule,
    caliche,
    // How much of the job the quantity layer actually substantiates. PRD 02's success criterion
    // is "no typed dollar figures in cost lines" — this measures the distance to it. On Whitaker
    // the parametric assemblies cover ~35% of real job cost; equipment, plumbing, cover, lights
    // and automation are direct-entry, and until they carry real quotes the proposal is still
    // half typed-in. This number is the honest scoreboard for Milestone 3.
    // Percentages are taken against the REAL job cost when it is known. Measuring against the
    // model's own total would flatter it: with the direct-entry codes at $0 the denominator
    // shrinks and coverage reads ~71% when the true figure against Whitaker is ~35%.
    coverage: (() => {
      const denom = opts.actualJobCost || jobCost;
      const pct = (n) => (denom ? r((n / denom) * 100, 1) : 0);
      const unmodelled = opts.actualJobCost ? Math.max(0, opts.actualJobCost - jobCost) : 0;
      return {
        basis: opts.actualJobCost ? 'actual job cost' : 'modelled job cost',
        denominator: r(denom),
        parametric: r(takeoffCost),
        direct: r(directCost),
        allowance: r(allowanceTotal),
        unmodelled: r(unmodelled),
        parametricPct: pct(takeoffCost),
        directPct: pct(directCost),
        allowancePct: pct(allowanceTotal),
        unmodelledPct: pct(unmodelled),
        unpricedDirectLines: directLines.filter((l) => !l.extended).map((l) => l.name),
      };
    })(),
    // Always computed — "gated" means do not BILL it, not do not LOOK at it. Sizing the prize
    // is exactly what unblocks the contract-review conversation (Foundation §3.1).
    leverB,
    budgetByCode: Object.values(budget).sort((a, b) => a.code - b.code),
    missingCosts: inputs.includeMissing ? MISSING_COSTS : [],
    // Milestone 4 back-test: pass the real completed-job cost and get the variance. The gate is
    // "within 10%". Only meaningful once the direct-entry lines carry real quotes — otherwise
    // it just measures how much of the job is still unmodelled.
    backTest: opts.actualJobCost
      ? {
          actual: opts.actualJobCost,
          model: r(jobCost),
          variance: r(jobCost - opts.actualJobCost),
          variancePct: r(((jobCost - opts.actualJobCost) / opts.actualJobCost) * 100, 1),
          withinGate: Math.abs((jobCost - opts.actualJobCost) / opts.actualJobCost) <= 0.1,
          unmodelled: r(opts.actualJobCost - jobCost),
        }
      : null,
    flags: buildFlags(allowances, allowanceTotal, jobCost, parametricLines, directLines),
  };
}

function codeName(code) {
  const c = COST_CODES.find((x) => x.code === code);
  return c ? c.name : String(code);
}

function buildFlags(allowances, allowanceTotal, jobCost, lines, directLines = []) {
  const flags = [];
  const unpriced = directLines.filter((l) => !l.extended);
  if (unpriced.length) {
    flags.push({
      level: 'warn',
      msg: `${unpriced.length} layout-driven cost code(s) still at $0: ${unpriced.map((l) => l.name).join(', ')}. These are real scope, not absent scope — on Whitaker they account for roughly half of job cost. The proposal is not complete until they carry real quotes.`,
    });
  }
  if (allowanceTotal > 0) {
    flags.push({
      level: 'warn',
      msg: `Allowances = ${fmtMoney(allowanceTotal)} (${r((allowanceTotal / jobCost) * 100, 1)}% of job cost) are placeholders, not takeoff. The fee is charged on top. Whether the fee recalculates on actuals is BLOCKED on the allowance-mechanic decision (Foundation §6).`,
    });
  }
  flags.push({
    level: 'info',
    msg: 'Lever B / missing-cost lines (permits, burden, PM, caliche contingency, etc.) are GATED on the cost-plus contract review (Foundation §3.1). Toggle "include missing costs" to preview them; do not bill them until the contract defines reimbursable cost.',
  });
  const lowConf = lines.filter((l) => l.confidence === 'low').map((l) => l.name);
  if (lowConf.length) {
    flags.push({ level: 'info', msg: `Low-confidence unit costs (need real invoices): ${lowConf.join(', ')}.` });
  }
  return flags;
}

export function fmtMoney(n) {
  return '$' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
