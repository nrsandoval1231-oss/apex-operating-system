# LIFE001 — Create a draw schedule from the empty Project state

State: READY from controller browser evidence on the current candidate. This is a bounded lifecycle repair that precedes P-001.

Objective: let authorized office/admin staff create the existing draw schedule from Project > Draws when the signed job has no schedule, so the Today “Create schedule” action reaches a resolvable workflow.

Ownership: `apps/apex-os/src/pages/ProjectDetail.tsx` and one focused component/test if needed. Reuse `POST /api/jobs/:jobId/draws`; do not change the backend schedule authority or auto-create rows. Show only to admin/office, only for mutable non-historical jobs with a signed contract and no schedule. Show errors and reload the draw query after success.

Acceptance: authorized action is visible at the empty state; role and read-only gates hide it; successful create updates Project state; errors remain visible and retryable. Focused typecheck and regression validation. No other scope, no full CI, build, commit, push, merge, deploy, external schedule side effects, or changes to the frozen staff dist.

Controller reported normal signed-proposal flow produced one Job/Project and no draw schedule. Browser acceptance remains controller-owned. P-001 resumes after this source checkpoint.
