# Item 11: Bursary reference freely editable at any time

> Source: `docs/backlog/post-demo-change-list.md` — item 11. Status: Not started.

The bursary reference on an application must be editable at any point in its
lifecycle, with no state-gating. Edits must be validated for uniqueness and
recorded in the audit trail.

## Story 11.1 — Edit the bursary reference regardless of lifecycle state
**As an** ADMIN, **I want** to edit an application's
bursary reference at any point in its lifecycle, **so that** I can correct or
assign the reference whenever the need arises, without being blocked by the
application's current state.

**Acceptance criteria**
- [ ] Given an application in any lifecycle state (e.g. draft, submitted,
  received, under assessment, recommended, decided, withdrawn, archived), when an
  ADMIN opens the reference field, then it is editable and
  saving succeeds.
- [ ] Given an ADMIN, when they change the reference and save,
  then the new value is persisted to `applications.reference` and shown on the
  detail page (and list, if surfaced there) immediately.
- [ ] Given the reference is edited, then no lifecycle transition is triggered
  and no existing assessment, recommendation, or outcome is discarded or altered
  as a side effect.
- [ ] Given an application in a terminal/locked state where other fields are
  read-only, when an ADMIN edits the reference, then the edit is
  still allowed (the reference is explicitly exempt from state-gating).
- [ ] The reference can be edited from the application detail page; inline edit
  on the list is optional (nice-to-have) and not required for this story.
- [ ] Given an ASSESSOR or VIEWER, when they view the reference, then it is
  read-only (no edit control offered), and any server-side update is rejected.

**Notes / dependencies**
- **Decided — ADMIN only.** ASSESSOR and VIEWER are read-only. Enforced
  server-side, not just in the UI.
- Requires a server action to update `applications.reference` with no
  state guard.
- **Decided — references are required:** an edit cannot save a blank/empty
  reference (rejected with a validation message).

## Story 11.2 — Reference uniqueness is validated on save
**As a** staff member editing a reference, **I want** the system to reject a
reference that duplicates another application's, **so that** every bursary
reference stays unique and unambiguous across the system.

**Acceptance criteria**
- [ ] Given a reference value already used by a different application, when a
  staff member tries to save it, then the save is rejected with a clear,
  inline error naming the conflict and no change is persisted.
- [ ] Given a unique reference value, when a staff member saves it, then the
  save succeeds.
- [ ] Given a staff member re-saves an application with its own current
  reference unchanged, then it is not treated as a duplicate of itself.
- [ ] Uniqueness is enforced at the data layer (constraint), not only in the UI,
  so concurrent edits cannot create two identical references.
- [ ] **Decided — matching is case-insensitive:** two references that differ only
  in letter case are treated as duplicates (e.g. "ABC-1" collides with "abc-1").
- [ ] **Decided — no format restriction:** whitespace and special characters are
  permitted and are preserved verbatim (not stripped or normalised away); they
  are significant, so matching is case-insensitive only, not whitespace-folded.
- [ ] **Decided — references are required:** a blank/empty reference is rejected;
  there is no "no reference" state to exclude from the uniqueness check.

**Notes / dependencies**
- References are mandatory and unique (case-insensitive). No null/blank values to
  special-case in the constraint.
- A case-insensitive unique index (e.g. on `lower(reference)`) will require a
  migration — ship it in the same PR per CLAUDE.md migration discipline.

## Story 11.3 — Reference changes are captured in the audit trail
**As an** ADMIN reviewing history, **I want** every change to a bursary
reference recorded in the audit trail, **so that** I can see who changed a
reference, when, and from what value to what.

**Acceptance criteria**
- [ ] Given a reference is successfully changed, then an audit entry is written
  capturing the acting user, timestamp, application (entity id), the previous
  value, and the new value.
- [ ] Given a save is rejected (e.g. duplicate), then no audit entry is written
  for a change that did not occur.
- [ ] Given a reference change, when an ADMIN opens the `/audit` page filtered
  to that application, then the change is visible and attributable.
- [ ] The audit entry uses the existing audit action/entity conventions
  (PascalCase entity type, consistent action naming) so it renders correctly on
  the audit page.

**Notes / dependencies**
- Reuse the existing audit-logging mechanism; `audit_logs` is append-only.
- Depends on 11.1 (the edit path) being the single write point so all changes
  are audited consistently.
