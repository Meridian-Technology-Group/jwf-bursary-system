-- Epic 14 B3 (CG-26, LA-3) — five invitation template variants, part 2 of 2.
--
-- 1. InvitationSituation enum + nullable situation columns on contacts and
--    invitations (additive; legacy rows stay NULL and fall back to the
--    generic INVITATION template).
-- 2. Seed the five variant rows. The four situation×school variants clone
--    the current INVITATION body (Charlotte edits wording in Settings); the
--    rolling variant mentions the portal re-opening and the submission
--    window via {{opening_date}} + {{deadline}} — both sourced from the
--    round (Epic 13 E1 resolver), never the token expiry.
-- No new tables, so no RLS work; email_templates policies already exist.

-- ── 1. Situation enum + columns ─────────────────────────────────────────────
CREATE TYPE "InvitationSituation" AS ENUM ('NEW', 'INTERNAL', 'ROLLING_OVER');

ALTER TABLE "public"."contacts"
  ADD COLUMN "situation" "InvitationSituation";

ALTER TABLE "public"."invitations"
  ADD COLUMN "situation" "InvitationSituation";

-- ── 2. Seed the five variants ───────────────────────────────────────────────
-- Bodies for the four situation×school variants: the INVITATION copy as of
-- this migration (frozen here; the live INVITATION row may have been edited
-- in Settings — these are new rows, so freezing the seed copy is correct).

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(), v.type, v.subject, b.body,
       '["applicant_name","child_name","school","round_year","registration_link","deadline","link_expiry"]'::jsonb,
       now()
FROM (VALUES
  ('INVITATION_NEW_TS'::"EmailTemplateType",
   'Invitation to apply for a bursary — {{child_name}}'),
  ('INVITATION_NEW_WS'::"EmailTemplateType",
   'Invitation to apply for a bursary — {{child_name}}'),
  ('INVITATION_INTERNAL_TS'::"EmailTemplateType",
   'Invitation to apply for a bursary — {{child_name}}'),
  ('INVITATION_INTERNAL_WS'::"EmailTemplateType",
   'Invitation to apply for a bursary — {{child_name}}')
) AS v(type, subject),
LATERAL (SELECT $body$Dear {{applicant_name}},

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
John Whitgift Foundation$body$ AS body) AS b
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates e WHERE e.type = v.type
);

INSERT INTO public.email_templates (id, type, subject, body, merge_fields, updated_at)
SELECT gen_random_uuid(),
       'INVITATION_ROLLING',
       'Your bursary application portal has re-opened — {{child_name}}',
$body$Dear {{applicant_name}},

I am writing on behalf of the John Whitgift Foundation regarding the bursary for {{child_name}} at {{school}} for the {{round_year}} academic year.

The application portal re-opened on {{opening_date}} for rolling-over bursary applications. Please complete and submit your application by {{deadline}}. Applications received after this date may not be considered for this round.

To begin, please visit the link below.

Registration link: {{registration_link}}

This link is unique to you and can only be used once. For your security it will expire on {{link_expiry}}. If it expires before you have registered, please contact the Bursary Office and we will gladly send you a new one.

If you have any questions about the application process, please do not hesitate to contact the Bursary Office. We are happy to assist you.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$body$,
       '["applicant_name","child_name","school","round_year","registration_link","opening_date","deadline","link_expiry"]'::jsonb,
       now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE type = 'INVITATION_ROLLING'
);
