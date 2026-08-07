# Field feedback — first real run, 2026-08-07

Nick's feedback while taking Gamble through the Gates on the deployed system.
The first time anybody has driven this product rather than read it.

**Captured, not acted on.** Nothing here is to be built until a job has been
carried end to end — the run is worth more than the fixes, and changing the tool
underneath it would cost the very thing being learned.

---

## 1. Moving between Designer and the field console is manual

There is no way from one to the other. A button in the field console that opens
Designer, and one in Designer that opens the field console.

Worth noting the obstacle rather than pretending it is only a missing link:
Designer runs on `localhost:5173` on a builder's machine and the field console is
served from the deployed host. They do not share an origin, and on a phone the
localhost Designer does not exist at all.

## 1b. No way to the next Gate without reloading the page

Finishing a Gate leaves you in the workspace with no way back to the picker. The
only route to the next Gate is reloading the browser — on a phone, on a job site,
with wet hands.

The cause is small and known: `render()` hides the setup panel once a Gate is
open and nothing ever shows it again. A "Next Gate" or "Change Gate" control that
returns to the picker — ideally offering the next unreleased Gate directly, since
the plan is already loaded and already knows which one that is.

## 1c. Attaching a photo takes two actions when it should take one

Choose the file, then press **Upload proof**. The second press adds nothing: by
the time a file is chosen the intent is not in doubt.

Uploading on selection is the fix. Worth keeping while doing it: the failure
states are real — a wrong evidence kind is refused, and a large photo over
cellular takes time — so the control still has to show that something is
happening and say so when it fails. Removing the button must not remove the
feedback.

## 2. Too complicated for the people who will use it

> the people using this are not software engineers. they are laborors. they need
> a simpler process.

The strongest note of the session, and the one the rest are symptoms of.

## 3. Too many checkpoints

Checkpoints and photos at **critical stages only**. Detail should be available,
not required.

This is in direct tension with a decision already recorded and approved: migration
`0017` took the checklists from 34 items to 46, and three of the additions were
safety items that were missing entirely — VGB anti-entrapment covers at pre-gunite
and final, and the safety barrier at final. Travis approved that list as written on
2026-08-03.

So this is a real conflict to resolve deliberately, not a preference to implement:
which items are genuinely release-blocking, and which are recordable but optional.
Pre-gunite's eleven are the ones a person actually meets on the hardest gate.

## 4. The takeoff sheet shows the engine instead of the answer

> super needs to know how much stuff to order. not crazy math equations. just
> collapse all the complicated stuff.

> the engine we built is absolutely beautiful but it belongs under the hood.
> people just want to drive fast. not look at the engine all day.

Order quantities first. The Calc ledger, formulas and inputs collapsed behind
something you open on purpose.

Note what must not be lost: the Calc provenance is what the approved-quantity
digest is computed over, and the compliance paths are what make a code stop
actionable. This is a presentation change, not a removal.

## 5. Preload the Hayward installation manuals

So the takeoff can carry exact part numbers rather than generic descriptions.

Ties to something the engine is already careful about: the pump curve currently
carries `PLACEHOLDER — no manufacturer chart has been read for this curve`, and
the hydraulic operating point already cites a real Hayward sell sheet. Real
manuals would replace placeholders with sourced figures — and would need the same
provenance discipline.

## 6. Show the customer name, not the ULID

The field console's status strip reads `job_BF2GC5CZTQT2S4AQN7DWCQX3RT`. It should
read **Gamble**.

Same class as the job picker fixed earlier today, and the same fix: the name is
already on the job summary. The id belongs in a detail view, not at the top of the
screen somebody works from.

---

## The theme

Five of the six are one thing: **the tool shows its workings where it should show
its conclusions.** The rigour is the product's whole value — tamper-evident
quantities, refusals that cannot be clicked past, an audit trail nobody can edit —
and none of that requires the person holding the phone to read it.

The engine stays exactly as it is. What changes is how much of it is on screen by
default.
