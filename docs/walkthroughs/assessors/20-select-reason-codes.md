# 20 — Select year-on-year reason codes

Backlink: [[README#Tab 3 — Writing the recommendation]]

Reason codes explain year-on-year changes (or lack of change) in
payable fees. Required on re-assessments; optional on new bursaries.

## Prerequisites

- Recommendation tab open.
- The reason codes table is populated (admin-managed — see
  [[../admins/08-manage-reason-codes]]).

## Steps

1. Scroll to the **Reason Codes** card. The header collapses /
   expands — click the row to reveal the picker.
2. Codes are bucketed into four groups (visible group headers):
   - **1 – 9: Income**
   - **10 – 19: Property & Assets**
   - **20 – 29: Family Circumstances**
   - **30 – 39: Risk Flags**
   - (plus *Other* for anything outside those bands).
3. Each code reads e.g. `7. Significant drop in earnings (illness, job
   loss)`. Tick all that apply.
4. The trigger row shows a primary-blue *N selected* pill whenever
   the selection is non-empty.
5. Click **Save Recommendation** below the card.

## Verification

- The selection chip persists after save and on hard refresh.
- The export's **Reason Codes** column lists the codes (numeric +
  label) comma-separated.
- The PDF includes the reason-code list under the Year-on-Year
  Justification heading.

## Notes

- The Reason Code Frequency report ([[35-reason-code-frequency]])
  ranks the codes you and your colleagues most often use; revisit it
  per round to spot misuse.
- Deprecated codes (admin-marked) do not appear in the picker, but
  remain visible on historical recommendations that used them.
