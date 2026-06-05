---
title: Lead-applicant contacts & invitations — the contact register and locked invite
status: planned
severity: high
area: invitations, admin, schema
wave: 1
depends_on: [01]
blocks: [02]
related:
  - 00-current-state-map.md
  - 01-status-and-workflow-model.md
  - 03-round-management.md
  - prisma/schema.prisma
sources:
  - ../source-materials/meeting-findings.md   # "Parent invitation + setup logic"; "Rework invitation/admin data model around a lead applicant contact database"
  - ../source-materials/feedback.md           # canonical "Created" status = "the assessor has entered the contact details of the selected family and has sent them an invitation"
---

# 04 — Lead-applicant contacts & invitations

**Objective.** Introduce an admin-managed **lead-applicant contact register** —
a first-class record of a family (parent details, address, child, school,
entry/applying year) that exists *independently of any application* — and make
"send an invitation" an action *from* a contact that uses its stored data. At
invite time the **school and entry-year become required and LOCKED** (the parent
never picks or edits them). Sharpen the already-separate parent-vs-staff invite
UX, enforce required surname/child/school, and make the data model carry **one
account per child — including twins** — by keying on `childName + childDob`
rather than name alone.

---

## 1. Background & rationale

[`feedback.md`](../source-materials/feedback.md) defines the very first
application-form status as **"Created** — the assessor has entered the contact
details of the selected family and has sent them an invitation/link to apply."
That single sentence encodes a process the build does not model: the Foundation
**curates a list of families first**, then invites them. The contact record is
the unit of work that precedes the application, not a by-product of it.

[`meeting-findings.md`](../source-materials/meeting-findings.md) is explicit
across two sections:

- *Admin / round management changes* — "Rework invitation/admin data model
  around a **lead applicant contact database**, not just ad hoc invites"; "Add
  admin-managed **contact records** holding parent details, address, child,
  school, year, etc."; "Add action from contact record to **send invitation**
  using the stored lead-applicant data."
- *Parent invitation + setup logic* — "Move **school selection** to admin
  invitation/setup stage; do not let parent choose it"; "Move **entry year /
  applying year** selection to admin invitation/setup stage"; "Ensure the parent
  cannot edit **school** or **entry year** once invited"; "Support **one account
  per child** for nominative applications, including twins."

The *Bugs* list adds two near-term asks that live in this epic's UI surface:
"Fix **invitation UX clarity** so it is obvious whether you are sending a parent
invite vs staff/assessor invite" and "Enforce **required surname / child /
school fields** … during invitation setup. Missing/partial invite data slipped
through."

These are one coherent change: the system currently treats an invitation as a
**transient token** that may or may not carry family data, and lets the parent
supply the authoritative school/year later. The Foundation's process is the
inverse — the family's identity, school and year are **known and fixed by an
administrator up front**, and the invitation merely delivers a link to that
pre-set application. Modelling the contact register makes "Created" real and
removes the parent-side school/year pickers that Epic 02 wants gone.

---

## 2. Current state

