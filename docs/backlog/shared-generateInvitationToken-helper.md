---
title: Consolidate generateInvitationToken into a shared helper
status: open
severity: low
area: refactor
opened: 2026-05-13
opened_by: Claude (via Brian Wagner)
related:
  - docs/planning/APPLICANT_INVITATION_FLOW.md §7
  - src/lib/db/queries/invitations.ts (applicant)
  - src/lib/db/queries/staff-invitations.ts (staff)
---

## Context

`generateInvitationToken()` exists in both
`src/lib/db/queries/invitations.ts` (applicant, added in PR #11) and
`src/lib/db/queries/staff-invitations.ts` (staff, pre-existing).
The implementations are identical — 32 random bytes → base64url.

## Why it matters

- Drift risk: someone tuning the staff helper (e.g. bumping byte
  count, switching to a different encoding) will silently leave the
  applicant version behind.
- Two import paths for the same primitive makes code review noisier.

## Proposed approach

Extract to `src/lib/db/queries/invitation-token.ts`:

```ts
import { randomBytes } from "crypto";

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}
```

Re-export from both call sites (or replace imports outright). Trivial
PR; pair with a quick `grep -r generateInvitationToken src/` to find
any unexpected callers.

## Out of scope

Changing the token format or length.
