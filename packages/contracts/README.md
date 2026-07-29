# Shared contracts

`@apex/contracts` defines the runtime-validated language shared by the non-Website Apex system.

It owns:

- namespaced ULID identities (`Lead ID`, `Job ID`, event, revision, Gate, evidence, draw, and customer-update IDs);
- application roles and event actors;
- versioned operational events;
- takeoff revision metadata and audit hashes;
- Gate definitions and requirement contracts;
- evidence metadata, deliberately separate from pass/fail state; and
- the strict customer milestone projection.

All boundary inputs must be parsed through these Zod schemas. TypeScript types alone are not an acceptance boundary.
