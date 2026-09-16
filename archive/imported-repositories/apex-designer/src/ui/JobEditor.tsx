/**
 * Input form — build order step 11.
 *
 * Built last, deliberately: the engine defines what inputs exist, so this form
 * is a view onto the Job type rather than a thing the engine was shaped around.
 *
 * Fields are declared as paths into the job, which keeps the form honest — a
 * field that does not correspond to a real input cannot be typed here, and an
 * input the engine needs shows up as a missing field rather than a default
 * invented in the UI.
 */

import { useRef, useState } from 'react';
import { jobFileName, parseJob, serializeJob } from '../engine/jobFile.ts';
import { StepsEditor } from './StepsEditor.tsx';
import type { Job, PropertyLine, PropertyLineSide, SoilLayer } from '../engine/types.ts';

// --- tiny path helpers ------------------------------------------------------

function getAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    const idx = Number(key);
    if (Array.isArray(acc)) return acc[idx];
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Immutably set a value at a dotted path, cloning only what it passes through. */
function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return obj;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    const i = Number(head);
    copy[i] = rest.length ? setAt(copy[i], rest.join('.'), value) : value;
    return copy as unknown as T;
  }
  const src = obj as Record<string, unknown>;
  return {
    ...src,
    [head]: rest.length ? setAt(src[head], rest.join('.'), value) : value,
  } as T;
}

// --- field declarations -----------------------------------------------------

interface Field {
  readonly path: string;
  readonly label: string;
  readonly unit?: string;
  readonly step?: number;
  readonly kind?: 'number' | 'text' | 'bool';
  readonly note?: string;
}

interface Group {
  readonly title: string;
  readonly note?: string;
  readonly fields: readonly Field[];
}

