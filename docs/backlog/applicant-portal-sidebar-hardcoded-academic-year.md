---
title: Applicant portal sidebar shows hardcoded "2024–25 Assessment Round"
status: open
severity: medium
area: portal-ui, rounds
opened: 2026-05-19
opened_by: walkthrough verification pass
related:
  - docs/walkthroughs/applicants/05-tour-of-the-dashboard.md
---

## Context

While logged in as `jwf-testing+applicant1@meridiantech.group` and
verifying applicants/05 against the only currently-OPEN round
(`2026/27`), the portal left sidebar reads:

> Round
> **2024–25 Assessment Round**

There is no 2024–25 round in the database. The applicant's
invitation is linked to round `2026/27` (the one created during
Phase 1 of this verification pass). The sidebar value is
hard-coded, not read from the invitation/application/round join.

Reproduced at `http://localhost:3100/` post-login. Visible in
the snapshot:

```
- generic [ref=e9]:
  - paragraph [ref=e10]: Round
  - paragraph [ref=e11]: 2024–25 Assessment Round
```

## Why it matters

Applicants see the wrong academic year displayed on every page of
the portal. For year-on-year reassessments this is especially
misleading — an applicant returning for a re-assessment would see
a stale round label and lose trust in the system. Also breaks the
applicants/05 dashboard tour and applicants/28
"what-changes-year-on-year" guide, both of which reference the
sidebar's round label as the authoritative academic year.

## Proposed approach

Read the round label from the user's active invitation or
application:

```ts
const inv = await getLatestAcceptedInvitationForUser(tx, user.id);
const academicYear = inv?.round?.academicYear ?? null;
```

Render that in the sidebar, falling back to no-label when the
user has no invitation/application yet. The application-detail
page already does this correctly (`roundLabel` in
`src/app/(portal)/page.tsx:57`), so the data path exists.

## Out of scope

- The "0 of 11 sections complete" string in the same sidebar —
  spec says 10 sections (Review is a review step, not a section).
  Tracked separately if it becomes a problem; minor cosmetic.
