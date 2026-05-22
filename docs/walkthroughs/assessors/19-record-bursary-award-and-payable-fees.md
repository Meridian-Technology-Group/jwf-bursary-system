# 19 — Record bursary award and payable fees

Backlink: [[README#Tab 3 — Writing the recommendation]]

These three figures are **read-only on the recommendation tab** — they
are pulled directly from the completed assessment and cannot be edited
here. If they need to change, go back to the assessment tab.

## Prerequisites

- Assessment `COMPLETED`.
- Recommendation tab open.

## Steps

1. At the top of the tab, the **Assessment Fee Summary** card shows:
   - **Bursary Award** — pre-VAT bursary in £.
   - **Yearly Payable Fees** — post-VAT, post-manual-adjustment.
   - **Monthly Payable Fees** — yearly / 12.
2. Below them sits the help text *"These values are carried over from
   the completed assessment and cannot be edited here."*
3. To change any of these:
   - Switch back to the **Assessment** tab.
   - The form is read-only because status is `COMPLETED`. There is no
     in-app "unlock" — re-opening the assessment after completion
     requires an admin to reset it (or the assessor to start a new
     re-assessment in the next round).
4. Once the figures look right, fill in the recommendation fields
   (synopsis, categories, summary, reason codes) and click **Save
   Recommendation**.

## Verification

- `Recommendation.bursaryAward`, `yearlyPayableFees`, and
  `monthlyPayableFees` are persisted from the `Assessment` row via
  `saveRecommendationAction`. Refreshing the page re-displays the
  same values.

## Notes

- Sibling absorption (see [[23-link-siblings]]) is already baked
  into the assessment's payable fees by the time the recommendation
  loads — no further adjustment is needed here.
- Where a panel decision requires a different award amount, **do not**
  edit fields outside the system. Either request the assessment be
  reopened (admin task) and apply a manual adjustment, or note the
  panel decision in the recommendation summary and surface it via a
  reason code.