const GROUPS: readonly Group[] = [
  {
    title: 'Job',
    fields: [{ path: 'name', label: 'Job name', kind: 'text' }],
  },
  {
    title: 'Pool',
    fields: [
      { path: 'pool.lengthFt', label: 'Length', unit: 'ft', step: 0.5 },
      { path: 'pool.widthFt', label: 'Width', unit: 'ft', step: 0.5 },
    ],
  },
  {
    title: 'Depth profile',
    note: 'The three runs must add up to the pool length, or the geometry engine stops.',
    fields: [
      { path: 'pool.profile.shallowRun', label: 'Shallow flat run', unit: 'ft', step: 0.5 },
      { path: 'pool.profile.transitionRun', label: 'Transition run', unit: 'ft', step: 0.5 },
      { path: 'pool.profile.deepRun', label: 'Deep flat run', unit: 'ft', step: 0.5 },
      { path: 'pool.profile.shallowDepth', label: 'Shallow depth', unit: 'ft', step: 0.25 },
      { path: 'pool.profile.deepDepth', label: 'Deep depth', unit: 'ft', step: 0.25 },
    ],
  },
  {
    title: 'Site',
    note: 'Local 307.2.2.2 couples depth to this distance 1:1. It is required on every job.',
    fields: [
      { path: 'site.distanceToFoundationFt', label: 'Distance to foundation', unit: 'ft', step: 0.5 },
      { path: 'site.foundationDescription', label: 'Measured to', kind: 'text' },
    ],
  },
  {
    title: 'Spa',
    fields: [
      { path: 'spa.lengthFt', label: 'Length', unit: 'ft', step: 0.5 },
      { path: 'spa.widthFt', label: 'Width', unit: 'ft', step: 0.5 },
      { path: 'spa.depthFt', label: 'Depth', unit: 'ft', step: 0.25 },
      { path: 'spa.damWallHeightFt', label: 'Dam wall height', unit: 'ft', step: 0.25 },
      { path: 'spa.attachedToPool', label: 'Attached to pool', kind: 'bool' },
    ],
  },
  {
    title: 'Excavation',
    fields: [
      { path: 'excavation.shellThicknessFt', label: 'Shell offset from finished surface', unit: 'ft', step: 0.0417 },
      { path: 'excavation.bondBeamFormOffsetFt', label: 'Bond-beam form offset', unit: 'ft', step: 0.0833 },
      { path: 'excavation.bondBeamDepthFt', label: 'Bond-beam excavation depth', unit: 'ft', step: 0.0833 },
      { path: 'excavation.freeboardFt', label: 'Freeboard, grade to waterline', unit: 'ft', step: 0.25 },
      { path: 'excavation.truckCapacityLcy', label: 'Haul truck capacity', unit: 'LCY', step: 1 },
    ],
  },
  {
    title: 'Deck & drainage',
    fields: [
      // The slab is drawn now, so these are its four edges rather than one
      // border width. Negative x/y run beyond the shallow-end and house-side
      // walls, which is where a deck normally starts.
      { path: 'deck.outline.xFt', label: 'Slab left edge', unit: 'ft', step: 0.5 },
      { path: 'deck.outline.yFt', label: 'Slab top edge', unit: 'ft', step: 0.5 },
      { path: 'deck.outline.widthFt', label: 'Slab width', unit: 'ft', step: 0.5 },
      { path: 'deck.outline.heightFt', label: 'Slab depth', unit: 'ft', step: 0.5 },
      { path: 'deck.slopeInPerFt', label: 'Deck slope', unit: 'in/ft', step: 0.0625 },
      { path: 'deck.tableMinimumSlopeInPerFt', label: 'Table 306.5 minimum', unit: 'in/ft', step: 0.0625 },
      { path: 'deck.deckMaterial', label: 'Deck material', kind: 'text' },
      { path: 'deck.usesPerformancePath', label: 'Performance path', kind: 'bool' },
      { path: 'deck.deckDrainLengthFt', label: 'Deck drain run', unit: 'ft', step: 1 },
      { path: 'deck.gradeTransitions', label: 'Grade transitions', unit: 'ea', step: 1 },
    ],
  },
  {
    title: 'Hydraulics',
    note: 'Dual suction outlets are mandatory; the engine refuses a single-outlet job.',
    fields: [
      { path: 'hydraulics.turnoverHours', label: 'Design turnover', unit: 'h', step: 0.5 },
      { path: 'hydraulics.mainDrains.count', label: 'Suction outlets', unit: 'ea', step: 1 },
      { path: 'hydraulics.mainDrains.separationFt', label: 'Outlet separation', unit: 'ft', step: 0.5 },
      { path: 'hydraulics.mainDrains.onDifferentSurfaces', label: 'On two surfaces', kind: 'bool' },
      { path: 'hydraulics.staticLiftFt', label: 'Static lift', unit: 'ft', step: 0.5 },
      { path: 'hydraulics.hydrostaticReliefValves', label: 'Hydrostatic relief valves', unit: 'ea', step: 1 },
    ],
  },
  {
    title: 'Gas',
    note: 'Meter capacity governs the whole system and cannot be derived — read it off the meter.',
    fields: [
      { path: 'equipment.gas.heaterBtuPerHour', label: 'Heater input', unit: 'BTU/hr', step: 25000 },
      { path: 'equipment.gas.meterCapacityCfh', label: 'Meter capacity', unit: 'cfh', step: 25 },
      { path: 'equipment.gas.runLengthFt', label: 'Run length, measured', unit: 'ft', step: 5 },
      { path: 'equipment.gas.fittingEquivalentLengthFt', label: 'Fitting equivalent length', unit: 'ft', step: 5 },
    ],
  },
  {
    title: 'Finishes',
    note: 'Waste is reported as its own line, never folded into the net quantity.',
    fields: [
      { path: 'finishes.waterlineBandHeightIn', label: 'Waterline band height', unit: 'in', step: 1 },
      { path: 'finishes.copingUnitLengthIn', label: 'Coping unit length', unit: 'in', step: 1 },
      { path: 'finishes.contrastStripeHeightIn', label: 'Contrast stripe height', unit: 'in', step: 0.5 },
      { path: 'finishes.tileWaste', label: 'Tile waste', unit: 'fraction', step: 0.01 },
      { path: 'finishes.copingWaste', label: 'Coping waste', unit: 'fraction', step: 0.01 },
      { path: 'finishes.plasterWaste', label: 'Plaster waste', unit: 'fraction', step: 0.01 },
    ],
  },
];

// --- component --------------------------------------------------------------

