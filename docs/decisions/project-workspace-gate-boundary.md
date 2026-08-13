# Project Workspace and Gate Boundary

**Recorded:** 2026-08-13
**Status:** Confirmed implementation direction

## Decision

Apex should present **Projects and Gates as one unified Project Workspace** centered on the canonical `job_id`.

This is a UI and workflow merge, not a destructive database merge:

- A Project is the operational face of a Job; it does not receive a second `project_id`.
- Gates remain separate event-sourced operational records because their requirements, evidence, inspections, signatures, release actions, and append-only history have different invariants.
- The unified workspace must expose the current phase, Gate plan, Gate actions, inspections, evidence, schedule, draws, customer updates, and history from one Job-centered route.
- The standalone Gate field console is retired. Its evidence, evaluation, and release workflow is presented inside the selected Project workspace.
- Stable Job ID remains the cross-surface identity. Customer names are display-only.

## Why not collapse the tables

`projects.job_id` already keys the Project record to the canonical Job. Collapsing `gate_instances` into `projects` would lose the ability to preserve multiple Gate definitions, requirement evaluations, evidence relationships, inspection blocking, signatures, and append-only event history safely. It would also reintroduce the identity and audit drift the current model was designed to prevent.

## Acceptance behavior

A staff member should be able to:

1. Open one Project Workspace from Projects, Today, Calendar, or History.
2. See the current phase and the complete Gate plan for that Job on the same screen.
3. Open or work the next Gate without manually reselecting a Job.
4. Review requirements, evidence, inspections, release status, draws, schedule, and customer updates in the same Job context.
5. Use the focused Gate console for field work and return to the Project Workspace with the same stable Job ID.

The current implementation already provides the underlying canonical identity and read-only Gate summary. The next UI slice should make the workspace the primary staff surface rather than introducing a second domain identity.
