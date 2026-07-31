# Apex Operating System - Local Demo

## Quick Start

### Option 1: Open the HTML Demo (Browser UI)
Simply double-click `demo.html` in this folder, or open it in your browser:
```
start demo.html
```

### Option 2: Run the Terminal Demo
```bash
pnpm vitest run packages/database/src/demo.test.ts --reporter=verbose
```

### Option 3: Run Full Test Suite
```bash
pnpm test
```

## What the Demo Shows

1. **Database Initialization** - All migrations (0001-0009) applied
2. **Lead Creation** - Customer lead from website intake
3. **Job Creation** - Job minted from lead with approved takeoff
4. **Proposal Creation** - Draft proposal with version tracking
5. **Issue & Sign** - Proposal issued then signed (triggers job.bound)
6. **Event Verification** - job.bound event confirmed in events table

## System Architecture

- **packages/contracts** - Zod schemas for all entities and events
- **packages/database** - PostgreSQL migrations and PGlite client
- **packages/gate-service** - Gate/evidence/release logic
- **apps/gate-api** - REST API server
- **apex-proposal-engine** - Proposal calculation engine

## Key Features

- **Canonical IDs**: All entities use ULID-based canonical identifiers
- **Event Sourcing**: All state changes emit immutable events
- **Job Binding**: Proposals bind to jobs only on signature
- **Immutable Versions**: Issued/signed proposals cannot be mutated
- **Fail-Closed**: Invalid transitions are blocked by database triggers