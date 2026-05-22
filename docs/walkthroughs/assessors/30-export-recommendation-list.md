# 30 — Export recommendation list (CSV / XLSX)

Backlink: [[README#Hand-off to the school]]

Bulk export of every application with a completed recommendation for a
given round, optionally filtered by school. One row per application.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- At least one round with recommendations.

## Steps

1. Sidebar → **Exports**. You land at `/exports` under the heading
   **Export Recommendations** with strapline *"Download a spreadsheet
   of recommendation data for a selected assessment round. Only
   applications with a completed recommendation are included."*
2. In the **Download Options** card, configure:
   - **Assessment Round** — required. Defaults to the most recently
     opened round. Each option shows `<academicYear> (STATUS)`.
   - **School Filter** — *All Schools* (default), *Trinity*, or
     *Whitgift*.
   - **File Format** — *Excel (XLSX)* (default) or *CSV*.
3. Click the **Download** button (the **ExportButton** at the bottom).
   It calls `GET /api/exports/recommendations?roundId=…&school=…&format=…`.
4. The browser saves the file. Default filename:
   `recommendations-<academicYear>.<format>`.

## Columns

The export carries one row per qualifying application:
- Application reference, school, round, entry year.
- Family synopsis, accommodation status, income category, property
  category.
- Bursary award (£), yearly payable fees (£), monthly payable fees (£).
- Red-flag columns — dishonesty, credit risk (Y / N).
- Reason codes (comma-separated `code. label`).
- Outcome (Qualifies / Does Not Qualify / Pending).

## Verification

- Open the XLSX in Excel / Numbers / Google Sheets; column widths are
  pre-set via ExcelJS.
- Row count matches the number of completed-recommendation
  applications for the chosen round / school filter.

## Notes

- Applications without a saved recommendation are excluded — they
  contribute no row.
- For GDPR-sensitive distribution, the export does **not** include the
  applicant's full name or email. It does include the family
  synopsis, which may contain identifying detail; redact before
  emailing externally if your team's policy requires it.
- For a single application, generate the PDF instead — see
  [[29-generate-pdf-for-application]].
