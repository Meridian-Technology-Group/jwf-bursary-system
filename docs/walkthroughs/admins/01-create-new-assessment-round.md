# 01 — Create a new assessment round

Backlink: [[README#Round lifecycle]]

Creates a new round in `DRAFT` status. Applicants cannot register
against a `DRAFT` round — it must be opened separately (see
[[02-open-a-round]]).

## Prerequisites

- You are signed in as a user with the `ADMIN` role.
- You know the academic year label (format `YYYY/YY`, e.g. `2026/27`),
  the open and close dates, and ideally the funding-decision target
  date.

## Steps

1. From the admin sidebar, click **Rounds**.
   - You land on `/rounds` under the heading **Assessment Rounds**.
2. Click the **Create Round** button (top-right of the page).
3. The dialog **Create Assessment Round** opens. Fill in:
   - **Academic Year** — e.g. `2026/27`.
   - **Open Date** — the date applicants can begin registering.
   - **Close Date** — must be after Open Date.
   - **Decision Date** *(optional)* — must be after Close Date.
4. Click **Create**.
5. The dialog closes and you return to `/rounds`. The new round
   appears in the table with status badge **DRAFT** (grey).

## Verification

- The round is listed in the **Assessment Rounds** table with the
  correct Academic Year, Open Date, and Close Date.
- The status column reads **DRAFT**.
- Click the year to open `/rounds/[id]`; the summary cards all show
  `0` because no applications exist yet.

## Next step

Open the round when you are ready for applicants to register —
see [[02-open-a-round]].
