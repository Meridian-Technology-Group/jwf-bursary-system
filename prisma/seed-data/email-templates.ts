// prisma/seed-data/email-templates.ts
// Email templates with realistic professional content for the JWF Bursary Assessment System

export type EmailTemplateType =
  | "INVITATION"
  | "CONFIRMATION"
  | "MISSING_DOCS"
  | "OUTCOME_QUALIFIES"
  | "OUTCOME_DNQ"
  | "OUTCOME_AWARDED"
  | "OUTCOME_QUALIFIES_NOT_AWARDED"
  | "REASSESSMENT"
  | "REMINDER"
  | "INVITE_STAFF"
  | "MISSING_DOCS_RESPONDED"
  | "SECONDARY_PARENT_INVITE"
  | "SECONDARY_PARENT_REMINDER"
  | "SECONDARY_PARENT_RECEIVED"
  | "APPLICATION_RESTART_REQUIRED"
  | "APPLICATION_EDITED_ON_BEHALF";

interface EmailTemplateData {
  type: EmailTemplateType;
  subject: string;
  body: string;
  mergeFields: string[];
}

export const emailTemplates: EmailTemplateData[] = [
  {
    type: "INVITATION",
    subject: "You are invited to apply for a bursary — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "round_year",
      "registration_link",
      "deadline",
    ],
    body: `Dear {{applicant_name}},

I am writing on behalf of the John Whitgift Foundation to invite you to apply for a bursary award for {{child_name}} at {{school}} for the {{round_year}} academic year.

The John Whitgift Foundation is committed to providing bursary support to families who would not otherwise be able to afford an independent school education. We assess each application carefully and confidentially, and our aim is to ensure that financial circumstances do not prevent a deserving child from benefiting from the education we provide.

To begin your application, please visit the link below and complete the online registration form. You will be asked to provide details of your household income, assets, and family circumstances, along with supporting documentation.

Registration link: {{registration_link}}

Please note that the deadline for submitting your completed application is {{deadline}}. Applications received after this date may not be considered for this round.

If you have any questions about the application process, please do not hesitate to contact the Bursary Office. We are happy to assist you.

We look forward to receiving your application.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "CONFIRMATION",
    subject: "Bursary application received — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "reference",
      "submission_date",
    ],
    body: `Dear {{applicant_name}},

Thank you for submitting your bursary application for {{child_name}} at {{school}}. We are pleased to confirm that your application has been received successfully.

Your application reference number is: {{reference}}
Date of submission: {{submission_date}}

Please keep your reference number safe, as you will need it in any future correspondence with us regarding this application.

Our assessments team will now review your application and any supporting documents you have provided. We may contact you if we require any additional information or clarification. Please do ensure that you respond promptly to any such requests, as delays may affect the processing of your application.

You can expect to hear from us regarding the outcome of your assessment before the end of the current assessment round. We appreciate your patience during this time.

If you have any questions in the meantime, please contact the Bursary Office, quoting your reference number.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "MISSING_DOCS",
    subject:
      "Documents required for your bursary application — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "custom_message",
      "child_name",
      "reference",
      "missing_documents",
      "deadline",
    ],
    body: `Dear {{applicant_name}},

{{custom_message}}

To enable us to complete our assessment of your bursary application for {{child_name}} (reference: {{reference}}), the following documents are still required:

{{missing_documents}}

Please submit the outstanding documents through your online application portal as soon as possible, and no later than {{deadline}}. Without these documents, we are unable to progress your application further.

If you experience any difficulty with the upload process, or if you are unable to provide a particular document, please contact the Bursary Office as soon as possible so that we can discuss alternative arrangements.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "OUTCOME_QUALIFIES",
    subject: "Bursary assessment outcome — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "reference",
      "academic_year",
    ],
    body: `Dear {{applicant_name}},

I am very pleased to write to you regarding the outcome of the bursary assessment for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

Having carefully considered all of the information provided in your application, including your household income, assets, and family circumstances, the Bursary Committee has determined that {{child_name}} qualifies for bursary support.

Full details of the bursary award, including the level of support and any applicable conditions, will be set out in a separate letter which will follow shortly. Please read that letter carefully, as it will contain important information about how the bursary will be administered and what is required of you to maintain the award.

We are delighted to be able to support {{child_name}}'s education at {{school}}, and we hope that this award will make a real difference to your family. Should your circumstances change at any point, you are required to notify the Bursary Office without delay, as this may affect the level of support provided.

