/**
 * backtest.mjs — model vs his real estimate, by cost code (PRD 02 Milestone 4).
 *
 * The gate is "within 10%". This is the first run where that means anything: the actual line
 * schedule is known, so nothing is back-solved and nothing is circular.
 *
 *   node backtest.mjs
 */
import { takeoff, fmtMoney, COST_CODES } from './engine.mjs';
import { WHITAKER_ACTUAL, JOB_COST, ALLOWANCE_TOTAL, DISCLOSED } from './whitaker-actual.mjs';

const t = takeoff({ length: 24, width: 14, spa: {} });

// He books Bonding under 400 Pool Shell; the engine puts it in 500 Utilities. Reclassify so the
// comparison is like for like — a structural difference is not a pricing error.
const RECLASS = { 500: 400 };
const modelByCode = {};
for (const l of t.lines) {
  const code = RECLASS[l.code] ?? l.code;
  modelByCode[code] = (modelByCode[code] || 0) + l.extended;
}
// His estimate files the allowances INSIDE cost codes (turf under 1000 Pool Deck, fence under
// 1300). The engine keeps them in a separate bucket, so map them back for a like-for-like read.
const ALLOWANCE_CODE = { 'Turf Budget': 1000, 'Fence Budget': 1300, 'Concrete Diamonds Budget': 1000 };
for (const a of t.allowances) {
  const code = ALLOWANCE_CODE[a.name];
  if (code) modelByCode[code] = (modelByCode[code] || 0) + a.amount;
}

const name = (c) => COST_CODES.find((x) => x.code === c)?.name ?? String(c);
const pad = (s, n) => String(s).padEnd(n);
const num = (n) => fmtMoney(n).padStart(13);

console.log('\n' + '='.repeat(84));
console.log('  WHITAKER OASIS — MODEL vs ACTUAL, BY COST CODE');
console.log('='.repeat(84));
console.log('  code  category                    model         actual      variance   note');
console.log('-'.repeat(84));

let modelled = 0, actualModelled = 0;
const gaps = [];

for (const sec of WHITAKER_ACTUAL) {
  const actual = sec.lines.reduce((s, l) => s + l.amount, 0);
  const model = modelByCode[sec.code] ?? 0;
  const covered = model > 0;
  if (covered) { modelled += model; actualModelled += actual; }
  const v = covered ? model - actual : null;
  const pct = covered && actual ? (v / actual) * 100 : null;
  const flag = !covered ? 'not modelled — direct entry'
    : Math.abs(pct) < 0.5 ? 'exact'
    : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  console.log(`  ${pad(sec.code, 5)} ${pad(sec.section, 24)} ${covered ? num(model) : pad('—', 13)} ${num(actual)} ${covered ? num(v) : pad('', 13)}   ${flag}`);
  if (covered && Math.abs(v) > 1) {
    const missing = sec.lines.filter((l) => /forming|labor|cleanup|backfill/i.test(l.name));
    if (missing.length) gaps.push({ code: sec.code, v, missing });
  }
}

console.log('-'.repeat(84));
console.log(`  ${pad('', 5)} ${pad('JOB COST', 24)} ${num(t.jobCost)} ${num(JOB_COST)}`);
console.log(`  ${pad('', 5)} ${pad('modelled codes only', 24)} ${num(modelled)} ${num(actualModelled)} ${num(modelled - actualModelled)}   ${(((modelled - actualModelled) / actualModelled) * 100).toFixed(1)}%`);

const gate = Math.abs((modelled - actualModelled) / actualModelled) <= 0.1;
console.log(`\n  MILESTONE 4 GATE (within 10%, modelled codes): ${gate ? '✓ PASS' : '✗ FAIL'}  `
  + `${(((modelled - actualModelled) / actualModelled) * 100).toFixed(1)}%`);

console.log('\n' + '='.repeat(84));
console.log('  WHAT THE MODEL DOES NOT ACCOUNT FOR');
console.log('='.repeat(84));
for (const g of gaps) {
  console.log(`  ${g.code} ${name(g.code)} — off by ${fmtMoney(g.v)}:`);
  for (const l of g.missing) console.log(`      ${fmtMoney(l.amount).padStart(12)}  ${l.name}`);
}

console.log('\n' + '='.repeat(84));
console.log('  STRUCTURAL FINDINGS');
console.log('='.repeat(84));
const deck = WHITAKER_ACTUAL.find((s) => s.code === 1000);
console.log(`  1000 Pool Deck is ${fmtMoney(deck.lines.reduce((s, l) => s + l.amount, 0))} and 100% upgrade budgets —`);
console.log('       there is NO deck construction line anywhere on the estimate. The 4 ft border');
console.log('       concrete is either unpriced or buried. The $13.59/sq ft seed was derived from');
console.log('       "Concrete Diamonds Budget", a decorative UPGRADE, not base deck construction.');
console.log(`\n  Allowances total ${fmtMoney(ALLOWANCE_TOTAL)} (${((ALLOWANCE_TOTAL / JOB_COST) * 100).toFixed(1)}% of job cost), all marked "Upgrade":`);
console.log('       Concrete Diamonds $5,000 · Turf $5,000 · Fence $7,000');
console.log('\n  Plumbing is split across two cost codes: 500 Utilities "Plumber" $5,000 and');
console.log('       700 Pool Plumbing $8,100 = $13,100 total. 700 is now parametric (pad-distance');
console.log('       + spa jet loop, ref §3.6); 500\'s "Plumber $5,000" is a flat labor figure with');
console.log('       no component list, so it stays direct-entry.');
console.log(`\n  100 Permits is a live line item at ${fmtMoney(0)} — confirmed, still unexplained.`);

console.log('\n' + '='.repeat(84));
console.log('  PRICING CHECK');
console.log('='.repeat(84));
console.log(`  Job cost                  ${num(JOB_COST)}`);
console.log(`  Disclosed fee @ 30%       ${num(DISCLOSED.fee)}   (engine: ${fmtMoney(JOB_COST * 0.3)})`);
console.log(`  Customer total            ${num(DISCLOSED.total)}   (engine: ${fmtMoney(JOB_COST * 1.3)})`);
console.log(`  TRUE gross margin              ${((DISCLOSED.fee / DISCLOSED.total) * 100).toFixed(2)}%   ← the 30% is markup, not margin\n`);
