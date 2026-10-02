# Apex Repository Map

Apex is consolidated into this repository: `nrsandoval1231-oss/apex-operating-system`.
The six former GitHub repositories were deleted. Their history lives in this
repository's git history. They are not runtime dependencies and CI does not
check them out.

## Canonical layout

| Component | Canonical path |
|---|---|
| Operating system UI | `apps/apex-os` |
| Designer | `apps/designer` |
| Website | `apps/website` |
| Gate API | `apps/gate-api` |
| Lead Engine workflows | `workflows/lead-engine` |
| Shared contracts/domain/pricing/database/storage | `packages/*` |
| Product requirements and decisions | `docs/prd` plus `docs/decisions` |
| Legacy proposal calibration | `archive/proposal-engine` |
| Deck generators | `tools/decks` |
| Historical evidence | `docs/archive` |

## Former source repositories

These GitHub repositories were deleted. History of the import lives in git.

| Former repository | Canonical path |
|---|---|
| apex-designer | `apps/designer` |
| apex-website | `apps/website` |
| apex-lead-engine | `workflows/lead-engine` |
| apex-prds | `docs/prd` |
| apex-decks | `tools/decks` |
| apex-proposal-engine | `archive/proposal-engine` |

`archive/proposal-engine` stays. `integration-tests/takeoff-to-proposal.test.ts` and `scripts/ci.sh` still run it. The GitHub Actions workflow that used to reference it has been removed.

Duplicate working copies were removed: `archive/imported-repositories/`, plus the git bundles, source zips, duplicate PRD copies, and regenerable deck binaries under `docs/archive/`. Recover an older snapshot from git history. Provenance: `docs/REPOSITORY_CONSOLIDATION_2026-09-16.md`.

## Migration provenance

The import used `git subtree`, preserving source history and producing a
distinct destination path. External identifiers and contracts remain unchanged:
n8n webhook paths, environment names, API routes,
auth/session behavior, database migrations, storage keys, and artifact formats.
