/**
 * Pump curves.
 *
 * The operating point is where the system curve crosses the pump curve, so the
 * pump curve is an input the engine cannot invent. Curve points are read off the
 * manufacturer's published performance chart and entered with the model, speed,
 * source and revision date — all of which print on the sheet.
 *
 * PRD: product catalog data goes stale fast. Hayward has renumbered models
 * (SP3210X15XE -> VSP32815) and the automation line is now three products. A
 * curve whose revision date is old is a curve to re-check, not to trust.
 *
 * The catalog ships EMPTY. A job without a pump curve gets flow, velocity and
 * TDH — all of which stand on their own — and an explicit statement that no
 * operating point was converged.
 */

export interface CurvePoint {
  readonly gpm: number;
  /** Total dynamic head at that flow, feet of water. */
  readonly headFt: number;
}

export interface PumpCurve {
  readonly id: string;
  readonly manufacturer: string;
  readonly model: string;
  /** Speed the curve was read at, e.g. "3450 rpm" or "2600 rpm (VS preset 2)". */
  readonly speed: string;
  /** Where the curve came from. Prints on every sheet. */
  readonly source: string;
  /** Revision date of that source. Prints on every sheet. */
  readonly revisionDate: string;
  /** Read off the published chart, ordered by increasing flow. */
  readonly points: readonly CurvePoint[];
}

/** Head at a flow, linearly interpolated between published points. */
export function headAtFlow(curve: PumpCurve, gpm: number): number | null {
  const p = curve.points;
  if (p.length < 2) return null;
  if (gpm < p[0]!.gpm || gpm > p[p.length - 1]!.gpm) return null;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    if (gpm >= a.gpm && gpm <= b.gpm) {
      const t = b.gpm === a.gpm ? 0 : (gpm - a.gpm) / (b.gpm - a.gpm);
      return a.headFt + (b.headFt - a.headFt) * t;
    }
  }
  return null;
}

/**
 * An ILLUSTRATIVE curve with the shape of a residential variable-speed pump.
 *
 * THIS IS NOT A REAL PRODUCT CURVE AND MUST NOT BE USED TO SPECIFY A PUMP.
 * It exists so the convergence loop can be exercised and tested before a real
 * curve is entered from a manufacturer chart.
 */
export const EXAMPLE_CURVE: PumpCurve = {
  id: 'EXAMPLE-DO-NOT-SPECIFY',
  manufacturer: 'EXAMPLE',
  model: 'illustrative curve — not a product',
  speed: 'n/a',
  source: 'PLACEHOLDER — no manufacturer chart has been read for this curve',
  revisionDate: '0000-00-00 (placeholder)',
  points: [
    { gpm: 0, headFt: 72 },
    { gpm: 20, headFt: 68 },
    { gpm: 40, headFt: 60 },
    { gpm: 60, headFt: 49 },
    { gpm: 80, headFt: 35 },
    { gpm: 100, headFt: 18 },
    { gpm: 110, headFt: 8 },
  ],
};

/** Ships empty. A curve is entered per job from the manufacturer's chart. */
export const PUMP_CATALOG: readonly PumpCurve[] = [];

// --- Hayward variable-speed pump models -------------------------------------

/**
 * Read from the Hayward 400/600/800 Series Variable Speed Pumps Owner's Manual,
 * IS3200OX Rev B.
 *
 * IMPORTANT: that manual carries no head/flow performance curve. It gives model
 * identity, horsepower and installation constraints. Curve points come from the
 * separate performance data sheet, so a model here has no `curve` until one is
 * read and attached — and without a curve no operating point converges.
 *
 * These are the current model numbers. The PRD notes Hayward renumbered its line
 * (SP3210X15XE -> VSP32815); the VSP/W3VSP numbers below are the current ones.
 */
export interface PumpModel {
  readonly id: string;
  readonly manufacturer: string;
  readonly series: string;
  /** Total horsepower, from the power end part description. */
  readonly totalHp: number;
  /** Other part numbers for the same pump: W3 retail variant, power end. */
  readonly alternateIds: readonly string[];
  readonly source: string;
  readonly revisionDate: string;
  /** Attached once a performance data sheet has been read. */
  readonly curve?: PumpCurve;
  /** One curve per speed, for a variable-speed pump. */
  readonly curves?: readonly PumpCurve[];
}

