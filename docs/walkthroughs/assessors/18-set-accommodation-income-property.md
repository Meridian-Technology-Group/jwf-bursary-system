# 18 — Set accommodation status, income category, property category

Backlink: [[README#Tab 3 — Writing the recommendation]]

These three fields are the school-facing classifications. Income is a
**category** (banded), not a precise figure — preserves family privacy
while still informing admissions decisions.

## Prerequisites

- Recommendation tab open, assessment `COMPLETED`.
- You have already noted the family's accommodation type and income
  band from the assessment workspace.

## Steps

1. In the **Recommendation Details** card, locate the two-column row:
   - **Accommodation Status** *(free-text input)* — placeholder
     *"e.g. Rented, Mortgaged, Owned outright"*. Type the appropriate
     value verbatim (or the agreed Foundation taxonomy if your team
     uses fixed strings).
   - **Income Category** *(free-text input)* — placeholder
     *"e.g. Low, Medium, High"*. Enter the band label your team uses
     (e.g. `£15K–£25K` or `Low`).
2. Below the row, **Property Category (1 – 12)** is a numeric select.
   Pick the integer that reflects the family's primary residence
   bracket. When > 8 the amber **High Property Category** advisory
   banner appears at the top of the tab.
3. The placeholder reads *"Select…"* until set.
4. Click **Save Recommendation** at the bottom of the page when all
   three fields are filled.

## Verification

- After save, the page re-renders with the values pre-filled.
- The export's **Income Category** and **Property Category** columns
  carry the chosen strings.
- The recommendation PDF includes both fields under the *Categories*
  section.

## Notes

- Accommodation status and income category are free-text today — there
  is no enum constraint. Agree a fixed vocabulary with your team
  (typical: *Rented*, *Mortgaged*, *Owned outright*; *Low*, *Medium*,
  *High*) and stick to it; the export grouping relies on consistent
  spelling.
- The property category is the only banded field anchored to a
  Foundation policy — see [[34-property-category-distribution]] for
  the £-thresholds used in the report.
