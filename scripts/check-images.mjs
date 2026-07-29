/**
 * check-images.mjs — build-time image-slot check (AC-9.4).
 *
 * Lists every image slot whose `src` is still null (an unfilled placeholder), so none
 * ships by accident. Reports by default (exit 0); pass `--strict` to FAIL the build when
 * any slot is unfilled — wire that into the Phase 5 launch gate once D-20 photography
 * lands. Reads the manifest via a regex parse so it needs no TS toolchain.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'src', 'content', 'images.ts');
const strict = process.argv.includes('--strict');

const source = readFileSync(manifestPath, 'utf8');

// Match each slot object: `'id': { ... }` up to the closing brace of that object.
const slotRe = /'([\w-]+)':\s*\{([^}]*)\}/g;
const unfilled = [];
const stock = [];
let total = 0;
let m;
while ((m = slotRe.exec(source)) !== null) {
  const [, id, body] = m;
  // Only count real slots (they declare a `src:` field).
  if (!/\bsrc:\s*/.test(body)) continue;
  total += 1;
  const labelMatch = body.match(/label:\s*'([^']*)'/);
  const label = labelMatch ? labelMatch[1] : '';
  if (/\bsrc:\s*null\b/.test(body)) unfilled.push({ id, label });
  else if (/\bstock:\s*true\b/.test(body)) stock.push({ id, label });
}

const real = total - unfilled.length - stock.length;
console.log(
  `\nApex image manifest — ${total} slot(s): ${real} real, ${stock.length} stock, ${unfilled.length} blank.\n`,
);

if (unfilled.length) {
  console.log('Blank slots (render as labeled grey boxes):');
  for (const s of unfilled) console.log(`  • ${s.id.padEnd(18)} ${s.label}`);
  console.log('');
}

if (stock.length) {
  // The labels double as the shot list — each says what real photo should replace the stock.
  console.log('Stock placeholders — the shot list for a real photo session (D-20):');
  for (const s of stock) console.log(`  • ${s.id.padEnd(18)} ${s.label}`);
  console.log('\nProvenance and licence: config/stock-images.json');
  console.log('Replacing one is a content change only: drop the file in, update `src`/`srcset`,');
  console.log('set `stock: false`, and rewrite `alt` to describe the actual job.\n');
}

if (!unfilled.length && !stock.length) console.log('Every slot holds real Apex photography. ✔\n');

// --strict is the launch gate: neither a blank slot nor a stock stand-in should ship silently.
const outstanding = unfilled.length + stock.length;
if (strict && outstanding) {
  console.error(`check-images: ${outstanding} slot(s) not real photography — failing (--strict).`);
  process.exit(1);
}
