# Designer workflow — implemented scope and deferred references

**Status:** Core workflow implemented and verified 2026-08-13. Catalog-backed equipment selection and a reference-matched excavator dig sheet remain deferred until source documents are supplied.

## Implemented

### Pool geometry

- A true **Sports Pool 3′–5′–3′** depth profile places the deepest point in the center and returns to a shallow end.
- Ordinary shallow-to-deep profiles remain supported.
- The authoritative profile drives geometry, plan/section views, excavation, volume, hydraulics, quantities, exports, resizing, and saved job files.
- Floor-depth queries inspect both footprint edges and every profile vertex, so steps/seats crossing the center-deep region use the actual deepest supporting floor.
- The quantity contract is versioned as `designer-quantity-v5`; older approved revisions retain their historical version.

### Layout presentation

- Pool dimensions remain outside the water envelope.
- Plan and longitudinal-section views stay focused on the design rather than a bottom-of-screen data dump.
- The normal workflow exposes design controls, warnings, the plan, the section, **Takeoff (.xlsx)**, and **Finish estimate**.
- Raw JSON diagnostics are available only under **Advanced**.

### Ordering workbook

- **Takeoff (.xlsx)** generates a real workbook rather than rendering the full takeoff payload in the application.
- `Order List` is the first sheet and is intended for superintendent ordering.
- Project metadata, geometry/profile, excavation assumptions, and calculation/reference information are secondary sheets.
- Workbook and worksheet text is sanitized before export.
- Designs with unresolved blockers cannot produce an authoritative export.

### Excavation information

- Excavation bank/haul volumes and estimated loads remain available because they are useful takeoff facts.
- Soil/spoil assumptions are reference information under **Advanced**, not primary workflow requirements.
- The workbook labels excavation assumptions for confirmation before ordering haul work.

### Apex handoff

- **New design project** creates a pre-contract opportunity, not a fabricated construction Job.
- **Finish estimate** hands the exact design revision to Apex OS for approved-takeoff pricing and versioned Proposal creation.
- Job creation occurs only after acceptance of an issued Proposal is recorded authoritatively.

## Verification

- Designer full suite: **580 tests passed**.
- Strict TypeScript check passed.
- Production build passed.
- Root cross-repository contract accepts the real `designer-quantity-v5` export.
- Headless Chrome rendered the workflow with sports-pool, `.xlsx`, Finish Estimate, and Advanced controls visible and no default verbose JSON dump.

## Deferred: equipment catalog

Do not invent products. After an approved Hayward brochure/catalog is supplied:

1. Index the complete source.
2. Populate equipment controls from source-backed categories and models.
3. Keep quantity adjustable for each selected product.
4. Preserve manufacturer/model/specification provenance in the workbook and Proposal inputs.
5. Test source updates and unknown/discontinued products explicitly.

## Deferred: excavator-facing dig sheet

The current plan/section and excavation workbook are not a claim that a contractor-specific dig sheet has been reproduced. After a representative approved dig sheet is supplied:

1. Map its field conventions and required stations.
2. Produce the pool outline, orientation, overdig offsets, depth stations, sports-pool center deep point, spa relationship, and dimensions in that convention.
3. Keep the deliverable distinct from the ordering workbook.
4. Validate it with the intended excavator before calling it authoritative.

## Acceptance rule for future Designer work

Every new design fact must have one authoritative source and must propagate consistently through geometry, views, quantities, workbook, Apex submission, saved job files, and tests. Never patch only the picture or only the export.
