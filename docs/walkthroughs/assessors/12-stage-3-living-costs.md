# 12 — Stage 3 — Living costs

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Living costs are derived from **Section A. Reference Data** — utilities
and food auto-populate from the chosen family type; rent is the notional
rent for that category; council tax defaults to Croydon Band D.

## Prerequisites

- Workspace open. Family composition known (single parent / couple /
  number of dependants) so you can pick the right family-type category.

## Steps

1. Expand **Section A. Reference Data** (top of the form).
2. **Family Type Category** — dropdown. Each entry reads `N. <description>`
   (e.g. `3. Couple, two children`). The hint reads *"Auto-populates
   notional rent, utilities, and food costs."*
3. Selecting a category instantly refreshes the three read-only chips
   below the grid:
   - **Notional Rent**
   - **Utility Costs**
   - **Food Costs**
   These figures come from `FamilyTypeConfig` (see
   `../admins/05-edit-family-type-categories.md`). They're the
   authoritative reference values at the moment of the assessment.
4. **Annual School Fees** — pre-VAT, defaults from `SchoolFees` for
   this school. Override only if the school has confirmed a different
   figure for this child.
5. **Entry Year** — academic year the child entered (e.g. `2019`). On
   blur this recomputes **Schooling Years Remaining** via
   `13 - (academicYear - entryYear + 1)`, clamped to `[0, 13]`.
6. **Schooling Years Remaining** — editable override if the auto-calc
   is wrong (e.g. repeated year).
7. **Council Tax (annual)** — default Band D Croydon; override per
   household.

## Verification

- The **CalculationDisplay** Stage 3 block reads:
  - *Notional rent* / *Utilities* / *Food* / *Council tax* / *School
    fees (pre-VAT)*.
  - *Necessary Spending* — sum of the above.
  - *HNDI after Necessary Spending* — Stage 1 + Stage 2 minus
    necessary spending.

## Notes

- The Stage 3 figures are **inherited from reference data at the time
  the assessment is started**; if the reference table changes mid-round
  the figures already in the workspace stay put. Re-selecting the
  family type category re-pulls the current values.
- Council tax has no per-property variant — if the family lives outside
  Croydon, override the number manually.
