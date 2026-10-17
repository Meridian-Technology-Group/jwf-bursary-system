-- Epic 23 T7 — Reject returns the form (Charlotte, 16 Oct 2026, decision 4).
--
-- A rejected form now goes back to the family with its answers and documents
-- instead of being deleted and recreated. Three additive changes:
--
-- (1) submitted_at may be CLEARED (a returned form is back in the family's
--     hands; the next submission stamps its own date), but still never
--     rewritten: a set value can only change to NULL, and only the submit path
--     stamps a NULL with now(). The material-change reopen keeps its date as
--     before. Replaces enforce_submitted_at_immutable (20260605181936) in place.
--
-- (2) application_rejections gains the note staff wrote and the new Submit by,
--     which the portal's "returned for correction" banner shows.
--
-- (3) APPLICATION_RESTART_REQUIRED (locked type, so no new enum value) gets the
--     "returned for correction" wording with the {{deadline}} merge field.
--     Updated ONLY where the subject and body still equal one of the two texts
--     we shipped: the seed (20260611120100; prod) or our 16 Aug 2026
--     house-style edit (nonprod, migration staging). The comparison ignores
--     carriage returns (the Settings editor stores CRLF). A template edited to
--     anything else is left alone. In sync with prisma/seed-data/email-templates.ts.
--
-- Prod blast radius: (1) and (2) change no rows; (3) updates one row.

-- ── (1) submitted_at: cleared yes, rewritten never ───────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_submitted_at_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.submitted_at IS NOT NULL
     AND NEW.submitted_at IS NOT NULL
     AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION
      'submitted_at is write-once and cannot be changed after submission (application %)',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ── (2) application_rejections: the note and the new Submit by ──────────────
-- AlterTable
ALTER TABLE "application_rejections" ADD COLUMN     "message" TEXT,
ADD COLUMN     "new_submit_by" TIMESTAMPTZ(6);

-- ── (3) APPLICATION_RESTART_REQUIRED wording ─────────────────────────────────
UPDATE public.email_templates
SET subject = $subject$Your bursary application has been returned for correction — {{child_name}}$subject$,
    body = $body$Dear {{applicant_name}},

{{custom_message}}

We have reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}) and have returned it to you for correction.

Your previous answers and documents are still there. Please log in to your online application portal using the link below, correct the sections that no longer show a green tick, and resubmit your application by {{deadline}}:

{{restart_link}}

If you have any questions about what needs to change, please email our team at fees@johnwhitgiftfoundation.org.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

JWF Bursary team$body$,
    merge_fields = '["applicant_name","child_name","reference","custom_message","restart_link","deadline"]'::jsonb,
    updated_at = now()
WHERE type = 'APPLICATION_RESTART_REQUIRED'
  AND subject = $subject$Your bursary application needs to be resubmitted — {{child_name}}$subject$
  AND (
    replace(body, E'\r', '') = $seed$Dear {{applicant_name}},

{{custom_message}}

Having reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}), we are unable to proceed with it in its current form. We have therefore closed that submission and ask that you complete a new application.

A fresh application has been prepared for you. Please log in to your online application portal using the link below to complete and submit it:

{{restart_link}}

When completing your new application, please take particular care to provide clear, current, and valid supporting documents. If you have any questions about what is required, or if you would like to discuss your application, please contact the Bursary Office — we are happy to help.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation$seed$
    OR replace(body, E'\r', '') = $aug$Dear {{applicant_name}},

{{custom_message}}

Having reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}), we are unable to proceed with it in its current form. We have therefore closed that submission and ask that you complete a new application.

A fresh application has been prepared for you. Please log in to your online application portal using the link below to complete and submit it:

{{restart_link}}

When completing your new application, please take particular care to provide clear, current, and valid supporting documents. If you have any questions about what is required, please email our team at fees@johnwhitgiftfoundation.org.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

JWF Bursary team$aug$
  );
