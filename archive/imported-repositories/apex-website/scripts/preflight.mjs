/**
 * preflight.mjs — is the bundle in dist/ actually safe to put on the real domain?
 *
 * Run AFTER `npm run build`, BEFORE upload. Every check here corresponds to a way a
 * technically-successful build still ships broken, and most of them are silent — you find
 * out from a traffic graph three weeks later, not from an error.
 *
 * The single most dangerous one is `robots.txt`. A build made without PUBLIC_ENV=production
 * ships `Disallow: /`, which is a perfectly valid file that removes the entire site from
 * search. It looks fine in a browser. Nothing complains.
 *
 * Usage:
 *   npm run build && node scripts/preflight.mjs
 *   node scripts/preflight.mjs --allow-placeholders   # ship with D-20 image slots unfilled
 *
 * Exits non-zero if any BLOCKER fails. Warnings never fail the run — they are judgement
 * calls that belong to the maintainer, not to a script.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const allowPlaceholders = process.argv.includes('--allow-placeholders');

const blockers = [];
const warnings = [];
const passed = [];

const block = (msg, why) => blockers.push({ msg, why });
const warn = (msg, why) => warnings.push({ msg, why });
const pass = (msg) => passed.push(msg);

if (!existsSync(dist)) {
  console.error('\ndist/ not found. Run `npm run build` first.\n');
  process.exit(2);
}

/** Every .html file in dist/, with its site path. */
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

const pages = htmlPages().map((p) => ({ ...p, html: readFileSync(p.file, 'utf8') }));
const attr = (html, re) => (html.match(re) || [])[1] ?? null;

/* ------------------------------------------------------- 1. robots.txt (the big one) */

const robotsPath = join(dist, 'robots.txt');
if (!existsSync(robotsPath)) {
  block('robots.txt is missing', 'Crawlers get no guidance and the sitemap is undiscoverable.');
} else {
  const robots = readFileSync(robotsPath, 'utf8');
  if (/^\s*Disallow:\s*\/\s*$/m.test(robots)) {
    block(
      'robots.txt contains "Disallow: /"',
      'This build was NOT made with PUBLIC_ENV=production. Uploading it de-indexes the entire ' +
        'site. Rebuild with PUBLIC_ENV=production.',
    );
  } else if (!/Sitemap:/i.test(robots)) {
    block('robots.txt has no Sitemap: line', 'Search Console discovery gets slower for no reason.');
  } else {
    pass('robots.txt allows crawling and points at the sitemap');
  }
}

/* ----------------------------------------------------------------- 2. sitemap.xml */

const sitemapPath = join(dist, 'sitemap.xml');
let sitemapDomain = null;
if (!existsSync(sitemapPath)) {
  block('sitemap.xml is missing', 'AC-5.4.');
} else {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (locs.length < 5) {
    block(`sitemap.xml lists only ${locs.length} URL(s)`, 'Expected the home page plus four verticals.');
  } else {
    sitemapDomain = new URL(locs[0]).origin;
    if (sitemapDomain.includes('localhost')) {
      block('sitemap.xml points at localhost', 'PUBLIC_SITE_URL was unset at build time.');
    } else {
      pass(`sitemap.xml lists ${locs.length} URLs on ${sitemapDomain}`);
    }
    // Every sitemap URL must correspond to a page that actually built.
    const built = new Set(pages.map((p) => p.path || '/'));
    for (const loc of locs) {
      const p = new URL(loc).pathname.replace(/\/$/, '') || '/';
      if (!built.has(p)) block(`sitemap lists ${p} but no such page exists in dist/`, 'A 404 in the sitemap.');
    }
  }
}

/* ---------------------------------------------- 3. per-page SEO head (AC-5.2, AC-5.3) */

