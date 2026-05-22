# 08 — Request missing documents

Backlink: [[README#Tab 1 — Reviewing the submission]]

Pause the assessment, list the outstanding slots, and email the
applicant a structured "please send these" request.

## Prerequisites

- Application status is `NOT_STARTED` (i.e. you've clicked **Begin
  Review** at least once). The button does not appear for `SUBMITTED`
  or terminal statuses.
- The application is open and you can see the **Actions** bar.

## Steps

1. In the actions bar, click **Request Missing Documents**.
2. The dialog **Request Missing Documents** opens with strapline
   *"Select the documents that are outstanding. The applicant will be
   notified by email and the application will be paused until the
   documents are received."*
3. The **Document slots** list is pre-populated:
   - Slots without a verified document are pre-checked.
   - Each row shows a status pill — green **Verified** or amber
     **Uploaded** (uploaded but not verified).
   - Use the checkboxes to fine-tune the selection. The counter below
     the list reads *"N slots selected"*.
4. **Additional message** *(optional)* — free-text appended to the email
   body, e.g. *"Please ensure the P60 is for the 2024/25 tax year."*
5. Click **Send Request**.
   - Validation: *"Please select at least one missing document."* if
     zero slots are ticked.
6. On success, the dialog flips to a green confirmation: *"Request sent
   successfully. The applicant has been emailed and the application is
   now paused."* It auto-closes after 1.5s.

## What happens server-side

- The application status transitions `NOT_STARTED` → `PAUSED`.
- The `MISSING_DOCS` email template is rendered with the bulleted slot
  list and optional additional message, then sent via Resend.
- An audit-log entry records the action and the slot list.

## Verification

- The actions bar now shows the **Resume Review** button (status =
  `PAUSED`).
- The status badge at the top of the application reads **Paused —
  awaiting documents**.
- The applicant receives the email with the bulleted slot list.

## Notes

- When the applicant re-uploads, the assessment does **not** resume
  automatically. You must come back, verify the new docs, and click
  **Resume Review** to return to `NOT_STARTED`.
- The dialog can be triggered repeatedly while paused — useful if a
  second round of documents is needed.
