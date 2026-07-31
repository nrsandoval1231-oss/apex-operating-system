# Apex Repository Map

All repositories below were created as **private** GitHub repositories on 2026-07-28. Local and remote `main` heads were verified to match after the initial push.

Local source root: `C:\Users\NickSandoval\Desktop\Nick-Assistant\Projects\Apex`

Wrapper directories were flattened on 2026-07-31 (`apex-lead-engine\apex-lead-engine` → `apex-lead-engine`, and the same for `apex-prds` and `apex-website`).

| Component | Private remote | Local source during Phase 0 |
|---|---|---|
| System root | https://github.com/nrsandoval1231-oss/apex-operating-system | `.` (the source root above) |
| Designer | https://github.com/nrsandoval1231-oss/apex-designer | `Apex Designer` |
| Decks | https://github.com/nrsandoval1231-oss/apex-decks | `apex-decks` |
| Lead Engine | https://github.com/nrsandoval1231-oss/apex-lead-engine | `apex-lead-engine` |
| PRDs | https://github.com/nrsandoval1231-oss/apex-prds | `apex-prds` |
| Proposal Engine | https://github.com/nrsandoval1231-oss/apex-proposal-engine | `apex-proposal-engine` |
| Website | https://github.com/nrsandoval1231-oss/apex-website | `apex-website` |

## Phase 0 preservation model

The root repository intentionally ignores the six component working trees. Each component preserves its own history and is pushed independently. The system root tracks cross-component status, decisions, plans, Gate, detached operational exports, and historical artifacts.

This is temporary. The approved target is a monorepo. Later migration must import component history with a history-preserving method such as `git subtree`/history rewriting; do not copy current files into a fresh repository and discard provenance.

## Additional local recovery backup

`C:\Users\NickSandoval\Desktop\Apex-Phase0-Backup-20260728_161654`

This backup contains:

- verified source-only working-tree ZIP
- six verified Git bundles
- captured dirty/untracked statuses
- tracked binary-capable patches
- SHA-256 manifest and artifact checksums

The backup predates the Phase 0 checkpoint commits and remote pushes and can reconstruct the exact starting state. It also predates the 2026-07-31 wrapper flattening; paths inside the backup use the original nested layout.
