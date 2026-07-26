/**
 * whitaker-actual.mjs — Whitaker Oasis, his real estimate, line for line.
 *
 * Source: the customer-facing PDF ("Whitaker Oasis · 14x24 Size Pool w/ Spa"), extracted
 * 2026-07-26. The label glyphs came through a subset font encoding and were reconstructed
 * from context; the FIGURES decoded cleanly and every one of the 13 section subtotals plus
 * the grand total reconciles exactly, which is what verifies the read:
 *
 *   0 + 7,000 + 11,500 + 16,800 + 8,000 + 2,500 + 8,100 + 20,750 + 14,555.18
 *     + 10,000 + 5,950 + 4,800 + 7,000 = 116,955.18   ✓
 *
 * This supersedes guesses. Run `node backtest.mjs` for model vs actual by cost code.
 */

export const WHITAKER_ACTUAL = [
  { code: 100, section: 'Permits', lines: [
    { name: 'Permits', amount: 0 }, // live line item, $0.00 — the long-standing anomaly (ref §5.6)
  ]},
  { code: 200, section: 'Excavation', lines: [
    { name: 'Excavation', amount: 5500 },
    { name: 'Backfill utility trench, clean driveway, site cleanup & haul off', amount: 1500 },
  ]},
  { code: 300, section: 'Pool Equipment', lines: [
    { name: 'Equipment set up', amount: 950 },
    { name: 'Programming', amount: 900 },
    { name: 'Sand filter / sand', amount: 1300 },
    { name: 'Hayward heater', amount: 3350 },
    { name: 'Hayward VS950 pump & motor', amount: 2000 },
    { name: 'Jets, valves, fittings, etc.', amount: 1000 },
    { name: 'UV filter', amount: 2000 },
  ]},
  { code: 400, section: 'Pool Shell Construction', lines: [
    { name: 'Bonding', amount: 250 },     // he books bonding under SHELL, not Utilities
    { name: 'Rebar / rebar labor', amount: 4000 },
    { name: 'Forming', amount: 550 },     // no assembly models this
    { name: 'Gunite', amount: 12000 },
  ]},
  { code: 500, section: 'Utilities', lines: [
    { name: 'Plumber', amount: 5000 },    // separate from cost code 700 Pool Plumbing
    { name: 'Electrician', amount: 3000 },
  ]},
  { code: 600, section: 'Lights', lines: [
    { name: 'Colour-changing LED lights & transformer', amount: 2500 },
  ]},
  { code: 700, section: 'Pool Plumbing', lines: [
    { name: 'Plumbing', amount: 2500 },
    { name: 'Long plumb', amount: 3000 },
    { name: 'Spa plumb', amount: 750 },
    { name: 'Conduit, copper, sweeps, etc.', amount: 850 },
    { name: 'Jet T-bodies / spa', amount: 300 },
    { name: 'Drains, skimmers', amount: 700 },
  ]},
  { code: 800, section: 'Pool Finishes', lines: [
    { name: 'Tile / materials', amount: 1950 },
    { name: 'Tile / labor', amount: 2500 },   // the engine models material ONLY
    { name: 'Coping / materials', amount: 3600 },
    { name: 'Coping / labor', amount: 3950 },
    { name: 'Plaster / materials', amount: 3750 },
    { name: 'Plaster / labor', amount: 5000 },
  ]},
  { code: 900, section: 'Cover', lines: [
    { name: 'Bracket, touch screen, rope, extrusion', amount: 8000 },
    { name: 'Gunite encap kit', amount: 1130.18 }, // odd cents = a real invoice (ref §900)
    { name: 'Cover install', amount: 2300 },
    { name: 'Cover bracket install, coping', amount: 375 },
    { name: 'Encapsulations pre & install', amount: 750 },
    { name: 'Stainless steel lid brackets', amount: 1000 },
    { name: 'Stone lid', amount: 1000 },
  ]},
  { code: 1000, section: 'Pool Deck', lines: [
    { name: 'Concrete diamonds budget', amount: 5000, allowance: true },
    { name: 'Turf budget', amount: 5000, allowance: true },
    // NOTE: there is NO deck construction line. The whole section is upgrade budgets.
  ]},
  { code: 1100, section: 'Water Features', lines: [
    { name: 'Water feature structure', amount: 2500 },
    { name: 'Water sheer', amount: 600 },
    { name: 'Pump', amount: 2850 },
  ]},
  { code: 1200, section: 'Automation', lines: [
    { name: 'Omnilogic base panel', amount: 3500 },
    { name: 'Omnilogic wireless antenna', amount: 550 },
    { name: 'Actuators', amount: 750 },
  ]},
  { code: 1300, section: 'Additional Upgrades', lines: [
    { name: 'Fence budget', amount: 7000, allowance: true },
  ]},
];

export const SECTION_TOTAL = (code) =>
  WHITAKER_ACTUAL.find((s) => s.code === code).lines.reduce((t, l) => t + l.amount, 0);

export const JOB_COST = WHITAKER_ACTUAL.reduce(
  (t, s) => t + s.lines.reduce((u, l) => u + l.amount, 0), 0);

export const ALLOWANCE_TOTAL = WHITAKER_ACTUAL.reduce(
  (t, s) => t + s.lines.filter((l) => l.allowance).reduce((u, l) => u + l.amount, 0), 0);

// Published on the estimate.
export const DISCLOSED = { feeRate: 0.30, fee: 35086.55, total: 152041.73 };
