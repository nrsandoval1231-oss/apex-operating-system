# Archive

Preserved for history. **None of this is current source of truth.** Current
status lives in [`docs/status.md`](../status.md); orientation in
[`docs/HANDOFF.md`](../HANDOFF.md); decisions in [`docs/decisions/`](../decisions/).

Moved here from the repository root on 2026-08-05 so the root holds only live
build files.

| File | What it is | Superseded by |
|---|---|---|
| `gate-v3.jsx` | Original field command-center mockup, sample-driven | `apps/apex-os` |
| `demo.html` | Standalone browser walkthrough of the spine, written 2026-07-31 before the UI was wired | `apps/apex-os` served at `/app` by `apps/gate-api` |
| `README-DEMO.md` | How to run `demo.html` | `docs/HANDOFF.md` § Running it locally |
| `SESSION-HANDOFF.md` | 2026-07-26 build-state handoff | `docs/status.md` |
| `apex-handoff.md` | Original client/project context — Travis, the margin finding, tooling decisions | `docs/vision.md` and `apex-prds/` |

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
Downloads copies were removed after verification. The live source repositories
were not overwritten, reset, or committed during this consolidation.
