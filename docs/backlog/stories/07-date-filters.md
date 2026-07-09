# Item 7: Date filters on the Applications list

> Source: `docs/backlog/post-demo-change-list.md` — item 7. Status: Not started.

Staff need to narrow the Applications list by date. Two independent date-range
filters are wanted: **Received date** (when the applicant submitted) and
**Submission-by (deadline)** (the effective per-application deadline, which
falls back to the round default — see items 1 and 12). Each is written as its
own story because the second depends on work not yet built.

## Story 7.1 — Filter the Applications list by received date range
**As a** staff member (ADMIN / ASSESSOR / VIEWER), **I want** to filter the
Applications list to a received-date range, **so that** I can focus on
applications submitted within a specific window (e.g. this round's intake, or a
given week).

**Acceptance criteria**
- [ ] Given the Applications list, When I open the filter bar, Then I see a
  "Received date" range control with a **from** and a **to** date.
- [ ] Given I set only a **from** date, When I apply, Then the list shows
  applications whose received date is on or after that date (inclusive), with no
  upper bound.
- [ ] Given I set only a **to** date, When I apply, Then the list shows
  applications whose received date is on or before that date (inclusive), with no
  lower bound.
- [ ] Given I set both dates, When I apply, Then the list shows only applications
  whose received date falls within the inclusive range.
- [ ] The filter operates on the application's submission/received date
  (`submittedAt`); applications with no received date (e.g. not yet submitted)
  are excluded whenever a received-date bound is active.
- [ ] Given a received-date filter is active, When combined with the existing
  tab (new / rolling) and other filters, Then all active filters apply together
  (logical AND) and the result count reflects the combination.
- [ ] Given an invalid range where **from** is after **to**, When I apply, Then
  I am shown a clear validation message and the filter is not applied.
- [ ] Given I have applied a received-date filter, When I clear it (or clear all
  filters), Then the full list (subject to remaining filters) is restored.
- [ ] The active received-date filter is visible in the filter bar (chip /
  summary) so it is obvious the list is filtered.

**Notes / dependencies**
- No dependency on other backlog items — `submittedAt` already exists.
- Follow the existing filter-bar pattern; filter server-side by extending
  `ListApplicationsFilters` (preferred) to match how current filters work.
- Timezone: compare on calendar dates in the Foundation's local timezone so a
  boundary day is fully included.

## Story 7.2 — Filter the Applications list by submission-by (deadline) range
**As a** staff member (ADMIN / ASSESSOR / VIEWER), **I want** to filter the
Applications list by the effective submission-by deadline, **so that** I can find
applications due within a period (e.g. deadlines in the next 7 days, or already
overdue).

**Acceptance criteria**
- [ ] Given the Applications list, When I open the filter bar, Then I see a
  "Submission-by (deadline)" range control with a **from** and a **to** date,
  alongside the received-date control.
- [ ] The filter operates on each application's **effective** deadline: the
  per-application submission-by date if set, otherwise the round-level default
  deadline (item 12).
- [ ] Given I set a **from** and/or **to** date, When I apply, Then the list
  shows only applications whose effective deadline falls within the inclusive
  bound(s), following the same from-only / to-only / both semantics as Story 7.1.
- [ ] Given an application has no effective deadline (neither a per-application
  date nor a round default is set), When a deadline-range bound is active, Then
  that application is excluded from the results.
- [ ] Given both date filters (received and submission-by) are active, When I
  apply, Then they combine with each other and with tab/other filters (logical
  AND).
- [ ] Given an invalid range (**from** after **to**), When I apply, Then a clear
  validation message is shown and the filter is not applied.
- [ ] The active submission-by filter is shown as a chip / summary in the filter
  bar and can be cleared independently of the received-date filter.

**Notes / dependencies**
- **Depends on item 12** (round-level default submission-by date) for the
  fallback, and **relates to item 1** (deadline column on the list). The
  "effective deadline" logic must be shared with item 1 so the column and this
  filter agree.
- If item 12 is not yet delivered when this is built, the filter can operate on
  the per-application deadline only, with the round-default fallback added when
  item 12 lands. Note this sequencing in delivery planning.
- Same timezone / inclusive-boundary handling as Story 7.1.
- "Overdue" and "due soon" are natural follow-on conveniences (e.g. quick
  presets); out of scope here unless requested.
