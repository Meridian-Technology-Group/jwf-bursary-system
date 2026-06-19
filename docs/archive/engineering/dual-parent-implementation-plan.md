# Dual-Parent (Separated / Divorced) — Implementation Plan

> **CLOSED / ARCHIVED 2026-05-25.** All six PRs shipped to production in v1.3.0
> (2026-05-25); the `/contribute` sidebar follow-up shipped in v1.3.1. The
> backlog file is archived at
> `docs/archive/backlog/dual-parent-separated-bursary-application.md`. Retained
> for the code-grounded findings and PR sequencing as historical reference.
> Deferred calc work (joint-asset double-counting, inter-parent maintenance)
> remains pending Foundation rules — fields are carried, logic is not built.

> Build-ready engineering plan for the backlog epic
> [`dual-parent-separated-bursary-application`](../backlog/dual-parent-separated-bursary-application.md)
> (#20). Authored 2026-05-24. The backlog file remains the source of truth for
> scope, rationale, and the eight decisions locked on 2026-05-22; this document
> sequences the build into shippable PRs and records the code-grounded findings
> that shape it.

## TL;DR

Let staff invite a **second parent** to a child's application so each separated
parent supplies **their own** financials and documents through their own login,
with **strict privacy** between them, while the assessor sees **both** together.
Combine income + assets into the existing Stage 1 / Stage 2 sum; assess against a
**single** set of household costs (the child's primary residence).

Six PRs, foundation-first. The risky piece is **RLS**, not the calculation.

---

## Code-grounded findings (why the plan is shaped this way)

Three realities from reading the current implementation reshape the spec's
effort estimate:

1. **The crux is RLS, not the calculation.** The authorization model
   (`prisma/migrations/20260513090020_enable_row_level_security`) hinges on two
   columns on `applications`: `lead_applicant_id` and `assigned_to_id`. Section
   and document access delegate to `has_application_access(application_id)` —
   **all-or-nothing per application**. There is no per-section or per-uploader
   scoping today. The secondary parent is a *third access vector* that must see
   **less** than full application access (decision #2). So the secondary cannot
   reuse `has_application_access`; they need new contributor-scoped helpers and
   policies keyed off an owning-contributor discriminator and
   `documents.uploaded_by`. This is the largest, riskiest change and it touches
   the security foundation.

2. **The calculation barely changes — earner entry is manual.** In
   `src/components/admin/assessment-form.tsx` the assessor *manually keys*
   `PARENT_1` / `PARENT_2` figures into `AssessmentEarner` rows. The applicant's
   `PARENTS_INCOME` JSONB is **not** auto-mapped to earners —
   `src/lib/portal/section-gaps.ts` only reads it for document-completeness
   checks. `calculateHouseholdIncome` (Stage 1) already sums all earners, and
   `calculateNetAssets` (Stage 2) already folds in combined assets. So
   "map primary → PARENT_1, secondary → PARENT_2" is an **assessor-UI task**
   (present both contributors' submitted JSONB side-by-side while the assessor
   keys earners), **not** a data pipeline. The calc engine is essentially
   untouched.

3. **The single-section unique constraint blocks the secondary's data.**
   `ApplicationSection` has `@@unique([applicationId, section])` — exactly one
   `PARENT_DETAILS` / `PARENTS_INCOME` / `ASSETS_LIABILITIES` row per
   application. The secondary needs their own copies, so we add an
   owning-contributor discriminator and relax the constraint, then teach every
   section query (which currently assumes one row per section) to filter by
   contributor.

Other grounded facts folded into the plan:

- The **sole-parent** flag lives in `PARENT_DETAILS` JSONB (`isSoleParent`) and
  gates parent-2 document requirements in `section-gaps.ts`. Dual-parent-
  separated is a *distinct* state (two parents who do **not** share a household)
  and must be reconciled with it.
- **Secondary login** reuses the `createInvitationAction` pattern verbatim
  (`src/app/(admin)/invitations/actions.ts`): create the Supabase auth user
  up front with `email_confirm: true`, do Profile + Invitation + audit in one
  `withAdminContext` tx, hard-roll-back the auth user on any failure. But the
  `Invitation` model today has **no** application link and no "kind"
  discriminator.
- The **GDPR cascade** (`gdprDeleteApplicantAction` in
  `src/app/(admin)/applications/[id]/actions.ts`) is hardwired to a single
  `leadApplicantId`. It must grow to a second profile + auth user + their
  documents + their section rows.
- **Storage RLS** namespaces objects by `{applicationId}/{slot}/...` (first path
  segment = applicationId). Secondary documents under the same prefix would be
  exposed by the current `documents bucket` policies; they need either a
  sub-namespace (`{applicationId}/secondary/...`) or an `uploaded_by` check.

---

## Foundation-policy gaps — treatment: carry fields, defer logic

Three of the spec's open questions gate correctness and require Foundation
input. Per the agreed approach (2026-05-24), the build **carries the data model
to hold these now but defers the calculation/gating logic** until the Foundation
rules. Only the third blocks a specific PR.

| Question | Treatment | Gates |
|---|---|---|
| **Joint-asset double-counting** — both parents declare the same jointly-owned asset | Add a nullable "shared/jointly-owned" marker on the secondary's assets section now; do not change Stage 2 maths until ruled | A later calc PR (not PR 1–6 core) |
| **Inter-parent maintenance** — child-maintenance transfers between parents | Spec leans "ignored under combined income"; carry a free-text/optional field, no calc change | A later calc PR |
| **Sole-parent ↔ dual-parent-separated reconciliation** — exact rule when both could apply | Must be resolved before gating logic | **PR 5** |

---

## PR sequence (foundation-first, each shippable to `staging`)

### PR 1 — Data model + contributor foundation (schema only, no UI)

- **`ApplicationContributor`** model: `applicationId`, `profileId`, `role`
  (`PRIMARY | SECONDARY`), `status` (`INVITED | IN_PROGRESS | SUBMITTED`),
  `invitedById`, `invitedAt`, `submittedAt`, timestamps. Partial unique indexes
  enforcing **at most one** `PRIMARY` and **at most one** `SECONDARY` per
  application.
- **Backfill migration**: create a `PRIMARY` contributor for every existing
  application from its `leadApplicantId`, so all downstream queries can assume a
  contributor row exists.
- **`ApplicationSection.ownerContributorId`** (nullable FK). Relax
  `@@unique([applicationId, section])` →
  `@@unique([applicationId, section, ownerContributorId])`. Backfill existing
  rows to the primary contributor.
- New enums `ApplicationContributorRole`, `ApplicationContributorStatus`.
- New `EmailTemplateType` values: `SECONDARY_PARENT_INVITE`,
  `SECONDARY_PARENT_RECEIVED` (+ optional `SECONDARY_PARENT_REMINDER`), seeded
  via a `*_seed_email_templates` migration — **not** `seed-reference.ts`
  (per `CLAUDE.md`, templates are migration-seeded, single source of truth).
- Carry the deferred-policy fields (joint-asset marker, maintenance field) on
  the relevant section shapes — unused for now.
- **No behaviour change. Ships green.**

### PR 2 — RLS for contributors (the hard one, no UI)

- New SECURITY DEFINER helpers mirroring the existing style:
  `is_secondary_contributor(app_id)`, `contributor_owns_section(section_id)`,
  and a narrow read path for the child's **name only**.
- New policies: a secondary contributor may `SELECT/INSERT/UPDATE` **only**
  `application_sections` where `owner_contributor_id` = their contributor row,
  and **only** `documents` where `uploaded_by` = their profile. **No** access to
  the primary's sections, contacts, or documents — and vice versa.
- **Storage RLS**: scope secondary uploads. Decide and document the path
  convention (recommended: `{applicationId}/secondary/{slot}/...`, or add an
  `uploaded_by = auth.uid()` branch to the `documents bucket` policies).
- Extend `has_application_access` so assessor/admin/viewer keep full visibility
  while the secondary's grant never widens to full application access.
- **Heavy test coverage**: RLS tests proving the secondary cannot read the
  primary's rows and vice-versa. **Run `/security-review` on this PR.**

### PR 3 — Invitation flow ("Add second parent")

- Extend `Invitation` with an `applicationId` link + a kind discriminator
  (or a dedicated secondary path).
- `addSecondParentAction` on the application-detail page, available **any time**
  (decision #4), reusing the `createInvitationAction` auth-user-up-front +
  full-rollback pattern. **De-dupe by email** if the profile already exists
  (open question: identity matching — link, don't duplicate).
- Creates `ApplicationContributor(SECONDARY, INVITED)` + the scoped invitation;
  sends `SECONDARY_PARENT_INVITE`.
- Token/registration acceptance flips the contributor → `IN_PROGRESS` and routes
  the secondary into the restricted portal.

### PR 4 — Restricted secondary-parent portal

- A trimmed wizard variant: only the secondary's `PARENT_DETAILS` (their own),
  `PARENTS_INCOME` (their figures), `ASSETS_LIABILITIES` (theirs), and document
  uploads — writing to **their** `ownerContributorId` section rows. The child
  shows **read-only, name only**. No navigation to the child's sections, the
  primary's data, or any non-own documents.
- Extend the section action layer (`src/app/(portal)/apply/actions.ts`): resolve
  the **owning contributor** from the session instead of assuming
  `leadApplicantId`. The IDOR-hardening pattern (`getOwnedApplicationContext`,
  finding 2.3) extends to "the contributor row I own."
- Submit step flips the contributor → `SUBMITTED`, sends
  `SECONDARY_PARENT_RECEIVED`.

### PR 5 — Assessor dual-view + completeness gating

- Assessment workspace surfaces **both contributors' submitted sections and
  documents side-by-side** (primary as Parent 1, secondary as Parent 2) so the
  assessor reads the full picture while keying earners. **No calc-engine
  change.**
- "Ready for assessment" gate: primary `SUBMITTED` **and** (secondary
  `SUBMITTED` **or** assessor override). Default **blocked**; per-application
  **"proceed without second parent"** control writing a flag + reason onto the
  assessment (decision #3). Surface secondary status (invited / in-progress /
  submitted / did-not-respond) in the queue and on the application.
- **Resolve the sole-parent ↔ dual-parent-separated reconciliation here**
  (needs the Foundation decision above).

### PR 6 — GDPR cascade + re-assessment carry-forward

- Extend `gdprDeleteApplicantAction` to cascade the **secondary** profile, their
  Supabase auth user, their `ownerContributorId` section rows, and their
  documents (DB + Storage), alongside the primary.
- Carry the `ApplicationContributor` link into re-assessment applications
  (decision #6): staff confirm it still applies (and can remove it); the
  secondary is re-invited for the new round. Extend
  `createReassessmentApplicationAction` + `prepopulateReassessment`.

---

## Cross-cutting (every PR)

- Audit-log all new actions via `AUDIT_ACTIONS` / `AUDIT_ENTITY_TYPES`.
- **Outcome emails remain primary-only** (decision #8).
- Name-reveal audit-logging extends to **both** parents (the queue hides names
  by default; reveal is audit-logged today).
- Follow the mandatory git workflow: branch off `staging`, one migration per PR
  shipping with the code that needs it, PR to `staging`, user promotes to `main`.

## Explicitly out of scope (spec)

- More than two contributors (step-parents, multiple guardians) — decision #5.
- Two-household cost modelling — decision #1 fixes single-household costs.
- Inter-parent maintenance modelling in the calculation — flagged for Foundation
  policy; field carried, logic not built.

## Sequencing summary

PR 1 + 2 are the foundation and must land before any user-facing entry point.
PR 3 + 4 deliver the secondary parent's path. PR 5 makes the application
assessable. PR 6 closes GDPR and re-assessment. Joint-asset dedupe and
maintenance modelling remain deferred calc work pending Foundation rules.
