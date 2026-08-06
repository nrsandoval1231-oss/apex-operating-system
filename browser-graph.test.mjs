/**
 * The builder page is a shipped artifact with no test around it, which is how it
 * came to be completely inert without anyone noticing. Two failures happened at
 * once and both were statically detectable:
 *
 *   1. approved-takeoff.mjs and engine.mjs imported `node:crypto`. A browser
 *      cannot resolve a `node:` specifier, so the whole module graph failed to
 *      evaluate — no handler attached, every output read "—", and clicking
 *      Generate customer proposal did nothing at all, silently.
 *
 *   2. index.html called `takeoff`, the production path, which throws without an
 *      approved Designer revision the page cannot supply. Once (1) was fixed the
 *      page still could not price anything.
 *
 * This does not render the page. It reads the module graph the page actually
 * pulls in and asserts the two properties that were violated, which is enough to
 * stop both from recurring and costs nothing to run.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(resolve(here, name), 'utf8');

const failures = [];
const check = (name, condition, detail) => {
  if (condition) console.log(`PASS ${name}`);
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

const html = read('index.html');

// The <script type="module"> block is what the browser evaluates.
const inlineModule = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
check('index.html carries an inline module', Boolean(inlineModule));

// Every module the page can reach, followed transitively from its own imports.
const graph = new Set();
const walk = (source) => {
  for (const [, specifier] of source.matchAll(/(?:^|\n)\s*import[^'"]*['"](\.\/[^'"]+)['"]/g)) {
    const name = specifier.slice(2);
    if (graph.has(name)) continue;
    graph.add(name);
    walk(read(name));
  }
};
walk(inlineModule ?? '');

check('the page reaches engine.mjs', graph.has('engine.mjs'), [...graph].join(', '));

// (1) No `node:` builtin anywhere the browser has to load.
for (const name of graph) {
  const offenders = [...read(name).matchAll(/from\s+['"](node:[^'"]+)['"]/g)].map((m) => m[1]);
  check(`${name} imports no node: builtin`, offenders.length === 0, offenders.join(', '));
}

/*
 * (2) The page must carry BOTH takeoff paths and choose between them.
 *
 * This assertion was the opposite until 2026-08-06: it required the page NOT to import the
 * production path. That guard was correct for its time and its stated reason was explicit —
 * the production path "throws without an approved Designer revision, WHICH THIS PAGE CANNOT
 * SUPPLY". The page can supply one now: it loads an approved revision, validates it through
 * readApprovedQuantityAuthority, and routes to the production path only when one is pinned.
 * The premise expired, so the assertion had to change rather than be worked around.
 *
 * What must not be lost is the fail-closed boundary, and that is not a question about imports.
 * It is asserted at runtime below, in both directions.
 */
check(
  'index.html imports the no-revision path',
  /(?<![\w])legacyReplayTakeoff\s*(?:,|\})/.test(inlineModule ?? ''),
  'draft pricing must still work with no revision loaded',
);
check(
  'index.html imports the production path',
  /(?<![\w])takeoff\s+as\s+\w+/.test(inlineModule ?? ''),
  'the page can now price against an approved Designer revision',
);
check(
  'index.html routes on a pinned revision rather than calling one path unconditionally',
  /approvedRevision\s*\?/.test(inlineModule ?? ''),
  'each path refuses the other\'s inputs, so the choice must be explicit',
);

// Draft pricing is not permission to issue. If this ever passes, the fail-closed
// boundary between a draft and a customer-issuable proposal has been lost.
const { legacyReplayTakeoff, takeoff: productionTakeoff } = await import('./engine.mjs');
const draft = legacyReplayTakeoff({ length: 24, width: 14, spa: {} });
check('a draft prices', draft.pricing.cost > 0, String(draft.pricing.cost));
check(
  'a draft still cannot be issued',
  draft.proposalGate.canIssue === false
    && draft.proposalGate.blockers.some((blocker) => blocker.code === 'approved-takeoff-required'),
  JSON.stringify(draft.proposalGate.blockers?.map((b) => b.code)),
);

/*
 * The two paths must keep refusing each other's inputs. This is what makes the page's routing
 * safe: if either guard were relaxed, a mis-routed call would silently price a customer
 * proposal against the wrong quantity authority instead of throwing.
 */
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const { approvedTakeoffFixture } = await import('./approved-takeoff.fixture.mjs');
check(
  'the production path refuses to run without a revision',
  throws(() => productionTakeoff({ length: 24, width: 14, spa: {} })),
);
check(
  'the legacy path refuses to run with a revision',
  throws(() => legacyReplayTakeoff({ length: 24, width: 14, spa: {}, approvedTakeoffRevision: approvedTakeoffFixture() })),
);

/*
 * And the wiring has to actually clear the blocker it was built to clear. Without this, the
 * loader could silently stop pinning and every proposal would quietly fall back to being
 * unissuable — which is precisely the state this change existed to fix.
 */
const priced = productionTakeoff({
  length: 24, width: 14, spa: {},
  approvedTakeoffRevision: approvedTakeoffFixture(),
  directLines: [], allowances: [],
});
check(
  'an approved revision clears the approved-takeoff blocker',
  !priced.proposalGate.blockers.some((blocker) => blocker.code === 'approved-takeoff-required'),
  JSON.stringify(priced.proposalGate.blockers?.map((b) => b.code)),
);
check(
  'a revision-priced takeoff carries the digest it was priced from',
  /^[a-f0-9]{64}$/.test(priced.quantityPayloadSha256 ?? ''),
  String(priced.quantityPayloadSha256),
);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`\n${failures.length} fail`);
  process.exit(1);
}
console.log('\nall pass / 0 fail');
