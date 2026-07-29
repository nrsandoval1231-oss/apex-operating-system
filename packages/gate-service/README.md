# Persistent Gate service

`@apex/gate-service` joins the pure Gate domain to PostgreSQL persistence.

It provides:

- idempotent command execution;
- Gate state reconstruction from append-only events;
- atomic event and projection writes;
- evidence metadata persistence separate from evaluation;
- draw eligibility projected from Gate release; and
- strict customer-safe milestone reads.

The service accepts only a migrated database. HTTP authentication, binary evidence handling, and user-facing behavior live in `apps/gate-api`.
