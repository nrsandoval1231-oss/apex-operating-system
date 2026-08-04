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

// (2) The page must use the path that does not demand an approved revision.
// Checked on the import statement rather than call sites, because aliasing
// `legacyReplayTakeoff as takeoff` is exactly what report.mjs and backtest.mjs do.
const importsProductionPath = /import\s*\{[^}]*(?<![\w])takeoff\s*(?:,|\})/.test(
  (inlineModule ?? '').replace(/legacyReplayTakeoff as takeoff/g, 'legacyReplayTakeoff as ALIASED'),
);
check(
  'index.html does not import the production takeoff path',
  !importsProductionPath,
  'the production path throws without an approved Designer revision, which this page cannot supply',
);
check(
  'index.html imports the no-revision path',
  /legacyReplayTakeoff\s+as\s+takeoff/.test(inlineModule ?? ''),
);

// Draft pricing is not permission to issue. If this ever passes, the fail-closed
// boundary between a draft and a customer-issuable proposal has been lost.
const { legacyReplayTakeoff } = await import('./engine.mjs');
const draft = legacyReplayTakeoff({ length: 24, width: 14, spa: {} });
check('a draft prices', draft.pricing.cost > 0, String(draft.pricing.cost));
check(
  'a draft still cannot be issued',
  draft.proposalGate.canIssue === false
    && draft.proposalGate.blockers.some((blocker) => blocker.code === 'approved-takeoff-required'),
  JSON.stringify(draft.proposalGate.blockers?.map((b) => b.code)),
);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`\n${failures.length} fail`);
  process.exit(1);
}
console.log('\nall pass / 0 fail');
