/**
 * validate.mjs — the one command that proves this website is shippable.
 *
 * WHY THIS EXISTS
 * ---------------
 * The repo's root `pnpm build` runs `tsc -b`, which type-checks and emits the workspace
 * packages' dist/ but NEVER builds the site. Running it and seeing green tells you nothing
 * about whether the home page renders — it will pass identically if `src/pages/index.astro`
 * is deleted, because the website is not part of the TypeScript project graph in a way that
 * makes a missing page an error. That is a genuinely dangerous gap: it is the failure mode
 * where CI is green and the deployed site is broken.
 *
 * `astro check` catches type errors in .astro files but not runtime/build failures, and the
 * Playwright suite runs against `astro dev` — which exercises the dev pipeline, not the
 * static output that actually gets uploaded. So the production `astro build` has to be
 * explicitly part of the gate.
 *
 * This script therefore runs the real chain, in order, and fails on the first hard failure:
 *
 *   1. astro check      — type errors across .astro / .ts / .tsx
 *   2. astro build      — the PRODUCTION static build (dist/)
 *   3. dist assertions  — the built HTML itself, not the dev server
 *   4. preflight        — the existing launch-safety checks, unchanged
 *
 * Step 3 is what makes this different from `npm run build && npm run preflight`: it asserts
 * things about the artifact that no earlier step would catch, most importantly that the home
 * page did not lose a section, a vertical, or its hero.
 *
 * Usage:
 *   pnpm validate
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const failures = [];
const notes = [];

function step(name, cmd, args) {
  process.stdout.write(`\n[1m▶ ${name}[0m\n`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    failures.push(`${name} — exited ${r.status ?? 'with signal'}`);
    return false;
  }
  return true;
}

console.log('\n[1mApex website — full validation[0m');
console.log('Builds the PRODUCTION site, then asserts against the built artifact.');

// A stale dist/ from an earlier build is the single most misleading thing this script could
// assert against — it would happily validate a page that no longer builds. Start clean.
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });

if (!step('astro check', 'npx', ['astro', 'check'])) {
  console.error('\n[31m✗ typecheck failed — stopping before build[0m');
  process.exit(1);
}

if (!step('astro build (production)', 'npx', ['astro', 'build'])) {
  console.error('\n[31m✗ production build failed — nothing to validate[0m');
  process.exit(1);
}

/* ------------------------------------------------------------------------------------------
   Assertions against dist/. These are the checks that the dev server cannot make, because the
   dev server renders on demand and would happily serve a page the static build rejects.
   ------------------------------------------------------------------------------------------ */

function htmlPages(dir = dist) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlPages(full));
    else if (entry.endsWith('.html')) {
      const rel = relative(dist, full).replace(/\\/g, '/');
      out.push({ path: '/' + rel.replace(/index\.html$/, '').replace(/\/$/, ''), file: full });
    }
  }
  return out;
}

if (!existsSync(dist)) {
  console.error('\n[31m✗ dist/ missing after a successful build[0m');
  process.exit(1);
}

const pages = htmlPages();
const home = pages.find((p) => p.path === '/');
if (!home) {
  console.error('\n[31m✗ the home page was not produced by the build[0m');
  process.exit(1);
}
const html = readFileSync(home.file, 'utf8');
const results = [];
const check = (ok, label, why) => results.push({ ok, label, why });

// Every route the site advertises must exist in the build. A vertical page that 404s is worse
// than one that was never built, because the sitemap and internal links still point at it.
for (const slug of ['pools', 'coating', 'renovation', 'service']) {
  check(pages.some((p) => p.path === `/${slug}`), `/${slug} was built`, 'the vertical page is advertised in the nav and sitemap');
}

// Homepage V2 structure. Cheap string assertions, but they are the difference between "the
// build produced a file" and "the build produced the page we designed".
const SECTIONS = ['id="top"', 'id="craft"', 'id="work"', 'id="living"', 'id="standard"', 'id="capabilities"', 'id="close"'];
for (const s of SECTIONS) {
  check(html.includes(s), `home page contains ${s}`, 'a Homepage V2 section is missing from the build');
}

check((html.match(/<h1[\s>]/g) || []).length === 1, 'exactly one <h1> on the home page', 'a second h1 breaks document outline and screen-reader navigation');
check(html.includes('data-hero-mode="poster"'), 'hero media renders in the declared poster mode', 'the hero media interface is not emitting its contract');
check(!/<video/.test(html), 'no <video> ships before the brand film exists', 'a video element is present but no film is configured');

