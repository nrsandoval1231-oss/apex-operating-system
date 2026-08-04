/**
 * Takeoff sheet — build order step 3.
 *
 * Renders engine steps 1 and 2 with formulas and inputs visible, to prove the
 * show-your-work pattern before it has to survive a print stylesheet (step 10).
 * Structure, hydraulics, equipment, cover, finishes and yard are not built yet
 * and are named as such rather than left off, so the sheet never reads as
 * complete when it isn't.
 */

import { runTakeoff, type CodeFailureArea } from '../engine/index.ts';
import { planPrintScale, renderPlanView } from '../engine/planView.ts';
import { GeometryInputError } from '../engine/geometry.ts';
import { ExcavationInputError } from '../engine/excavation.ts';
import type { Job } from '../engine/types.ts';
import type { StandardDetail } from '../engine/standardDetail.ts';
import { CalcTable } from './CalcTable.tsx';
import { CodeCheckTable } from './CodeCheckTable.tsx';
import { StructureSection } from './StructureSection.tsx';
import { HydraulicsSection } from './HydraulicsSection.tsx';
import { CoverSection, FinishesSection, YardSection } from './FinishesSection.tsx';
import { EquipmentSection } from './EquipmentSection.tsx';
import { num, num1 } from './format.ts';

/**
 * Where each family of blocking check is actually rendered on the sheet. The
 * banner names the section the reader has to scroll to; naming the wrong one is
 * worse than naming none, because it sends them to a table that is all green.
 */
const FAILURE_AREA_LABEL: Record<CodeFailureArea, string> = {
  amendments: 'A City of Lubbock amendment check',
  hydraulics: 'A hydraulic check',
  gas: 'A gas sizing check',
  'equipment-pad': 'An equipment pad run',
};

function failureAreaSentence(areas: readonly CodeFailureArea[]): string {
  const labels = areas.map((area) => FAILURE_AREA_LABEL[area]);
  if (labels.length === 0) return 'A blocking check failed.';
  if (labels.length === 1) return `${labels[0]} failed.`;
  // "A hydraulic check, a gas sizing check and an equipment pad run failed."
  const rest = labels.slice(1).map((label) => label.replace(/^A[n]? /, (m) => m.toLowerCase()));
  const last = rest.pop();
  return `${[labels[0], ...rest].join(', ')} and ${last} failed.`;
}

