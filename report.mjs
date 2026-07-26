/**
 * report.mjs — print a full takeoff for one pool.
 *
 * The substantiation test from PRD 02's success criteria, made runnable: every dollar figure
 * on the customer estimate traced to quantity × unit cost in under a minute.
 *
 *   node report.mjs whitaker         # the reference job, checked against known quantities
 *   node report.mjs sample           # a different pool, to show the method generalizes
 *   node report.mjs 18x36 --deep 7 --spa 8x8 --deck 700
 */
import { takeoff, fmtMoney, COST_CODES, DIRECT_LINES_SEED } from './engine.mjs';
import { SECTION_TOTAL } from './whitaker-actual.mjs';

/**
 * Whitaker's actual direct-entry lines, carried onto a new job as a STARTING POINT (--carry).
 * These are quote-driven codes, so carrying them is a placeholder, not an estimate — some are
 * genuinely near-fixed (equipment, electrician, automation), others scale with the pool
 * (cover track and fabric, plumbing runs). Flagged so nobody mistakes one for the other.
 */
const CARRIED = DIRECT_LINES_SEED.map((l) => {
  const code = l.code === 500 ? 500 : l.code;
  const amount = [300, 500, 600, 700, 900, 1100, 1200].includes(code) ? SECTION_TOTAL(code) : 0;
  return { ...l, extended: amount, basis: amount ? `carried from Whitaker (${l.basis})` : l.basis };
});

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };

/**
 * Ground truth, corrected 2026-07-26. The reference takeoff assumed a 7×7 spa and published
 * 921 sq ft / 104 LF / 13,222 gal; Travis confirmed 6×6×3.5, which supersedes all of it.
 */
const WHITAKER_TRUTH = {
  'wetted area': [887, 'sq ft'], 'perimeter': [100, 'LF'], 'gallons': [12881, 'gal'],
  'excavation': [92.3, 'bank yd³'], 'gunite ordered': [27.3, 'yd³'], 'plaster bags': [43, 'bags'],
  'rebar steel': [1061, 'lb'],
};

// `spa: {}` opts in and lets APEX_STANDARDS size it; depth profile and deck derive from standards.
const SCENARIOS = {
  whitaker: {
    label: 'Whitaker Oasis — 14×24 w/ spa (the reference job)',
    truth: WHITAKER_TRUTH,
    input: { length: 24, width: 14, spa: {}, actualJobCost: 116955.18 },
  },
  sample: {
    label: 'Sample — 18×36 w/ standard spa, deeper profile, derived 4 ft deck',
    input: { length: 36, width: 18, depthDeep: 7.0, spa: {} },
  },
};

let scenario = SCENARIOS[argv[0]];
if (!scenario) {
  const dims = (argv[0] || '16x32').split('x').map(Number);
  const spa = flag('spa') ? flag('spa').split('x').map(Number) : null;
  scenario = {
    label: `Custom — ${argv[0] || '16x32'}${spa ? ` w/ ${flag('spa')} spa` : ''}`,
    input: {
      length: Math.max(...dims), width: Math.min(...dims),
      depthShallow: Number(flag('shallow', 3.5)), depthDeep: Number(flag('deep', 6)),
      spa: spa ? { length: spa[0], width: spa[1], depth: Number(flag('spadepth', 3.5)) } : null,
      // Omit entirely when not given — passing 0 reads as "deck is zero sq ft" and kills the line.
      ...(flag('deck') ? { deckSqFt: Number(flag('deck')) } : {}),
      // --carry reuses Whitaker's direct-entry lines as a starting point for the quote-driven codes.
      ...(argv.includes('--carry') ? { directLines: CARRIED } : {}),
    },
  };
}

const t = takeoff(scenario.input);
const money = (n) => fmtMoney(n).padStart(13);
const bar = (c = '─') => console.log(c.repeat(78));
const h = (s) => { console.log(); bar('═'); console.log('  ' + s.toUpperCase()); bar('═'); };

console.log();
bar('═');
console.log('  APEX POOL TAKEOFF — ' + scenario.label);
bar('═');

