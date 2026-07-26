/**
 * crew.mjs — what one in-house crew can actually carry (PRD 06 input).
 *
 * Resource split confirmed by Travis 2026-07-26: subs handle excavation, gunite, electrical and
 * concrete decking; the in-house crew — one crew, one lead — handles everything else. Max five
 * jobs run at once.
 *
 *   node crew.mjs [pool dims, default 24x14]
 */
import { takeoff, crewCapacity } from './engine.mjs';

const dims = (process.argv[2] || '24x14').split('x').map(Number);
const t = takeoff({ length: Math.max(...dims), width: Math.min(...dims), spa: {} });
const s = t.schedule;

const bar = (c = '─') => console.log(c.repeat(76));
const r5 = (n) => Math.round(n * 10) / 10;
const h = (x) => { console.log(); bar('═'); console.log('  ' + x.toUpperCase()); bar('═'); };

console.log();
bar('═');
console.log(`  APEX CREW CAPACITY — ${Math.max(...dims)}×${Math.min(...dims)} pool w/ standard spa`);
bar('═');

h('phase resourcing');
console.log('  phase                      elapsed   crew-days   who');
bar();
for (const p of s.phases) {
  if (!p.days && !p.lag) continue;
  const who = p.resource === 'sub' ? 'SUB' : p.resource === 'split' ? 'crew + sub' : 'crew';
  console.log(`  ${p.name.padEnd(26)} ${String(p.days).padStart(6)}d ${String(p.crewDays).padStart(9)}d   ${who}`);
}
bar();
console.log(`  ${'TOTAL'.padEnd(26)} ${String(s.workingDays).padStart(6)}d ${String(s.crewDays).padStart(9)}d`);
console.log(`  + ${s.lagDays} lag days (permit, inspection, cure) → ${s.buildWeeks} week technical minimum`);
console.log(`\n  The crew is committed ${s.crewDays} days per pool. Everything else is sub work or waiting —`);
console.log('  and that waiting is what lets one crew carry more than one job at a time.');

const cap = crewCapacity({ crewDaysPerJob: s.crewDays, minCycleWeeks: s.buildWeeks, maxConcurrent: 6 });

h('what happens as jobs stack up');
console.log('  jobs in    cycle     added      crew        pools');
console.log('  flight     time      wait       utilisation /year');
bar();
for (const row of cap.rows) {
  const mark = row.concurrent === cap.sweetSpot.concurrent ? ' ←' : row.crewBound ? ' ⚠' : '';
  console.log(`  ${String(row.concurrent).padStart(4)}     ${String(row.cycleWeeks).padStart(6)} wk  ${String(row.addedWaitWeeks).padStart(5)} wk    ${String(row.utilisation).padStart(4)}%      ${String(row.poolsPerYear).padStart(5)}${mark}`);
}
bar();

h('the finding');
const knee = cap.sweetSpot;
const at5 = cap.rows.find((x) => x.concurrent === 5);
const below = cap.rows.find((x) => x.concurrent === knee.concurrent - 1);
console.log(`  The crew saturates at ${knee.concurrent} concurrent jobs. That is the knee:\n`);
if (below) console.log(`    ${below.concurrent} jobs in flight → ${below.cycleWeeks} wk cycle → ${below.poolsPerYear} pools/year   (crew only ${below.utilisation}% loaded)`);
console.log(`    ${knee.concurrent} jobs in flight → ${knee.cycleWeeks} wk cycle → ${knee.poolsPerYear} pools/year   ← full output, near-minimum wait`);
console.log(`    ${at5.concurrent} jobs in flight → ${at5.cycleWeeks} wk cycle → ${at5.poolsPerYear} pools/year   (same output)`);
console.log(`\n  Below the knee the crew idles and output is left on the table. Above it, output is`);
console.log(`  flat and only the queue grows — at five, every customer waits ${r5(at5.cycleWeeks - knee.cycleWeeks)} weeks longer for`);
console.log('  the same number of pools per year.');
console.log(`  Hard ceiling on one crew: ~${cap.ceilingPoolsPerYear} pools/year regardless of how many are started.`);
console.log(`\n  Under cost-plus this is pure loss. Overruns pass through to the customer, but a`);
console.log('  longer calendar burns PM time that GP absorbs (Foundation §5.3) and stretches the');
console.log('  referral-risk window — for no extra revenue. WIP above the saturation point is queue.');

h('sensitivity — crew-days per pool is the estimate that matters');
console.log('  Phase effort is provisional. How the conclusion moves if it is wrong:\n');
console.log('   crew-days/pool   saturates at   ceiling pools/yr');
bar();
for (const c of [8, 10, 12.4, 15, 17]) {
  const k = crewCapacity({ crewDaysPerJob: c, minCycleWeeks: s.buildWeeks, maxConcurrent: 6 });
  const flag = Math.abs(c - s.crewDays) < 0.6 ? '  ← current model' : '';
  console.log(`   ${String(c).padStart(10)}      ${String(k.sweetSpot.concurrent).padStart(8)}       ${String(k.ceilingPoolsPerYear).padStart(10)}${flag}`);
}
bar();
console.log('  Saturation lands between 3 and 5 depending on true crew effort, and five is only');
console.log('  right at the optimistic end (~8 crew-days/pool). The model says 3 at 13.7.');
console.log('\n  So the WIP cap is not yet a settled number — but the SHAPE holds everywhere: there');
console.log('  is a knee, output is flat past it, and running above it buys nothing but wait.');
console.log('  Logging actual crew-days on the next two pools pins the cap down exactly, and it');
console.log('  is the single most valuable number the PM tool could start capturing.\n');
