-- Epic 08 — seed the two new outcome email templates (single source of truth:
-- email templates are migration-managed, never the demo seed — see CLAUDE.md).
--
-- The legacy OUTCOME_QUALIFIES / OUTCOME_DNQ rows are retained untouched
-- (back-compat — any historic flow still resolves them). These two new rows back
-- the 3-value outcome lifecycle:
--   * OUTCOME_AWARDED               → the panel's "Approved Bursary": confirms
--                                     the bursary award (and scholarship award,
--                                     if granted) the rolling account carries.
--   * OUTCOME_QUALIFIES_NOT_AWARDED → assessed as eligible but not granted this
--                                     round (held per the retention policy).
--
-- Split from the enum-add (20260606180100_outcome_email_enums): a new enum value
-- cannot be referenced in the same transaction it is added.
--
-- `enabled` is omitted so it falls back to the column DEFAULT (true) — toggleable
-- from admin Settings, not locked. Idempotent (WHERE NOT EXISTS), kept in sync
-- with prisma/seed-data/email-templates.ts.

-- ── OUTCOME_AWARDED ──────────────────────────────────────────────────────────
INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'OUTCOME_AWARDED',
       'Bursary assessment outcome — {{child_name}}',
$body$Dear {{applicant_name}},

I am very pleased to write to you regarding the outcome of the bursary assessment for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

Having carefully considered all of the information provided in your application, including your household income, assets, and family circumstances, the Bursary Committee has determined that {{child_name}} has been awarded a bursary.

Full details of the award, including the level of support, any scholarship element, and any applicable conditions, will be set out in a separate award letter which will follow shortly. Please read that letter carefully, as it will contain important information about how the award will be administered and what is required of you to maintain it.

We are delighted to be able to support {{child_name}}'s education at {{school}}, and we hope that this award will make a real difference to your family. Should your circumstances change at any point, you are required to notify the Bursary Office without delay, as this may affect the level of support provided.

If you have any questions, please do not hesitate to contact us.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["applicant_name","child_name","school","reference","academic_year"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'OUTCOME_AWARDED');

-- ── OUTCOME_QUALIFIES_NOT_AWARDED ────────────────────────────────────────────
INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'OUTCOME_QUALIFIES_NOT_AWARDED',
       'Bursary assessment outcome — {{child_name}}',
$body$Dear {{applicant_name}},

Thank you for submitting a bursary application for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

We have given careful consideration to all of the information and documentation you provided. Having completed our assessment, I can confirm that {{child_name}}'s application has been assessed as eligible for bursary support.

Unfortunately, on this occasion we are not able to offer an award in this round. Bursary funding is limited, and the Foundation must make awards within the resources available to it. Your application has been retained, and {{child_name}} remains eligible to be considered in a future round.

We understand that this may be disappointing news, and we are sorry that we are unable to offer an award at this time. If your financial circumstances change significantly, or if you would like to discuss the outcome, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["applicant_name","child_name","school","reference","academic_year"]'::jsonb,
       now()
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'OUTCOME_QUALIFIES_NOT_AWARDED');
