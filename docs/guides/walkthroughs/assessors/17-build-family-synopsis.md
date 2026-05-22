# 17 — Build the family synopsis

Backlink: [[README#Tab 3 — Writing the recommendation]]

The family synopsis is a short narrative the school's admissions team
sees on the recommendation. Suggested content can be derived from the
assessment, but the field is free-text.

## Prerequisites

- Assessment status is `COMPLETED` (see
  [[16-save-the-assessment]]).
- Application open on the **Recommendation** tab.

## Steps

1. Switch to the **Recommendation** tab. The top of the page renders
   any red-flag banners (dishonesty / credit risk) and the
   **Assessment Fee Summary** card with *Bursary Award*, *Yearly
   Payable Fees*, *Monthly Payable Fees* (read-only).
2. In the **Recommendation Details** card, find **Family Synopsis**
   (textarea, 4 rows, resizeable). Placeholder reads *"Brief summary
   of the family's circumstances…"*.
3. Compose 1–3 sentences capturing:
   - Family structure (single parent / couple, number of children).
   - Employment / income context (e.g. "Parent 1 PAYE teacher, Parent 2
     self-employed director of small consultancy.").
   - Any salient circumstances feeding the recommendation (recent
     bereavement, sibling at school, etc.).
4. Tab out / blur. The text persists in form state — you save the whole
   recommendation in one click at the bottom of the page
   ([[19-record-bursary-award-and-payable-fees]]).

## Verification

- After clicking **Save Recommendation**, refreshing the tab restores
  the text exactly.
- The synopsis appears verbatim in the PDF recommendation
  ([[29-generate-pdf-for-application]]) and in the **Family
  Synopsis** column of the export ([[30-export-recommendation-list]]).

## Notes

- The README mentions *"auto-populated suggestions from assessment
  data"*. Today's form does not pre-fill the textarea — type it
  manually using the assessment as your reference. (Pre-fill is
  spec'd future work.)
- Keep the synopsis factual and neutral; this is a public-facing field
  shared with the school.