h('geometry');
const g = t.geometry;
const truthCheck = (name, val) => {
  if (!scenario.truth?.[name]) return '';
  const [exp] = scenario.truth[name];
  const d = Math.abs(val - exp) / exp * 100;
  return `   ref ${exp.toLocaleString()}  (${d < 0.05 ? 'exact' : d.toFixed(1) + '% off'})`;
};
console.log(`  Pool          ${g.pool.length ?? scenario.input.length} × ${scenario.input.width} ft, ${g.pool.depthShallow ?? '?'}–${g.pool.depthDeep ?? '?'} ft deep (avg ${g.pool.avgDepth.toFixed(2)})`);
if (g.spa) console.log(`  Spa           ${g.spa.length} × ${g.spa.width} × ${g.spa.depth} ft`);
console.log(`  Wetted area   ${g.wettedArea.toFixed(0).padStart(7)} sq ft${truthCheck('wetted area', g.wettedArea)}`);
console.log(`  Perimeter     ${String(g.perimeter).padStart(7)} LF${truthCheck('perimeter', g.perimeter)}`);
console.log(`  Water volume  ${g.gallons.toFixed(0).padStart(7)} gal${truthCheck('gallons', g.gallons)}`);

h('quantity layer — every dollar traced to qty × unit cost');
console.log('  code  item                        qty  unit           unit $      extended  conf');
bar();
for (const l of t.lines) {
  console.log(`  ${String(l.code).padEnd(5)} ${l.name.replace('Pool Shell — ', '').replace('Pool Finishes — ', '').replace('Utilities — ', '').padEnd(24)} ${String(l.qty).padStart(7)}  ${(l.unit || '').padEnd(12)} ${String(l.unitCost).padStart(7)} ${money(l.extended)}  ${l.confidence}`);
  console.log(`        └ ${l.basis}`);
}
bar();
console.log(`  ${'TAKEOFF SUBTOTAL'.padEnd(54)}${money(t.takeoffCost)}`);

if (scenario.truth) {
  h('validation vs the reference takeoff');
  const checks = [
    ['excavation', t.lines.find(l => l.code === 200).qty],
    ['gunite ordered', t.lines.find(l => l.name.includes('Gunite')).qty],
    ['plaster bags', t.lines.find(l => l.name.includes('Plaster')).extra.bags],
    ['rebar steel', t.lines.find(l => l.name.includes('Rebar')).qty],
  ];
  for (const [name, val] of checks) {
    const [exp, unit] = scenario.truth[name];
    const d = Math.abs(val - exp) / exp * 100;
    console.log(`  ${name.padEnd(18)} model ${String(val).padStart(8)} ${unit.padEnd(10)} ref ${String(exp).padStart(8)}   ${d < 0.05 ? '✓ exact' : d <= 3 ? `✓ ${d.toFixed(1)}%` : `⚠ ${d.toFixed(1)}%`}`);
  }
}

h('direct-entry lines (layout-driven — enter from real quotes)');
for (const l of t.directLines) console.log(`  ${String(l.code).padEnd(5)} ${l.name.padEnd(28)} ${money(l.extended)}   ${l.extended ? '' : '← still $0'}`);

h('allowances — placeholders, NOT takeoff (Foundation §6)');
for (const a of t.allowances) console.log(`  ${a.name.padEnd(34)} ${money(a.amount)}`);
console.log(`  ${'ALLOWANCE TOTAL'.padEnd(34)} ${money(t.allowanceTotal)}   ${(t.allowancePctOfCost * 100).toFixed(1)}% of job cost`);

h('build calendar — the basis for supervision (Foundation §8)');
for (const p of t.schedule.phases) {
  if (p.days === 0 && p.lag === 0) continue;
  console.log(`  ${p.name.padEnd(26)} ${String(p.days).padStart(5)} work days${p.lag ? `  + ${String(p.lag).padStart(2)} lag  (${p.lagWhy})` : ''}`);
}
bar();
console.log(`  ${t.schedule.workingDays} working days + ${t.schedule.lagDays} lag = ${t.schedule.calendarDays} calendar days → ${t.schedule.buildWeeks} WEEKS (derived)`);
console.log(`  Crew ${t.hours.crewHours} hrs · supervision ${t.hours.supervisionHours} hrs · total ${t.hours.totalHours} hrs`);

