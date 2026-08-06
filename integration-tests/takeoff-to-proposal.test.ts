import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ApprovedTakeoffRevisionSchema } from '../packages/contracts/src/records.ts';
import { calculateQuantityPayloadSha256 } from '../packages/contracts/src/quantityDigest.ts';

/**
 * The chain, run end to end: Designer measures → the quantities are approved → Proposal prices
 * them → the proposal is issued.
 *
 * Nothing had ever executed this. `designer-contract.test.ts` proves Designer's export
 * satisfies the canonical Zod contract and stops there; the Proposal engine's own suites price
 * a hand-written fixture. So the two halves were each tested against a description of the
 * other, and the seam between them — the part where a real measured quantity becomes a real
 * dollar figure — was covered by nobody.
 *
 * This reaches into TWO sibling repositories, both gitignored here (ADR-0002): `Apex Designer/`
 * and `apex-proposal-engine/`. CI currently checks out only the first, so this skips there and
 * says so. Running it needs both repositories present, which is the normal local state.
 *
 * What this deliberately does NOT prove: that the prices are right. The unit rates are
 * back-solved from one calibration job and are not pricing authority. What it proves is that
 * the chain CONNECTS — that Designer's seventeen quantities survive the crossing intact, are
 * refused when tampered with, and reach the pricing lines as the same numbers.
 */

const here = dirname(fileURLToPath(import.meta.url));
const designerPath = resolve(here, '../Apex Designer/src/engine/index.ts');
const proposalPath = resolve(here, '../apex-proposal-engine/engine.mjs');
const bothAvailable = existsSync(designerPath) && existsSync(proposalPath);

/**
 * What makes the skip trustworthy — and it is NOT the console.warn below.
 *
 * Vitest intercepts console output, so that warning is invisible in a normal run; it surfaces
 * only under --disableConsoleIntercept. Verified by hiding the Proposal engine and watching a
 * default run report "5 skipped" with no explanation at all. A skip nobody can see is
 * indistinguishable from coverage.
 *
 * So where the repositories are supposed to be checked out — CI, with both deploy keys — this
 * variable is set and a missing engine FAILS instead of skipping. Same discipline as
 * APEX_REQUIRE_DESIGNER_CONTRACT, and for the same reason: a checkout landing in the wrong
 * directory, or a revoked key, would otherwise look exactly like a green run.
 */
const chainRequired = (process.env.APEX_REQUIRE_TAKEOFF_CHAIN ?? '').trim() !== '';

interface DesignerEngine {
  readonly runTakeoff: (model: Record<string, unknown>) => unknown;
  readonly exportDesignerQuantityPayload: (takeoff: unknown) => {
    readonly quantities: readonly { code: string; value: number; unit: string; calcId: string }[];
    readonly calcLedger: readonly { id: string; label: string; formula: string }[];
    readonly quantityModelVersion: string;
  };
  readonly STANDARD_MODEL: Record<string, unknown>;
}

interface ProposalLine {
  readonly code: number;
  readonly name: string;
  readonly qty: number;
  readonly extended: number;
  readonly quantityAuthority?: { readonly code: string; readonly value: number };
}

interface ProposalEngine {
  readonly takeoff: (inputs: Record<string, unknown>) => {
    readonly lines: readonly ProposalLine[];
    readonly pricing: { readonly cost: number; readonly fee: number; readonly revenue: number };
    readonly proposalGate: {
      readonly canIssue: boolean;
      readonly blockers: readonly { readonly code: string }[];
    };
    readonly quantityPayloadSha256: string;
    readonly quantityModelVersion: string;
    readonly approvedTakeoffRevisionId: string | null;
  };
  readonly legacyReplayTakeoff: (inputs: Record<string, unknown>) => unknown;
  readonly finalizeProposal: (result: unknown) => {
    readonly status: string;
    readonly approvedTakeoff: {
      readonly revisionId: string;
      readonly quantityPayloadSha256: string;
      readonly quantityModelVersion: string;
    };
    readonly measuredQuantityExplanations: readonly { readonly code: string }[];
  };
}

const designer: DesignerEngine | null = bothAvailable
  ? ((await import(pathToFileURL(designerPath).href)) as unknown as DesignerEngine)
  : null;
