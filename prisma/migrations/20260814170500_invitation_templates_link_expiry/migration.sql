-- =============================================================================
-- JWF Bursary System — split {{deadline}} from the link expiry (E1)
-- =============================================================================
-- Epic 13, CF-11 / CF-12, implemented per
-- docs/backlog/uat-aug-2026/sprint-01-implementation-plan.md §5 E1.
--
-- Every invitation-style send injected the invitation TOKEN EXPIRY (now + 30
-- days) as `{{deadline}}` — in six places: the four in
-- src/app/(admin)/invitations/actions.ts plus the contact-register invite and
-- the internal-request invite. The templates read that field as the deadline
-- for SUBMITTING the application, so applicants were told a date that had
-- nothing to do with the round: it moved with the send date, and a resend
-- pushed it another 30 days out.
--
-- The code fix points `{{deadline}}` at the effective SUBMISSION deadline
-- (src/lib/rounds/submission-deadline.ts, now application-type-aware). The link
-- expiry still has to be communicated — the single-use link genuinely stops
-- working — so it gets its OWN field rather than continuing to ride on
-- `{{deadline}}`:
--
--   {{deadline}}    — submit your application by this date.
--   {{link_expiry}} — the registration link stops working on this date.
--
-- This migration brings the three invitation templates in the database into
-- line with prisma/seed-data/email-templates.ts: it adds `link_expiry` to
-- `merge_fields` and adds/updates the sentence that states the expiry.
--
-- ── Notes ────────────────────────────────────────────────────────────────────
-- * Forward-only data migration, matching the precedent set by
--   20260524181527_invitation_template_mention_expiry. As there, it OVERWRITES
--   the body of these rows including any ad-hoc edit made through the admin
--   Settings UI — the migration is the single source of truth for template copy.
-- * INVITATION previously stated the expiry as relative wording ("30 days after
--   the date of this email"); that sentence becomes an explicit date, since we
--   now have one to hand. REASSESSMENT and SECONDARY_PARENT_INVITE never
--   mentioned the expiry at all and gain the same sentence.
-- * `merge_fields` is jsonb; it is REPLACED wholesale rather than appended to,
--   so re-running produces the same value (idempotent).
-- * No schema change, no new table, so no RLS work (`email_templates` keeps its
--   existing policies).
-- * A template row that does not exist is simply not updated (0 rows) — this
--   never fails on an environment seeded differently.
-- =============================================================================

-- ── INVITATION ───────────────────────────────────────────────────────────────
UPDATE public.email_templates
SET body = $body$Dear {{applicant_name}},

I am writing on behalf of the John Whitgift Foundation to invite you to apply for a bursary award for {{child_name}} at {{school}} for the {{round_year}} academic year.

The John Whitgift Foundation is committed to providing bursary support to families who would not otherwise be able to afford an independent school education. We assess each application carefully and confidentially, and our aim is to ensure that financial circumstances do not prevent a deserving child from benefiting from the education we provide.

To begin your application, please visit the link below and complete the online registration form. You will be asked to provide details of your household income, assets, and family circumstances, along with supporting documentation.

Registration link: {{registration_link}}

This link is unique to you and can only be used once. For your security it will expire on {{link_expiry}}. If it expires before you have registered, please contact the Bursary Office and we will gladly send you a new one.

Please note that the deadline for submitting your completed application is {{deadline}}. Applications received after this date may not be considered for this round.

If you have any questions about the application process, please do not hesitate to contact the Bursary Office. We are happy to assist you.

We look forward to receiving your application.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
    merge_fields = '["applicant_name","child_name","school","round_year","registration_link","deadline","link_expiry"]'::jsonb,
    updated_at = now()
WHERE type = 'INVITATION';

-- ── REASSESSMENT ─────────────────────────────────────────────────────────────
UPDATE public.email_templates
SET body = $body$Dear {{applicant_name}},

I am writing to advise you that it is now time for the annual re-assessment of the bursary currently held by {{child_name}} at {{school}}.

As you will be aware, bursary awards are subject to annual review to ensure that the level of support provided continues to reflect your current financial circumstances. We are required to reassess all bursary holders each year, and we ask that you cooperate fully with this process.

To complete the re-assessment, please log in to the application portal using the link below and complete the re-assessment form for the {{round_year}} academic year. You will be asked to provide updated information about your household income, assets, and any changes in your family circumstances since your last assessment.

Re-assessment link: {{registration_link}}

This link is unique to you and can only be used once. For your security it will expire on {{link_expiry}}. If it expires before you have logged in, please contact the Bursary Office and we will gladly send you a new one.

Please ensure that your re-assessment form and all supporting documentation are submitted by {{deadline}}. Failure to submit by this date may result in the bursary being suspended pending receipt of the required information.

If there have been any significant changes to your financial circumstances since your last assessment — whether positive or negative — please make sure these are clearly reflected in your application.

Should you have any questions about the re-assessment process, please do not hesitate to contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
    merge_fields = '["applicant_name","child_name","school","round_year","registration_link","deadline","link_expiry"]'::jsonb,
    updated_at = now()
WHERE type = 'REASSESSMENT';

-- ── SECONDARY_PARENT_INVITE ──────────────────────────────────────────────────
UPDATE public.email_templates
SET body = $body$Dear {{secondary_parent_name}},

I am writing on behalf of the John Whitgift Foundation. A bursary application for {{child_name}} at {{school}} for the {{round_year}} academic year has been started by their other parent.

Because the Foundation assesses each parent's financial circumstances independently when parents do not share a household, you are warmly invited to provide your own financial details as part of this application. Your information is treated in the strictest confidence: the other parent will not be able to see what you submit, and you will not see their details.

To contribute your part of the application, please register using the link below and complete your section of the form. You will be asked to provide details of your own household income, assets, and supporting documentation.

Registration link: {{registration_link}}

This link is unique to you and can only be used once. For your security it will expire on {{link_expiry}}. If it expires before you have registered, please contact the Bursary Office and we will gladly send you a new one.

Please complete your section by {{deadline}}. If your information is not received, the Foundation may need to assess the application on the basis of the details available, which could affect the outcome.

If you have any questions, or if you believe you have received this invitation in error, please contact the Bursary Office. We are happy to help.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
    merge_fields = '["secondary_parent_name","child_name","school","round_year","registration_link","deadline","link_expiry"]'::jsonb,
    updated_at = now()
WHERE type = 'SECONDARY_PARENT_INVITE';