const seoBlockersBefore = blockers.length;
const titles = new Map();
const descriptions = new Map();
for (const p of pages) {
  const label = p.path || '/';
  const title = attr(p.html, /<title>([^<]*)<\/title>/);
  const desc = attr(p.html, /<meta name="description" content="([^"]*)"/);
  const canonical = attr(p.html, /<link rel="canonical" href="([^"]*)"/);
  const h1s = (p.html.match(/<h1[\s>]/g) || []).length;

  if (!title) block(`${label}: no <title>`, 'AC-5.2.');
  if (!desc) block(`${label}: no meta description`, 'AC-5.2.');
  if (h1s !== 1) block(`${label}: ${h1s} <h1> elements`, 'Exactly one is required — AC-5.3.');
  if (!canonical) block(`${label}: no canonical link`, 'AC-5.2.');
  else if (sitemapDomain && !canonical.startsWith(sitemapDomain)) {
    block(
      `${label}: canonical is ${canonical} but the sitemap uses ${sitemapDomain}`,
      'Canonical and sitemap disagreeing is a classic duplicate-content trigger.',
    );
  }
  if (title) titles.set(label, title);
  if (desc) descriptions.set(label, desc);
}
for (const [field, map] of [['title', titles], ['meta description', descriptions]]) {
  const byValue = new Map();
  for (const [label, value] of map) byValue.set(value, [...(byValue.get(value) ?? []), label]);
  for (const [value, labels] of byValue) {
    if (labels.length > 1) {
      block(
        `duplicate ${field} across ${labels.join(', ')}`,
        `Each page needs its own (AC-5.2). Shared: "${value.slice(0, 60)}…"`,
      );
    }
  }
}
if (blockers.length === seoBlockersBefore) {
  pass(`${pages.length} pages each have a unique title, description, canonical, and one <h1>`);
}

/* --------------------------------------------------- 4. the lead spine (Hard rule 6) */

const homeHtml = pages.find((p) => (p.path || '/') === '/')?.html ?? '';
const allHtml = pages.map((p) => p.html).join('\n');

if (/webhook-test/.test(allHtml)) {
  block(
    'the built output references a "webhook-test" URL',
    'This is a non-production build — leads would post to the TEST endpoint and never reach ' +
      'anyone. Rebuild with PUBLIC_ENV=production (Hard rule 6 / AC-1.7).',
  );
} else if (/\/webhook\//.test(allHtml)) {
  pass('quote form points at the production lead webhook');
} else {
  warn('no lead webhook URL found in the output', 'The form island may not have rendered.');
}

/* -------------------------------------------------------------- 5. analytics (D-01) */

if (/googletagmanager\.com/.test(homeHtml)) {
  pass('analytics container is present');
} else {
  warn(
    'no analytics container in the build',
    'lead_submit will fire into an empty dataLayer and no conversion is measurable — the ' +
      'entire point of the per-vertical tagging. Set PUBLIC_GTM_ID (gated on D-01 access transfer).',
  );
}

/* --------------------------------------------------------------- 6. imagery (D-20) */

const unfilled = (allHtml.match(/data-image-unfilled="true"/g) || []).length;
const stock = (allHtml.match(/data-stock="true"/g) || []).length;

if (unfilled > 0) {
  const msg = `${unfilled} blank image placeholder(s) in the built pages`;
  const why =
    'These render as visibly-labeled grey slots. Fill them in src/content/images.ts. ' +
    'Pass --allow-placeholders to ship anyway.';
  if (allowPlaceholders) warn(msg, why);
  else block(msg, why);
}

if (stock > 0) {
  const msg = `${stock} image(s) are licensed STOCK photos, not Apex's work (D-20)`;
  const why =
    'They are correctly captioned — no alt text claims Apex did this work — so this is not a ' +
    'misrepresentation. It is a conversion problem: real project photography is the primary ' +
    'asset for a considered purchase at pool prices, and a local buyer recognises stock. The ' +
    'pools hero is the one carrying the most weight. Run `npm run check:images` for the shot ' +
    'list. Pass --allow-placeholders to ship anyway.';
  if (allowPlaceholders) warn(msg, why);
  else block(msg, why);
}

