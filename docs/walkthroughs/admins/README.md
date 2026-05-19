# Admin Walkthroughs

The Admin owns the **system itself** — rounds, reference data, staff
accounts, GDPR, email templates, audit trails. They set up the
infrastructure that assessors and applicants then use.

Foundation staff with the Admin role can do everything an Assessor
can, plus the system-level workflows listed below. In practice one
person may wear both hats day-to-day; the split here is by
responsibility area, not by employee.

## Workflows

Each item below will become its own guide (`<slug>.md`) in this
folder.

### Round lifecycle

- **Create a new assessment round** — set the academic year label,
  application open date, close date, and the funding-decision target
  date. Round starts in `DRAFT` status.
- **Open a round** — transition a `DRAFT` round to `OPEN`. Only one
  round can be `OPEN` at a time; the system blocks opening a second
  one. Applicants can only register against an `OPEN` round.
- **Close a round** — transition an `OPEN` round to `CLOSED`. No new
  applications can be submitted against it after closure; existing
  in-flight applications can still be assessed.
- **View historical rounds** — every prior round remains visible for
  reporting and re-assessment comparison.

### Reference data management

Each of these is a separate guide because each table has its own
shape and "effective date" semantics.

- **Edit family type categories** — the six categories (1–6) and
  their notional rent, utility costs, and food costs. Changes apply
  to new assessments only; historical assessments retain the values
  in effect at the time.
- **Edit school fees** — annual fees per school (Trinity, Whitgift),
  pre-VAT. Same effective-date model as above.
- **Edit the council tax default** — Band D Croydon by default;
  editable.
- **Manage reason codes** — the ~35 year-on-year reason codes used
  on re-assessments. Add new codes, edit labels, mark codes
  deprecated (deprecated codes hide from new assessments but remain
  visible on historical records), set sort order.
- **Edit email templates** — subject and body for the seven email
  templates (invitation, submission confirmation, missing documents,
  outcome qualifies, outcome does not qualify, re-assessment
  invitation, reminder). Merge fields are documented inline in the
  editor.

### Staff and applicant invitations

- **Invite a staff member** — send a `/register/staff` invitation
  to a new admin, assessor, or viewer. Triggered from the Users page;
  the recipient sets their own password via the registration link.
- **Batch re-assessment invitations** — at the start of a new round,
  email every active bursary holder a re-assessment invitation in
  one action. The batch creates one invitation row per active
  bursary account, pre-populated with the child and round.
- (Single applicant invitations as part of round intake are an
  Assessor workflow — see `../assessors/`.)

### Privacy and compliance

- **Delete an applicant under GDPR** — two-step confirmation; purges
  the applicant's profile, application data, uploaded documents,
  assessment record, and recommendation. An audit-log entry is
  created with no personal data in the entry itself. Subject to the
  7-year retention guard for active or recently-closed bursaries.
- **Audit log review (system-wide)** — open the audit page, filter
  by user / action / entity / date range, and confirm sensitive
  events (name reveals, document grants, deletions, status changes)
  are logged with timestamp + user.

### Operations

- **Reset another staff member's MFA** — when an assessor loses
  their authenticator device. Requires admin access to the
  Supabase dashboard or MCP (delete the row in `auth.mfa_factors`).
  **NOTE:** MFA itself is currently in the backlog as B8; this
  guide will land alongside that work. See
  `docs/backlog/b8-mfa-for-admin-and-assessor.md`.
- **Re-send or revoke an invitation** — when an invitation email is
  lost, expired, or sent in error. Re-send pushes a fresh link;
  revoke marks the invitation expired so the link cannot be used.
- **Force redeploy or run a one-off migration** — covered by the
  technical/operational runbook (`docs/` ops guide, separate from
  this folder).

### Cross-link

Admins are also Assessors. For day-to-day applicant case work — the
queue, assessments, recommendations, exports, sibling linking,
internal/ad-hoc requests — see [`../assessors/`](../assessors/).
