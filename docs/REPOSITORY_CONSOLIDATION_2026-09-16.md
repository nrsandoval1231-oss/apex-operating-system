# Apex repository consolidation

The active system is the canonical implementation in `apps/`, `packages/`, `workflows/`, `docs/prd`, and `tools/`.

The working-tree snapshots previously kept at `archive/imported-repositories/` were removed. The former GitHub repositories were deleted. History of the subtree import, and of those removed copies, lives in this repository's git history.

`archive/proposal-engine` stays. `integration-tests/takeoff-to-proposal.test.ts` and `scripts/ci.sh` still run it. The GitHub Actions workflow that used to reference it was removed on 2026-10-02. It is legacy calibration evidence. The production Proposal authority is `packages/pricing-engine`.

| Former repository | Frozen source commit at import | Canonical path |
|---|---|---|
| `apex-decks` | `cb850d027ad6595f6b1182f5fecd8df88fce4efe` | `tools/decks` |
| `apex-designer` | `21a53a34253a0edc151d4334147e0296c00e82bb` | `apps/designer` |
| `apex-lead-engine` | `6436d3d9f6a278e7b3c4eb34bfcf35bec72477b0` | `workflows/lead-engine` |
| `apex-prds` | `b2dd419a52127091613d3df99207d2cdce59d3f8` | `docs/prd` |
| `apex-proposal-engine` | `83bd1457ae3ed34b6757d8f72bd6e3abc74d8d70` | `archive/proposal-engine` |
| `apex-website` | `acf43352f6a3201efe34c094cab1a89042739af5` | `apps/website` |

GitHub Actions workflows from the old repositories were not part of the imported snapshots. Those repositories were later deleted.
