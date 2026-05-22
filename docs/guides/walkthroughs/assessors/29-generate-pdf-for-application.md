# 29 — Generate a PDF for one application

Backlink: [[README#Hand-off to the school]]

Download a single-application PDF recommendation. Used for hand-off to
the school's admissions team where they prefer a per-case document
over a row in the spreadsheet.

## Prerequisites

- The recommendation exists (i.e. **Save Recommendation** has been
  clicked at least once).
- Application is open on the **Recommendation** tab.

## Steps

1. At the top-right of the recommendation tab, click the **Download
   PDF** button (file-download icon, slate outline). The link points to
   `/api/pdf/recommendation/[applicationId]`.
2. The route streams a PDF generated with `@react-pdf/renderer`
   server-side. Browsers download it as
   `recommendation-<reference>.pdf` (default filename comes from the
   API's `Content-Disposition`).
3. The PDF contains:
   - Application reference, school, round, entry year.
   - The family synopsis.
   - Accommodation status, income category, property category.
   - Bursary award, yearly + monthly payable fees.
   - Red-flag indicators (if any).
   - Reason codes (number + label).
   - Recommendation summary narrative.

## Verification

- The downloaded file opens in any PDF reader.
- All figures match the recommendation tab's current display.

## Troubleshooting

- **404 from the API** — the recommendation has not been saved yet.
  Click **Save Recommendation** first.
- **403** — your session no longer has `ASSESSOR` / `ADMIN` /
  `VIEWER` rights, or the application has been GDPR-deleted.
- **Stale figures** — the PDF reads from the current DB row. If you
  edit the recommendation, save before downloading.

## Notes

- For bulk hand-off across the whole round, use the spreadsheet export
  instead — see [[30-export-recommendation-list]].
- The PDF is regenerated on every request; there is no caching layer.
