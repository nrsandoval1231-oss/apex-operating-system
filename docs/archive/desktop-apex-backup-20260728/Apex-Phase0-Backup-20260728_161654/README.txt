Apex Phase 0 preservation backup — 20260728_161654

Contents
- Apex-source-working-tree-20260728_161654.zip: productive working-tree snapshot, including dirty/untracked files
- git-bundles/: full Git history, branches and tags for each existing repository
- git-status/: exact dirty/untracked state captured before Phase 0 repository work
- working-tree-patches/: tracked binary-capable diffs for each repository
- manifest.json: SHA-256 and byte size for every file in the source snapshot

Generated/output directories such as node_modules, dist, build, coverage, .astro, and .git were intentionally excluded from the source ZIP. Git histories are preserved separately as bundles.

Restore a repository history with:
  git clone git-bundles/<name>.bundle <destination>

Restore current dirty/untracked source by extracting the source ZIP after cloning the relevant bundles.
