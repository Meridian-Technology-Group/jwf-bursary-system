# 15 — Select property category and record red flags

Backlink: [[README#Tab 2 — Running the assessment (the calculation engine)]]

Property category is a **recommendation-tab** field (1–12); red flags
live on the assessment form's Section E and surface as banners on the
recommendation.

## Prerequisites

- Workspace open. You have read the application's "Property and
  Savings" data and any uploaded title deeds / mortgage statements.

## Steps — record red flags (Section E)

1. Expand **Section E. Flags** in the assessment form (open by
   default).
2. **Dishonesty flag** — tick when there is evidence of misleading or
   inaccurate information ("Raise if evidence of misleading or
   inaccurate information").
3. **Credit risk flag** — tick when there are concerns about financial
   stability or debt ("Raise if there are concerns about financial
   stability or debt").
4. Blur the checkbox; the change auto-saves.

## Steps — choose property category (Recommendation tab)

1. Once the assessment is `COMPLETED`, switch to the **Recommendation**
   tab. (Selection is gated — see [[16-save-the-assessment]].)
2. In the **Recommendation Details** card, find the **Property
   Category (1 – 12)** select.
3. Pick the integer that matches the family's primary residence
   bracket. The threshold for "high property category" is **>= 9**
   (`PROPERTY_THRESHOLD = 8` in `recommendation-form.tsx`).
4. When category > 8, the amber banner **High Property Category**
   appears at the top of the tab: *"The selected property category
   exceeds the standard threshold. Please ensure this is accurately
   reflected in the recommendation summary and reason codes."*
5. Click **Save Recommendation** at the bottom of the page.

## Verification

- On the assessment tab, the red-flag chips remain ticked after a hard
  refresh.
- On the recommendation tab, the **Dishonesty Flag Active** /
  **Credit Risk Flag Active** red banners appear when the
  corresponding flag is on.
- The property advisory banner appears for category 9–12.

## Notes

- The 12 property categories are a foundation-level taxonomy; their
  £-thresholds (notably the £750K boundary) are documented in the
  Property Category report — see [[34-property-category-distribution]].
- Flags drive the **Red Flag** column in the export (see
  [[30-export-recommendation-list]]) and are listed in the PDF
  recommendation produced for the school.
