-- Backlog #8: invitation-template-mention-expiry
-- The applicant INVITATION email did not mention that the registration link
-- is single-use and expires after 30 days (both true: the token is single-use
-- and the resend flow resets a 30-day expiry). Add an approved paragraph after
-- the registration link so applicants are not left sitting on a link that
-- quietly dies. Copy wording signed off by the Bursary Office / Foundation.
--
-- Forward-only data migration. Updates the canonical INVITATION body; subject
-- and merge fields are unchanged (no new merge field — relative "30 days"
-- wording was chosen over a dynamic date). NOTE: this overwrites the body for
-- the single INVITATION row, including any ad-hoc edit made via the admin
-- Settings UI — the migration is the single source of truth for template copy.

UPDATE public.email_templates
SET body = $body$Dear {{applicant_name}},

I am writing on behalf of the John Whitgift Foundation to invite you to apply for a bursary award for {{child_name}} at {{school}} for the {{round_year}} academic year.

The John Whitgift Foundation is committed to providing bursary support to families who would not otherwise be able to afford an independent school education. We assess each application carefully and confidentially, and our aim is to ensure that financial circumstances do not prevent a deserving child from benefiting from the education we provide.

To begin your application, please visit the link below and complete the online registration form. You will be asked to provide details of your household income, assets, and family circumstances, along with supporting documentation.

Registration link: {{registration_link}}

This link is unique to you and can only be used once. For your security it will expire 30 days after the date of this email. If it expires before you have registered, please contact the Bursary Office and we will gladly send you a new one.

Please note that the deadline for submitting your completed application is {{deadline}}. Applications received after this date may not be considered for this round.

If you have any questions about the application process, please do not hesitate to contact the Bursary Office. We are happy to assist you.

We look forward to receiving your application.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
    updated_at = now()
WHERE type = 'INVITATION';
