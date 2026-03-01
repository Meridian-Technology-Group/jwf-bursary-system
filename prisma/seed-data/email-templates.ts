// prisma/seed-data/email-templates.ts
// Email templates with realistic professional content for the JWF Bursary Assessment System

export type EmailTemplateType =
  | "INVITATION"
  | "CONFIRMATION"
  | "MISSING_DOCS"
  | "OUTCOME_QUALIFIES"
  | "OUTCOME_DNQ"
  | "REASSESSMENT"
  | "REMINDER";

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
      "child_name",
      "reference",
      "missing_documents",
      "deadline",
    ],
    body: `Dear {{applicant_name}},

Thank you for submitting your bursary application for {{child_name}} (reference: {{reference}}).

Having reviewed your application, we find that the following documents are still required to enable us to complete our assessment:

{{missing_documents}}

Without these documents, we are unable to progress your application further. Please submit the outstanding documents as soon as possible, and no later than {{deadline}}.

Documents can be uploaded securely through your online application portal. If you experience any difficulty with the upload process, or if you are unable to provide a particular document, please contact the Bursary Office as soon as possible so that we can discuss alternative arrangements.

We would like to remind you that all information provided is treated in strict confidence and used solely for the purpose of assessing your application for bursary support.

Please do not hesitate to get in touch if you have any questions or concerns.

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
];
