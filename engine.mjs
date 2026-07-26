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
 * Pool wetted-surface + volume geometry.
 * Validates against Whitaker (14×24, avg 4.75): surface 336, perimeter 76, floor ~338,
 * walls 361, +steps 50 → wetted 749 sq ft; volume 1,596 ft³ ≈ 11,939 gal.
 */
export function poolGeometry({ length, width, avgDepth, stepsArea = 50, slopeFactor = 1.006 }) {
  const surfaceArea = length * width;
  const perimeter = 2 * (length + width);
  const floorArea = surfaceArea * slopeFactor; // deep-end slope adds a little length
  const wallArea = perimeter * avgDepth;
  const wettedArea = floorArea + wallArea + stepsArea;
  const volumeCuFt = surfaceArea * avgDepth;
  return {
    surfaceArea,
    perimeter,
    floorArea,
    wallArea,
    stepsArea,
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
export function spaGeometry({ length = 7, width = 7, depth = 3.5, seatArea = 25 }) {
  const surfaceArea = length * width;
  const perimeter = 2 * (length + width);
  const wallArea = perimeter * depth;
  const wettedArea = surfaceArea + wallArea + seatArea;
  const volumeCuFt = surfaceArea * depth;
  return {
    surfaceArea,
    perimeter,
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
};

// Production rates for crew hours — PROVISIONAL, needs calibration (PRD 02 §scope expansion).
// Foundation §3.2: hours are required so Tier 2 (PM/supervision) has a defensible basis.
export const PRODUCTION = {
  rebarTieHrsPerLb: 0.022, // ~24 man-hrs for the 1,084 lb Whitaker cage ("2–3 man-day", ref §300)
  plasterHrsPerSqFt: 0.03,
  guniteHrsPerYd3: 1.2,
  excavationHrsPerYd3: 0.35,
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

// ─────────────────────────────────────────────────────────────────────────────
// Assemblies — reference §3. Each returns a takeoff line: qty × unit cost = extended.
// `crewHours` populated where a defensible production rate exists.
// ─────────────────────────────────────────────────────────────────────────────

/** Round helper. */
const r = (n, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

function excavationLine(geo, opts) {
  const dig = geo.pool; // spa bank volume folded in via factor below
  const digDepth = opts.avgDepth + 0.67; // + ~8in floor shell + working room (ref: 5.42 vs 4.75)
  const footprint = (opts.length + 2 * 0.67) * (opts.width + 2 * 0.67);
  const poolBank = (footprint * digDepth) / 27;
  const spaBank = geo.spa ? 11 : 0; // ref §200 (small, roughly fixed for a 7×7 spa)
  const bank = (poolBank + spaBank) * 1.07; // +7% sloughing
  const swell = opts.swellPct ?? 0.25; // blended sandy loam over caliche (ref §0)
  const loose = bank * (1 + swell);
  const trucks = Math.ceil(loose / 14);
  const rate = UNIT_COSTS.excavation.rate;
  return {
    code: 200,
    name: 'Excavation',
    qty: r(bank, 1),
    unit: 'bank yd³',
    unitCost: rate,
    extended: r(bank * rate),
    confidence: UNIT_COSTS.excavation.confidence,
    basis: `footprint ${r(footprint)} sq ft × ${r(digDepth, 2)} ft dig +7% sloughing; ${r(loose)} loose yd³, ${trucks} trucks @14`,
    crewHours: r(bank * PRODUCTION.excavationHrsPerYd3, 1),
    extra: { looseYd3: r(loose), trucks },
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
    extra: { gridLF: r(gridLF), bondBeamLF: r(bondBeamLF) },
  };
}

function plasterLine(geo) {
  const area = geo.wettedArea;
  const bags = Math.ceil((area / 23) * 1.1); // 22–25 sq ft/bag, +10% waste
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
  ];

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
  const supHours = supervisionHours(opts);

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
    hours: { crewHours: r(crewHours, 1), supervisionHours: supHours, totalHours: r(crewHours + supHours, 1) },
    budgetByCode: Object.values(budget).sort((a, b) => a.code - b.code),
    missingCosts: inputs.includeMissing ? MISSING_COSTS : [],
    flags: buildFlags(allowances, allowanceTotal, jobCost, parametricLines),
  };
}

function codeName(code) {
  const c = COST_CODES.find((x) => x.code === code);
  return c ? c.name : String(code);
}

function buildFlags(allowances, allowanceTotal, jobCost, lines) {
  const flags = [];
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
