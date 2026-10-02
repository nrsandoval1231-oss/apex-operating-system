# Archive

Preserved for history. **None of this is current source of truth.**

Current status is the repository-root [`STATUS.md`](../../STATUS.md). Next
work is [`NEXT.md`](../../NEXT.md). Orientation is
[`docs/HANDOFF.md`](../HANDOFF.md). Layout is
[`docs/repositories.md`](../repositories.md). Decisions are
[`docs/decisions/`](../decisions/). [`docs/status.md`](../status.md) is the
chronological engineering record, not the live status page.

Moved here from the repository root on 2026-08-05 so the root holds only live
build files.

| File | What it is | Superseded by |
|---|---|---|
| `gate-v3.jsx` | Original field command-center mockup, sample-driven | `apps/apex-os` |
| `demo.html` | Standalone browser walkthrough of the spine, written 2026-07-31 before the UI was wired | `apps/apex-os` served at `/app` by `apps/gate-api` |
| `README-DEMO.md` | How to run `demo.html` | Root `README.md` (local commands). `docs/HANDOFF.md` has no "Running it locally" section |
| `SESSION-HANDOFF.md` | 2026-07-26 build-state handoff | Root `STATUS.md` (live) and `docs/status.md` (chronological record) |
| `apex-handoff.md` | Original client/project context — Travis, the margin finding, tooling decisions | `docs/vision.md` and `docs/prd/` |

Also deleted in the same pass, recoverable from git history: `cleanup.ps1` and
`finish-cleanup.ps1` — one-off scripts that performed the 2026-07-31 folder
cleanup. They carried a hardcoded root path that is no longer where this project
lives, so re-running either would fail rather than do anything useful.

## Duplicate source archives removed

The former GitHub repositories were deleted. History of those repositories, and of the copies removed below, lives in this repository's git history. The live trees are the paths in [`docs/repositories.md`](../repositories.md). The import record is [`docs/REPOSITORY_CONSOLIDATION_2026-09-16.md`](../REPOSITORY_CONSOLIDATION_2026-09-16.md).

Removed from the working tree because they duplicated code or docs now in `apps/`, `workflows/`, `docs/prd`, `tools/`, or `archive/proposal-engine`:

- `archive/imported-repositories/` — copies of Designer, Website, Lead Engine, the PRD set, the deck generators, and the proposal engine.
- `desktop-apex-backup-20260728/` — git bundles, the source-tree zip, and the loose `apex-prds`, `apex-website`, and `apex-lead-engine` zips.
- `desktop-apex-20260805/Apex ideas.zip` — another copy of those repository zips.
- `desktop-apex-20260805/hermes-desktop-attachments/Apex_OS_PRD_v1.md` — earlier copy of the root `PRD FINAL.md`.
- `apex-strategy-deck.pptx` and `apex-pitch.pptx` under `desktop-apex-20260805/` (including the older render in `_inbox/`). Regenerate them from `tools/decks`.

`archive/proposal-engine` stays. `integration-tests/takeoff-to-proposal.test.ts` and `.github/workflows/non-website-ci.yml` reference it. The duplicate of that tree inside `archive/imported-repositories/apex-proposal-engine/` was removed.

## What remains in this folder

These files are historical evidence, not a second copy of the live source:

- The prototypes and handoffs in the table above.
- `downloads-apex-20260729/` — budget and `designer-quantity-v4` takeoff inputs. Do not rewrite them to look like the current quantity model.
- `desktop-apex-20260805/` — system diagram, Whitaker and other attachments, the lead-engine note, and Downloads inbox files that are not the deck binaries. On 2026-10-02 the n8n workflow JSON exports in `workflow-evidence/` and `Apex Lead Engine/Apex-Lead-Engine-01-Intake.json` were removed from the working tree because they carried a JWT-shaped token and the live n8n host. They remain in git history. The desktop backup itself is still here; the owner has not decided to delete it.
- `apex-consolidation-manifest-2026-08-11.json` — the 2026-08-11 copy map. Destinations it names that are listed under "Removed" are gone from the working tree and remain in git history.

Material formerly held on Desktop and in Downloads was consolidated here on 2026-08-11 after SHA-256 verification. That pass did not overwrite the then-separate source repositories.
