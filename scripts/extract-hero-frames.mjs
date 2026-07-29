/**
 * extract-hero-frames.mjs — derive real Apex stills from the hero video.
 *
 * PROVENANCE. Every image in public/images/apex/ comes from public/video/apex-hero.mp4,
 * which is Apex's own footage, downloaded from the live site on 2026-07-29
 * (wp-content/uploads/2024/09/Apex-Main-Hero-Video.mp4). The clip is 15s, 1280×720, h264.
 * It contains two verticals' worth of real work:
 *
 *   0.0–3.0s   a completed pool at night — fire feature, lit sheer descents, flagstone coping
 *   3.0–7.0s   a commercial storefront (Thacker Jewelry) with a coated entry
 *   7.0–15.0s  flake-coated concrete floors, ending on a vintage car on a finished floor
 *
 * This matters because it is the first REAL project photography on the site. Everything else
 * in the image manifest is licensed stock standing in for work Apex didn't do.
 *
 * THE CEILING, stated plainly: the source is 1280×720. Frames are used only where that
 * resolution covers the slot natively — no upscaling anywhere below. The one tight case is
 * pools-hero, whose 4:5 crop can only be 576×720; that is roughly 1x for its display size,
 * so it is real but soft, and a proper photograph should still replace it. See D-20.
 *
 * Usage: npm run frames:extract   (requires ffmpeg on PATH)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/*
 * The FULL 15s source, deliberately outside public/ — visitors are served the trimmed 5.6s
 * pool loop instead (public/video/apex-hero-loop.mp4, ~593 KB). This file is the archive the
 * stills are cut from, and the only place the storefront and coated-floor segments survive.
 */
const video = join(root, 'media', 'apex-hero-source.mp4');
const outDir = join(root, 'public', 'images', 'apex');

if (!existsSync(video)) {
  console.error(`\nMissing ${video}\nIt is committed to the repo; restore it from git.\n`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

/**
 * Each entry records the timestamp it comes from and the exact transform, so any frame can be
 * re-derived or re-judged later. `vf` is passed to ffmpeg verbatim.
 */
const FRAMES = [
  // --- pool at night (t=2.2s) — the widest, best-lit view of the pool ---
  { file: 'hero-poster-1280.jpg', t: 2.2, vf: 'scale=1280:720', use: 'hero video poster (16:9, native)' },
  { file: 'hero-poster-800.jpg', t: 2.2, vf: 'scale=800:450', use: 'hero poster, small viewports' },
  { file: 'og-default.jpg', t: 2.2, vf: 'crop=1280:672:0:24,scale=1200:630', use: 'og:image / twitter:image' },
  { file: 'pools-hero-576.jpg', t: 2.2, vf: 'crop=576:720:352:0', use: 'pools-hero slot (4:5) — resolution-limited, see header' },
  { file: 'tile-pools-800.jpg', t: 2.2, vf: 'crop=960:720:160:0,scale=800:600', use: 'tile-pools slot (4:3)' },

  // --- flake-coated floor (t=14.6s) — the car on a finished floor sells the product ---
  { file: 'card-coating-1280.jpg', t: 14.6, vf: 'scale=1280:720', use: 'card-coating slot (16:9, native)' },
  { file: 'card-coating-800.jpg', t: 14.6, vf: 'scale=800:450', use: 'card-coating, small viewports' },
  { file: 'tile-coating-800.jpg', t: 14.6, vf: 'crop=960:720:160:0,scale=800:600', use: 'tile-coating slot (4:3)' },
];

console.log(`\nExtracting ${FRAMES.length} frames from apex-hero.mp4\n`);
let total = 0;
for (const f of FRAMES) {
  const dest = join(outDir, f.file);
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-ss', String(f.t), '-i', video, '-frames:v', '1', '-vf', f.vf, '-q:v', '3', dest],
    { stdio: 'inherit' },
  );
  const kb = statSync(dest).size / 1024;
  total += kb;
  console.log(`  ✔ ${f.file.padEnd(24)} t=${String(f.t).padStart(4)}s  ${kb.toFixed(0).padStart(4)} KB  — ${f.use}`);
}
console.log(`\n${total.toFixed(0)} KB total.\n`);
console.log('These are REAL Apex work, so their alt text may say so — unlike the stock slots.');
console.log('Source resolution is 1280×720; do not upscale beyond it.\n');
