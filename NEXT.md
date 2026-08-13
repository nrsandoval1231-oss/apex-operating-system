# Apex — Next

## Immediate next work

1. Use **Designer → New design project** for friend/referral intake and verify the created record in Projects.
2. For each new intake, complete the design/permit information before opening construction Gates.
3. Keep the canonical Job ID as the identity across Designer, Projects, Today, Calendar, History, Gate workflow, and customer updates.
4. Add any future intake fields through the authenticated `/api/projects/intake` contract rather than creating a parallel local Designer record.

## Verification baseline

- `pnpm run typecheck`
- `pnpm run test`
- `pnpm --filter @apex/os build`
- From `Apex Designer`: `pnpm typecheck && pnpm build`
- `git diff --check`

The current baseline is recorded in [`STATUS.md`](STATUS.md).