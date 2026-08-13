# Designer next slice — captured requirements

Status: Requirements captured; implementation intentionally waiting for the Hayward brochure and dig-sheet reference upload.

## Pool geometry

- Add a **sport pool** depth profile where the deep point is in the middle of the pool.
- Example longitudinal profile: `3 ft → 5 ft → 3 ft`.
- Preserve ordinary shallow-to-deep profiles.
- The section drawing, excavation calculations, volume, hydraulics, and dig sheet must use the same authoritative profile.
- If a spa is moved, return locations and related plumbing placement must remain editable and movable.
- Return locations must not be locked to the original spa/pool arrangement.

## Layout presentation

- Keep the pool layout visually clean.
- Pool width measurements must remain **outside** the pool water envelope.
- Do not place width numbers inside the pool drawing.
- Dimensions, return markers, spa, and features must remain readable without obscuring the water shape.

## Takeoff output

- Do not render the full takeoff data as a large populated block at the bottom of the Designer window.
- Clicking the takeoff action should generate an `.xlsx` workbook for download.
- The workbook should be saved with the other project documents and usable by the superintendent to see what to order.
- The export should include, at minimum, project identity, geometry/depth profile, excavation/dig data, materials quantities, plumbing/returns, and equipment with quantities.
- Keep the on-screen Designer surface focused on the clean plan and key warnings; retain detailed derivation in the downloadable workbook.
- Verify the workbook opens, has professional formatting, and has no formula errors before delivery.

## Equipment catalog

- After the Hayward product brochure is uploaded, index the complete brochure rather than inventing products.
- Populate equipment dropdowns from the indexed catalog.
- Include relevant Hayward categories such as:
  - lights;
  - automation panels, including OmniPL where present in the source;
  - pumps;
  - filters;
  - other required pool equipment from the brochure.
- Equipment quantity must be adjustable per selected product.
- Preserve source/model/specification provenance in the takeoff export.

## Dig sheet

- The current meaning of “dig sheet” is not the intended field deliverable.
- After the user uploads a reference dig sheet, reproduce the intended excavator-facing document.
- It must clearly communicate how to dig the hole, including:
  - pool outline and orientation;
  - excavation offsets/overdig;
  - depth callouts at clearly marked stations;
  - sport-pool center deep point when applicable;
  - spa relationship and any separate excavation;
  - readable dimensions outside the pool shape.
- Do not call the existing generic output a finished dig sheet until it matches the uploaded reference.

## Sequence

1. User uploads Hayward product brochure.
2. User uploads representative dig sheet.
3. Index both sources and map their fields/visual conventions.
4. Implement the sport-pool profile and clean dimension placement.
5. Implement movable returns/plumbing locations, including after spa movement.
6. Replace bottom takeoff display with verified XLSX generation/download.
7. Implement brochure-backed adjustable Hayward equipment selections.
8. Implement the excavator-facing dig sheet.
9. Verify with Designer tests, workbook inspection/recalculation, build, and live browser use.
