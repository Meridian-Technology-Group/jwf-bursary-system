-- Charlotte (7 Nov 2026): outcome emails are never wanted. The school decides
-- and writes to every family on the same day, outside the system. The code no
-- longer sends any outcome email (set-outcome-core), so the four outcome
-- system templates are removed outright, so they no longer appear in Settings.
--
-- The EmailTemplateType enum values stay: removing a Postgres enum value means
-- rebuilding the type, and email_log.template_type may name them. Nothing else
-- references email_templates rows by id for these types.
DELETE FROM public.email_templates
WHERE type IN (
  'OUTCOME_QUALIFIES',
  'OUTCOME_DNQ',
  'OUTCOME_AWARDED',
  'OUTCOME_QUALIFIES_NOT_AWARDED'
);
