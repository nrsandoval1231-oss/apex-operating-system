/**
 * Job input model.
 *
 * Scope note (PRD): rectangular bodies of water only. No freeform, no radius,
 * no vanishing edge. Depth varies along the length only: a flat shallow run, a
 * linear transition, and a flat deep run.
 *
 * All lengths are FEET unless the field name ends in `In` (inches). Inches are
 * used where the Lubbock amendments are written in inches, so the input reads
 * the same as the code text.
 */

/** Longitudinal depth profile. shallowRun + transitionRun + deepRun must equal length. */
export interface DepthProfile {
  /** Flat run at the shallow depth, measured from the shallow end wall. ft */
  readonly shallowRun: number;
  /** Sloped run between shallow and deep. ft */
  readonly transitionRun: number;
  /** Flat run at the deep depth, to the deep end wall. ft */
  readonly deepRun: number;
  /** Water depth over the shallow flat. ft */
  readonly shallowDepth: number;
  /** Water depth over the deep flat. ft */
  readonly deepDepth: number;
}

/** Entry steps, validated against amended ISPSC 411.2.1 / 411.2.2. */
export interface StepSet {
  readonly id: string;
  /** Number of treads (the horizontal surfaces you stand on). */
  readonly treadCount: number;
  /** Horizontal run (front-to-back depth) of each tread. inches. Lubbock minimum 12. */
  readonly treadRunIn: number;
  /**
   * Stair width, side to side along the wall. inches. Lubbock minimum 20.
   * Also drives step volume displacement and leading-edge stripe length.
   */
  readonly treadWidthIn: number;
  /**
   * Riser heights BOTTOM FIRST, inches. There is one more riser than tread:
   * the first entry is the bottom riser (lowest tread down to the pool floor,
   * which Lubbock permits to taper to zero) and the last is the top riser from
   * the deck. Lubbock: maximum uniform 10" for every riser above the bottom.
   */
  readonly riserHeightsIn: readonly number[];
  /** Water depth at the step location, from the depth profile. ft */
  readonly floorDepthFt: number;
  /** True if this step set is the required means of entry and exit. */
  readonly isRequiredEntryExit: boolean;
}

export type SeatKind = 'bench' | 'swimout' | 'tanningLedge';

/**
 * Bench / underwater seat / swimout / tanning ledge.
 * Validated against amended ISPSC 411.5.2 (benches) and 411.5.1 (swimouts).
 */
export interface Seat {
  readonly id: string;
  readonly kind: SeatKind;
  /** Depth of the horizontal surface below the waterline. inches. */
  readonly depthBelowWaterlineIn: number;
  /** Unobstructed surface depth (front to back). inches. Bench minimum 10. */
  readonly surfaceDepthIn: number;
  /** Unobstructed surface width (along the wall). inches. Bench minimum 24. */
  readonly surfaceWidthIn: number;
  /** Length of the leading edge, for the 1" contrasting stripe. ft */
  readonly leadingEdgeLengthFt: number;
  /** Water depth at this location, from the depth profile. ft */
  readonly floorDepthFt: number;
  /** True if this surface is being used as the required means of entry and exit. */
  readonly isRequiredEntryExit: boolean;
}

export interface Spa {
  readonly lengthFt: number;
  readonly widthFt: number;
  readonly depthFt: number;
  /** Height the spa floor / dam wall is raised above pool water level. ft */
  readonly damWallHeightFt: number;
  /** Thickness of the dam wall. inches. */
  readonly damWallThicknessIn: number;
  /** True when the spa shares a wall with the pool (spillover). */
  readonly attachedToPool: boolean;
  /**
   * True when the spa is built INTO the pool's plan footprint — set into a
   * corner rather than added outside it.
   *
   * This is a volume question, not a cosmetic one. An inset spa takes its
   * footprint out of the pool's water; an attached spa adds to it. On a 6x6 spa
   * in a 3.5 ft shallow end that is around 1,900 gallons of difference, which
   * moves every hydraulic number downstream of volume.
   */
  readonly insetIntoPool?: boolean;
}

export interface PoolBody {
  readonly lengthFt: number;
  readonly widthFt: number;
  readonly profile: DepthProfile;
  readonly steps: readonly StepSet[];
  readonly seats: readonly Seat[];
}

export interface SiteGeometry {
  /**
   * Horizontal distance from the nearest point of the pool/spa water envelope to
   * the nearest building foundation or retaining wall footing. ft
   * Required: Lubbock local section 307.2.2.2 couples this to depth 1:1.
   */
  readonly distanceToFoundationFt: number;
  /** What the measurement is to, printed on the sheet. */
  readonly foundationDescription: string;
}

