# APEX 2.0 readiness

**READY WITH CONDITIONS** — frontend development may begin against the existing canonical contracts and API after this cleanup is reviewed. This is not production-release approval.

The existing UI and business rules remain intact. Confirmed gate concurrency, database TLS, evidence storage and build/dependency defects were repaired. The staff app, Designer and website retain their existing frameworks. Approved quantities, versioned proposals, procurement history, financial gates and historical records remain authoritative; no redesign was begun.

Parallel conditions:

1. Resolve or explicitly handle the existing release/phase-advancement recovery gap before production rollout.
2. Demonstrate website/n8n → operational lead linkage and authenticate external job-status ingress before presenting them as a connected lifecycle.
3. Complete deployment-specific identity, R2 permissions, backup/restore and staging acceptance; local emulator/browser tests do not establish these.
4. Track the residual ExcelJS/UUID advisory, offline deck image-parser advisory and Windows Tauri packaging acceptance.

The frontend rebuild should consume `packages/contracts` and current API operations, retain all gate/inspection/closure refusals, and avoid introducing new sources of business truth. See [architecture](ARCHITECTURE.md), [validation](VALIDATION.md) and [remaining risks](REMAINING_RISKS.md).
