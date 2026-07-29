# Gate controlled-pilot runbook

## Purpose

Exercise exactly one pre-gunite hold point without representing the broader Apex system as production-ready.

## Before the pilot

1. Verify `pnpm verify` and the production dependency audit.
2. Use a dedicated encrypted directory for Gate data and evidence.
3. Generate a new 32+ byte JWT secret outside the repository.
4. Provision active office and field users.
5. Accept a signed proposal and mint the canonical Job ID.
6. Import and approve one Designer takeoff revision, including its input and calculation-ledger SHA-256 hashes.
7. Confirm there is exactly one active pre-gunite Gate for that Job and revision.
8. Issue short-lived role-correct tokens only to pilot participants.

## Field sequence

1. Open the Gate console and enter the canonical Job ID and short-lived token.
2. Confirm the displayed approved takeoff revision.
3. Start the Gate.
4. For each requirement, upload actual field proof and then record pass or fail separately.
5. Do not release while any item is pending, failed, or missing evidence.
6. An authorized field or admin user releases the Gate only after physical verification.
7. Confirm that release produced exactly one draw-eligibility record and one customer milestone.
8. Confirm the customer payload contains no raw evidence paths, internal event payloads, costs, or margin data.

## Refusal boundaries

- No approved takeoff revision: do not create or start the Gate.
- Missing/unsupported evidence: do not pass the requirement.
- Failed requirement: block work, document why, correct, add new evidence, and reevaluate.
- Authentication/role mismatch: do not bypass with a shared token.
- Chemistry advice: not part of this Gate and not authorized for field deployment.
- API/storage failure: stop; do not substitute a checkbox, text message, or memory for durable proof.

## Backup and recovery

For the local controlled pilot, stop the API before copying both the database and evidence directories. Preserve them together with a timestamped manifest and checksums. Restore into a separate directory, start the API against the restored copy, and verify:

- Gate and requirement history reloads;
- evidence files match recorded SHA-256 values;
- released events remain immutable;
- draw eligibility and customer projection each exist once; and
- the original pilot directory remains untouched.

A successful local copy is not a production backup program. Managed deployment requires automated encrypted backups, retention, restore testing, and access logging.
