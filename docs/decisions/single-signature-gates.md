# Active Gates use one release signature

**Recorded:** 2026-08-13  
**Status:** Implemented and verified

## Decision

Active Apex Gates use one explicit authorized release signature. The former countersign/double-approval step is retired and must not be generated, required, displayed, or accepted by active workflows.

## Historical preservation

Historical Gate definitions, sign-off/countersign events, evaluations, evidence, and append-only audit records remain preserved. They are replayable for historical inspection only; replay must not recreate an active second-approval requirement.

## Implementation

- Forward-only migration: `packages/database/migrations/0031_remove_countersign_from_active_gates.sql`
- Migration registered in `packages/database/src/index.ts`
- Active Gate projections return no countersign roles and `requiresCountersign: false`
- The domain rejects the retired `countersign-gate` command explicitly
- The Gate API's former countersign route returns `410 Gone`
- The field console exposes one `Release` action and no second-signer prompt
- Today/action cards do not create active countersign work

## Verification

- Pre-gunite first authorized release reaches `released` directly
- Focused domain, Gate Service, and Gate API tests pass
- Full suite: 31 test files and 491 tests passed
- Typecheck, build, JavaScript syntax check, and `git diff --check` passed
- Live `/ready`: database and evidence both ready
- Live active walkthrough Gate plans expose `requiresCountersign: false`

## Non-goals

This decision does not delete historical data or collapse Project and Gate tables. Gate history, inspections, evidence, and stable Job IDs remain separate authoritative records.
