# Item 9: Email template management (add / delete) in admin settings

> Source: `docs/backlog/post-demo-change-list.md` — item 9. Status: Not started.

Today the Email Templates settings tab only lets admins **edit** the content
(subject/body) of a fixed set of templates that are seeded via the
`*_seed_email_templates` migration and keyed one-to-one to the
`EmailTemplateType` enum. This item lets admins **add** their own templates and
**delete** ones they no longer need, while protecting the templates the system
sends automatically and keeping admin changes safe from being clobbered or
resurrected the next time the seed runs. It underpins item 8 (the bulk "Send
Email" wizard picks from these templates).

## Story 9.1 — Add a custom email template
**As an** ADMIN, **I want** to create a new email template from Settings, **so that** I have reusable messages (e.g. for a bulk send in item 8) without a code change or a migration.

**Acceptance criteria**
- [ ] Given I am an ADMIN on the Email Templates settings tab, When I choose "Add template", Then I get a form for a template name/label, subject, and body.
- [ ] Given I am filling in the form, When I save, Then the template is validated (name required and unique among custom templates; subject and body non-empty) and persisted, and it appears in the templates list marked as a custom/admin-created template distinct from the seeded system ones.
- [ ] Given a custom template exists, When it is offered anywhere a template is chosen (e.g. the item 8 bulk-email picker), Then it is selectable and its merge fields render using the same merge-field engine as the seeded templates.
- [ ] Given I am an ASSESSOR or VIEWER, When I open the Email Templates tab, Then I cannot add a template (create controls are hidden/blocked and the server action rejects non-ADMIN callers).
- [ ] Given I save a new template, When the save succeeds, Then an audit entry records the create (actor, timestamp, template identity).

**Notes / dependencies**
- Schema tension to resolve first: the existing `email_templates.type` is the `EmailTemplateType` enum and is `@unique`, so a custom template needs an identity that is **not** an enum value (e.g. a nullable `type` plus a `name`/`key`, and a flag distinguishing "system" from "custom"). Ship any schema change in the same PR (CLAUDE.md migration discipline; author additive SQL, do not mutate applied migrations).
- Feeds item 8 — the bulk-email template picker should read both system and custom templates.
- Confirm with the client whether custom templates need the same merge fields available as system ones, or a defined subset.

## Story 9.2 — Delete a custom email template
**As an** ADMIN, **I want** to delete a custom template I created, **so that** obsolete messages don't clutter the picker.

**Acceptance criteria**
- [ ] Given a custom (admin-created) template, When I choose "Delete" and confirm the destructive-action dialog, Then the template is removed from the list and no longer appears in any template picker.
- [ ] Given I click delete, When the confirmation dialog is shown, Then it names the template and warns the action cannot be undone before I confirm.
- [ ] Given I am an ASSESSOR or VIEWER, When I view a custom template, Then no delete control is available and the server action rejects the call.
- [ ] Given a template is deleted, When the delete succeeds, Then an audit entry records the deletion (actor, timestamp, template identity) — note `audit_logs` is append-only.
- [ ] Given a template was deleted, When a subsequent re-seed of the migration baseline runs, Then the deleted template is not resurrected (see Story 9.4).

**Notes / dependencies**
- Deletion is only permitted for custom templates; system templates are guarded by Story 9.3.
- Consider whether deletion is a hard delete or a soft delete (e.g. `deletedAt`) — a soft delete makes tombstoning for re-seed reconciliation (Story 9.4) straightforward. Confirm approach when scoping.

## Story 9.3 — Guard system / auto-sent templates as non-deletable
**As an** ADMIN, **I want** the templates the system sends automatically to be protected from deletion, **so that** an accidental delete can't break automated emails (invitations, confirmations, outcome notices, reminders, etc.).

**Acceptance criteria**
- [ ] Given a seeded system template (one keyed to an `EmailTemplateType` the app sends automatically), When I view it in Settings, Then editing its subject/body is still allowed but no delete control is offered.
- [ ] Given a request to delete a system template reaches the server (e.g. crafted request), When it is processed, Then it is rejected with a clear "system templates cannot be deleted" error and nothing is removed.
- [ ] Given a system template, When I view it, Then it is visually badged as a system/protected template so admins understand why it can't be deleted.
- [ ] Given every `EmailTemplateType` the code relies on, When templates are listed, Then each such type still resolves to exactly one template (the guard preserves the invariant the send paths depend on).

**Notes / dependencies**
- "System" = any template keyed to an enum value the app looks up when sending (all 15 current `EmailTemplateType` values). The distinction between system and custom from Story 9.1 drives this guard.
- Editing remains available for system templates (that behaviour already ships); this story only removes the *delete* affordance for them.

## Story 9.4 — Reconcile add/delete with the migration-seeded baseline
**As an** ADMIN, **I want** re-running the template seed to be safe, **so that** my custom templates aren't wiped and my deletions aren't undone when the seed runs again.

**Acceptance criteria**
- [ ] Given custom (admin-created) templates exist, When the `*_seed_email_templates` baseline runs again, Then those custom templates are left untouched.
- [ ] Given a seeded system template's content was edited by an admin, When the seed runs again, Then it does not silently overwrite the admin's edits (or the overwrite behaviour is explicitly defined and agreed — confirm with the client which wins).
- [ ] Given a template that admins deleted, When the seed runs again, Then it is not resurrected (deletions are respected — e.g. via a tombstone/soft-delete marker the seed checks).
- [ ] Given the seed defines the required system templates, When it runs against a fresh database, Then all system templates keyed to `EmailTemplateType` values are present (the baseline is still the source of truth for system templates).

**Notes / dependencies**
- The seed remains the single source of truth for **system** templates per CLAUDE.md; custom templates and deletions are user data the seed must not clobber. The seed should upsert only system rows and skip anything marked custom or tombstoned.
- Ties to the soft-delete decision in Story 9.2 — a tombstone makes "don't resurrect a deleted template" enforceable across re-seeds.
- Applies to both `seed:reference`-style idempotent runs and the migration seed; ensure whichever path recreates templates honours the same rules.
