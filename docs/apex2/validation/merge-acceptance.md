# Merge acceptance — 2026-10-24

The owner authorized merging eligible PRs. Foundation PR32 merged first. The OS stack remains ordered 32→33→34→35→36→37; merge commits preserve ancestry and repository protections are not bypassed. Deployment is separate and has not been requested.

## Newly reported checklist defect

GitHub review on PR33 identified an inactive assignee falling back to Unassigned in the edit form. A real API/PostgreSQL browser regression reproduced the empty selection before the fix. Source commit `881361e` adds an explicit unavailable-current-assignee option and permits preservation of the same existing assignment during unrelated edits. New assignments still require active staff; recurring completion still refuses an inactive assignee. Explicit unassignment remains supported and audited.

On the committed source, `pnpm exec vitest run --config integration-tests/vitest.config.ts integration-tests/checklist.test.ts` passed 11/11 with zero skips; `node apps/apex-os/tests/checklist.e2e.mjs` passed six groups, including retention after edit/reload and explicit unassignment at desktop1440/mobile390. `pnpm typecheck`, `pnpm build` and `pnpm --filter @apex/os build` passed (the first two share TypeScript build checking). All commands exited0. Source `/tmp/apex2/env.sh` supplied disposable PostgreSQL; no production data was used. The first added fixture attempt omitted required nullable fields and returned422; corrected fixture then reproduced the actual empty-assignee assertion failure before the fix. Logs: `/tmp/apex2/merge-checklist-{red,pg,browser}.log`, `/tmp/apex2/merge-{typecheck,build,staff-build}.log`.

The earlier full CI at `2231248` remains historical evidence; it was not rerun for this focused correction. The targeted tests above cover the amended task service and edit form. Existing bundle warnings remain.

## Separate website candidate

Website PR38 is not part of the OS milestone stack. Its current candidate868985e has unresolved review findings: lost lead_submit conversion event, stale quote-preselection closure breaking retry, and unbounded client attribution rejected by the public lead schema. These require correction before merge. No website code or deployment was changed in this merge pass.
