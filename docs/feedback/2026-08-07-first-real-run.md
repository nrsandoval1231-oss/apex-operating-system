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

## 1d. The owner cannot drill down from Today to what actually happened

> travis should be able to look at the today screen and drill all the way down to
> exactly whats going on. right now he cant click anything.

Also asked for: opening **previous** Gates, and seeing the **photos that were
approved and passed**.

Checked rather than assumed, because the shape of the gap matters:

- **Today cards do carry a link.** `actionHref` is set on every card and rendered
  as the small action button — "Review and countersign" and so on. So there is one
  clickable target per card, in the least prominent place on it, and the card
  itself is dead. It reads as unclickable because effectively it is.
- **The link only ever goes to the project page.** Every card resolves to the same
  destination regardless of what it is about, so "drill down to exactly what is
  going on" ends one level too early. Asked for again separately — *"i need to be
  able to click into the project from the today page"* — which is worth reading
  carefully: the destination is already right, it is the target that is too small
  to find. The whole card should be the link.
- **A released Gate cannot be opened anywhere in Apex OS.** The project page lists
  Gates with a status badge and nothing behind it. Gate detail lives only in the
  field console, which is built for the person doing the work rather than the
  owner reviewing it.
- **Evidence cannot be viewed by staff at all.** `GET /api/evidence/:id` exists and
  serves the bytes; the staff app calls it in exactly one place —
  `CustomerPage.tsx`, to toggle whether a photo is customer-visible. There is no
  screen where somebody can look at the photographs that passed a requirement.

That last one is the sharpest. The system takes photographs, hashes them, stores
them immutably and refuses to release a Gate without them — and then never shows
them to the person whose signature the whole control exists to protect. The
evidence is being collected for an audit nobody can perform.

## 1e. Today takes seconds to load

Measured against the deployed system rather than recorded as an impression:

| Endpoint | Time |
|---|---|
| `/api/today` | **6.5 s, 10.2 s, 6.7 s** |
| `/api/jobs` | 0.23 s, 0.28 s |

Same instance, same minute, so it is not a cold start — and it is the screen the
owner opens first every morning.

Not yet diagnosed, and the obvious guess looks wrong: `readCardSnapshot` issues
three batched queries, not one per job, so this is not a naive N+1. Earlier in the
same session `/api/today` was answering in 52–1158 ms on the same data shape, so
something changed as Gamble accumulated Gates, evidence and events. Needs
profiling against the real query plans before anyone "optimises" it.

Worth holding onto while fixing: the derivation is deliberately pure and takes
`today` as an argument, which is what makes the feed reproducible and every rule
unit-testable. Caching must not quietly reintroduce a clock.

## 1f. Cards tell you to do things the product cannot do

> i click the button to confirm invoice and nothing happens its still there. then
> i assign super and nothing happes still there and clickable

Not a broken button — a missing one. Both cards navigate to the project page and
sit there afterwards, because **there is no control on that page for either
action**, so nothing changes and the condition that produced the card is still
true.

The whole staff app writes in exactly two places: `Inspections.tsx` and
`CustomerPage.tsx`. Everything else is read-only. So the action feed is derived
from state, correctly names what needs doing, links somewhere — and then the
product has no way to do it.

Three office acts have an API and no UI:

| Card says | Endpoint that exists | Control |
|---|---|---|
| Draw released but unbilled | `POST /api/jobs/:id/draws/:code/invoice` | none |
| No superintendent assigned | `POST /api/jobs/:id/project` | none |
| Job not opened as a project | `POST /api/jobs/:id/project` | none |

This is the worst failure mode in the feedback so far, and it is worse than a
missing feature. The action feed's entire promise is that a card states a
consequence and can be acted on — the design note says *"a card must state a
consequence or it is not generated"*. A card that cannot be cleared teaches the
owner that the feed is decorative, which is exactly what the feed was built to
avoid. It will train him to scroll past the ones that matter.

Already recorded as "the three office buttons that do not exist" in
`docs/HANDOFF.md`. This is what their absence feels like from the chair.

## 1g. The Gate dropdown is empty after choosing a job

Pick a job, open the Gate dropdown, and it still reads "Choose a job first" with
nothing in it. The Gates only load when **Open Gate** is pressed —
`loadGateChoices()` runs inside that handler and nowhere else — so the two
dropdowns are filled by different events and one of them looks broken.

**Caused by the job picker added earlier today.** Before it, the flow was: type an
id, press Open Gate. Nothing selected a job as a distinct act, so nothing implied
the Gates should appear. Introducing a job dropdown created exactly that
expectation and did not satisfy it, which is a fair description of a bug.

Fix is small: load the Gate plan when the job selection changes, not only when
Open Gate is pressed.

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
