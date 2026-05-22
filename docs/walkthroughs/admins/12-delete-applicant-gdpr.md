# 12 — Delete an applicant under GDPR

Backlink: [[README#Privacy and compliance]]

Two-step destructive operation. Purges the applicant's profile,
application data, uploaded documents, assessment record, and
recommendation; anonymises the audit trail. Subject to the 7-year
retention guard for active or recently-closed bursaries.

## Prerequisites

- Signed in as `ADMIN`.
- A valid GDPR request from the data subject (keep your written
  evidence of the request — the system records the deletion but not
  the request itself).
- Confirm the application is **eligible** — applications more recent
  than 7 years and tied to an active bursary cannot be deleted; the
  system blocks them.

## Steps

1. Find the application — sidebar → **Applications** → open the
   application's detail page (`/applications/[id]`).
2. At the top of the page, open the **Actions** dropdown.
3. Click **Delete Applicant Data (GDPR)**.
4. The confirmation dialog **Permanently Delete Applicant Data?**
   opens with the warning:
   > "This will anonymise the applicant's personal data across the
   > system. This action cannot be undone. Records must be retained
   > for 7 years from submission."
5. Read the warning. To proceed click the red **I understand, delete**
   button. To abort, close the dialog.

## What happens

- Application sections and documents are deleted (Storage objects
  removed).
- Assessment and recommendation rows are deleted.
- The applicant's profile is anonymised (name and email cleared,
  role set to `DELETED`); the auth user is deleted from Supabase.
- An audit-log entry `GDPR_DELETION` is written **without** personal
  data in the entry itself.

## Verification

- The application no longer appears in the queue.
- `/audit` (see [[13-audit-log-review]]) shows the
  `GDPR_DELETION` entry, timestamped, attributed to you, with no
  personally identifying data in the metadata.
- Attempting to navigate to the old application URL returns 404.

## Troubleshooting

- **Button disabled / blocked with retention message** — the
  application is inside the 7-year retention window and tied to an
  active/recent bursary. Document the refusal in your GDPR response
  to the applicant.
- **Document still visible in Storage** — refresh the page. If the
  Storage object truly persists, raise it as a bug; the deletion
  flow should remove all files.