export function TakeoffSheet({ job, details }: { job: Job; details?: readonly StandardDetail[] }) {
  let result;
  try {
    result = runTakeoff(job, details);
  } catch (e) {
    const isInput = e instanceof GeometryInputError || e instanceof ExcavationInputError;
    return (
      <div className="sheet">
        <div className="stop">
          <h3>{isInput ? 'Input stop — no quantities produced' : 'Engine error'}</h3>
          <p>{e instanceof Error ? e.message : String(e)}</p>
        </div>
      </div>
    );
  }

  const { geometry: g, excavation: x, codeBasis } = result;
  const plan = renderPlanView(job);
  const printScale = planPrintScale(plan);

  return (
    <div className="sheet">
      <header className="sheet-head">
        <div>
          <h1 className="sheet-title">{job.name}</h1>
          <div className="sheet-sub">
            Materials takeoff — geometry and excavation · {job.jurisdiction}
          </div>
        </div>
        <div className="code-basis">
          <div>
            <strong>{codeBasis.edition}</strong>
          </div>
          <div>{codeBasis.ordinance}</div>
          <div>Amendments: {codeBasis.amendments}</div>
        </div>
      </header>

      {result.hasCodeFailure && (
        <div className="stop">
          <h3>Code stop</h3>
          <p>
            {failureAreaSentence(result.codeFailureAreas)} Quantities below are computed and shown,
            but this configuration cannot be built as entered. See the compliance path on the
            failing check.
          </p>
        </div>
      )}

      {/* The one bold moment: the plan drawing itself, and its own print sheet. */}
      <div
        className="plan-frame plan-sheet"
        style={{ ['--plan-print-width' as string]: `${printScale.widthIn.toFixed(2)}in` }}
      >
        <div dangerouslySetInnerHTML={{ __html: plan.svg }} />

        <div className="plan-print-title">
          <div>
            <div className="ptb-job">{job.name}</div>
            <div>
              {job.jurisdiction} · dimensioned plan · skimmer, return and pad positions are
              indicative, not surveyed
            </div>
          </div>
          <div className="ptb-scale">
            SCALE {printScale.label}
            {!printScale.fits && ' — DOES NOT FIT 11×17'}
          </div>
          <div className="ptb-meta">
            <div>
              {codeBasis.edition} · {codeBasis.ordinance}
            </div>
            <div>{codeBasis.amendments}</div>
            <div>Quantities only. Not a permit set, not a stamped document.</div>
          </div>
        </div>

        <div className="plan-caption">
          <span>
            Dimensioned plan · water, deck, over-dig, plumbing and pad · skimmer, return and pad
            positions are indicative, not surveyed
          </span>
          <span>
            Prints at {printScale.label} on 11×17 landscape ·{' '}
            {Math.round(g.totalVolumeGal.value).toLocaleString('en-US')} gal ·{' '}
            {num1(g.totalWettedArea.value)} sf wetted · {num1(x.totalBankCy.value)} BCY cut
          </span>
        </div>
      </div>

      <div className="takeoff-body">

      <section className="section">
        <div className="section-head">
          <h2>City of Lubbock amendment checks</h2>
          <span className="note">
            every check runs on every job · maximum depth allowed by the 1:1 setback on this site:{' '}
            {num(g.maxAllowableDepthFt)} ft
          </span>
        </div>
        <CodeCheckTable checks={g.checks} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>1 · Geometry &amp; volume</h2>
          <span className="note">rectangular bodies only · depth varies along the length</span>
        </div>
        <CalcTable
          calcs={[
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
          ]}
          emphasize={[g.totalVolumeGal.id, g.totalWettedArea.id]}
        />
        {g.notes.length > 0 && (
          <div className="notes">
            <div className="notes-head">Input reconciliation</div>
            <ul>
              {g.notes.map((n) => (
                <li key={n.id} className={n.severity === 'warning' ? 'warn-note' : undefined}>
                  {n.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>2 · Excavation</h2>
          <span className="note">
            bank / loose / compacted reported separately · swell applied per layer
          </span>
        </div>
        <CalcTable
          calcs={[x.excavationLength, x.excavationWidth, x.maxCutDepth, x.totalCutCf]}
        />

        {x.layers.map((l) => (
          <div key={l.layer.name}>
            <div className="subsection">
              {l.layer.name} — {num(l.bandTopFt)} to {num(l.bandBottomFt)} ft below grade · swell{' '}
              {(l.layer.swellFactor * 100).toFixed(0)}% · compacted yield{' '}
              {(l.layer.compactionYield * 100).toFixed(0)}%
            </div>
            <CalcTable calcs={[l.cutCf, l.bankCy, l.looseCy]} emphasize={[l.looseCy.id]} />
          </div>
        ))}

        <div className="subsection">Totals, backfill balance and haul</div>
        <CalcTable
          calcs={[
            x.totalBankCy,
            x.totalLooseCy,
            x.backfillVoidCf,
            x.backfillCompactedCy,
            x.backfillBankCy,
            x.backfillLooseCy,
            x.spoilHaulLooseCy,
            x.truckCount,
          ]}
          emphasize={[x.spoilHaulLooseCy.id, x.truckCount.id]}
        />

        <div className="notes">
          <div className="notes-head">Assumptions carried on this sheet</div>
          <ul>
            {x.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li className="warn-note">
              Caliche swell and depth to caliche are placeholder inputs pending reconciliation
              against a hand calc from a completed Lubbock job. Do not order hauling off this sheet
              until they are replaced with measured values.
            </li>
          </ul>
        </div>
      </section>

      <StructureSection structure={result.structure} />

      <HydraulicsSection hydraulics={result.hydraulics} />

      <EquipmentSection equipment={result.equipment} />

      <CoverSection cover={result.cover} />

      <FinishesSection finishes={result.finishes} />

      <YardSection yard={result.yard} />

      <section className="section">
        <div className="section-head">
          <h2>Not yet built</h2>
        </div>
        <div className="notes">
          <ul>
            <li>9 · SVG plan view · 10 · Print stylesheet to PDF · 11 · Input form and JSON save/load</li>
          </ul>
        </div>
      </section>

      </div>

      <footer className="footer">
        <span>
          Quantities only. No pricing, no labor. Not a permit submittal set and not a stamped
          engineering document.
        </span>
        <span>
          {codeBasis.edition} · {codeBasis.ordinance}
        </span>
      </footer>
    </div>
  );
}
