/**
 * fetch-stock-images.mjs — download the D-20 stock placeholders declared in
 * config/stock-images.json into public/images/stock/.
 *
 * Why a script instead of nine committed JPEGs and a shrug: the config file records where
 * every image came from and under what licence, and this script is the thing that makes that
 * record verifiable rather than decorative. Delete public/images/stock/, run this, and you
 * get byte-identical files back.
 *
 * Crops are requested from Unsplash's imgix endpoint at the EXACT aspect ratio of the manifest
 * slot each image fills. That is the whole trick behind AC-9.1: because the file already
 * matches the slot's ratio, swapping a real Apex photo in later is a content change with zero
 * layout shift — provided the real photo is cropped to the same ratio.
 *
 * Usage:
 *   npm run stock:fetch            # download anything missing
 *   npm run stock:fetch -- --force # re-download everything
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'config', 'stock-images.json'), 'utf8'));
const force = process.argv.includes('--force');

const outDir = join(root, ...config.outputDir.split('/'));
mkdirSync(outDir, { recursive: true });

/** Height for a width at a given "W:H" ratio, rounded to a whole pixel. */
function heightFor(width, ratio) {
  const [w, h] = ratio.split(':').map(Number);
  return Math.round((width * h) / w);
}

/**
 * Unsplash imgix params. `fit=crop&crop=entropy` picks the most detailed region rather than
 * the geometric centre, which matters when a hard crop would otherwise cut the subject out.
 */
function sourceUrl(id, width, ratio) {
  const height = heightFor(width, ratio);
  const params = new URLSearchParams({
    w: String(width),
    h: String(height),
    fit: 'crop',
    crop: 'entropy',
    q: '75',
    fm: 'jpg',
    auto: 'format',
  });
  return `https://images.unsplash.com/${id}?${params}`;
}

const fileName = (slot, width) => `${slot}-${width}.jpg`;

let downloaded = 0;
let skipped = 0;
let failed = 0;

console.log(`\nFetching stock placeholders → ${config.outputDir}/\n`);

for (const img of config.images) {
  for (const width of img.widths) {
    const name = fileName(img.slot, width);
    const dest = join(outDir, name);

    if (existsSync(dest) && !force) {
      skipped += 1;
      continue;
    }

    const url = sourceUrl(img.unsplashId, width, img.ratio);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      // A truncated or error-page response is still "successful" HTTP. Anything this small
      // is not a photograph, and silently writing it produces a broken image at review time.
      if (buf.length < 5000) throw new Error(`suspiciously small response (${buf.length} bytes)`);

      writeFileSync(dest, buf);
      downloaded += 1;
      console.log(`  ✔ ${name.padEnd(26)} ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${name.padEnd(26)} ${err.message}`);
    }
  }
}

const totalBytes = config.images
  .flatMap((i) => i.widths.map((w) => join(outDir, fileName(i.slot, w))))
  .filter(existsSync)
  .reduce((sum, f) => sum + statSync(f).size, 0);

console.log(
  `\n${downloaded} downloaded, ${skipped} already present, ${failed} failed — ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB on disk.\n`,
);
console.log(`Licence: ${config.license.name} (${config.license.url})`);
console.log('These are PLACEHOLDERS. They are not Apex\'s work and the alt text does not say');
console.log('they are. `npm run preflight` warns while any stock image is still in place.\n');

if (failed) process.exit(1);
