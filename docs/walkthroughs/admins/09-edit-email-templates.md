# 09 — Edit email templates

Backlink: [[README#Reference data management]]

The system sends seven transactional emails: invitation, submission
confirmation, missing documents, outcome qualifies, outcome does not
qualify, re-assessment invitation, and reminder. The subject line
and body are editable per template; merge fields are documented
inline in the editor.

## Prerequisites

- Signed in as `ADMIN`.

## Steps

1. Sidebar → **Settings** (`/settings`).
2. Click the **Email Templates** tab (fifth tab).
3. Choose a template from the list (e.g. *Invitation*, *Outcome
   Qualifies*).
4. Edit the **Subject** field.
5. Edit the **Body** field. Use merge fields shown inline — for
   example `{{applicant_name}}`, `{{child_name}}`, `{{school}}`,
   `{{round_year}}`, `{{deadline}}`, `{{registration_link}}`. Only the
   merge fields listed for that specific template will resolve.
6. Click **Save**.

## Verification

- Trigger the relevant flow in a non-production environment (e.g.
  send a test invitation from [[10-invite-a-staff-member]] or
  [[11-batch-reassessment-invitations]]).
- Confirm the received email shows the updated subject and body with
  merge fields populated.

## Notes

- Email templates are seeded by the `*_seed_email_templates`
  migration — edits made in the UI persist in the database and
  override the seed.
- Keep the `{{registration_link}}` merge field in invitation
  templates — removing it will break the registration flow.
