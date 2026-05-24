-- Dual-parent (separated/divorced) feature, PR 3 (backlog #20):
-- seed the three secondary-parent email templates (single source of truth —
-- not the demo seed):
--   * SECONDARY_PARENT_INVITE   → invites the second parent to confidentially
--                                 provide their own financial details.
--   * SECONDARY_PARENT_RECEIVED → confirms their information was received.
--   * SECONDARY_PARENT_REMINDER → gentle reminder before the deadline.
--
-- Separate migration from the enum-add
-- (20260524220000_add_secondary_parent_email_enums): a new enum value cannot
-- be referenced in the same transaction it is added, so these INSERTs must run
-- in a later migration.
--
-- `enabled` is omitted so it falls back to the column DEFAULT (true) — the
-- templates are toggleable from the admin Settings UI, NOT locked. Idempotent:
-- guarded with WHERE NOT EXISTS like the other template seeds. Kept in sync
-- with prisma/seed-data/email-templates.ts.

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'SECONDARY_PARENT_INVITE',
       'You are invited to contribute to a bursary application — {{child_name}}',
$body$Dear {{secondary_parent_name}},

I am writing on behalf of the John Whitgift Foundation. A bursary application for {{child_name}} at {{school}} for the {{round_year}} academic year has been started by their other parent.

Because the Foundation assesses each parent's financial circumstances independently when parents do not share a household, you are warmly invited to provide your own financial details as part of this application. Your information is treated in the strictest confidence: the other parent will not be able to see what you submit, and you will not see their details.

To contribute your part of the application, please register using the link below and complete your section of the form. You will be asked to provide details of your own household income, assets, and supporting documentation.

Registration link: {{registration_link}}

Please complete your section by {{deadline}}. If your information is not received, the Foundation may need to assess the application on the basis of the details available, which could affect the outcome.

If you have any questions, or if you believe you have received this invitation in error, please contact the Bursary Office. We are happy to help.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["secondary_parent_name","child_name","school","round_year","registration_link","deadline"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'SECONDARY_PARENT_INVITE');

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'SECONDARY_PARENT_RECEIVED',
       'Thank you — your bursary information has been received',
$body$Dear {{secondary_parent_name}},

Thank you for completing your section of the bursary application for {{child_name}} at {{school}}. We confirm that your financial information and supporting documents have been received.

Your details will be considered confidentially alongside the rest of the application as part of the {{round_year}} assessment. There is nothing further you need to do at this stage.

If your circumstances change before the assessment is completed, or if you have any questions, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["secondary_parent_name","child_name","school","round_year"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'SECONDARY_PARENT_RECEIVED');

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'SECONDARY_PARENT_REMINDER',
       'Reminder: your bursary contribution for {{child_name}}',
$body$Dear {{secondary_parent_name}},

This is a gentle reminder that we have not yet received your section of the bursary application for {{child_name}} at {{school}} for the {{round_year}} academic year.

So that the Foundation can assess the application fully and fairly, we would be grateful if you could complete your section, including your household income, assets, and supporting documents. Your information remains entirely confidential to you.

Registration link: {{registration_link}}

Please aim to complete your section by {{deadline}}. If your information is not received, the Foundation may need to assess the application on the basis of the details available, which could affect the outcome.

If you have already completed your section, please disregard this message. If you have any questions, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["secondary_parent_name","child_name","school","round_year","registration_link","deadline"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'SECONDARY_PARENT_REMINDER');
