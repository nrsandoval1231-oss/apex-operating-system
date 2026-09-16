/**
 * verify-redirects.mjs — prove the migration is lossless (AC-7.1, AC-7.2).
 *
 * Reads config/redirects.json and hits every rule against a live host. For each old URL it
 * asserts the four things that actually matter, in the order they cost you money:
 *
 *   1. It redirects at all           — a 404 or 200 here is a ranking dropped on the floor.
 *   2. With 301, not 302             — a 302 tells Google to keep the OLD url indexed, so the
 *                                      new one never inherits anything. Silent and permanent.
 *   3. In ONE hop                    — every extra hop leaks equity and adds latency, and
 *                                      chains are trivially avoidable (point A straight at C).
 *   4. To the destination the map says, and that destination returns 200.
 *
 * It also spot-checks the new site's own launch-critical URLs: the five real pages, the
 * sitemap, and robots.txt — because a perfect redirect map pointing at a `Disallow: /`
 * robots.txt is still a site that vanishes from search.
 *
 * Usage:
 *   node scripts/verify-redirects.mjs --base https://apexgetsitdone.com
 *   node scripts/verify-redirects.mjs --base http://localhost:4321 --skip-legacy
 *
 * Exits non-zero on any failure, so it can gate a deploy. Network-only; changes nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(join(__dirname, '..', 'config', 'redirects.json'), 'utf8'),
);

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const skipLegacy = args.includes('--skip-legacy');
const base = (baseIdx !== -1 ? args[baseIdx + 1] : '')?.replace(/\/+$/, '');

if (!base) {
  console.error(
    'Usage: node scripts/verify-redirects.mjs --base https://DOMAIN [--skip-legacy]\n\n' +
      'Run against staging before DNS, and against production immediately after cutover.',
  );
  process.exit(2);
}

const results = [];
const record = (ok, label, detail) => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? '✔' : '✗'} ${label}${detail ? `\n      ${detail}` : ''}`);
};

/** One request, no automatic following, so each hop is observable. */
async function head(url) {
  const res = await fetch(url, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
}

/** Resolve a redirect chain, capped so a redirect loop terminates instead of hanging. */
async function follow(url, max = 5) {
  const chain = [];
  let current = url;
  for (let i = 0; i < max; i++) {
    const { status, location } = await head(current);
    chain.push({ url: current, status, location });
    if (status < 300 || status >= 400 || !location) break;
    current = new URL(location, current).href;
  }
  return chain;
}

async function checkRedirect(fromUrl, expectedTo, label) {
  let chain;
  try {
    chain = await follow(fromUrl);
  } catch (err) {
    record(false, label, `request failed: ${err.message}`);
    return;
  }

  const first = chain[0];
  const last = chain[chain.length - 1];

  if (first.status < 300 || first.status >= 400) {
    record(false, label, `expected a redirect, got ${first.status}. This URL's ranking is lost.`);
    return;
  }
  if (first.status !== 301) {
    record(
      false,
      label,
      `got ${first.status}, expected 301. A ${first.status} keeps the OLD url indexed.`,
    );
    return;
  }
  if (chain.length > 2) {
    record(
      false,
      label,
      `redirect chain (${chain.length - 1} hops): ${chain.map((c) => c.status).join(' → ')}. ` +
        `Point the first URL directly at ${last.url}.`,
    );
    return;
  }
  if (last.status !== 200) {
    record(false, label, `lands on ${last.status} at ${last.url} — a redirect to a dead page.`);
    return;
  }
  if (expectedTo) {
    const actual = new URL(last.url).pathname.replace(/\/$/, '') || '/';
    const wanted = expectedTo.replace(/\/$/, '') || '/';
    if (actual !== wanted && !last.url.startsWith(expectedTo)) {
      record(false, label, `landed on ${actual}, map says ${wanted}`);
      return;
    }
  }
  record(true, label, `301 → ${last.url}`);
}

async function checkOk(url, label, assert) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return record(false, label, `${res.status} ${res.statusText}`);
    if (assert) {
      const body = await res.text();
      const problem = assert(body);
      if (problem) return record(false, label, problem);
    }
    record(true, label, `200`);
  } catch (err) {
    record(false, label, `request failed: ${err.message}`);
  }
}

/* ------------------------------------------------------------------------ run */

console.log(`\nVerifying against ${base}\n`);

console.log('New site — launch-critical URLs');
for (const path of ['/', '/pools', '/coating', '/renovation', '/service']) {
  await checkOk(`${base}${path}`, `GET ${path}`);
}
await checkOk(`${base}/sitemap.xml`, 'GET /sitemap.xml', (body) => {
  if (!body.includes('<urlset')) return 'not a sitemap';
  const count = (body.match(/<loc>/g) || []).length;
  if (count < 5) return `only ${count} <loc> entries — expected at least 5`;
  if (config.canonicalDomain && !body.includes(config.canonicalDomain)) {
    return `does not reference the canonical domain ${config.canonicalDomain} — PUBLIC_SITE_URL was wrong at build time`;
  }
  return null;
});
await checkOk(`${base}/robots.txt`, 'GET /robots.txt', (body) => {
  if (/^\s*Disallow:\s*\/\s*$/m.test(body)) {
    return (
      'robots.txt says "Disallow: /" — this build was NOT made with PUBLIC_ENV=production. ' +
      'Shipping it removes the site from search entirely. Highest-consequence bug available at cutover.'
    );
  }
  if (!/Sitemap:/i.test(body)) return 'no Sitemap: line';
  return null;
});

console.log('\nPage-level redirects (old site → new site)');
if (!config.pages?.length) {
  record(
    false,
    'redirect map is empty',
    'config/redirects.json has no page rules — BLOCKED on D-01 (old-URL inventory needs ' +
      'Search Console + GA4 access). Nothing to verify, and nothing protecting the old rankings.',
  );
} else {
  for (const p of config.pages) {
    await checkRedirect(`${base}${p.from}`, p.to, `${p.from} → ${p.to}`);
  }
}

if (!skipLegacy) {
  console.log('\nLegacy domains (AC-7.2)');
  if (!config.canonicalDomain) {
    record(false, 'canonical domain unset', 'BLOCKED on D-03 — cannot assert a destination.');
  }
  for (const d of config.legacyDomains ?? []) {
    for (const scheme of ['http', 'https']) {
      await checkRedirect(`${scheme}://${d.domain}/`, d.to, `${scheme}://${d.domain}/ → ${d.to}`);
    }
  }
}

/* -------------------------------------------------------------------- summary */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.\n`);
if (failed.length) {
  console.error(`${failed.length} FAILED — do not cut over DNS until these are resolved.\n`);
  process.exit(1);
}
console.log('Migration checks clean. Re-run 24h after cutover — DNS propagates unevenly.\n');
