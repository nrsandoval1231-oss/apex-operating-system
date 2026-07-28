/**
 * Renders the takeoff sheet to a standalone HTML file.
 *
 *   node src/cli/renderSheet.ts <out.html>
 *
 * Same engine, same numbers as the app and the CLI report — nothing here is
 * transcribed by hand. Self-contained and responsive so it can be read on a
 * phone; the print stylesheet for 11x17 is still step 10.
 */

import { writeFileSync } from 'node:fs';
import { runTakeoff, type TakeoffResult } from '../engine/index.ts';
import type { Calc } from '../engine/calc.ts';
import type { CodeCheck } from '../engine/codeChecks.ts';
import { STANDARD_MODEL } from '../engine/standardModel.ts';
import {
  APEX_STANDARD_DETAIL,
  type EnvelopeMatch,
  type StandardDetail,
} from '../engine/standardDetail.ts';
import { EXAMPLE_CURVE } from '../engine/pumpCatalog.ts';
import type { StructureResult } from '../engine/structure.ts';
import type { HydraulicsResult, RunResult, VelocityCheck } from '../engine/hydraulics.ts';
import type { CoverResult } from '../engine/cover.ts';
import type { EquipmentResult } from '../engine/equipment.ts';
import type { FinishesResult } from '../engine/finishes.ts';
import type { YardResult } from '../engine/yard.ts';
import type { NetAndWaste } from '../engine/calc.ts';
import { planPrintScale, renderPlanView } from '../engine/planView.ts';
import { WHITAKER } from '../engine/jobs/whitaker.ts';
import type { Job } from '../engine/types.ts';

const TIGHT_LOT: Job = {
  ...STANDARD_MODEL,
  name: 'Standard model on a tight lot',
  site: { distanceToFoundationFt: 5, foundationDescription: 'house slab foundation' },
};

const DEEP: Job = {
  ...STANDARD_MODEL,
  name: 'Deep job — 9 ft, outside the detail envelope',
  pool: { ...STANDARD_MODEL.pool, profile: { ...STANDARD_MODEL.pool.profile, deepDepth: 9 } },
  site: { distanceToFoundationFt: 12, foundationDescription: 'house slab foundation' },
};

/**
 * The real scenarios carry no detail on purpose — no detail means no structural
 * quantities. The example-detail scenarios exercise the quantity math and the
 * envelope refusal, and are labeled as not buildable.
 */
const JOBS: readonly { tab: string; job: Job; details: readonly StandardDetail[] }[] = [
  { tab: 'Standard model', job: STANDARD_MODEL, details: [APEX_STANDARD_DETAIL] },
  { tab: 'Whitaker (built)', job: WHITAKER, details: [APEX_STANDARD_DETAIL] },
  { tab: 'Tight lot · 5 ft', job: TIGHT_LOT, details: [APEX_STANDARD_DETAIL] },
  { tab: 'No detail stored', job: STANDARD_MODEL, details: [] },
  {
    tab: 'Cover as barrier',
    job: {
      ...STANDARD_MODEL,
      name: 'Standard model with a powered safety cover as the barrier',
      cover: {
        // ILLUSTRATIVE. Vault dimensions come off the manufacturer's published
        // spec sheet by cover size; these are not from any real sheet.
        manufacturer: 'EXAMPLE',
        model: 'illustrative cover — not a product',
        specSource: 'PLACEHOLDER — no spec sheet has been read',
        specRevisionDate: '0000-00-00 (placeholder)',
        vaultLengthFt: 3,
        vaultWidthFt: 16,
        vaultDepthFt: 2,
        bondBeamDropIn: 2,
        trackLengthFt: 30,
        astmF1346Listed: true,
        servesAsBarrier: true,
      },
    },
    details: [APEX_STANDARD_DETAIL],
  },
  {
    tab: 'With example curve',
    job: {
      ...STANDARD_MODEL,
      name: 'Standard model with an illustrative pump curve',
      hydraulics: { ...STANDARD_MODEL.hydraulics!, pumpCurve: EXAMPLE_CURVE },
    },
    details: [APEX_STANDARD_DETAIL],
  },
  { tab: 'Outside envelope', job: DEEP, details: [APEX_STANDARD_DETAIL] },
];

// --- formatting -------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function num(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  const d = abs >= 1000 ? 2 : abs >= 1 ? 4 : 5;
  return Number(n.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d });
}

const num1 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

// --- fragments --------------------------------------------------------------

function calcRow(c: Calc, emphasis: boolean): string {
  const inputs = c.inputs
    .map((i) => `<span class="i"><b>${esc(i.symbol)}</b>=${num(i.value)}&nbsp;${esc(i.unit)}</span>`)
    .join('<span class="sep">,</span> ');
  const notes = (c.notes ?? []).map((n) => `<p class="rnote">${esc(n)}</p>`).join('');
  return `<div class="row${emphasis ? ' em' : ''}">
      <div class="r-label">${esc(c.label)}${c.source ? `<span class="r-src">${esc(c.source)}</span>` : ''}</div>
      <div class="r-formula"><span class="k">formula</span>${esc(c.formula)}</div>
      <div class="r-inputs"><span class="k">inputs</span>${inputs}${notes}</div>
      <div class="r-value"><span class="v">${num(c.value)}</span><span class="u">${esc(c.unit)}</span></div>
    </div>`;
}

function calcBlock(calcs: readonly Calc[], emphasize: readonly string[] = []): string {
  return `<div class="rows">${calcs.map((c) => calcRow(c, emphasize.includes(c.id))).join('')}</div>`;
}

