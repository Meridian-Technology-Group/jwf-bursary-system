---
title: Internal Request button is shown to assessors but the server action requires ADMIN
status: open
severity: high
area: rbac, admin-ui, intake
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - docs/walkthroughs/assessors/03-invite-applicant-new-bursary.md
  - docs/walkthroughs/assessors/04-invite-internal-ad-hoc-bursary.md
  - src/app/(admin)/queue/actions.ts:65
---

## Context

Walkthrough `assessors/04-invite-internal-ad-hoc-bursary.md` says the
prerequisite is "Signed in as `ASSESSOR` or `ADMIN`", and `assessors/03`
explicitly funnels assessors toward this flow because `/invitations`
is admin-only.

Reality on commit `c88dda4`:

- The **Internal Request** button at the top-right of `/queue` is
  rendered for assessors (verified by signing in as
  `jwf-testing+assessor@meridiantech.group` and navigating to
  `/queue`).
- Filling and submitting the dialog redirects to `/admin` with no
  toast, no error panel, and no row in `applications` or
  `invitations`.
- The reason is in `src/app/(admin)/queue/actions.ts:65`:
  `createInternalRequestAction` calls `requireRole([Role.ADMIN])`,
  which throws / redirects unauthenticated-for-purpose users out of
  the action.

Net effect: assessors are sent to a flow that silently fails. They
have no way to invite a new applicant at all — the documented
escape hatch ("admins go to /invitations, assessors use Internal
Request") closes on both sides.

## Why it matters

Intake is the entry point for every applicant. If assessors cannot
invite, every new application has to be cleared through an admin,
even though the spec / walkthrough treats this as a routine assessor
action.

Also fails silently: the dialog redirects to `/admin` instead of
surfacing a permission error, which obscures the cause from anyone
who isn't reading server logs.

## Proposed approach

Two options:

1. **Allow assessors.** Change `requireRole([Role.ADMIN])` →
   `requireRole([Role.ADMIN, Role.ASSESSOR])` in
   `queue/actions.ts:65`. Matches the walkthrough's stated
   permissions. Audit-log entry already attributes the action to
   the calling user, so attribution is fine.
2. **Lock assessors out at the UI and rewrite the walkthrough.**
   Hide the Internal Request button when role is ASSESSOR. Rewrite
   assessors/03 and 04 to make clear assessors must request via an
   admin. This is a smaller code change but a bigger documentation
   change and pushes intake friction onto admins.

Option 1 looks correct on intent — the dialog and the walkthroughs
both consistently describe an assessor-driven flow. The audit field
already captures who initiated.

Either way, the silent redirect to `/admin` on a permission denial
should become a visible error.

## Out of scope

- Reworking the wider RBAC model. Just this one action.
- Resend deliverability errors (separate finding — see
  `[users] inviteStaffAction email error: validation_error: API key
  is invalid` in the prod log; Resend API key for the local
  environment is invalid).
