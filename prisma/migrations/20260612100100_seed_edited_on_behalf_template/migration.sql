-- CR-001 Edit-on-Behalf.
--
-- APPLICATION_EDITED_ON_BEHALF — NEW template, sent once when a member of the
-- Bursary Office finishes an editing pass on an applicant's form, listing the
-- sections that were entered or amended on their behalf. INSERT only when
-- absent so it is safe to re-run and to merge into prod.
--
-- Kept in sync with prisma/seed-data/email-templates.ts.

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'APPLICATION_EDITED_ON_BEHALF',
       'Your bursary application has been updated — {{child_name}}',
$body$Dear {{applicant_name}},

I am writing to let you know that a member of the Bursary Office team has updated the bursary application for {{child_name}} (reference: {{reference}}) on your behalf on {{edited_date}}.

The following sections were entered or amended on your behalf:

{{edited_sections}}

You can review your submitted application in your online application portal at any time. The information shown there is read-only, so nothing further is required of you.

If anything in the updated information looks incorrect, or if you have any questions about the changes, please contact the Bursary Office and we will be happy to help.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["applicant_name","child_name","reference","edited_sections","edited_date"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'APPLICATION_EDITED_ON_BEHALF');
