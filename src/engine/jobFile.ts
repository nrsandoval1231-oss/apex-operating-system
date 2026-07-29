/**
 * Job save / load — build order step 11.
 *
 * Jobs persist as a JSON file. No backend, no database.
 *
 * Two things JSON cannot carry straight through, both of which would corrupt a
 * job quietly if ignored:
 *
 *   1. `Infinity`, which the bottom soil layer uses for its thickness.
 *      JSON.stringify turns it into `null`. Round-tripped naively, the layer
 *      stops reaching the bottom of the cut and the excavation module throws —
 *      or worse, a finite value slips in and the caliche volume is wrong.
 *   2. The pump model, which is a catalogue object carrying five performance
 *      curves. Embedding it would bloat the file and, worse, freeze a copy of
 *      manufacturer data that is supposed to be re-checked against its source.
 *      It is stored as an id and re-resolved from the catalogue on load.
 *
 * Loading validates before returning. A file that does not describe a job comes
 * back as errors, never as a partly-filled job that computes wrong numbers.
 */

import { findPumpModel } from './pumpCatalog.ts';
import type { Job } from './types.ts';

/** Bumped when the shape changes in a way an older file cannot satisfy. */
export const JOB_FILE_VERSION = 2;

const INFINITY_SENTINEL = '__Infinity__';

export interface JobFile {
  readonly apexDesignerJob: number;
  readonly savedFrom: string;
  readonly job: unknown;
}

export function serializeJob(job: Job): string {
  const file: JobFile = {
    apexDesignerJob: JOB_FILE_VERSION,
    savedFrom: 'Apex Designer',
    job: toWire(job),
  };
  return JSON.stringify(file, null, 2);
}

function toWire(job: Job): unknown {
  const clone: Record<string, unknown> = JSON.parse(
    JSON.stringify(job, (_k, v) => (v === Infinity ? INFINITY_SENTINEL : v)),
  );

  // Pump model by reference, not by value.
  const hyd = clone['hydraulics'] as Record<string, unknown> | undefined;
  if (hyd && job.hydraulics?.pumpModel) {
    delete hyd['pumpModel'];
    hyd['pumpModelId'] = job.hydraulics.pumpModel.id;
  }
  // Pump candidates are a catalogue slice; the catalogue is the source.
  const eq = clone['equipment'] as Record<string, unknown> | undefined;
  if (eq) delete eq['pumpCandidates'];

  return clone;
}

export type ParseResult =
  | { readonly ok: true; readonly job: Job; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

export function parseJob(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['File does not contain an object.'] };
  }

  const file = raw as Record<string, unknown>;
  const version = file['apexDesignerJob'];
  if (typeof version !== 'number') {
    return {
      ok: false,
      errors: [
        'This is not an Apex Designer job file — it has no apexDesignerJob version. Refusing to guess at its contents.',
      ],
    };
  }
  if (version > JOB_FILE_VERSION) {
    return {
      ok: false,
      errors: [
        `This file was written by a newer version (format ${version}; this build reads ${JOB_FILE_VERSION}). Loading it could drop inputs silently.`,
      ],
    };
  }

  const warnings: string[] = [];
  const body = file['job'];
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['File has no job in it.'] };
  }

  const restored = fromWire(body as Record<string, unknown>, warnings);
  if (version === 1) migrateVersion1Overdig(restored, warnings);
  const errors = validateJob(restored);
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, job: restored as Job, warnings };
}

function fromWire(body: Record<string, unknown>, warnings: string[]): unknown {
  const revive = (v: unknown): unknown => {
    if (v === INFINITY_SENTINEL) return Infinity;
    if (Array.isArray(v)) return v.map(revive);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = revive(val);
      return out;
    }
    return v;
  };

  const job = revive(body) as Record<string, unknown>;

  const hyd = job['hydraulics'] as Record<string, unknown> | undefined;
  if (hyd && typeof hyd['pumpModelId'] === 'string') {
    const id = hyd['pumpModelId'] as string;
    const model = findPumpModel(id);
    if (model) {
      hyd['pumpModel'] = model;
    } else {
      warnings.push(
        `Pump "${id}" is not in this build's catalogue, so the job loaded without a pump. Flow, velocity and TDH still compute; no operating point will converge until a pump is chosen.`,
      );
    }
    delete hyd['pumpModelId'];
  }

  return job;
}