/** One layer of the subsurface profile. Lubbock: sandy/clay loam over caliche. */
export interface SoilLayer {
  readonly name: string;
  /** Depth below existing grade to the TOP of this layer. ft */
  readonly topDepthFt: number;
  /** Layer thickness. ft. Use Infinity for the bottom layer. */
  readonly thicknessFt: number;
  /**
   * Swell from bank to loose, as a fraction (0.25 = 25%).
   * PRD open question 2: caliche is not honestly defaultable. This is a required
   * input per layer — the engine does not supply a caliche number.
   */
  readonly swellFactor: number;
  /**
   * Compacted yield per bank volume (0.90 = 1 BCY places 0.90 CCY).
   */
  readonly compactionYield: number;
  /**
   * Where the swell factor came from. Prints on the sheet next to the number.
   *
   * Swell is the one input the engine refuses to default, so the provenance of
   * whatever number is used matters as much as the number: a figure off your own
   * haul tickets and a figure off a general reference are not the same evidence,
   * and the sheet should not make them look alike.
   */
  readonly source?: string;
}

export interface ExcavationParams {
  /** Horizontal over-dig beyond the exterior gunite face. ft. PRD default 1.0. */
  readonly overDigHorizontalFt: number;
  /**
   * Floor over-dig below the exterior gunite face. ft.
   * PRD default: equal to shell thickness.
   */
  readonly overDigFloorFt: number;
  /** Shell thickness from the standard detail. ft. */
  readonly shellThicknessFt: number;
  /** Top of bond beam above the waterline. ft. */
  readonly freeboardFt: number;
  /** Haul truck capacity. LCY. PRD default 12, always rounds up. */
  readonly truckCapacityLcy: number;
  readonly soilLayers: readonly SoilLayer[];
}

export interface Job {
  readonly name: string;
  readonly jurisdiction: 'Lubbock, TX';
  readonly pool: PoolBody;
  readonly spa?: Spa;
  readonly site: SiteGeometry;
  readonly excavation: ExcavationParams;
  readonly hydraulics?: HydraulicsParams;
  readonly finishes?: FinishesParams;
  readonly deck?: DeckParams;
  readonly cover?: CoverParams;
  readonly equipment?: EquipmentParams;
}

// --- hydraulics -------------------------------------------------------------

export type RunRole =
  | 'suction-branch'
  | 'suction-trunk'
  | 'skimmer'
  | 'return-trunk'
  | 'return-branch'
  | 'spa-jet';

/** How a run's design flow relates to total system flow. */
export type FlowBasis = 'full-system' | { readonly dividedBy: number };

export interface PlumbingRun {
  readonly id: string;
  readonly label: string;
  readonly role: RunRole;
  /** Measured developed length of pipe. ft */
  readonly lengthFt: number;
  readonly fittings: readonly import('./pipe.ts').FittingCount[];
  readonly flowBasis: FlowBasis;
  /** Fixed size, or omit to let the engine size the run to the velocity target. */
  readonly size?: import('./pipe.ts').NominalSize;
}

/**
 * Suction outlets. ANSI/PHTA/ICC-7: dual outlets, minimum 3 ft separation or on
 * two different surfaces. The engine refuses a single-outlet configuration.
 */
export interface SuctionOutlets {
  readonly count: number;
  readonly separationFt: number;
  readonly onDifferentSurfaces: boolean;
  /** Certified flow rating of the cover the installer intends to fit. gpm */
  readonly intendedCoverRatingGpm?: number;
}

/** A head loss read from a manufacturer curve at a stated flow. */
export interface EquipmentLoss {
  readonly label: string;
  readonly headFt: number;
  readonly atGpm: number;
  readonly source: string;
}

export interface HydraulicsParams {
  /** Design turnover target, bounded by the 6 h maximum and 12 h minimum. */
  readonly turnoverHours: number;
  readonly runs: readonly PlumbingRun[];
  readonly mainDrains: SuctionOutlets;
  readonly equipmentLosses: readonly EquipmentLoss[];
  /** Static lift from water level to the highest point in the system. ft */
  readonly staticLiftFt: number;
  readonly pumpCurve?: import('./pumpCatalog.ts').PumpCurve;
  /** Specified pump. Identity and horsepower; a curve may or may not exist for it. */
  readonly pumpModel?: import('./pumpCatalog.ts').PumpModel;
  /** Hydrostatic relief valves in the shell floor. */
  readonly hydrostaticReliefValves: number;
}

// --- finishes, deck, cover --------------------------------------------------

export interface FinishesParams {
  /** Height of the waterline tile band. inches. */
  readonly waterlineBandHeightIn: number;
  /** Nominal face length of one coping unit. inches. */
  readonly copingUnitLengthIn: number;
  /** Depth of the coping unit from the water edge outward. inches. */
  readonly copingWidthIn: number;
  /** Height of the contrasting leading-edge stripe. inches. Lubbock minimum 1. */
  readonly contrastStripeHeightIn: number;
  /** Waste factors, reported as their own line and never folded into net. */
  readonly tileWaste: number;
  readonly copingWaste: number;
  readonly plasterWaste: number;
}

