# Packet PR24-PACKAGE

- Objective: repair the nonvisual cinematic-v1 package and provide reproducible optimization and QA scripts.
- Node: PR24-PKG-01; Apex / `feature/cinematic-v1-asset-package` / base `1dfd2db2e25118f9662c836b2e05d9a1a45fe284`.
- Allowed: frame manifest; `cinematic-v1-package.mjs`; package docs; `.agent/` packet and completion evidence; 62 desktop output encodes and their review artifacts after root release.
- Excluded: four canonical design docs, website behavior, homepage/GSAP/runtime flow, source/reference/keyframe masters, incomplete generated impact candidates, unrelated app code.
- Invariants: encode original frames from immutable Git base; no duplicate production source files; exact 62-frame sequence and unique scene owner; actual filesystem inventory/provenance; explicit visual HOLD.
- Acceptance: exact 1920×1080 16:9 WebP desktop frames; splash 0048–0051, water-dominates 0052, transition 0053, underwater 0054–0062; all exact manifest references resolve; checker compares provenance/inventory hashes, counts, ranges, fps and bytes.
- Validation: `node --check apps/website/scripts/cinematic-v1-package.mjs`; `node apps/website/scripts/cinematic-v1-package.mjs --check --inventory`.
- Authority: local files only. No commit/push/deploy by builder. Image writes were run after root released the immutable source sequence. Incomplete visual candidates were not integrated.
- Outcome: deterministic package check PASS; product visual state HOLD. Root owns final repository gates/review.