if (!unfilled && !stock) pass('every image is real Apex photography');
else if (!unfilled) pass('no blank image slots (all filled, some with stock)');

/* ------------------------------------------------------------------ 7. social card */

if (!/property="og:image"/.test(homeHtml)) {
  warn(
    'no og:image — links shared to Facebook/SMS render as a bare text card',
    'Blocked on D-20. Set PUBLIC_OG_IMAGE (1200×630) once real imagery exists. This directly ' +
      'affects click-through on the paid social traffic the site is built to convert.',
  );
} else {
  pass('og:image is set');
}

/* --------------------------------------------------------------- 8. legal reachable */

// Must be a real anchor, not the words "Privacy Policy" rendered as plain text — the
// distinction is the entire point, and a substring match would happily pass on the latter.
const privacyLink = /<a[^>]+href="([^"]+)"[^>]*>[^<]*privacy[^<]*<\/a>/i.exec(allHtml);
if (!privacyLink) {
  block(
    'no privacy policy LINK found in the output',
    'The site collects SMS consent. Carriers require a reachable privacy policy naming SMS ' +
      'for A2P 10DLC registration, and TCPA exposure is the reason consent is per-vertical. ' +
      'Text that merely says "Privacy Policy" does not satisfy this.',
  );
} else if (privacyLink[1] === '#' || privacyLink[1].trim() === '') {
  block('the privacy policy link has no destination', `href="${privacyLink[1]}"`);
} else {
  pass(`privacy policy is linked (${privacyLink[1]})`);
}

// The linked policy must actually be a page in this build, not a promise.
for (const [label, route] of [['privacy policy', '/privacy'], ['terms', '/terms']]) {
  if (pages.some((p) => (p.path || '/') === route)) pass(`${label} page exists at ${route}`);
  else block(`${label} route ${route} is missing from the build`, 'The footer links to it.');
}

/* --------------------------------------------------- 8b. legal text has been reviewed */

/*
 * The legal copy on this site was transcribed verbatim from the previous site, and it does
 * not currently describe this business: it names the wrong domain, covers two of four
 * verticals, and gives contact details that disagree with the rest of the site. Those are
 * faithfully reproduced rather than quietly edited, because editing them is a lawyer's call.
 *
 * This check exists so that decision cannot be forgotten. It reads the flag rather than the
 * prose — a human has to assert the text is fit for use.
 */
const legalSrc = readFileSync(join(root, 'src', 'content', 'legal.ts'), 'utf8');
const unreviewed = [...legalSrc.matchAll(/title:\s*'([^']+)'[\s\S]{0,400}?reviewed:\s*(true|false)/g)]
  .filter((m) => m[2] === 'false')
  .map((m) => m[1]);

if (unreviewed.length) {
  block(
    `legal text not signed off: ${unreviewed.join(', ')}`,
    'Transcribed verbatim from the old site and NOT yet reviewed for use on this one. It ' +
      'names apexcoatinglbk.com, covers only 2 of the 4 verticals, and lists contact details ' +
      'that differ from the site. Have counsel review, then set `reviewed: true` in ' +
      'src/content/legal.ts. This is the one preflight blocker no engineer can clear.',
  );
} else {
  pass('legal documents are signed off for use on this site');
}

/* -------------------------------------------------------------------- report */

console.log('\nApex website — pre-cutover preflight\n');
for (const p of passed) console.log(`  ✔ ${p}`);
if (warnings.length) {
  console.log('\nWarnings (judgement calls — these do not fail the run):');
  for (const w of warnings) console.log(`  ⚠ ${w.msg}\n      ${w.why}`);
}
if (blockers.length) {
  console.log('\nBLOCKERS — do not upload this build:');
  for (const b of blockers) console.log(`  ✗ ${b.msg}\n      ${b.why}`);
}
console.log('');

if (blockers.length) {
  console.error(`preflight: ${blockers.length} blocker(s).\n`);
  process.exit(1);
}
console.log('Preflight clean. Next: docs/launch-checklist.md (DNS, access, verification).\n');
