/**
 * calibrate.mjs — back-solve the unit-cost library from Whitaker's known line dollars.
 *
 * Unit costs are not quoted rates; they are his dollars ÷ the quantity the engine computes.
 * So whenever geometry changes, every rate must be re-derived or the engine stops reproducing
 * the figures the customer actually saw. Travis confirming the spa at 6×6 (not the assumed
 * 7×7) is exactly that kind of change.
 *
 *   node calibrate.mjs
 */
import { takeoff, spaGeometry, combinedGeometry, poolGeometry, APEX_STANDARDS } from './engine.mjs';

// His actual estimate lines (reference/whitaker-oasis-quantity-takeoff.md §3).
const ACTUAL = {
  Excavation: 5500,
  Rebar: 4000,
  Gunite: 12000,
  'Waterline Tile': 1950,
  Coping: 7550,
  Bonding: 250,
  'Pool Deck': 5000,
  plasterMaterial: 3750,
  plasterLabor: 5000,
};

// `spa: {}` opts the job into a spa and lets APEX_STANDARDS supply its dimensions — a spa is
// standard-sized when present, but not every pool has one, so it stays opt-in.
const WHITAKER = { length: 24, width: 14, spa: {} }; // standards supply depth, spa dims and deck

const oldGeo = combinedGeometry({ ...WHITAKER, avgDepth: 4.75, spa: { length: 7, width: 7, depth: 3.5 } });
const newGeo = combinedGeometry({ ...WHITAKER, spa: APEX_STANDARDS.spa });

console.log('\nGEOMETRY — assumed 7×7 spa vs confirmed 6×6\n' + '─'.repeat(66));
const cmp = (label, a, b, unit) =>
  console.log(`  ${label.padEnd(16)} ${a.toFixed(0).padStart(8)} → ${b.toFixed(0).padStart(8)} ${unit.padEnd(7)} ${(((b - a) / a) * 100).toFixed(1)}%`);
cmp('wetted area', oldGeo.wettedArea, newGeo.wettedArea, 'sq ft');
cmp('perimeter', oldGeo.perimeter, newGeo.perimeter, 'LF');
cmp('gallons', oldGeo.gallons, newGeo.gallons, 'gal');

const t = takeoff(WHITAKER);
const line = (n) => t.lines.find((l) => l.name.includes(n));

console.log('\nUNIT COSTS — back-solved against the corrected quantities\n' + '─'.repeat(66));
console.log('  line                  his $       qty  unit            derived rate');
console.log('─'.repeat(66));

const rows = [];
for (const [name, dollars] of Object.entries(ACTUAL)) {
  if (name.startsWith('plaster')) continue;
  const l = line(name);
  if (!l) { console.log(`  ${name} — NO LINE`); continue; }
  const rate = dollars / l.qty;
  rows.push([name, rate, l.unit]);
  console.log(`  ${name.padEnd(20)} ${String(dollars).padStart(6)} ${String(l.qty).padStart(9)}  ${l.unit.padEnd(14)} ${rate.toFixed(2).padStart(8)}`);
}

const pl = line('Plaster');
const bags = pl.extra.bags;
const matRate = ACTUAL.plasterMaterial / bags;
const laborRate = ACTUAL.plasterLabor / pl.qty;
console.log(`  ${'Plaster material'.padEnd(20)} ${String(ACTUAL.plasterMaterial).padStart(6)} ${String(bags).padStart(9)}  ${'bags'.padEnd(14)} ${matRate.toFixed(2).padStart(8)}`);
console.log(`  ${'Plaster labor'.padEnd(20)} ${String(ACTUAL.plasterLabor).padStart(6)} ${String(pl.qty).padStart(9)}  ${'sq ft'.padEnd(14)} ${laborRate.toFixed(2).padStart(8)}`);

console.log('\nSANITY vs published ranges (reference §4)\n' + '─'.repeat(66));
const gunite = ACTUAL.Gunite / line('Gunite').qty;
const plasterBag = matRate;
console.log(`  Gunite   $${gunite.toFixed(0)}/yd³   published $350–600   ${gunite >= 350 && gunite <= 600 ? '✓ inside' : '⚠ OUTSIDE'}`);
console.log(`  Plaster  $${plasterBag.toFixed(0)}/bag   Diamond Brite ~$85   ${plasterBag >= 70 && plasterBag <= 105 ? '✓ plausible' : '⚠ OUTSIDE'}`);
const deck = ACTUAL['Pool Deck'] / line('Pool Deck').qty;
console.log(`  Deck     $${deck.toFixed(2)}/sq ft  published $12–18     ${deck >= 12 && deck <= 18 ? '✓ inside' : '⚠ OUTSIDE'}`);
console.log(`           (${line('Pool Deck').qty} sq ft from the 4 ft border rule; ref §1000 back-solved 280–415)\n`);