If you have any questions, please do not hesitate to contact us.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "OUTCOME_DNQ",
    subject: "Bursary assessment outcome — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "reference",
      "academic_year",
    ],
    body: `Dear {{applicant_name}},

Thank you for submitting a bursary application for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

We appreciate the time and effort you have put into completing your application, and we understand how important this matter is to your family. We have given careful consideration to all of the information and documentation provided.

Having completed our assessment, we regret to inform you that on this occasion {{child_name}}'s application has not met the criteria for bursary support. This decision has been reached after a thorough review of your household financial circumstances in accordance with the Foundation's bursary assessment guidelines.

We understand that this may be disappointing news, and we are sorry that we are unable to offer support at this time. Please be assured that this decision is in no way a reflection on {{child_name}} personally.

If your financial circumstances change significantly, you are welcome to apply in a future round. Should you wish to discuss the outcome of your assessment, or if you believe that there are exceptional circumstances which were not fully reflected in your application, please contact the Bursary Office within 14 days of receiving this letter.

We wish {{child_name}} all the best for the future.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    // Epic 08 — the 3-value outcome lifecycle's "Approved Bursary" letter.
    // Kept in sync with migration 20260606180200_seed_outcome_email_templates.
    type: "OUTCOME_AWARDED",
    subject: "Bursary assessment outcome — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "reference",
      "academic_year",
    ],
    body: `Dear {{applicant_name}},

I am very pleased to write to you regarding the outcome of the bursary assessment for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

Having carefully considered all of the information provided in your application, including your household income, assets, and family circumstances, the Bursary Committee has determined that {{child_name}} has been awarded a bursary.

Full details of the award, including the level of support, any scholarship element, and any applicable conditions, will be set out in a separate award letter which will follow shortly. Please read that letter carefully, as it will contain important information about how the award will be administered and what is required of you to maintain it.

We are delighted to be able to support {{child_name}}'s education at {{school}}, and we hope that this award will make a real difference to your family. Should your circumstances change at any point, you are required to notify the Bursary Office without delay, as this may affect the level of support provided.

If you have any questions, please do not hesitate to contact us.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    // Epic 08 — "eligible but not awarded this round" (held per retention).
    // Kept in sync with migration 20260606180200_seed_outcome_email_templates.
    type: "OUTCOME_QUALIFIES_NOT_AWARDED",
    subject: "Bursary assessment outcome — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "reference",
      "academic_year",
    ],
    body: `Dear {{applicant_name}},

Thank you for submitting a bursary application for {{child_name}} at {{school}} for the {{academic_year}} academic year (reference: {{reference}}).

We have given careful consideration to all of the information and documentation you provided. Having completed our assessment, I can confirm that {{child_name}}'s application has been assessed as eligible for bursary support.

Unfortunately, on this occasion we are not able to offer an award in this round. Bursary funding is limited, and the Foundation must make awards within the resources available to it. Your application has been retained, and {{child_name}} remains eligible to be considered in a future round.

We understand that this may be disappointing news, and we are sorry that we are unable to offer an award at this time. If your financial circumstances change significantly, or if you would like to discuss the outcome, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "REASSESSMENT",
    subject: "Annual bursary re-assessment — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "school",
      "round_year",
      "registration_link",
      "deadline",
    ],
    body: `Dear {{applicant_name}},

I am writing to advise you that it is now time for the annual re-assessment of the bursary currently held by {{child_name}} at {{school}}.

As you will be aware, bursary awards are subject to annual review to ensure that the level of support provided continues to reflect your current financial circumstances. We are required to reassess all bursary holders each year, and we ask that you cooperate fully with this process.

To complete the re-assessment, please log in to the application portal using the link below and complete the re-assessment form for the {{round_year}} academic year. You will be asked to provide updated information about your household income, assets, and any changes in your family circumstances since your last assessment.

Re-assessment link: {{registration_link}}

Please ensure that your re-assessment form and all supporting documentation are submitted by {{deadline}}. Failure to submit by this date may result in the bursary being suspended pending receipt of the required information.

If there have been any significant changes to your financial circumstances since your last assessment — whether positive or negative — please make sure these are clearly reflected in your application.

Should you have any questions about the re-assessment process, please do not hesitate to contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "INVITE_STAFF",
    subject: "You've been invited to the JWF Bursary Assessment System",
    mergeFields: ["first_name", "role", "registration_link"],
    body: `Dear {{first_name}},

You have been invited to join the John Whitgift Foundation Bursary Assessment System as a {{role}}.

The Bursary Assessment System is the internal platform we use to review and decide on family bursary applications for Trinity School and Whitgift School. As a {{role}}, you will have access to the data and tools that the role requires — please treat all information you encounter in the system with the strictest confidence.

To activate your account, please follow the link below and set a password of your choosing. The link is single-use and will expire in 72 hours.

Registration link: {{registration_link}}

If you were not expecting this invitation, you can safely ignore this email — no account will be created until you complete the registration step.

If you have any questions about the system or your access, please reply to this email and a member of the Bursary Office will be in touch.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "REMINDER",
    subject:
      "Reminder: Bursary application deadline approaching — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "reference",
      "deadline",
    ],
    body: `Dear {{applicant_name}},

This is a friendly reminder that the deadline for your bursary application for {{child_name}} (reference: {{reference}}) is approaching.

Our records indicate that your application has not yet been fully completed and submitted. To ensure your application is considered in the current assessment round, please log in to your application portal and complete any outstanding sections before {{deadline}}.

Please also ensure that all required supporting documents have been uploaded. Incomplete applications or applications without the necessary documentation may not be assessed in this round.

If you have already submitted your application and received a confirmation email, please disregard this message.

