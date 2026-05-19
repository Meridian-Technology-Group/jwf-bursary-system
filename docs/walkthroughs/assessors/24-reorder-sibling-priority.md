# 24 — Re-order sibling priority

Backlink: [[README#Sibling linking]]

Sibling priority controls the order of fee absorption. The eldest /
primary holder sits at priority 1; their fees are deducted from family
HNDI before the next sibling is calculated.

## Prerequisites

- Two or more siblings are linked (see [[23-link-siblings]]).
- Signed in as `ASSESSOR` or `ADMIN`.

## Steps

1. Open the **Applicant Data** tab. The **Linked Siblings** card shows
   each linked child as an ordered list, with priority badges 1 …N.
2. To move a sibling up or down, use the arrow buttons on the right of
   each row:
   - **ArrowUp** — promote one place (disabled at position 1).
   - **ArrowDown** — demote one place (disabled at the last position).
3. The local list re-renders optimistically; the request fires to
   `PATCH /api/siblings/[id]` with the new `orderedIds` array.
4. If the server rejects the reorder, an inline red banner reads e.g.
   *"Reorder failed"* and the list rolls back to the previous order.

## What this changes

- The new `priorityOrder` on each `SiblingLink` row.
- On the next assessment save / recalculation, the calculator absorbs
  the payable fees of all siblings with a lower `priorityOrder` than
  the child being assessed.

## Verification

- The badge numbers update immediately and persist on refresh.
- Open the calculation sidebar on the re-assessment of any later
  sibling — the *Sibling payable fees absorbed* line reflects the new
  order.

## Common use case

When the eldest child leaves school (Y13), they no longer carry
payable fees. Demote them in priority or unlink (see
[[25-break-sibling-link]]) so the next sibling becomes primary and
their assessment recalculates correctly.
