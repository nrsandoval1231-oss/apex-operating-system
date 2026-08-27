# Whitaker source evidence

These fixtures are manual, visually verified transcriptions of two user-supplied PDFs. Dollar values are stored as integer cents; blank source cells remain `null` rather than being inferred.

| Fixture | Original document | SHA-256 | Meaning |
|---|---|---|---|
| `estimate.json` | `FILE_8437.pdf` | `e4350228a19f32a75a977187bad0f08621a756e36b9088bfecfec9663ae9140a` | Customer-facing quoted estimate: $116,955.18 cost + $35,086.55 fee = $152,041.73. |
| `actual-costs.json` | `Whitaker Final 7.21.26 (1) (1).pdf` | `be4bb9c8b1fc77e7350ddc812467f8bb9a08b30f915c05538f2dc34c7d5988d4` | Completed-job transaction report: $104,602.12 expenses + $31,380.64 fee = $135,982.76. |

`node whitaker-evidence.test.mjs` validates every arithmetic invariant. The actual-cost report contains 61 transactions. Their descriptions are retained verbatim and their `classification` fields deliberately remain `null` until an authorized owner maps them to shared Apex cost codes.

## Authority boundary

This is same-job estimate-to-actual replay evidence. It can support:

- quoted-versus-actual whole-job reconciliation;
- payment and remaining-balance reconciliation;
- future owner-reviewed cost-code classification.

It cannot support:

- independent Designer quantity validation;
- automatic production rate calibration;
- fuzzy or guessed cost-code assignments;
- treating Whitaker as a second independent job.

## What a second job needs to carry

Whitaker is the calibration job, so its exactness is partly circular and the
limits above are structural rather than temporary. A second job closes them only
if it carries **quantities as well as dollars** — the four bullets under "cannot
support" are all downstream of the fact that this evidence set has no measured
quantity in it.

`apex-prds/decision-register.md` §7.1 is the collection list, kept there because
it is a request to a person rather than a property of these fixtures. In short:
the estimate and the transaction report as here, **plus** the payment timeline
that PRD 04's collected-GP formula needs, **plus** the pool's dimensions and the
quantities actually ordered.

Transcribe it the way these were transcribed: manual and visually verified,
integer cents, blank cells `null` rather than inferred, source SHA-256 recorded,
and `classification` left `null` until an authorised owner maps it.
