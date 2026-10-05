# Cinematic v1 asset package

The package contains three different kinds of files: runtime assets (62 desktop frames, three mobile WebP variants, and three fallback WebP files), source assets (reference photographs and keyframe masters), and review outputs under `public/cinematic/v1/review/`. Keyframe WebP files are derivatives of the keyframe JPG masters. Fallback JPGs are source masters; their WebP counterparts are runtime files. Review files are counted from the directory at check time and are not included in runtime totals. No source image is duplicated to create a production frame; the encoder always recovers original frame bytes from immutable Git revision `1dfd2db2e25118f9662c836b2e05d9a1a45fe284` and records their SHA-256 hashes.

The manifest's scene ranges are exclusive ownership: splash is 0048–0051, water-dominates is 0052, transition is 0053, and underwater is 0054–0062. Each sequence frame has one scene owner. Runtime desktop frames must be sequential `frame-NNNN.webp`, exact 16:9, and no larger than 1920×1080.

Use the repository's installed Node runtime and `ffmpeg`/`ffprobe`:

```powershell
node apps/website/scripts/cinematic-v1-package.mjs --check
node apps/website/scripts/cinematic-v1-package.mjs --check --inventory
node apps/website/scripts/cinematic-v1-package.mjs --write
```

Check mode is read-only. Write mode is explicit: it recovers each input from the immutable source revision and center-crops to 16:9 before resizing the 62 desktop frames to 1920×1080 WebP (Lanczos, libwebp quality 75), then regenerates normal 24 fps, slow 4 fps, and reverse 4 fps H.264 previews, the full-sequence and scene contact sheets, and sampled stills. It writes source and output SHA-256 hashes, dimensions, encoder settings, generation time, and source revision to `review/package-provenance.json`. Run write mode only after the sequence owner releases the final frame set. The script does not add source duplicates to the package.

`--check` verifies scene ownership and counts, sequence filenames, image dimensions/codecs, all exact manifest path references, expected runtime/source counts, and actual file inventories by role. `--inventory` prints every actual package path grouped by role, including review artifacts. The checker requires `ffprobe`; write mode also requires `ffmpeg` with libwebp and libx264 encoders.
