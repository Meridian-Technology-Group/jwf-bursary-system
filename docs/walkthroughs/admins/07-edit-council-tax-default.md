# 07 — Edit the council tax default

Backlink: [[README#Reference data management]]

The system uses a default council tax figure (Band D, Croydon) in
the income calculation when an applicant's actual figure is not
captured. The value is versioned like other reference data.

## Prerequisites

- Signed in as `ADMIN`.
- You have the new annual council tax figure for Band D Croydon (£).

## Steps

1. Sidebar → **Settings** (`/settings`).
2. Click the **Council Tax** tab (third tab).
3. The page shows the **Council Tax Default** card — currently Band
   D, Croydon — with the current annual figure.
4. Click **Edit** (or enter the value directly into the input).
5. Type the new annual figure.
6. Click **Save**.

## Verification

- The card now displays the new figure with today's effective date.
- New assessments use the new figure; historical assessments retain
  the value at the time they were calculated.

## Notes

- The label "Band D, Croydon" is fixed — only the figure changes.
- See also: [[05-edit-family-type-categories]], [[06-edit-school-fees]].