export function JobEditor({
  job,
  onChange,
  onReset,
}: {
  job: Job;
  onChange: (job: Job) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<{ kind: 'error' | 'warn' | 'ok'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (path: string, value: unknown) => onChange(setAt(job, path, value));

  const save = () => {
    const blob = new Blob([serializeJob(job)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = jobFileName(job);
    a.click();
    URL.revokeObjectURL(url);
    setMessages([{ kind: 'ok', text: `Saved ${jobFileName(job)}` }]);
  };

  const load = async (file: File) => {
    const result = parseJob(await file.text());
    if (!result.ok) {
      setMessages(result.errors.map((text) => ({ kind: 'error' as const, text })));
      return;
    }
    onChange(result.job);
    setMessages([
      { kind: 'ok', text: `Loaded ${file.name}` },
      ...result.warnings.map((text) => ({ kind: 'warn' as const, text })),
    ]);
  };

  return (
    <aside className={`editor print-hide ${open ? '' : 'editor-closed'}`}>
      <div className="editor-head">
        <h2>Job inputs</h2>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <>
          <div className="editor-actions">
            <button type="button" onClick={save}>
              Save JSON
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Load JSON
            </button>
            <button type="button" onClick={onReset}>
              Reset
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void load(f);
                e.target.value = '';
              }}
            />
          </div>

          {messages.length > 0 && (
            <ul className="editor-messages">
              {messages.map((m) => (
                <li key={m.text} className={`msg-${m.kind}`}>
                  {m.text}
                </li>
              ))}
            </ul>
          )}

          {GROUPS.map((group) => {
            // A group whose object is absent from the job is not editable here —
            // adding a spa or a deck is a structural change, not a field edit.
            const root = group.fields[0]!.path.split('.')[0]!;
            const sub = group.fields[0]!.path.split('.').slice(0, -1).join('.');
            if (sub && getAt(job, sub) === undefined && getAt(job, root) === undefined) return null;

            return (
              <fieldset key={group.title} className="editor-group">
                <legend>{group.title}</legend>
                {group.note && <p className="editor-note">{group.note}</p>}
                {group.fields.map((f) => (
                  <FieldRow key={f.path} field={f} value={getAt(job, f.path)} onChange={update} />
                ))}
              </fieldset>
            );
          })}

          <StepsEditor job={job} onChange={onChange} />
          <PropertyLines job={job} onChange={onChange} />
          <SoilLayers job={job} onChange={onChange} />
        </>
      )}
    </aside>
  );
}

const PROPERTY_SIDES: readonly { value: PropertyLineSide; label: string }[] = [
  { value: 'top', label: 'top (house side)' },
  { value: 'bottom', label: 'bottom' },
  { value: 'left', label: 'left (shallow end)' },
  { value: 'right', label: 'right (deep end)' },
];

/**
 * Lot boundaries for the city submittal.
 *
 * A list rather than four fixed fields: a lot is not always four-sided from the
 * pool's point of view, and most jobs only measure the one or two boundaries the
 * pool comes near. Fixed fields would have forced a number into every side and
 * put three invented setbacks on a drawing to get one real one.
 */
