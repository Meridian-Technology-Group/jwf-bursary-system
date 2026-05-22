# 05 — Edit family type categories

Backlink: [[README#Reference data management]]

The six family-type categories (1–6) each carry a notional **rent**,
**utility costs**, and **food costs** figure. These feed the income
assessment calculation. Edits are versioned: changes apply to new
assessments only, while historical assessments retain the values in
effect at the time they were finalised.

## Prerequisites

- Signed in as `ADMIN`.
- You have the new figures ready (annual £ amounts).

## Steps

1. Sidebar → **Settings**. You arrive at `/settings`.
2. Click the **Family Types** tab (first tab).
3. The table lists the six categories with columns:
   **Family Type | Notional Rent | Utility Costs | Food Costs |
   Actions**.
4. Find the category you want to update. Click **Edit** in its
   Actions cell.
5. Update one or more of the three numeric fields.
6. Click **Save**.

## Verification

- The row in the table now shows the updated values.
- An informational notice on the page reads *"Changes are versioned.
  The most recent entry per category is used in new assessments."*
- Open any **in-progress** application's assessment page — the
  calculation pulls the new figures.
- Open any **already-completed** assessment — the legacy figures are
  preserved.

## Notes

- There is no "delete" — the previous record is kept for historical
  fidelity. The new record supersedes it for any assessment created
  from now on.
- See also: [[06-edit-school-fees]], [[07-edit-council-tax-default]].