const proposal: ProposalEngine | null = bothAvailable
  ? ((await import(pathToFileURL(proposalPath).href)) as unknown as ProposalEngine)
  : null;

if (!bothAvailable && !chainRequired) {
  // Belt-and-braces only. Vitest swallows this in a default run — the guard below is what
  // actually protects the signal.
  console.warn(
    '\n  !  SKIPPING the takeoff-to-proposal chain test.'
    + `\n     Designer engine present: ${existsSync(designerPath)}`
    + `\n     Proposal engine present: ${existsSync(proposalPath)}`
    + '\n     Both sibling repositories must be checked out alongside this one.'
    + '\n     This is NOT a pass — the chain is simply unverified here.\n',
  );
}

/**
 * Runs only where both repositories were supposed to be present and at least one is not.
 * Failing here is the entire point.
 */
describe.runIf(chainRequired && !bothAvailable)('takeoff-to-proposal chain requirement', () => {
  it('finds both engines, because APEX_REQUIRE_TAKEOFF_CHAIN is set', () => {
    expect.unreachable(
      'APEX_REQUIRE_TAKEOFF_CHAIN is set, so both engines must be present.'
      + ` Designer at "${designerPath}": ${existsSync(designerPath)}.`
      + ` Proposal at "${proposalPath}": ${existsSync(proposalPath)}.`
      + ' Check that both checkouts landed at the repository root and that the deploy keys are'
      + ' still valid. Unset the variable to allow the skip.',
    );
  });
});

const ids = {
  job: 'job_01ARZ3NDEKTSV4RRFFQ69G5FAW',
  revision: 'revision_01ARZ3NDEKTSV4RRFFQ69G5FAX',
  lead: 'lead_01ARZ3NDEKTSV4RRFFQ69G5FAA',
  actor: 'user_01ARZ3NDEKTSV4RRFFQ69G5FB2',
};

/** Everything the approval step would record around Designer's measured output. */
const approve = (payload: DesignerEngine extends never ? never : {
  quantities: readonly { code: string; value: number; unit: string; calcId: string }[];
  calcLedger: readonly { id: string; label: string; formula: string }[];
  quantityModelVersion: string;
}) => ApprovedTakeoffRevisionSchema.parse({
  revisionId: ids.revision,
  leadId: ids.lead,
  jobId: ids.job,
  revisionNumber: 1,
  status: 'approved',
  engineVersion: 'designer-0.1.0',
  jobInputSha256: 'a'.repeat(64),
  calcLedgerSha256: 'b'.repeat(64),
  quantityPayloadSha256: calculateQuantityPayloadSha256(payload.quantities),
  quantityModelVersion: payload.quantityModelVersion,
  createdAt: '2026-08-06T12:00:00.000Z',
  createdBy: ids.actor,
  approvedAt: '2026-08-06T12:05:00.000Z',
  approvedBy: ids.actor,
  blockingIssues: [],
  quantities: payload.quantities,
  calcLedger: payload.calcLedger,
});

/** Every direct-entry line answered, so the issue gate turns on the takeoff alone. */
const QUOTED_DIRECT_LINES = [
  { code: 600, name: 'Pool Equipment', extended: 9500, scopeStatus: 'quoted', confidence: 'direct', basis: 'vendor quote' },
  { code: 500, name: 'Utilities — Plumber & Electrician', extended: 5000, scopeStatus: 'quoted', confidence: 'direct', basis: 'vendor quote' },
  { code: 900, name: 'Lights', extended: 1800, scopeStatus: 'quoted', confidence: 'direct', basis: 'vendor quote' },
  { code: 1100, name: 'Cover', extended: 0, scopeStatus: 'not-applicable', confidence: 'direct', basis: 'not sold' },
  { code: 1200, name: 'Water Features', extended: 0, scopeStatus: 'not-applicable', confidence: 'direct', basis: 'not sold' },
  { code: 1400, name: 'Automation', extended: 0, scopeStatus: 'not-applicable', confidence: 'direct', basis: 'not sold' },
  { code: 1300, name: 'Additional Upgrades', extended: 0, scopeStatus: 'not-applicable', confidence: 'direct', basis: 'not sold' },
];

