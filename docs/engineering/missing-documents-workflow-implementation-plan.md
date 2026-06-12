# Missing Documents Workflow — Implementation Plan

> Status: **Implemented on `feature/missing-documents-workflow`** — 626 tests green,
> `tsc` clean, `next build` clean. Awaiting PR review + merge to `staging`, then the
> end-to-end verification below on a deployed preview.
> Last updated: 2026-06-11

## Context

The Foundation needs a formal, in-portal way to handle documents that are missing or
invalid **after** an application is submitted. Today this is largely manual (applicant
emails files, assessor uploads on their side, regenerates the PDF).

Crucially, **most of the "Partial / Missing Document Request" scenario already exists**
and matches the narrative almost exactly — see [Already built](#already-built-do-not-rebuild).
This plan only fills the genuine gaps. Confirmed scope:

1. **Full Rejection flow** — NEW. Assessor clears all docs + asks applicant to start
   from scratch. **Restart model = void + new application via hard-delete + recreate**
   (the `@@unique([roundId, leadApplicantId, childName, childDob])` constraint makes
   keeping an archived copy alongside a new one impossible, so the rejected application
   is hard-deleted — Storage files first, then the row cascades sections/docs/assessment —
   and a fresh blank application is created for the same round, **reusing the old
   reference**). The append-only audit trail of the rejection survives.
   **Doc clearing = bulk clear all** documents (subsumed by the delete cascade).
2. **Assessor-set deadline** (default ~5 days) on the Request dialog, replacing the
   hard-coded 14-day window.
3. **Personal note in the email** — inject the assessor's custom message into the
   `MISSING_DOCS` email body (today it is captured + shown in-portal but never emailed).
4. **Prominent "Missing Documents" section** — a dedicated, colour-coded nav item +
   dashboard CTA, shown only while a request is outstanding.

**Out of scope:** an assessor "regenerate PDF" button — the submission PDF
(`/api/pdf/submission/[applicationId]`, `src/lib/pdf/submission-pdf.tsx`) already renders
documents **live**, so appended missing docs already appear in it "as if part of the
original form." No work needed there.

---

## Already built (do NOT rebuild)

| Capability | Location |
|---|---|
| "Request Missing Documents" dialog (slot picker + optional message) | `src/components/admin/missing-docs-dialog.tsx` |
| Pause action → `PAUSED` + persisted `paused_until` deadline + `MISSING_DOCS` email + audit | `src/app/(admin)/applications/[id]/actions.ts` → `pauseApplication` |
| Status service pause/resume primitives | `src/lib/applications/status.ts` (`pauseReviewForDocs`, `resumeReview`, `defaultPausedUntil`) |
| Branded `MISSING_DOCS` email template | migration `20260513220100_seed_email_templates` |
| Applicant dashboard paused CTA card (yellow) | `src/app/(portal)/page.tsx` (~lines 340-362) |
| Left-nav dot badge on "Documents" when paused | `src/components/portal/portal-nav.tsx` (`needsDocs`) |
| Dedicated `/respond` upload page (per-slot FileUpload, reads request incl. custom message) | `src/app/(portal)/respond/` + `src/lib/db/queries/missing-docs.ts` |
| Applicant response → resumes assessment + notifies assessor | `src/app/(portal)/actions.ts` → `submitMissingDocsResponse` |
| "Stays frozen" invariant (write-once `submittedAt`, form stays `SUBMITTED`) | `status.ts` (`assertSubmittedAtUnset`, trigger) + `src/lib/portal/missing-docs-invariant.ts` |
| Assessor-side manual upload into any slot | `src/components/admin/admin-upload.tsx` → `POST /api/admin/documents` |

---

## Implementation

### 1. Assessor-set deadline (small)

- [x] **`src/components/admin/missing-docs-dialog.tsx`**: add a deadline control above
  "Send Request" — an `<input type="date">` defaulting to **today + 5 days**,
  `min` = tomorrow. Pass the ISO value as a third arg.
- [x] **`pauseApplication`** (`src/app/(admin)/applications/[id]/actions.ts`): add optional
  `deadlineIso?: string`. Parse it (reject `NaN`, reject past dates); pass the resulting
  `Date` to `pauseReviewForDocs(tx, applicationId, user.id, parsedDeadline)`.
  `pauseReviewForDocs` / `pauseAssessmentRow` already accept `pausedUntil` and fall back
  to `defaultPausedUntil()` when omitted — **no status-service change required**, full
  back-compat. Keep `PAUSE_WINDOW_DAYS` as the server-side fallback.

### 2. Personal note in the MISSING_DOCS email (small)

- [x] **`pauseApplication`**: pass `custom_message` in the `sendEmail("MISSING_DOCS", …)`
  merge data (the variable already exists in scope as `customMessage`). Pass a friendly
  default when blank (e.g. empty string, see template note).
- [x] **New email-template migration** (per CLAUDE.md: never mutate an applied migration —
  author a follow-up). `UPDATE public.email_templates` for `type='MISSING_DOCS'`:
  add a `{{custom_message}}` paragraph to the body (placed after the missing-documents
  list, only meaningful when present) and add `"custom_message"` to `merge_fields`.
  Use `migrate diff --script` / hand-authored SQL; additive + idempotent style.
- [x] Keep **`prisma/seed-data/email-templates.ts`** in lockstep (the migration header
  mandates updating both locations).

### 3. Prominent "Missing Documents" section (small/medium)

- [x] **`src/components/portal/portal-nav.tsx`**: when `needsDocs` is true, render a
  dedicated **"Missing Documents"** item (e.g. `AlertCircle`/`Upload` icon, gold/accent
  colour-coded) linking to `/respond`, shown only while outstanding. Either insert it
  into `buildPortalNav` conditionally or render it as a highlighted entry above the list.
  Keep the existing accessible `role="status"` treatment. The current dot-on-Documents
  can be removed in favour of the explicit item (Decision: dedicated item).
- [x] **`src/app/(portal)/page.tsx`**: the paused CTA card already exists — keep/strengthen
  its colour-coding so dashboard + nav are consistent. No new data plumbing: `needsDocs`
  / paused state is already derived (`getPortalNavState` / dashboard's assessment status).

### 4. Full Rejection flow (largest)

**Assessor UI** — `src/components/admin/application-actions.tsx`:
- [x] When `status === "NOT_STARTED"` (review in progress) — and optionally `SUBMITTED` —
  add a **"Reject & Restart"** destructive button next to "Request Missing Documents".
- [x] New confirmation dialog `src/components/admin/reject-restart-dialog.tsx` (model on
  `missing-docs-dialog.tsx`): a note textarea explaining what was wrong, plus an explicit
  warning: *"This permanently clears all uploaded documents and asks the applicant to
  submit a new application. The current submission will be archived and can no longer be
  edited."* Calls a new server action.

**Server action** — new `rejectAndRestartApplication(applicationId, customMessage)` in
`src/app/(admin)/applications/[id]/actions.ts`:
- [x] `requireRole([ADMIN, ASSESSOR])`.
- [x] Fetch the old application with `documents { id, storagePath }`, `reference`,
  `roundId`, `leadApplicant`, `school`, `childName`, `entryYear`, `entryYearGroup`,
  `contactId`, `applicationType`, `isReassessment`, `bursaryAccountId`, derived review phase.
- [x] Guard: allowed only before a final outcome (reject `COMPLETED`/decided/already
  archived) — reuse `reviewPhaseOf` / `deriveReviewPhase`.
- [x] **Capture Storage paths** from the old app's documents, then **hard-delete +
  recreate** via a new helper `restartApplicationFromRejection(tx, oldApp)` in
  `src/lib/applications/create-from-invitation.ts`:
  1. `tx.application.delete({ where: { id } })` — cascades `ApplicationSection`,
     `ApplicationContributor`, `Document`, `Assessment` (+children), `Invitation`. This
     subsumes "bulk clear all documents" at the DB level.
  2. `tx.application.create(...)` reusing the **old `reference`** (freed by the delete —
     avoids a collision in the count-based `generateApplicationReference`), copying
     `roundId / leadApplicantId / school / childName / childDob / entryYear /
     entryYearGroup / contactId / isReassessment / applicationType / bursaryAccountId /
     custodyArrangement`, with `applicationCreateData(applicationType)` (formStatus
     `CREATED`), then `ensurePrimaryContributor`. The new app starts blank — "from
     scratch" — even for ROLLING_OVER (no re-prepopulation in v1).
  3. After the tx commits, `deleteDocument(storagePath)` for each captured path
     (non-fatal Storage cleanup; the DB rows are already gone via cascade).
  Returns the new id. `getCurrentApplicationForUser` orders by `updatedAt desc`, so the
  applicant lands on the fresh blank draft.
- [x] **Email** the applicant with the new template: personal note + reference + CTA link
  to the portal (`getAppUrl()` → `/` or `/apply/child-details`). Non-blocking.
- [x] **Audit**: write `APPLICATION_REJECTED_RESTART` (old app entityId) with metadata
  `{ reference, customMessage, clearedDocumentCount, newApplicationId }`.
- [x] `revalidateApplicationPaths` + `/queue`.

**New audit action** — `src/lib/audit/actions.ts`:
- [x] Add `APPLICATION_REJECTED_RESTART` to `AUDIT_ACTIONS` (string constant — no DB migration).

**New email template** — `prisma/schema.prisma` + migrations + seed data:
- [x] Add enum value `APPLICATION_RESTART_REQUIRED` to `EmailTemplateType` (`prisma migrate
  dev`, additive/safe).
- [x] Seed the row in a template migration (branded; merge fields:
  `applicant_name, child_name, reference, custom_message, restart_link`).
- [x] Add it to `prisma/seed-data/email-templates.ts`; extend the `sendEmail`
  template-type union if it is typed.

**Reassessment note (verify during build):** copying `bursaryAccountId` + `isReassessment`
should let ROLLING_OVER restarts work, but reassessment apps are normally created via
`createReassessmentApplicationFromInvitation` with prepopulation. Confirm whether a
rejected reassessment should re-prepopulate from the bursary account; if uncertain, gate
"Reject & Restart" to `applicationType === "NEW"` in v1 and flag ROLLING_OVER as a follow-up.

---

## Critical files

- `src/app/(admin)/applications/[id]/actions.ts` — `pauseApplication` (deadline + note),
  new `rejectAndRestartApplication`.
- `src/components/admin/missing-docs-dialog.tsx` — deadline input.
- `src/components/admin/application-actions.tsx` — Reject & Restart button.
- `src/components/admin/reject-restart-dialog.tsx` — NEW confirmation dialog.
- `src/lib/applications/create-from-invitation.ts` — NEW `restartApplicationFromRejection`
  helper (reuses `generateApplicationReference`, `applicationCreateData`,
  `ensurePrimaryContributor`).
- `src/components/portal/portal-nav.tsx` — dedicated Missing Documents nav item.
- `src/app/(portal)/page.tsx` — dashboard CTA colour-coding.
- `prisma/schema.prisma` + new migrations — `EmailTemplateType` enum value + template
  seed/UPDATE.
- `prisma/seed-data/email-templates.ts` — keep templates in lockstep.
- `src/lib/audit/actions.ts` — new audit action.
- `src/lib/email/send.ts` — extend template-type union if needed.

## Migrations (additive, per CLAUDE.md — new files, never edit applied ones)

- [x] `prisma migrate dev` → add `APPLICATION_RESTART_REQUIRED` to `EmailTemplateType`.
- [x] SQL template migration: `UPDATE` `MISSING_DOCS` body+merge_fields (add
  `{{custom_message}}`) and `INSERT … WHERE NOT EXISTS` the new restart template —
  follow the existing `*_seed_*_template` pattern (idempotent). Both auto-apply to
  nonprod via `db-push.yml` on merge to staging.

## Tests

- [x] Status test: `pauseReviewForDocs` honours a caller-supplied `pausedUntil`.
- [x] `pauseApplication`: deadline parsing / rejection of past dates; `custom_message`
  reaches `sendEmail`.
- [x] `rejectAndRestartApplication`: docs deleted, old app archived
  (`submittedAt`/`formStatus` untouched), new app created (fresh reference, PRIMARY
  contributor, `CREATED`), audit rows written, email attempted.
- [x] `restartApplicationFromRejection` helper: field carry-over + reference uniqueness.
- [x] Email merge: `MISSING_DOCS` with and without `custom_message`.

## Verification (end-to-end on a deployed preview / nonprod)

1. Branch `feature/missing-documents-workflow` off `staging`; migrations apply to nonprod
   via CI on PR merge (or locally against nonprod with care).
2. As assessor on a submitted application: Begin Review → Request Missing Documents →
   set a 4-day deadline + a personal note → Send. Confirm `paused_until` ≈ +4 days and
   the `MISSING_DOCS` email body contains the note (trigger from a deployed env — see
   "local Resend key invalid" gotcha).
3. As the applicant: confirm the dashboard CTA + the dedicated "Missing Documents" nav
   item appear (and vanish after responding). Upload via `/respond`, send; confirm the
   assessor `MISSING_DOCS_RESPONDED` notification + assessment resumes.
4. Download the submission PDF and confirm the re-uploaded docs appear.
5. Full Rejection: on another submitted application click Reject & Restart with a note.
   Confirm all docs gone (DB + Storage), old app archived/immutable + in History, a fresh
   blank draft is the applicant's current application, and the restart email arrived.
6. `npx next build` clean; run the test suite.

## Branching / workflow (CLAUDE.md)

Branch off `staging` as `feature/missing-documents-workflow`; conventional commits; PR
targets `staging`; user merges. Migrations ship in the same PR as the code that needs
them. Consider splitting into stacked PRs (1: deadline + note + nav enhancements;
2: Full Rejection) since items 1–3 are low-risk and item 4 is the large piece.
