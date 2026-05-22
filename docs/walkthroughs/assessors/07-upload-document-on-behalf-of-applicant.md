# 07 — Upload a document on behalf of the applicant

Backlink: [[README#Tab 1 — Reviewing the submission]]

For documents received outside the portal (email, post). The uploaded
file is attributed to you, not to the applicant.

## Prerequisites

- The application is open on the **Applicant Data** tab.
- You have the file locally — PDF, JPEG, or PNG, max 20 MB.
- You know which slot it belongs to.

## Steps

1. Scroll to the **Upload Document (Assessor)** card, immediately
   below the Documents checklist. Strapline: *"Upload documents on
   behalf of the applicant. These will appear in the document checklist
   above."*
2. **Document slot** — select from the dropdown. All canonical slot
   names from `ALL_DOCUMENT_SLOTS` are listed in humanised form.
3. **File** — click the file picker (*"PDF, JPEG, or PNG — max 20 MB"*).
   Client-side validation rejects:
   - *"Only PDF, JPEG, and PNG files are accepted."*
   - *"File is too large. Maximum size is 20 MB."*
4. The selected file preview shows filename and size in MB.
5. Click **Upload Document**. The request is `POST /api/admin/documents`
   with `applicationId`, `slot`, and the file.
6. On success a green banner reads *"`<Slot label>` uploaded
   successfully."*; the page refreshes and the new row appears in the
   Documents checklist.

## Verification

- The document appears in the **Documents (n)** card with the slot
  label and filename.
- The audit log records `DOCUMENT_UPLOADED` attributed to you (not the
  lead applicant).
- The new row is unverified by default — verify it via
  [[06-verify-uploaded-documents]].

## Notes

- Assessor-uploaded documents satisfy the same slot completeness checks
  as applicant-uploaded ones — they are not visually distinguished in
  the checklist UI, but the audit metadata records the uploader role.
- For a re-upload (overwrite), upload the new file to the same slot —
  the previous file remains in Storage; both rows show in the
  checklist. Mark the obsolete one unverified.