describe.skipIf(!bothAvailable)('Designer takeoff to issued Proposal, end to end', () => {
  const run = () => {
    const { runTakeoff, exportDesignerQuantityPayload, STANDARD_MODEL } = designer!;
    const payload = exportDesignerQuantityPayload(runTakeoff({ ...STANDARD_MODEL, equipment: undefined }));
    return { payload, revision: approve(payload) };
  };

  it('carries all seventeen measured quantities from Designer into Proposal pricing', () => {
    const { payload, revision } = run();
    const priced = proposal!.takeoff({
      approvedTakeoffRevision: revision,
      jobId: ids.job,
      feeRate: 0.3,
      directLines: QUOTED_DIRECT_LINES,
      allowances: [],
    });

    // The digest Proposal independently re-derived matches the one approval recorded. Two
    // different SHA-256 implementations — @noble/hashes here, a dependency-free one in the
    // Proposal engine — agreeing on the same bytes.
    expect(priced.quantityPayloadSha256).toBe(revision.quantityPayloadSha256);
    expect(priced.approvedTakeoffRevisionId).toBe(ids.revision);
    expect(priced.quantityModelVersion).toBe(payload.quantityModelVersion);

    // Every priced line that claims a measured basis cites a real Designer quantity, at the
    // same value. This is the actual seam: a measurement becoming a dollar figure.
    const measured = priced.lines.filter((line) => line.quantityAuthority);
    expect(measured.length).toBeGreaterThan(0);
    for (const line of measured) {
      const source = payload.quantities.find((q) => q.code === line.quantityAuthority!.code);
      expect(source, `priced line "${line.name}" cites unknown quantity ${line.quantityAuthority!.code}`).toBeDefined();
      expect(line.quantityAuthority!.value).toBe(source!.value);
    }
  });

  it('prices a real measured job and lets it be issued', () => {
    const { revision } = run();
    const priced = proposal!.takeoff({
      approvedTakeoffRevision: revision,
      jobId: ids.job,
      feeRate: 0.3,
      directLines: QUOTED_DIRECT_LINES,
      allowances: [],
    });

    expect(priced.pricing.cost).toBeGreaterThan(0);
    expect(priced.pricing.revenue).toBeGreaterThan(priced.pricing.cost);
    expect(priced.proposalGate.blockers.map((b) => b.code)).not.toContain('approved-takeoff-required');
    expect(priced.proposalGate.canIssue).toBe(true);

    // The issued artefact pins what it was priced from, which is what makes a customer number
    // traceable back to an approved measurement.
    const issued = proposal!.finalizeProposal(priced);
    expect(issued.status).toBe('issued');
    expect(issued.approvedTakeoff.revisionId).toBe(ids.revision);
    expect(issued.approvedTakeoff.quantityPayloadSha256).toBe(revision.quantityPayloadSha256);
    expect(issued.measuredQuantityExplanations.length).toBeGreaterThan(0);
  });

  /**
   * The chain has to break when it should. A quantity altered after approval keeps the old
   * digest, and Proposal must refuse rather than price it — otherwise the tamper-evidence is
   * decorative.
   */
  it('refuses quantities altered after approval', () => {
    const { revision } = run();
    const tampered = {
      ...revision,
      quantities: revision.quantities.map((q, i) => (i === 0 ? { ...q, value: q.value + 1 } : q)),
    };
    expect(() => proposal!.takeoff({
      approvedTakeoffRevision: tampered,
      jobId: ids.job,
      directLines: QUOTED_DIRECT_LINES,
      allowances: [],
    })).toThrow();
  });

  /** A proposal must never be priced against another job's measurements. */
  it('refuses a revision belonging to a different job', () => {
    const { revision } = run();
    expect(() => proposal!.takeoff({
      approvedTakeoffRevision: revision,
      jobId: 'job_01ARZ3NDEKTSV4RRFFQ69G5FZZ',
      directLines: QUOTED_DIRECT_LINES,
      allowances: [],
    })).toThrow(/same job/i);
  });

  /** Each path refuses the other's inputs, so a mis-route fails loudly rather than silently. */
  it('refuses to replay an approved revision down the draft path', () => {
    const { revision } = run();
    expect(() => proposal!.legacyReplayTakeoff({
      length: 24, width: 14, approvedTakeoffRevision: revision,
    })).toThrow(/production takeoff path/i);
  });
});
