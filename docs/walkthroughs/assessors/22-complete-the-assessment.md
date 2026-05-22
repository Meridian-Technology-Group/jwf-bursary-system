# 22 — Complete the assessment

Backlink: [[README#Tab 3 — Writing the recommendation]]

Set the application's outcome to **Qualifies** or **Does Not Qualify**.
Triggers an outcome email to the lead applicant and locks the
recommendation.

## Prerequisites

- Assessment status `COMPLETED`.
- All recommendation fields saved (synopsis, categories, summary,
  reason codes).
- The application status is `COMPLETED` (not yet terminal).

## Steps

1. Scroll to the **Set Application Outcome** card at the bottom of the
   recommendation tab. Strapline: *"Once the outcome is set, an email
   is sent to the lead applicant and this recommendation becomes
   read-only."*
2. Click either:
   - **Qualifies** (green, check icon), or
   - **Does Not Qualify** (rose, X icon).
3. The **OutcomeDialog** opens with title *"Confirm: Qualifies"* or
   *"Confirm: Does Not Qualify"* and body *"This will mark the
   application as QUALIFIES / DOES NOT QUALIFY and send an outcome
   email to the lead applicant. This action cannot be undone."*
4. Click **Confirm Qualifies** / **Confirm Does Not Qualify** in the
   dialog footer.
5. The server action `setApplicationOutcomeAction` runs:
   - Application status transitions `COMPLETED` →
     `QUALIFIES` / `DOES_NOT_QUALIFY`.
   - The corresponding outcome email template (`OUTCOME_QUALIFIES` /
     `OUTCOME_DOES_NOT_QUALIFY`) is sent via Resend.
   - The recommendation form switches to read-only with the slate
     banner *"This application has a terminal status of QUALIFIES /
     DOES NOT QUALIFY. Recommendation is read-only."*

## Verification

- The status badge at the top of the application shows **Qualifies**
  (green) or **Does Not Qualify** (red).
- The **Actions** bar on the application detail page disappears
  (terminal status).
- The audit log records `APPLICATION_STATUS_CHANGED` to the new
  outcome and the email send.
- The applicant receives the outcome email.

## Notes

- The same outcome buttons exist on the actions bar (top of the
  application detail) when status is `COMPLETED`. Either route writes
  identical audit entries.
- For GDPR / corrective scenarios (wrong outcome sent), use the audit
  log to identify the change, then ask an admin to reverse via direct
  DB intervention — there is no in-app "undo terminal status".
