# 01 — Triage the queue

Backlink: [[README#Daily queue work]]

Scan the application queue, apply filters, and identify which applications
need attention next. Names are hidden by default; revealing them is an
auditable event.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- One or more rounds exist (`/rounds`) — assessors see only their own
  assignments; admins/viewers see everything.

## Steps

1. From the admin sidebar, click **Applications**. You land at `/queue`
   under the heading **Applications** with the strapline *"Review and
   assess submitted bursary applications."*
2. Use the filter bar at the top of the table:
   - **Round** dropdown — defaults to *All rounds*; pick a specific
     academic year to narrow down.
   - **School** dropdown — *All schools* / *Whitgift* / *Trinity*.
   - **Status** popover — multi-select among *Pre-Submission*,
     *Submitted*, *Not Started*, *Paused*, *Completed*, *Qualifies*,
     *Does Not Qualify*. The popover badge shows the number of statuses
     applied; **Clear filters** wipes them.
   - **Search reference…** — free-text matches the reference (and, when
     names are revealed, child and lead applicant names).
3. Sort by clicking any column header — **Reference**, **School**,
   **Submitted**, **Status**, **Entry Year**. The chevron indicates
   direction.
4. To reveal applicant names for cross-checking, toggle **Show names**
   (top-right of the filter bar). The amber pill *"Names visible — audit
   logged"* appears. The reveal calls `/api/applications/names` and writes
   an audit-log entry attributed to you.
5. Click any row (or the **Open** button) to navigate to the application
   detail view — see [[02-open-an-application]].

## Verification

- The row count line at the bottom reads `Showing N of M applications`.
- Filters applied are visually reflected (status popover badge, round /
  school dropdowns).
- When **Show names** is on, the Child Name and Lead Applicant columns
  appear; toggling off hides them and removes the pill.

## Notes

- Assessors see only applications where `assignedToId = self`. If the
  queue is empty, ask an Admin to assign applications or check filters.
- The status column maps the internal Prisma status to a display badge
  (e.g. `COMPLETED` → *In Review* visual, `NOT_STARTED` → *Submitted*).
  Treat the popover labels as the source of truth.
- Every **Show names** activation is logged with the action `REVEAL`;
  reviewable in [[../admins/13-audit-log-review]].
