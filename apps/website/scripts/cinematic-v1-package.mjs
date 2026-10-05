#!/usr/bin/env node
/** Validate or produce the cinematic v1 production package using ffmpeg/ffprobe. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, '..', 'public', 'cinematic', 'v1');
const repoRoot = resolve(scriptDir, '../../..');
const manifestPath = join(root, 'frame-manifest.json');
const sourceRevision = '1dfd2db2e25118f9662c836b2e05d9a1a45fe284';
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const checkOnly = args.has('--check') || !write;
if (args.has('--help')) {
  console.log('Usage: node apps/website/scripts/cinematic-v1-package.mjs [--check | --write]\n--check (default) validates without mutation. --write resizes desktop frames and regenerates review media.');
  process.exit(0);
}

const failures = [];
const run = (bin, argv, capture = false) => {
  const result = spawnSync(bin, argv, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${bin} failed (${result.status}): ${(result.stderr || result.stdout || '').trim()}`);
  return capture ? result.stdout : undefined;
};
const rel = (p) => p.split(sep).join('/');
const hash = async (p) => createHash('sha256').update(await readFile(p)).digest('hex');
const walk = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
};
const probe = (file) => JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,codec_name', '-of', 'json', file], true)).streams[0];
const probeVideo = (file) => JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_read_frames', '-show_entries', 'format=duration,size', '-of', 'json', file], true));
const packagePath = (file) => rel(file.slice(root.length + 1));
const exists = async (file) => { try { return (await stat(file)).isFile(); } catch { return false; } };

let manifest;
try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch (error) { console.error(`Cannot read manifest: ${error.message}`); process.exit(2); }

const sequence = manifest.playback_sequence ?? [];
const expectedScenes = new Set(Object.keys(manifest.scene_distribution ?? {}));
if (sequence.length !== 62) failures.push(`playback_sequence has ${sequence.length} entries; expected 62`);
const seenFiles = new Set();
for (let i = 0; i < sequence.length; i++) {
  const frame = sequence[i];
  const n = i + 1;
  const expectedName = `frames/desktop/frame-${String(n).padStart(4, '0')}.webp`;
  if (frame.n !== n || frame.file !== expectedName) failures.push(`sequence entry ${n} must be ${expectedName} with n=${n}`);
  if (seenFiles.has(frame.file)) failures.push(`duplicate sequence file ownership: ${frame.file}`);
  seenFiles.add(frame.file);
  if (!frame.scene || !frame.id) failures.push(`frame ${n} is missing scene or unique frame id`);
  if (!expectedScenes.has(frame.scene)) failures.push(`frame ${n} uses unexpected or unregistered scene ${frame.scene}`);
  if (n >= 48 && n <= 51 && frame.scene !== 'splash') failures.push(`frame ${n} must belong to splash`);
  if (n === 52 && frame.scene !== 'water-dominates') failures.push('frame 52 must belong only to water-dominates');
  if (n === 53 && frame.scene !== 'transition') failures.push('frame 53 must belong only to transition');
  if (n >= 54 && frame.scene !== 'underwater') failures.push(`frame ${n} must belong to underwater`);
}
const actualDistribution = {};
for (const frame of sequence) actualDistribution[frame.scene] = (actualDistribution[frame.scene] ?? 0) + 1;
for (const [scene, data] of Object.entries(manifest.scene_distribution ?? {})) {
  if (actualDistribution[scene] !== data.count) failures.push(`scene_distribution ${scene} count=${data.count}, sequence count=${actualDistribution[scene] ?? 0}`);
  const listedFrames = [];
  for (const part of String(data.frame_range ?? '').split(',')) {
    const match = part.match(/^(\d{4})(?:-(\d{4}))?$/);
    if (!match) { failures.push(`scene_distribution ${scene} has invalid frame_range ${data.frame_range}`); continue; }
    for (let n = Number(match[1]); n <= Number(match[2] ?? match[1]); n++) listedFrames.push(n);
  }
  const ownedFrames = sequence.filter((frame) => frame.scene === scene).map((frame) => frame.n).sort((a, b) => a - b);
  if (JSON.stringify(listedFrames.sort((a, b) => a - b)) !== JSON.stringify(ownedFrames)) failures.push(`scene_distribution ${scene} frame_range does not match actual sequence ownership`);
}
const ids = sequence.map((frame) => frame.id).filter(Boolean);
if (new Set(ids).size !== ids.length) failures.push('playback_sequence contains duplicate frame ids');
for (const scene of Object.keys(actualDistribution)) if (!manifest.scene_distribution?.[scene]) failures.push(`scene_distribution missing ${scene}`);
if (Object.keys(actualDistribution).reduce((sum, scene) => sum + actualDistribution[scene], 0) !== sequence.length) failures.push('scene ownership does not account for each frame exactly once');

const requiredPaths = new Set(manifest.source_documents ?? []);
for (const item of [...(manifest.playback_sequence ?? []), ...(manifest.fallback_assets ?? []), ...(manifest.mobile_variants ?? [])]) {
  if (item.file) requiredPaths.add(item.file);
}
for (const value of Object.values(manifest.review_artifacts ?? {})) {
  if (typeof value !== 'string' || value.includes('*')) continue;
  requiredPaths.add(value);
}
for (const path of requiredPaths) {
  const isRepoPath = path.startsWith('apps/');
  const full = resolve(isRepoPath ? repoRoot : root, path);
  const allowedRoot = isRepoPath ? repoRoot : root;
  const generatedByWrite = new Set(['review/sequence-preview-normal.mp4', 'review/sequence-preview-slow.mp4', 'review/sequence-preview-reverse.mp4', 'review/package-provenance.json', 'review/splash-contact-sheet.webp']);
  if (!full.startsWith(allowedRoot + sep) || (!await exists(full) && !(write && generatedByWrite.has(path)))) failures.push(`manifest reference missing or outside package/repository: ${path}`);
}

const desktop = sequence.map((frame) => resolve(root, frame.file));
const frameInfo = [];
for (const [i, file] of desktop.entries()) {
  if (!await exists(file)) continue;
  try {
    const info = probe(file);
    if (info.codec_name !== 'webp') failures.push(`${rel(file)} codec=${info.codec_name}; expected webp`);
    if (checkOnly && (info.width > 1920 || info.height > 1080)) failures.push(`${rel(file)} is ${info.width}x${info.height}; maximum is 1920x1080`);
    if (checkOnly && info.width * 9 !== info.height * 16) failures.push(`${rel(file)} is ${info.width}x${info.height}; expected exact 16:9`);
    frameInfo.push({ n: i + 1, file, width: info.width, height: info.height });
  } catch (error) { failures.push(`${rel(file)} probe failed: ${error.message}`); }
}
for (const item of [...(manifest.fallback_assets ?? []), ...(manifest.mobile_variants ?? [])]) {
  const file = resolve(root, item.file);
  if (!await exists(file)) continue;
  try {
    const info = probe(file);
    if (info.codec_name !== 'webp') failures.push(`${item.file} codec=${info.codec_name}; expected webp`);
    const aspect = item.aspect === '9:16' ? 9 / 16 : null;
    if (aspect && Math.abs(info.width / info.height - aspect) > 0.005) failures.push(`${item.file} is ${info.width}x${info.height}; expected 9:16`);
  } catch (error) { failures.push(`${item.file} probe failed: ${error.message}`); }
}

const all = await walk(root);
const paths = all.map((file) => packagePath(file)).sort();
const makeInventory = (filePaths) => {
  const byDir = (prefix, test = () => true) => filePaths.filter((p) => p.startsWith(prefix) && test(p));
  const actual = {
    runtime_desktop_frames: byDir('frames/desktop/', (p) => p.endsWith('.webp')),
    runtime_mobile_variants: (manifest.mobile_variants ?? []).map((x) => x.file).filter((p) => filePaths.includes(p)).sort(),
    runtime_fallback_webp: (manifest.fallback_assets ?? []).map((x) => x.file).filter((p) => filePaths.includes(p)).sort(),
    source_reference_jpg: byDir('reference/', (p) => p.toLowerCase().endsWith('.jpg')),
    source_keyframe_jpg: byDir('keyframes/', (p) => p.toLowerCase().endsWith('.jpg')),
    keyframe_webp_derivatives: byDir('keyframes/', (p) => p.toLowerCase().endsWith('.webp')),
    source_fallback_jpg: byDir('fallback/', (p) => p.toLowerCase().endsWith('.jpg')),
    review_artifacts: byDir('review/'),
  };
  return { actual, counts: Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, v.length])) };
};
let inventoryState = makeInventory(paths);
let inventory = inventoryState.actual;
let inventoryCounts = inventoryState.counts;
const declared = manifest.totals ?? {};
for (const [field, actual] of [
  ['production_frames_desktop_sequential', inventory.runtime_desktop_frames.length],
  ['runtime_mobile_variants', inventory.runtime_mobile_variants.length],
  ['runtime_fallback_webp', inventory.runtime_fallback_webp.length],
  ['source_reference_images', inventory.source_reference_jpg.length],
  ['source_keyframe_masters', inventory.source_keyframe_jpg.length],
  ['derived_keyframe_webp', inventory.keyframe_webp_derivatives.length],
  ['source_fallback_jpegs', inventory.source_fallback_jpg.length],
]) if (declared[field] !== actual) failures.push(`totals.${field}=${declared[field]}; enumerated package has ${actual}`);
if (declared.runtime_asset_files !== inventory.runtime_desktop_frames.length + inventory.runtime_mobile_variants.length + inventory.runtime_fallback_webp.length) failures.push(`totals.runtime_asset_files=${declared.runtime_asset_files}; enumerated runtime files total ${inventory.runtime_desktop_frames.length + inventory.runtime_mobile_variants.length + inventory.runtime_fallback_webp.length}`);

if (checkOnly) {
  const recorded = manifest.package_inventory;
  if (!recorded) failures.push('manifest package_inventory is missing; run explicit --write to freeze actual filesystem inventory');
  else {
    const actualPaths = paths.filter((p) => p !== 'frame-manifest.json').sort();
    const actualFiles = await Promise.all(actualPaths.map(async (path) => ({ path, bytes: (await stat(resolve(root, path))).size, kind: path.toLowerCase().endsWith('.json') ? 'json' : 'media' })));
    const media = actualFiles.filter((entry) => entry.kind === 'media');
    const actualBytes = actualFiles.reduce((sum, entry) => sum + entry.bytes, 0);
    const desktopBytes = await Promise.all(inventory.runtime_desktop_frames.map(async (path) => (await stat(resolve(root, path))).size));
    const runtimePaths = [...inventory.runtime_desktop_frames, ...inventory.runtime_mobile_variants, ...inventory.runtime_fallback_webp];
    const runtimeBytes = await Promise.all(runtimePaths.map(async (path) => (await stat(resolve(root, path))).size));
    const expectedCounts = { ...inventoryCounts, total_repository_asset_files: actualFiles.length, repository_media_files: media.length, package_file_count: paths.length };
    const expectedBytes = { production_payload_bytes: desktopBytes.reduce((a, b) => a + b, 0), runtime_asset_bytes: runtimeBytes.reduce((a, b) => a + b, 0), repository_media_bytes: media.reduce((sum, entry) => sum + entry.bytes, 0), total_repository_asset_bytes: actualBytes };
    if (JSON.stringify(recorded.counts) !== JSON.stringify(expectedCounts)) failures.push('manifest package_inventory counts do not match actual filesystem');
    if (JSON.stringify(recorded.bytes) !== JSON.stringify(expectedBytes)) failures.push('manifest package_inventory byte totals do not match actual filesystem');
    if (JSON.stringify(recorded.inventory) !== JSON.stringify(inventory)) failures.push('manifest package_inventory path groups do not match actual filesystem');
    if (JSON.stringify(recorded.files) !== JSON.stringify(actualFiles)) failures.push('manifest package_inventory file list or sizes do not match actual filesystem');
  }
  try {
    const provenance = JSON.parse(await readFile(join(root, 'review', 'package-provenance.json'), 'utf8'));
    if (provenance.source_revision !== sourceRevision) failures.push('package provenance source_revision differs from immutable source revision');
    if (provenance.sequence?.length !== 62 || provenance.source_frames?.length !== 62) failures.push('package provenance must record all 62 source and optimized frames');
    for (let i = 0; i < 62; i++) {
      const item = sequence[i];
      const output = provenance.sequence?.[i];
      const source = provenance.source_frames?.[i];
      if (output?.n !== i + 1 || output?.path !== item.file || output?.width !== 1920 || output?.height !== 1080 || output?.sha256 !== await hash(resolve(root, item.file))) failures.push(`package provenance output frame ${i + 1} is missing, stale, or out of sequence`);
      if (source?.n !== i + 1 || source?.git_path !== `apps/website/public/cinematic/v1/${item.file}` || !/^[a-f0-9]{64}$/.test(source?.sha256 ?? '')) failures.push(`package provenance source frame ${i + 1} is missing or out of sequence`);
      else {
        const blob = spawnSync('git', ['-C', repoRoot, 'show', `${sourceRevision}:${source.git_path}`], { encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
        if (blob.status !== 0) {
          const detail = blob.error?.message ?? blob.stderr?.toString().trim() ?? `exit ${blob.status}`;
          failures.push(`package provenance source frame ${i + 1} cannot read pinned Git blob ${sourceRevision}:${source.git_path}: ${detail}`);
        } else {
          const sourceHash = createHash('sha256').update(blob.stdout).digest('hex');
          if (source.sha256 !== sourceHash) failures.push(`package provenance source frame ${i + 1} SHA-256 mismatch for pinned Git blob ${sourceRevision}:${source.git_path} (recorded ${source.sha256}, actual ${sourceHash})`);
        }
      }
    }
    const reviewFiles = provenance.review_files ?? [];
    const currentReview = inventory.review_artifacts.filter((p) => p !== 'review/package-provenance.json').sort();
    if (reviewFiles.length !== currentReview.length) failures.push('package provenance review file count is stale');
    for (const [i, path] of currentReview.entries()) {
      const item = reviewFiles[i];
      const file = resolve(root, path);
      if (item?.path !== path || item?.sha256 !== await hash(file) || item?.bytes !== (await stat(file)).size) failures.push(`package provenance review artifact is stale: ${path}`);
    }
    for (const [filename, fps] of [['sequence-preview-normal.mp4', 24], ['sequence-preview-slow.mp4', 4], ['sequence-preview-reverse.mp4', 4]]) {
      const file = join(root, 'review', filename);
      const info = probeVideo(file);
      const stream = info.streams?.[0] ?? {};
      const expectedDuration = 62 / fps;
      if (stream.codec_name !== 'h264' || stream.width !== 1920 || stream.height !== 1080 || stream.avg_frame_rate !== `${fps}/1` || Number(stream.nb_read_frames) !== 62 || Math.abs(Number(info.format?.duration) - expectedDuration) > 0.02) failures.push(`${filename} is not a 62-frame 1920x1080 H.264 preview at ${fps} fps`);
    }
  } catch (error) { failures.push(`package provenance validation failed: ${error.message}`); }
}

if (write && failures.length === 0) {
  // Explicit --write is the only image mutation path; originals remain recoverable from Git history.
  const stagedDir = resolve(root, '.frame-optimization-staging');
  if (!stagedDir.startsWith(root + sep)) throw new Error('Staging path escaped the cinematic package directory.');
  await rm(stagedDir, { recursive: true, force: true });
  await mkdir(stagedDir, { recursive: true });
  const sourceRecords = [];
  for (const [i, file] of desktop.entries()) {
    const gitPath = `apps/website/public/cinematic/v1/${sequence[i].file}`;
    const source = spawnSync('git', ['-C', repoRoot, 'show', `${sourceRevision}:${gitPath}`], { encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    if (source.status !== 0) throw new Error(`Cannot recover immutable source ${sourceRevision}:${gitPath}: ${source.stderr?.toString() ?? ''}`);
    const sourcePath = join(stagedDir, `source-${String(i + 1).padStart(4, '0')}.webp`);
    const optimizedPath = join(stagedDir, `frame-${String(i + 1).padStart(4, '0')}.webp`);
    await writeFile(sourcePath, source.stdout);
    sourceRecords.push({ n: i + 1, git_path: gitPath, sha256: createHash('sha256').update(source.stdout).digest('hex') });
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', sourcePath, '-vf', 'crop=2730:1536:(iw-ow)/2:0,scale=1920:1080:flags=lanczos', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '75', '-compression_level', '6', optimizedPath]);
  }
  // Replace each source only after its encoded temporary file was produced successfully.
  for (const [i, file] of desktop.entries()) { await rm(file); await rename(join(stagedDir, `frame-${String(i + 1).padStart(4, '0')}.webp`), file); }
  await rm(stagedDir, { recursive: true, force: true });
  const review = join(root, 'review');
  const pattern = join(root, 'frames', 'desktop', 'frame-%04d.webp');
  const video = (output, fps, extra = []) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-start_number', '1', '-i', pattern, '-frames:v', '62', ...extra, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
  video(join(review, 'sequence-preview-normal.mp4'), 24);
  video(join(review, 'sequence-preview-slow.mp4'), 4);
  video(join(review, 'sequence-preview-reverse.mp4'), 4, ['-vf', 'reverse']);
  const fontfile = `${process.env.WINDIR ?? 'C:/Windows'}/Fonts/arial.ttf`.replaceAll('\\', '/').replace(':', '\\:');
  const frameLabel = (startNumber = 1) => `drawtext=fontfile='${fontfile}':text='%{eif\\:n+${startNumber}\\:d}':fontcolor=white:fontsize=16:box=1:boxcolor=black@0.7:x=5:y=5`;
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-start_number', '1', '-i', pattern, '-vf', `scale=240:135:flags=lanczos,${frameLabel()},tile=8x8`, '-frames:v', '1', '-q:v', '3', join(review, 'full-sequence-contact-sheet.jpg')]);
  const sheets = [
    ['flight-contact-sheet.webp', 21, 33, '5x3'],
    ['impact-contact-sheet.webp', 34, 46, '4x4'],
    ['splash-contact-sheet.webp', 47, 52, '3x2'],
    ['underwater-contact-sheet.webp', 53, 61, '3x3'],
  ];
  for (const [name, first, last, layout] of sheets) {
    const select = `select='between(n,${first},${last})',scale=320:180:flags=lanczos,${frameLabel(first + 1)},tile=${layout}`;
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '1', '-start_number', '1', '-i', pattern, '-vf', select, '-frames:v', '1', '-quality', '88', join(review, name)]);
  }
  for (const sample of await walk(review)) {
    const match = sample.match(/[\\/]review[\\/](sample-frames|sample-slow)[\\/](normal|reverse|slow)-t([\d.]+)\.jpg$/i);
    if (!match) continue;
    const videoPath = join(review, match[2] === 'slow' ? 'sequence-preview-slow.mp4' : match[2] === 'reverse' ? 'sequence-preview-reverse.mp4' : 'sequence-preview-normal.mp4');
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', match[3], '-i', videoPath, '-frames:v', '1', '-q:v', '3', sample]);
  }
  const provenanceFiles = (await walk(review)).filter((file) => !file.endsWith('package-provenance.json'));
  const provenance = {
    generated_at_utc: new Date().toISOString(),
    source_revision: sourceRevision,
    source_frames: sourceRecords,
    encoder: { ffmpeg: run('ffmpeg', ['-version'], true).split('\n')[0], desktop_filter: 'crop=2730x1536 center, then Lanczos scale=1920x1080', webp: 'libwebp quality=75 compression_level=6', video: 'libx264 crf=20 yuv420p', playback_fps: { normal: 24, slow: 4, reverse: 4 } },
    sequence: await Promise.all(desktop.map(async (file, i) => ({ n: i + 1, path: packagePath(file), sha256: await hash(file), bytes: (await stat(file)).size, ...probe(file) }))),
    review_files: await Promise.all(provenanceFiles.sort().map(async (file) => ({ path: packagePath(file), sha256: await hash(file), bytes: (await stat(file)).size, ...(file.endsWith('.mp4') ? { video: probeVideo(file) } : {}) }))),
  };
  await writeFile(join(review, 'package-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  const packageFiles = await walk(root);
  const packagePaths = packageFiles.map(packagePath).filter((p) => p !== 'frame-manifest.json').sort();
  const fileInventory = await Promise.all(packagePaths.map(async (path) => {
    const bytes = (await stat(resolve(root, path))).size;
    return { path, bytes, kind: path.toLowerCase().endsWith('.json') ? 'json' : 'media' };
  }));
  const fresh = makeInventory(packagePaths);
  const totalAssetBytes = fileInventory.reduce((sum, entry) => sum + entry.bytes, 0);
  const mediaFiles = fileInventory.filter((entry) => entry.kind === 'media');
  const desktopBytes = await Promise.all(fresh.actual.runtime_desktop_frames.map(async (path) => (await stat(resolve(root, path))).size));
  const runtimePaths = [...fresh.actual.runtime_desktop_frames, ...fresh.actual.runtime_mobile_variants, ...fresh.actual.runtime_fallback_webp];
  const runtimeBytes = await Promise.all(runtimePaths.map(async (path) => (await stat(resolve(root, path))).size));
  const packageInventory = {
    generated_at_utc: new Date().toISOString(), source_revision: sourceRevision,
    counts: { ...fresh.counts, total_repository_asset_files: fileInventory.length, repository_media_files: mediaFiles.length, package_file_count: packageFiles.length },
    bytes: { production_payload_bytes: desktopBytes.reduce((a, b) => a + b, 0), runtime_asset_bytes: runtimeBytes.reduce((a, b) => a + b, 0), repository_media_bytes: mediaFiles.reduce((sum, entry) => sum + entry.bytes, 0), total_repository_asset_bytes: totalAssetBytes },
    inventory: fresh.actual, files: fileInventory,
  };
  const manifestText = await readFile(manifestPath, 'utf8');
  const inventoryJson = JSON.stringify(packageInventory, null, 2).replaceAll('\n', '\n  ');
  const updatedManifest = manifestText.replace(/^  "package_inventory": (?:null|\{[\s\S]*?\n  \}),/m, `  "package_inventory": ${inventoryJson},`);
  if (updatedManifest === manifestText) throw new Error('Could not find package_inventory field to update in manifest.');
  await writeFile(manifestPath, updatedManifest);
  inventory = fresh.actual;
  inventoryCounts = fresh.counts;
  console.log('Wrote resized frames, normal/slow/reverse previews, full-sequence contact sheet, and SHA-256 provenance.');
  console.log(run(process.execPath, [fileURLToPath(import.meta.url), '--check'], true));
} else if (write && failures.length) {
  console.error('Refusing --write because package checks failed; resolve the reported issues first.');
}

console.log(`Cinematic v1 package inventory (actual filesystem): ${JSON.stringify(inventoryCounts)}`);
if (args.has('--inventory')) console.log(JSON.stringify(inventory, null, 2));
if (failures.length) {
  console.error(`\n${failures.length} package check(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`\nPackage checks passed${checkOnly ? ' (read-only)' : ''}: ${frameInfo.length}/62 desktop frames, unique sequential ownership, manifest references resolved.`);
}
