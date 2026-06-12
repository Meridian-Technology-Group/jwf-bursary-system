-- Missing Documents Workflow.
--
-- (1) MISSING_DOCS — inject the assessor's personal note ({{custom_message}})
--     into the body and add it to merge_fields. The note is the contextual
--     greeting the assessor writes when requesting documents (e.g. "the pay
--     slips provided appear to be from a previous role…"). The action always
--     supplies a value (a neutral default when the assessor leaves it blank),
--     so the body reads correctly either way. Idempotent UPDATE — re-running
--     simply re-sets the same content; safe for envs that already have the row.
--
-- (2) APPLICATION_RESTART_REQUIRED — NEW template for the Full Rejection flow,
--     sent when an assessor rejects a submission outright and a fresh blank
--     application has been created for the applicant to complete. INSERT only
--     when absent so it is safe to re-run and to merge into prod.
--
-- Kept in sync with prisma/seed-data/email-templates.ts.

-- ── (1) MISSING_DOCS — add personal note ─────────────────────────────────────
UPDATE public.email_templates
SET body = $body$Dear {{applicant_name}},

{{custom_message}}

To enable us to complete our assessment of your bursary application for {{child_name}} (reference: {{reference}}), the following documents are still required:

{{missing_documents}}

Please submit the outstanding documents through your online application portal as soon as possible, and no later than {{deadline}}. Without these documents, we are unable to progress your application further.

If you experience any difficulty with the upload process, or if you are unable to provide a particular document, please contact the Bursary Office as soon as possible so that we can discuss alternative arrangements.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
    merge_fields = '["applicant_name","custom_message","child_name","reference","missing_documents","deadline"]'::jsonb,
    updated_at = now()
WHERE type = 'MISSING_DOCS';

-- ── (2) APPLICATION_RESTART_REQUIRED ─────────────────────────────────────────
INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'APPLICATION_RESTART_REQUIRED',
       'Your bursary application needs to be resubmitted — {{child_name}}',
$body$Dear {{applicant_name}},

{{custom_message}}

Having reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}), we are unable to proceed with it in its current form. We have therefore closed that submission and ask that you complete a new application.

A fresh application has been prepared for you. Please log in to your online application portal using the link below to complete and submit it:

{{restart_link}}

When completing your new application, please take particular care to provide clear, current, and valid supporting documents. If you have any questions about what is required, or if you would like to discuss your application, please contact the Bursary Office — we are happy to help.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["applicant_name","child_name","reference","custom_message","restart_link"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'APPLICATION_RESTART_REQUIRED');
