# PR-RETRY-001 bounded review repair
Objective: reject procurement idempotency key collisions while preserving exact retries.
Base: 3b15c96f218b5a68664307c711a70a28d1a2fc94, codex/apex-business-completion-20261015, this worktree.
Owner: Luna; allowed packages/gate-service/src/procurement.ts and new integration-tests/procurement-retry.test.ts. No migrations, unrelated UI, protected intent, deployment, real data, or external side effects.
Invariant: source revisions, optimistic concurrency, closed Job refusal and immutable history remain enforced. Existing key must match resource, actor and intended mutation for a successful replay.
Acceptance: exact retry succeeds; cross-resource, changed payload and changed actor collide explicitly; real disposable PostgreSQL tests and typecheck pass. Controller reruns full CI and container gate on frozen successor, independent Sol reviews exact successor.
Retry budget: two materially distinct repairs; ambiguous effects UNKNOWN. Completion: external procurement-retry-repair.json with files, commands, exits, limits. Prior CI PASS on 3b15c96 remains retained, not successor proof.
Formatting companion: remove diff-check whitespace in four named files only; no behavior changes.
Create-key matching must use immutable creation history so later edits do not invalidate an exact original create replay. Controller requested a second materially different bounded repair and regression after detecting current mutable-row comparison. Prior focused tests passed but did not prove this temporal case.
