/**
 * Engine entry point. Pure TypeScript, no UI imports, unit-tested independently.
 */

import { computeExcavation, type ExcavationResult } from './excavation.ts';
import { computeGeometry, type GeometryResult } from './geometry.ts';
import { computeStructure, type StructureResult } from './structure.ts';
import { computeHydraulics, type HydraulicsResult } from './hydraulics.ts';
import { computeEquipment, type EquipmentResult } from './equipment.ts';
import { computeFinishes, type FinishesResult } from './finishes.ts';
import { computeYard, type YardResult } from './yard.ts';
import { computeCover, type CoverResult } from './cover.ts';
import { STORED_DETAILS, type StandardDetail } from './standardDetail.ts';
import { CODE_EDITION, ORDINANCE, AMENDMENT_ARTICLE, hasFailure } from './codeChecks.ts';
import type { Job } from './types.ts';

export interface TakeoffResult {
  readonly job: Job;
  readonly geometry: GeometryResult;
  readonly excavation: ExcavationResult;
  readonly structure: StructureResult;
  /** Null when the job carries no hydraulics inputs. */
  readonly hydraulics: HydraulicsResult | null;
  readonly equipment: EquipmentResult | null;
  readonly cover: CoverResult | null;
  readonly finishes: FinishesResult | null;
  readonly yard: YardResult | null;
  /** Printed on every sheet. */
  readonly codeBasis: {
    readonly edition: string;
    readonly ordinance: string;
    readonly amendments: string;
  };
  /** True when any code check or safety-critical hydraulic/gas/pad check failed. */
  readonly hasCodeFailure: boolean;
}

export function runTakeoff(
  job: Job,
  /** Stored standard details. Ships empty: no detail means no structural quantities. */
  details: readonly StandardDetail[] = STORED_DETAILS,
): TakeoffResult {
  const geometry = computeGeometry(job);
  const excavation = computeExcavation(
    job,
    geometry.segments,
    geometry.totalVolumeCf.value,
    geometry.totalWettedArea.value,
  );
  const structure = computeStructure(job, geometry.segments, details);
  const hydraulics = computeHydraulics(job, geometry.totalVolumeGal.value);
  const equipment = computeEquipment(job, hydraulics);
  const cover = computeCover(job);
  const finishes = computeFinishes(job, geometry);
  const yard = computeYard(job, geometry);
  const hydraulicFailure = hydraulics
    ? [
        ...hydraulics.flow.checks,
        ...hydraulics.runs.flatMap((run) => run.checks),
        ...hydraulics.outletChecks,
        ...hydraulics.operatingChecks,
      ].some((check) => check.status === 'fail')
    : false;
  const gasFailure = equipment?.gas
    ? equipment.gas.meterCheck.status === 'fail' || equipment.gas.intendedSize.status === 'too-small'
    : false;
  const padFailure = (equipment?.pad.impossibleRuns.length ?? 0) > 0;

  return {
    job,
    geometry,
    excavation,
    structure,
    hydraulics,
    equipment,
    cover,
    finishes,
    yard,
    codeBasis: {
      edition: CODE_EDITION,
      ordinance: ORDINANCE,
      amendments: AMENDMENT_ARTICLE,
    },
    hasCodeFailure:
      hasFailure([
        ...geometry.checks,
        ...(yard?.checks ?? []),
        ...(cover?.checks ?? []),
      ]) || hydraulicFailure || gasFailure || padFailure,
  };
}

export * from './calc.ts';
export * from './approvedTakeoff.ts';
export * from './types.ts';
export * from './codeChecks.ts';
export * from './geometry.ts';
export * from './excavation.ts';
export * from './profile.ts';
export * from './units.ts';
export * from './structure.ts';
export * from './standardDetail.ts';
export * from './hydraulics.ts';
export * from './pipe.ts';
export * from './pumpCatalog.ts';
export * from './finishes.ts';
export * from './yard.ts';
export * from './cover.ts';
export * from './equipment.ts';
export * from './planView.ts';
export * from './jobFile.ts';
export { STANDARD_MODEL } from './standardModel.ts';
