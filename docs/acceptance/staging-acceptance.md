# Apex staging acceptance

Salvaged from `origin/dev` commit `bc504eb`. Staging is Cloudflare (`*.workers.dev` and `*.pages.dev`), not Render and not a custom domain. This checklist uses synthetic data only. Do not enter real customer information, send real SMS or email, or fire real conversion events.

## Preconditions

- [ ] Staging API reports healthy database and evidence storage from `/ready`.
- [ ] Staging website is served from Cloudflare Pages and uses the staging/test webhook.
- [ ] Staging staff identity is Cloudflare Access. Each allowed mailbox maps to an active `app_users` row by lower-cased email, and the role comes from that row. Customers stay on `/c/<token>` links.
- [ ] Approved pilot pricing inputs are loaded; no inferred/default customer pricing is enabled.
- [ ] Backup exists and restore operator is identified.

## Evidence convention

Record only timestamps, synthetic IDs, endpoint responses, and pass/fail results. Do not commit customer PII, access tokens, signed URLs, or production payloads. Store temporary evidence outside Git and link to its controlled location in the acceptance record.

## A. Website and intake

- [ ] Open the Cloudflare dev/staging URL on desktop and mobile.
- [ ] Confirm the four verticals render in the approved order.
- [ ] Confirm each vertical preselects the correct consent brand.
- [ ] Submit one synthetic lead for each vertical to the test webhook.
- [ ] Verify each payload includes `lead_id`, `vertical`, attribution, consent fields, and `submitted_at`.
- [ ] Verify no dev/staging submission reaches a production webhook or destination.

## B. Designer and takeoff

- [ ] Create a synthetic opportunity.
- [ ] Open Designer from the staging OS.
- [ ] Select Sports Pool `3′–5′–3′`.
- [ ] Resolve design blockers.
- [ ] Download the `.xlsx` takeoff.
- [ ] Confirm `Order List` is the first sheet.
- [ ] Confirm quantities carry the expected `designer-quantity-v5` model and digest.

## C. Estimate and proposal

- [ ] Run Finish Estimate for the opportunity.
- [ ] Retry Finish Estimate with the same idempotency inputs.
- [ ] Confirm no duplicate revision or event is created.
- [ ] Enter every approved measured estimate and direct quote/N/A decision.
- [ ] Confirm unresolved pricing blocks issuance.
- [ ] Issue the exact proposal version after blockers are cleared.
- [ ] Verify PDF/email-copy/mailto actions do not claim an email was sent.

## D. Acceptance and construction

- [ ] Record acceptance of the exact issued proposal.
- [ ] Retry acceptance with the same idempotency key.
- [ ] Confirm exactly one Job and one Project exist.
- [ ] Exercise gate release, inspection, evidence, schedule, and draw actions.
- [ ] Confirm evidence is retrievable and linked to the correct Job ID.

## E. Closeout and history

- [ ] Satisfy reconciliation requirements.
- [ ] Close the synthetic project.
- [ ] Retry closeout and confirm idempotent behavior.
- [ ] Attempt closed-job mutations and confirm domain refusal.
- [ ] Confirm History, retained takeoff, proposal, and evidence reads still work.

## F. Restore drill

- [ ] Restore the staging database backup into an isolated target.
- [ ] Restore/verify evidence objects or storage-version recovery.
- [ ] Confirm project identity, proposal version, gate state, and evidence references match.
- [ ] Record restore duration, operator, result, and any gaps.

## Acceptance result

- Result: `PENDING`
- Date/time:
- Environment URL:
- Synthetic test run ID:
- Restore evidence location:
- Human approver:
- Exceptions/blockers:
