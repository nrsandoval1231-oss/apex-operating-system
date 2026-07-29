# Gate API and field console

This app is the controlled-pilot pre-gunite vertical slice. It serves a loopback-only HTTP API and a superintendent console at `/`.

Implemented flow:

```text
approved Designer takeoff revision
→ versioned pre-gunite requirements
→ private binary evidence + SHA-256 metadata
→ field evaluation
→ authorized Gate release
→ draw eligibility
→ customer-safe milestone
```

## Required environment

- `GATE_JWT_SECRET` — at least 32 bytes; never commit it.
- `GATE_DATA_DIRECTORY` — local embedded PostgreSQL directory; defaults to `./var/gate-db`.
- `GATE_EVIDENCE_DIRECTORY` — private evidence directory; defaults to `./var/gate-evidence`.
- `PORT` — optional; defaults to `4100`.

Run from the root:

```bash
pnpm build
pnpm --filter @apex/gate-api start
```

The server binds to `127.0.0.1` intentionally. Pilot tokens must be short-lived HS256 JWTs with issuer `apex-gate`, audience `apex-gate-api`, canonical User ID in `sub`, and `app_role`. The signed role is checked against the active database user before every protected request.

This local adapter is not the production deployment profile. Production still requires managed PostgreSQL, asymmetric/JWKS authentication, object storage, TLS, monitoring, backup automation, and a completed recovery drill.
