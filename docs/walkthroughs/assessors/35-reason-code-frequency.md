# 35 — Reason code frequency

Backlink: [[README#Reports]]

Ranked list of reason codes used across recommendations in the
selected round.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- A round with saved recommendations that have at least one reason
  code selected.

## Steps

1. Open **Reports** (`/reports`).
2. Pick the round in the selector.
3. Jump to or scroll to the **Reason Code Frequency** card.
   Strapline: *"Most-used reason codes across all recommendations in
   this round, ranked by frequency."*
4. The table shows four columns:
   - **Rank** — position in the frequency order.
   - **Code** — the numeric code in monospace.
   - **Reason** — the label, with a thin horizontal bar visualising
     the count relative to the most-used code.
   - **Uses** — the integer count.
5. Empty state *"No reason codes recorded for this round."* if no
   codes have been selected.

## Verification

- The top entry's bar fills 100%.
- The sum of all *Uses* equals the total reason-code selections (one
  recommendation can contribute multiple).

## Notes

- Use this report at the end of each round to spot codes that are
  over- or under-used:
  - A code with zero uses across multiple rounds is a candidate for
    deprecation (admin task — [[../admins/08-manage-reason-codes]]).
  - A code used heavily may need to be split into sub-codes for finer
    reporting.
- Compare round-on-round trends by switching the round selector.
