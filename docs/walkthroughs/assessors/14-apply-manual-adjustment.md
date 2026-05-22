# 14 — Apply a manual adjustment

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

A pound-value override on the calculated yearly payable fees, used for
edge cases (year-1 benchmark honour, panel discretion, etc.). Adjustment
direction matters: positive increases the family's fees, negative
reduces them.

## Prerequisites

- Workspace open. You have a documented justification for the override
  (e.g. matches first-year benchmark, panel decision dated …).

## Steps

1. In **Section D. Payable Fees**, locate the **Manual Adjustment**
   field. Hint: *"Positive = increase fees; Negative = reduce fees"*.
2. Enter a £ value. The display strips `£` and commas, parses on blur,
   and re-formats.
3. As soon as the value is non-zero, the **Manual Adjustment Reason**
   text input appears beside it (placeholder *"Reason for manual
   adjustment"*).
4. Enter a brief justification — this is mandatory in practice and
   shows on the audit trail and the recommendation PDF.
5. Blur the field; the assessment auto-saves after a 300 ms debounce.
6. Confirm the sidebar's *Yearly Payable Fees* and *Monthly Payable
   Fees* lines reflect the adjustment (the calculator stores the
   **adjusted** values in `yearlyPayableFees` / `monthlyPayableFees`).

## Verification

- The calculation sidebar shows an *Adjusted yearly payable fees* line
  alongside the unadjusted figure.
- On save, the audit log records the field change including the reason
  string.
- The recommendation tab's *Yearly Payable Fees* card carries the
  adjusted figure.

## Notes

- Setting the adjustment back to 0 clears the reason field from view;
  the previously-entered reason is preserved in `manualAdjustmentReason`
  but no longer surfaced unless the value goes non-zero again.
- For **re-assessment benchmark honours**, see
  [[27-compare-against-year-1-benchmark]] — the benchmark banner gives
  the £ delta you should enter here.
