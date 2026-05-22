# 03 — Close a round

Backlink: [[README#Round lifecycle]]

Transitions an `OPEN` round to `CLOSED`. After closure, no new
applications can be submitted, but existing in-flight applications
can still be assessed.

## Prerequisites

- The target round is in `OPEN` status.
- You are signed in as `ADMIN`.

## Steps

1. Sidebar → **Rounds**.
2. Find the `OPEN` row.
3. In the **Actions** column, click **Close Round**.
4. Confirm in the dialog.

## Verification

- The status badge changes from **OPEN** (green) to **CLOSED** (grey).
- New attempts to register against this round are rejected.
- Applications already in flight (SUBMITTED, NOT_STARTED, PAUSED,
  COMPLETED, QUALIFIES, DOES_NOT_QUALIFY) remain editable by
  assessors.

## After closing

- To start a new cycle, create the next round (see
  [[01-create-new-assessment-round]]) then open it (see
  [[02-open-a-round]]).
- Closed rounds remain visible in the table for reporting — see
  [[04-view-historical-rounds]].
