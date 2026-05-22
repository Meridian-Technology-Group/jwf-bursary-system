---
title: Dual-parent (separated/divorced) bursary application — invite a second parent to supply their own financials
status: open
severity: high
type: feature
area: invitations, portal, assessment, data-model, calculation, gdpr
opened: 2026-05-22
opened_by: Brian Wagner (via Claude)
related:
  - prisma/schema.prisma (Application, ApplicationSection, Profile, Invitation, EarnerLabel)
  - src/app/(admin)/invitations/actions.ts
  - src/app/(portal)/apply/* (section wizard + submit)
  - src/app/(admin)/applications/[id]/assessment/page.tsx
  - src/components/admin/assessment-form.tsx (PARENT_1 / PARENT_2 earners)
  - src/lib/assessment/stage1-income.ts, stage2-assets.ts
  - the applicant invitation flow spec (docs/product/specs/invitation-flow.md)
  - PRD AP-15 / amended AP-02 (docs/product/prd/03-applicant-portal.md) — this file is the canonical spec for that requirement
  - PRD OPEN_QUESTIONS Q3 (docs/product/open-questions.md) — supersedes the original single-user answer
---

## Context

The bursary subject is a **child**. When that child's parents are
**divorced or separated**, the Foundation assesses the award on **both
parents' income regardless of marital status**. But in this situation the two
parents typically **cannot supply their financial information and documents at
the same time** (different households, no shared login, often limited contact).

Today the system models a single `Application` per child per round, completed by
**one** lead applicant who enters *both* parents' figures (the assessment has
`PARENT_1` / `PARENT_2` earners and a sole-parent toggle). That breaks down for
separated parents: one parent can't realistically fill in the other's income and
upload the other's payslips/bank statements, and there's no privacy boundary
between them.

**The ask:** let staff invite a **second parent** linked to the child. One
parent is **primary** (owns the child's data, receives all communications); the
**secondary** parent logs in only to provide **their own** parent-level
information (income, assets/liabilities, supporting documents) — they must
**not** re-enter the child's details. The **assessor** must be able to see
**both parents' information and documents together** to make an accurate
judgement.

## Why it matters

- Separated/divorced parents are a common, recurring real-world case. Without
  this, those applications either can't be assessed accurately or force one
  parent to (improperly) supply the other's private financial data.
- It's a privacy issue: the current single-applicant model would expose one
  parent's financials and documents to the other.
- It directly affects award correctness (Stage 1 income / Stage 2 assets depend
  on having both parents' real figures and evidence).

## Decisions made (2026-05-22)

These were agreed when the item was opened and are the basis for the design
below:

1. **Calculation model — combine income, single household costs.** Sum both
   parents' income and assets into Stage 1 / Stage 2, but assess against **one**
   set of living costs (rent, council tax, utilities, food, dependents) — the
   child's primary residence. This is the smallest extension of today's
   `PARENT_1 + PARENT_2` Stage 1 sum. *(Two-household cost modelling is
   explicitly out of scope — see below.)*
2. **Privacy — strict separation.** The secondary parent sees **only their own
   form and the child's name** (for context). They cannot see the primary
   parent's financials, contact details, or documents — and vice versa.
3. **Secondary non-response — assessor decides per application.** Default:
   the application is **blocked** from assessment until both parts are in. The
   assessor can **override per application** to proceed on available data, which
   records a "second parent did not respond" flag + reason on the assessment.
4. **Trigger/timing — staff, any time.** An admin or assessor can add a
   secondary parent whenever the need is identified: at initial invite, after
   the primary submits, or mid-assessment.
5. **Scope — exactly two parties.** Primary + one secondary. Not a general
   N-contributor model (kept out of scope to limit complexity).
6. **Re-assessment — carry forward, staff confirm.** The link persists into
   re-assessment rounds, but staff confirm it still applies (and can remove it);
   the secondary parent is re-invited for the new round.
7. **Secondary parent's data — own income + assets/liabilities + documents.**
   Their personal financials and supporting evidence only. The primary owns the
   child, household composition, and dependents (consistent with single-
   household costs).
8. **Communications — their part only; outcome to primary.** The secondary gets
   their own invite, reminder(s), and a "your information was received"
   confirmation. The **final outcome goes to the primary parent only**.

## Proposed approach

A large, multi-PR feature. Sketch by layer:

### Data model
- New **`ApplicationContributor`** (or `application_parent`) link:
  `applicationId`, `profileId`, `role` (`PRIMARY` | `SECONDARY`), `status`
  (`INVITED` | `IN_PROGRESS` | `SUBMITTED`), `invitedById`, `invitedAt`,
  `submittedAt`. Exactly one `PRIMARY` (the existing lead applicant) and at most
  one `SECONDARY`. Enforce the "at most one secondary" rule.
- **Per-contributor section data.** The secondary's parent-level sections must
  not collide with the primary's. Either add an owning-contributor discriminator
  to the relevant `ApplicationSection` rows (and relax the
  `@@unique([applicationId, section])` constraint to include it for the parent-
  financial section types), or store the secondary's contribution in a dedicated
  shape. Sections the secondary owns: their **own parent details**,
  **parents' income** (their figures), **assets/liabilities** (theirs).
- **Documents.** `Document.uploadedBy` already records the uploader; tag the
  secondary's uploads to them so visibility can be scoped.
- The secondary parent needs their **own login** (Supabase auth user + Profile),
  de-duplicated by email if they already exist in the system.

### Invitation flow
- Staff action "Add second parent" on the application detail (available any
  time). Captures the secondary parent's email + name; creates the scoped
  `Invitation` + `ApplicationContributor(role=SECONDARY)` and sends a branded
  invite. Reuses the existing invitation/registration plumbing
  (`src/app/(admin)/invitations/actions.ts`) with a new invitation kind.

### Secondary-parent portal (restricted)
- A trimmed wizard: only **their** parent details, income, assets/liabilities,
  and document uploads. The child's identity shows **read-only, name only**.
- No navigation to the child's sections, the primary's data, or any documents
  that aren't the secondary's own.
- A submit step that flips their `ApplicationContributor.status → SUBMITTED`.

### Assessor view
- The assessment workspace surfaces **both contributors' submitted data and
  documents side by side** (primary → `PARENT_1`, secondary → `PARENT_2`), so
  the assessor judges on the full financial picture.
- A per-application **"proceed without second parent"** control (decision #3):
  sets the flag + reason and unblocks assessment when the secondary hasn't
  submitted.

### Calculation
- Map primary → `PARENT_1` earner(s), secondary → `PARENT_2` earner(s); Stage 1
  sums both (already supported). Secondary assets/liabilities feed Stage 2's
  combined net assets. **Single household costs** from the primary's household
  (Stage 3) — unchanged. Reconcile with the existing sole-parent toggle so the
  two concepts don't conflict.

### Status / completeness gating
- "Ready for assessment" = primary `SUBMITTED` **and** (secondary `SUBMITTED`
  **or** assessor override). Default blocked; assessor override per application
  (decision #3). Surface secondary status (invited / in-progress / submitted /
  did-not-respond) in the queue and on the application.

### Communications
- New email template types, e.g. `SECONDARY_PARENT_INVITE`,
  `SECONDARY_PARENT_REMINDER` (optional), `SECONDARY_PARENT_RECEIVED`. Outcome
  templates continue to address the **primary only** (decision #8).

### Re-assessment
- Carry the `ApplicationContributor` link into the new round's application;
  staff confirm/can remove it; re-invite the secondary for the new round
  (decision #6).

## Privacy & security considerations

- **RLS** must scope the secondary profile to *only* their own
  `ApplicationContributor`, their own section rows, and their own documents on
  that application — plus read-only access to the child's name. No access to the
  primary's sections, contact details, or documents (decision #2). Mirror the
  existing owner/assignee policy helpers.
- **Name reveal / data minimisation:** decide how both parents' names appear to
  the assessor (the queue hides names by default; reveal is audit-logged today).
- **GDPR right-to-erasure:** deleting the application/child must now handle
  **two** profiles + auth users and both parents' documents. Extend the existing
  cascade (`gdprDeleteApplicantAction`).

## Open questions (to resolve before/while building)

- **Identity matching:** if the invited secondary email already has an account
  (e.g. they're a lead applicant for another child), how do we link rather than
  duplicate?
- **Joint assets / double counting:** if both parents declare a jointly-owned
  asset, how is Stage 2 prevented from counting it twice? (Foundation policy.)
- **Inter-parent maintenance:** are child-maintenance transfers between the two
  parents captured anywhere, or deliberately ignored under the combined-income
  model? (Foundation policy — see Out of scope.)
- **Sole-parent toggle interaction:** exact reconciliation between the existing
  assessment sole-parent toggle and the new dual-parent-separated state.
- **Disputes:** what happens if the secondary disputes figures or claims to be
  the primary? (Assume staff-mediated, out of band.)
- **Exports/reports:** how the secondary parent is represented (names hidden by
  default).
- **Reminder cadence** for a non-responding secondary parent.

## Out of scope (explicit)

- **More than two contributors** (step-parents, multiple guardians) — decision #5.
- **Two-household cost modelling** — decision #1 fixes single-household costs;
  modelling each parent's separate rent/council-tax/dependents is a larger,
  separate piece if the Foundation ever wants it.
- **Inter-parent maintenance modelling** in the calculation (flag for Foundation
  policy; not built unless decided).

## Effort

**Large (L), multi-PR.** Schema migration + new contributor model + RLS;
invitation-flow extension; a scoped second-parent portal; assessor dual-view;
calculation mapping; 2–3 new email templates; re-assessment carry-forward; GDPR
cascade update. Sequence the data model + invite + secondary portal first, then
the assessor view + gating, then comms + re-assessment.
