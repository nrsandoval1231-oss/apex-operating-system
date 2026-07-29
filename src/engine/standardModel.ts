/**
 * The standard model from the PRD success criteria:
 * 15 x 30 pool, 6 x 6 x 3.5 spa, 3.5-6 ft depth.
 *
 * This is the fixture every engine test runs against and the default the input
 * form will load. Numbers not fixed by the PRD are marked below.
 */

import { findPumpModel } from './pumpCatalog.ts';
import type { Job } from './types.ts';

export const STANDARD_MODEL: Job = {
  name: 'Standard model — 15x30 with 6x6 spa',
  jurisdiction: 'Lubbock, TX',
  pool: {
    lengthFt: 30,
    widthFt: 15,
    profile: {
      // Runs are an assumption, not from the PRD. They must sum to the length.
      shallowRun: 10,
      transitionRun: 14,
      deepRun: 6,
      shallowDepth: 3.5,
      deepDepth: 6,
    },
    steps: [
      {
        id: 'S1',
        treadCount: 4,
        treadRunIn: 12, // at the Lubbock 411.2.1 minimum
        treadWidthIn: 72, // 6 ft wide stair, well over the 20 in minimum
        // Bottom first: 8 in bottom riser (tapered), then four uniform 10 in.
        // Stack = 48 in = 6 in freeboard + 42 in shallow water depth.
        riserHeightsIn: [8, 10, 10, 10, 10],
        floorDepthFt: 3.5,
        isRequiredEntryExit: true,
      },
    ],
    seats: [
      {
        id: 'B1',
        kind: 'bench',
        depthBelowWaterlineIn: 18, // under the Lubbock 20 in limit
        surfaceDepthIn: 16,
        surfaceWidthIn: 96,
        leadingEdgeLengthFt: 8,
        floorDepthFt: 4.5,
        isRequiredEntryExit: false,
      },
    ],
  },
  spa: {
    lengthFt: 6,
    widthFt: 6,
    depthFt: 3.5,
    damWallHeightFt: 1.5,
    damWallThicknessIn: 6,
    attachedToPool: true,
  },
  site: {
    // 6 ft deep pool needs 6 ft of clearance under local 307.2.2.2. PRD open
    // question 7 asks whether a typical Lubbock lot actually clears this.
    distanceToFoundationFt: 8,
    foundationDescription: 'house slab foundation',
  },
  excavation: {
    shellThicknessFt: 0.5, // 6 in total offset from finished waterline/floor
    bondBeamFormOffsetFt: 1.0, // 12 in total offset, bond-beam zone only
    bondBeamDepthFt: 1.0, // 12 in bond-beam depth from the stored Apex detail
    freeboardFt: 0.5, // 6 in grade to waterline
    truckCapacityLcy: 12, // PRD default, editable, always rounds up
    // ONE layer, because that is how the number is actually used: Lubbock digs
    // are figured at 25% swell across the whole cut, not split by material.
    //
    // The engine still supports a layered profile — depth to caliche, a swell
    // per layer — and the editor can add layers. It is modelled flat here
    // because a three-layer split would imply a precision that nobody is
    // actually working to.
    soilLayers: [
      {
        name: 'Lubbock profile — loam over caliche',
        topDepthFt: 0,
        thicknessFt: Infinity,
        swellFactor: 0.25,
        compactionYield: 0.87,
        source:
          "Swell 25%: builder's field figure for Lubbock. Compaction yield 0.87 is assumed and has not been measured.",
      },
    ],
  },
  hydraulics: {
    // PRD open question 3 default: 8 h design turnover, bounded by the 6 h
    // maximum and 12 h minimum, floored at 36 gpm.
    turnoverHours: 8,
    mainDrains: {
      count: 2,
      separationFt: 3,
      onDifferentSurfaces: false,
    },
    runs: [
      // Main drain branches. Each is sized on the single-blocked condition, so
      // each has to carry the whole system flow at 6 fps, not half of it.
      {
        id: 'MD-A',
        label: 'Main drain branch A',
        role: 'suction-branch',
        lengthFt: 12,
        fittings: [{ kind: '90-ell', count: 2 }],
        flowBasis: { dividedBy: 2 },
      },
      {
        id: 'MD-B',
        label: 'Main drain branch B',
        role: 'suction-branch',
        lengthFt: 14,
        fittings: [{ kind: '90-ell', count: 2 }],
        flowBasis: { dividedBy: 2 },
      },
      {
        id: 'MD-TRUNK',
        label: 'Main drain trunk to pad',
        role: 'suction-trunk',
        lengthFt: 40,
        fittings: [
          { kind: '90-ell', count: 3 },
          { kind: 'ball-valve', count: 1 },
        ],
        flowBasis: 'full-system',
      },
      {
        id: 'SKIM-1',
        label: 'Skimmer 1',
        role: 'skimmer',
        lengthFt: 45,
        fittings: [
          { kind: '90-ell', count: 3 },
          { kind: 'ball-valve', count: 1 },
        ],
        flowBasis: { dividedBy: 2 },
      },
      {
        id: 'SKIM-2',
        label: 'Skimmer 2',
        role: 'skimmer',
        lengthFt: 52,
        fittings: [
          { kind: '90-ell', count: 4 },
          { kind: 'ball-valve', count: 1 },
        ],
        flowBasis: { dividedBy: 2 },
      },
      {
        id: 'RET-TRUNK',
        label: 'Return trunk from pad',
        role: 'return-trunk',
        lengthFt: 35,
        fittings: [
          { kind: '90-ell', count: 2 },
          { kind: 'check-valve', count: 1 },
        ],
        flowBasis: 'full-system',
      },
      {
        id: 'RET-1',
        label: 'Return branch 1',
        role: 'return-branch',
        lengthFt: 18,
        fittings: [{ kind: '90-ell', count: 2 }],
        flowBasis: { dividedBy: 4 },
      },
      {
        id: 'RET-2',
        label: 'Return branch 2',
        role: 'return-branch',
        lengthFt: 24,
        fittings: [{ kind: '90-ell', count: 2 }],
        flowBasis: { dividedBy: 4 },
      },
      {
        id: 'RET-3',
        label: 'Return branch 3',
        role: 'return-branch',
        lengthFt: 30,
        fittings: [{ kind: '90-ell', count: 3 }],
        flowBasis: { dividedBy: 4 },
      },
      {
        id: 'RET-4',
        label: 'Return branch 4',
        role: 'return-branch',
        lengthFt: 26,
        fittings: [{ kind: '90-ell', count: 2 }],
        flowBasis: { dividedBy: 4 },
      },
      {
        id: 'SPA-JETS',
        label: 'Spa jet supply',
        role: 'spa-jet',
        lengthFt: 30,
        fittings: [{ kind: '90-ell', count: 4 }],
        flowBasis: 'full-system',
      },
    ],
    // PLACEHOLDERS. Every one of these must be replaced with a value read off
    // the manufacturer's head loss curve for the equipment actually specified.
    equipmentLosses: [
      { label: 'Filter', headFt: 8, atGpm: 60, source: 'PLACEHOLDER — not read from a product curve' },
      { label: 'Heater', headFt: 4, atGpm: 60, source: 'PLACEHOLDER — not read from a product curve' },
      { label: 'Valves and pad fittings', headFt: 3, atGpm: 60, source: 'PLACEHOLDER — not read from a product curve' },
    ],
    staticLiftFt: 2,
    // TriStar VS 900. Curves for all five published speeds come off the sell
    // sheet's performance charts, so this pump converges to an operating point
    // and the engine can pick the lowest speed that meets turnover.
    pumpModel: findPumpModel('SP32900VSPX1'),
    hydrostaticReliefValves: 1,
  },
  finishes: {
    waterlineBandHeightIn: 6,
    copingUnitLengthIn: 12,
    copingWidthIn: 12,
    contrastStripeHeightIn: 1, // Lubbock minimum
    // PRD open question 4 defaults.
    tileWaste: 0.1,
    copingWaste: 0.05,
    plasterWaste: 0.05,
  },
  deck: {
    widthFt: 4,
    slopeInPerFt: 0.25,
    // Table 306.5 is material-dependent. Entered per job, confirm against the
    // table for the deck actually being poured.
    tableMinimumSlopeInPerFt: 0.25,
    deckMaterial: 'broom-finish concrete',
    usesPerformancePath: false,
    deckDrainLengthFt: 45,
    gradeTransitions: 2,
  },
  // No automatic cover on the standard model. A cover is an input that
  // constrains the shell, so it is entered per job from the spec sheet.
  equipment: {
    // Equipment is always within 30 ft of the pool on these jobs.
    distanceFromPoolFt: 30,
    gas: {
      fuel: 'natural-gas',
      // Typical heater size on these jobs.
      heaterBtuPerHour: 250000,
      connectedLoad: [
        { label: 'Pool heater', btuPerHour: 250000, isNew: true },
        // PLACEHOLDER. Existing house appliances on the shared run belong here.
        // Leaving them out is how a run gets undersized.
        { label: 'Furnace (existing, PLACEHOLDER)', btuPerHour: 100000, isNew: false },
        { label: 'Water heater (existing, PLACEHOLDER)', btuPerHour: 40000, isNew: false },
        { label: 'Range (existing, PLACEHOLDER)', btuPerHour: 65000, isNew: false },
      ],
      // Meter capacity as given for this job. A 250 cfh diaphragm meter is a
      // common residential size, and it is the governing constraint here.
      meterCapacityCfh: 250,
      // 70 ft measured + 20 ft of fittings = the 90 ft row on the sizing table.
      runLengthFt: 70,
      fittingEquivalentLengthFt: 20,
      pipeMaterial: 'Schedule 40 steel',
      tableBasis:
        'Longest Length Method, natural gas, IPS. Supplied sizing table — confirm against the NFPA 54 edition in force before it leaves the shop.',
      // Natural gas pipe sizing, Longest Length Method, as supplied.
      // Sizes are IPS; capacities are cfh at the stated developed length.
      capacityTable: [
        // 1/2 in IPS
        { sizeLabel: '1/2 in', lengthFt: 10, capacityCfh: 132 },
        { sizeLabel: '1/2 in', lengthFt: 20, capacityCfh: 92 },
        { sizeLabel: '1/2 in', lengthFt: 30, capacityCfh: 73 },
        { sizeLabel: '1/2 in', lengthFt: 40, capacityCfh: 63 },
        { sizeLabel: '1/2 in', lengthFt: 50, capacityCfh: 56 },
        { sizeLabel: '1/2 in', lengthFt: 60, capacityCfh: 50 },
        { sizeLabel: '1/2 in', lengthFt: 70, capacityCfh: 46 },
        { sizeLabel: '1/2 in', lengthFt: 80, capacityCfh: 43 },
        { sizeLabel: '1/2 in', lengthFt: 90, capacityCfh: 40 },
        { sizeLabel: '1/2 in', lengthFt: 100, capacityCfh: 38 },
        { sizeLabel: '1/2 in', lengthFt: 110, capacityCfh: 34 },
        { sizeLabel: '1/2 in', lengthFt: 120, capacityCfh: 31 },
        { sizeLabel: '1/2 in', lengthFt: 150, capacityCfh: 28 },
        // 3/4 in IPS
        { sizeLabel: '3/4 in', lengthFt: 10, capacityCfh: 278 },
        { sizeLabel: '3/4 in', lengthFt: 20, capacityCfh: 190 },
        { sizeLabel: '3/4 in', lengthFt: 30, capacityCfh: 152 },
        { sizeLabel: '3/4 in', lengthFt: 40, capacityCfh: 130 },
        { sizeLabel: '3/4 in', lengthFt: 50, capacityCfh: 115 },
        { sizeLabel: '3/4 in', lengthFt: 60, capacityCfh: 105 },
        { sizeLabel: '3/4 in', lengthFt: 70, capacityCfh: 96 },
        { sizeLabel: '3/4 in', lengthFt: 80, capacityCfh: 90 },
        { sizeLabel: '3/4 in', lengthFt: 90, capacityCfh: 84 },
        { sizeLabel: '3/4 in', lengthFt: 100, capacityCfh: 79 },
        { sizeLabel: '3/4 in', lengthFt: 110, capacityCfh: 72 },
        { sizeLabel: '3/4 in', lengthFt: 120, capacityCfh: 64 },
        { sizeLabel: '3/4 in', lengthFt: 150, capacityCfh: 59 },
        // 1 in IPS
        { sizeLabel: '1 in', lengthFt: 10, capacityCfh: 520 },
        { sizeLabel: '1 in', lengthFt: 20, capacityCfh: 350 },
        { sizeLabel: '1 in', lengthFt: 30, capacityCfh: 285 },
        { sizeLabel: '1 in', lengthFt: 40, capacityCfh: 245 },
        { sizeLabel: '1 in', lengthFt: 50, capacityCfh: 215 },
        { sizeLabel: '1 in', lengthFt: 60, capacityCfh: 195 },
        { sizeLabel: '1 in', lengthFt: 70, capacityCfh: 180 },
        { sizeLabel: '1 in', lengthFt: 80, capacityCfh: 170 },
        { sizeLabel: '1 in', lengthFt: 90, capacityCfh: 160 },
        { sizeLabel: '1 in', lengthFt: 100, capacityCfh: 150 },
        { sizeLabel: '1 in', lengthFt: 110, capacityCfh: 130 },
        { sizeLabel: '1 in', lengthFt: 120, capacityCfh: 120 },
        { sizeLabel: '1 in', lengthFt: 150, capacityCfh: 110 },
        // 1 1/4 in IPS
        { sizeLabel: '1 1/4 in', lengthFt: 10, capacityCfh: 1050 },
        { sizeLabel: '1 1/4 in', lengthFt: 20, capacityCfh: 730 },
        { sizeLabel: '1 1/4 in', lengthFt: 30, capacityCfh: 590 },
        { sizeLabel: '1 1/4 in', lengthFt: 40, capacityCfh: 500 },
        { sizeLabel: '1 1/4 in', lengthFt: 50, capacityCfh: 440 },
        { sizeLabel: '1 1/4 in', lengthFt: 60, capacityCfh: 400 },
        { sizeLabel: '1 1/4 in', lengthFt: 70, capacityCfh: 370 },
        { sizeLabel: '1 1/4 in', lengthFt: 80, capacityCfh: 350 },
        { sizeLabel: '1 1/4 in', lengthFt: 90, capacityCfh: 320 },
        { sizeLabel: '1 1/4 in', lengthFt: 100, capacityCfh: 305 },
        { sizeLabel: '1 1/4 in', lengthFt: 110, capacityCfh: 275 },
        { sizeLabel: '1 1/4 in', lengthFt: 120, capacityCfh: 250 },
        { sizeLabel: '1 1/4 in', lengthFt: 150, capacityCfh: 225 },
        // 1 1/2 in IPS
        { sizeLabel: '1 1/2 in', lengthFt: 10, capacityCfh: 1600 },
        { sizeLabel: '1 1/2 in', lengthFt: 20, capacityCfh: 1100 },
        { sizeLabel: '1 1/2 in', lengthFt: 30, capacityCfh: 890 },
        { sizeLabel: '1 1/2 in', lengthFt: 40, capacityCfh: 760 },
        { sizeLabel: '1 1/2 in', lengthFt: 50, capacityCfh: 670 },
        { sizeLabel: '1 1/2 in', lengthFt: 60, capacityCfh: 610 },
        { sizeLabel: '1 1/2 in', lengthFt: 70, capacityCfh: 560 },
        { sizeLabel: '1 1/2 in', lengthFt: 80, capacityCfh: 530 },
        { sizeLabel: '1 1/2 in', lengthFt: 90, capacityCfh: 490 },
        { sizeLabel: '1 1/2 in', lengthFt: 100, capacityCfh: 460 },
        { sizeLabel: '1 1/2 in', lengthFt: 110, capacityCfh: 410 },
        { sizeLabel: '1 1/2 in', lengthFt: 120, capacityCfh: 380 },
        { sizeLabel: '1 1/2 in', lengthFt: 150, capacityCfh: 350 },
      ],
      // Shop standard. Unverified until the capacity table is entered.
      intendedSizeLabel: '1 1/4 in',
    },
    padItems: [
      { label: 'Pump', widthFt: 2.0, depthFt: 1.5, clearanceFt: 1.0 },
      { label: 'Filter', widthFt: 2.0, depthFt: 2.0, clearanceFt: 1.0 },
      { label: 'Heater', widthFt: 2.5, depthFt: 2.5, clearanceFt: 1.5 },
      { label: 'Automation panel', widthFt: 1.5, depthFt: 0.75, clearanceFt: 1.0 },
    ],
    actuatedValves: 3,
    manualValves: 6,
  },
};
