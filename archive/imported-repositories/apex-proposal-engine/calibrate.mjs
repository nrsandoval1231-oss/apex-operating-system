#!/usr/bin/env node
/**
 * Calibration is intentionally fail-closed.
 *
 * The original script back-solved commercial unit rates from a single completed job whose
 * quantities are themselves a calibration fixture. It also mixed unlike labor/material bases.
 * That can replay Whitaker but cannot establish predictive pricing accuracy.
 *
 * A replacement may be introduced only after:
 *   1. Designer supplies approved, versioned quantities.
 *   2. Five to ten completed jobs carry reconciled vendor and QuickBooks actuals.
 *   3. Labor, material, subcontract, allowance, and residual bases are separated.
 *   4. A holdout job is evaluated without using it to fit rates.
 */
const message = [
  'DISABLED: calibrate.mjs cannot produce pricing guidance.',
  'Whitaker is a calibration replay, not independent validation.',
  'Use node backtest.mjs for historical visibility; do not change UNIT_COSTS from this script.',
].join('\n');

console.error(message);
process.exitCode = 2;
