# 08 — Manage reason codes

Backlink: [[README#Reference data management]]

Reason codes are the standardised explanations assessors attach to
year-on-year re-assessment decisions. Around 35 ship with the system.
You can add, edit, or deprecate codes. Deprecated codes are hidden
from new assessments but remain visible on historical records.

## Prerequisites

- Signed in as `ADMIN`.

## Steps — add a code

1. Sidebar → **Settings** (`/settings`).
2. Click the **Reason Codes** tab (fourth tab).
3. Click **Add Reason Code**.
4. Enter the **code** (short key) and **label** (user-facing text).
5. Set the **sort order** (lower numbers appear first in dropdowns).
6. Click **Save**.

## Steps — edit a code

1. Same tab, find the code row.
2. Click **Edit** in its Actions cell.
3. Update label and/or sort order. The code key itself should not
   change once it has been used on assessments.
4. Click **Save**.

## Steps — deprecate a code

1. Same tab, find the code row.
2. Click **Deprecate** in its Actions cell.
3. Confirm.

The note on the page reads *"Deprecated codes are hidden from
assessors but retained for historical records."*

## Verification

- New codes appear in the assessor's reason-code dropdown on the
  recommendation page.
- Deprecated codes no longer appear in dropdowns but are still
  displayed on assessments and PDFs that already reference them.
