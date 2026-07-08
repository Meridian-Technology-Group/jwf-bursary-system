# Parent portal form corrections

Summary of the changes made to the applicant-facing form in response to the
latest review. Grouped by the section each change affects.

## Section 2: Family Identification

- **Title aligned.** The step header, browser tab and left navigation now all
  read "Family Identification". The header previously read "Details of Child -
  Identification", which did not match the navigation.
- **Two people always required.** The section now always lists two locked
  entries: the child named on the application and the parent or guardian named
  on the application (taken from the applicant's account). Each requires at
  least one identity document, and neither can be removed. The section is only
  marked complete once both have a document uploaded.
- **Child or adult classification for additional members only.** Applicants may
  still add further family members. The "child or adult" choice now appears only
  on those additional members, not on the two required entries.

### Word document uploads (not actioned, by design)

The review asked whether Word (.doc/.docx) files could be accepted for identity
documents. This has deliberately not been enabled, for two reasons:

1. Word files cannot be reliably validated. A .docx is a renamed ZIP archive, so
   the safeguard that confirms an upload really is the file type it claims to be
   cannot distinguish a Word document from any other archive. Accepting them
   weakens protection against disguised or malicious files.
2. Word files cannot be previewed in the assessor tools. Assessors would have to
   download and open each one separately, breaking the in-browser review used
   for PDF and image evidence.

Instead, the upload error now guides the applicant to save or print the document
as a PDF, or to photograph it (JPG or PNG), both of which are already supported
and can be previewed. Accepted types remain PDF, JPG and PNG.

## Section 3: Parent / Guardian Details

- **Declaration wording corrected.** This step only captures employment status,
  so the income-based declaration has been removed. It is replaced by a single
  confirmation: "I can confirm that the information entered above is accurate."
- **Empty panel removed.** The grey panel below "Relationship status" now only
  appears when there is a follow-up question to show, and it sizes to its
  content. Previously it rendered as an empty box, or with excess blank space,
  depending on the option selected.

## Other Information Required

- **Maintenance received now asks the same follow-up.** Selecting "My ex-partner
  pays me" now shows the "Are you divorced?" question and the decree upload,
  matching the behaviour already present for "I pay the other parent". The
  supporting-document requirement applies to both directions.

## Section 7: Parents' Income

- **PAYE evidence.** The P60 box now reads "Upload your P60 for the period
  above" and the payslip box reads "Upload your payslip for the month above".
  The "or the other document, at least one is required" wording has been
  removed, and both documents are now required when employed income is declared.
- **Self-employed evidence.** A note has been added below the SA302 box
  explaining that where the financial year runs between April and October, the
  applicant should report self-employed income one year in arrears and upload
  the previous year's SA302. The tax year shown is generated automatically.
- **Universal Credit evidence.** The second box now reads "3 monthly UC detailed
  payment calculations (not just the front page)". The confusing helper line
  beneath the two boxes has been removed.
- **Other benefits.** The "not required" label has been removed. Each benefit
  row now shows "Please upload your supporting document below" only when an
  amount above zero has been entered, and the free-upload area at the foot of
  the benefits list remains available.

## Parents' Assets & Liabilities

- **Second parent block corrected.** For a sole-parent application the form no
  longer shows a "Parent / Guardian 2" bank-statement block. This was a defect:
  the sole-parent flag was not being read on this step, so the block always
  appeared.

## Review page

- **Section status now consistent.** The section cards on the Review page could
  show "Complete" while the same sections were flagged as needing attention in
  the left navigation and the validation summary. The cards, and the "sections
  fully complete" count, now use the same rule as the rest of the portal: a
  section counts as complete only when it is saved and has no outstanding
  mandatory items.

## Outstanding decision

- The decree document on the maintenance question is labelled "decree absolute"
  in the system, whereas the review referred to a "decree nisi". The label has
  been left unchanged pending confirmation of which document is intended.
