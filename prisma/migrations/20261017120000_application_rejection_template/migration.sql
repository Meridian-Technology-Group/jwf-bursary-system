-- Application rejection template (Charlotte, 17 Oct 2026).
--
-- APPLICATION_RESTART_REQUIRED (shown in Settings as "Application Rejection")
-- gets her own wording. The rejection window now opens with this text, the
-- family's details filled in, and staff edit it before sending.
--
-- Replaces the stored row ONLY while it still holds the 16 Oct "returned for
-- correction" text written by 20261016170000, so an edit made in Settings
-- since is never overwritten. Additive: one guarded UPDATE, no schema change.

UPDATE public.email_templates
SET subject = $subject$JWF - We have had to reject your application ** PLEASE READ **$subject$,
    body = $body$Dear {{greeting}}

Thank you for submitting your application.

I regret to inform you that we have had to reject your bursary application as it did not include the required documents/ information as stated on the form. As a result, we have had to clear some sections within the form.

When you log back in the system, you will see an incomplete form waiting for your correct documents and information, especially:
1-
2-

As you may know, our assessment team needs these required documents/information to be able to complete your financial assessment.

Not attaching the correct documents (either due to attaching one for an incorrect year, uploading a document that is not legible, or attaching another document in lieu of the requested one for instance) means that we are left with no other option but to ask you to complete the form again.

Please remember that, if we cannot financially assess you, we will not be able to award a bursary to your child. It is therefore very important that you complete all the sections of the form correctly, or you may lose the opportunity to be assessed for a bursary.

We do keep a record of any occurrence of any application rejections and do take those seriously.

We trust that you will be able to log back into your online bursary account and complete the form adequately by {{deadline}}. We are looking forward to receiving your new form shortly.

Kind regards,

JWF Bursary team.$body$,
    merge_fields = '["greeting","applicant_name","child_name","reference","restart_link","deadline"]'::jsonb,
    updated_at = now()
WHERE type = 'APPLICATION_RESTART_REQUIRED'
  AND subject = $old$Your bursary application has been returned for correction — {{child_name}}$old$
  AND replace(body, E'\r', '') = $seed$Dear {{applicant_name}},

{{custom_message}}

We have reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}) and have returned it to you for correction.

Your previous answers and documents are still there. Please log in to your online application portal using the link below, correct the sections that no longer show a green tick, and resubmit your application by {{deadline}}:

{{restart_link}}

If you have any questions about what needs to change, please email our team at fees@johnwhitgiftfoundation.org.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

JWF Bursary team$seed$;
