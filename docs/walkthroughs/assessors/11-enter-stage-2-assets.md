# 11 — Enter Stage 2 — Assets

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Record property, savings, and investments. The yearly asset valuation
feeds the Stage 2 line in the calculation sidebar.

## Prerequisites

- Workspace open with at least Section B largely complete (see
  [[10-enter-stage-1-income]]).
- Mortgage statement, bank/savings statements, and ISA/share statements
  visible in the document panel.

## Steps

1. Expand **Section C. Property & Savings** ("Housing situation and
   financial assets").
2. **Mortgage-free property** toggle — *"If checked, notional rent is
   added back to income."* Switch on only if the family fully owns
   their primary residence.
3. **Additional Property Count** — integer (default 0). When > 0, the
   **Additional Property Income (annual)** field becomes editable.
4. **Additional Property Income (annual)** — total rental income from
   additional properties.
5. **Cash Savings** — total cash savings across bank accounts.
6. **ISAs / PEPs / Shares** — total value of investment holdings.
7. **School-Age Children Count** — integer, default 1, minimum 1. Used
   as the divisor for the savings amortisation; the calculator
   distributes the cash+investments pot across this many children over
   the remaining school years.

## Verification

- The **CalculationDisplay** Stage 2 block updates:
  - *Cash savings*
  - *ISAs / PEPs / Shares*
  - *Derived savings (annual)* — the savings divisor result.
  - *Notional rent uplift* (only if mortgage-free is on).
  - *Net Assets Yearly Valuation* — the bold sub-total.
- When mortgage-free is on, the **Stage 1** total household net income
  line increases by the notional rent (read off Section A's "Notional
  Rent" reference chip).

## Notes

- Derived savings = `(cashSavings + isasPepsShares) /
  schoolAgeChildrenCount / schoolingYearsRemaining`, capped at zero.
- A school-age children count of 0 is disallowed by the input
  (`min={1}`).
- Negative numbers are not accepted; the input clamps to 0.
