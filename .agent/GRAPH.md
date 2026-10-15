# Work graph — Apex business completion
Base ab74aa333c97399004ccbdba20a7b1df58d33ab4, branch codex/apex-business-completion-20261015.

| Node | State | Objective | Dependency |
|---|---|---|---|
| BASELINE | bounded PASS | .agent/BASELINE.md plus controller browser/integration logs; source audit complete | none |
| OPS-002 | built; final review pending | Truthful website response copy and current Cloudflare recovery runbook | BASELINE |
| OPS003 | BUILDING | CI portability without system writes or weakened gates | BASELINE |
| BIZ-001 | BUILDING | Lead-linked persisted next actions and actionable Today lane | BASELINE |
| F-001 | WAITING | Remove inferred payment actuals, explicit QuickBooks unavailable | BIZ-001 ownership release and focused acceptance |
| P-001 | WAITING | Bounded approved-takeoff material tracking, entered vendor/order/ETA/receipts | F-001 |
| LOCAL ACCEPTANCE | PARTIAL | Baseline PG/S3 29 pass2 guard skips, estimate browser PASS; website166+10 PASS; local DB restore/counts and object checksum PASS | source freeze for final rerun |
| PILOT ACCEPTANCE | OPEN | Authenticated staging lifecycle, managed Neon/R2 recovery and full business finish contract | external identity plus reviewed candidate |

Controller direction CONTINUE: serial source ownership, focused validation per slice, then one final frozen integrated candidate with all mandatory gates and independent review. Prior graph state superseded by this file; historical baseline retained. No deployment, real ordering, payment, customer messages, production writes or merge. User authorized preparing focused PR; current implementation is not deployed.
