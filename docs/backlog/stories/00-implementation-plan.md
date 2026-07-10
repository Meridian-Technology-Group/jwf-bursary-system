# Implementation plan — post-demo user stories (items 1–14)

> Covers every story in `docs/backlog/stories/`. Written 2026-07-09 after a full
> codebase survey. Each item below records: what the codebase already provides,
> the implementation approach, files touched, schema impact, and open decisions.
> Ordering, parallelisation, and the PR sequence are at the end.

## Summary verdict per item

| Item | Scope after codebase survey | Size | Schema change |
|---|---|---|---|
| 1 | Status + deadline columns, status filter on `/queue` | M | No |
| 2 | Unified Closed state (new lifecycle concept) | L | Yes |
| 3 | Bulk Mark-as-Active + bulk Close | M | No (rides on 2/4) |
| 4 | `close_reasons` reference table + required reason | M | Yes |
| 5 | Docs only (Resend/DNS guide) | S | No |
| 6 | **No code** — client confirmation spike | — | No |
| 7 | Received-date + deadline date-range filters | M | No |
| 8 | Bulk Send-Email wizard | L | No (uses 9's) |
| 9 | Custom email templates (add/delete) | M–L | Yes |
| 10 | Reason-driven selective purge routine | L | Yes (purge marker) |
| 11 | Editable bursary reference + CI uniqueness | S–M | Yes (functional index) |
| 12 | Round-level default submission-by date | M | Yes |
| 13 | Tab loading indicators | S | No |
| 14 | Block Word uploads (server side + centralise) | S | No |

Key codebase facts the plan relies on (from the survey):

- The Applications list is **`/queue`** (`src/app/(admin)/queue/page.tsx` +
  `src/components/admin/application-table.tsx`, one 933-line file holding the
  table, tabs, filter bar, and `BulkToolbar`). Bulk actions are an extensible
  `BulkAction[]` array; the bulk pattern is ADMIN-gate → 500-row cap → per-row
  loop in one `withUserContext` tx → per-entity audit rows → skip/report
  summary → `revalidatePath("/queue")`.
- Status is a **derived projection**: `deriveReviewPhase`
  (`src/lib/applications/status.ts:112`) over
  `formStatus`/`assessment.status`/`assessment.outcome`, with client/Prisma
  mirrors in `src/lib/applications/queue-filter.ts` (`matchesReviewPhase`,
  `reviewPhaseWhere`). The `ReviewPhase` union is **duplicated** in both files.
  The list rows already carry all three source fields, so a status column
  needs no query change.
- **`Application.submissionDeadlineAt` already exists** (Epic 03), with a
  single derivation helper `effectiveSubmissionDeadline(app, round)` in
  `src/lib/rounds/submission-deadline.ts` that falls back to
  `endOfDay(round.closeDate)`. Item 12 adds a *round default* into that chain.
- Today's "close" paths live on **two different lifecycle tracks**: *Decline*
  writes `assessment.outcome = DOES_NOT_QUALIFY` + `application.archivedAt`
  (application/assessment track), while *Withdraw account* writes
  `BursaryAccount.status = CLOSED` + `closedAt` (account track). A declined
  NEW application often has **no BursaryAccount at all**, and
  `deriveReviewPhase` is blind to account status. The unified Closed state
  must therefore anchor on the **Application**, not the account.
- The existing GDPR cascade (`src/lib/retention/purge.ts:purgeApplication`)
  **hard-deletes the whole Assessment (including all financials and the
  synopsis) and all form sections** — it cannot be reused as-is for item 10's
  "retain financials/synopsis" purge. It also has two PII residue gaps
  (`Contact` rows and `BursaryAccount.childName/childDob` are never scrubbed)
  that item 10 should fix in both routines.
- `email_templates.type` is a **NOT-NULL unique enum** (`EmailTemplateType`,
  16 values) seeded by guarded `INSERT … WHERE NOT EXISTS` migrations — item 9
  needs `type` nullable + a name/system-flag/soft-delete. There is an unused
  `sendBatchEmails` helper in `src/lib/email/send.ts` ready for item 8. There
  is **no EmailLog table**; sends are recorded only in caller audit metadata.
- **Word uploads are already blocked client-side** (`file-upload.tsx` has
  Word MIME/extension detection with a convert-to-PDF message, and the
  `accept` attribute excludes `.doc/.docx`). Server routes already reject via
  a PDF/JPG/PNG allowlist + magic-byte sniff, but with a generic message, and
  the allowlist is **triplicated** across three files. Item 14 is mostly
  centralisation + server-side messaging.

---

## Per-item implementation plans

### Item 1 — Status & deadline columns, status filter (`/queue`)

**1.1 Status column** — no query change: `ApplicationListItem` already carries
`formStatus`, `assessmentStatus`, `outcome`. Compute the phase per row (via
`deriveReviewPhase`, or a row-shaped equivalent client-side) and render a
badge column in `application-table.tsx` (column defs at lines 549–673).

- Labels: extract **one shared label map** so list and detail agree (AC in
  1.1). Today two maps exist with different wording — `STATUS_LABEL` in
  `src/components/admin/application-actions.tsx:364` ("Awaiting review",
  "Paused — awaiting documents", …) and `STATUS_LABELS` in `queue/page.tsx:273`
  ("Submitted", "Paused", …). Consolidate into a shared module (e.g.
  `src/lib/applications/review-phase-labels.ts`), use the detail-page
  (flow-diagram) wording, and have both surfaces import it. Also consider
  merging the duplicated `ReviewPhase` type while there.
- Render on both tabs (columns are shared already).
- **Forward-compat with item 2:** build the column/filter off
  `ALL_REVIEW_PHASES` + the shared label map so that when Track A adds a
  `CLOSED` phase it appears automatically.
- **Flow-map vocabulary (per D-3's ruling):** the official state map has no
  qualify/not-qualify concept, so the legacy `QUALIFIES` / `DOES_NOT_QUALIFY`
  phases must not surface under those names. In the shared label map render
  them in state-map terms — `QUALIFIES` (account activated) → "Active",
  `DOES_NOT_QUALIFY` → "Closed" — converging with the real `CLOSED` phase
  Track A adds. Confirm exact strings with Brian when B2 is built.

**1.2 Deadline column** — add `submissionDeadlineAt` and the round's deadline
fields to the `listApplications` select (`src/lib/db/queries/applications.ts:186`)
and `ApplicationListItem`; compute the effective deadline through
`effectiveSubmissionDeadline` (the single helper — do not re-derive) and render
with `formatLondonDate`, em-dash when none. Ships **after item 12** so the
fallback chain is final (see decision D-1); if built earlier it shows the
current `submissionDeadlineAt ?? round.closeDate` derivation and picks up the
round default for free when 12 lands, because the helper is shared.

**1.3 Status filter** — the list's other filters (round/school/search) are
client-side over already-fetched rows; the only status filtering today is the
`?status=` URL drill-in. Add a status multi-select to the filter bar
(client-side, using `matchesReviewPhase` from `queue-filter.ts`, which is
already client-import-safe), composing (AND) with tab and other filters.
Keep the `?status=` drill-in banner behaviour untouched.

**Files:** `application-table.tsx`, `queue/page.tsx`, new shared label module,
`applications.ts` (for 1.2). **Tests:** label-map unit test; filter predicate
composition tests.

### Item 12 — Round-level default submission-by date

Additive migration: `default_submission_deadline DATE NULL` on `rounds`
(date-only per the decided AC; matches the existing `@db.Date` round dates).

- Schema + `RoundSchema` zod (add optional field + refinement it's within/after
  sensible bounds), `createRoundAction`/`updateRoundAction`
  (`src/app/(admin)/rounds/actions.ts`), `createRound`/`updateRound` +
  `RoundWithCounts`/`RoundDetail` (`src/lib/db/queries/rounds.ts`),
  `edit-round-dialog.tsx` + `create-round-dialog.tsx`, cockpit header display
  (`rounds/[id]/page.tsx:172–193`). ADMIN-only editing falls out of the
  existing actions' role gate.
- Audit: extend `UPDATE_ROUND` metadata (note: `decisionDate` is currently
  missing from that metadata — add both). Single round-level audit entry only
  (per 12.3).
- Update `effectiveSubmissionDeadline()` to insert the round default into the
  chain (see **D-1** below for exactly where). Inheritance is derived at read
  time — nothing is copied onto applications — so 12.3's propagation is free.
- `submission-deadline-card.tsx` (admin detail) and the portal deadline
  surfaces already show the effective value; add the "(from round default)" vs
  override provenance label the card needs for 12.2 (`isOverride` flag already
  exists on the helper's return).

**D-1 — RESOLVED (Brian, 2026-07-09): option (a).** Original framing kept for
context: where does `round.closeDate` sit after this?
Today the fallback is `submissionDeadlineAt ?? endOfDay(round.closeDate)` and
that drives the **portal submit guard** — every application effectively has a
deadline. The stories instead say "round has no default ⇒ application has no
deadline". Options:
  a) `override ?? roundDefault ?? closeDate` — backwards-compatible, portal
     submit-gating unchanged, but "no deadline" almost never occurs (column/
     filter AC for the em-dash case becomes dead letter).
  b) `override ?? roundDefault` (closeDate no longer a deadline, only an
     intake-window date) — matches the stories literally, but changes portal
     submit behaviour for every existing round until defaults are set.
**Chosen: (a)** — `override ?? roundDefault ?? endOfDay(closeDate)`; the round
default is the explicit, admin-visible expression of what closeDate implied.

### Item 7 — Date-range filters on `/queue`

**7.1 Received date** — per the story, extend `ListApplicationsFilters`
(server-side): add `submittedFrom`/`submittedTo`, apply as
`submittedAt: { gte, lte }` in `listApplications`; `null` `submittedAt`
excluded automatically when a bound is active. Drive from URL search params
parsed in `queue/page.tsx` (consistent with the existing `?status=` drill-in),
with from/to date inputs + an active-filter chip in the filter bar and
inline validation (from ≤ to).

- Timezone: inputs are Europe/London calendar dates; convert to UTC instants
  server-side covering the full boundary days (`datetime.ts` already
  centralises London handling).

**7.2 Submission-by (deadline) range** — needs SQL-level "effective deadline"
semantics: `OR(submissionDeadlineAt in range, AND(submissionDeadlineAt null,
round.default in range))` as a where-fragment that mirrors
`effectiveSubmissionDeadline` (keep the two adjacent with a shared test fixture
so column and filter agree). Rows with no effective deadline excluded when a
bound is active. **Depends on item 12** (or ships override-only first — but
since 12 is small, sequence 12 → 7.2 and avoid the interim state).

Both filters compose with tab/round/school/search/status (the client filters
operate on the already-server-filtered rows, so composition is automatic).

**Files:** `applications.ts`, `queue/page.tsx`, `application-table.tsx` filter
bar. **Tests:** where-fragment unit tests incl. boundary days and null cases.

### Item 4 — Close-reason reference data (build first in Track A)

**4.3 Settings management + seed** — mirror the `ReasonCode` pattern exactly:

- Prisma model `CloseReason` → `@@map("close_reasons")`: `id uuid`,
  `label String`, `purgeOnClose Boolean @default(false)`,
  `isDeprecated Boolean @default(false)` (soft-deactivate — never hard-delete,
  preserving historical FK integrity per the story's own note), `sortOrder`,
  `createdAt`. Additive migration.
- Seed: `prisma/seed-data/close-reasons.ts` + `seedCloseReasons()` upsert in
  `prisma/seed-reference.ts` (3 placeholder reasons, all `purgeOnClose=false`
  until Charlotte confirms the real list/toggles).
- Settings: 6th tab in `settings/page.tsx` (`grid-cols-5` → `grid-cols-6`),
  `close-reason-table.tsx` modelled on `reason-code-table.tsx` plus a purge
  Switch with destructive-red styling and helper text;
  `upsertCloseReasonAction` (ADMIN-only) in `settings/actions.ts`; query in
  `reference-tables.ts`; audit keys `SETTINGS_CLOSE_REASON_CREATE/UPDATE` and
  entity `CloseReason` in `src/lib/audit/actions.ts`.

**4.1/4.2/4.4** are consumed by items 2 and 3 (the close dialogs and the list
column) — they're scheduled inside PRs A3/A4 below rather than standalone.
4.4 (reason shown in lists): add `closeReason.label` to the
`listApplications` select and a column (or inline badge next to status) —
blank when not closed; label survives deprecation because it's read through
the FK to the (soft-deactivated) row.

### Item 10 — Purge routine (reason-driven, selective)

This is a **new selective routine**, not a reuse of `purgeApplication` (which
deletes the entire assessment + sections and thus the financials/synopsis the
story requires retained). Shared primitives, divergent scope — exactly story
10.5's framing.

- **Scrub map** (10.2): new `src/lib/retention/scrub-map.ts` as the single
  documented PII-vs-retained catalogue: per model, which fields are scrubbed
  (and their redaction token) vs retained. Both `purgeApplication` (GDPR) and
  the new close-purge derive their field lists from it; the GDPR dialog's
  Deleted/Anonymised/Retained copy should be generated from (or tested
  against) it so the three stop drifting.
- **New `purgeClosedApplication`** in `src/lib/retention/` (DI style like
  `purgeApplication`):
  - Scrub: `Application.childName/childDob`; lead (and erasable secondary)
    `Profile` name/phone/email; `Contact` row PII (name, address, phone,
    email, notes, childName/childDob) — **fixes the existing residue gap**;
    `BursaryAccount.childName/childDob`; free-text fields on
    Assessment/Recommendation/Checklist (`synopsis` — see D-2,
    `familySynopsis`, `notes`, `manualAdjustmentReason`,
    `secondaryParentOverrideReason`); `ApplicationSection.data` JSONB
    (delete rows — it is wholly parent-entered PII; the financial figures the
    Foundation keeps live on the Assessment, which is retained).
  - Delete: `Document` rows + Storage objects via the **same
    `deleteDocument` helper** (`src/lib/storage/documents.ts:153`); surface
    per-object failures (10.3) rather than silently succeeding.
  - Retain: all Assessment/Earner/Property Decimal financials, outcome,
    `reference`, dates, close reason, `Recommendation.bursaryAward`.
  - Idempotent via `Application.purgedAt` marker (part of item 2's migration);
    re-runs no-op.
  - Atomic: runs inside the same close transaction (Storage deletion ordered
    first / compensated, mirroring the GDPR cascade's non-fatal-storage
    pattern — document the same trade-off).
- **Audit** (10.4): insert-only `APPLICATION_PURGED` entry per application —
  reference + counts in metadata, no PII values.
- **Alignment** (10.5): refactor `purgeApplication` to read the scrub map and
  extend it to cover `Contact` + `BursaryAccount` child fields too; add a doc
  block stating the intended differences (GDPR = profile-scoped, deletes
  assessment wholesale; close-purge = application-scoped, retains financials).
- **Retention interplay:** a reason-driven purge is immediate; non-purge
  closes continue to age through `src/lib/retention/policy.ts` tiers. The
  cron's candidate filter (`childName != "[Child Removed]"`) already skips
  purged rows; verify and add a test.

**D-2 — RESOLVED (Brian, 2026-07-09):** retain the synopsis verbatim; the
purge confirm dialog warns that retained synopsis text should be free of
personal data; note the residual risk for Charlotte/DPO.

**Tests:** heavy unit coverage in `src/lib/retention/__tests__/` (scrub map
completeness — a test that fails when a new PII-suspect column appears on the
mapped models is worth the effort; idempotency; storage-failure surfacing).

### Item 2 — Single Closed state

Anchor the close on the **Application** (declined NEW apps have no account).

- **Migration (additive):** on `applications`: `closed_at timestamptz NULL`,
  `closed_by uuid NULL`, `close_reason_id uuid NULL REFERENCES close_reasons`,
  `purged_at timestamptz NULL`.
- **Core:** new `closeApplication(applicationId, closeReasonId, actor)` in
  `src/lib/applications/close.ts`:
  - Server-side enforcement: reason required and must be an active
    `CloseReason` (4.1's "no close path can bypass it"); reject if already
    closed (no double-close, `closedAt` immutable like the withdraw action).
  - One transaction: set close fields; if a live (`ACTIVE`) `BursaryAccount`
    exists, close it through the same status/closedAt write the withdraw path
    uses (extract the account-close write into a shared helper so
    `withdrawBursaryAccount`, `closeAccountIfComplete`, and this stay one
    writer); if `reason.purgeOnClose`, run `purgeClosedApplication`; audit
    `APPLICATION_CLOSED` (actor, reason, `purgeRan` flag).
  - Role: ADMIN (per story 2.1; the current withdraw allows ASSESSOR —
    tightening to ADMIN matches stories 2/3; flag in PR description).
- **Derived phase:** add `CLOSED` to `ReviewPhase` — `status.ts` +
  `queue-filter.ts` (both copies, or the consolidated one from item 1),
  derived from `closedAt != null` with **precedence over every other phase**;
  update `reviewPhaseWhere`/`matchesReviewPhase`/`undecidedWhere`,
  `ALL_REVIEW_PHASES`, the shared label map ("Closed"), and audit the
  consumers (detail gating in `layout.tsx`, `application-actions.tsx` action
  bar — closed hides all state-changing actions, round-cockpit counts,
  reports). `closedAt` must join the list/detail selects.
- **UI:** per-row **Close…** action in `application-row-actions.tsx` opens a
  dialog: required reason `Select` (active reasons), reason-aware confirm copy
  (destructive warning naming PII/document removal when `purgeOnClose`,
  neutral retain copy otherwise — story 2.2), then calls the server action.
  Closed rows lose the Close item (and other transitions). Detail page gets a
  closed banner showing reason, date, actor, and "data purged" where
  applicable (2.1 AC).
- **2.3 Reconciliation:**
  - *Withdraw account* row/dialog actions are **replaced** by the unified
    Close (its reason free-text is superseded by the structured reason; the
    account-close behaviour is subsumed). Keep `withdrawBursaryAccount`
    internals as the shared account-close helper.
  - *Decline* today = `setApplicationAwardAction(id, "DOES_NOT_QUALIFY")` — an
    assessment-track award decision driving the DNQ email and retention tier.
    **D-3 resolved (Brian, 2026-07-09, per the official state map
    `docs/diagrams/bursary-application-flow.drawio`): there is no
    qualify/not-qualify concept.** The assessment track only runs Not Started →
    In Progress → Complete (report to school); what follows is the **school's
    decision**: DECLINED → close (& purge per the reason's toggle), OFFERED →
    activate the account + attach the round schedule. So: **no coupling between
    close and outcomes.** The row-menu "Decline" is replaced by "Close…"; a
    school decline is Close with the "Declined by the school" reason (note the
    state map shows DECLINED → close **& purge**, so that reason is likely
    purge-flagged — Charlotte confirms the toggle). The legacy
    QUALIFIES/DNQ/AWARDED outcome machinery (recommendation-page award flow,
    OUTCOME_* emails) is not extended by this work; where these stories touch
    it, they route around it (see 3.1).
  - **Retention interplay (consequence of D-3/D-4):** `isPurgeable` currently
    treats "no terminal outcome" as never-purgeable, and its tiers anchor on
    outcome. Once close (this item) and activation (3.1) no longer write
    outcomes, `Application.closedAt` must become a first-class retention
    anchor (closed-not-purged rows age through the policy; activated rows are
    in-flight). Extend `src/lib/retention/policy.ts` accordingly in A3 with
    tests.
  - Historical records: leave old declines/withdrawals as-is (`closedAt`
    null); they continue to render through the existing outcome/account
    badges. No backfill (a backfill can't know reasons). Document in the PR.

### Item 3 — Bulk Mark-as-Active and bulk Close

Both are new entries in the `BulkAction[]` array
(`application-table.tsx:340`), following the bulk-assign template (ADMIN gate,
500 cap, per-row loop + per-row audit inside one tx, skip/report summary,
selection cleared, `revalidatePath("/queue")`).

- **3.1 Bulk Mark as Active — D-4 resolved (Brian, 2026-07-09):** per the
  official state map, "Mark as Active" records the **school's OFFERED
  decision**: activate the bursary account and attach the round schedule —
  **nothing else**. No award/outcome write, no outcome email (awarding is not
  a concept here; it is the school's decision, external to the system).
  Implementation: the activation primitive already exists —
  `promoteToActiveAccount` (`src/lib/applications/account-promotion.ts`)
  creates or continues the ACTIVE `BursaryAccount`, re-activates a CLOSED one,
  and generates the forward round schedule idempotently. Today it is only
  reachable *through* `setApplicationOutcome(AWARDED)` (which adds the email
  and outcome write); the bulk action calls `promoteToActiveAccount`
  **directly** inside the standard bulk loop, with its own audit action (e.g.
  `APPLICATION_MARKED_ACTIVE`, metadata: accountId, created-vs-continued).
  Gate: assessment COMPLETED (reported to school) and not closed; rows failing
  the gate are skipped with reasons. The per-row "Move to active bursary…"
  menu item switches to the same direct activation (with a lightweight
  confirm), replacing the current navigation to the recommendation/award
  page — per-row and bulk share one path.
- **3.2/3.3 Bulk Close:** dialog = reason Select (required before proceed) →
  confirmation step stating count + reason with purge-aware destructive copy
  (3.3) → `bulkCloseApplicationsAction` looping the item-2
  `closeApplication` core (no forked path); already-closed/invalid rows
  skipped + reported; per-row audit incl. purge flag; summary toast/dialog
  with succeeded/skipped-and-why.
- 4.4's close-reason list column lands here too (same files, same PR).

### Item 9 — Email template add/delete

**Migration (one PR with the code, additive):**
`ALTER TABLE email_templates ALTER COLUMN type DROP NOT NULL;` add
`name text NULL` (display identity for customs), `is_system boolean NOT NULL
DEFAULT true`, `deleted_at timestamptz NULL`, `created_by uuid NULL`; backfill
`is_system = true` for existing rows; add a case-insensitive unique index on
`lower(name)` where `name IS NOT NULL AND deleted_at IS NULL`. The existing
`email_templates_type_key` unique index is kept — Postgres treats NULLs as
distinct, so many custom rows coexist; `findUnique({ where: { type } })` in
`send.ts` keeps resolving exactly one row per enum value (story 9.3's
invariant).

- **9.1 Add:** "Add template" form (name, subject, body) in
  `email-template-editor.tsx`; `createEmailTemplateAction` (ADMIN,
  `mergeFields` defaults to the `COMMON_MERGE_FIELDS` set — see D-5), audit
  `SETTINGS_EMAIL_TEMPLATE_CREATE`. `getAllEmailTemplates` +
  `EmailTemplateRow` gain `name/isSystem/deletedAt`, exclude soft-deleted,
  order system-first; `TEMPLATE_LABELS` (an exhaustive
  `Record<EmailTemplateType,…>`) becomes a fallback for system rows with
  custom rows labelled by `name`.
- **9.2 Delete:** soft delete (`deletedAt`) with destructive confirm naming
  the template; ADMIN-only server enforcement; audit
  `SETTINGS_EMAIL_TEMPLATE_DELETE`. Soft-deleted rows vanish from the editor
  and every picker.
- **9.3 Guard:** no delete affordance for `is_system` rows *and* the server
  action rejects system deletion outright. Badge system rows ("System") and
  customs ("Custom"). Locked-type switch behaviour
  (`src/lib/email/locked-types.ts`) unchanged.
- **9.4 Seed reconciliation:** largely free by construction — the migration
  seeds are guarded `INSERT … WHERE NOT EXISTS (type = …)` so they never touch
  custom (`type IS NULL`) rows and never overwrite admin edits; only system
  rows are seedable and system rows can't be deleted, so resurrection can't
  occur. Two real gaps to close: `prisma/seed-demo.ts` does
  `emailTemplate.deleteMany({})` (dev-only but should recreate `is_system`
  correctly), and future seed migrations must keep the `WHERE NOT EXISTS`
  idiom — add a short note to the seeds section of CLAUDE.md/docs.

**D-5 — RESOLVED (Brian, 2026-07-09):** custom templates get the common
merge-field set (`applicant_name, child_name, reference, school,
academic_year, deadline`).

### Item 8 — Bulk Send-Email wizard

Three-step dialog launched from a new `BulkAction` entry ("Send email").

- **Step 1 — template:** picker over `getAllEmailTemplates` (enabled, not
  deleted; system + custom), preview of subject/body with placeholder chips.
  **Exclude templates whose merge fields can't be resolved in bulk context**
  (e.g. `registration_link`, `submission_date` are flow-specific) — maintain
  a resolvable-field set and grey out/omit templates needing more (with a
  tooltip), rather than sending emails with `{{unresolved}}` tokens (the merge
  engine leaves unknown tokens verbatim — a footgun to design around).
- **Step 2 — recipients:** resolve each selected application's
  `leadApplicant { email, firstName, lastName }` (the canonical target;
  `Profile.email` is non-null so "unsendable" is about DELETED/anonymised
  profiles — flag `role = DELETED`/redacted emails as unsendable and
  pre-deselect). Untick to exclude; per-recipient rendered preview via
  `replaceMergeFields`; show count + from-address (`RESEND_FROM_EMAIL`);
  Next disabled at zero recipients.
- **Step 3 — send:** new `bulkSendEmailAction` (cap 500): loads the template
  once, builds per-application merge data (new resolver
  `src/lib/email/bulk-merge-data.ts` mapping the resolvable field set from
  the application row), then a resilient sequential loop modelled on
  `sendBatchEmails`/the batch-reassessment pattern (per-recipient try/catch,
  100ms delay, aggregate). Per-recipient audit row — new
  `AUDIT_ACTIONS.BULK_EMAIL_SENT` with outcome + Resend messageId in metadata
  (there is no EmailLog table; audit rows are the durable record, matching
  the outcome-email precedent). Progress + double-submit guard client-side;
  final summary "N sent, M failed" with per-recipient failure reasons.
- **Roles — D-6 RESOLVED (Brian, 2026-07-09):** ship ADMIN-only (the bulk
  toolbar and checkbox column are already ADMIN-only). Widening to ASSESSOR is
  a small follow-up if Charlotte asks.
- Testing constraint: local Resend key is invalid — end-to-end send is only
  verifiable on a deployed preview; unit-test the resolver/loop with a mocked
  `sendEmail`.

### Item 11 — Editable bursary reference

- **Migration:** raw SQL `CREATE UNIQUE INDEX applications_reference_lower_key
  ON applications (lower(reference));` (first functional index in the repo —
  Prisma can't express it declaratively; keep the existing case-sensitive
  `@unique` alongside, it's implied by the new one but harmless). **Pre-check
  both environments for existing case-insensitive duplicates before the
  migration lands** (CI applies it to nonprod on merge) — a one-off
  `SELECT lower(reference) … GROUP BY … HAVING count(*)>1`.
- **Server action** `updateApplicationReferenceAction` following the
  `setSubmissionDeadlineAction` template (`actions.ts:981`): ADMIN-only,
  **no state gate** (explicitly exempt, incl. closed/archived), trim +
  reject-blank, pre-check `findFirst({ reference: { equals, mode:
  "insensitive" }, id: { not } })` for a friendly inline error and catch the
  unique-constraint race as backstop; preserve value verbatim (no whitespace
  normalisation beyond the blank check — the story says characters are
  significant).
- **Audit:** new `UPDATE_REFERENCE` action, metadata `{ from, to }`; written
  in-tx only on success (11.3).
- **UI:** edit affordance on the detail header reference
  (`applications/[id]/layout.tsx:205`) — small pencil → inline dialog, ADMIN
  only; ASSESSOR/VIEWER see plain text.
- Note recorded for maintainers: both reference generators (the shared
  `generateApplicationReference` and the inline duplicate in
  `queue/actions.ts:201`) use `count(startsWith prefix)+1` — a manually edited
  reference can shift the count base. The unique index now makes collisions
  fail loudly instead of silently; consolidating the duplicated generator is a
  worthwhile drive-by (optional).

### Item 13 — Tab loading indicators

The detail tabs are **route segments** (`applications/[id]` +
`/assessment`, `/recommendation`, `/history`) navigated by plain `<Link>`s in
`application-detail-tab-link.tsx`; only the parent segment has a `loading.tsx`,
so nested tab transitions show nothing.

- **13.2 (does most of the work):** add `loading.tsx` to the three
  sub-segments using the shared primitives (`SectionLoader`, `TableSkeleton`
  from `src/components/shared/loading.tsx`) shaped roughly per tab
  (assessment = form sections, history = table). Page chrome (layout header +
  tab bar) stays interactive automatically — that's the layout boundary.
  Errors already fall to the admin ErrorBoundary.
- **13.1:** add a pending cue in `ApplicationDetailTabLink` — `useTransition`
  + `router.push` (Next 14 has no `useLinkStatus`), marking the clicked tab
  active-pending immediately with a small spinner; CSS ~150ms appearance
  delay so fast loads don't flicker. Navigation elsewhere mid-transition is
  unaffected (transitions are interruptible).

### Item 14 — Block Word uploads

Client-side blocking + friendly convert-to-PDF copy **already exist**
(`file-upload.tsx:117–146`); the `accept` attr already excludes Word. Remaining:

- **14.4 Centralise:** new client-safe module
  `src/lib/uploads/accepted-types.ts` exporting `ACCEPTED_MIME`,
  `ACCEPTED_EXTENSIONS`, `MAX_SIZE_BYTES`, `isWordDocument(nameOrMime)`, and
  the shared rejection/guidance copy. Refactor the **three duplicated
  allowlists** (`api/documents/route.ts:32`, `api/admin/documents/route.ts:26`,
  `file-upload.tsx:115`) to import it; `sniff.ts` stays the magic-byte
  authority.
- **14.2 Server messaging:** both API routes detect Word (extension or MIME)
  before the generic allowlist rejection and return the specific
  convert-to-PDF message (per-file rejection in mixed batches — matches
  current per-file route semantics).
- **14.3:** copy already exists client-side; reuse the shared module's string
  in both layers (it's rendered via `role="alert"` rows — accessibility AC
  already satisfied).
- **Open (Foundation):** confirm the allowlist stays PDF/JPG/PNG — current
  behaviour matches the expected answer, so this doesn't block the build.

### Item 5 — DNS/Resend guide (docs only)

New `docs/operations/resend-domain-setup.md` matching the operations-doc tone:
goal/prereqs, Resend Domains → Add Domain walkthrough (region, `send.`
subdomain convention, screenshot placeholders), SPF/DKIM/DMARC records in
plain language with "copy values live from the dashboard" warnings, registrar
host/value quirks + propagation, Verified/pending/failed states +
troubleshooting, then the follow-up: set `RESEND_FROM_EMAIL` (cross-link
`environment-variables.md`, note env changes are user-approved), and the
JWF-specific single-shared-Resend-account + Production-only webhook-secret
reality. Cross-link from `docs/guides/admin-assessor-guide.md` and the ops
docs. Placeholders flagged for Charlotte: sender subdomain, DNS provider.

### Item 6 — Export format (no code)

Confirmation spike only. Premise already verified in code: exports are
XLSX/CSV (ExcelJS) at `/exports`; the only PDF is the per-application
submission document. Action for Brian/Charlotte: demo `/exports`, get written
confirmation, then mark item 6 closed in `post-demo-change-list.md` (or open a
fresh, separately-scoped item if they meant the submission PDF). No PR.

---

## Dependency graph

```
Track A (lifecycle)   A1: item 4.3 close_reasons ──┐
                      A2: item 10 purge routine  ──┴─► A3: item 2 unified close (+4.1)
                                                        └─► A4: item 3 bulk actions (+4.2, 4.4)

Track B (list/rounds) B1: item 12 round default ───► B3: items 1.2 + 7.2 (deadline column & filter)
                      B2: items 1.1 + 1.3 + 7.1 (status column/filter, received-date filter)

Track C (email)       C1: item 9 templates ───► C2: item 8 bulk-email wizard

Track D (independent) D1: item 11 reference · D2: item 13 tab loading ·
                      D3: item 14 uploads    · D4: item 5 docs

No-code               item 6 (client confirmation)
```

Cross-track couplings (soft):
- **1.1 ↔ 2:** the status column should be built off `ALL_REVIEW_PHASES` +
  the shared label map so A3's new `CLOSED` phase appears without rework.
- **1.2/7.2 ↔ 12:** both consume `effectiveSubmissionDeadline`; 12 first.
- **8 ↔ 9:** the wizard's picker reads the new template model; 9 first.
- **2/3 ↔ 4:** close requires the reason table; 4.3 first.
- **2 ↔ 10:** the close transaction invokes the purge routine; 10 (or at
  least its interface + scrub map) before A3.

## Merge-conflict hotspots (sequencing constraint, not dependency)

- **`application-table.tsx`** is touched by B2, B3, A4, and C2. Don't run two
  of those concurrently (prior parallel-worktree incidents in this repo);
  land B2 → B3 → A4 → C2 in that relative order or rebase deliberately.
- **`settings/page.tsx` tab grid** is touched by A1 (6th tab) and C1 (editor
  changes) — trivial but expect a rebase.
- **`src/lib/audit/actions.ts`** gains keys in A1, A3, A4, C1, C2, D1 —
  append-only additions, conflicts resolve mechanically.
- **`applications.ts` (list query)** touched by B2/B3/A3/A4.

## Recommended implementation order

Waves group what can genuinely run in parallel (different files/areas). Within
a wave, PRs are independent; waves are sequential where arrows exist above.

**Wave 1 (all parallel — no interdependencies):**
- **A1** — item 4.3: `close_reasons` table + settings tab + seed. *(M)*
- **A2** — item 10: scrub map + `purgeClosedApplication` + GDPR-routine
  alignment (Contact/BursaryAccount gaps). Pure lib + tests; UI trigger comes
  in A3. *(L)*
- **B1** — item 12: round default deadline (schema, rounds UI, helper chain,
  decision D-1 resolved first). *(M)*
- **B2** — items 1.1 + 1.3 + 7.1: status column, status filter,
  received-date filter, shared label map. *(M)*
- **D1–D4** — items 11, 13, 14, 5: four small independent PRs. *(S each)*

**Wave 2 (after their Wave-1 parents):**
- **A3** — item 2 (+4.1): unified close — schema, `closeApplication` core,
  `CLOSED` review phase, per-row Close dialog, Decline/Withdraw
  reconciliation. Needs A1 + A2. *(L — the riskiest PR; phase-vocabulary
  change fans out to queue filters, gating, cockpit counts.)*
- **B3** — items 1.2 + 7.2: deadline column + deadline filter. Needs B1;
  rebases on B2. *(S–M)*
- **C1** — item 9: template schema + add/delete management. Independent of
  Wave 1 content, but scheduled here to keep the settings-page and
  reviewer-bandwidth load sane; can start in Wave 1 if capacity allows. *(M)*

**Wave 3:**
- **A4** — items 3 + 4.2 + 4.4: bulk Mark-as-Active, bulk Close +
  confirmations, close-reason list column. Needs A3. *(M)*
- **C2** — item 8: Send-Email wizard. Needs C1; rebases on A4's
  `BulkToolbar` changes. *(L)*

Every PR: branch off `staging`, migration ships with its code (additive only —
CI auto-applies to nonprod on merge), extend vitest suites, `npx next build`
green, PR targets `staging`.

## Decisions — all D-1..D-6 resolved by Brian, 2026-07-09

| # | Decision | Resolution |
|---|---|---|
| D-1 | Round default vs `closeDate` in the deadline fallback chain | `override ?? roundDefault ?? closeDate` (option a) |
| D-2 | Retained synopsis may contain PII in prose | Retain verbatim; warn in confirm dialog; flag to DPO |
| D-3 | Close ↔ outcome coupling | **No qualify/award concept exists** (official state map). Close is lifecycle-only; a school decline = Close with the "Declined by the school" reason (state map shows decline → close **& purge**) |
| D-4 | What does Mark-as-Active do? | School's OFFERED decision: activate account + attach round schedule via `promoteToActiveAccount` directly — **no outcome write, no email** |
| D-5 | Merge-field set for custom templates | The common six fields |
| D-6 | Bulk email roles | ADMIN-only; widen later if asked |

Still open (client, non-blocking):

| Decision | Blocks | Interim |
|---|---|---|
| Real close-reason list + per-reason purge toggles (Charlotte) | none | Seed placeholders; note the state map implies "Declined by the school" is purge-flagged |
| Upload allowlist confirmation (PDF/JPG/PNG?) | none | Matches current behaviour; no build impact expected |
| Exact list-column strings for legacy QUALIFIES/DNQ phases ("Active"/"Closed") | B2 polish only | Use state-map wording; confirm during B2 review |
