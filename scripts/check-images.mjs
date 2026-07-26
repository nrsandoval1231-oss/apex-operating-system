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
let total = 0;
let m;
while ((m = slotRe.exec(source)) !== null) {
  const [, id, body] = m;
  // Only count real slots (they declare a `src:` field).
  if (!/\bsrc:\s*/.test(body)) continue;
  total += 1;
  const labelMatch = body.match(/label:\s*'([^']*)'/);
  if (/\bsrc:\s*null\b/.test(body)) {
    unfilled.push({ id, label: labelMatch ? labelMatch[1] : '' });
  }
}

console.log(`\nApex image manifest — ${total} slot(s), ${unfilled.length} unfilled.\n`);
if (unfilled.length) {
  console.log('Unfilled placeholder slots (D-20 photography pending):');
  for (const s of unfilled) {
    console.log(`  • ${s.id.padEnd(18)} ${s.label}`);
  }
  console.log(
    '\nThese render as visibly-labeled placeholders. Fill `src` (+ optional `srcset`)',
  );
  console.log('in src/content/images.ts to swap in a real photo — no layout change.\n');
} else {
  console.log('All slots filled. ✔\n');
}

if (strict && unfilled.length) {
  console.error(`check-images: ${unfilled.length} unfilled slot(s) — failing (--strict).`);
  process.exit(1);
}
