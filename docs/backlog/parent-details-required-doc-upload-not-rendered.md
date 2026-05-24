---
title: Parent-details required document uploads are validated but never rendered (applicant hard-block)
status: open
severity: high
area: applicant-form, validation, uploads
opened: 2026-05-24
opened_by: Wave 1 Track D (docs reconciliation) — confirmed against code
related:
  - src/lib/schemas/parent-details.ts (superRefine, lines ~119 and ~127)
  - src/components/portal/sections/parent-details-form.tsx (placeholders ~lines 451, 460, 477, 501)
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

## Proposed approach

The root cause is a chicken-and-egg: uploads were deferred until an
application row exists (so documents can be associated), but the schema treats
the document id as mandatory at form-submit time. Pick one:

1. **Render a working upload control** that creates/links the document before
   the application row is finalized (e.g. upload to the documents bucket and
   stash the returned id on the form), so the required id can actually be
   supplied. Highest fidelity; most work.
2. **Decouple validation from the missing control**: make the document id
   *not* required at this step and collect the evidence in the existing
   post-creation missing-documents flow instead (the app already has a
   request/respond-to-missing-docs path). Smaller change; keeps the funnel
   unblocked.
3. **Minimum unblock**: drop the `superRefine` hard-requirement for the two
   document ids (`leftSelfEmploymentDocumentId`, `scholarshipDocumentId`) until
   a real control exists, so answering "Yes" no longer blocks submission.

Recommend (2) or (3) as the immediate unblock, with (1) as the proper fix.
Audit the other stubbed slots above for the same schema-vs-UI mismatch while
in here.

## Out of scope

- Building out every deferred upload sub-feature (elderly-dependent modals,
  other-properties table, etc.) — this item is specifically the
  **validation-blocks-submission** conflict; the broader "finish the stubbed
  upload UIs" work can be its own feature.