export interface DeckParams {
  /** Width of the deck measured out from the coping, by side. ft */
  readonly widthFt: number;
  /** Slope away from the water. inches per foot. */
  readonly slopeInPerFt: number;
  /**
   * Minimum slope from ISPSC Table 306.5 for this deck material. inches per foot.
   * Table-dependent, so it is a job input rather than a constant.
   */
  readonly tableMinimumSlopeInPerFt: number;
  readonly deckMaterial: string;
  /**
   * True when the deck is being accepted on the performance path instead of the
   * slope band: no standing water deeper than 1/8 in twenty minutes after the
   * water stops.
   */
  readonly usesPerformancePath: boolean;
  /** Deck drain run. ft */
  readonly deckDrainLengthFt: number;
  /** Grade transitions (steps, ramps, retaining) around the deck. ea */
  readonly gradeTransitions: number;
}

export interface CoverParams {
  /** Manufacturer and model, from the spec sheet. */
  readonly manufacturer: string;
  readonly model: string;
  /** Source and revision date of the spec sheet the dimensions came from. */
  readonly specSource: string;
  readonly specRevisionDate: string;
  /** Vault inside dimensions from the published spec sheet. */
  readonly vaultLengthFt: number;
  readonly vaultWidthFt: number;
  readonly vaultDepthFt: number;
  /** Bond beam drop at the mechanism end. inches. */
  readonly bondBeamDropIn: number;
  /** Track length per side. ft */
  readonly trackLengthFt: number;
  /** True when the cover is listed to ASTM F1346. */
  readonly astmF1346Listed: boolean;
  /**
   * True when the cover is being used as the barrier compliance path under
   * Lubbock amended 305.1, rather than as an accessory to a fence.
   */
  readonly servesAsBarrier: boolean;
  /** True when the distributor has approved a nonstandard layout drawing. */
  readonly distributorApproval?: boolean;
}

// --- equipment, gas, pad ----------------------------------------------------

export type Fuel = 'natural-gas' | 'propane';

/** One appliance on the shared gas run. Existing appliances count. */
export interface GasAppliance {
  readonly label: string;
  readonly btuPerHour: number;
  /** False for appliances already on the run before this job. */
  readonly isNew: boolean;
}

/**
 * One row of an NFPA 54 (natural gas) or NFPA 58 (propane) capacity table, as
 * entered from the code book for the pipe material and pressure drop in use.
 */
export interface GasPipeCapacity {
  readonly sizeLabel: string;
  /** Table column: developed length. ft */
  readonly lengthFt: number;
  /** Capacity at that length. cfh */
  readonly capacityCfh: number;
}

export interface GasParams {
  readonly fuel: Fuel;
  readonly heaterBtuPerHour: number;
  /** Every appliance on the shared run, including ones already there. */
  readonly connectedLoad: readonly GasAppliance[];
  /**
   * Meter capacity. cfh. The tool cannot know this — it is read off the meter
   * or obtained from the utility. Omitted means the check cannot run.
   */
  readonly meterCapacityCfh?: number;
  /** Measured length of the run to the heater. ft */
  readonly runLengthFt: number;
  /** Equivalent length of fittings on that run. ft */
  readonly fittingEquivalentLengthFt: number;
  readonly pipeMaterial: string;
  /** Pressure drop the capacity table is based on, e.g. "0.5 in w.c." */
  readonly tableBasis: string;
  /** Capacity table rows. Ships empty: no table, no size. */
  readonly capacityTable: readonly GasPipeCapacity[];
  /**
   * The size the shop normally runs, e.g. "1 1/4 in". Recorded so the sheet can
   * say whether the table confirms it. Shop practice is a starting point, not a
   * substitute for the table — the same size carries wildly different loads
   * depending on length, pressure and permitted drop.
   */
  readonly intendedSizeLabel?: string;
}

export interface PadItem {
  readonly label: string;
  /** Plan footprint. ft */
  readonly widthFt: number;
  readonly depthFt: number;
  /** Service clearance required around it. ft */
  readonly clearanceFt: number;
}

export interface EquipmentParams {
  /**
   * Straight-line distance from the pool edge to the equipment pad. ft
   * Sets where the pad is drawn, and bounds the plumbing runs: a run to the pad
   * cannot be shorter than the distance to the pad.
   */
  readonly distanceFromPoolFt: number;
  readonly gas?: GasParams;
  readonly padItems: readonly PadItem[];
  /** Automated (actuated) valves: pool/spa suction, returns, water features. */
  readonly actuatedValves: number;
  /** Manual valves on the pad. */
  readonly manualValves: number;
  /** Candidate pumps to select from. Defaults to the whole catalog. */
  readonly pumpCandidates?: readonly import('./pumpCatalog.ts').PumpModel[];
}
