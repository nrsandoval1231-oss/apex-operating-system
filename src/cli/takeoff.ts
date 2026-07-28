/**
 * Headless takeoff report — the pilot slice.
 *
 *   node src/cli/takeoff.ts
 *
 * Prints geometry and excavation line by line with the formula and inputs
 * behind every number, so it can be reconciled against a hand calc.
 */

import { runTakeoff } from '../engine/index.ts';
import { renderCalc, type Calc } from '../engine/calc.ts';
import { STANDARD_MODEL } from '../engine/standardModel.ts';
import type { CodeCheck } from '../engine/codeChecks.ts';
import { EXAMPLE_DETAIL } from '../engine/standardDetail.ts';

// Defaults to the stored details. --example-detail swaps in the ILLUSTRATIVE
// one instead, and --no-detail exercises the refusal path.
const useExample = process.argv.includes('--example-detail');
const noDetail = process.argv.includes('--no-detail');
const r = runTakeoff(
  STANDARD_MODEL,
  useExample ? [EXAMPLE_DETAIL] : noDetail ? [] : undefined,
);

const rule = (s = '') => console.log(s ? `\n${s}\n${'-'.repeat(s.length)}` : '-'.repeat(78));
const line = (c: Calc) => console.log('  ' + renderCalc(c));

console.log(`${r.job.name}`);
console.log(`Jurisdiction: ${r.job.jurisdiction}`);
console.log(`Code basis:   ${r.codeBasis.edition} / ${r.codeBasis.ordinance}`);
console.log(`Amendments:   ${r.codeBasis.amendments}`);

rule('LUBBOCK AMENDMENT CHECKS');
for (const c of r.geometry.checks) printCheck(c);
console.log(
  `\n  Maximum depth allowed by the 1:1 setback on this site: ${r.geometry.maxAllowableDepthFt.toFixed(2)} ft`,
);

rule('GEOMETRY & VOLUME');
const g = r.geometry;
[
  g.poolPlanArea,
  g.poolPerimeter,
  g.poolSectionArea,
  g.poolGrossVolumeCf,
  ...g.stepDisplacement,
  ...g.seatDisplacement,
  g.poolNetVolumeCf,
  ...(g.spaVolumeCf ? [g.spaVolumeCf] : []),
  g.totalVolumeCf,
  g.totalVolumeGal,
  g.averageDepth,
  g.poolWettedArea,
  ...(g.spaWettedArea ? [g.spaWettedArea] : []),
  g.totalWettedArea,
  g.waterlinePerimeter,
].forEach(line);

for (const n of g.notes) console.log(`  [${n.severity}] ${n.message}`);

rule('EXCAVATION');
const x = r.excavation;
[x.excavationLength, x.excavationWidth, x.maxCutDepth, x.totalCutCf].forEach(line);

console.log('\n  Per layer:');
for (const l of x.layers) {
  console.log(`\n  ${l.layer.name}  (${l.bandTopFt.toFixed(2)} - ${l.bandBottomFt.toFixed(2)} ft below grade)`);
  [l.cutCf, l.bankCy, l.looseCy].forEach(line);
}

console.log('');
[
  x.totalBankCy,
  x.totalLooseCy,
  x.backfillVoidCf,
  x.backfillCompactedCy,
  x.backfillBankCy,
  x.backfillLooseCy,
  x.spoilHaulLooseCy,
  x.truckCount,
].forEach(line);

console.log('\n  Notes:');
for (const n of x.notes) console.log(`   - ${n}`);

rule('HYDRAULICS');
if (!r.hydraulics) {
  console.log('  No hydraulics inputs on this job.');
} else {
  const h = r.hydraulics;
  [h.flow.maxFlow, h.flow.minFlow, h.flow.turnoverFlow, h.flow.designFlow, h.flow.achievedTurnover].forEach(line);
  for (const c of h.flow.checks) console.log(`  [${c.status.toUpperCase()}] ${c.standard}: ${c.note}`);
  console.log('');
  for (const c of h.outletChecks) console.log(`  [${c.status.toUpperCase()}] ${c.standard}: ${c.note}`);
  [h.sofaRequirement, h.hydrostaticValves].forEach(line);
  console.log(`\n  Segments at ${h.systemFlowGpm.toFixed(1)} gpm (${h.systemFlowBasis}):`);
  for (const seg of h.runs) {
    const worst = seg.checks.some((c) => c.status === 'fail') ? 'FAIL' : seg.checks.some((c) => c.status === 'flag') ? 'FLAG' : 'PASS';
    console.log(`    [${worst}] ${seg.run.label.padEnd(26)} ${seg.size.padStart(4)} in  ${seg.velocity.value.toFixed(2).padStart(6)} fps  (${seg.governingCondition})`);
    for (const c of seg.checks) {
      console.log(`             ${c.status.toUpperCase().padEnd(9)} ${c.standard} — limit ${c.limitFps} fps`);
    }
  }
  console.log('');
  [...h.tdhBreakdown, h.tdh].forEach(line);
  console.log('');
  for (const c of h.operatingChecks) console.log(`  [${c.status.toUpperCase()}] ${c.standard}: ${c.note}`);
  for (const l of h.convergenceLog) console.log(`  ${l}`);
  console.log('\n  Notes:');
  for (const n of h.notes) console.log(`   - ${n}`);
}

