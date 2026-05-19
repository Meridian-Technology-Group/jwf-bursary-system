# 13 — Audit log review (system-wide)

Backlink: [[README#Privacy and compliance]]

Open the audit page, filter, and confirm that sensitive events (name
reveals, document grants, deletions, status changes) are logged with
timestamp and acting user.

## Prerequisites

- Signed in as `ADMIN`.

## Open the page

1. Sidebar → **Audit**. You arrive at `/audit` under the heading
   **Audit Log** with the note *"System-wide activity log. All
   entries are immutable and append-only."*

## Filter the entries

The filter bar at the top of the page provides:

- **Entity type** (dropdown) — All entity types | Application |
  Document | Assessment | Invitation.
- **Action** (text input) — case-insensitive substring match,
  e.g. `SUBMITTED`, `GDPR`, `REVEAL`.
- **From** (date) and **To** (date) — `YYYY-MM-DD`.
- **Filter** button — applies your filters.
- **Clear** link — appears when at least one filter is active.

## Read an entry

Each timeline row shows:

- Coloured status dot (yellow=PAUSED, green=OUTCOME/QUALIFIES/
  SUBMITTED, blue=RESUMED, purple=DOCUMENT, red=STATUS/DELETED,
  orange=REVEAL/VERIFY).
- **Action** name in monospace (e.g. `APPLICATION_STATUS_CHANGED`,
  `GDPR_DELETION`).
- Relative timestamp (e.g. `15m ago`, `3d ago`).
- Plain-text context line summarising what happened.
- Metadata row: acting **user** | **entity type + ID** (truncated) |
  full timestamp.
- **Show metadata** link — expands the JSON payload.

## Pagination

- Footer shows `Page x of y` with **Previous** / **Next** buttons.

## Typical reviews

- **GDPR audit** — filter Action = `GDPR`, scan for `GDPR_DELETION`
  entries with timestamps and acting admin.
- **Document handling** — Entity type = Document; review uploads,
  verifications, deletes.
- **Name reveals** — Action = `REVEAL` to confirm only authorised
  assessors revealed applicant names.
- **Status changes** — Action = `STATUS` to trace lifecycle.

## Notes

- Entries are append-only. There is no edit or delete action.
- Sensitive payloads (e.g. for GDPR deletions) intentionally exclude
  personal data — see [[12-delete-applicant-gdpr]].