h('coverage — how much of the job the quantity layer substantiates');
const cv = t.coverage;
const covBar = (pct) => '█'.repeat(Math.round(pct / 2.5)).padEnd(40, '·');
console.log(`  (as a share of ${cv.basis} — ${fmtMoney(cv.denominator)})\n`);
console.log(`  Parametric takeoff  ${String(cv.parametricPct).padStart(5)}%  ${covBar(cv.parametricPct)} ${money(cv.parametric)}`);
console.log(`  Direct entry        ${String(cv.directPct).padStart(5)}%  ${covBar(cv.directPct)} ${money(cv.direct)}`);
console.log(`  Allowances          ${String(cv.allowancePct).padStart(5)}%  ${covBar(cv.allowancePct)} ${money(cv.allowance)}`);
if (cv.unmodelled) console.log(`  NOT MODELLED        ${String(cv.unmodelledPct).padStart(5)}%  ${covBar(cv.unmodelledPct)} ${money(cv.unmodelled)}`);
if (cv.unpricedDirectLines.length) console.log(`\n  ⚠ Still $0 and therefore excluded from job cost: ${cv.unpricedDirectLines.join(', ')}.`);

if (t.backTest) {
  const bt = t.backTest;
  h('back-test vs the real completed job (PRD 02 Milestone 4 — gate: within 10%)');
  console.log(`  Real job cost (his estimate)             ${money(bt.actual)}`);
  console.log(`  Model job cost                           ${money(bt.model)}`);
  console.log(`  Variance                                 ${money(bt.variance)}   ${bt.variancePct}%   ${bt.withinGate ? '✓ within gate' : '✗ FAILS the 10% gate'}`);
  console.log(`\n  ${fmtMoney(bt.unmodelled)} of this job is not modelled at all — it sits in the`);
  console.log(`  direct-entry cost codes still seeded at $0: ${cv.unpricedDirectLines.join(', ')}.`);
  console.log(`  This is not a model error; it is missing input. The 10% gate cannot be met`);
  console.log(`  until those codes carry real quotes from the completed job.`);
}

h('pricing — cost-plus (Foundation §1)');
console.log(`  Job cost (fee is charged on this)        ${money(t.jobCost)}`);
console.log(`  Disclosed fee @ ${(t.pricing.feeRate * 100).toFixed(0)}% markup                ${money(t.pricing.fee)}`);
console.log(`  Customer price                           ${money(t.pricing.revenue)}`);
bar();
console.log(`  TRUE GROSS MARGIN                              ${t.pricing.trueMarginPct}%   ← not ${(t.pricing.feeRate * 100).toFixed(0)}%. margin = fee ÷ (1 + fee)`);
console.log(`  A true 30% margin would need a disclosed fee of 42.9%.`);

h('lever b preview — GATED on the contract review (Foundation §3.1)');
const lb = t.leverB;
console.log('  tier  item                              qty  unit              extended');
bar();
for (const l of [...lb.tier1, ...lb.tier2]) {
  const amt = l.extended != null ? money(l.extended) : (l.range ? `  ${fmtMoney(l.range[0])}–${fmtMoney(l.range[1])}` : '   not estimable');
  console.log(`  ${l.tier}     ${l.name.padEnd(30)} ${String(l.qty ?? '—').padStart(8)}  ${(l.unit || '').padEnd(16)}${amt}`);
}
bar();
console.log(`  Tier 1 (clean, move into the base)       ${money(lb.tier1Total)}`);
console.log(`  Tier 2 (needs allocation basis)          ${money(lb.tier2Total)}`);
console.log(`  RECOVERABLE COST                         ${money(lb.billableTotal)}`);
console.log(`  + fee earned on it @ ${(t.pricing.feeRate * 100).toFixed(0)}%                 ${money(lb.feeOnLeverB)}`);
console.log(`  = REVENUE UPLIFT                         ${money(lb.revenueUplift)}`);
if (lb.calicheRange) console.log(`  + caliche contingency (range, bill actual) ${fmtMoney(lb.calicheRange[0])}–${fmtMoney(lb.calicheRange[1])}`);
console.log();
for (const w of lb.warnings) console.log('  ⚠ ' + w.replace(/(.{72}\S*)\s/g, '$1\n    '));
if (lb.unquantified.length) console.log(`  ⚠ Not estimable until entered: ${lb.unquantified.join(', ')}.`);

h('flags');
for (const f of t.flags) console.log(`  [${f.level}] ` + f.msg.replace(/(.{68}\S*)\s/g, '$1\n        '));
console.log();
