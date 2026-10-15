# REPAIR-001 Build Packet
Objective: repair all three findings in C:/Users/nrsan/Documents/Codex/2026-10-14/aud/outputs/apex-repository-audit-2026-10-14.md.
Base 1d22c77dbe25aaa5aa2de21c1e1f2ddddbec36d8; current isolated branch codex/apex-audit-repair-20261014.
Ownership: job mutation services and affected API boundaries, FinishEstimate/OpportunityEstimate, regression tests, minimal test setup if required, .agent repair documentation.
Exclusions: canonical intent, historical evidence, applied migrations, cinematic assets, unrelated website behavior, credentials, real customer data; no push/merge/deploy/spend or external communication.
Read README STATUS NEXT, repository instructions, relevant requirements/ADRs, scripts/ci.sh before editing.
Invariants: closed/cancelled jobs read only; same transactional Job row lock as closeJob; preserve auth, idempotency, closeout and evidence. Blank fee refused before conversion, explicit zero valid. Opportunity identity isolates state and pending async/file operations; verify draft ownership.
Acceptance: deterministic interleaving tests both mutation/closure orders and equivalent mutation paths; fee matrix and no mutation on omission; route A->B behavioral regression missing/present handoffs and delayed A completion.
Validation: focused tests while building; investigate full core stall from evidence without weakening tests. Freeze implementation and explanatory docs then run documented scripts/ci.sh; retain full output and exact UNKNOWN blockers. Runtime behavior where feasible, synthetic data only.
Retry budget: two materially different safe repairs per failure; preserve evidence and report constraints.
Output: .agent/COMPLETION.json with changes, commands/results, exact candidate hash manifest, unresolved limitations, UTC timing/model/config/tokens UNKNOWN when unmeasured. Do not self-certify acceptance. Controller reruns gates and obtains independent Sol review.
