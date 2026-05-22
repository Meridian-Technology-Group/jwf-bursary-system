# Admin Walkthroughs

The Admin owns the **system itself** — rounds, reference data, staff
accounts, GDPR, email templates, audit trails. They set up the
infrastructure that assessors and applicants then use.

Foundation staff with the Admin role can do everything an Assessor
can, plus the system-level workflows listed below. In practice one
person may wear both hats day-to-day; the split here is by
responsibility area, not by employee.

## Workflows

Each item below has its own guide in this folder.

### Round lifecycle

- [[01-create-new-assessment-round|**Create a new assessment round**]] — set the academic year label,
  application open date, close date, and the funding-decision target
  date. Round starts in `DRAFT` status.
- [[02-open-a-round|**Open a round**]] — transition a `DRAFT` round to `OPEN`. Only one
  round can be `OPEN` at a time; the system blocks opening a second
  one. Applicants can only register against an `OPEN` round.
- [[03-close-a-round|**Close a round**]] — transition an `OPEN` round to `CLOSED`. No new
  applications can be submitted against it after closure; existing
  in-flight applications can still be assessed.
- [[04-view-historical-rounds|**View historical rounds**]] — every prior round remains visible for
  reporting and re-assessment comparison.

### Reference data management

Each of these is a separate guide because each table has its own
shape and "effective date" semantics.

- [[05-edit-family-type-categories|**Edit family type categories**]] — the six categories (1–6) and
  their notional rent, utility costs, and food costs. Changes apply
  to new assessments only; historical assessments retain the values
  in effect at the time.
- [[06-edit-school-fees|**Edit school fees**]] — annual fees per school (Trinity, Whitgift),
  pre-VAT. Same effective-date model as above.
- [[07-edit-council-tax-default|**Edit the council tax default**]] — Band D Croydon by default;
  editable.
- [[08-manage-reason-codes|**Manage reason codes**]] — the ~35 year-on-year reason codes used
  on re-assessments. Add new codes, edit labels, mark codes
  deprecated (deprecated codes hide from new assessments but remain
  visible on historical records), set sort order.
- [[09-edit-email-templates|**Edit email templates**]] — subject and body for the seven email
  templates (invitation, submission confirmation, missing documents,
  outcome qualifies, outcome does not qualify, re-assessment
  invitation, reminder). Merge fields are documented inline in the
  editor.

### Staff and applicant invitations

- [[10-invite-a-staff-member|**Invite a staff member**]] — send a `/register/staff` invitation
  to a new admin, assessor, or viewer. Triggered from the Users page;
  the recipient sets their own password via the registration link.
- [[11-batch-reassessment-invitations|**Batch re-assessment invitations**]] — at the start of a new round,
  email every active bursary holder a re-assessment invitation in
  one action. The batch creates one invitation row per active
  bursary account, pre-populated with the child and round.
- (Single applicant invitations as part of round intake are an
  Assessor workflow — see `../assessors/`.)

### Privacy and compliance

- [[12-delete-applicant-gdpr|**Delete an applicant under GDPR**]] — two-step confirmation; purges
  the applicant's profile, application data, uploaded documents,
  assessment record, and recommendation. An audit-log entry is
  created with no personal data in the entry itself. Subject to the
  7-year retention guard for active or recently-closed bursaries.
- [[13-audit-log-review|**Audit log review (system-wide)**]] — open the audit page, filter
  by user / action / entity / date range, and confirm sensitive
  events (name reveals, document grants, deletions, status changes)
  are logged with timestamp + user.

### Operations

- [[14-reset-staff-mfa|**Reset another staff member's MFA**]] — when an assessor loses
  their authenticator device. Requires admin access to the
  Supabase dashboard or MCP (delete the row in `auth.mfa_factors`).
  **NOTE:** staff MFA (B8) shipped to production and is enforced; an
  admin can reset another staff member's factor from the Users page,
  with the Supabase-dashboard/MCP route as the manual fallback. The
  decision record is archived at
  `docs/archive/backlog/b8-mfa-for-admin-and-assessor.md`.
- [[15-resend-or-revoke-invitation|**Re-send or revoke an invitation**]] — when an invitation email is
  lost, expired, or sent in error. Re-send pushes a fresh link;
  revoke marks the invitation expired so the link cannot be used.
- **Force redeploy or run a one-off migration** — covered by the
  technical/operational runbook (`docs/` ops guide, separate from
  this folder).

### Cross-link

Admins are also Assessors. For day-to-day applicant case work — the
queue, assessments, recommendations, exports, sibling linking,
internal/ad-hoc requests — see [`../assessors/`](../assessors/).
