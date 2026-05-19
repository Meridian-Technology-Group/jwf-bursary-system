# 02 — Open an application

Backlink: [[README#Daily queue work]]

Navigate from the queue into the four-tab application detail view.

## Prerequisites

- Signed in as `ASSESSOR`, `ADMIN`, or `VIEWER`.
- The application is assigned to you (assessor) or you are an admin /
  viewer.

## Steps

1. From `/queue`, click any row in the table, or use the row's **Open**
   button (small external-link icon). You land at
   `/applications/[id]`.
2. The header card shows:
   - The application **reference** (monospace, e.g. `JW-2026-0042`).
   - The school badge (*Whitgift* navy / *Trinity* blue).
   - Round line: *Round: 2026/27 · Entry: 2027*; the orange pill
     **Re-assessment** appears for year 2+ applications.
   - The current **StatusBadge** (top-right).
   - For admins, the **Assign Assessor** select.
3. Below the header sits the **Actions** bar (hidden for terminal
   statuses `PRE_SUBMISSION`, `QUALIFIES`, `DOES_NOT_QUALIFY`). The
   bar's context label reads e.g. *"Actions › Awaiting review"* and
   surfaces the next-step buttons:
   - `SUBMITTED` → **Begin Review**.
   - `NOT_STARTED` → **Request Missing Documents** | **Mark Complete**.
   - `PAUSED` → **Resume Review**.
   - `COMPLETED` → **Set Does Not Qualify** | **Set Qualifies**.
4. Use the tab strip to move between:
   - **Applicant Data** — read-only submission (see
     [[05-read-submitted-application]]).
   - **Assessment** — the calculation workspace.
   - **Recommendation** — only meaningful after the assessment is
     `COMPLETED`.
   - **History** — audit timeline for this application.

## Verification

- The breadcrumb reads *Applications / `<reference>`*.
- The browser tab title shows the active section (*Applicant Data*,
  *Assessment*, etc.).
- For `ASSESSOR` users not assigned to the application, the layout
  redirects to `/admin` — that's the access guard, not a bug.

## Notes

- A 404 indicates the application has been GDPR-deleted (see
  [[../admins/12-delete-applicant-gdpr]]) or never existed.
- The actions bar surfaces a red inline banner if a status transition
  fails server-side; the message is the server-action's `error` string.
