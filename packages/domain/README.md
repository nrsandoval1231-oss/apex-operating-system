# Operational domain

`@apex/domain` contains pure, side-effect-free business decisions.

The first implemented aggregate is the pre-gunite Gate. It enforces:

- approved takeoff revision linkage;
- role-based command authority;
- separate evidence and requirement outcomes;
- required evidence before release;
- immutable released state; and
- one decision producing `gate.released`, `draw.eligible`, and `customer_update.published` event drafts.

Persistence and authentication are adapters around this package; they are not permitted to reimplement its release rules.
