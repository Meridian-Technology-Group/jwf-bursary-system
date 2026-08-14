/**
 * Home-page guidance content — Epic 05 (feedback ask #2).
 *
 * "Section 1 — How to Apply" and "Section 2 — Checklist" are the two guidance
 * tabs the Foundation asked for on the parent home page. The copy is
 * transcribed from the application-form workbook (scoping §1 / §2). It is
 * STATIC reference content — identical for new and rolling-over applicants —
 * except the Checklist's identity-documents block, which is flagged
 * "first application only" so rolling-over re-assessments can de-emphasise it.
 *
 * Kept as structured data (not JSX) so it is testable and reusable across the
 * tabs component and any future surface. The verbatim wording in the workbook
 * remains authoritative; this summarises the FAQ answers (see the scoping note).
 */

export const BURSARIES_CONTACT_EMAIL = "fees@johnwhitgiftfoundation.org";

/**
 * The sentence the Foundation asked us to put in front of parents, verbatim
 * (CF-31). It is specific on purpose: every place the portal says "contact the
 * Foundation" without naming a channel, a parent phones — and there is no call
 * centre to answer. Wherever this appears the address is a `mailto:` link, so
 * "by email" is one tap rather than an instruction to go and find an inbox.
 */
export const CONTACT_BURSARY_TEAM_COPY = `please contact the bursary team by email at ${BURSARIES_CONTACT_EMAIL}`;

export interface GuidanceFaq {
  question: string;
  answer: string;
}

export interface ChecklistItem {
  /** Short heading for the document group. */
  title: string;
  /** What to provide / when it applies. */
  detail: string;
  /**
   * True for the identity-documents block, which is only required on a FIRST
   * (new) application — rolling-over re-assessments already have ID on file.
   */
  firstApplicationOnly?: boolean;
}

// ─── Section 1 — How to Apply ───────────────────────────────────────────────

export const HOW_TO_APPLY_INTRO = [
  "This portal calculates the actual bursary award from the financial information you provide, so please complete every section as accurately as you can.",
  "Where a value is required but is not relevant to you, enter 0 rather than leaving it blank.",
  "Please make sure every document you upload is clear and legible — illegible documents can delay or prevent your assessment.",
];

export const HOW_TO_APPLY_FAQS: GuidanceFaq[] = [
  {
    question: "What is the difference between a bursary and a scholarship?",
    answer:
      "A bursary is a means-tested reduction in school fees based on your family's financial circumstances. A scholarship is awarded on merit (and is independent of income), and can reduce fees by up to 50%. You can apply for both — they are assessed separately.",
  },
  {
    question: "Who is eligible, and how much could I receive?",
    answer:
      "Bursaries are available for pupils from Year 6 upwards at Whitgift and Trinity (they are not available for Whitgift boarders). The amount awarded depends on a full assessment of your household income, assets and liabilities.",
  },
  {
    question: "How many new bursaries are awarded each year?",
    answer:
      "The Foundation receives around 600 registrations a year and invites roughly a third of those families to make a full application. Awards are made from the assessed applications.",
  },
  {
    question: "When will I find out the outcome?",
    answer:
      "New applicants are usually told the outcome at their school's place-offer day. Re-assessments for existing bursary holders are typically confirmed in early June.",
  },
  {
    question: "Can I apply at more than one Foundation school?",
    answer:
      "One application covers both Foundation schools. You make one application per child — if you have twins, you will need a separate application for each child.",
  },
  {
    question: "How long does a bursary last?",
    answer:
      "A bursary lasts for the duration of your child's schooling, subject to an annual re-assessment. You must tell the Foundation promptly if your circumstances change.",
  },
  {
    question: "What if my circumstances change, or I have more than one child?",
    answer:
      "Tell the Foundation as soon as your circumstances change. If you have more than one child at a Foundation school, each child has their own application and assessment.",
  },
  {
    question: "How are fees paid, and what counts towards the assessment?",
    answer:
      "Fees can be paid by termly invoice or monthly direct debit. The assessment looks at income, assets and liabilities across the household; extras such as lunches, uniform and trips are considered separately.",
  },
];

export const HOW_TO_APPLY_GUIDANCE_NOTES = [
  "Residency: if any family member is not a British citizen, you will be asked for evidence of Indefinite Leave to Remain (or EU Settled Status).",
  "Who may complete the form: the child's natural parents, a resident parent and their partner, or a legal guardian.",
  "A dependent-children allowance is applied for children still living with you or financially dependent on you.",
  "If there is a court order or insurance policy specifically covering school fees, you will be asked to provide evidence.",
  "Income, assets and liabilities must be evidenced — for example P60s, SA302s, benefits letters, property and business documents.",
  "The declaration must be confirmed by both parents/guardians (unless you are a sole parent or guardian).",
];

// ─── Section 2 — Checklist ──────────────────────────────────────────────────

export const CHECKLIST_UPLOAD_NOTES = [
  "Upload clear scans or sharp phone photos. Bank statements must be uploaded as a single PDF per account — not page-by-page photos.",
  "You can check your application status here after you submit.",
  `Questions about an in-progress application are answered by email only during April and May — ${CONTACT_BURSARY_TEAM_COPY}.`,
  "You are responsible for the accuracy of everything you submit. Please provide everything that is asked for — missing documents can lead to your application being rejected.",
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    title: "Personal & family identity",
    detail:
      "Birth certificate naming the child, plus a British passport for each family member (expired is fine; for a young child, a birth certificate is acceptable). If a member is not a British citizen, provide their passport together with evidence of Indefinite Leave to Remain or EU Settled Status.",
    firstApplicationOnly: true,
  },
  {
    title: "Family circumstances evidence",
    detail:
      "If divorced or widowed, the decree nisi/absolute or death certificate. If you have elderly dependants in a care home, their latest care-home invoices.",
  },
  {
    title: "What each parent earns",
    detail:
      "P60 and your most recent / latest-March payslip; any benefits award letters; if self-employed, your SA302 and business accounts.",
  },
  {
    title: "Property",
    detail:
      "Mortgage statements for every property you own; your tenancy agreement if you rent; and a council-tax bill.",
  },
  {
    title: "Other assets",
    detail: "Car insurance certificate(s).",
  },
  {
    title: "Other (for everyone)",
    detail:
      "The last 3 months' detailed PDF bank statements for all accounts (both parents and any businesses); credit-card and loan statements; investment values; any court orders about fees; child-maintenance evidence; debt owed to another school; school-fee insurance; and, if you left work, a P45 and redundancy letter.",
  },
  {
    title: "Additional information",
    detail:
      "Use the Additional Information section for anything else relevant to your assessment, with any supporting documents.",
  },
];
