---
title: Parent-details required document uploads are validated but never rendered (applicant hard-block)
status: done
severity: high
area: applicant-form, validation, uploads
opened: 2026-05-24
opened_by: Wave 1 Track D (docs reconciliation) — confirmed against code
related:
  - src/lib/schemas/parent-details.ts (superRefine, lines ~119 and ~127)
  - src/components/portal/sections/parent-details-form.tsx (placeholders ~lines 451, 460, 477, 501)
  - src/components/portal/file-upload.tsx (reusable uploader, also used by /respond)
  - src/lib/portal/section-gaps* (error-severity gaps gate submitApplication)
  - src/app/(portal)/apply/actions.ts (submitApplication — the pre-submission gate, ~line 336)
  - docs/archive/specs/applicant-form.md ("Implementation gaps" section, added in PR #82)
  - PR #82 (spec reconciliation that surfaced this)
---

## Context

Found during the Wave 1 applicant-form spec reconciliation (#19, PR #82)
and confirmed against the code. The parent-details Zod schema requires a
document id when certain Yes/No toggles are set to "Yes":

- `parent-details.ts:119` — `if (data.leftSelfEmployment && !data.leftSelfEmploymentDocumentId)` raises a validation issue at `leftSelfEmploymentDocumentId`.
- `parent-details.ts:127` — same for `receivesScholarship && !data.scholarshipDocumentId`.

But the UI (`parent-details-form.tsx`) renders **no upload control** for these
— only a static placeholder: *"Document upload available once application is
created."* (lines ~451, 460, 477, 501). There is no way for the applicant to
populate the required document id, so the `superRefine` rule can never be
satisfied through the form.

## Why it matters

**High — it can hard-block a legitimate applicant from completing the
parent-details section with no workaround.** An applicant who truthfully
answers "Yes" to *"left self-employment"* or *"receives a scholarship"* will
fail validation on a field that has no input, and cannot proceed. This is a
live, invite-only PII application funnel, so a stuck applicant is a real
conversion/eligibility loss, not a cosmetic issue. It is conditional (only
those toggles, set to Yes), which is why it has not blocked everyone — but for
the affected subset it is a dead end.

Track D also catalogued several **other stubbed document slots / sub-features**
behind the same "available once application is created" placeholder, which
should be reviewed together since they share the chicken-and-egg root cause:
- director accounts / balance sheet uploads,
- court-order evidence,
- the six Section 9 circumstance uploads,
- dependent-elderly detail modals,
- the other-properties list table.

(These are documented as "NOT YET BUILT (stub)" in
`docs/archive/specs/applicant-form.md`.)

## Decided approach (2026-05-24)

Investigation corrected two assumptions:
- **No chicken-and-egg.** The application row already exists during form-fill
  (created at registration, `PRE_SUBMISSION`), and `Document.slot` is a
  free-form string column — so no migration is needed and uploads can be
  associated immediately.
- **The "missing-docs flow" is the wrong tool.** That flow is
  *post-submission* and *assessor-initiated* (assessor pauses a submitted
  application → `MISSING_DOCS` email → applicant `/respond`); it cannot
  "collect before submit".

The right pre-submission gate already exists: `submitApplication`
(`apply/actions.ts`) blocks on **error-severity "gaps"** from the
`section-gaps` system — whose own comment says it "catches missing required
documents". So we deliver "upload if you have it, move on if not, but resolve
before final submit" by combining three changes:

1. **Render a real uploader** for the affected slots by reusing the existing
   `FileUpload` component (the same one `/respond` uses). On upload it creates
   a `Document` and returns its id, which the form stores in the section data
   (`leftSelfEmploymentDocumentId` / `scholarshipDocumentId`). New slot strings
   (e.g. `LEFT_SELF_EMPLOYMENT_PARENT_x`, `SCHOLARSHIP_PARENT_x`) — no enum
   migration (slot is a String).
2. **Drop the hard `superRefine` requirement** in `parent-details.ts` for those
   two ids, so answering "Yes" no longer blocks completing/advancing the
   section.
3. **Represent the still-missing doc as an error-severity gap** in
   `section-gaps`, so it surfaces as an outstanding item and **blocks the final
   Submit** until provided — caught by the gate that already exists. No
   assessor involvement, no post-submission chase.

Net behaviour: upload-if-you-have-it → proceed without it → cannot submit the
whole application until provided.

The two **director** doc slots (`certifiedAccountsDocumentId`,
`balanceSheetDocumentId`) get the real uploader too (step 1) for parity, but
are NOT made submit-blocking (the schema doesn't require them today; leave that
policy unchanged).

## Out of scope

- Building out every deferred upload sub-feature (elderly-dependent modals,
  other-properties table, etc.) — this item is specifically the
  **validation-blocks-submission** conflict; the broader "finish the stubbed
  upload UIs" work can be its own feature.
