-- Backlog #13 (applicant-missing-docs-response-no-assessor-email):
-- seed the MISSING_DOCS_RESPONDED email template (single source of truth —
-- not the demo seed). Sent to the assigned assessor when an applicant
-- responds to a missing-documents request and the application leaves PAUSED.
--
-- Separate migration from the enum-add (20260524200000_add_missing_docs_responded_enum):
-- a new enum value cannot be referenced in the same transaction it is added,
-- so the INSERT must run in a later migration.
--
-- `enabled` is omitted so it falls back to the column DEFAULT (true, from
-- backlog #12) — the template is toggleable from the admin Settings UI, NOT
-- locked. Idempotent: guarded with WHERE NOT EXISTS like the other template
-- seeds. Kept in sync with prisma/seed-data/email-templates.ts.

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'MISSING_DOCS_RESPONDED',
       'Documents received — {{reference}} ({{child_name}})',
$body$Dear {{assessor_name}},

The applicant for {{child_name}} (application reference {{reference}}) has responded to your request for missing documents and uploaded the requested files.

The application has moved out of the paused state and is back in your queue for review:
{{application_link}}

Regards,
JWF Bursary System$body$,
       '["assessor_name","child_name","reference","application_link"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'MISSING_DOCS_RESPONDED');
