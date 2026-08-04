import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ApprovedTakeoffRevisionSchema } from '../packages/contracts/src/records.ts';
import { calculateQuantityPayloadSha256 } from '../packages/contracts/src/quantityDigest.ts';

/**
 * Designer → canonical contract compatibility.
 *
 * This is the one test that reaches outside this repository. `Apex Designer/` is
 * a separate preserved component (ADR-0002, `docs/repositories.md`) and is
 * gitignored here — zero of its files are tracked — so a clone without it
 * sitting alongside cannot run this test at all.
 *
 * It used to import the engine statically, which meant CI failed on a module it
 * could never have resolved. Skipping is the honest outcome instead: the test is
 * real where the Designer source is present and absent where it is not, rather
 * than red everywhere.
 *
 * `APEX_REQUIRE_DESIGNER_CONTRACT` is what stops that leniency from swallowing
 * the CI signal. Where the Designer source is supposed to be present — CI checks
 * it out from the private `apex-designer` repository with a deploy key — the
 * variable is set, and a missing engine becomes a failure rather than a skip. A
 * checkout that lands in the wrong directory, or a deploy key that has been
 * revoked, would otherwise look exactly like a green run.
 */

const here = dirname(fileURLToPath(import.meta.url));
const enginePath = resolve(here, '../Apex Designer/src/engine/index.ts');
const engineAvailable = existsSync(enginePath);
const engineRequired = (process.env.APEX_REQUIRE_DESIGNER_CONTRACT ?? '').trim() !== '';

interface DesignerEngine {
  readonly runTakeoff: (model: Record<string, unknown>) => {
    readonly structure: { outcome: string; quantities: { guniteCy: { value: number } } };
  };
  readonly exportDesignerQuantityPayload: (takeoff: unknown) => {
    readonly quantities: readonly { code: string; value: number; calcId: string }[];
    readonly calcLedger: readonly { id: string; label: string; formula: string }[];
    readonly quantityModelVersion: string;
  };
  readonly STANDARD_MODEL: Record<string, unknown>;
}

/**
 * Loaded dynamically so the import is not attempted when the file is missing.
 * Untyped at the boundary by necessity — the engine's own types live in the
 * other repository — so the shape it is expected to have is declared above and
 * asserted here rather than left implicit.
 */
const engine: DesignerEngine | null = engineAvailable
  ? ((await import(pathToFileURL(enginePath).href)) as unknown as DesignerEngine)
  : null;

if (!engineAvailable && !engineRequired) {
  console.warn(
    `\n  !  SKIPPING the Designer contract test: ${enginePath} is not present.`
    + '\n     This is expected on any clone without the Designer repository alongside.'
    + '\n     It is NOT a pass — the contract is simply unverified here.\n',
  );
}

/**
 * Runs only where the engine was supposed to be checked out and is not. Failing
 * here is the point: the alternative is a silent skip inside an otherwise green
 * run, which reads as coverage that does not exist.
 */
describe.runIf(engineRequired && !engineAvailable)('Designer contract test requirement', () => {
  it('finds the Designer engine, because APEX_REQUIRE_DESIGNER_CONTRACT is set', () => {
    expect.unreachable(
      `APEX_REQUIRE_DESIGNER_CONTRACT is set, so the Designer engine must be present, but ${enginePath} does not exist.`
      + ' Check that the apex-designer checkout landed in "Apex Designer/" at the repository root'
      + ' and that the deploy key is still valid. Unset the variable to allow the skip.',
    );
  });
});

const jobId = 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const revisionId = 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const actorId = 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2';

describe.skipIf(!engineAvailable)('Designer to canonical contract compatibility', () => {
  it('accepts the real Designer export without translation or quantity recomputation', () => {
    const { runTakeoff, exportDesignerQuantityPayload, STANDARD_MODEL } = engine!;
    const takeoff = runTakeoff({ ...STANDARD_MODEL, equipment: undefined });
    const payload = exportDesignerQuantityPayload(takeoff);

    const revision = ApprovedTakeoffRevisionSchema.parse({
      revisionId,
      jobId,
      revisionNumber: 1,
      status: 'approved',
      engineVersion: 'designer-0.1.0',
      jobInputSha256: 'a'.repeat(64),
      calcLedgerSha256: 'b'.repeat(64),
      quantityPayloadSha256: calculateQuantityPayloadSha256(payload.quantities),
      quantityModelVersion: payload.quantityModelVersion,
      createdAt: '2026-07-29T12:00:00.000Z',
      createdBy: actorId,
      approvedAt: '2026-07-29T12:05:00.000Z',
      approvedBy: actorId,
      leadId: 'lead_01ARZ3NDEKTSV4RRFFQ69G5FAA',
      blockingIssues: [],
      quantities: payload.quantities,
      calcLedger: payload.calcLedger,
    });

    expect(revision.quantities).toHaveLength(17);
    expect(revision.quantities.find((quantity) => quantity.code === 'shell.gunite-ordered-volume')?.value)
      .toBe(takeoff.structure.outcome === 'quantities' ? takeoff.structure.quantities.guniteCy.value : undefined);
    const forming = revision.quantities.find((quantity) => quantity.code === 'shell.forming-perimeter');
    const waterline = revision.quantities.find((quantity) => quantity.code === 'pool.waterline-perimeter');
    expect(forming?.value).toBe(110);
    expect(forming?.value).not.toBe(waterline?.value);
    expect(revision.calcLedger.find((entry) => entry.id === forming?.calcId)).toMatchObject({
      label: 'Bond-beam form perimeter',
      formula: 'P_form = P_exc,bond-beam',
    });
  });
});
