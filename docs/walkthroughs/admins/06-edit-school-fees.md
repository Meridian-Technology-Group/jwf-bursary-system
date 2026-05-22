# 06 — Edit school fees

Backlink: [[README#Reference data management]]

Each school (Trinity, Whitgift) has an annual fee, **pre-VAT**. The
system applies 20% VAT on top when computing the bursary
contribution. Like family types, fee edits are versioned.

## Prerequisites

- Signed in as `ADMIN`.
- You have the new annual fee (pre-VAT, in £) for the school.

## Steps

1. Sidebar → **Settings** (`/settings`).
2. Click the **School Fees** tab (second tab).
3. The table shows: **School | Annual Fees | Effective From |
   Actions**.
4. For the school you need to update, click **Edit**.
5. Enter the new annual fee (pre-VAT).
6. Click **Save**. A new row is created with today's effective date;
   the previous row remains as history.

## Verification

- The latest row for that school shows the new fee and today's
  **Effective From** date.
- New assessments use `fee × 1.20` (VAT applied automatically).
- Historical assessments retain the fee that was in effect when they
  were calculated.

## Notes

- Do **not** apply VAT manually — the calculation does it.
- See also: [[05-edit-family-type-categories]],
  [[07-edit-council-tax-default]].