If you are experiencing any difficulties completing your application, or if you have concerns about meeting the deadline, please contact the Bursary Office as soon as possible. We will do our best to assist you.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "MISSING_DOCS_RESPONDED",
    subject: "Documents received — {{reference}} ({{child_name}})",
    mergeFields: [
      "assessor_name",
      "child_name",
      "reference",
      "application_link",
    ],
    body: `Dear {{assessor_name}},

The applicant for {{child_name}} (application reference {{reference}}) has responded to your request for missing documents and uploaded the requested files.

The application has moved out of the paused state and is back in your queue for review:
{{application_link}}

Regards,
JWF Bursary System`,
  },
  {
    type: "SECONDARY_PARENT_INVITE",
    subject:
      "You are invited to contribute to a bursary application — {{child_name}}",
    mergeFields: [
      "secondary_parent_name",
      "child_name",
      "school",
      "round_year",
      "registration_link",
      "deadline",
    ],
    body: `Dear {{secondary_parent_name}},

I am writing on behalf of the John Whitgift Foundation. A bursary application for {{child_name}} at {{school}} for the {{round_year}} academic year has been started by their other parent.

Because the Foundation assesses each parent's financial circumstances independently when parents do not share a household, you are warmly invited to provide your own financial details as part of this application. Your information is treated in the strictest confidence: the other parent will not be able to see what you submit, and you will not see their details.

To contribute your part of the application, please register using the link below and complete your section of the form. You will be asked to provide details of your own household income, assets, and supporting documentation.

Registration link: {{registration_link}}

Please complete your section by {{deadline}}. If your information is not received, the Foundation may need to assess the application on the basis of the details available, which could affect the outcome.

If you have any questions, or if you believe you have received this invitation in error, please contact the Bursary Office. We are happy to help.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "SECONDARY_PARENT_RECEIVED",
    subject: "Thank you — your bursary information has been received",
    mergeFields: [
      "secondary_parent_name",
      "child_name",
      "school",
      "round_year",
    ],
    body: `Dear {{secondary_parent_name}},

Thank you for completing your section of the bursary application for {{child_name}} at {{school}}. We confirm that your financial information and supporting documents have been received.

Your details will be considered confidentially alongside the rest of the application as part of the {{round_year}} assessment. There is nothing further you need to do at this stage.

If your circumstances change before the assessment is completed, or if you have any questions, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    type: "SECONDARY_PARENT_REMINDER",
    subject: "Reminder: your bursary contribution for {{child_name}}",
    mergeFields: [
      "secondary_parent_name",
      "child_name",
      "school",
      "round_year",
      "registration_link",
      "deadline",
    ],
    body: `Dear {{secondary_parent_name}},

This is a gentle reminder that we have not yet received your section of the bursary application for {{child_name}} at {{school}} for the {{round_year}} academic year.

So that the Foundation can assess the application fully and fairly, we would be grateful if you could complete your section, including your household income, assets, and supporting documents. Your information remains entirely confidential to you.

Registration link: {{registration_link}}

Please aim to complete your section by {{deadline}}. If your information is not received, the Foundation may need to assess the application on the basis of the details available, which could affect the outcome.

If you have already completed your section, please disregard this message. If you have any questions, please contact the Bursary Office.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    // Full Rejection flow — the applicant's submission was rejected outright and
    // a fresh blank application has been created for them to complete.
    // Kept in sync with migration
    // 20260611120100_seed_restart_and_update_missing_docs_template.
    type: "APPLICATION_RESTART_REQUIRED",
    subject:
      "Your bursary application needs to be resubmitted — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "reference",
      "custom_message",
      "restart_link",
    ],
    body: `Dear {{applicant_name}},

{{custom_message}}

Having reviewed the bursary application submitted for {{child_name}} (reference: {{reference}}), we are unable to proceed with it in its current form. We have therefore closed that submission and ask that you complete a new application.

A fresh application has been prepared for you. Please log in to your online application portal using the link below to complete and submit it:

{{restart_link}}

When completing your new application, please take particular care to provide clear, current, and valid supporting documents. If you have any questions about what is required, or if you would like to discuss your application, please contact the Bursary Office — we are happy to help.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
  {
    // CR-001 edit-on-behalf — sent once when a member of the Bursary Office
    // finishes an editing pass on an applicant's form, listing the sections
    // that were entered or amended on their behalf.
    // Kept in sync with migration
    // 20260612100100_seed_edited_on_behalf_template.
    type: "APPLICATION_EDITED_ON_BEHALF",
    subject: "Your bursary application has been updated — {{child_name}}",
    mergeFields: [
      "applicant_name",
      "child_name",
      "reference",
      "edited_sections",
      "edited_date",
    ],
    body: `Dear {{applicant_name}},

I am writing to let you know that a member of the Bursary Office team has updated the bursary application for {{child_name}} (reference: {{reference}}) on your behalf on {{edited_date}}.

The following sections were entered or amended on your behalf:

{{edited_sections}}

You can review your submitted application in your online application portal at any time. The information shown there is read-only, so nothing further is required of you.

If anything in the updated information looks incorrect, or if you have any questions about the changes, please contact the Bursary Office and we will be happy to help.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Yours sincerely,

The Bursary Office
John Whitgift Foundation`,
  },
];
