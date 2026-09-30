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

## External Apex consolidation — 2026-08-11

Material formerly held on Desktop and in Downloads was consolidated here after
SHA-256 verification:

- `desktop-apex-20260805/` — historical Desktop documents, workflow export,
  decks, diagrams, attachments, and retained workflow evidence.
- `desktop-apex-backup-20260728/` — Git bundles, source archive, manifest,
  status records, non-empty patch, and loose Apex zip archives.
- `downloads-apex-20260729/` — Apex budget and takeoff inputs.
- `apex-consolidation-manifest-2026-08-11.json` — source/destination hashes and
  the complete copy map.

Temporary probes, exact duplicate files, empty patch artifacts, and redundant
Downloads copies were removed after verification. That 2026-08-11 pass did not
overwrite the then-separate source repositories. Those trees were later
imported into this monorepo; the working copies are the paths in
[`docs/repositories.md`](../repositories.md), and the import record is
[`docs/REPOSITORY_CONSOLIDATION_2026-09-16.md`](../REPOSITORY_CONSOLIDATION_2026-09-16.md).