function checkCard(c: CodeCheck): string {
  return `<div class="check ${c.status}">
      <div class="check-top">
        <span class="chip ${c.status}">${c.status.toUpperCase()}</span>
        <span class="check-sec">${esc(c.section.split(' ')[0] ?? '')}</span>
        <span class="check-title">${esc(c.title)}</span>
      </div>
      <div class="check-limits">
        <div><span class="k">limit</span>${esc(c.governingLimit)}</div>
        <div><span class="k">actual</span>${esc(c.actual)}</div>
      </div>
      ${c.status !== 'pass' ? `<p class="check-msg">${esc(c.message)}</p>` : ''}
      ${c.compliancePath ? `<p class="check-path"><b>Compliance path</b> ${esc(c.compliancePath)}</p>` : ''}
    </div>`;
}


function envelopeTable(m: EnvelopeMatch): string {
  return `<h3 class="sub">${esc(m.detail.name)} <span>rev ${esc(m.detail.versionDate)}</span></h3>
    <div class="checks">${m.findings
      .map(
        (f) => `<div class="check ${f.ok ? 'pass' : 'fail'}">
          <div class="check-top"><span class="chip ${f.ok ? 'pass' : 'fail'}">${f.ok ? 'PASS' : 'FAIL'}</span>
          <span class="check-title">${esc(f.dimension)}</span></div>
          <div class="check-limits"><div><span class="k">envelope</span>${esc(f.limit)}</div>
          <div><span class="k">job</span>${esc(f.actual)}</div></div>
        </div>`,
      )
      .join('')}</div>
    <div class="notes"><ul>${m.confirmations.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
}

function structureHtml(st: StructureResult): string {
  const head = `<h2 class="sec">3 · Structure takeoff<span>reads a stored standard detail · designs nothing</span></h2>`;

  if (st.outcome === 'no-detail') {
    return `${head}<div class="stop"><h2>No standard detail stored — no structural quantities</h2><p>${esc(st.message)}</p></div>`;
  }
  if (st.outcome === 'out-of-envelope') {
    return `${head}<div class="stop"><h2>Out of envelope — no structural quantities</h2><p>${esc(st.message)}</p></div>
      ${st.attempts.map(envelopeTable).join('')}`;
  }

  const q = st.quantities;
  const d = q.detail;
  return `${head}
    ${
      d.envelopeConfirmed
        ? ''
        : `<div class="stop"><h2>Envelope not confirmed</h2><p>The depth range and plan limits on ${esc(d.id)} were assumed, not stated. Quantities below are real, but the boundary that decides whether this detail covers a job has not been agreed.</p></div>`
    }
    ${envelopeTable(q.envelope)}
    <h3 class="sub">Detail as entered <span>${d.shellThicknessIn} in shell · ${d.barSize} at ${d.barSpacingIn} in o.c. each way · ${d.stressPointSpacingIn} in at coves · bond beam ${d.bondBeamWidthIn}×${d.bondBeamDepthIn} in with ${d.bondBeamBarCount} × ${d.bondBeamBarSize} · ${d.gunitePsi} psi</span></h3>
    <h3 class="sub">Gunite</h3>
    ${calcBlock(
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
      ],
      [q.guniteCy.id],
    )}
    <h3 class="sub">Reinforcement</h3>
    ${calcBlock([q.barLinearFeet, q.bondBeamBarLf, q.barWeight, q.stockBars, q.tieCount], [q.stockBars.id])}
    <h3 class="sub">Bar schedule <span>${num1(q.cutPlan.requiredLf)} lf required · ${q.cutPlan.stockBars} × ${q.cutPlan.stockLengthFt} ft stock · ${num1(q.cutPlan.dropLf)} lf drop (${(q.cutPlan.dropPct * 100).toFixed(1)}%) · ${q.cutPlan.splices} splices</span></h3>
    <div class="bars">${q.barSchedule
      .map(
        (b) => `<div class="bar"><span class="bar-fam">${esc(b.family)}</span>
          <span class="bar-n">${b.count} @ ${num(b.lengthFt)} ft</span>
          <span class="bar-t">${num(b.count * b.lengthFt)} lf</span></div>`,
      )
      .join('')}</div>
    ${q.pierVolume ? `<h3 class="sub">Piers</h3>${calcBlock([q.pierVolume])}` : ''}
    <div class="notes"><span class="k">Notes</span><ul>${q.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}


function checkLine(c: VelocityCheck): string {
  return `<div class="check ${c.status}">
    <div class="check-top"><span class="chip ${c.status}">${c.status.toUpperCase()}</span>
    <span class="check-title">${esc(c.standard)}</span></div>
    <p class="check-msg">${esc(c.note)}</p></div>`;
}

function runBlock(r: RunResult): string {
  const worst = r.checks.some((c) => c.status === 'fail')
    ? 'fail'
    : r.checks.some((c) => c.status === 'flag')
      ? 'flag'
      : 'pass';
  return `<div class="check">
    <div class="check-top">
      <span class="chip ${worst}">${worst.toUpperCase()}</span>
      <span class="check-title">${esc(r.run.label)}</span>
      <span class="check-sec">${r.size} in Sch 40 · ${num(r.normalFlowGpm)} gpm normal · ${num(r.governingFlowGpm)} gpm governing</span>
    </div>
    <div class="check-limits"><div><span class="k">condition</span>${esc(r.governingCondition)}</div>
    <div><span class="k">velocity</span>${num(r.velocity.value)} fps</div></div>
    <div class="run-checks">${r.checks
      .map((c) => `<span class="run-check ${c.status}"><b>${c.status.toUpperCase()}</b> ${esc(c.standard)} — limit ${c.limitFps} fps</span>`)
      .join('')}</div>
    ${calcBlock([r.velocity, r.equivalentLength, r.frictionLoss])}
  </div>`;
}

