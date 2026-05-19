---
title: admin/11 guide points at `/invitations` for batch re-assessment; the button lives on `/rounds/[id]`
status: open
severity: low
area: docs, admin-ui
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - docs/walkthroughs/admins/11-batch-reassessment-invitations.md
  - src/components/admin/round-detail-actions.tsx:90
  - src/components/admin/batch-invite-dialog.tsx
---

## Context

The admin/11 walkthrough tells the admin to:

> Sidebar → **Invitations**. … In the **Send New Invitation**
> section, locate the **Send Batch Reassessment Invitations**
> button.

The button does not exist on `/invitations`. It is rendered by
`<BatchInviteDialog>` inside `<RoundDetailActions>` on the
round-detail page (`/rounds/[id]`) — see
`src/components/admin/round-detail-actions.tsx:90`.

The server action (`batchReassessmentInviteAction` in
`src/app/(admin)/invitations/actions.ts:284`) and the dialog
component both exist and are wired up — the feature works. Only
the walkthrough's location pointer is wrong.

## Why it matters

Admins following the guide will scroll `/invitations` looking for
a button that isn't there and conclude the feature is missing.

## Proposed approach

Doc-only fix: rewrite admin/11 step 1 to "Sidebar → **Rounds** →
click the OPEN round to land on `/rounds/[id]` → the **Send
Invitations** action group includes the batch button" (or whatever
the dialog trigger is labelled — check
`round-detail-actions.tsx` for the exact copy). Update
verification step to confirm the resulting rows appear in the
Invitation History table back on `/invitations`.

No code change required.

## Out of scope

- Reorganising the admin UI to put the batch button on
  `/invitations` (the round-scoped location is arguably more
  intuitive — you batch *for a round*).
