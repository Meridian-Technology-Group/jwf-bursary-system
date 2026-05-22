# 04 — Invite an applicant for an internal / ad-hoc bursary

Backlink: [[README#Inviting applicants (single)]]

Create an application on behalf of a parent — used for pastoral
referrals, emergency cases, or off-round intake. Generates an
application reference and emails the parent a registration link.

## Prerequisites

- Signed in as `ASSESSOR` or `ADMIN`.
- A round exists you can attach the application to (any status; the
  dialog flags non-OPEN rounds).
- The parent's email, name, child's name, school, and target entry year.

## Steps

1. Sidebar → **Applications** to reach `/queue`.
2. At the top-right of the page, click the **Internal Request** button
   (Plus icon).
3. The dialog **Create Internal Bursary Request** opens with strapline
   *"Create an application on behalf of a parent. An invitation email
   will be sent so they can complete the form."* Fill in:
   - **Parent Email** *(required)*.
   - **Parent Name** *(required)*.
   - **Child Name** *(required)*.
   - **School** *(radio)* — *Whitgift* / *Trinity*.
   - **Academic Round** — dropdown; non-OPEN rounds are shown with a
     muted `(draft)` / `(closed)` suffix.
   - **Entry Year** — dropdown of eight years around the current year.
   - **Reason for Request** *(optional, max 500 chars)* — e.g. *"Referred
     by headteacher; child has exceptional circumstances…"*.
4. Click **Create Request**.
5. On success the dialog flips to a green success panel with the
   header **Internal Request Created** and shows the generated
   **Application reference** in monospace. Click **Done** to dismiss.

## What happens server-side

- An `Application` row is created and tied to a new (or existing)
  `BursaryAccount` for the parent.
- An invitation email is dispatched so the parent can complete the
  online form — they pick up the application via the standard portal
  flow.
- The `reason` (if provided) is recorded for the audit trail.

## Verification

- The new application appears in `/queue` with status
  **Pre-Submission** until the parent submits.
- The reference shown in the success panel matches the row in the
  queue.

## Notes

- Use this flow when the standard Y6 → Y7, Y9, Y12 mapping is not the
  right fit; entry year here is freely editable.
- The parent still receives the standard invitation email and registers
  themselves; you do not enter their financial data on their behalf.