function hydraulicsHtml(h: HydraulicsResult | null): string {
  if (!h) return '';
  return `<h2 class="sec">4 · Hydraulics<span>flow → size → TDH → pump curve → actual flow → re-check · ${esc(h.systemFlowBasis)}${h.pumpModel ? ` · ${esc(h.pumpModel.manufacturer)} ${esc(h.pumpModel.series)} ${esc(h.pumpModel.id)}, ${h.pumpModel.totalHp} THP` : ''}</span></h2>
    <h3 class="sub">Design flow</h3>
    ${calcBlock([h.flow.maxFlow, h.flow.minFlow, h.flow.turnoverFlow, h.flow.designFlow, h.flow.achievedTurnover], [h.flow.designFlow.id])}
    ${h.flow.checks.map(checkLine).join('')}
    <h3 class="sub">Suction outlets <span>required cover rating ${num1(h.sofaRequirement.value)} gpm each</span></h3>
    ${h.outletChecks.map(checkLine).join('')}
    ${calcBlock([h.sofaRequirement, h.hydrostaticValves])}
    <h3 class="sub">Segments <span>velocity at ${num1(h.systemFlowGpm)} gpm system flow</span></h3>
    <div class="checks">${h.runs.map(runBlock).join('')}</div>
    <h3 class="sub">Total dynamic head</h3>
    ${calcBlock([...h.tdhBreakdown, h.tdh], [h.tdh.id])}
    ${
      h.speedOptions.length
        ? `<h3 class="sub">Variable-speed options <span>${
            h.selectedSpeed ? `running at ${h.selectedSpeed.rpm} rpm` : 'no published speed meets design flow'
          }${h.recommendedRpm ? ` · set near ${h.recommendedRpm} rpm` : ''}</span></h3>
      <div class="bars">${h.speedOptions
        .map(
          (o) => `<div class="bar"><span class="bar-fam">${o.rpm} rpm${
            o.rpm === h.selectedSpeed?.rpm ? ' — selected' : ''
          }</span><span class="bar-n">${
            o.operatingPoint ? `${num1(o.operatingPoint.gpm)} gpm @ ${num1(o.operatingPoint.headFt)} ft` : 'no crossing'
          }</span><span class="bar-t">${o.meetsDesignFlow ? 'meets' : '—'}</span></div>`,
        )
        .join('')}</div>
      ${h.speedSelectionNote ? `<div class="notes"><p>${esc(h.speedSelectionNote)}</p></div>` : ''}`
        : ''
    }
    <h3 class="sub">Operating point${h.operatingPoint ? ` <span>${num1(h.operatingPoint.gpm)} gpm at ${num1(h.operatingPoint.headFt)} ft · ${h.iterations} iteration${h.iterations === 1 ? '' : 's'}</span>` : ''}</h3>
    ${h.operatingChecks.map(checkLine).join('')}
    ${
      h.operatingPoint
        ? `<div class="notes"><p>${esc(h.operatingPointNote)}</p><ul>${h.convergenceLog.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`
        : `<div class="stop"><h2>No pump curve — no operating point</h2><p>${esc(h.operatingPointNote)}</p></div>`
    }
    ${h.installationRequirements.length ? `<div class="notes"><span class="k">Manufacturer installation requirements</span><ul>${h.installationRequirements.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
    <div class="notes"><span class="k">Notes</span><ul>${h.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}


function codeCheckCards(checks: readonly CodeCheck[]): string {
  return `<div class="checks">${checks.map(checkCard).join('')}</div>`;
}

function wasteBlock(q: NetAndWaste): string {
  return calcBlock([q.net, q.waste, q.ordered], [q.ordered.id]);
}

function coverHtml(c: CoverResult | null): string {
  if (!c) return '';
  return `<h2 class="sec">5 · Cover<span>an input that constrains the shell, not a downstream selection</span></h2>
    ${
      c.barrierPath === 'non-compliant'
        ? `<div class="stop"><h2>No valid barrier path</h2><p>${esc(c.barrierPathLabel)}</p></div>`
        : `<div class="notes"><p><b>Barrier compliance path:</b> ${esc(c.barrierPathLabel)}</p></div>`
    }
    ${codeCheckCards(c.checks)}
    <h3 class="sub">Quantities <span>${esc(c.cover.manufacturer)} ${esc(c.cover.model)} · spec rev ${esc(c.cover.specRevisionDate)}</span></h3>
    ${calcBlock([c.vaultVolume, c.trackLf, c.bondBeamDrop])}
    <div class="notes"><span class="k">Constraints this cover puts on the shell</span><ul>${c.shellConstraints
      .map((x) => `<li>${esc(x)}</li>`)
      .join('')}</ul></div>
    <div class="notes"><ul>${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}

function finishesHtml(f: FinishesResult | null): string {
  if (!f) return '';
  return `<h2 class="sec">6 · Finishes<span>waste shown as its own line, never folded into net</span></h2>
    <h3 class="sub">Waterline tile</h3>
    ${wasteBlock(f.waterlineTileLf)}
    ${calcBlock([f.waterlineTileSf])}
    <h3 class="sub">Coping</h3>
    ${wasteBlock(f.copingLf)}
    ${calcBlock([f.copingPieces], [f.copingPieces.id])}
    <h3 class="sub">Plaster</h3>
    ${wasteBlock(f.plasterSf)}
    <h3 class="sub">Leading-edge contrast stripe <span>Lubbock amended 411.5.1 / 411.5.2 — 1 in minimum, contrasting and slip-resistant</span></h3>
    ${wasteBlock(f.contrastStripeLf)}
    ${calcBlock([f.contrastStripeSf])}
    ${f.notes.length ? `<div class="notes"><span class="k">Notes</span><ul>${f.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}`;
}

function yardHtml(y: YardResult | null): string {
  if (!y) return '';
  return `<h2 class="sec">7 · Yard &amp; drainage<span>${esc(y.compliancePath)} · ${num1(y.fallAcrossDeck.value)} in of fall across the deck</span></h2>
    ${calcBlock([y.deckArea, y.deckPerimeter, y.fallAcrossDeck, y.deckDrainLf, y.gradeTransitions], [y.deckArea.id])}
    <h3 class="sub">Deck slope, ISPSC 306.5</h3>
    ${codeCheckCards(y.checks)}
    <div class="notes"><ul>${y.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}


function equipmentHtml(e: EquipmentResult | null): string {
  if (!e) return '';
  const { pump, gas, pad } = e;
  return `<h2 class="sec">8 · Equipment, gas demand &amp; pad<span>pump matched to the converged operating point</span></h2>
    ${
      pump
        ? `<h3 class="sub">Pump selection <span>${esc(pump.basis)}</span></h3>
      <div class="bars">${pump.candidates
        .map(
          (c) => `<div class="bar"><span class="bar-fam">${esc(c.model.series)} ${esc(c.model.id)}${
            c.model.id === pump.selected?.model.id ? ' — selected' : ''
          }<br><span style="color:var(--faint);font-size:11px">${esc(c.note)}</span></span>
          <span class="bar-n">${c.speedRpm ? `${c.speedRpm} rpm` : '—'}</span>
          <span class="bar-t">${c.meetsDesignFlow ? 'meets' : '—'}</span></div>`,
        )
        .join('')}</div>`
        : ''
    }
    ${
      gas
        ? `<h3 class="sub">Gas demand <span>${esc(gas.fuel)}</span></h3>
      <div class="stop"><h2>Demand calculation — not a gas design</h2><p>${esc(gas.disclaimer)}</p></div>
      ${calcBlock(
        [gas.heaterDemand, gas.heaterCfh, gas.totalConnectedLoadBtu, gas.totalConnectedLoadCfh, gas.developedLength],
        [gas.totalConnectedLoadCfh.id],
      )}
      <div class="checks">
        <div class="check"><div class="check-top"><span class="chip ${
          gas.meterCheck.status === 'pass' ? 'pass' : gas.meterCheck.status === 'fail' ? 'fail' : 'guidance'
        }">${gas.meterCheck.status.toUpperCase()}</span><span class="check-title">Meter capacity</span></div>
        <p class="check-msg">${esc(gas.meterCheck.message)}</p></div>
        <div class="check"><div class="check-top"><span class="chip ${
          gas.intendedSize.status === 'confirmed' ? 'pass' : gas.intendedSize.status === 'too-small' ? 'fail' : 'guidance'
        }">${esc(gas.intendedSize.label ?? 'NONE')}</span><span class="check-title">Shop-standard size</span></div>
        <p class="check-msg">${esc(gas.intendedSize.message)}</p></div>
        <div class="check"><div class="check-top"><span class="chip ${
          gas.referenceSize.sizeLabel ? 'pass' : 'guidance'
        }">${esc(gas.referenceSize.sizeLabel ?? 'NO SIZE')}</span><span class="check-title">Reference size, dedicated run</span></div>
        <p class="check-msg">${esc(gas.referenceSize.message)}</p></div>
      </div>
      <div class="notes"><ul>${gas.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`
        : ''
    }
    <h3 class="sub">Equipment pad <span>${num1(pad.padLength.value)} × ${num1(pad.padWidth.value)} ft · ${num1(pad.distanceFromPool.value)} ft from the pool</span></h3>
    ${pad.impossibleRuns
      .map(
        (m) => `<div class="check fail"><div class="check-top"><span class="chip fail">FAIL</span><span class="check-title">Run shorter than the distance to the pad</span></div><p class="check-msg">${esc(m)}</p></div>`,
      )
      .join('')}
    ${calcBlock(
      [pad.distanceFromPool, ...pad.items.map((i) => i.footprint), pad.padLength, pad.padWidth, pad.padArea, pad.valveCount, pad.actuatorCount],
      [pad.padArea.id],
    )}
    <div class="notes"><ul>${[...pad.notes, ...e.notes].map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
}

function sheet(r: TakeoffResult): string {
  const { geometry: g, excavation: x } = r;
  const plan = renderPlanView(r.job, 1040);
  const scale = planPrintScale(plan);

  const layers = x.layers
    .map(
      (l) => `<h3 class="sub">${esc(l.layer.name)}
        <span>${num1(l.bandTopFt)}–${num1(l.bandBottomFt)} ft below grade · swell ${(l.layer.swellFactor * 100).toFixed(0)}% · yield ${(l.layer.compactionYield * 100).toFixed(0)}%</span></h3>
      ${calcBlock([l.cutCf, l.bankCy, l.looseCy], [l.looseCy.id])}`,
    )
    .join('');

  return `<section class="sheet">
    <header class="head">
      <div>
        <h1>${esc(r.job.name)}</h1>
        <p class="sub-title">Materials takeoff — geometry and excavation · ${esc(r.job.jurisdiction)}</p>
      </div>
      <div class="basis">
        <b>${esc(r.codeBasis.edition)}</b>
        <span>${esc(r.codeBasis.ordinance)}</span>
        <span>Amendments: ${esc(r.codeBasis.amendments)}</span>
      </div>
    </header>

    ${
      r.hasCodeFailure
        ? `<div class="stop"><h2>Code stop</h2><p>A City of Lubbock amendment check failed. Quantities are computed and shown below, but this configuration cannot be built as entered.</p></div>`
        : ''
    }

    <div class="plan-frame plan-sheet" style="--plan-print-width:${scale.widthIn.toFixed(2)}in">
      ${plan.svg}
      <div class="plan-print-title">
        <div>
          <div class="ptb-job">${esc(r.job.name)}</div>
          <div>${esc(r.job.jurisdiction)} · dimensioned plan · skimmer, return and pad positions are indicative, not surveyed</div>
        </div>
        <div class="ptb-scale">SCALE ${scale.label}${scale.fits ? '' : ' — DOES NOT FIT 11×17'}</div>
        <div class="ptb-meta">
          <div>${esc(r.codeBasis.edition)} · ${esc(r.codeBasis.ordinance)}</div>
          <div>${esc(r.codeBasis.amendments)}</div>
          <div>Quantities only. Not a permit set, not a stamped document.</div>
        </div>
      </div>
      <div class="plan-caption">
        <span>Dimensioned plan · water, deck, over-dig, plumbing and pad · positions indicative, not surveyed</span>
        <span>Prints at ${scale.label} on 11×17 landscape · ${Math.round(g.totalVolumeGal.value).toLocaleString('en-US')} gal · ${num1(g.totalWettedArea.value)} sf wetted · ${num1(x.totalBankCy.value)} BCY cut</span>
      </div>
    </div>

    <div class="takeoff-body">

    <h2 class="sec">Lubbock amendment checks<span>every check runs on every job · max depth allowed by the 1:1 setback here: ${num1(g.maxAllowableDepthFt)} ft</span></h2>
    <div class="checks">${g.checks.map(checkCard).join('')}</div>

    <h2 class="sec">1 · Geometry &amp; volume<span>rectangular bodies only · depth varies along the length</span></h2>
    ${calcBlock(
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
      ],
      [g.totalVolumeGal.id, g.totalWettedArea.id],
    )}
    ${
      g.notes.length
        ? `<div class="notes"><span class="k">Input reconciliation</span><ul>${g.notes
            .map((n) => `<li class="${n.severity}">${esc(n.message)}</li>`)
            .join('')}</ul></div>`
        : ''
    }

    <h2 class="sec">2 · Excavation<span>bank / loose / compacted reported separately · swell applied per layer</span></h2>
    ${calcBlock([x.excavationLength, x.excavationWidth, x.maxCutDepth, x.totalCutCf])}
    ${layers}
    <h3 class="sub">Totals, backfill balance and haul</h3>
    ${calcBlock(
      [
        x.totalBankCy,
        x.totalLooseCy,
        x.backfillVoidCf,
        x.backfillCompactedCy,
        x.backfillBankCy,
        x.backfillLooseCy,
        x.spoilHaulLooseCy,
        x.truckCount,
      ],
      [x.spoilHaulLooseCy.id, x.truckCount.id],
    )}
    <div class="notes"><span class="k">Assumptions carried on this sheet</span><ul>
      ${x.notes.map((n) => `<li>${esc(n)}</li>`).join('')}
      <li class="warning">Caliche swell and depth to caliche are placeholder inputs pending reconciliation against a hand calc from a completed Lubbock job. Do not order hauling off this sheet until they are replaced with measured values.</li>
    </ul></div>

    ${structureHtml(r.structure)}

    ${hydraulicsHtml(r.hydraulics)}

    ${equipmentHtml(r.equipment)}

    ${coverHtml(r.cover)}

    ${finishesHtml(r.finishes)}

    ${yardHtml(r.yard)}

    <h2 class="sec">Not yet built</h2>
    <div class="notes"><ul>
      <li>9 · SVG plan view &nbsp;·&nbsp; 10 · Print stylesheet to PDF &nbsp;·&nbsp; 11 · Input form and JSON save/load</li>
    </ul></div>

    </div>

    <footer class="foot">
      <span>Quantities only. No pricing, no labor. Not a permit submittal set and not a stamped engineering document.</span>
      <span>${esc(r.codeBasis.edition)} · ${esc(r.codeBasis.ordinance)}</span>
    </footer>
  </section>`;
}

// --- page -------------------------------------------------------------------

const CSS = `
:root {
  --paper: #f7f6f2;
  --ground: #ebe9e3;
  --ink: #1a1a18;
  --soft: #6b6a64;
  --faint: #97958d;
  --rule: #dedbd2;
  --rule-2: #c5c1b4;
  --accent: #0081af;
  --accent-2: #00abe7;
  --on-accent: #ffffff;
  --stop: #a3341f;
  --stop-bg: rgba(163, 52, 31, 0.06);
  --flag: #8a6a12;
  --mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #191b1d;
    --ground: #121315;
    --ink: #e9e7e1;
    --soft: #9b9a94;
    --faint: #74736e;
    --rule: #2b2e31;
    --rule-2: #3a3e42;
    --accent: #00abe7;
    --accent-2: #4cc6f2;
    --on-accent: #07222c;
    --stop: #e2765c;
    --stop-bg: rgba(226, 118, 92, 0.09);
    --flag: #c9a53f;
  }
}
:root[data-theme="dark"] {
  --paper: #191b1d; --ground: #121315; --ink: #e9e7e1; --soft: #9b9a94; --faint: #74736e;
  --rule: #2b2e31; --rule-2: #3a3e42; --accent: #00abe7; --accent-2: #4cc6f2;
  --on-accent: #07222c; --stop: #e2765c; --stop-bg: rgba(226,118,92,0.09); --flag: #c9a53f;
}
:root[data-theme="light"] {
  --paper: #f7f6f2; --ground: #ebe9e3; --ink: #1a1a18; --soft: #6b6a64; --faint: #97958d;
  --rule: #dedbd2; --rule-2: #c5c1b4; --accent: #0081af; --accent-2: #00abe7;
  --on-accent: #ffffff; --stop: #a3341f; --stop-bg: rgba(163,52,31,0.06); --flag: #8a6a12;
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: var(--sans); font-size: 14px; line-height: 1.4;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 1120px; margin: 0 auto; padding: 14px 12px 40px; }

/* tabs */
.tabs { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.tabs .k { margin-right: 2px; }
.tabs button {
  font: inherit; font-size: 12.5px; padding: 7px 13px; min-height: 38px;
  border: 1px solid var(--rule-2); border-radius: 2px;
  background: var(--paper); color: var(--soft); cursor: pointer;
}
.tabs button[aria-selected="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.tabs button:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

.sheet { background: var(--paper); border: 1px solid var(--rule-2); border-radius: 2px; padding: 18px 16px 26px; }
.sheet[hidden] { display: none; }

.head { display: flex; flex-wrap: wrap; gap: 12px 28px; justify-content: space-between;
  align-items: baseline; padding-bottom: 10px; border-bottom: 1px solid var(--rule-2); }
.head h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; }
.sub-title { margin: 3px 0 0; font-size: 12.5px; color: var(--soft); }
.basis { font-family: var(--mono); font-size: 10.5px; line-height: 1.55; color: var(--soft); display: flex; flex-direction: column; }
.basis b { color: var(--ink); font-weight: 500; }

.k { display: block; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }

/* headline — the one bold moment */
.headline { margin: 16px 0 22px; padding: 16px 18px; background: var(--accent); color: var(--on-accent);
  border-radius: 2px; display: flex; flex-wrap: wrap; gap: 18px 36px; align-items: flex-end; }
.headline .k { color: inherit; opacity: 0.75; }
.hl-fig { display: block; font-family: var(--mono); font-size: clamp(34px, 11vw, 46px); line-height: 1;
  font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin-top: 6px; }
.hl-fig i { font-size: 0.38em; font-style: normal; font-weight: 400; opacity: 0.8; margin-left: 7px; }
.hl-stats { display: flex; flex-wrap: wrap; gap: 10px 26px; padding-bottom: 4px; }
.hl-stats > div { border-left: 1px solid currentColor; padding-left: 12px; }
.hl-stats .v { font-family: var(--mono); font-size: 15px; font-variant-numeric: tabular-nums; margin-top: 3px; display: block; }

h2.sec { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin: 26px 0 0;
  padding-bottom: 5px; border-bottom: 1px solid var(--rule-2);
  font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
h2.sec span { font-size: 11px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--faint); }
h3.sub { display: flex; flex-wrap: wrap; gap: 3px 10px; align-items: baseline; margin: 18px 0 0;
  font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--soft); }
h3.sub span { font-family: var(--mono); font-size: 10.5px; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--faint); }

/* calc rows: five columns on wide screens, stacked on a phone */
.rows { display: flex; flex-direction: column; }
.row { display: grid; gap: 2px 12px; padding: 9px 0; border-bottom: 1px solid var(--rule);
  grid-template-columns: 1fr auto; grid-template-areas: "label value" "formula value" "inputs inputs"; }
.row:last-child { border-bottom: none; }
.r-label { grid-area: label; font-size: 13px; }
.row.em .r-label, .row.em .v { font-weight: 600; }
.r-src { display: block; font-size: 10px; color: var(--faint); }
.r-formula { grid-area: formula; font-family: var(--mono); font-size: 11px; color: var(--soft); overflow-wrap: anywhere; }
.r-inputs { grid-area: inputs; font-family: var(--mono); font-size: 11px; color: var(--soft); line-height: 1.6; overflow-wrap: anywhere; }
.r-inputs .i b { color: var(--ink); font-weight: 500; }
.r-inputs .sep { color: var(--faint); }
.r-value { grid-area: value; text-align: right; white-space: nowrap; align-self: start; }
.r-value .v { font-family: var(--mono); font-size: 15px; font-variant-numeric: tabular-nums; }
.r-value .u { font-family: var(--mono); font-size: 11px; color: var(--soft); margin-left: 5px; }
.rnote { margin: 4px 0 0; padding-left: 9px; border-left: 1px solid var(--rule-2);
  font-family: var(--sans); font-size: 11px; color: var(--faint); }
.r-formula .k, .r-inputs .k { display: none; }

@media (max-width: 700px) {
  .row { grid-template-columns: 1fr; grid-template-areas: "label" "value" "formula" "inputs"; gap: 5px; padding: 12px 0; }
  .r-value { text-align: left; }
  .r-value .v { font-size: 19px; }
  .r-formula .k, .r-inputs .k { display: block; margin-bottom: 2px; }
}

/* code checks */
.checks { display: flex; flex-direction: column; }
.check { padding: 11px 0; border-bottom: 1px solid var(--rule); }
.check:last-child { border-bottom: none; }
.check-top { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; }
.chip { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; padding: 3px 7px;
  border: 1px solid currentColor; border-radius: 2px; min-width: 46px; text-align: center; }
.chip.pass { color: var(--accent); }
.chip.flag { color: var(--flag); }
.chip.fail { background: var(--stop); border-color: var(--stop); color: var(--paper); }
.check-sec { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
.check-title { font-size: 13px; }
.check-limits { font-family: var(--mono); font-size: 11px; color: var(--soft); margin-top: 6px;
  display: grid; gap: 2px; }
.check-limits .k { display: inline-block; width: 46px; }
.check-msg { margin: 7px 0 0; font-size: 12px; color: var(--stop); }
.check.pass .check-msg { color: var(--soft); }
.check-path { margin: 7px 0 0; padding: 8px 10px; font-size: 12px;
  border-left: 2px solid var(--stop); background: var(--stop-bg); }

/* stops and notes */
.stop { margin: 16px 0 0; padding: 13px 15px; border: 1px solid var(--stop); border-left-width: 3px;
  border-radius: 2px; background: var(--stop-bg); }
.stop h2 { margin: 0 0 4px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--stop); }
.stop p { margin: 0; font-size: 12.5px; }
.notes { margin-top: 12px; font-size: 12px; color: var(--soft); }
.notes ul { margin: 6px 0 0; padding-left: 18px; }
.notes li { margin-bottom: 5px; }
.notes li.warning { color: var(--flag); }

.run-checks { display: flex; flex-wrap: wrap; gap: 3px 14px; margin: 5px 0; }
.run-check { font-size: 10.5px; color: var(--faint); }
.run-check b { font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; }
.run-check.pass b { color: var(--accent); }
.run-check.flag b { color: var(--flag); }
.run-check.fail b { color: var(--stop); }
.run-check.guidance b { color: var(--faint); }
.chip.guidance { color: var(--faint); }

/* --- plan view (step 9) --------------------------------------------------- */

.planview {
  display: block;
  width: 100%;
  height: auto;
  background: var(--paper);
}

.pv-water {
  fill: var(--accent);
  fill-opacity: 0.16;
  stroke: var(--accent);
  stroke-width: 1.5;
}
.pv-spa { fill-opacity: 0.28; }
.pv-damwall { stroke: var(--accent); stroke-width: 3; }

.pv-deck {
  fill: none;
  stroke: var(--rule-2);
  stroke-width: 1;
  stroke-dasharray: 6 3;
}
.pv-excavation {
  fill: none;
  stroke: var(--faint);
  stroke-width: 1;
  stroke-dasharray: 2 3;
}

.pv-house {
  fill: var(--rule);
  fill-opacity: 0.55;
  stroke: var(--rule-2);
  stroke-width: 1;
}

.pv-station { stroke: var(--accent); stroke-width: 0.75; stroke-dasharray: 4 3; opacity: 0.7; }
.pv-station-label {
  font-family: var(--sans);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  fill: var(--faint);
}

.pv-step, .pv-seat {
  fill: var(--paper);
  fill-opacity: 0.75;
  stroke: var(--accent);
  stroke-width: 1;
}
.pv-step-tread { stroke: var(--accent); stroke-width: 0.75; opacity: 0.75; }

.pv-drain, .pv-skimmer, .pv-return {
  stroke: var(--accent);
  stroke-width: 1.25;
  fill: var(--paper);
}
.pv-drain { fill: var(--accent); fill-opacity: 0.55; }
.pv-skimmer { fill: var(--paper); }
.pv-return { fill: var(--accent-light); fill-opacity: 0.4; }

.pv-run { fill: none; stroke-width: 1.25; }
.pv-run-suction { stroke: var(--accent); stroke-dasharray: 7 3; }
.pv-run-return { stroke: var(--accent-light); }

.pv-pad { fill: none; stroke: var(--soft); stroke-width: 1.25; }
.pv-pad-item { fill: var(--rule); fill-opacity: 0.7; stroke: var(--soft); stroke-width: 0.75; }

.pv-dim-line { stroke: var(--soft); stroke-width: 0.75; }
.pv-witness { stroke: var(--faint); stroke-width: 0.5; }
.pv-dim-arrow { fill: var(--soft); }
.pv-dim-text {
  font-family: var(--mono);
  font-size: 9.5px;
  fill: var(--ink);
  font-variant-numeric: tabular-nums;
}
.pv-dim-soft .pv-dim-text { fill: var(--faint); font-size: 8.5px; }
.pv-dim-setback .pv-dim-line { stroke: var(--accent); }
.pv-dim-setback .pv-dim-arrow { fill: var(--accent); }
.pv-dim-setback .pv-dim-text { fill: var(--accent); }

.pv-label {
  font-family: var(--sans);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  fill: var(--soft);
}
.pv-label-inset {
  font-family: var(--sans);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  fill: var(--ink);
}
.pv-note { font-family: var(--sans); font-size: 8px; fill: var(--faint); }
.pv-note-inset { font-family: var(--sans); font-size: 7.5px; fill: var(--soft); }
.pv-depth {
  font-family: var(--mono);
  font-size: 11px;
  fill: var(--ink);
  font-variant-numeric: tabular-nums;
}
.pv-depth-soft { font-family: var(--mono); font-size: 9px; fill: var(--faint); }

.pv-scale-fill { fill: var(--ink); }
.pv-scale-empty { fill: none; stroke: var(--ink); stroke-width: 0.75; }
.pv-scale-text { font-family: var(--mono); font-size: 8px; fill: var(--soft); }
.pv-scale-note {
  font-family: var(--sans);
  font-size: 7.5px;
  letter-spacing: 0.07em;
  fill: var(--faint);
}
.pv-hatch { stroke: var(--faint); stroke-width: 0.5; }

.plan-frame {
  margin: 20px 0 6px;
  padding: 10px;
  border: 1px solid var(--rule-2);
  border-radius: 2px;
  background: var(--paper);
}
.plan-caption {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  justify-content: space-between;
  font-size: 10.5px;
  color: var(--faint);
  margin-top: 6px;
}

.pv-pad-number {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 600;
  fill: var(--ink);
}
.pv-dim-violation .pv-dim-line { stroke: var(--stop); stroke-width: 1.25; }
.pv-dim-violation .pv-dim-arrow { fill: var(--stop); }
.pv-dim-violation .pv-dim-text { fill: var(--stop); font-weight: 600; }
.pv-dim-violation .pv-witness { stroke: var(--stop); }

/* --- print (step 10) ------------------------------------------------------ */

/*
 * Two page sizes in one job: the plan sheet is ANSI B landscape, the takeoff is
 * letter portrait. Named pages are how CSS expresses that; Chrome supports them
 * from 110. In a browser that does not, everything falls back to the first
 * @page size and the plan still prints — at the wrong sheet size, which the
 * title block's stated scale makes obvious rather than silent.
 */
@page plan {
  size: 17in 11in;
  margin: 0.5in;
}

@page sheet {
  size: letter portrait;
  margin: 0.6in;
}

.plan-sheet {
  page: plan;
}

.takeoff-body {
  page: sheet;
}

@media print {
  html,
  body {
    background: #fff;
  }

  /* The water fill, the accent rules and the failure colour all carry meaning. */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .tabs,
  .print-hide {
    display: none !important;
  }

  .sheet {
    max-width: none;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
  }

  /* Plan on its own sheet, then the takeoff. */
  .plan-sheet {
    break-after: page;
    page-break-after: always;
    margin: 0;
    padding: 0;
    border: none;
  }

  /*
   * Printed at a stated architectural scale, not scaled to fit. The width is
   * computed from the drawing's real extents and set as a custom property by
   * the sheet; the SVG viewBox does the rest.
   */
  .planview {
    width: var(--plan-print-width) !important;
    height: auto;
    max-width: none;
  }

  .plan-print-title {
    display: flex;
  }

  .plan-caption {
    font-size: 8pt;
  }

  /* Nothing that reads as a unit should be split across a page break. */
  .row,
  .check,
  .run,
  .bar,
  table.calcs tr,
  table.checks tr,
  .stop,
  .headline {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .section {
    break-inside: auto;
  }

  .section-head,
  .subsection {
    break-after: avoid;
    page-break-after: avoid;
  }

  thead {
    display: table-header-group;
  }

  body {
    font-size: 9pt;
    line-height: 1.3;
  }

  .c-result {
    font-size: 9.5pt;
  }

  a[href]::after {
    content: '';
  }
}

/* Title block strip under the printed plan. Screen keeps it hidden. */
.plan-print-title {
  display: none;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--ink);
  font-size: 8pt;
}

.plan-print-title .ptb-job {
  font-weight: 600;
  font-size: 10pt;
}

.plan-print-title .ptb-scale {
  font-family: var(--mono);
  font-size: 11pt;
  font-weight: 600;
}

.plan-print-title .ptb-meta {
  font-family: var(--mono);
  font-size: 7.5pt;
  color: var(--soft);
  text-align: right;
  line-height: 1.5;
}

.print-only {
  display: none;
}

.bars { display: flex; flex-direction: column; }
.bar { display: grid; grid-template-columns: 1fr auto auto; gap: 4px 14px; align-items: baseline;
  padding: 7px 0; border-bottom: 1px solid var(--rule); }
.bar:last-child { border-bottom: none; }
.bar-fam { font-size: 12.5px; }
.bar-n, .bar-t { font-family: var(--mono); font-size: 11.5px; font-variant-numeric: tabular-nums; text-align: right; }
.bar-n { color: var(--soft); }
.bar-t { min-width: 74px; }
@media (max-width: 700px) {
  .bar { grid-template-columns: 1fr auto; }
  .bar-fam { grid-column: 1 / -1; }
}

.foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid var(--rule-2);
  display: flex; flex-wrap: wrap; gap: 6px 24px; justify-content: space-between;
  font-size: 10.5px; color: var(--faint); }
`;

const pages = JOBS.map(({ job, details }) => runTakeoff(job, details));

const html = `<style>${CSS}</style>
<div class="wrap">
  <div class="tabs" role="tablist" aria-label="Job">
    <span class="k">Job</span>
    ${JOBS.map(
      ({ tab }, i) =>
        `<button role="tab" id="tab-${i}" aria-controls="sheet-${i}" aria-selected="${i === 0}">${esc(tab)}</button>`,
    ).join('')}
  </div>
  ${pages
    .map(
      (r, i) =>
        `<div id="sheet-${i}" role="tabpanel" aria-labelledby="tab-${i}"${i === 0 ? '' : ' hidden'}>${sheet(r)}</div>`,
    )
    .join('')}
</div>
<script>
  var tabs = document.querySelectorAll('[role="tab"]');
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      tabs.forEach(function (o, j) {
        o.setAttribute('aria-selected', String(i === j));
        document.getElementById('sheet-' + j).hidden = i !== j;
      });
      window.scrollTo({ top: 0 });
    });
  });
</script>`;

const out = process.argv[2];
if (!out) {
  console.error('usage: node src/cli/renderSheet.ts <out.html>');
  process.exit(1);
}
writeFileSync(out, html, 'utf8');
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(1)} kB)`);
