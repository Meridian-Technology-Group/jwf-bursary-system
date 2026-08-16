-- Epic 14 B2 (CG-07/CG-08, LA-2) — Charlotte's default missing-documents
-- email, verbatim from her 2026-08-16 request (Gmail 1a009e2ebb90dc14).
--
-- Migrations are the single source of truth for email templates (repo
-- CLAUDE.md); this row-update supersedes the 20260513220100 seed copy.
-- Note: her body has no {{custom_message}} slot, so the dialog's personal
-- note no longer appears in the email — flagged to Charlotte via Brian
-- rather than silently re-inserted. Replies land at fees@ via the B1
-- replyTo; the portal /respond flow stays available but is deliberately
-- not mentioned (LA-2).

UPDATE public.email_templates
SET subject      = 'JWF - Your bursary assessment has been paused.',
    body         = $body$Dear {{applicant_name}}

Thank you for submitting your bursary application. We have had to pause our assessment as we are missing the following clarification/documents:

{{missing_documents}}

Please kindly send us by email these documents and we will attach them to your application.

Please ensure that we receive these additional document/information by {{deadline}}

Kind regards

JWF Bursary team$body$,
    merge_fields = '["applicant_name","missing_documents","deadline"]'::jsonb,
    updated_at   = now()
WHERE type = 'MISSING_DOCS';

-- Fresh databases that somehow lack the row (the 20260513220100 seed should
-- have created it) get it inserted with the same copy.
INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'MISSING_DOCS',
       'JWF - Your bursary assessment has been paused.',
$body$Dear {{applicant_name}}

Thank you for submitting your bursary application. We have had to pause our assessment as we are missing the following clarification/documents:

{{missing_documents}}

Please kindly send us by email these documents and we will attach them to your application.

Please ensure that we receive these additional document/information by {{deadline}}

Kind regards

JWF Bursary team$body$,
       '["applicant_name","missing_documents","deadline"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'MISSING_DOCS');
