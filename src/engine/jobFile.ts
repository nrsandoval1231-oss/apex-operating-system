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
export const JOB_FILE_VERSION = 1;

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
    if (!Array.isArray(pool['steps'])) e.push('pool.steps must be a list (it may be empty).');
    if (!Array.isArray(pool['seats'])) e.push('pool.seats must be a list (it may be empty).');
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
    for (const k of ['overDigHorizontalFt', 'overDigFloorFt', 'shellThicknessFt', 'freeboardFt', 'truckCapacityLcy']) {
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
      if (!Array.isArray(hyd['runs'])) e.push('hydraulics.runs must be a list.');
      if (!isNum(hyd['turnoverHours']) || (hyd['turnoverHours'] as number) <= 0) {
        e.push('hydraulics.turnoverHours must be a positive number.');
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
