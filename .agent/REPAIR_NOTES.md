# REPAIR-001 implementation notes

The mutation services now take a `FOR UPDATE` lock on the canonical `jobs` row
inside the same transaction as each operational write. This uses the same lock
order as `closeJob`: Job row first, then service records and events. Existing
preflight checks remain to preserve refusal and authorization behavior; the
transaction repeats the check so a close or cancellation committed after
preflight wins safely. This covers Gate creation and commands, projects,
takeoffs, inspections, draws, crew visits, customer links, photo visibility,
and customer decisions. Superintendent assignment also rechecks under the
Job lock before updating the project and appending its event. Read paths remain
available for archived records.

The estimate UI rejects a blank or whitespace-only approved fee before making
any pricing request. The explicit string `0` remains valid. OpportunityEstimate
keys its stateful child by `leadId`; draft updates also check proposal ownership.
This prevents a reused route or a delayed request/file read for opportunity A
from changing the visible state for opportunity B.

The PostgreSQL integration races hold the Job row lock during a mutation and
send a concurrent closure update, proving mutation-first serialization. They
also commit closure after the service's stale preflight and before its write
transaction, proving the in-transaction check refuses it for Gate creation,
scheduling, and superintendent assignment. The assignment regression also
checks that neither the project field nor its event is persisted. The closure
helper sets the already-authorized closed state directly under the same row
lock; these tests do not prove the closeout checklist.

The Apex OS browser regression is `node apps/apex-os/tests/estimate-navigation.e2e.mjs`.
It runs against Vite at `/app/` and is included in `scripts/ci.sh` after the
Playwright Chromium install. It covers missing and present handoffs, A-to-B
navigation, blank-fee no-request behavior, and delayed request/file-read
isolation.