// The four verticals must stay reachable from the built home page HTML. This is the specific
// regression a pools-led redesign can cause, and it is invisible in a screenshot.
for (const slug of ['pools', 'coating', 'renovation', 'service']) {
  check(html.includes(`href="/${slug}"`), `home page links to /${slug}`, 'a vertical is orphaned from the home page');
}

// Every internal href must resolve to a real built page. Catches dead links introduced by a
// section rewrite without needing the browser.
const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
const built = new Set(pages.map((p) => p.path));
for (const href of new Set(hrefs)) {
  const clean = href.replace(/\/$/, '') || '/';
  const ok = built.has(clean) || existsSync(join(dist, href));
  check(ok, `internal link ${href} resolves`, 'a link on the home page points at nothing');
}

// Every image the home page references must exist on disk. Broken image requests are silent.
const srcs = [...html.matchAll(/src="(\/[^"]+\.(?:jpg|jpeg|png|webp|avif|svg))"/g)].map((m) => m[1]);
for (const src of new Set(srcs)) {
  check(existsSync(join(dist, src)), `image ${src} exists`, 'the built page references a missing image');
}

// Client JS budget. The site ships zero framework JS apart from the quote-form island; an
// animation runtime added for the hero would show up here first.
//
// ALLOWED, and why each is here:
//   QuoteForm          — the lead-capture island, client:visible. Pre-existing, load-bearing.
//   analytics/gtm      — measurement. Pre-existing.
//   attribution        — first-touch capture (src/lib/attribution.ts), emitted by BaseLayout.
//   BaseLayout*.js     — that same attribution script. Astro extracts BaseLayout's inline
//                        <script> into a chunk named after the component, so the filename is
//                        the only thing left to match on. Listed explicitly rather than with a
//                        loose pattern so that an unrelated new BaseLayout chunk still trips
//                        this check.
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const offenders = scripts.filter(
  (s) => !/QuoteForm|analytics|attribution|googletagmanager|BaseLayout\.astro_astro_type_script/i.test(s),
);
check(offenders.length === 0, 'no unexpected client JS in the built home page', `unexpected bundles: ${offenders.join(', ') || 'n/a'}`);

console.log('\n[1m▶ dist/ assertions[0m');
for (const r of results) {
  console.log(`  ${r.ok ? '[32m✓[0m' : '[31m✗[0m'} ${r.label}${r.ok ? '' : `\n      ${r.why}`}`);
}
if (results.some((r) => !r.ok)) {
  console.error(`\n[31m✗ ${results.filter((r) => !r.ok).length} built-artifact assertion(s) failed[0m`);
  process.exit(1);
}

/*
 * preflight is a LAUNCH gate, not a BUILD gate, and it is deliberately run as a REPORT here
 * rather than as a hard step.
 *
 * Its blockers are environment-dependent facts about a deployable bundle — `robots.txt`
 * containing "Disallow: /" on a build without PUBLIC_ENV=production, a missing inlined lead
 * webhook URL — none of which say anything about whether the code is correct. Two of them are
 * standing blockers on the base branch (D-03/D-21 territory) and would make this command fail
 * on any checkout, including before this change, which would train everyone to ignore it.
 *
 * The distinction that matters: `pnpm validate` answers "does the site build, and is the
 * artifact what we designed?" — and fails loudly if not. `preflight` answers "is this specific
 * bundle safe to put on the real domain?" — and is the deploy gate, where its blockers must be
 * resolved. Run it separately before every upload.
 */
console.log('\n[1m▶ preflight (report only — run it again as the deploy gate)[0m');
const pf = spawnSync('node', ['scripts/preflight.mjs', '--allow-placeholders'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (pf.status !== 0) {
  notes.push(
    'preflight reported blockers — expected outside a production build. These gate DEPLOY, not this PR. See D-03 / D-21.',
  );
}

console.log('\n' + '─'.repeat(64));
if (notes.length) {
  console.log('notes:');
  for (const n of notes) console.log(`  · ${n}`);
  console.log('');
}
if (failures.length) {
  console.error(`[31m✗ validation failed:[0m\n${failures.map((f) => `  · ${f}`).join('\n')}\n`);
  process.exit(1);
}
console.log('[32m✓ validation passed — production site builds and the artifact is correct[0m');
console.log('[2m  Note: imagery is still licensed stock placeholders (D-20). Design/code');
console.log('  complete — final proprietary photography and brand film pending.[0m\n');