const IS3200OX = "Hayward 400/600/800 Series VS Pumps Owner's Manual IS3200OX Rev B";

export const HAYWARD_VS_PUMPS: readonly PumpModel[] = [
  {
    id: 'VSP32810',
    manufacturer: 'Hayward',
    series: 'TriStar VS 800',
    totalHp: 1.25,
    alternateIds: ['VSX32810PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP32815',
    manufacturer: 'Hayward',
    series: 'TriStar VS 800',
    totalHp: 1.85,
    alternateIds: ['W3VSP32815', 'VSX32815PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP32820',
    manufacturer: 'Hayward',
    series: 'TriStar VS 800',
    totalHp: 2.25,
    alternateIds: ['W3VSP32820', 'VSX32820PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP26615',
    manufacturer: 'Hayward',
    series: 'Super Pump VS 600',
    totalHp: 1.65,
    alternateIds: ['W3VSP26615', 'VSX26615PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP26620',
    manufacturer: 'Hayward',
    series: 'Super Pump VS 600',
    totalHp: 2.25,
    alternateIds: ['W3VSP26620', 'VSX26620PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP23415',
    manufacturer: 'Hayward',
    series: 'MaxFlo VS 400',
    totalHp: 1.65,
    alternateIds: ['W3VSP23415', 'VSX23415PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
  {
    id: 'VSP23420',
    manufacturer: 'Hayward',
    series: 'MaxFlo VS 400',
    totalHp: 2.25,
    alternateIds: ['W3VSP23420', 'VSX23420PE'],
    source: IS3200OX,
    revisionDate: 'Rev B',
  },
];

export function findPumpModel(id: string): PumpModel | undefined {
  return ALL_PUMP_MODELS.find(
    (p) => p.id === id || p.alternateIds.includes(id),
  );
}

// --- TriStar VS 900 / 950 performance curves --------------------------------

/**
 * Read from the Hayward TriStar VS 900 and 950 sell sheet, LITTS90095026.
 *
 * METHOD: the sell sheet's performance charts are vector art, so these points
 * were taken from the plotted path coordinates in the PDF content stream and
 * calibrated against the axis tick label positions — not eyeballed off an image.
 * The calibration checks out: on the VS 900 chart the plotted points land on
 * exact 14 gpm intervals from 0 to 140, and on the axis origin, which they would
 * not do if the mapping were off.
 *
 * They are still values read off a published chart rather than a tabulated
 * dataset. Treat them as good to roughly half a foot of head, and re-check
 * against a performance data sheet before anything leaves the shop.
 */
const SELL_SHEET = 'Hayward TriStar VS 900/950 sell sheet LITTS90095026, performance comparison charts';

function vsCurve(
  model: string,
  rpm: number,
  points: readonly [number, number][],
): PumpCurve {
  return {
    id: `${model}@${rpm}`,
    manufacturer: 'Hayward',
    model,
    speed: `${rpm} rpm`,
    source: `${SELL_SHEET} (curve read from plotted path coordinates)`,
    revisionDate: 'LITTS90095026',
    points: points.map(([gpm, headFt]) => ({ gpm, headFt })),
  };
}

export const TRISTAR_VS900_CURVES: readonly PumpCurve[] = [
  vsCurve('TriStar VS 900 (SP32900VSPX1)', 3450, [
    [0, 76.5], [14, 76.4], [28, 75.0], [42, 72.7], [56, 69.6], [70, 65.5],
    [84, 58.7], [98, 49.1], [112, 37.9], [126, 26.2], [140, 4.0],
  ]),
  vsCurve('TriStar VS 900 (SP32900VSPX1)', 3000, [
    [0, 58.0], [12.2, 57.9], [24.4, 56.9], [36.5, 55.1], [48.7, 52.8], [60.9, 49.7],
    [73.1, 44.6], [85.2, 37.2], [97.4, 28.8], [109.6, 20.0], [121.7, 3.2],
  ]),
  vsCurve('TriStar VS 900 (SP32900VSPX1)', 2400, [
    [0, 37.4], [9.8, 37.0], [19.5, 36.5], [29.2, 35.5], [39.0, 34.0], [48.7, 31.9],
    [58.4, 28.8], [68.2, 24.5], [77.9, 18.8], [87.7, 11.7], [97.4, 5.1],
  ]),
  vsCurve('TriStar VS 900 (SP32900VSPX1)', 1725, [
    [0, 19.6], [7.3, 19.8], [14.6, 19.6], [21.9, 19.0], [29.2, 17.9], [36.5, 16.4],
    [43.8, 14.5], [51.1, 12.0], [58.4, 9.2], [65.7, 5.9], [73.0, 3.0],
  ]),
  vsCurve('TriStar VS 900 (SP32900VSPX1)', 1000, [
    [0, 6.9], [4.0, 6.9], [8.1, 6.9], [12.1, 6.8], [16.1, 6.5], [20.1, 6.0],
    [24.2, 5.4], [28.2, 4.6], [32.2, 3.6], [36.3, 2.6], [40.3, 1.6],
  ]),
];

export const TRISTAR_VS950_CURVES: readonly PumpCurve[] = [
  vsCurve('TriStar VS 950 (SP32950VSPX1)', 3450, [
    [0.3, 87.3], [19.9, 86.2], [39.5, 84.5], [59.2, 83.2], [78.8, 80.5], [98.4, 76.1],
    [118.1, 66.0], [137.7, 54.5], [157.3, 41.0], [177.0, 25.6], [196.6, 6.9],
  ]),
  vsCurve('TriStar VS 950 (SP32950VSPX1)', 3000, [
    [0.2, 66.2], [17.3, 65.3], [34.4, 64.1], [51.5, 63.1], [68.5, 61.0], [85.6, 57.7],
    [102.7, 50.1], [119.7, 41.4], [136.8, 31.1], [153.9, 19.5], [171.0, 5.4],
  ]),
  vsCurve('TriStar VS 950 (SP32950VSPX1)', 2400, [
    [0.2, 42.6], [13.9, 42.1], [27.5, 41.2], [41.2, 40.6], [54.8, 39.3], [68.5, 37.2],
    [82.1, 32.3], [95.8, 26.7], [109.5, 20.2], [123.1, 12.7], [136.8, 3.7],
  ]),
  vsCurve('TriStar VS 950 (SP32950VSPX1)', 1725, [
    [0.3, 22.5], [10.0, 22.2], [19.7, 21.9], [29.5, 21.4], [39.2, 20.6], [48.9, 19.4],
    [58.7, 17.6], [68.4, 13.9], [78.1, 10.3], [87.8, 5.9], [97.6, 2.8],
  ]),
  vsCurve('TriStar VS 950 (SP32950VSPX1)', 1000, [
    [0.1, 8.0], [5.8, 7.9], [11.5, 7.7], [17.2, 7.6], [22.8, 7.4], [28.5, 7.0],
    [34.2, 6.2], [39.9, 5.2], [45.6, 4.1], [51.3, 2.8], [57.0, 1.2],
  ]),
];

/**
 * Specifications from the same sell sheet's table. Total HP is given as a range
 * because these are variable-speed pumps rated at 230 V and 115 V.
 */
export const TRISTAR_VS_900_950: readonly PumpModel[] = [
  {
    id: 'SP32900VSPX1',
    manufacturer: 'Hayward',
    series: 'TriStar VS 900',
    totalHp: 1.85,
    alternateIds: ['TriStar VS 900'],
    source: SELL_SHEET,
    revisionDate: 'LITTS90095026',
    curves: TRISTAR_VS900_CURVES,
  },
  {
    id: 'SP32950VSPX1',
    manufacturer: 'Hayward',
    series: 'TriStar VS 950',
    totalHp: 2.7,
    alternateIds: ['TriStar VS 950'],
    source: SELL_SHEET,
    revisionDate: 'LITTS90095026',
    curves: TRISTAR_VS950_CURVES,
  },
];

/** Every pump the catalog knows, curve or not. */
export const ALL_PUMP_MODELS: readonly PumpModel[] = [
  ...HAYWARD_VS_PUMPS,
  ...TRISTAR_VS_900_950,
];
