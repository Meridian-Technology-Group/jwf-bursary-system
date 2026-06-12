# CR-001 Assessor Edit-on-Behalf — Implementation Plan

> Status: **Ready to execute — gated on Customer approval of
> [CR-001](../contract/change-requests/CR-001-assessor-edit-on-behalf.md)**
> (no work before written approval, MSA clause 9.5(c)).
> Authored 2026-06-12. Code anchors verified against
> `feature/missing-documents-workflow`; build branches off `staging` **after**
> that branch merges (shared status model + admin actions file).

## Context

CR-001 reverses an accepted design decision — the application form is read-only
to everyone after submission (PRD AP-10 / AC-04) — by giving an **ADMIN or
assigned ASSESSOR** a scoped, audited path to enter or amend an applicant's
ten-section form on the applicant's behalf (postal/telephone arrivals,
applicants who cannot complete the Portal unaided). It is **scoped
edit-on-behalf, not session impersonation**: the assessor stays logged in as
themselves, every save is attributed to them, and assessor-entered data is
visually distinguished — mirroring the accepted "uploaded by assessor"
document indicator (FVC §14).

Decision taken 2026-06-12 (Brian): **submit-on-behalf is in scope.** The CR's
acceptance criteria as drafted only cover editing already-submitted
applications, but its own rationale (postal/telephone intake) is unreachable
without a staff path to `SUBMITTED` — `submitApplication` is
applicant-session-bound, so a paper application typed in by an assessor would
strand at `FILLED_IN` and assessment could never begin. ⚠️ **The CR text
(§4.1 and §5) should be amended to mention submit-on-behalf before the
Customer signs** — see [Open items](#open-items).

## TL;DR

- New admin route **`/applications/[id]/edit/[section]`** renders the
  **existing ten portal section forms unchanged** (same components, same Zod
  schemas) with one injected difference: saves go through a new staff server
  action `saveSectionOnBehalf()` instead of the applicant's `saveSection()`.
- Every staff save deep-diffs old vs new section JSONB and merges the changed
  field paths into a new additive **`application_sections.assessor_provenance`**
  JSONB column, plus a **`SECTION_SAVED_BY_ASSESSOR`** audit row carrying the
  changed-field list.
- Admin Applicant Data tab gains per-field **"Entered by assessor"** badges;
  edit mode shows a **persistent on-behalf banner** with a **"Finish editing"**
  CTA that sends exactly one summary email (`APPLICATION_EDITED_ON_BEHALF`
  template — its `enabled` flag is the D-CR1-1 kill-switch).
- **Submit-on-behalf** (`FILLED_IN`-gated button) completes the postal/phone
  flow, audited as `APPLICATION_SUBMITTED_BY_ASSESSOR`.
- Form stays **read-only to the applicant** (no change needed — the portal
  guards are untouched). **VIEWER is locked out** at route, action, and RLS
  layers — the RLS layer is already correct today, so **no RLS migration**.
- Three PRs: A (core edit path, ~60%), B (provenance display + notification +
  submit-on-behalf), C (guide + walkthrough + FVC §33).

## Locked decisions

1. **Scoped edit-on-behalf, not session impersonation** (CR §3). The assessor
   acts as themselves; attribution is the point.
2. **Form reuse via injected save action.** The 10 section forms
   (`src/components/portal/sections/*-form.tsx`) are pure field renderers; the
   only save coupling is `src/app/(portal)/apply/[section]/section-page-client.tsx:26,310,319`
   (static import of `saveSection` + auto-`submitApplication` on DECLARATION).
   `SectionPageClient` gains optional `saveOverride?` and `onBehalf?` props;
   `onBehalf` suppresses the DECLARATION auto-submit. The ~100-line cross-section
   data assembly in `src/app/(portal)/apply/[section]/page.tsx:162-266`
   (existing data, documentMap, child name, employment statuses, …) is
   extracted into a shared loader `src/lib/portal/section-page-data.ts` used by
   both the portal page and the admin edit page. *Rejected:* duplicating the
   forms into admin components — double maintenance of 10 forms + schema drift,
   and the CR text mandates reuse.
3. **Provenance = additive JSONB column**, not a new table and not
   audit-derived rendering. `application_sections.assessor_provenance` is a
   flat dot-path map:
   `{ "parent1Income.salary": { "editedBy": "<uuid>", "editedByName": "Jane Assessor", "editedAt": "…" } }`,
   computed by a pure `diffSectionPaths(oldData, newData)` util
   (`src/lib/applications/section-diff.ts`) and **merged** on each staff save.
   The portal `saveSection` clears provenance entries for paths the
   **applicant** re-edits pre-submission (post-submission the applicant cannot
   save, so the main CR path never runs this). *Rejected:* separate
   provenance table (new table + RLS + join for a render-only concern — too
   heavy for the fixed-price envelope); deriving badges from audit logs (the
   audit trail is the legal record, not a query surface).
4. **Status interactions — defined rules** (CR §4.1(e)):

   | Situation | Rule | Mechanism |
   |---|---|---|
   | `formStatus = SUBMITTED` | Stays `SUBMITTED`, always | `refreshFormStatus` is already terminal-safe (`src/lib/applications/status.ts:282-283`); call unconditionally |
   | Pre-submission | Staff saves drive normal derivation (`NOT_STARTED → IN_PROGRESS → FILLED_IN`) | same `refreshFormStatus` call as the applicant path |
   | Assessment `PAUSED` (missing docs) | Editing allowed; **no auto-resume** — the pause carries an emailed deadline contract; resuming stays the explicit `resumeApplication` action. Banner shows the paused deadline. | phase gate allows `PAUSED`; no status write |
   | Assessment `COMPLETED` / outcome set | **Blocked** (ADMIN and ASSESSOR alike) — editing source data after completion would silently desynchronise the assessment's figures from the form | `deriveReviewPhase()` gate in the edit layout, re-checked inside the action transaction. Allowed phases: `PRE_SUBMISSION`, `SUBMITTED`, `NOT_STARTED`, `PAUSED` |

5. **Submit-on-behalf in scope.** "Submit on behalf of applicant" button on the
   edit screen, visible only at `formStatus = FILLED_IN`, calling
   `submitApplicationOnBehalf(applicationId)` — same completeness gate and
   `SUBMITTED` transition as the applicant path (refactor the gate + transition
   core out of `submitApplication`, `src/app/(portal)/apply/actions.ts:343`),
   audited `APPLICATION_SUBMITTED_BY_ASSESSOR`, sending the normal
   `CONFIRMATION` email. The DECLARATION schema's existing
   `signedOnBehalfOfParent1/2` fields already record "signed on behalf of" —
   no e-signature scope creep (still out of scope per CR §4.2).
6. **Notification (D-CR1-1) — build option (b), decision becomes
   configuration.** One summary email sent on the explicit **"Finish editing"**
   CTA (`finishEditingOnBehalf`), with the section list derived from stored
   provenance (idempotent, no client-tracked state), audited
   `EDIT_ON_BEHALF_FINISHED` with `{ sections, emailSent, emailMessageId }`,
   non-blocking send in the `pauseApplication` style
   (`src/app/(admin)/applications/[id]/actions.ts:277-296`). If the Customer
   chooses (a) silent, ship identical code with the template **disabled** —
   `sendEmail` already skips disabled templates (`src/lib/email/send.ts:85`)
   and the admin Settings UI already has the toggle. *Rejected:* per-save
   emails (up to 10 per pass) and digests (needs cron + state). Known
   limitation: an assessor who navigates away without clicking Finish sends no
   email — the audit trail still records every save; the guide instructs
   assessors to finish explicitly.
7. **Visual flagging is admin-side only in v1**, matching the accepted
   document-indicator precedent: purple per-field pills + a per-card summary
   chip ("3 fields entered by assessor") in `ApplicantDataPage`'s `DataBlock`
   (`src/app/(admin)/applications/[id]/page.tsx:154`), and the persistent
   banner in edit mode. The applicant portal shows no flags; the applicant's
   transparency mechanism is the D-CR1-1 email. Stated explicitly so it is
   signed off, not discovered.
8. **Dual-parent scope: v1 edits the PRIMARY contributor's section rows only**
   (resolved via `resolveOwningContributorId`). A SECONDARY parent's own copies
   of PARENT_DETAILS / PARENTS_INCOME / ASSETS_LIABILITIES are not exposed in
   edit mode (RLS would allow it; the UI doesn't offer it). Small follow-up CR
   if ever needed. Stated in the guide and FVC.
9. **Enforcement layers** (CR §4.1(c)): route
   (`requireRole([Role.ADMIN, Role.ASSESSOR])` + `requireApplicationAccess`,
   `src/lib/auth/roles.ts:165-188`); action (same guards inside every new
   server action, all DB work under `withUserContext` — never
   `withAdminContext` — so RLS actually bites); RLS (already correct, below).

## Code-grounded findings

- **No RLS migration needed.** The current policy `application_sections_access`
  (`prisma/migrations/20260524211000_dual_parent_contributor_rls/migration.sql:99-130`,
  `FOR ALL`) has `WITH CHECK = is_admin() OR is_assigned_assessor(application_id) OR (owner branches)`.
  ADMIN and the **assigned** ASSESSOR can INSERT and UPDATE section rows;
  VIEWER cannot write (only reads via `USING`'s `is_admin_or_viewer()`).
  `applications_update` covers `refreshFormStatus`'s write for assigned
  assessors; `application_contributors_select` lets staff resolve the PRIMARY
  contributor. (Side observation, not CR scope: `USING` technically leaves
  DELETE open to VIEWER at the RLS layer; no app path exercises it — note in
  the PR, fix separately if desired.)
- **Read-only-after-submission is app-layer only**: portal page guard
  (`src/app/(portal)/apply/[section]/page.tsx:100-102` redirects to
  `/submitted`) and `getOwnedApplicationId`
  (`src/app/(portal)/apply/actions.ts:107-111` returns only non-`SUBMITTED`
  apps). Neither is touched — the applicant remains read-only by construction.
- **Uploads inside edit mode need a different endpoint.** The portal
  `FileUpload` (`src/components/portal/file-upload.tsx:139,155,165`) hardcodes
  `/api/documents`, whose POST 409s `SUBMITTED` apps and 403s non-contributors.
  The staff route `POST /api/admin/documents` already exists with the
  `DOCUMENT_UPLOADED_BY_ASSESSOR` audit and no SUBMITTED guard — but
  `src/app/api/admin/documents/route.ts:35` currently rejects everyone except
  `Role.ASSESSOR`, i.e. it 403s ADMIN. Relax to ADMIN + ASSESSOR (it already
  calls `requireApplicationAccess`). A small `UploadEndpointProvider` context
  (default `/api/documents`) lets the admin edit layout point `FileUpload` at
  the staff route. Verify during build that the staff path can also DELETE a
  document and fetch signed URLs (the URL route already allows
  ADMIN/VIEWER/assigned assessor, `src/app/api/documents/[id]/url/route.ts:83`).
- **No per-field provenance exists today.** The precedent is
  `Document.uploadedBy` + `DOCUMENT_UPLOADED_BY_ASSESSOR` + the admin-side
  indicator (FVC §14).
- **Email templates are seeded only via migrations** — new template = enum
  migration + idempotent seed migration, the exact two-migration pattern used
  on the missing-docs branch (`20260611120000` / `20260611120100`).
- **Tests**: vitest (~626 green on the missing-docs branch), boundary-mock
  pattern per
  `src/app/(admin)/applications/[id]/__tests__/schedule-actions.test.ts`
  (mock `@/lib/auth/roles`, fake-tx `@/lib/db/prisma`, `@/lib/audit/log`,
  `next/cache`; no jsdom/RTL).

## Implementation — PR sequence

Branch **`feature/cr-001-edit-on-behalf`** off `staging`, **after
`feature/missing-documents-workflow` merges**. Conventional commits; each
migration ships in the same PR as its code; additive migrations only.

### PR A — edit-on-behalf core (size M, ~60% of the work)

- [ ] Migration `add_section_assessor_provenance`:
  `ALTER TABLE public.application_sections ADD COLUMN assessor_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;`
  + Prisma field `assessorProvenance Json @default("{}") @map("assessor_provenance")`
  on `ApplicationSection`.
- [ ] `src/lib/applications/section-diff.ts` — pure `diffSectionPaths(oldData, newData): string[]`
  (leaf-level deep diff; arrays element-wise by index).
- [ ] Audit vocabulary (`src/lib/audit/actions.ts`):
  `AUDIT_ACTIONS.SECTION_SAVED_BY_ASSESSOR`,
  `AUDIT_ENTITY_TYPES.ApplicationSection` (entityId = section row id),
  purple in the colour map; history label in
  `src/app/(admin)/applications/[id]/history/page.tsx`.
- [ ] `saveSectionOnBehalf` in `src/app/(admin)/applications/[id]/edit/actions.ts`:
  guards → validate via `sectionSchemaMap` → phase gate re-check → diff →
  `upsertSection` (extended in `src/lib/db/queries/applications.ts:553` with an
  optional `assessorProvenance` param; existing callers unchanged) →
  `refreshFormStatus` → audit (metadata:
  `{ applicationId, reference, section, changedFields, formStatus, reviewPhase }`)
  → `revalidatePath`.
- [ ] Shared loader extraction `src/lib/portal/section-page-data.ts`; portal
  page refactored onto it (behaviour-neutral — portal keeps its own guards).
- [ ] `SectionPageClient`: `saveOverride?` / `onBehalf?` props (server action
  passed as a prop from the admin server component).
- [ ] `UploadEndpointProvider` context + `/api/admin/documents` ADMIN
  relaxation; verify staff document DELETE path.
- [ ] Edit route trio under the admin detail layout:
  `edit/layout.tsx` (guards + phase gate + persistent on-behalf banner +
  section nav reusing `SECTION_ORDER`/`SECTION_TO_SLUG` from
  `src/lib/portal/sections.ts`, honouring the rolling-over FAMILY_ID hide),
  `edit/page.tsx` (redirect to first section), `edit/[section]/page.tsx`
  (shared loader scoped to the PRIMARY contributor → `SectionPageClient`).
- [ ] "Edit on behalf" **button** on the Applicant Data tab header
  (`src/app/(admin)/applications/[id]/page.tsx`), shown only in editable
  phases. A button, not a new tab — the tab strip is shared with VIEWER.
- [ ] Tests: diff util (nested / array / cleared-field cases); action —
  VIEWER blocked, unassigned assessor blocked, COMPLETED/outcome phase
  blocked, invalid payload returns schema errors, `SUBMITTED` stays
  `SUBMITTED`, provenance merged not replaced, audit row carries
  `changedFields`; loader parity with the old inline assembly.

### PR B — provenance display, notification, submit-on-behalf (size S/M)

- [ ] Migrations `edited_on_behalf_email_enum`
  (`ALTER TYPE "EmailTemplateType" ADD VALUE 'APPLICATION_EDITED_ON_BEHALF';`)
  + idempotent `seed_edited_on_behalf_template` (merge fields:
  `applicant_name`, `child_name`, `reference`, `edited_sections` (bullet list
  of section titles), `edited_date`).
- [ ] `finishEditingOnBehalf(applicationId)` + "Finish editing" CTA in the
  banner: derive edited-section list from stored provenance, send one email,
  audit `EDIT_ON_BEHALF_FINISHED` with `{ sections, emailSent, emailMessageId }`;
  no-op (no email, no audit noise) when no provenance exists.
- [ ] Per-field "Entered by assessor" pills + per-card summary chips in the
  Applicant Data tab (`DataBlock` gains a provenance map + path prefix;
  provenance threaded through `getApplicationWithDetails`).
- [ ] Portal `saveSection` provenance-clearing for applicant-re-edited paths
  (pre-submission only, by construction).
- [ ] `submitApplicationOnBehalf` + `AUDIT_ACTIONS.APPLICATION_SUBMITTED_BY_ASSESSOR`
  + `FILLED_IN`-gated "Submit on behalf of applicant" button; sends the normal
  `CONFIRMATION` email.
- [ ] Tests: finish action (provenance-derived section list in merge data,
  `emailSent` metadata, disabled-template path, no-provenance no-op);
  clearing on applicant save; submit-on-behalf gates (completeness, role,
  idempotence).

### PR C — docs, FVC, polish (size S)

- [ ] `docs/guides/admin-assessor-guide.md` — new section "Editing an
  application on the applicant's behalf": when to use it, how to enter edit
  mode, validation parity, provenance badges, audit, Finish-editing email,
  submit-on-behalf, PRIMARY-only scope, blocked-after-completion rule.
- [ ] New walkthrough
  `docs/guides/walkthroughs/assessors/38-edit-application-on-behalf.md`
  (37 is the current highest).
- [ ] **FVC §33 — "Assessor edit-on-behalf (CR-001)"** in
  `docs/contract/feature-verification-checklist.md` (32 sections today),
  transcribing CR §5's acceptance criteria + submit-on-behalf as checkable
  steps.
- [ ] Any copy/polish from staging review.

## Critical files

| File | Change |
|---|---|
| `src/app/(portal)/apply/[section]/section-page-client.tsx` | the single save-coupling point; gains `saveOverride` / `onBehalf` |
| `src/app/(portal)/apply/[section]/page.tsx` | data assembly extracted to shared loader |
| `src/lib/portal/section-page-data.ts` | **new** shared loader |
| `src/lib/applications/section-diff.ts` | **new** diff util |
| `src/app/(admin)/applications/[id]/edit/` | **new** route trio + `actions.ts` |
| `src/lib/db/queries/applications.ts` | `upsertSection` provenance param; `getApplicationWithDetails` select |
| `src/app/(admin)/applications/[id]/page.tsx` | entry button + per-field badges in `DataBlock` |
| `src/lib/audit/actions.ts` | new actions/entity/colours |
| `src/app/api/admin/documents/route.ts` | allow ADMIN as well as ASSESSOR |
| `src/components/portal/file-upload.tsx` (+ new context) | configurable upload endpoint |
| `src/app/(portal)/apply/actions.ts` | provenance-clearing in `saveSection`; submission core refactor |
| `prisma/schema.prisma` + 3 migrations | provenance column; email enum + seed |

## End-to-end verification (staging, maps to CR §5)

1. [ ] As an **assigned ASSESSOR**: open a submitted application → "Edit on
   behalf" → amend a field in each of 3 sections (incl. one upload) —
   validation parity with the portal; saves succeed; `formStatus` stays
   `SUBMITTED`.
2. [ ] As the **applicant**: form still read-only (`/apply/*` redirects to
   `/submitted`); the assessor's changes appear in the read-only view.
3. [ ] As **VIEWER**: no Edit button; direct URL to
   `/applications/{id}/edit/...` redirects; the server action is denied.
4. [ ] As an **unassigned ASSESSOR**: redirected by `requireApplicationAccess`
   (RLS backstop behind it).
5. [ ] Applicant Data tab shows per-field badges + summary chips; History
   shows `SECTION_SAVED_BY_ASSESSOR` rows attributed and timestamped.
6. [ ] **Paused** application: editable, banner shows the paused deadline,
   assessment stays `PAUSED`. **Completed/outcome** application: edit blocked.
7. [ ] "Finish editing" → exactly one email listing the edited sections;
   disable the template in Settings → no email, audit records
   `emailSent: false`.
8. [ ] Postal flow: assessor enters all sections of a fresh application →
   `FILLED_IN` → "Submit on behalf" → `SUBMITTED`, confirmation email,
   `APPLICATION_SUBMITTED_BY_ASSESSOR` audit row.

## Open items

- **D-CR1-1 (Customer)** — notify applicant on assessor edit, (a) silent vs
  (b) email. Code is identical either way; (a) = ship with the template
  disabled. Supplier recommendation remains (b).
- **CR text amendment (Brian, before signature)** — add submit-on-behalf to
  CR §4.1 and §5 (it is currently implied by §2's rationale but absent from
  the acceptance criteria).
- **CR §7 timeline `[X]` Business Days** — fill in once the
  missing-documents-workflow merge date is known; this plan's estimate:
  PR A ≈ 2 days, PR B ≈ 1 day, PR C ≈ ½ day of effort on the normal
  maintenance cadence.

## Branching / workflow

Per `CLAUDE.md`: branch `feature/cr-001-edit-on-behalf` off `staging` (after
the missing-docs branch merges), conventional commits, PRs target `staging`,
Brian merges; acceptance on staging per CR §5/§7 before any production
promotion (Brian's call).
