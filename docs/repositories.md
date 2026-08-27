# Apex Repository Map

Apex is consolidated into this repository: `nrsandoval1231-oss/apex-operating-system`.
The six former component repositories remain preserved source archives while the
monorepo migration is verified; they are no longer runtime dependencies or CI
checkout dependencies.

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

These source repositories must remain unchanged until the consolidated branch
passes verification. After cutover, each should receive a deprecation README or
be archived—not deleted—so rollback remains possible.

## Migration provenance

The migration branch imported each source with `git subtree`, preserving source
history and producing a distinct destination path. External identifiers and
contracts remain unchanged: n8n webhook paths, environment names, API routes,
auth/session behavior, database migrations, storage keys, and artifact formats.
