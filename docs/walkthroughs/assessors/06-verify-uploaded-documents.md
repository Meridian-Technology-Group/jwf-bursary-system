# 06 — Verify uploaded documents

Backlink: [[README#Tab 1 — Reviewing the submission]]

Open each uploaded document inline, confirm it matches the slot it was
filed under, then toggle its verification status.

## Prerequisites

- The application is open on the **Applicant Data** tab.
- At least one document has been uploaded — the **Documents (n)** card
  shows the count.

## Steps

1. Locate the **Documents (n)** card near the top of the
   Applicant Data tab.
2. For each row:
   - The leading icon shows verification state (green tick = verified,
     grey circle = unverified).
   - The bold label is the **slot name** (e.g. `PARENT_1_P60`,
     `BANK_STATEMENT_3M`); the secondary line is the uploaded
     **filename**.
   - Click **View** (external-link icon) to fetch a presigned URL and
     open the file in the inline document viewer dialog. The dialog
     supports PDF / JPEG / PNG.
3. Read the file. Confirm two things:
   - The content actually belongs to the slot label (Parent 1's P60 is
     Parent 1's P60, not Parent 2's payslip).
   - The document is legible and complete (no truncation, no missing
     pages).
4. Once confirmed, tick the **Checkbox** in that row. The verify call
   hits `POST /api/documents/[id]/verify`; the icon flips green and an
   audit entry is written.
5. To revoke a verification, click the checkbox again.

## Verification

- Each verified document shows a green check icon and a green-bordered
  checkbox.
- The audit log records each verification toggle with action
  `DOCUMENT_VERIFIED` / `DOCUMENT_UNVERIFIED`.

## Notes

- Document slot names follow the upload schema — see
  `src/lib/documents/slots.ts` for the full canonical list.
- The viewer streams the file via a short-lived presigned URL from
  Supabase Storage; the URL is not stored client-side beyond the open
  dialog.
- If a slot has the wrong file (e.g. Parent 1's P60 was uploaded under
  Parent 2), do **not** verify it. Use
  [[08-request-missing-documents]] to ask for a re-upload, or upload
  the correct file yourself via
  [[07-upload-document-on-behalf-of-applicant]].