function PropertyLines({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const lines = job.site.propertyLines ?? [];

  const setLine = (i: number, patch: Partial<PropertyLine>) =>
    onChange(setAt(job, 'site.propertyLines', lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))));

  const addLine = () =>
    onChange(setAt(job, 'site.propertyLines', [
      ...lines,
      { side: 'bottom' as PropertyLineSide, distanceFt: 10, label: 'Property line' },
    ]));

  const removeLine = (i: number) =>
    onChange(setAt(job, 'site.propertyLines', lines.filter((_, idx) => idx !== i)));

  return (
    <fieldset className="editor-group">
      <legend>Property lines</legend>
      <p className="editor-note">
        Measured from the nearest water to the boundary, the same envelope the foundation distance
        uses. Drawn and dimensioned on the plan but <strong>not code-checked</strong> — no Lubbock
        property-line setback has been recorded here, and the sheet will not print a verdict against
        a limit it does not have. Leave the list empty rather than estimating: a reviewer cannot tell
        a guess from a measurement.
      </p>
      {lines.map((line, i) => (
        <div className="property-row" key={i}>
          <input
            type="text"
            value={line.label}
            aria-label={`Property line ${i + 1} label`}
            onChange={(e) => setLine(i, { label: e.target.value })}
          />
          <label>
            <span>side</span>
            <select
              value={line.side}
              aria-label={`Property line ${i + 1} side`}
              onChange={(e) => setLine(i, { side: e.target.value as PropertyLineSide })}
            >
              {PROPERTY_SIDES.map((side) => (
                <option key={side.value} value={side.value}>{side.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>distance</span>
            <input
              type="number"
              step={0.5}
              min={0}
              value={line.distanceFt}
              aria-label={`Property line ${i + 1} distance`}
              onChange={(e) => setLine(i, { distanceFt: Number(e.target.value) })}
            />
          </label>
          <button type="button" onClick={() => removeLine(i)} aria-label={`Remove property line ${i + 1}`}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="editor-add" onClick={addLine}>
        Add property line
      </button>
    </fieldset>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
}) {
  if (value === undefined) return null;

  if (field.kind === 'bool') {
    return (
      <label className="editor-field editor-field-bool">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.path, e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  return (
    <label className="editor-field">
      <span className="editor-label">{field.label}</span>
      <input
        type={field.kind === 'text' ? 'text' : 'number'}
        step={field.step}
        value={field.kind === 'text' ? String(value) : Number(value)}
        onChange={(e) =>
          onChange(field.path, field.kind === 'text' ? e.target.value : Number(e.target.value))
        }
      />
      {field.unit && <span className="editor-unit">{field.unit}</span>}
    </label>
  );
}

/**
 * Soil layers get their own editor: they are a list, they must stay contiguous
 * from grade, and the bottom one carries Infinity so the profile always reaches
 * the bottom of the cut.
 */
function SoilLayers({ job, onChange }: { job: Job; onChange: (j: Job) => void }) {
  const layers = job.excavation.soilLayers;

  const setLayer = (i: number, patch: Partial<SoilLayer>) => {
    const next = layers.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(setAt(job, 'excavation.soilLayers', recontiguous(next)));
  };

  const addLayer = () => {
    const last = layers[layers.length - 1]!;
    const finiteLast = { ...last, thicknessFt: Number.isFinite(last.thicknessFt) ? last.thicknessFt : 3 };
    const next = [
      ...layers.slice(0, -1),
      finiteLast,
      { name: 'New layer', topDepthFt: 0, thicknessFt: Infinity, swellFactor: Number.NaN, compactionYield: 0.85 },
    ];
    onChange(setAt(job, 'excavation.soilLayers', recontiguous(next)));
  };

  const removeLayer = (i: number) => {
    if (layers.length <= 1) return;
    const next = layers.filter((_, idx) => idx !== i);
    const fixed = next.map((l, idx) => (idx === next.length - 1 ? { ...l, thicknessFt: Infinity } : l));
    onChange(setAt(job, 'excavation.soilLayers', recontiguous(fixed)));
  };

  return (
    <fieldset className="editor-group">
      <legend>Excavation assumptions — soil layers</legend>
      <p className="editor-note">
        Layers run contiguously from grade; depths are recomputed as you edit. Swell has no default —
        the engine supplies no caliche figure, and a blank one stops the excavation module.
      </p>
      {layers.map((l, i) => (
        <div className="soil-row" key={i}>
          <input
            type="text"
            value={l.name}
            aria-label={`Layer ${i + 1} name`}
            onChange={(e) => setLayer(i, { name: e.target.value })}
          />
          <label>
            <span>thickness</span>
            <input
              type="number"
              step={0.5}
              value={Number.isFinite(l.thicknessFt) ? l.thicknessFt : ''}
              placeholder="to bottom"
              disabled={i === layers.length - 1}
              onChange={(e) => setLayer(i, { thicknessFt: Number(e.target.value) })}
            />
          </label>
          <label>
            <span>swell</span>
            <input
              type="number"
              step={0.05}
              value={Number.isFinite(l.swellFactor) ? l.swellFactor : ''}
              placeholder="required"
              onChange={(e) =>
                setLayer(i, { swellFactor: e.target.value === '' ? Number.NaN : Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span>yield</span>
            <input
              type="number"
              step={0.05}
              value={l.compactionYield}
              onChange={(e) => setLayer(i, { compactionYield: Number(e.target.value) })}
            />
          </label>
          <button type="button" onClick={() => removeLayer(i)} disabled={layers.length <= 1}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="editor-add" onClick={addLayer}>
        Add layer
      </button>
    </fieldset>
  );
}

/** Re-stack layer top depths from grade so they stay contiguous. */
function recontiguous(layers: readonly SoilLayer[]): SoilLayer[] {
  let top = 0;
  return layers.map((l, i) => {
    const out = { ...l, topDepthFt: top };
    const thickness = i === layers.length - 1 ? Infinity : l.thicknessFt;
    top += Number.isFinite(thickness) ? thickness : 0;
    return { ...out, thicknessFt: thickness };
  });
}
