# 38 — Edit an application on the applicant's behalf

Backlink: [[README#Tab 1 — Reviewing the submission]]

Amend the applicant's own form data — or type up a postal application
end-to-end — from the admin console (CR-001). Every save is attributed
to you, badged on the Applicant Data tab, and audit-logged.

## Prerequisites

- Signed in as `ADMIN`, or as the `ASSESSOR` **assigned** to the
  application. A `VIEWER`, or an unassigned assessor, never sees the
  button and is turned away from the edit URLs.
- The review is still live — phase `PRE_SUBMISSION`, `SUBMITTED`,
  `NOT_STARTED`, or `PAUSED`. Once the assessment is `COMPLETED` or an
  outcome is set, edit mode is locked.
- For the document step: a file to upload (PDF / JPEG / PNG, max 20 MB).

## Steps — correct a submitted application

1. Open a **Submitted** application from the queue, on the **Applicant
   Data** tab.
2. Click **Edit on behalf** (top of the tab, pencil icon). You land on
   the first section at `/applications/[id]/edit/<section>`.
3. Orient yourself in the edit shell:
   - The amber banner **Editing on behalf of the applicant** —
     *"Every change you save is attributed to you and recorded in the
     application history. The applicant keeps read-only access."* On a
     `PAUSED` application it adds *"Assessment paused — documents
     requested by `<date>`. Saving here does not resume the
     assessment."*
   - A **pill navigation** across the ten sections (a re-assessment
     hides **Family Identification**, exactly like the portal wizard).
   - The sticky footer with **Back** and **Save and Continue**
     (**Save and Finish** on the Declaration).
4. Amend a field — e.g. correct a figure in **Parents' Income** — and
   click **Save and Continue**. Validation is identical to the portal:
   an invalid value shows the same per-field error the applicant would
   see, and the save is rejected.
5. Pick a second section from the pill nav — e.g. **Parents' Assets &
   Liabilities** — amend a field there, and save again.
6. In a section with upload slots, upload a document. The file goes
   through the staff document endpoints, so this works even though the
   application is `SUBMITTED`.
7. Click **Finish editing** in the banner. You return to the
   application detail page, and the applicant is emailed a single
   summary (subject *"Your bursary application has been updated —
   `<child name>`"*) listing the edited sections and the date.

## Verification

- On the **Applicant Data** tab, each field you changed carries a
  purple **Entered by assessor** pill; hovering it shows *"Entered by
  `<your name>` on `<date>`"*. Each amended section's card header shows
  an *"N fields entered by assessor"* chip.
- The status badge still reads **Submitted** — a staff edit never
  reverts a submitted form to draft.
- The **History** tab shows a **Section saved by assessor** entry per
  save (the metadata records the changed-field list), a **Document
  uploaded by assessor** entry for the upload, and one **Editing on
  behalf finished** entry recording whether the email was sent.
- The applicant's portal shows **no** assessor badges — applicant-side
  transparency is the email.

## Second scenario — type up a postal application

For a paper or telephone application, staff enter the whole form and
submit it on the applicant's behalf.

1. Start from an application in `PRE_SUBMISSION` (the family has been
   invited and the account registered — see
   [[03-invite-applicant-new-bursary]]).
2. Click **Edit on behalf** and work through **all** sections via the
   pill nav, saving each with **Save and Continue**. On the
   **Declaration**, tick each parent's confirmation and type the
   *"Full name of Parent / Guardian 1"* (and 2) exactly as signed on
   the paper form.
3. Once every section is complete, a **Submit on behalf of applicant**
   button appears in the banner. Click it.
4. The dialog **Submit on behalf of applicant?** explains: *"This will
   submit the application exactly as if the applicant had submitted it
   — the form becomes read-only to the applicant and assessment can
   begin. The applicant will receive the standard confirmation
   email."* Click **Confirm Submit**.
5. Verify: the application is now **Submitted**; the applicant received
   the standard confirmation email; the **History** tab shows
   **Submitted by assessor on behalf of applicant**.

## Notes

- **Finish explicitly.** Navigating away without clicking **Finish
  editing** sends no notification email — the audit trail still records
  every save, but the applicant is not told. Always end an editing pass
  with **Finish editing**. (A pass that changed nothing is a silent
  no-op: no email, no audit entry.)
- The summary email can be switched off — the agreed "silent" option:
  Settings → **Email Templates** → *Application edited on behalf* →
  **Send this email** toggle. **Finish editing** then records the email
  as skipped in the audit metadata.
- The portal submission deadline is **not** enforced on the staff
  submit path — deliberate, so a paper application that arrived in time
  can be typed up after the portal deadline.
- Scope: you edit the **lead applicant's** sections only. A second
  parent's own copies of Parent Details / Parents' Income / Assets &
  Liabilities are not editable on-behalf — they correct their own data
  through their `/contribute` portal.
- If the applicant re-edits a staff-entered field before submission,
  that field's **Entered by assessor** pill clears — provenance tracks
  who entered the *current* value.
- Editing a `PAUSED` application does **not** resume it — verify the
  new documents and click **Resume Review** as usual
  ([[08-request-missing-documents]]).
