# 10 — Enter Stage 1 — Income

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Record per-parent employment status and the income components that
flow into the Stage 1 *Total Household Net Income* line.

## Prerequisites

- The assessment workspace is open (see
  [[09-set-up-assessment-workspace]]).
- The relevant P60s, tax returns, payslips, and benefit award letters
  are visible in the document panel.

## Steps

1. Expand **Section B. Income Entry**. Two tabs appear: **Parent 1**
   and **Parent 2**.
2. For each parent, set **Employment Status** from the dropdown. The
   visible fields below adjust to match:
   - **PAYE (Employed)** → *Net Pay (annual)*, plus benefits.
   - **Benefits only** → benefits only.
   - **Self-employed (Director)** → *Net Self-Employed Profit*, *Net
     Dividends*, plus benefits.
   - **Self-employed (Sole Trader)** → *Net Self-Employed Profit*,
     plus benefits.
   - **Old Age Pension** → *Pension Amount (annual)*, plus benefits.
   - **Past Employment Pension** → *Pension Amount (annual)*, plus
     benefits.
   - **Unemployed** → no income/benefit inputs.
3. Enter the figures **from source documents**, not the applicant's
   declared totals:
   - *Net Pay (annual)* — total net salary after tax and NI (hint).
   - *Net Self-Employed Profit (annual)* — net profit after allowable
     expenses.
   - *Net Dividends (annual)* — net dividends received from company.
   - *Pension Amount (annual)*.
4. Enter benefits in two columns:
   - **Benefits Included (annual)** — DLA, ESA, PIP, Carer's. A
     **Benefits Included — Detail** input appears once non-zero (e.g.
     *"DLA £4,500, PIP £2,100"*).
   - **Benefits Excluded (annual)** — child disability benefits.
     Recorded only, not added to income. The detail input appears once
     non-zero.
5. The per-parent total chip *"`Parent 1` Total Income"* updates live in
   the primary-blue strip at the bottom of the tab.
6. Switching tabs persists in-memory state; saves are scheduled on blur.

## Verification

- The right-hand **CalculationDisplay** sidebar's Stage 1 section
  shows *Parent 1 net income*, *Parent 2 net income*, *Additional
  property income* (if any), and *Total Household Net Income*. The
  total matches the sum of the two per-parent chips plus rental income
  from Section C.
- Saving (auto or manual) records a server-side calculation snapshot —
  see [[16-save-the-assessment]].

## Notes

- Changing **Employment Status** zeroes any fields no longer visible
  (e.g. switching from PAYE to Unemployed clears *Net Pay*). This is
  intentional — see `resetEarnerFieldsForStatus` in
  `src/components/admin/earner-form.tsx`.
- Currency inputs accept commas and `£`; they're parsed on blur and
  redisplayed as `1,234.00`. Negative values are clamped to 0.
