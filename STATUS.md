# Apex — Status

**Last updated:** 2026-08-13

**Canonical workspace:** `C:\Users\NickSandoval\Nick OS\02_Projects\Apex`

**Current local runtime:** `http://127.0.0.1:4100`

## Current verified state

- The local pilot is running in loopback-only mode with the canonical `var/local-db` and `var/local-evidence` paths.
- `/ready` reports database and evidence readiness.
- Apex OS Projects and Project Detail surfaces now support the 11-phase construction workflow.
- The frontend Vite bundle was rebuilt and the local pilot was restarted so the live server serves the new asset snapshot.
- Active Gates use one explicit release signature. Countersign/double approval is retired from active workflows; historical audit records remain preserved.
- Equipment workflow includes `Automation Programming Complete` and `Install Cover` in the Gate plan.
- Projects and Gates remain separate internal records presented through a unified Job-centered Project Workspace direction.
- Designer now has a **New design project** intake for referrals and manually sourced friends/customers. Office/admin users can enter customer name, address, contact details, referral source, and notes; the API creates an idempotent lead/job and opens the project at Design & Permitting.
- Today attention cards now preserve their canonical actionable-work count, refresh after writes, and link directly into the relevant Project/Gate workflow. The Running empty state no longer claims there is no project work.

## Verified commands

```text
pnpm run test
pnpm run typecheck
pnpm run build
pnpm --dir apps/apex-os run build
git diff --check
```

Results:

- Full suite: 31 test files, 494 tests passed.
- Integration tests: 9 passed; 15 skipped because external Postgres/S3 configuration is unavailable.
- Typecheck and builds passed.
- Targeted referral-intake, address parsing, Gate HTTP, and Apex client tests: 3 test files, 51 tests passed.
- Designer typecheck and production build passed.
- Apex OS production build passed.
- `git diff --check` passed.
- Live bundle contains `of 11`; live `/ready` is healthy.

## Recent fixes

### Phase validation/display

The Projects page previously failed with `currentPhaseSequence` maximum 9. The contract already allowed 11, but the served frontend was stale and two UI surfaces still displayed `of 9`. The Projects list and Project Detail UI now use `of 11`, and the rebuilt live bundle was verified to contain the new text.

### Single-signature Gates

See [`docs/decisions/single-signature-gates.md`](decisions/single-signature-gates.md). Active release paths no longer create or require a countersign. Historical sign-off/countersign records remain audit-only.

### Manual referral project intake

Designer is now the intake surface for projects that begin as a friend, referral, or manually sourced customer rather than an existing signed job.

1. Open **Designer**.
2. Click **New design project**.
3. Enter the customer name, street address, city, state, ZIP, and optional phone, email, referral source, and notes.
4. Submit **Create design project**.
5. Apex creates the durable referral lead and active job, opens the Project at **Design & Permitting**, and redirects to that Project Workspace.

The endpoint is `POST /api/projects/intake`. It is limited to admin/office staff, requires an idempotency key, and retries return the original job rather than creating duplicates. Customer identity/address display is derived from the canonical lead payload; the postal code is included in the normalized address display.

### Today action consistency

Today cards, the amber attention badge, and post-write refreshes now use the same actionable-work semantics. Gate cards retain a direct Project/Gate workflow link, and the Running empty state describes the absence of separate running cards without claiming that the project has no active work.

## Deliberately deferred

- The original Today amber badge mismatch is resolved in the current implementation; retain the walkthrough screenshot as historical evidence in `docs/feedback/walkthrough-feedback.md`.
- Designer follow-up requirements remain pending source uploads and controlled implementation.
- Current changes are being saved in Git for review.

## Runtime access

- Projects: `http://127.0.0.1:4100/app/projects`
- Calendar: `http://127.0.0.1:4100/app/calendar`
- History: `http://127.0.0.1:4100/app/historical`
- Field Gate console: `http://127.0.0.1:4100/`
