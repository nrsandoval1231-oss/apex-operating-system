# Apex Cinematic V1 Package Audit

**Status:** CANONICAL PACKAGE AUDIT
**Recorded:** 2026-10-04
**Repository:** nrsandoval1231-oss/apex-operating-system
**Package SHA-256:** 90d495f52cfe285a50d7664dfb7b69ae62251cfd997c17ee3b21d981dc06a07b

## Package inventory

The uploaded apex-cinematic-v1-package.tar.gz contains **137 files** totaling approximately **162 MB** when extracted.

Primary contents:

- 10/10 reference images
- 14/14 canonical keyframes
- 62 sequential desktop playback frames
- 3 mobile variants
- 3 fallback assets
- 5+ contact/review sheets
- 3 preview videos
- frame-manifest.json
- cinematic-visual-bible.md
- cinematic-generation-prompts.md
- canonical homepage vision and storyboard copies

The archive is rooted relative to apps/website/, so docs/... maps to apps/website/docs/... and public/cinematic/v1/... maps to apps/website/public/cinematic/v1/....

## Asset sizing

- public/cinematic/v1/reference/: 28 MB
- public/cinematic/v1/keyframes/: 29 MB
- public/cinematic/v1/frames/: 44 MB
- public/cinematic/v1/review/: 48 MB
- public/cinematic/v1/fallback/: 12 MB
- public/cinematic/v1/mobile/: 1.5 MB

Largest review files:

- review/sequence-preview-slow.mp4: ~19.9 MB
- review/sequence-preview-normal.mp4: ~14.5 MB
- review/sequence-preview-reverse.mp4: ~8.0 MB

No individual file exceeds GitHub's 100 MB hard file limit.

## Visual assessment

### PASS

- Art direction
- Family identity lock
- Architecture language
- Pool design language
- Golden-hour lighting language
- Canonical stills / keyframe backbone
- Splash-cover concept
- Underwater visual direction
- Overall asset organization

### FAIL — temporal continuity

The 62-frame playback sequence is **not yet production-ready for scroll scrubbing**.

The contact sheet exposes discontinuous body trajectories, especially through takeoff / hero flight / descent. Roughly around frames 0017–0040, family poses and spatial positions jump between generated states rather than advancing through one physically continuous motion.

This means the assets currently behave like a sequence of related generated stills, not frames from one continuous shot.

If wired directly to a canvas scroll-scrub interaction now, slow scrubbing would expose visible pose morphing / teleportation and would undermine the core experience.

## Canonical decision

Do **not** solve this by generating more independent intermediate stills.

The next production pipeline should use the locked canonical stills as start/end/reference conditioning for short controlled motion clips, then extract frames from those accepted clips.

Recommended clip plan:

1. Clip A: KF-001 → family begins running
2. Clip B: run → final stride → takeoff
3. Clip C: takeoff → peak flight → descent
4. Clip D: descent → impact → splash
5. Clip E: KF-120 splash cover → underwater reveal / KF-140

The accepted video segments should then be frame-extracted for the final scroll sequence.

## Canonical transition

Use **KF-120** as the hidden edit point between above-water and underwater material.

KF-126 remains optional and should not be forced into the playback sequence if its above-water architecture differs from the canonical environment.

## Git packaging recommendation

Production/reference assets belong under apps/website/public/cinematic/v1/.

Large MP4 review previews should not be deployed as public production website assets unless explicitly needed at runtime. They are review artifacts.

Recommended long-term structure:

- apps/website/public/cinematic/v1/reference/
- apps/website/public/cinematic/v1/keyframes/
- apps/website/public/cinematic/v1/frames/
- apps/website/public/cinematic/v1/mobile/
- apps/website/public/cinematic/v1/fallback/
- apps/website/public/cinematic/v1/frame-manifest.json
- apps/website/docs/cinematic-homepage-vision.md
- apps/website/docs/cinematic-homepage-storyboard.md
- apps/website/docs/cinematic-visual-bible.md
- apps/website/docs/cinematic-generation-prompts.md
- apps/website/docs/cinematic-v1-package-audit.md

## Current implementation gate

**Art direction:** PASS
**Reference system:** PASS
**Keyframe backbone:** PASS
**Temporal sequence:** FAIL
**Ready for final scroll prototype:** NO

Next gate: produce continuity-controlled motion clips, extract frames, then re-review forward, backward, and slowly before frontend implementation.