rule('EQUIPMENT, GAS & PAD');
if (!r.equipment) {
  console.log('  No equipment inputs on this job.');
} else {
  const e = r.equipment;
  if (e.pump) {
    console.log(`  Pump selection — ${e.pump.basis}`);
    for (const c of e.pump.candidates) {
      const mark = c.model.id === e.pump.selected?.model.id ? '>>' : '  ';
      console.log(`   ${mark} ${(c.model.series + ' ' + c.model.id).padEnd(34)} ${String(c.model.totalHp).padStart(5)} THP  ${(c.speedRpm ? c.speedRpm + ' rpm' : '-').padStart(9)}  ${c.meetsDesignFlow ? 'MEETS' : '-'}`);
      console.log(`        ${c.note}`);
    }
  }
  if (e.gas) {
    console.log(`\n  GAS DEMAND (${e.gas.fuel})`);
    console.log(`  ${e.gas.disclaimer}`);
    [e.gas.heaterDemand, e.gas.heaterCfh, e.gas.totalConnectedLoadBtu, e.gas.totalConnectedLoadCfh, e.gas.developedLength].forEach(line);
    console.log(`  [${e.gas.meterCheck.status.toUpperCase()}] meter: ${e.gas.meterCheck.message}`);
    console.log(`  [${e.gas.intendedSize.label ?? 'NONE'}] shop standard: ${e.gas.intendedSize.message}`);
    console.log(`  [${e.gas.referenceSize.sizeLabel ?? 'NO SIZE'}] ${e.gas.referenceSize.message}`);
    for (const n of e.gas.notes) console.log(`   - ${n}`);
  }
  console.log('\n  EQUIPMENT PAD');
  [...e.pad.items.map((i) => i.footprint), e.pad.padLength, e.pad.padWidth, e.pad.padArea, e.pad.valveCount, e.pad.actuatorCount].forEach(line);
  for (const n of [...e.pad.notes, ...e.notes]) console.log(`   - ${n}`);
}

rule('STRUCTURE TAKEOFF');
if (r.structure.outcome === 'no-detail') {
  console.log(`  NO STANDARD DETAIL STORED — no structural quantities.`);
  console.log(`  ${r.structure.message}`);
  console.log(`  (run without --no-detail to use the stored detail)`);
} else if (r.structure.outcome === 'out-of-envelope') {
  console.log(`  OUT OF ENVELOPE — no structural quantities.`);
  console.log(`  ${r.structure.message}`);
} else {
  const q = r.structure.quantities;
  console.log(`  Detail: ${q.detail.name} (rev ${q.detail.versionDate})`);
  for (const f of q.envelope.findings) {
    console.log(`    [${f.ok ? 'PASS' : 'FAIL'}] ${f.dimension}: envelope ${f.limit}, job ${f.actual}`);
  }
  console.log('');
  [
    q.developedArea,
    q.shellVolume,
    q.coveVolume,
    q.bondBeamVolume,
    ...(q.damWallVolume ? [q.damWallVolume] : []),
    q.gunite.net,
    q.gunite.waste,
    q.gunite.ordered,
    q.guniteCy,
    q.barLinearFeet,
    q.bondBeamBarLf,
    q.barWeight,
    q.stockBars,
    q.tieCount,
    ...(q.pierVolume ? [q.pierVolume] : []),
  ].forEach(line);
  console.log('\n  Bar schedule:');
  for (const b of q.barSchedule) {
    console.log(`    ${b.family.padEnd(36)} ${String(b.count).padStart(4)} @ ${b.lengthFt.toFixed(2).padStart(7)} ft = ${(b.count * b.lengthFt).toFixed(1).padStart(8)} lf`);
  }
  console.log('\n  Notes:');
  for (const n of q.notes) console.log(`   - ${n}`);
}

rule();
console.log(
  r.hasCodeFailure
    ? 'RESULT: one or more Lubbock amendment checks FAILED. See above.'
    : 'RESULT: all Lubbock amendment checks passed.',
);
console.log('Quantities only. Not a permit submittal set and not a stamped engineering document.');

function printCheck(c: CodeCheck): void {
  const tag = c.status.toUpperCase().padEnd(4);
  console.log(`  [${tag}] ${c.section} — ${c.title}`);
  console.log(`         limit: ${c.governingLimit}`);
  console.log(`         actual: ${c.actual}`);
  if (c.status !== 'pass') console.log(`         ${c.message}`);
  if (c.compliancePath) console.log(`         path: ${c.compliancePath}`);
}