See [00 §A](00-current-state-map.md#a-data-model--enums-prismaschemaprisma) and
[00 §D](00-current-state-map.md#d-rounds--invitations). In brief:

- **No contact entity exists.** The lead applicant *is* a `Profile`
  (`prisma/schema.prisma:13`, `role` defaults to `APPLICANT`). Parent, child,
  address and financial details live inside `ApplicationSection.data` JSONB
  (`schema.prisma:131`) or are denormalised onto `Application`
  (`school`/`childName`/`childDob`/`entryYear`, `schema.prisma:86-90`) and
  `BursaryAccount` (`schema.prisma:54`). There is no record of a family that
  outlives or precedes an application.
- **`Invitation` is a transient token, not a register.** `Invitation`
  (`schema.prisma:411`) carries ad-hoc `firstName`/`lastName`/`childName` and a
  nullable `school?` (`:414-417`), plus a unique `token`, `status` and
  `expiresAt`. It is created, accepted, then inert — it is not the thing an
  administrator browses, edits, or re-invites from.
- **Invite fields are optional.** `InvitationSchema`
  (`src/app/(admin)/invitations/actions.ts:54`) requires only `email` +
  `roundId`; `firstName`, `lastName`, `childName`, `school` are all
  `.optional()`. The client form schema in `send-invitation-form.tsx:53`
  mirrors this (school defaults to a `"__none__"` sentinel, `:87`). So a parent
  invite with no name, no child and no school passes validation today —
  precisely the "partial invite data slipped through" defect.
- **School is NOT locked; entry-year is never captured at invite.** When `school`
  is omitted from the invite, the parent picks it: on first-year onboarding via
  `startApplicationAction` (`src/app/(portal)/actions.ts:82`, persisted at
  `:138-148`) or during registration in `register/actions.ts:307-332`. Entry
  *calendar* year is **derived at submit** from `round.academicYear.slice(0,4)`
  and entry *year-group* is copied out of the `CHILD_DETAILS` section JSONB —
  both in `src/app/(portal)/apply/actions.ts:444-450`, never set by an admin.
- **Parent vs staff are already two models / two pages.** Parent:
  `Invitation` + `createInvitationAction` + `/invitations`. Staff:
  `StaffInvitation` (`schema.prisma:442`) + `inviteStaffAction` +
  `/users` (form schema `staff-invite-form.tsx:39`, roles capped at
  `ASSESSOR`/`VIEWER`). The data separation is clean
  ([00 §G](00-current-state-map.md#g-already-satisfied--partially-built-do-not-rebuild));
  the gap is **UI framing/clarity** plus a **missing confirmation step** —
  neither single-send form confirms; only the queue **bulk** re-assessment
  invite confirms (`components/admin/application-table.tsx:386` `handleConfirm`
  → `:452` Confirm button → `bulkReassessmentInviteFromApplicationsAction`).
- **The round picker is unfiltered.** `invitations/page.tsx:104-108` builds
  options from **all** rounds, "newest first", with no filter to live/open
  rounds. (Filtering this picker is *this* epic's UI; the round-status source
  is **Epic 03** — see cross-references.)
- **Twins collide; there is no DOB-based dedupe.** Uniqueness is
  `Application @@unique([roundId, leadApplicantId, childName])`
  (`schema.prisma:108`). Two children of the same lead applicant with identical
  first names (twins) collide on this constraint. `childDob`
  (`schema.prisma:88`, `:59`) exists on both `Application` and `BursaryAccount`
  but is **nullable and collected in the form** (`child-details-form.tsx:196`,
  field `dateOfBirth`), never at invite, so it cannot disambiguate today.
  `BursaryAccount` is keyed only by `reference @unique` (`schema.prisma:56`).
- **The closest existing analog to "invite from a managed record" is
  re-assessment.** `getActiveBursaryHolders` (`lib/db/queries/invitations.ts:308`)
  lists ACTIVE `BursaryAccount`s not yet invited to a round, and the queue bulk
  action invites from them. That is effectively "invite from BursaryAccount" for
  *returning* families. This epic generalises the same pattern to **first-time**
  families via the new contact register.

---

## 3. Target state

A new admin-managed **lead-applicant contact** is the authoritative pre-application
record of a family. It holds the parent identity + reachability, the child, the
school, the applying/entry year and the home address, and it is the single
source from which both the invitation **and** the pre-filled, locked application
are seeded.

**The contact register** — a new `Contact` (a.k.a. lead-applicant contact)
model, browsable and editable under `/contacts`:

- Parent: `firstName`, **`lastName` (required)**, `email`, **`phone`**.
- Child: **`childName` (required)**, `childDob?` (captured here when known; the
  twin-dedupe key — see D12).
- School & year: **`school` (required)** and **`entryYear` + `entryYearGroup`
  (required)** — set by the administrator, never the parent.
- Address: structured home address (`addressLine1`, `addressLine2?`, `town`,
  `postcode`, …) so the portal can show the **stored** address when the child is
  "at the same address" (the postcode/transport ask in Epic 02 / `meeting-findings.md`
  *Parent form changes*).
- Linkage: `profileId?` — null until the family registers, then bound to the
  `Profile` created on invite-accept; optional `bursaryAccountId?` so a returning
  family's contact ties back to its account.

**"Send invitation from contact"** — the primary path to invite:

- An administrator opens a contact and clicks **Send invitation**, choosing the
  **round** (picker filtered to live rounds — Epic 03). The action copies the
  contact's stored `school`, `childName`, `entryYear`/`entryYearGroup`,
  `lastName`, `email`, address-by-reference into a new `Invitation` **and** the
  seed of the application, then sends the branded email. Free-typing identity
  into the invite form becomes the exception, not the rule.
- **School + entry-year are required and LOCKED at this point.** They are
  written onto the `Application` from the contact and the parent form renders
  them **read-only** (Epic 02 deletes the parent school/year selectors and makes
  form Q1 display-only — **D1**). The invariant: *an invited application's
  school and entry-year equal its contact's and cannot be changed downstream.*
- **Created** (Epic 01's `formStatus = CREATED`) becomes literally true: a
  contact + a sent invitation + a pre-seeded application with locked
  school/year, before the parent has logged in.

**Parent-vs-staff clarity & confirmation:**

- Keep the two models/paths (no consolidation). Reframe the UI so the two flows
  are unmistakable — distinct entry points, headings, iconography and copy
  ("Invite a **family** to apply" vs "Invite a **staff member**"), and route the
  contact-driven flow as the default parent path.
- Add a **confirmation step** before any parent invite send (single or
  from-contact), matching the existing bulk-invite confirm
  (`application-table.tsx:452`): a summary of *who*, *which child*, *which
  school*, *which round*, *which email* before the irreversible send.

**Required-field enforcement at invite:** surname, child name and school are
**required** wherever an invite originates — the contact form (so the register
is well-formed), the from-contact action (guards against incomplete contacts),
and the residual ad-hoc single-send form. Round is already required and stays so.

**One account per child, including twins:** the per-child identity key becomes
`childName + childDob`, not `childName` alone. Twins (same first name, different
DOB) get **distinct** contacts, distinct applications and distinct accounts;
re-using a contact for the same child across rounds reuses the account
(**D12**: default — per-child accounts keyed including DOB).

---

## 4. Gap analysis

| # | Target | Today | Action |
|---|---|---|---|
| 1 | First-class contact register independent of applications | family data only inside `Application`/`Section`/`BursaryAccount` | New `Contact` model + `/contacts` admin CRUD (§5.1, §5.3) |
| 2 | "Send invitation from contact" using stored data | invite is hand-typed; only re-assessment invites from a managed record (`getActiveBursaryHolders:308`) | `sendInvitationFromContactAction`; seed `Invitation` + application from contact (§5.2) |
| 3 | School required + locked at invite | `school?` optional (`schema.prisma:417`); parent picks (`(portal)/actions.ts:82`) | Required on contact; copied + write-once on application; Epic 02 removes parent picker (D1) |
| 4 | Entry/applying year required + locked at invite | never captured at invite; derived at submit (`apply/actions.ts:444-450`) | `entryYear`+`entryYearGroup` required on contact; copied to application at invite |
| 5 | Required surname / child / school at invite | all `.optional()` (`invitations/actions.ts:56-59`) | Tighten Zod on contact form, from-contact action, and ad-hoc form (§5.2) |
| 6 | Confirmation step before parent send | only bulk confirms (`application-table.tsx:452`) | Add confirm dialog to single + from-contact sends (§5.3) |
| 7 | Parent-vs-staff flows unmistakable | separate but visually conflatable | UI reframing — entry points, headings, copy (§5.3) |
| 8 | One account per child incl. twins | `@@unique([roundId, leadApplicantId, childName])` (`:108`); `childDob` nullable | Add `childDob` to identity key; backfill; capture DOB on contact (§5.1, D12) |
| 9 | Stored address available to portal "same address" | address only as free-text in section JSONB | Structured address on `Contact`; Epic 02 reads it |
| 10 | Round picker limited to live rounds | all rounds, newest-first (`invitations/page.tsx:104`) | Filter picker (UI here; status source = **Epic 03**) |

---

## 5. Proposed approach

### 5.1 Schema (Prisma + migration)

A new `Contact` model is the spine. The migration is **additive then backfilled
then tightened**, across ordered migrations in this epic's PRs — never editing an
applied migration (repo `CLAUDE.md`).

```prisma
/// Admin-managed lead-applicant contact: the pre-application record of a
/// family (parent + child + school + entry year + address). Exists
/// independently of any Application; it is the source from which an
/// invitation and a pre-filled, school/year-LOCKED application are seeded.
model Contact {
  id             String          @id @default(uuid()) @db.Uuid

  // Parent (lead applicant) — identity & reachability
  firstName      String?         @map("first_name")
  lastName       String          @map("last_name")           // required
  email          String          @map("email")
  phone          String?         @map("phone")

  // Child — name + DOB form the per-child identity key (twins)
  childName      String          @map("child_name")          // required
  childDob       DateTime?       @map("child_dob") @db.Date   // dedupe key (D12)

  // School & year — set by admin, LOCKED for the parent
  school         School                                       // required
  entryYear      Int             @map("entry_year")           // applying/entry calendar year, required
  entryYearGroup EntryYearGroup? @map("entry_year_group")

  // Home address — structured, so the portal can show the stored address
  addressLine1   String?         @map("address_line1")
  addressLine2   String?         @map("address_line2")
  town           String?         @map("town")
  postcode       String?         @map("postcode")

  // Linkage — bound to a Profile once the family registers; to an account
  // once they hold a bursary. Both nullable: a contact precedes both.
  profileId        String?       @map("profile_id") @db.Uuid
  bursaryAccountId String?       @map("bursary_account_id") @db.Uuid

  notes          String?
  createdBy      String          @map("created_by") @db.Uuid
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime        @updatedAt @map("updated_at") @db.Timestamptz(6)

  profile        Profile?        @relation("ContactProfile", fields: [profileId], references: [id])
  bursaryAccount BursaryAccount? @relation(fields: [bursaryAccountId], references: [id])
  creator        Profile         @relation("ContactCreator", fields: [createdBy], references: [id])
  invitations    Invitation[]

  // One contact per child per lead applicant: name + DOB disambiguates twins.
  @@unique([profileId, childName, childDob])
  @@index([email])
  @@index([profileId])
  @@index([bursaryAccountId])
  @@map("contacts")
}
```

Relate it from the existing models (additive, all nullable so no data migration
is forced on `Invitation`):

```prisma
model Invitation {
  // + contactId String?  @map("contact_id") @db.Uuid
  // + contact   Contact? @relation(fields: [contactId], references: [id])
  // ...existing fields unchanged; contactId records the source contact.
}

model Application {
  // + contactId String?  @map("contact_id") @db.Uuid   // the contact this app was seeded from
  // + contact   Contact? @relation(fields: [contactId], references: [id])
}

model Profile {
  // + contacts        Contact[] @relation("ContactProfile")
  // + contactsCreated Contact[] @relation("ContactCreator")
}

model BursaryAccount {
  // + contacts Contact[]
}
```

**One-account-per-child / twin key (D12).** The collision today is
`Application @@unique([roundId, leadApplicantId, childName])` (`schema.prisma:108`).
Tighten the per-child identity to include DOB so twins no longer collide:

- Add `childDob` to the application uniqueness:
  `@@unique([roundId, leadApplicantId, childName, childDob])`.
- Because `childDob` is **nullable** and SQL treats `NULL` as distinct, a true
  uniqueness guarantee for the "DOB unknown" case needs either a backfill of DOB
  before tightening or a partial/expression index. Plan: **backfill `childDob`
  from the `CHILD_DETAILS` section JSONB** (mirroring the submit-time promotion
  at `apply/actions.ts:434-450`), set DOB required on the *contact* going
  forward, and add the composite unique on `Application` only after the backfill
  fills existing rows. Keep `childName`-only uniqueness as a transitional second
  constraint until the backfill is verified, then drop it in the cutover PR.
- The contact register prevents the collision *upstream*: `Contact`'s
  `@@unique([profileId, childName, childDob])` means an admin cannot create two
  identically-named, same-DOB children for one family, while genuine twins
  (distinct DOB) get two contacts → two applications → two `BursaryAccount`s,
  each created on AWARD by Epic 01/10. No second `BursaryAccount` key change is
  needed — `reference @unique` (`schema.prisma:56`) already permits N accounts
  per lead applicant; the dedupe lives in the contact/application keys.

> **Migration sequencing note.** `Contact` is additive (PR-1). The application
> uniqueness change is a separate, backfilled migration (PR-5) so a DOB
> backfill failure can never block shipping the register. Per repo discipline,
> each schema change ships in the PR of the code that needs it.

### 5.2 Server actions / API

- **`createContactAction` / `updateContactAction` / `archiveContactAction`**
  (`src/app/(admin)/contacts/actions.ts`, `requireRole([ADMIN])`). Zod requires
  `lastName`, `childName`, `school`, `entryYear` (+ `email`); `phone`, address
  and `childDob` optional-but-encouraged. Writes audit logs
  (`AUDIT_ACTIONS.CREATE_CONTACT` etc.) and enforces the
  `@@unique([profileId, childName, childDob])` rule with a friendly "this family
  already has a contact for that child" error.
- **`sendInvitationFromContactAction(contactId, roundId)`** — the headline
  action. It:
  1. Loads the contact and **asserts the required set is present** (lastName,
     childName, school, entryYear); rejects incomplete contacts with a clear
     message rather than sending a half-formed invite.
  2. Reuses the hardened `createInvitationAction` machinery
     (`invitations/actions.ts:103`) — create the Supabase auth user, upsert the
     `Profile`, create the `Invitation` (now with `contactId`) and audit log in
     one `withAdminContext` transaction, rolling back the auth user on failure
     (the existing pattern at `:136-242`).
  3. **Seeds the application with locked school/year.** On invite-accept the
     first-year branch already creates the application when the invite carries
     `school + childName + roundId` (`register/actions.ts:307-341`). Extend the
     invite to also carry `entryYear`/`entryYearGroup` and stamp them onto the
     `Application` at creation, and tag `Application.contactId`. The school/year
     are thus set from the contact and never from the parent. (Refactor the
     shared "create first-year application from invitation" logic into one helper
     so the onboarding-card path and the from-contact path cannot diverge.)
  4. Sends the branded `INVITATION` email exactly as today (`:250-257`).
- **Lock enforcement.** Add an invariant in `startApplicationAction`
  (`(portal)/actions.ts:65`) and the registration application-create
  (`register/actions.ts:307`): if the source invitation/contact already fixes
  `school`/`entryYear`, the application **must** use them and the parent-supplied
  values are ignored/blocked. Epic 02 then removes the parent inputs entirely
  (D1) so this becomes belt-and-braces. Optionally back it with a Postgres
  trigger on `applications` (write-once `school`/`entryYear` once `contactId` is
  set), in the same spirit as Epic 01's `submittedAt` immutability trigger — but
  the app-level guard is sufficient for v1; flag the trigger as a hardening
  follow-up.
- **Required-field tightening on the residual single-send form.** Make
  `lastName`, `childName`, `school` **required** in `InvitationSchema`
  (`invitations/actions.ts:54`) and the client schema
  (`send-invitation-form.tsx:53`), removing the `"__none__"` school sentinel as
  a valid submit. (Keep `roundId` required — already is.)
- **Round filtering.** Change `invitations/page.tsx:104` and the from-contact
  picker to source **live** rounds only. The definition of "live" (one or more
  OPEN rounds, editable dates) is **owned by Epic 03**; this epic consumes
  whatever "live rounds" query Epic 03 exposes (e.g. `listOpenRounds`) and must
  not re-implement the single-open-round assumptions
  ([00 §D](00-current-state-map.md#d-rounds--invitations)).

### 5.3 UI

- **`/contacts` register** (new admin nav item): a searchable/filterable table
  (parent name, child, school, year, has-account, has-pending-invite) and a
  create/edit drawer or page. Each row has a **Send invitation** action that
  opens the round picker + confirmation. The register is the primary parent
  entry point; "invite a family" starts here.
- **Send-invitation confirmation** (new): a shared `AlertDialog` summarising
  recipient, child, school, entry year and round before send — used by both the
  from-contact action and the residual single-send form. Pattern-match the
  existing bulk confirm in `application-table.tsx` (`handleConfirm`/Confirm at
  `:386`/`:452`) for consistent copy and affordance.
- **Parent-vs-staff disambiguation** (defect fix): on `/invitations` and
  `/users`, distinct headings, icons and helper copy that make the audience
  obvious ("Invite a **family** to apply for a bursary" vs "Invite a **staff
  member** — assessor or viewer"). The contact-driven flow is surfaced as the
  recommended parent path; the free-type single-send form is demoted to a
  secondary "quick invite" with the same required fields and confirmation.
- **Contact form** captures school + entry year + entry year-group as required
  selects (the controls Epic 02 removes from the *parent* form move *here*), and
  a structured address block. `childDob` is a prominent (recommended) field with
  helper text explaining it disambiguates twins.
- No change to the staff form's role cap (`ASSESSOR`/`VIEWER`,
  `staff-invite-form.tsx:43`) — out of scope here.

### 5.4 Seed / reference data

- Extend the **demo** seed (`seed:demo`, destructive) to create a handful of
  `Contact` rows that exercise the states: a fresh contact with no
  profile/invite, a contact with a sent (CREATED) invite, a contact bound to a
  registered family, a returning contact linked to an ACTIVE `BursaryAccount`,
  and a **twin pair** (same `childName`, distinct `childDob`) proving the dedupe
  key. No reference-data change → no `seed:reference` edit (per repo `CLAUDE.md`,
  contacts are operational data, not reference data).

---

## 6. Work breakdown (PR-sized)

- [ ] **PR-1 (schema, additive):** add `Contact` model + nullable
      `Invitation.contactId` / `Application.contactId` + `Profile`/`BursaryAccount`
      back-relations. Migration additive; no data migration. Prisma client
      regenerated.
- [ ] **PR-2 (contact CRUD):** `/contacts` page + `createContactAction` /
      `updateContactAction` / `archiveContactAction` with required-field Zod
      (lastName, childName, school, entryYear), structured address, `childDob`,
      audit logs, and the `@@unique([profileId, childName, childDob])` duplicate
      guard with a friendly error.
- [ ] **PR-3 (invite from contact):** `sendInvitationFromContactAction`
      reusing the hardened invite/rollback machinery; carry
      `entryYear`/`entryYearGroup` on the invite; refactor the shared "create
      first-year application from invitation" helper and stamp locked
      school/year + `Application.contactId`. From-contact UI: round picker
      (live rounds) + confirmation dialog.
- [ ] **PR-4 (clarity + required fields + confirm on single-send):** tighten
      `InvitationSchema` + `send-invitation-form.tsx` to require
      lastName/childName/school (drop the `__none__` school sentinel); add the
      confirmation dialog to the single-send form; reframe `/invitations` vs
      `/users` audience copy/icons.
- [ ] **PR-5 (twin key, backfilled):** backfill `Application.childDob` from
      `CHILD_DETAILS` JSONB; add
      `@@unique([roundId, leadApplicantId, childName, childDob])`; keep the old
      `childName`-only unique transitionally, verify counts, then drop it in the
      same PR's final migration. Lock-enforcement invariant in
      `startApplicationAction` / `register/actions.ts` (ignore parent
      school/year when the contact fixes them).
- [ ] **PR-6 (round-picker filter, coordinated with Epic 03):** point the
      invite + from-contact pickers at Epic 03's live-rounds query. Land **after**
      Epic 03 exposes that surface; until then the picker may default to the
      single OPEN round as today.
- [ ] **PR-7 (seed):** demo `Contact` fixtures incl. the twin pair and each
      linkage state.

---

## 7. Open decisions

Linked from the [Decision register](../README.md#5-decision-register):

- **D1** — *Lock school + entry-year at admin invite and make form Q1
  read-only?* (default: **lock at invite; Q1 display-only**). This epic provides
  the locked source (contact → application); **Epic 02** removes the parent
  pickers. Blocks finalising §5.2 lock-enforcement and §5.3 contact-form fields.
- **D12** — *Twins: one account per child keyed on `(childName + DOB)`?*
  (default: **per-child accounts keyed incl. DOB**). Drives the §5.1 uniqueness
  changes and the contact `@@unique`. *Owner:* Brian.
- **D13** (informational) — the live-round cap (default *support N, optimise UI
  for 2*) shapes the picker but is owned by **Epic 03**; this epic only consumes
  the resulting query.

Implementation questions to confirm with the client:

- Should an administrator be able to **bulk-import** contacts (CSV) or is manual
  entry sufficient for v1? (Default: manual; defer bulk import to a follow-up.)
- Is a contact's `email` the **immutable** key for the eventual `Profile`, or can
  an admin correct a typo'd email before the family registers? (Default: editable
  until the first invite is accepted, then read-only.)

---

## 8. Risks & mitigations

- **DOB backfill incompleteness.** Existing applications may have no DOB in
  `CHILD_DETAILS` JSONB, so the tightened composite unique cannot fully guarantee
  twin separation for legacy rows. *Mitigation:* backfill first, keep the
  `childName`-only constraint transitionally, diff row counts before dropping it,
  and treat unresolved `NULL`-DOB legacy rows as a reviewed exception list rather
  than silently relying on `NULL`-distinctness.
- **Two creation paths for first-year applications can diverge.** The
  onboarding-card path (`(portal)/actions.ts:138`) and the registration path
  (`register/actions.ts:322`) already duplicate the create logic; adding a
  from-contact path risks a third copy. *Mitigation:* extract one shared helper
  in PR-3 and route all three through it, so the locked-school/year invariant is
  enforced in exactly one place.
- **Parent-supplied school/year still reachable until Epic 02 lands.** This epic
  locks the data but Epic 02 removes the inputs; in the gap a determined parent
  request could still carry a school. *Mitigation:* the §5.2 server-side
  invariant ignores/blocks parent school/year whenever the contact fixes them,
  independent of the UI.
- **Round-picker coupling to Epic 03.** Filtering to live rounds depends on an
  Epic 03 query that may not exist when this epic starts. *Mitigation:* sequence
  PR-6 last and behind Epic 03; the register and from-contact flow function with
  the current single-open-round default in the interim.
- **Contact ↔ Profile binding races.** Two invites for the same family, or an
  invite then a manual registration, could create duplicate Profiles.
  *Mitigation:* reuse the existing `createProfile` upsert
  (`invitations/actions.ts:162`) and bind `Contact.profileId` on first accept;
  the contact `@@unique` blocks duplicate child records at source.

---

## 9. Out of scope / deferred

- **Removing the parent-facing school/entry-year selectors** and making form Q1
  read-only → **Epic 02** (this epic only supplies the locked source data; D1
  spans both).
- **Defining "live/open rounds"**, multiple concurrent open rounds, editable
  dates, and per-application submission-by dates → **Epic 03** (this epic
  consumes the live-rounds query for its picker).
- **`formStatus = CREATED`** itself and the three-lifecycle split → **Epic 01**
  (this epic makes "Created" *meaningful* by giving it a contact + seeded app,
  but the enum/lifecycle is Epic 01's).
- **AWARD → rolling account promotion + forward schedule** and access-revocation
  for CLOSED accounts → **Epic 01 / Epic 10**.
- **CSV bulk-import of contacts** → follow-up (see §7).
- **The structured-address-driven "same address" portal behaviour / postcode
  logic** → consumed by **Epic 02**; this epic only persists the address on the
  contact.

---

## 10. Acceptance criteria

- An administrator can create a **contact** (parent + child + school + entry
  year + address) that exists with **no application and no invitation**, and it
  appears in the `/contacts` register.
- A contact's **Send invitation** action sends a parent invite seeded entirely
  from stored data and, on accept, produces an application whose **school and
  entry-year equal the contact's** and cannot be changed by the parent (verified:
  parent path ignores/blocks any supplied school/year).
- Creating an invitation (from contact **or** via the single-send form) **fails
  validation** without surname, child name and school; round remains required.
- A **confirmation step** precedes every parent invite send (single and
  from-contact), summarising recipient/child/school/round.
- `/invitations` and `/users` make it **unambiguous** which is the family invite
  and which is the staff invite.
- **Twins** (same first name, different DOB) can each have a distinct contact,
  application and bursary account; attempting a second contact for the **same
  child** (same name + DOB) under one family is rejected. The application
  uniqueness key includes DOB and the legacy `childName`-only constraint is gone
  after a verified backfill.
- The invite **round picker lists live rounds only** (once Epic 03's live-rounds
  surface is available; until then it defaults to the open round as today).
- Demo seed shows the contact register populated across every linkage state,
  including a twin pair.
