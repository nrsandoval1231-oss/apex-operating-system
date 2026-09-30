# Apex Repository Map

Apex is consolidated into this repository: `nrsandoval1231-oss/apex-operating-system`.
The six former component repositories are preserved source archives. They are
not runtime dependencies and CI does not check them out.

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

## Preserved source repositories

- https://github.com/nrsandoval1231-oss/apex-designer
- https://github.com/nrsandoval1231-oss/apex-decks
- https://github.com/nrsandoval1231-oss/apex-lead-engine
- https://github.com/nrsandoval1231-oss/apex-prds
- https://github.com/nrsandoval1231-oss/apex-proposal-engine
- https://github.com/nrsandoval1231-oss/apex-website

Consolidation is on `main`. Treat the paths above as the working copies.
The former GitHub repositories should stay archived for rollback, not be
used as sibling checkouts. Provenance: `docs/REPOSITORY_CONSOLIDATION_2026-09-16.md`.

## Migration provenance

The import used `git subtree`, preserving source history and producing a
distinct destination path. External identifiers and contracts remain unchanged:
n8n webhook paths, environment names, API routes,
auth/session behavior, database migrations, storage keys, and artifact formats.
