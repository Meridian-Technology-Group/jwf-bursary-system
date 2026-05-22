# 05 — Read the submitted application

Backlink: [[README#Tab 1 — Reviewing the submission]]

Read-only review of every section the applicant filled in. This is your
starting point before opening the assessment workspace.

## Prerequisites

- The application is open (see [[02-open-an-application]]).
- Status is `SUBMITTED` or beyond — sections only render once
  submitted.

## Steps

1. Ensure the **Applicant Data** tab is active (default landing tab).
2. The top of the tab shows the **Documents** card and the **Upload
   Document (Assessor)** card — covered in
   [[06-verify-uploaded-documents]] and
   [[07-upload-document-on-behalf-of-applicant]].
3. Below those, each application section is a `Card` with a coloured
   complete/incomplete chip:
   - **Child Details**
   - **Family Identity**
   - **Parent Details**
   - **Dependent Children**
   - **Dependent Elderly**
   - **Other Information**
   - **Parents' Income**
   - **Assets & Liabilities**
   - **Additional Information**
   - **Declaration**
4. Each field renders as a `dt`/`dd` row. Booleans display as
   coloured **Yes** / **No**; numbers that look like currency render
   as £-formatted monospace; unset values appear as *"Not provided"*
   in muted italics; document references show as *"Document ref"*.
5. Nested objects render as an indented `DataBlock`; arrays render as
   ordered lists.
6. If the family is on a multi-child bursary, the **Sibling Links**
   section at the bottom lists linked accounts and offers the linker
   card — see [[23-link-siblings]].

## Verification

- Every applicable section shows a green **Complete** chip; any **Incomplete**
  chip is your cue to request missing detail (see
  [[08-request-missing-documents]]) or page back to the family.
- If the application has no submitted data the tab shows the empty
  state *"No application sections have been submitted yet."*

## Notes

- This tab is **strictly read-only** — there is no "edit" button. To
  correct a value the applicant must resubmit, or you record the
  override in the assessment workspace (Tab 2) where evidence-based
  figures take precedence over declared figures.
- Use the document cards to flip into PDFs while reading the
  declared figures — do not commit to any number here; the
  authoritative entry happens in Tab 2.
