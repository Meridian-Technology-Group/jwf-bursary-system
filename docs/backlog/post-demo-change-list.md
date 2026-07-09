# Post-demo change list — outstanding & partial work

Derived from the client meeting notes/transcript. This document covers **only**
the changes that are **not started** or **partially done**. Fully-shipped items
(first/last name split, email content editable via Settings, remove legacy "does
not qualify" labels, new/rollover list split, assessment-tab-stuck bug fix) are
omitted.

Two uncommitted worktrees hold the partial work at time of writing:

- `feature/admin-applications` — Applications list rework (tabs, name/email
  columns, per-row action menu).
- `feature/edit-assessment` — Assessment-tab gating bug fix.

Status legend: **Partial** = some of the ask exists but diverges or is
incomplete · **Not started** = no code yet.

---

## Partial

### 1. Status & deadline columns on the Applications list
**Status:** Partial — divergent from the written ask.

**Asked for:** Restore the status column to the agreed flow-diagram values and add
a **status** column *and* a **deadline (submission-by)** column to the list view.

**Current state:** The `feature/admin-applications` worktree **removed** the
status column and the `StatusFilter` popover entirely (along with the legacy
`DOES_NOT_QUALIFY` labels). Status now only appears on the application detail
page. No deadline column was added.

**Decided:** status **returns to the list**.

**To do:**
- Restore the status column, rendered from the derived review-phase projection
  (`deriveReviewPhase` / `matchesReviewPhase`), **not** the dropped fused
  `applications.status` enum, using the agreed flow-diagram vocabulary.
- Add a **deadline** column showing the per-application submission-by date
  (falls back to the round-level default — see item 12).
- Consider re-adding a status filter keyed off the same derived phase values.

---

### 2. Single "Closed" state, with purge driven by the close reason
**Status:** Partial.

**Asked for:** A **single** "Closed" state — not two separate close states.
Whether closing an application purges PII is decided by the **close reason**
selected from the dropdown: each configurable reason carries a "purge on close"
toggle set in admin (see item 4). Closing with a reason flagged to purge runs the
purge routine (item 10); closing with a non-purge reason retains all data under
the retention policy. This keeps the lifecycle clean — one close, reason-driven
behaviour.

**Current state:** The per-row action menu offers *Decline* (records the
`DOES_NOT_QUALIFY` outcome, retains data) and *Withdraw account* (closes the
rolling `BursaryAccount`). There is no unified "Closed" state and no
reason-driven purge.

**To do:**
- Model a single "Closed" terminal state (bursary-account lifecycle and/or
  application terminal state).
- On close, require a close reason (item 4). If that reason's "purge on close"
  toggle is on, trigger the purge routine (item 10); otherwise retain all data.
- Reconcile with the existing `withdrawBursaryAccount` / *Decline* actions so we
  don't end up with several overlapping "close" paths.

---

### 3. "Mark as Active" and "Close" — as **bulk** actions
**Status:** Partial.

**Asked for:** *Mark as Active* and *Close* as **bulk** actions on the
Applications list (act on multiple selected rows at once). Purge is not a separate
bulk action — it follows from the close reason (item 2).

**Current state:** Equivalents exist as **per-row** menu items (*Move to active
bursary*, *Decline*, *Withdraw account*) in `application-row-actions.tsx`. The
list already has a bulk-selection toolbar (currently: assign assessor,
re-assessment invite), so the plumbing exists.

**To do:**
- Add *Mark as Active* and *Close* entries to the existing `BulkToolbar`
  (ADMIN-only, mirrors the assign-assessor pattern).
- The bulk *Close* action must collect the close reason (item 4) — one reason
  applied to the whole batch, confirmed before running. Whether each row is
  purged follows that reason's toggle (item 2).
- Enforce the same server-side gating the per-row actions use, and skip/report
  rows that aren't in a valid state rather than failing the whole batch.
- Confirmation dialog before a bulk close (destructive when the reason purges).

---

## Not started

### 4. Close reason dropdown (required on close)
**Status:** Not started.

**Asked for:** When closing an application, the user **must** select a reason from
a **dropdown**. The dropdown is **admin-configurable** — Charlotte can add or
remove reasons from Settings without a code change. Each reason also carries a
**"purge on close" toggle** (set in admin) that decides whether closing with that
reason purges PII (item 10) or retains all data — this is what lets us keep a
single "Closed" state (item 2). The selected reason is **displayed alongside the
application in all list views**.

Reasons to pre-populate (Charlotte to send the **full** list — purge toggle per
reason to be confirmed):
- Declined by the school
- Relocation
- Accepting another school offer

**To do:**
- Add an admin-configurable reference table for close reasons, with a `label` and
  a `purgeOnClose` boolean per row (mirror the existing reason-code /
  reference-data pattern; extend `seed-reference.ts` with an idempotent upsert,
  per CLAUDE.md — do **not** wire it into the demo seed only). Ship the schema
  migration in the same PR.
- Store the chosen reason (and the timestamp/actor) against the application on
  close; make the field required in every close path — per-row **and** bulk
  (items 2 and 3). The reason's `purgeOnClose` flag drives whether item 10 runs.
- Render the reason as a column / inline label in **all** application list views
  (new tab, rolling tab, any filtered drill-in).
- Add management for the reasons in admin Settings (a new tab or an extension of
  an existing settings tab), ADMIN-only: add/remove reasons and toggle
  `purgeOnClose`, with an audit entry on change.
- **Decided — dropdown only, no free text** anywhere. The reason is always chosen
  from the admin-configured dropdown; each value carries its `purgeOnClose`
  toggle. (Charlotte still to send the full reason list + which reasons purge.)

---

### 5. DNS / Resend domain setup instructions in the admin guide
**Status:** Not started.

**Asked for:** Document how to set up the sending domain in Resend (DNS records —
SPF/DKIM/DMARC, domain verification) so the Foundation can send from their own
domain.

**To do:** Add a section to the admin/operations guide walking through Resend
domain verification and the required DNS records. Documentation only — no code.

---

### 6. Export format — Excel (likely already satisfied)
**Status:** Needs client confirmation — probably no work required.

**Asked for:** Change the export format from PDF to **Excel (.xlsx)**.

**Current state:** There is **no PDF export**. The exports feature (`/exports` +
`/api/exports/recommendations`, backed by ExcelJS) already produces **XLSX/CSV**.
The only PDF in the system is the per-application *submission* document
(`/api/pdf/submission/[applicationId]`), which is a single-application artefact,
not a list export. So the premise of this change — a PDF export to convert —
doesn't exist.

**To do:**
- Confirm with the client which output they were looking at. Most likely the
  export is already the Excel they wanted and this item can be closed.
- If they actually meant the per-application submission PDF should also be
  available as Excel, treat that as a new, separate request and scope it then.

---

### 7. Date filters on the Applications list
**Status:** Not started.

**Asked for:** Two date-range filters on the list:
- **Received date** range.
- **Submission-by (deadline)** date.

**To do:**
- Add date-range controls to the list filter bar.
- Filter server-side (extend `ListApplicationsFilters`) or client-side to match
  the existing filter pattern.
- "Received date" filters on `submittedAt`; "submission-by" filters on the
  per-application deadline (with round default fallback — item 12).

---

### 8. Bulk email — "Send Email" wizard
**Status:** Not started.

**Asked for:** A **Send Email wizard** launched from the Applications list:
1. Select an email template.
2. Confirm the recipient list (the selected/filtered applications).
3. Send.

**To do:**
- Add a "Send email" bulk action to the list toolbar.
- Step 1: template picker (reads `email_templates`).
- Step 2: recipient confirmation showing resolved lead-applicant emails, with the
  ability to deselect.
- Step 3: send via the existing Resend integration + merge-field rendering; write
  an audit entry per send.
- Handle partial failures gracefully and report a per-recipient result summary.

---

### 9. Email template management (add / delete) in admin settings
**Status:** Not started.

**Asked for:** Let admins **add and delete** email templates from Settings, not
just edit existing ones.

**Current state:** The Email Templates settings tab supports editing content.
Note: `email_templates` are seeded via the `*_seed_email_templates` migration
(single source of truth per CLAUDE.md).

**Decided — fully custom templates.** Admins can add/edit/delete their own custom
templates; the ~15 built-in system templates remain edit-only (non-deletable).
Needs a schema change: template identity decoupled from the `EmailTemplateType`
enum + a system-vs-custom flag + soft-delete (so re-seeds don't resurrect deleted
rows).

**To do:**
- Add create/delete UI to the Email Templates settings tab.
- Server actions for insert/delete with validation (prevent deleting templates
  the system sends automatically, or guard those as non-deletable).
- Reconcile with the migration-seeded baseline so a re-seed doesn't clobber
  admin-created templates or resurrect deleted ones.

---

### 10. Purge logic (PII + documents out, financials retained)
**Status:** Not started.

**Asked for:** When an application is closed with a reason whose "purge on close"
toggle is on (items 2 and 4), purge PII and uploaded documents but **retain**:
financial figures, the bursary reference, dates, and the assessment synopsis.

**To do:**
- Trigger this routine from the close flow only when the selected reason's
  `purgeOnClose` flag is set; otherwise close and retain everything.
- Define exactly which fields are PII (names, contact details, address,
  free-text) vs retained (financials, reference, dates, assessment synopsis).
- Anonymise/null the PII fields; delete documents from Supabase Storage.
- Keep the row (and its retained fields) intact — this is anonymisation, not
  deletion. The close reason (item 4) is retained.
- Write an audit entry (remember `audit_logs` is append-only).
- Align with the existing GDPR deletion routine so the two don't diverge.

---

### 11. Bursary reference freely editable at any time
**Status:** Not started.

**Asked for:** The bursary reference should be **editable at any point**, with no
state-gating.

**Decided:** **ADMIN only** (ASSESSOR/VIEWER read-only), enforced server-side.
References are **required** (no blank), **case-insensitive** for uniqueness, and
**allow whitespace + special characters** (preserved verbatim, not normalised).

**To do:**
- Add an editable reference field (detail page and/or inline on the list).
- Server action to update `applications.reference` regardless of lifecycle state.
- Case-insensitive uniqueness validation (e.g. unique index on `lower(reference)`)
  + audit entry on change.

---

### 12. Round-level default submission-by date
**Status:** Not started.

**Asked for:** A **round-level default** submission-by (deadline) date that is
inherited by all applications in that round, with the **per-application override**
still available.

**Decided — date-only** (no time-of-day); per-application deadline is **inherit or
override** only (simple nullable date, no "explicitly none" opt-out).

**To do:**
- Add a default-deadline field to the `Round` model/settings (schema migration —
  ship it in the same PR per CLAUDE.md migration discipline).
- Applications inherit the round default unless a per-application deadline is set.
- Surface the effective deadline wherever the deadline is shown/filtered
  (items 1 and 7).

---

### 13. Loading indicator for slow tab transitions
**Status:** Not started.

**Asked for:** A loading screen/indicator when switching between application
detail tabs, which can be slow.

**Current state:** The `feature/edit-assessment` worktree fixed the *stuck*
Assessment tab (the bug that read as "stuck"), but added **no** loading
indicator.

**To do:**
- Add a pending/loading state on tab navigation (e.g. `useTransition` /
  `usePathname` pending state in `application-detail-tab-link.tsx`, or a
  `loading.tsx` for the tab route segments).
- Show a spinner/skeleton during the transition so slow loads don't look frozen.

---

### 14. Block / discourage Word document uploads
**Status:** Not started.

**Asked for:** Block or discourage `.doc`/`.docx` uploads and, on a Word-file
upload attempt, show **instructions for converting to PDF**.

**To do:**
- Reject Word MIME types / extensions at the upload control (client) and in the
  upload server action (defence in depth).
- On a blocked Word upload, show a helper message with steps to convert to PDF
  (e.g. "Save As → PDF" in Word, or print-to-PDF).
- Confirm the accepted-types allowlist with the Foundation (PDF, images?).
</content>
