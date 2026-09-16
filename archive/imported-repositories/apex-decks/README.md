# Apex — Decks

The two client decks, as code. The `.pptx` files are build artifacts and live one level up in
`Apex/`; this repo is what regenerates them.

| File | Builds | Slides |
|---|---|---|
| `strategy-deck.js` | `apex-strategy-deck.pptx` | 20 — findings, the end-to-end walkthrough, the full ask |
| `pitch-deck.js` | `apex-pitch.pptx` | 4 — the same argument compressed to a five-minute pitch |

## Regenerate

```bash
npm install
node strategy-deck.js "../apex-strategy-deck.pptx"
node pitch-deck.js "../apex-pitch.pptx"
```

## Visual QA — do not skip this

Every layout defect found in these decks was invisible in the code and obvious in a render.
There is no LibreOffice on this machine, so the render path is PowerPoint itself via COM:

```powershell
.\render.ps1 ..\apex-strategy-deck.pptx .\render
```

Then look at every PNG. Defects that have actually shipped and been caught this way:

- Dollar amounts space-padded inside one text box, so a decimal column did not align
- Cards whose text sat lower than their neighbours — **pptxgenjs centres text vertically by
  default**, so a two-line card and a four-line card do not start at the same height. Set
  `valign: 'top'` on every multi-line body
- A background circle whose hard edge cut straight through a paragraph
- A chart axis starting at −1
- Footnotes at five different heights, so bottom margins did not match
- A card bottom edge landing 0.02in off a callout box

## Gotchas that cost real time

- **`pres.layout = 'LAYOUT_WIDE'` must be set before adding any slide.** 13.3 × 7.5in. Coordinates
  past the edge are written, not clamped — the shape just silently is not on the slide.
- **Colours never carry `#` and never eight digits.** `'E0901B'`, not `'#E0901B'`. Alpha baked into
  a hex corrupts the file; use `transparency: 0-100` instead.
- **pptxgenjs mutates option objects in place.** Never share a `shadow` or options object between
  two `add*` calls — build a fresh one each time. Both generators use small helper functions that
  return new objects for this reason.
- **Do not edit these files with PowerShell `Get-Content`/`Set-Content`.** PS 5.1 reads as ANSI, so
  a round-trip turns every em-dash and `×` into mojibake. Edit with a UTF-8-aware editor.
- `charSpacing`, not `letterSpacing`. `rectRadius` only works on `roundRect`.

## Brand

Charcoal `1B1C1E` · amber `E0901B` · paper `F6F4EF` · concrete `E9E5DE` · pool teal `0E6E7C`.
Headings Cambria, body Calibri — both chosen because they render true-to-width in QA *and* ship
with Office, so a text-fit check in the preview is trustworthy.

Structure is dark / light / … / dark: the dark slides are the claim and the ask.

## ⚠ Standing content rule

**The 23.08% margin finding is deliberately not in either deck.** Foundation §1 establishes that
"Cost Plus at 30%" is markup, not margin, and that the real gross margin is 23.08%. That was held
back from client-facing material by explicit instruction, and both decks are written so nothing
depends on it — the Lever B argument runs as *"standard scope missing from your estimate"*, which
needs no reveal. Commission language stays at "reconciled profit".

If that changes, it is roughly two slides inserted after the "what the estimate leaves out" slide
in `strategy-deck.js`. Do not add it without checking first.
