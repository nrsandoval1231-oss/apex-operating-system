# Apex repository consolidation

The active system remains the canonical implementation in `apps/`, `packages/`, and `workflows/`.
These snapshots preserve the final text/code state of retired satellite repositories for rollback
and provenance. They are non-runtime and must not be imported by active packages.

| Repository | Frozen source commit |
|---|---|
| `apex-decks` | `cb850d027ad6595f6b1182f5fecd8df88fce4efe` |
| `apex-designer` | `21a53a34253a0edc151d4334147e0296c00e82bb` |
| `apex-lead-engine` | `6436d3d9f6a278e7b3c4eb34bfcf35bec72477b0` |
| `apex-prds` | `b2dd419a52127091613d3df99207d2cdce59d3f8` |
| `apex-proposal-engine` | `83bd1457ae3ed34b6757d8f72bd6e3abc74d8d70` |
| `apex-website` | `acf43352f6a3201efe34c094cab1a89042739af5` |

GitHub Actions workflows and binary artifacts were excluded. Binary artifacts remain in the source
repositories until repository administration is completed.
