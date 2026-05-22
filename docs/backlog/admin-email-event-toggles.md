---
title: Admin toggle to enable/disable specific event-based emails
status: open
severity: medium
area: email, admin-settings, schema
opened: 2026-05-22
opened_by: Brian Wagner
related:
  - src/lib/email/send.ts (sendEmail — the single send chokepoint to gate)
  - prisma/schema.prisma (EmailTemplateType enum; email_templates model)
  - src/app/(admin)/settings (Email Templates tab — where the toggle UI lives)
  - src/app/(admin)/applications/[id]/recommendation/actions.ts (sends OUTCOME_QUALIFIES / OUTCOME_DNQ)
  - src/app/(admin)/applications/[id]/actions.ts, queue/actions.ts, invitations/actions.ts, (portal)/apply/actions.ts (other send sites)
---

## Context

An administrator must be able to explicitly turn specific event-based
emails on or off. Today every transactional email fires unconditionally
from its server action via `sendEmail(to, type, mergeFields)` — there is
no switch. The Foundation may not want certain automated emails sent at
all; the motivating example is **rejection / "did not qualify"**
outcomes (`OUTCOME_DNQ`), which they may prefer to handle manually rather
than via an automated send.

The event types are the `EmailTemplateType` enum:
`INVITATION`, `CONFIRMATION`, `MISSING_DOCS`, `OUTCOME_QUALIFIES`,
`OUTCOME_DNQ`, `REASSESSMENT`, `REMINDER`, `INVITE_STAFF`.

## Why it matters

- **Policy / tone control.** Automated rejection emails can be the wrong
  call for a bursary programme; admins need to suppress them without a
  code change or a developer.
- **Avoids brittle workarounds.** Without a toggle, the only way to stop
  an email today is to edit/blank a template or pull the send out in
  code — both error-prone and invisible to the admin.
- It's an admin-facing control gap: the Settings → Email Templates tab
  lets admins edit content but not whether the email sends at all.

## Proposed approach

1. **Persistence.** Add an `enabled boolean NOT NULL DEFAULT true` column
   to `email_templates` (keyed by the unique `type`), or a small
   `email_settings` table keyed by `EmailTemplateType`. Column on
   `email_templates` is simplest since a row already exists per type.
   Ships a Prisma migration (seed default = enabled, preserving current
   behaviour).
2. **Enforcement at the chokepoint.** Gate in `sendEmail` (src/lib/email/send.ts)
   — every send already routes through it. If the type is disabled,
   short-circuit to a no-op success and log a structured `email.skipped`
   event (so it's observable and doesn't look like a failure to callers).
   One gate covers all current and future send sites.
3. **Admin UI.** Add an enable/disable switch per template in the
   Settings → Email Templates tab, with an action that flips the flag and
   writes an audit row (e.g. `UPDATE_EMAIL_TEMPLATE_ENABLED`).
4. **Guardrails.** Decide which types are *non-disableable* because
   turning them off breaks a flow rather than just changing tone — e.g.
   `INVITE_STAFF` and `INVITATION` are functional onboarding links;
   `CONFIRMATION` may be expected for audit/UX. Surface those as locked or
   warn on disable. (Owner input needed — see Out of scope.)

## Out of scope

- Per-application / per-recipient overrides (e.g. "send rejection for
  this one applicant but not generally) — this is a global per-event
  toggle only.
- Scheduling / send-window controls and digesting.
- The exact set of "locked" (non-disableable) event types — needs an
  owner decision; default proposal is to lock `INVITE_STAFF` and
  `INVITATION` and allow all outcome/reminder/missing-docs types to be
  toggled.
