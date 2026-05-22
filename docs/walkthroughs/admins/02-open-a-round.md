# 02 — Open a round

Backlink: [[README#Round lifecycle]]

Transitions a `DRAFT` round to `OPEN`. Only one round can be `OPEN` at
a time — the system blocks opening a second one.

## Prerequisites

- The round exists in `DRAFT` status (see
  [[01-create-new-assessment-round]]).
- No other round is currently `OPEN`. If there is, close it first
  (see [[03-close-a-round]]).
- You are signed in as `ADMIN`.

## Steps

1. From the sidebar, click **Rounds**.
2. Locate the `DRAFT` row for the round you want to open.
3. In the **Actions** column, click **Open Round**.
4. A confirmation dialog appears: **"Open Round {year}?"** with the
   warning that only one round can be open at a time.
5. Click **Open Round** to confirm.

## Verification

- The status badge for that row changes from **DRAFT** (grey) to
  **OPEN** (green).
- The applicant `/register` flow now accepts registrations against
  this round.
- An audit entry (`ROUND_OPENED` or equivalent) appears in
  `/audit` — see [[13-audit-log-review]].

## Troubleshooting

- **"Another round is already open"** — close the other round first
  (see [[03-close-a-round]]) and retry.
- **No Open Round button visible** — the round is not in `DRAFT`. It
  may already be `OPEN` or `CLOSED`.
