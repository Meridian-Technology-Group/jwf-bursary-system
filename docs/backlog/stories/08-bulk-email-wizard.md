# Item 8: Bulk email — "Send Email" wizard

> Source: `docs/backlog/post-demo-change-list.md` — item 8. Status: Not started.

Staff need to email a group of applicants (e.g. everyone in a round, or a filtered subset) in one action rather than opening each application. This is a three-step wizard launched from the Applications list bulk toolbar: pick a template, confirm the resolved recipient list, then send via the existing Resend integration with merge-field rendering, an audit entry per send, and a per-recipient result summary. It depends on template management (item 9) for the pool of available templates.

## Story 8.1 — Launch the Send Email wizard from the Applications list
**As an** ADMIN or ASSESSOR, **I want** a "Send email" bulk action on the Applications list, **so that** I can email a batch of selected applicants without opening each one.

**Acceptance criteria**
- [ ] Given one or more application rows are selected, when I open the bulk toolbar, then a "Send email" action is shown alongside the existing bulk actions (assign assessor, re-assessment invite).
- [ ] Given no rows are selected, when I look at the bulk toolbar, then "Send email" is disabled (or the toolbar is hidden) so the wizard cannot start with an empty selection.
- [ ] When I trigger "Send email", then a modal/wizard opens on step 1 (template selection) and shows a step indicator (1 Template → 2 Recipients → 3 Send).
- [ ] Given I am a VIEWER, when I view the bulk toolbar, then "Send email" is not available (send is restricted to ADMIN/ASSESSOR).
- [ ] The wizard carries the set of selected application IDs through all three steps; closing/cancelling the wizard at any step sends nothing.

**Notes / dependencies**
- Mirror the existing `BulkToolbar` / assign-assessor pattern for consistency.
- Confirm with Charlotte whether ASSESSOR may send bulk email or whether it is ADMIN-only; default to ADMIN + ASSESSOR, exclude VIEWER.

## Story 8.2 — Step 1: choose an email template
**As a** sender, **I want** to pick from the existing email templates, **so that** the batch goes out with approved, consistent wording.

**Acceptance criteria**
- [ ] Given the wizard is on step 1, when it loads, then it lists the active templates from `email_templates` (subject + name) for selection.
- [ ] When I select a template, then I can see a preview of its subject and body (with merge-field placeholders shown, e.g. as they will be substituted per recipient — see 8.3).
- [ ] Given no template is selected, when I try to continue, then the "Next" action is disabled and I cannot advance to recipient confirmation.
- [ ] Given templates change in Settings (item 9), when I open the wizard, then the picker reflects the current set (no stale/removed templates offered).

**Notes / dependencies**
- Reads the same `email_templates` source used elsewhere; related to item 9 (add/delete templates) — deleted templates must not appear here.
- No template editing happens inside the wizard; it only selects.

## Story 8.3 — Step 2: confirm and deselect recipients
**As a** sender, **I want** to see the resolved recipient email addresses and remove any I do not want to email, **so that** the batch only reaches the intended people and no email goes to a blank or wrong address.

**Acceptance criteria**
- [ ] Given a set of selected applications, when step 2 loads, then each row shows the application, the lead-applicant name, and the resolved lead-applicant email address to which the message will be sent.
- [ ] Given an application has no resolvable lead-applicant email (missing/blank), when the list renders, then that row is flagged as unsendable and is excluded from (or pre-deselected in) the send set, with a clear reason shown.
- [ ] When I untick a recipient, then that recipient is excluded from the send and the recipient count updates.
- [ ] Given a template contains merge fields, when I view a recipient, then I can preview the message rendered with that recipient's merged values (or a representative sample), so I can confirm fields resolve correctly.
- [ ] Given every recipient has been deselected (or all are unsendable), when I try to continue, then "Next"/"Send" is disabled.
- [ ] The confirmed recipient count and the sending address (from-domain) are visible before the send step.

**Notes / dependencies**
- Recipient resolution targets the lead applicant's email per application; confirm behaviour when an application has multiple contacts (item 4/dual-parent work) — default to lead applicant only.
- Merge-field rendering reuses the existing merge-field mechanism used by transactional emails.

## Story 8.4 — Step 3: send, with per-send audit and partial-failure reporting
**As a** sender, **I want** to send the batch and see exactly which emails succeeded and which failed, **so that** I can trust delivery and follow up on any failures without re-sending to everyone.

**Acceptance criteria**
- [ ] Given a confirmed recipient list, when I confirm send on step 3, then each recipient is emailed via the existing Resend integration using the selected template with per-recipient merge-field substitution.
- [ ] Given the send is in progress, when recipients are being processed, then I see progress feedback and cannot double-submit the same batch.
- [ ] For every attempted send, an audit entry is written (`audit_logs` is append-only) recording the actor, template, application/recipient, timestamp, and outcome (sent/failed).
- [ ] Given one or more sends fail (e.g. Resend rejects an address), when the batch completes, then the remaining recipients are still sent — a single failure does not abort the whole batch.
- [ ] When the batch finishes, then I see a per-recipient result summary listing successes and failures (with the failure reason where available) and a total count (e.g. "18 sent, 2 failed").
- [ ] Given failures occurred, when I view the summary, then I can identify the failed recipients clearly enough to retry or correct them (retry mechanism itself may be a follow-up; at minimum the failures are actionable).

**Notes / dependencies**
- Send loop must be resilient: catch per-recipient errors, continue the batch, aggregate results.
- Audit action name should follow existing conventions (e.g. a `BULK_EMAIL_SENT` action per recipient); confirm naming against the audit-trail vocabulary.
- Local Resend key is invalid (per project notes) — bulk send is only testable from a deployed environment.