function migrateVersion1Overdig(job: unknown, warnings: string[]): void {
  if (typeof job !== 'object' || job === null) return;
  const excavation = (job as Record<string, unknown>)['excavation'];
  if (typeof excavation !== 'object' || excavation === null) return;
  const values = excavation as Record<string, unknown>;

  // Version 1 incorrectly treated 12 in as a global offset beyond the shell.
  // That unsafe value cannot be carried forward as though it described either
  // of the now-explicit field regions.
  values['shellThicknessFt'] = 0.5;
  values['bondBeamFormOffsetFt'] = 1;
  values['bondBeamDepthFt'] = 1;
  delete values['overDigHorizontalFt'];
  delete values['overDigFloorFt'];
  warnings.push(
    'Migrated version 1 excavation to the confirmed two-region overdig rule: 6 in ordinary shell offset; 12 in bond-beam form offset through a 12 in depth.',
  );
}

// --- validation -------------------------------------------------------------

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Structural validation only. The engine does the engineering checks — this
 * exists so a malformed file fails as a file, with a readable message, instead
 * of failing deep inside a calculation.
 */
export function validateJob(value: unknown): string[] {
  const e: string[] = [];
  if (!isRec(value)) return ['Job is not an object.'];

  const job = value;
  if (typeof job['name'] !== 'string' || !job['name']) e.push('name is missing.');
  if (job['jurisdiction'] !== 'Lubbock, TX') {
    e.push(
      `jurisdiction is "${String(job['jurisdiction'])}". This tool is scoped to Lubbock and must not be used elsewhere without re-checking the local amendments.`,
    );
  }

  const pool = job['pool'];
  if (!isRec(pool)) {
    e.push('pool is missing.');
  } else {
    for (const k of ['lengthFt', 'widthFt']) {
      if (!isNum(pool[k]) || (pool[k] as number) <= 0) e.push(`pool.${k} must be a positive number.`);
    }
    const p = pool['profile'];
    if (!isRec(p)) {
      e.push('pool.profile is missing.');
    } else {
      for (const k of ['shallowRun', 'transitionRun', 'deepRun', 'shallowDepth', 'deepDepth']) {
        if (!isNum(p[k]) || (p[k] as number) < 0) e.push(`pool.profile.${k} must be a number of 0 or more.`);
      }
    }
    const steps = pool['steps'];
    if (!Array.isArray(steps)) {
      e.push('pool.steps must be a list (it may be empty).');
    } else {
      steps.forEach((step, i) => {
        const path = `pool.steps[${i}]`;
        if (!isRec(step)) {
          e.push(`${path} is not an object.`);
          return;
        }
        if (typeof step['id'] !== 'string' || !step['id']) e.push(`${path}.id is missing.`);
        if (!isNum(step['treadCount']) || !Number.isInteger(step['treadCount']) || step['treadCount'] <= 0) {
          e.push(`${path}.treadCount must be a positive integer.`);
        }
        for (const key of ['treadRunIn', 'treadWidthIn', 'floorDepthFt']) {
          if (!isNum(step[key]) || step[key] <= 0) e.push(`${path}.${key} must be a positive number.`);
        }
        const risers = step['riserHeightsIn'];
        if (!Array.isArray(risers) || risers.some((r) => !isNum(r) || r < 0)) {
          e.push(`${path}.riserHeightsIn must be a list of non-negative numbers.`);
        }
        if (typeof step['isRequiredEntryExit'] !== 'boolean') {
          e.push(`${path}.isRequiredEntryExit must be true or false.`);
        }
      });
    }

    const seats = pool['seats'];
    if (!Array.isArray(seats)) {
      e.push('pool.seats must be a list (it may be empty).');
    } else {
      seats.forEach((seat, i) => {
        const path = `pool.seats[${i}]`;
        if (!isRec(seat)) {
          e.push(`${path} is not an object.`);
          return;
        }
        if (typeof seat['id'] !== 'string' || !seat['id']) e.push(`${path}.id is missing.`);
        if (!['bench', 'swimout', 'tanningLedge'].includes(String(seat['kind']))) {
          e.push(`${path}.kind must be bench, swimout, or tanningLedge.`);
        }
        for (const key of [
          'depthBelowWaterlineIn',
          'surfaceDepthIn',
          'surfaceWidthIn',
          'leadingEdgeLengthFt',
          'floorDepthFt',
        ]) {
          if (!isNum(seat[key]) || seat[key] < 0) e.push(`${path}.${key} must be a non-negative number.`);
        }
        if (typeof seat['isRequiredEntryExit'] !== 'boolean') {
          e.push(`${path}.isRequiredEntryExit must be true or false.`);
        }
      });
    }
  }

  const spa = job['spa'];
  if (spa !== undefined) {
    if (!isRec(spa)) {
      e.push('spa must be an object when present.');
    } else {
      for (const key of ['lengthFt', 'widthFt', 'depthFt', 'damWallThicknessIn']) {
        if (!isNum(spa[key]) || spa[key] <= 0) e.push(`spa.${key} must be a positive number.`);
      }
      if (!isNum(spa['damWallHeightFt']) || spa['damWallHeightFt'] < 0) {
        e.push('spa.damWallHeightFt must be a non-negative number.');
      }
      if (typeof spa['attachedToPool'] !== 'boolean') e.push('spa.attachedToPool must be true or false.');
      if (spa['insetIntoPool'] !== undefined && typeof spa['insetIntoPool'] !== 'boolean') {
        e.push('spa.insetIntoPool must be true or false when present.');
      }
    }
  }

  const site = job['site'];
  if (!isRec(site)) {
    e.push('site is missing.');
  } else if (!isNum(site['distanceToFoundationFt']) || (site['distanceToFoundationFt'] as number) < 0) {
    e.push(
      'site.distanceToFoundationFt must be a number of 0 or more. Local 307.2.2.2 couples it to depth, so it is required on every job.',
    );
  }

  const exc = job['excavation'];
  if (!isRec(exc)) {
    e.push('excavation is missing.');
  } else {
    for (const k of ['shellThicknessFt', 'bondBeamFormOffsetFt', 'bondBeamDepthFt', 'freeboardFt', 'truckCapacityLcy']) {
      if (!isNum(exc[k])) e.push(`excavation.${k} must be a number.`);
    }
    const layers = exc['soilLayers'];
    if (!Array.isArray(layers) || layers.length === 0) {
      e.push('excavation.soilLayers must list at least one layer.');
    } else {
      layers.forEach((l, i) => {
        if (!isRec(l)) {
          e.push(`excavation.soilLayers[${i}] is not an object.`);
          return;
        }
        if (typeof l['name'] !== 'string') e.push(`excavation.soilLayers[${i}].name is missing.`);
        if (!isNum(l['topDepthFt'])) e.push(`excavation.soilLayers[${i}].topDepthFt must be a number.`);
        const t = l['thicknessFt'];
        if (!(isNum(t) || t === Infinity)) {
          e.push(`excavation.soilLayers[${i}].thicknessFt must be a number, or Infinity for the bottom layer.`);
        }
        if (!isNum(l['swellFactor'])) {
          e.push(
            `excavation.soilLayers[${i}].swellFactor must be a number. Swell has no default — the engine does not supply a caliche figure.`,
          );
        }
        if (!isNum(l['compactionYield']) || (l['compactionYield'] as number) <= 0) {
          e.push(`excavation.soilLayers[${i}].compactionYield must be a positive number.`);
        }
      });
    }
  }

  const hyd = job['hydraulics'];
  if (hyd !== undefined) {
    if (!isRec(hyd)) {
      e.push('hydraulics must be an object when present.');
    } else {
      const md = hyd['mainDrains'];
      if (!isRec(md) || !isNum(md['count'])) {
        e.push('hydraulics.mainDrains.count is required.');
      } else if ((md['count'] as number) < 2) {
        e.push(
          'hydraulics.mainDrains.count is under 2. Dual suction outlets are mandatory and the tool will not load a single-outlet job.',
        );
      }
      const runs = hyd['runs'];
      if (!Array.isArray(runs)) {
        e.push('hydraulics.runs must be a list.');
      } else {
        runs.forEach((run, i) => {
          const path = `hydraulics.runs[${i}]`;
          if (!isRec(run)) {
            e.push(`${path} is not an object.`);
            return;
          }
          if (typeof run['id'] !== 'string' || !run['id']) e.push(`${path}.id is missing.`);
          if (typeof run['label'] !== 'string' || !run['label']) e.push(`${path}.label is missing.`);
          if (!['suction-branch', 'suction-trunk', 'skimmer', 'return-trunk', 'return-branch', 'spa-jet'].includes(String(run['role']))) {
            e.push(`${path}.role is invalid.`);
          }
          if (!isNum(run['lengthFt']) || run['lengthFt'] < 0) e.push(`${path}.lengthFt must be a non-negative number.`);
          if (!Array.isArray(run['fittings'])) e.push(`${path}.fittings must be a list.`);
          const basis = run['flowBasis'];
          if (basis !== 'full-system' && (!isRec(basis) || !isNum(basis['dividedBy']) || basis['dividedBy'] <= 0)) {
            e.push(`${path}.flowBasis must be full-system or carry a positive dividedBy value.`);
          }
        });
      }
      if (!isNum(hyd['turnoverHours']) || (hyd['turnoverHours'] as number) <= 0) {
        e.push('hydraulics.turnoverHours must be a positive number.');
      }
    }
  }

  const equipment = job['equipment'];
  if (equipment !== undefined) {
    if (!isRec(equipment)) {
      e.push('equipment must be an object when present.');
    } else {
      const gas = equipment['gas'];
      if (gas !== undefined) {
        if (!isRec(gas)) {
          e.push('equipment.gas must be an object when present.');
        } else {
          if (!['natural-gas', 'propane'].includes(String(gas['fuel']))) e.push('equipment.gas.fuel is invalid.');
          for (const key of ['heaterBtuPerHour', 'runLengthFt', 'fittingEquivalentLengthFt']) {
            if (!isNum(gas[key]) || gas[key] < 0) e.push(`equipment.gas.${key} must be a non-negative number.`);
          }
          const loads = gas['connectedLoad'];
          if (!Array.isArray(loads)) {
            e.push('equipment.gas.connectedLoad must be a list.');
          } else {
            loads.forEach((load, i) => {
              const path = `equipment.gas.connectedLoad[${i}]`;
              if (!isRec(load)) {
                e.push(`${path} is not an object.`);
                return;
              }
              if (typeof load['label'] !== 'string' || !load['label']) e.push(`${path}.label is missing.`);
              if (!isNum(load['btuPerHour']) || load['btuPerHour'] < 0) {
                e.push(`${path}.btuPerHour must be a non-negative number.`);
              }
              if (typeof load['isNew'] !== 'boolean') e.push(`${path}.isNew must be true or false.`);
            });
          }
          if (!Array.isArray(gas['capacityTable'])) e.push('equipment.gas.capacityTable must be a list.');
        }
      }
    }
  }

  return e;
}

/** Filename that sorts sensibly and says what it is. */
export function jobFileName(job: Job): string {
  const slug = job.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${slug || 'job'}.apex.json`;
}
