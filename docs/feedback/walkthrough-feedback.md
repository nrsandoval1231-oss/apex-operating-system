# Walkthrough feedback

## 2026-08-13 — Today attention badge mismatch

**Status:** Resolved in the current implementation; retained as historical walkthrough evidence.

**User observation:** The Today page visibly contained 2 items under “Things need you” / “2 NEED YOU”, but the amber navigation square beside TODAY displayed 4.

**Resolution:** Today cards and the navigation attention count now share the same actionable-work refresh path. Gate cards link directly into the relevant Project/Gate workflow, and successful writes trigger a refresh event. The Running empty state no longer implies that the project has no work.

**Evidence:** User screenshot captured at `C:\Users\NickSandoval\AppData\Roaming\Hermes\composer-images\composer_2026-08-13_01-10-41-836_5936d3.png`.

**Verification:** Full suite, targeted Today/client/Gate tests, typecheck, Apex OS build, Designer build, and `git diff --check` passed on 2026-08-13.
