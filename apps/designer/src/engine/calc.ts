/**
 * The show-your-work primitive.
 *
 * PRD standing constraint: "Every calculation renders as: formula -> inputs with
 * units -> result. Never the result alone."
 *
 * Nothing in the engine returns a bare number. Every quantity is a Calc that
 * carries the formula string, the named inputs with their units, and the result
 * with its unit. The UI renders Calc objects; it never re-derives arithmetic.
 */

export interface CalcInput {
  /** Symbol as it appears in the formula string, e.g. "L" or "d_deep". */
  readonly symbol: string;
  /** Human label, e.g. "Pool length". */
  readonly label: string;
  readonly value: number;
  readonly unit: string;
}

export interface Calc {
  readonly id: string;
  readonly label: string;
  /** Symbolic formula, e.g. "V = A_profile x W". */
  readonly formula: string;
  readonly inputs: readonly CalcInput[];
  readonly value: number;
  readonly unit: string;
  /** Optional standard / code citation, printed with the line. */
  readonly source?: string;
  readonly notes?: readonly string[];
}

export interface CalcSpec {
  id: string;
  label: string;
  formula: string;
  unit: string;
  inputs: readonly CalcInput[];
  compute: (inputs: Readonly<Record<string, number>>) => number;
  source?: string;
  notes?: readonly string[];
}

/**
 * Build a Calc. `compute` receives the inputs keyed by symbol, so the formula
 * string and the arithmetic are written against the same symbols.
 */
export function calc(spec: CalcSpec): Calc {
  const bySymbol: Record<string, number> = {};
  for (const i of spec.inputs) {
    if (i.symbol in bySymbol) {
      throw new Error(`calc "${spec.id}": duplicate input symbol "${i.symbol}"`);
    }
    if (!Number.isFinite(i.value)) {
      throw new Error(`calc "${spec.id}": input "${i.symbol}" is not a finite number`);
    }
    bySymbol[i.symbol] = i.value;
  }
  const value = spec.compute(bySymbol);
  if (!Number.isFinite(value)) {
    throw new Error(`calc "${spec.id}": produced a non-finite result`);
  }
  const out: Calc = {
    id: spec.id,
    label: spec.label,
    formula: spec.formula,
    inputs: spec.inputs,
    value,
    unit: spec.unit,
  };
  return {
    ...out,
    ...(spec.source ? { source: spec.source } : {}),
    ...(spec.notes ? { notes: spec.notes } : {}),
  };
}

/** Shorthand for declaring an input inline. */
export function inp(symbol: string, label: string, value: number, unit: string): CalcInput {
  return { symbol, label, value, unit };
}

/** Turn an upstream Calc into an input of a downstream Calc, keeping its unit. */
export function fromCalc(symbol: string, c: Calc): CalcInput {
  return { symbol, label: c.label, value: c.value, unit: c.unit };
}

/** Render a Calc as a single plain-text line: formula, inputs, result. */
export function renderCalc(c: Calc): string {
  const inputs = c.inputs.map((i) => `${i.symbol}=${trim(i.value)} ${i.unit}`).join(', ');
  const src = c.source ? `  [${c.source}]` : '';
  return `${c.label}: ${c.formula} | ${inputs} => ${trim(c.value)} ${c.unit}${src}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/**
 * A quantity that must never be silently baked into a net number.
 * PRD: "Waste factors shown as a separate line from net quantity, never baked in."
 */
export interface NetAndWaste {
  readonly net: Calc;
  readonly wastePct: number;
  readonly waste: Calc;
  readonly ordered: Calc;
}

export function withWaste(net: Calc, wastePct: number, idPrefix: string): NetAndWaste {
  const waste = calc({
    id: `${idPrefix}.waste`,
    label: `${net.label} — waste allowance`,
    formula: 'W = Q_net x p',
    unit: net.unit,
    inputs: [
      fromCalc('Q_net', net),
      inp('p', 'Waste factor', wastePct, 'fraction'),
    ],
    compute: ({ Q_net, p }) => Q_net! * p!,
  });
  const ordered = calc({
    id: `${idPrefix}.ordered`,
    label: `${net.label} — order quantity`,
    formula: 'Q_ord = Q_net + W',
    unit: net.unit,
    inputs: [fromCalc('Q_net', net), fromCalc('W', waste)],
    compute: ({ Q_net, W }) => Q_net! + W!,
  });
  return { net, wastePct, waste, ordered };
}
