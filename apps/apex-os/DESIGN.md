# Design

Durable visual decisions for `apps/apex-os`. Product truth lives in
[PRODUCT.md](PRODUCT.md). Brand tokens originate in
`apex-website/src/styles/global.css` and are binding.

---

## Direction contract

**THESIS.** This is an engineered plan sheet read in the dark, not a dashboard.
Apex's own documents — the plan set, the site placard, the draw schedule, the
batch ticket — are what Travis already reads all day, so the app speaks their
grammar: hairline rules, stamped phase markers, tabular figures, a hard title
block. It refuses the arrangement this category always ships: a grid of equal
rounded cards, each an icon over a heading over grey text, floating on a page
that could belong to any SaaS product.

**OWN-WORLD.** Charcoal ground with a single lifted panel value and hairline
rules — no shadows, no glass, no glow. Oswald condensed uppercase for names and
screen titles, the register of site signage. JetBrains Mono, tabular, for every
number that means something: money, phase counts, percentages, dates, status
tags. Inter for the sentence that explains why. Sage is the only brand colour and
the only primary action. Amber appears exactly twice: an alert stamp and the
focus ring.

**STORY.** Travis opens it one-handed. Within one screen he knows what needs him,
why, and what happens if it waits. He taps one thing and acts, or he closes it
knowing nothing is on fire.

**FIRST VIEWPORT.** A title block: `TODAY`, the date in mono, and a live count of
what needs him. Below it, immediately, the most urgent item — full width, amber
stamp, the action in Oswald at 22px, the consequence in a readable sentence, the
timing in mono, and its one button. No cards floating in space; rows divided by
hairlines like a schedule sheet. Routine items sit visibly quieter in the same
grammar, not in a different one.

**FORM.** Plan sheet / site placard, ranked first of the audience's visual
systems. Brief-pinned by the user (dark, charcoal/sage/amber, sun-readable), so
no roll was taken.

---

## Palette

Dark is chosen from the scene, not the category: a phone held one-handed in
direct West Texas sun and again at 6am before light. A charcoal ground with a
narrow set of high-contrast foregrounds beats a paper ground in both.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#141517` | Page. Deeper than the brand charcoal so panels can sit above it. |
| `--panel` | `#1b1c1e` | Brand charcoal. Rows, title blocks, the raised plane. |
| `--panel-2` | `#212427` | Pressed and hover states only. |
| `--rule` | `#31353a` | Hairline rules. The only structural device; 1px, never thicker. |
| `--rule-bright` | `#454a50` | Rules that separate sections rather than rows. |
| `--ink` | `#f4f2ee` | Primary text. 15.8:1 on ground. |
| `--ink-2` | `#a8a49c` | Secondary text and mono labels. 6.4:1 on ground. |
| `--ink-3` | `#6f6b64` | Disabled and de-emphasised. Never body text. |
| `--sage` | `#a1ccca` | Brand, primary action, cleared/passed. 9.75:1 on charcoal. |
| `--sage-d` | `#8ab8b6` | Button hover. |
| `--amber` | `#e0901b` | **Alerts and focus only.** Never brand, never a default CTA. |
| `--pool` | `#4fb3c4` | The Designer Pools vertical, lightened for dark ground. |

Colour strategy: **Restrained** — neutrals plus one accent. Travis came here to
operate, and a second brand colour would compete with the one signal that
matters. Amber is not a second brand colour; it is an alarm.

## Type

Self-hosted via `@fontsource`. No external requests, matching the website.

| Face | Use | Rules |
|---|---|---|
| **Oswald** 500/600 | Screen titles, customer names, action titles | Uppercase for titles and labels; sentence case for action titles. Tracking `0.02em`. Condensed, so it holds a long customer name at phone width without truncation. |
| **Inter** 400/500 | The reason sentence, body prose, empty states | The only face allowed to run in sentences. Measure capped at 60ch. |
| **JetBrains Mono** 400/600 | Money, phase counts, percentages, dates, status tags, IDs | `font-variant-numeric: tabular-nums` everywhere. Uppercase and tracked `0.08em` when used as a label. |

Monospace here is measurement and money, not a costume for "technical". If it is
not a number, an identifier, or a status stamp, it is not mono.

Scale, phone-first: 28px title / 22px action / 15px body / 13px secondary /
11px mono label. Nothing below 11px, ever, and nothing below 13px carries meaning
a user must read to act.

## Structure

- **Rows, not cards.** Full-bleed rows separated by 1px rules, like a schedule on
  a drawing. No shadows, no floating rounded rectangles, no nested containers.
- **Title block.** Every screen opens with one: name in Oswald, context in mono,
  a hairline beneath. It is the drawing sheet's title block, and it is how you
  know where you are without a breadcrumb.
- **Urgency is a stamp, not a bar.** An amber tag sitting on the row's top edge,
  the way a red tag is stapled to a site post. Never a thick coloured left
  border — that is the callout pattern every framework ships.
- **Phase track** is a dimension line: nine stamped markers on a rule, the
  current one filled sage, completed ones outlined, upcoming ones dim. It is the
  one place the number sequence carries real information, so numbers are shown.

## Interaction

- Minimum target 48×48px. Primary actions are full-width at phone.
- Focus ring: 2px amber, 2px offset. Amber exists for this — a sage ring on a
  sage button would be invisible.
- Motion: one authored moment. Rows settle in on load with a short staggered
  rise, exponential ease-out, from an already-visible default. Nothing else
  animates except state changes. Respects `prefers-reduced-motion`.
- Hover is a panel-value shift, never a transform or a glow.

## Non-negotiables

1. **Never invent a fact.** Missing data reads "Not recorded" in `--ink-3`. A
   figure the system does not hold is never rendered as `$0`.
2. **Amber only alerts.** If amber appears as brand or as a default action, it
   has drifted.
3. **No sample data on a wired screen.** Failure, empty, and signed-out states
   are explicit.
4. **Every card states its consequence.** Design must not truncate the reason
   sentence away; it is the whole point of the card.
