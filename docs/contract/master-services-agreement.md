# Master Services Agreement

**For the design, delivery, hosting and ongoing support of the John Whitgift Foundation Bursary Assessment Platform**

> **DRAFT v2 — for review.** Drafting notes are shown in blockquotes like this and must be removed before execution.

---

## Parties

This Master Services Agreement (the **"Agreement"**) is made on **1 May 2026** (the **"Effective Date"**)

**BETWEEN:**

**(1) RESULT DRIVEN DEVELOPMENT LLC**, a limited liability company organised under the laws of the State of **Wyoming**, United States of America, trading as **"Meridian Technology Group"**, whose registered office is at **30 N Gould Street, Suite R, Sheridan, Wyoming 82801, United States** (the **"Supplier"**); and

**(2) THE JOHN WHITGIFT FOUNDATION**, a registered charity in England and Wales with charity number **312612**, whose registered office is at **Whitgift Foundation, North End, Croydon CR9 1SS, United Kingdom** (the **"Customer"**),

each a **"Party"** and together the **"Parties"**.

> **Drafting note:** A board minute or trustee resolution authorising Roisha Hughes (CEO) to sign on behalf of the Foundation should accompany execution.

---

## Background

(A) The Customer operates a bursary scheme for pupils attending schools within the John Whitgift Foundation, and requires a bespoke web-based platform to administer applications, assessments, recommendations and reporting in place of its existing third-party tool (Symplectic Grant Tracker, which is being sunsetted on 31 December 2026).

(B) The Supplier has substantially designed and developed such a platform (the **"Platform"**) and has the expertise to complete, deploy, host and support it for the Customer.

(C) The Parties wish to record on the terms of this Agreement: (i) the completion and acceptance of the development work and the delivery of the Platform into production; (ii) the assignment to the Customer of all intellectual property in the Platform; and (iii) the ongoing licensing, hosting and maintenance of the Platform.

---

## Agreed Terms

### 1. Definitions and Interpretation

**1.1** In this Agreement, the following capitalised terms have the meanings given to them below:

**"Acceptance"** means the Customer's acceptance of the Platform in accordance with clause 5 and Schedule 1.

**"Acceptance Criteria"** means the criteria set out in Schedule 1 against which the Platform is to be tested.

**"Acceptance Tests"** means the tests described in Schedule 1, including the Calculation Parity Test.

**"Annual Licence Fee"** means the recurring fee payable under clause 11.2, as set out in Schedule 2.

**"Applicable Data Protection Laws"** means the UK GDPR, the Data Protection Act 2018, the EU GDPR (where applicable), the Privacy and Electronic Communications Regulations 2003 (as amended), and any binding code of practice or guidance issued by the Information Commissioner's Office.

**"Build Fee"** means the one-off fee payable under clause 11.1, as set out in Schedule 2.

**"Business Day"** means any day other than a Saturday, Sunday or public holiday in England.

**"Business Hours"** means 09:00 to 17:30 UK time on a Business Day.

**"Calculation Parity Test"** means the test described in paragraph 3 of Schedule 1.

**"Confidential Information"** has the meaning given in clause 16.1.

**"Customer Data"** means all data (including personal data) provided to or processed by the Supplier on behalf of the Customer in connection with this Agreement, including data submitted by Users to the Platform.

**"Customer Materials"** means any materials, content, data, branding or specifications provided by the Customer to the Supplier under this Agreement.

**"Documentation"** means the user, technical and operational documentation provided by the Supplier in respect of the Platform, as updated from time to time.

**"Force Majeure Event"** has the meaning given in clause 21.1.

**"Go-Live"** means the date on which the Platform is first deployed to the Production Environment and made available to the Customer's end users for live use, expected to be the week commencing 22 June 2026.

**"Hypercare Period"** means the period of two weeks immediately following Go-Live, as further described in clause 9.4.

**"Initial Term"** has the meaning given in clause 4.1.

**"Intellectual Property Rights"** or **"IPR"** means all patents, rights to inventions, copyright and related rights, trade marks, business names and domain names, rights in get-up, goodwill and the right to sue for passing off, rights in designs, database rights, rights to use and protect the confidentiality of Confidential Information (including know-how), and all other intellectual property rights, in each case whether registered or unregistered, and including all applications and rights to apply for such rights, anywhere in the world.

**"Licence"** means the licence granted under clause 8.

**"Licence Year"** means each successive 12-month period beginning on Go-Live and on each anniversary of Go-Live.

**"Personal Data"** has the meaning given in the UK GDPR.

**"Platform"** means the John Whitgift Foundation Bursary Assessment Platform, as more particularly described in Schedule 1, together with all updates, enhancements and modifications made under this Agreement.

**"Production Environment"** means the live hosting environment for the Platform, hosted on Vercel and Supabase in a UK or EU region.

**"Renewal Term"** has the meaning given in clause 4.2.

**"Service Levels"** or **"SLAs"** means the service levels set out in Schedule 3.

**"Source Code"** means the source code of the Platform, including all configuration, scripts, build tools and infrastructure-as-code, held in the GitHub repository specified in clause 13.

**"Sub-processor"** means any third party engaged by the Supplier to process Personal Data on behalf of the Customer, as listed in Schedule 5.

**"Support Services"** means the services described in clause 9 and Schedule 6.

**"Term"** means the duration of this Agreement, calculated in accordance with clause 4.

**"User"** means any individual authorised by the Customer to access the Platform, including administrators, assessors and parent/guardian applicants.

**"VAT"** means UK Value Added Tax or any equivalent or replacement tax.

**1.2** Clause and Schedule headings do not affect interpretation. References to clauses and Schedules are to the clauses and Schedules of this Agreement. The Schedules form part of this Agreement and have effect as if set out in full in the body of this Agreement.

**1.3** A reference to a statute or statutory provision is a reference to it as amended or re-enacted from time to time, and includes all subordinate legislation made under it.

**1.4** Words in the singular include the plural and vice versa, and a reference to one gender includes a reference to all other genders.

**1.5** Where the words "include", "includes", "including" or "in particular" appear, they are to be construed as illustrative and shall not limit the sense of the words preceding them.

**1.6** **Order of precedence.** In the event of conflict between the documents forming this Agreement, the order of precedence is: (i) the body of this Agreement; (ii) Schedule 4 (Data Processing Agreement); (iii) the remaining Schedules; (iv) the Documentation. Notwithstanding the foregoing, Schedule 4 shall prevail in respect of any conflict relating to the processing of Personal Data.

---

### 2. Structure of the Agreement

**2.1** This Agreement governs:

- (a) the **completion, deployment and acceptance** of the Platform (the "Development Services"), described in Schedule 1;
- (b) the **assignment of intellectual property** in the Platform to the Customer, governed by clause 12;
- (c) the **provision of hosted access to the Platform** in the Production Environment, governed by clauses 8 and 11.2 (the "Hosted Services"); and
- (d) the **provision of ongoing support and maintenance** services for the Platform, governed by clause 9 and Schedule 6 (the "Support Services").

**2.2** Migration of data from the Customer's existing Symplectic Grant Tracker system is **not within the scope of this Agreement**. Any such migration work shall be the subject of a separate written statement of work between the Parties, scoped following a discovery sprint, and priced separately.

**2.3** Custom integrations and major new feature development are likewise outside the scope of this Agreement and shall be the subject of separate written statements of work, agreed in accordance with the change-control process in clause 9.5.

---

### 3. Supplier Obligations — General

**3.1** The Supplier shall perform the Development Services, the Hosted Services and the Support Services (together, the **"Services"**):

- (a) using reasonable skill and care, in accordance with good industry practice;
- (b) using personnel who are suitably skilled, qualified and experienced;
- (c) in compliance with all applicable laws, including Applicable Data Protection Laws; and
- (d) in accordance with the Service Levels.

**3.2** The Supplier shall ensure that any subcontractors and sub-processors it engages in the performance of the Services are bound by written terms no less protective of the Customer's interests than those contained in this Agreement, including with respect to confidentiality, data protection, security and intellectual property.

**3.3** The Supplier remains responsible to the Customer for the acts and omissions of its subcontractors and sub-processors as if they were its own.

---

### 4. Term

**4.1** This Agreement commences on the Effective Date and, unless terminated earlier in accordance with its terms, the Hosted Services and Support Services shall continue for an initial period of one (1) Licence Year from Go-Live (the **"Initial Term"**).

**4.2** On expiry of the Initial Term, this Agreement shall automatically renew for successive one (1) Licence Year periods (each a **"Renewal Term"** and together with the Initial Term, the **"Term"**), unless either Party gives the other not less than ninety (90) days' written notice of non-renewal prior to the end of the then-current Term.

**4.3** The Development Services shall be deemed completed on Acceptance, save that the Supplier's obligations in respect of warranty (clause 17), the Hypercare Period (clause 9.4) and matters expressly stated to survive shall continue.

---

### 5. Development Services and Acceptance

**5.1** The Supplier shall deliver the Platform in accordance with the project plan set out in Schedule 1, working towards Go-Live in the week commencing **22 June 2026**.

**5.2** Each gate (G1 to G4) set out in Schedule 1 shall be a milestone. The Supplier shall notify the Customer in writing when it considers a gate to have been achieved.

**5.3** **Acceptance Tests.** Prior to Go-Live, the Customer shall conduct the Acceptance Tests during the User Acceptance Testing window (G2) described in Schedule 1. Acceptance Tests include the **Calculation Parity Test**: the Platform's four-stage assessment engine shall be run against not fewer than ten (10) anonymised historical cases supplied by the Customer, and shall produce results that are materially equivalent to the Customer's existing assessment spreadsheet for each such case.

**5.4** **Acceptance.** The Platform shall be deemed accepted on the earliest of:

- (a) the date on which the Customer issues a written notice of acceptance;
- (b) the date on which the Platform is used in live operation by the Customer for any application round; or
- (c) ten (10) Business Days after the conclusion of the Acceptance Tests, provided the Customer has not by that date issued a written notice of non-acceptance specifying material defects against the Acceptance Criteria.

**5.5** **Defects and re-test.** If the Customer issues a notice of non-acceptance under clause 5.4(c), the Supplier shall, at no further charge, use reasonable endeavours to correct the specified defects and resubmit the Platform for re-testing within fifteen (15) Business Days. The procedure in clauses 5.3 to 5.5 shall be repeated until Acceptance is achieved.

**5.6** **Material acceptance failure — service credit.** If, after two (2) full cycles of re-testing under clause 5.5, the Platform still fails the Calculation Parity Test or otherwise materially fails to meet the Acceptance Criteria, the Customer shall be entitled to a service credit equal to one hundred per cent (100%) of the Build Fee, applied against future Annual Licence Fees, and the Parties shall meet in good faith to agree a remediation plan or, failing such agreement within thirty (30) days, the Customer may terminate this Agreement under clause 19.2(a).

> **Drafting note:** The service-credit mechanism reflects the commercial reality that the Build Fee is fully payable on signature. The credit accrues against future licence years rather than as a refund, which preserves cash-flow neutrality for the Supplier while giving the Customer meaningful protection.

---

### 6. Customer Obligations

**6.1** The Customer shall:

- (a) provide the Supplier with such cooperation, information, materials and access (including to nominated User Acceptance Testers) as is reasonably necessary to enable the Supplier to perform the Services;
- (b) ensure that all Customer Materials and Customer Data provided to the Supplier are accurate and complete in all material respects, and that the Customer is entitled to share them with the Supplier for the purposes of this Agreement;
- (c) appoint a primary contact authorised to make decisions on behalf of the Customer in respect of this Agreement;
- (d) be responsible for the management of User accounts on the Platform, including granting and revoking access; and
- (e) use the Platform only for its lawful and intended purpose, in accordance with the Documentation.

**6.2** Any delay caused by the Customer's failure to perform its obligations under clause 6.1 shall extend the corresponding deadlines under this Agreement on a day-for-day basis, and shall not entitle the Customer to a service credit or other remedy in respect of any consequential delay.

---

### 7. Hosting

**7.1** The Supplier shall host the Platform in the Production Environment using the third-party providers listed in Schedule 5, in a UK or EU region.

**7.2** The Supplier shall: (a) maintain the Platform in good working order; (b) apply security patches and dependency updates in accordance with good industry practice; (c) take and retain daily automated backups, with point-in-time recovery to a window of not less than thirty (30) days; and (d) monitor the Platform for errors and security incidents.

**7.3** Planned maintenance that is reasonably likely to cause material disruption shall, where practicable, be carried out outside Business Hours, and the Supplier shall give the Customer not less than five (5) Business Days' prior notice.

---

### 8. Licence

**8.1** Following the assignment of Intellectual Property Rights to the Customer under clause 12, the Customer hereby grants to the Supplier, for the Term, a non-exclusive, non-transferable, royalty-free licence to use, copy, modify and host the Platform solely to the extent necessary for the Supplier to perform the Hosted Services and Support Services under this Agreement.

**8.2** The Supplier shall not use, copy, modify or host the Platform (or any part of it) for any purpose other than the performance of this Agreement, and shall not grant any sub-licence to any third party except to its Sub-processors and only to the extent strictly necessary for the performance of this Agreement.

**8.3** On termination or expiry of this Agreement for any reason, the licence in clause 8.1 shall terminate automatically, save to the extent necessary for the Supplier to comply with its obligations under clause 19.

> **Drafting note:** Clause 8 reflects the IP position: the Customer owns the Platform outright, and merely licenses the Supplier back the operational rights it needs to host and maintain it. This is the cleanest structural fit for full IP assignment.

---

### 9. Support and Maintenance

**9.1** From Go-Live, the Supplier shall provide the Support Services described in Schedule 6 in accordance with the Service Levels set out in Schedule 3.

**9.2** **Included in the Annual Licence Fee.** The Support Services include, without further charge: bug fixes and regression remediation; security patches and dependency updates; minor enhancements (including reference-table tweaks, additional report columns, email-template variables and minor layout adjustments); ad-hoc User questions and onboarding support for new staff; and annual GDPR review and audit support.

**9.3** **Excluded from the Annual Licence Fee.** The following are not included and shall be quoted separately under the change-control process in clause 9.5: new major features; changes to the four-stage calculation model; integrations with external systems (including school management information systems and finance systems); and migration work referred to in clause 2.2.

**9.4** **Hypercare.** During the Hypercare Period, the Supplier shall provide priority response and daily check-ins (by email or video call, as agreed) to the Customer's primary contact, at no additional charge. Hypercare is included within the Build Fee.

**9.5** **Change control.** Any request that falls outside the scope of clause 9.2 shall follow this process:

- (a) the Customer submits a written request describing the desired change;
- (b) the Supplier provides a written quote (fixed price or time-and-materials, with an estimate cap) within ten (10) Business Days;
- (c) no work shall be undertaken until the Customer has approved the quote in writing; and
- (d) on approval, the change shall be documented in a separate written statement of work signed by both Parties, which shall be governed by the terms of this Agreement.

**9.6** **Quarterly review.** The Parties shall meet (in person or by video) at least once per quarter during the Term to review the maintenance backlog, prioritise enhancements and review the Customer's use of the Platform.

---

### 10. Service Levels

**10.1** The Supplier shall meet or exceed the Service Levels set out in Schedule 3.

**10.2** Where the Supplier fails to meet a Service Level, the Customer's exclusive remedy shall be the service credit (if any) specified in Schedule 3, save in respect of a persistent failure that constitutes a material breach under clause 19.2.

**10.3** The aggregate of all service credits payable under this Agreement (including under clause 5.6) in any Licence Year shall not exceed twenty per cent (20%) of the Annual Licence Fee for that Licence Year, save that the cap in clause 5.6 (Acceptance failure) shall apply separately and shall not count against the Service Level cap.

---

### 11. Charges and Payment

**11.1** **Build Fee.** In consideration of the Development Services, the Customer shall pay the Supplier a one-off fee of **£5,000 (five thousand pounds sterling)** (the **"Build Fee"**), invoiced on the Effective Date and payable within thirty (30) days of the date of invoice. The Build Fee is stated net of VAT, on the basis described in clause 11.5.

**11.2** **Annual Licence Fee.** In consideration of the Hosted Services and the Support Services, the Customer shall pay the Supplier an annual fee of **£7,000 (seven thousand pounds sterling)** (the **"Annual Licence Fee"**), invoiced as follows:

- (a) the Annual Licence Fee for the first Licence Year shall be invoiced on Go-Live and payable within thirty (30) days of the date of invoice; and
- (b) the Annual Licence Fee for each subsequent Licence Year shall be invoiced on or shortly before the anniversary of Go-Live, payable within thirty (30) days of the date of invoice.

**11.3** **Annual review of the Licence Fee.** With effect from the second Licence Year, the Annual Licence Fee may be increased by the Supplier on each anniversary of Go-Live by an amount no greater than the lower of:

- (a) the percentage increase in the UK Consumer Prices Index (all items, published by the Office for National Statistics) over the twelve (12) months ending on the most recent published index prior to the increase; and
- (b) **five per cent (5%)** of the then-current Annual Licence Fee.

The Supplier shall give the Customer not less than **four (4) months'** prior written notice of any such increase, such notice to be given before the relevant anniversary of Go-Live. If the Customer does not wish to accept the proposed increase, the Customer may terminate this Agreement on written notice given before the proposed effective date of the increase, with termination taking effect on the day immediately before the increase would otherwise take effect, and (for the avoidance of doubt) no early-termination charge shall apply.

**11.4** **Pass-through of vendor charges.** The Annual Licence Fee includes the infrastructure costs identified in Schedule 2. If the Supplier's underlying vendor charges (in particular, Vercel and Supabase) increase materially during a Licence Year, the Supplier may, on giving the Customer not less than **four (4) months'** prior written notice and providing reasonable supporting evidence, pass through the increase at the next renewal. Any such pass-through is in addition to the cap in clause 11.3 but shall be limited to the actual incremental vendor cost.

**11.5** **VAT and indirect taxes.** The Supplier is established in the United States and is not registered for UK Value Added Tax. The Parties acknowledge that, on the basis of the Supplier's status as at the Effective Date and the nature of the Services, the Supplier shall not charge UK VAT on its invoices to the Customer. The Customer shall be responsible for the assessment and accounting of any UK VAT (including under the reverse-charge mechanism, where applicable) that may arise on the supply of the Services. If, during the Term, a change in the Supplier's tax status or in applicable law results in UK VAT or any equivalent indirect tax becoming chargeable on the Services, all sums payable under this Agreement shall be treated as exclusive of such tax, and the Supplier shall be entitled to add it to its invoices at the prevailing rate, subject to the Supplier providing the Customer with a valid VAT invoice (or equivalent).

**11.6** **Late payment.** Without prejudice to any other right or remedy, the Supplier may charge interest on overdue sums at the rate of four per cent (4%) per annum above the Bank of England base rate from time to time, accruing daily from the due date until payment in full.

**11.7** **No set-off.** The Customer shall pay all sums due under this Agreement in full, without any set-off, counterclaim, deduction or withholding (other than any deduction or withholding required by law).

**11.8** **Out-of-scope work.** Work undertaken under clause 9.5 shall be invoiced as agreed in the relevant statement of work, and otherwise in accordance with this clause 11.

---

### 12. Intellectual Property

**12.1** **Assignment.** With effect from the Effective Date (or, as to anything created later, on its creation), the Supplier hereby assigns to the Customer with full title guarantee, by way of present and future assignment, all Intellectual Property Rights worldwide in the Platform, the Source Code, the Documentation and all other deliverables created under this Agreement (the **"Foreground IP"**), free from all encumbrances.

**12.2** **No retained rights.** The Supplier confirms that no pre-existing or background intellectual property of the Supplier or any third party is incorporated into the Platform such that ownership is shared or fragmented. To the extent that any third-party open-source components are incorporated, the Supplier shall ensure that they are used in compliance with their licence terms, and shall provide the Customer with a list of such components and licences as part of the Documentation.

**12.3** **Further assurance.** The Supplier shall, at the Customer's reasonable request and cost, execute all such documents and do all such acts as may be necessary to give effect to the assignment in clause 12.1, including by procuring the same from any of its personnel, subcontractors or sub-processors.

**12.4** **Moral rights.** The Supplier waives, and shall procure that its personnel waive, all moral rights in the Foreground IP to the maximum extent permitted by law.

**12.5** **Customer Materials.** The Customer retains all Intellectual Property Rights in the Customer Materials and Customer Data, and grants the Supplier a non-exclusive, non-transferable, royalty-free licence to use them solely for the purpose of performing the Services.

**12.6** **IP indemnity.** The Supplier shall indemnify the Customer against all losses, damages, costs and expenses (including reasonable legal fees) arising out of or in connection with any claim that the Platform, the Source Code or the Documentation infringes the Intellectual Property Rights of any third party, save to the extent that the claim arises from (a) Customer Materials or Customer Data, or (b) the Customer's use of the Platform other than in accordance with this Agreement and the Documentation.

---

### 13. Source Code Access

**13.1** **GitHub repository ownership.** The Source Code is held in a private GitHub repository (the **"Repository"**). On the Effective Date, the Supplier shall:

- (a) grant the Customer's nominated GitHub user account **"Owner"** role on the Repository (or, if the Repository sits within a GitHub organisation, equivalent administrative rights including the ability to add and remove collaborators, manage access and transfer ownership);
- (b) ensure that the Customer's nominated user retains such rights at all times during the Term; and
- (c) provide the Customer with a written summary of the Repository structure, branch protection rules, and CI/CD configuration, as part of the Documentation.

**13.2** **No removal of access.** The Supplier shall not remove, downgrade or otherwise impair the Customer's access to the Repository at any time during the Term, save with the Customer's prior written consent.

**13.3** **Repository transfer on termination.** On termination or expiry of this Agreement for any reason, the Supplier shall, if so requested by the Customer, transfer ownership of the Repository (or, where the Repository sits within a GitHub organisation, transfer the Repository to a Customer-controlled organisation) within ten (10) Business Days, at no additional charge.

> **Drafting note:** This clause replaces a traditional source-code escrow arrangement. Because the Customer owns the IP and holds Owner rights on the GitHub repository from day one, escrow is unnecessary — the Customer already has the source code in a form it controls.

---

### 14. Data Protection

**14.1** The Parties acknowledge that, in providing the Services, the Supplier processes Personal Data on behalf of the Customer. For the purposes of Applicable Data Protection Laws, the Customer is the **Controller** and the Supplier is the **Processor**.

**14.2** Each Party shall comply with its respective obligations under Applicable Data Protection Laws.

**14.3** The detailed terms governing the processing of Personal Data, including the obligations of the Supplier under Article 28 of the UK GDPR, are set out in **Schedule 4 (Data Processing Agreement)**.

**14.4** The list of approved Sub-processors is set out in **Schedule 5**. The Supplier shall not engage any new Sub-processor without giving the Customer not less than thirty (30) days' prior written notice. The Customer may object on reasonable grounds within that period; failing agreement, the Customer may terminate this Agreement under clause 19.2(c).

**14.5** **Data residency.** The Supplier shall ensure that all Customer Personal Data is stored in a UK or EU region, save where transfer outside the UK or EEA is necessary for the operation of a Sub-processor and is supported by an appropriate transfer mechanism under Schedule 4.

**14.6** **Independent security review.** Prior to Go-Live (and as part of gate G3), the Supplier shall procure, at its own cost, an independent security review including a penetration test by a suitably qualified third party, and shall share the executive summary of the report with the Customer. Any high-severity findings shall be remediated prior to Go-Live.

**14.7** **Annual penetration testing.** Annual penetration testing after the first Licence Year is available on request and shall be quoted separately under clause 9.5.

---

### 15. Warranties

**15.1** The Supplier warrants that:

- (a) it has the right to enter into this Agreement and to perform its obligations under it;
- (b) the Services shall be performed with reasonable skill and care;
- (c) for a period of ninety (90) days from Go-Live (the **"Warranty Period"**), the Platform shall conform in all material respects to the Documentation; and
- (d) the Platform, when used in accordance with the Documentation, does not infringe the Intellectual Property Rights of any third party.

**15.2** The Customer's exclusive remedy for breach of clause 15.1(c) during the Warranty Period shall be that the Supplier shall, at no charge, use reasonable endeavours to correct the non-conformity. After the Warranty Period, defects shall be addressed under the Support Services.

**15.3** The Customer warrants that it has the right to provide the Customer Materials and Customer Data to the Supplier for the purposes of this Agreement.

**15.4** Save as expressly set out in this Agreement, all warranties, conditions and terms (whether express or implied by statute, common law, custom or otherwise) are excluded to the maximum extent permitted by law.

---

### 16. Confidentiality

**16.1** **Confidential Information** means any information, in whatever form, that a reasonable person would understand to be confidential, including (without limitation) the terms of this Agreement, the Customer Data, the Source Code, the Documentation, the business affairs of either Party, and any information clearly marked or designated as confidential.

**16.2** Each Party (the **"Receiving Party"**) shall:

- (a) keep the Confidential Information of the other (the **"Disclosing Party"**) strictly confidential;
- (b) use it solely for the performance of this Agreement;
- (c) disclose it only to its personnel, professional advisers and, in the case of the Supplier, its Sub-processors, in each case on a need-to-know basis and under written confidentiality obligations no less protective than this clause 16; and
- (d) take reasonable security measures to protect it.

**16.3** Clause 16.2 shall not apply to information that:

- (a) is or becomes publicly available through no fault of the Receiving Party;
- (b) was lawfully in the Receiving Party's possession before disclosure, free of any obligation of confidence;
- (c) is independently developed by the Receiving Party without reference to the Disclosing Party's Confidential Information; or
- (d) is required to be disclosed by law, regulation or court order, provided the Receiving Party (where lawful and practicable) gives the Disclosing Party prompt notice and reasonable opportunity to seek a protective order.

**16.4** The obligations in this clause 16 shall survive termination or expiry of this Agreement for a period of **five (5) years**, save that obligations relating to Personal Data and trade secrets shall survive indefinitely.

---

### 17. Limitation of Liability

**17.1** Nothing in this Agreement shall limit or exclude either Party's liability for:

- (a) death or personal injury caused by its negligence;
- (b) fraud or fraudulent misrepresentation; or
- (c) any other liability that cannot be limited or excluded by law.

**17.2** Subject to clause 17.1, **neither Party shall be liable** to the other, whether in contract, tort (including negligence), breach of statutory duty or otherwise, for any:

- (a) loss of profit;
- (b) loss of revenue, business or anticipated savings;
- (c) loss of opportunity or goodwill; or
- (d) indirect or consequential loss,

in each case howsoever arising.

**17.3** Subject to clauses 17.1 and 17.4, the **total aggregate liability** of each Party to the other under or in connection with this Agreement, whether in contract, tort (including negligence), breach of statutory duty or otherwise, in any Licence Year shall be limited to a sum equal to **one hundred and fifty per cent (150%)** of the total Charges paid or payable by the Customer to the Supplier in the twelve (12) months immediately preceding the event giving rise to the claim, or (for events occurring in the first twelve months of the Term) one hundred and fifty per cent (150%) of the Charges paid plus the projected Annual Licence Fee for the first Licence Year.

**17.4** The limitations in clause 17.3 shall **not apply** to:

- (a) the Supplier's IP indemnity under clause 12.6;
- (b) liability arising under or in connection with Schedule 4 (Data Processing Agreement) for the Supplier's breach of Applicable Data Protection Laws, including any monetary penalty imposed on the Customer by a supervisory authority that is attributable to the Supplier's breach;
- (c) breach of clause 16 (Confidentiality);
- (d) the Customer's obligation to pay the Charges; or
- (e) liability arising from clause 17.1.

For the matters in clauses 17.4(a), (b) and (c), the total aggregate liability of the relevant Party shall be limited to **£500,000**.

> **Drafting note:** A super-cap of £500,000 on the carved-out heads is standard market practice; uncapped exposure on data-protection liability is unusual outside enterprise deals. Adjust if required.

---

### 18. Indemnities

**18.1** The Supplier shall indemnify the Customer in respect of the matters set out in clause 12.6 (IP indemnity).

**18.2** Each Party shall indemnify the other against any losses, damages, costs and expenses (including reasonable legal fees) arising out of any breach by it of clause 16 (Confidentiality) or Schedule 4 (DPA), subject to the limits in clause 17.

---

### 19. Termination

**19.1** **Termination for convenience by the Customer.** The Customer may terminate this Agreement for convenience on not less than ninety (90) days' written notice to the Supplier, expiring at any time. Annual Licence Fees paid in respect of the period after the effective date of termination shall not be refundable.

**19.2** **Termination for cause.** Either Party may terminate this Agreement immediately on written notice to the other if:

- (a) the other commits a material breach of this Agreement and (in the case of a breach capable of remedy) fails to remedy it within thirty (30) days of being required to do so in writing;
- (b) the other becomes insolvent, enters administration, has a receiver appointed, makes any voluntary arrangement with its creditors, ceases or threatens to cease to carry on business, or undergoes any analogous event in any jurisdiction; or
- (c) (in the case of the Customer) the Supplier engages a new Sub-processor to which the Customer has reasonably objected under clause 14.4 and no acceptable alternative is agreed within thirty (30) days.

**19.3** **Consequences of termination.** On termination or expiry of this Agreement for any reason:

- (a) all licences granted under clause 8 shall terminate;
- (b) the Supplier shall comply with clauses 13.3 and 19.4 (Exit assistance);
- (c) the Supplier shall return or, at the Customer's option, securely destroy all Customer Data and Customer Materials in its possession or control, in accordance with Schedule 4;
- (d) any sums then due to either Party shall become immediately payable; and
- (e) clauses that are expressed to survive, or that by their nature should survive, shall continue in force.

**19.4** **Exit assistance.** The Supplier shall provide reasonable exit assistance to the Customer for a period of up to ninety (90) days following termination, including:

- (a) provision of a final export of all Customer Data in a structured, commonly-used and machine-readable format (CSV or JSON, plus original document files);
- (b) transfer of the Repository under clause 13.3;
- (c) handover of operational credentials, environment variables and infrastructure access;
- (d) reasonable knowledge transfer to a successor supplier nominated by the Customer; and
- (e) up to ten (10) hours of advisory support, additional time being charged at the Supplier's then-prevailing time-and-materials rates as agreed in writing.

There shall be no charge for the exit assistance in (a) to (c). Items (d) and (e) shall be at no charge for the first ten (10) hours and otherwise quoted under clause 9.5.

---

### 20. Notices

**20.1** Any notice given under this Agreement shall be in writing and shall be sent:

- (a) by hand or by pre-paid first-class post or recorded delivery to the registered office of the recipient; or
- (b) by email to the address notified by the recipient in writing for this purpose.

**20.2** Notices shall be deemed received: if delivered by hand, on the date of delivery; if posted, on the second Business Day after posting; if emailed, at the time of transmission, provided no bounce or non-delivery message is received.

**20.3** This clause does not apply to the service of any proceedings or other documents in any legal action.

---

### 21. Force Majeure

**21.1** A **"Force Majeure Event"** means any event beyond the reasonable control of a Party, including act of God, war, terrorism, civil disturbance, fire, flood, epidemic, pandemic, or industry-wide failure of telecommunications or internet infrastructure.

**21.2** Neither Party shall be in breach of this Agreement, nor liable for delay in performing or failure to perform any of its obligations under this Agreement, where the delay or failure results from a Force Majeure Event, provided the affected Party (a) notifies the other promptly, (b) uses reasonable endeavours to mitigate the effect, and (c) resumes performance as soon as reasonably practicable.

**21.3** If a Force Majeure Event continues for more than sixty (60) consecutive days, either Party may terminate this Agreement on written notice.

---

### 22. General

**22.1** **Entire agreement.** This Agreement constitutes the entire agreement between the Parties in respect of its subject matter and supersedes all prior agreements, understandings and arrangements (whether oral or written). Each Party acknowledges that it has not relied on, and shall have no remedy in respect of, any statement, representation, assurance or warranty (whether made innocently or negligently) that is not set out in this Agreement.

**22.2** **Variation.** No variation of this Agreement shall be effective unless it is in writing and signed by an authorised representative of each Party.

**22.3** **Assignment.** Neither Party may assign, transfer or sub-contract any of its rights or obligations under this Agreement without the prior written consent of the other (such consent not to be unreasonably withheld), save that the Customer may assign this Agreement to any successor body that takes over the operation of the bursary scheme.

**22.4** **Sub-contracting.** The Supplier may sub-contract the performance of any of its obligations under this Agreement, subject to clauses 3.2, 3.3 and 14.4.

**22.5** **No partnership.** Nothing in this Agreement creates any partnership, joint venture or agency relationship between the Parties.

**22.6** **No third-party rights.** A person who is not a Party shall have no rights under the Contracts (Rights of Third Parties) Act 1999 to enforce any term of this Agreement.

**22.7** **Severance.** If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force.

**22.8** **Waiver.** A failure or delay by either Party to exercise any right under this Agreement shall not constitute a waiver of that right.

**22.9** **Counterparts and electronic signature.** This Agreement may be executed in counterparts, each of which shall be deemed an original, and may be signed electronically (including via DocuSign or similar service).

**22.10** **Governing law.** This Agreement, and any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with it or its subject matter or formation, shall be governed by and construed in accordance with the laws of **England and Wales**.

**22.11** **Jurisdiction.** Each Party irrevocably agrees that the courts of England and Wales shall have **exclusive jurisdiction** to settle any dispute or claim arising out of or in connection with this Agreement.

---

## Signatures

**SIGNED** for and on behalf of **RESULT DRIVEN DEVELOPMENT LLC** (trading as Meridian Technology Group):

Signature: ______________________________________________

Name: Brian Wagner

Title: Member

Date: ____________________________

&nbsp;

**SIGNED** for and on behalf of **THE JOHN WHITGIFT FOUNDATION**:

Signature: ______________________________________________

Name: Roisha Hughes

Title: Chief Executive Officer

Date: ____________________________

---

# Schedule 1 — Development Services, Project Plan and Acceptance Criteria

## 1. Description of the Platform

The Platform is a bespoke web-based bursary administration system for the John Whitgift Foundation, built on the following technology stack:

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend / data:** Prisma 6, Supabase (PostgreSQL, Auth, Storage)
- **Email:** Resend
- **PDF generation:** @react-pdf/renderer
- **Charts / reporting:** Recharts, ExcelJS
- **Hosting:** Vercel (Next.js), Supabase (database, authentication, storage)
- **Source control:** GitHub
- **Error monitoring:** Sentry
- **Support ticketing:** Zoho Desk

The Platform comprises, at minimum, the following functional areas:

- Applicant portal with a 10-section sequential application wizard
- Administrative dashboard with metrics, application tracking and round management
- Assessment interface with split-screen document review and four-stage calculation engine (Income → Assets → Living Costs → Bursary)
- Recommendations module with reason codes and PDF export
- Sibling linking and family configuration support
- Reports and dashboards with charting
- XLSX / CSV exports
- Comprehensive audit trail
- GDPR controls (right-to-deletion workflow, 7-year retention, anonymised User views)
- Role-based access control (admin, assessor, applicant)
- Document upload with secure, time-limited URL access
- Invitation-only User registration

## 2. Project Plan and Gates

The Development Services shall be delivered through the following four gates:

**Gate G1 — Initial Release (Beta on Staging).** Target: week commencing **11 May 2026**. The Platform shall be feature-complete on a production-like staging environment, with an internal regression run completed and realistic sample data loaded.

**Gate G2 — User Acceptance Testing.** Target: **18 May 2026 to 12 June 2026**. The Customer's nominated assessors shall run end-to-end real-world scenarios (including new applications, re-assessments, sibling linking, internal bursary requests, recommendation export and GDPR deletion). The **Calculation Parity Test** shall be completed against not fewer than ten (10) historical cases supplied by the Customer.

**Gate G3 — Pre-Production Hardening.** Target: **15 June 2026 to 22 June 2026**. Activities shall include the independent GDPR review and security penetration test required under clause 14.6; mobile and accessibility check against the WCAG 2.1 AA target; performance and load testing; email-at-volume testing; and remediation of any high-severity findings.

**Gate G4 — Production Go-Live.** Target: week commencing **22 June 2026**. Activities shall include cutover to the live domain, onboarding of the Customer's assessor(s) and commencement of the two-week Hypercare Period under clause 9.4.

## 3. Calculation Parity Test

For Acceptance, the Supplier shall demonstrate that the Platform's four-stage assessment engine produces results that are materially equivalent to the Customer's existing assessment spreadsheet for not fewer than ten (10) anonymised historical cases supplied by the Customer.

**Material equivalence** means that:

- the recommended bursary award amount differs by no more than five per cent (5%) from the spreadsheet result; and
- any difference is explainable by reference to the assessment logic (e.g. rounding, treatment of edge-case income types, or documented improvements to the assessment model).

The Customer shall supply the historical cases (in anonymised form) not later than **15 May 2026** to enable parity testing during G2.

## 4. Documentation

The Supplier shall provide, at no additional charge:

- a User guide for applicant Users
- an administrator and assessor guide for Customer staff
- a technical/operational guide covering deployment, environment configuration, backup and restore procedures, and incident response
- a data-model reference and API documentation
- an open-source component manifest (clause 12.2)
- a Repository structure summary (clause 13.1(c))

---

# Schedule 2 — Charges

## 1. Build Fee

**£5,000 (five thousand pounds)**, payable on the Effective Date. No UK VAT is chargeable as at the Effective Date — see clause 11.5.

## 2. Annual Licence Fee

**£7,000 (seven thousand pounds)** per Licence Year, invoiced as set out in clause 11.2. No UK VAT is chargeable as at the Effective Date — see clause 11.5.

## 3. Cost build-up (illustrative)

The Annual Licence Fee is built bottom-up from the components set out below. This breakdown is provided for transparency; the Supplier is not obliged to itemise actual costs against this build-up at any given time, save in respect of pass-through under clause 11.4.

**Infrastructure (sub-total ~£1,000 per annum):**

- **Vercel Pro** — production hosting, edge network and zero-downtime deploys (approximately £200 per annum).
- **Supabase Pro** — managed PostgreSQL database, authentication, encrypted Storage, daily backups and point-in-time recovery (approximately £240 per annum).
- **Resend (transactional email)** — invitations, notifications and reminders (approximately £190 per annum).
- **Sentry** — real-time error alerting and crash reporting (approximately £250 per annum).
- **Domain and SSL** — e.g. jwf-bursary.org or an alternative agreed domain (approximately £20 per annum).
- **Headroom for traffic spikes and vendor overage** — buffer (approximately £100 per annum).

**Maintenance retainer (£6,000 per annum):** light-touch ongoing engineering work, support and minor enhancements within the scope of clause 9.2.

**Total Annual Licence Fee: £7,000 per annum.**

## 4. Out-of-scope work

Work undertaken under clause 9.5 shall be quoted separately. Each statement of work shall set out the agreed pricing model (fixed price, hourly, daily, or retainer) and the applicable rate.

The Supplier's indicative rate card as at the Effective Date is set out below. These rates are anchors only; specific engagements may be priced above or below the indicative rates by agreement, and the rate card may be reviewed and adjusted from time to time on reasonable notice (subject to the price-protection principles in clause 11.3, which apply to the Annual Licence Fee but not to out-of-scope work).

- **Hourly engagement:** £200 per hour.
- **Daily engagement:** £1,280 per day.
- **Monthly retainer:** £4,000 per month.

All rates are stated net of VAT, on the basis described in clause 11.5.

The pricing model and rate for any particular piece of work shall be confirmed in the relevant statement of work agreed under clause 9.5 before any work commences.

## 5. Migration

Migration of data from Symplectic Grant Tracker is not included in the Charges and shall be the subject of a separate statement of work (clause 2.2).

---

# Schedule 3 — Service Levels

## 1. Severity classifications and response/resolution targets

Tickets shall be triaged into one of four severity levels. Response times are measured during Business Hours (Monday to Friday, 09:00 to 17:30 UK time).

**Critical severity** applies where the Platform is unavailable, or a major function is inoperable with no workaround, during an active application round (for example: the system is down; assessors cannot access applications; the calculation engine is producing incorrect results). The Supplier shall provide an initial response within **four (4) Business Hours**, and shall target resolution or a workaround within **one (1) Business Day**.

**High severity** applies where a major feature is broken and no easy workaround exists (for example: a report fails to generate; document upload fails for a class of file types). The Supplier shall provide an initial response within **one (1) Business Day**, and shall target resolution or a workaround within **three (3) Business Days**.

**Medium severity** applies to minor bugs and cosmetic issues for which a workaround exists (for example: a display issue on a non-critical page; a minor labelling inconsistency). The Supplier shall provide an initial response within **two (2) Business Days**, and shall target resolution at the next maintenance cycle.

**Low severity** applies to questions, suggestions and enhancement requests (for example: "Can we add a column to this report?"). The Supplier shall provide an initial response within **five (5) Business Days**, and the request shall be reviewed at the next quarterly review under clause 9.6.

## 2. Surge cover

The Customer shall notify the Supplier of the dates of each annual application round not less than thirty (30) days in advance. During each such round, the Supplier shall provide enhanced support cover in line with the SLAs above, with no additional charge. Out-of-hours cover during this window shall be on a best-endeavours basis.

## 3. Service credits

If the Supplier fails to meet a **Critical** response time on three or more occasions in any rolling three (3) month period, the Customer shall be entitled to a service credit equal to two and a half per cent (2.5%) of the Annual Licence Fee for each such failure beyond the first two, capped in accordance with clause 10.3.

## 4. Maintenance windows

Planned maintenance shall, where reasonably practicable, be scheduled outside Business Hours, with not less than five (5) Business Days' notice. Emergency maintenance (including security patching) may be carried out at short notice, with notice given as soon as reasonably practicable.

## 5. Uptime

The Supplier shall use reasonable endeavours to ensure that the Platform is available **24 hours per day, 7 days per week**, save for planned maintenance under paragraph 4 and any unavailability caused by a Sub-processor outage outside the Supplier's reasonable control. The Platform's effective uptime is bounded by the SLAs of the underlying Sub-processors (Vercel and Supabase), each of which targets ≥99.9% availability.

---

# Schedule 4 — Data Processing Agreement

## 1. Subject matter and duration

The Supplier processes Personal Data on behalf of the Customer in connection with the Services. Processing shall continue for the Term of this Agreement and for any post-termination period during which the Supplier is required to provide exit assistance under clause 19.4.

## 2. Nature and purpose of processing

The Supplier processes Personal Data for the purposes of: (a) operating the Platform; (b) providing the Hosted Services and the Support Services; (c) enabling the Customer's User Acceptance Testing; and (d) such other purposes as the Customer may instruct from time to time in writing.

## 3. Categories of data subject

- Parents and guardians of pupils applying for bursaries
- Pupils (children) named in applications
- Customer staff (administrators, assessors)
- Other individuals named in supporting documents (e.g. household members)

## 4. Categories of Personal Data

- Identification data (names, dates of birth, contact details)
- Family relationship data (parental status, sibling linkages, household composition)
- Financial data (income, assets, expenditure, bank statements, tax records, benefits status)
- Educational data (school, year group, attendance, prior bursary awards)
- Special category data: this Agreement does not contemplate the routine processing of special category data; however, supporting documents uploaded by applicants may incidentally contain such data (e.g. health information disclosed in a hardship narrative).

## 5. Supplier's obligations as Processor

The Supplier shall:

- (a) process Personal Data only on the documented written instructions of the Customer (this Agreement constituting such instructions), unless required to do otherwise by applicable law (in which case the Supplier shall, where lawful, notify the Customer);
- (b) ensure that all personnel authorised to process Personal Data are bound by appropriate confidentiality obligations;
- (c) implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including those described in paragraph 8;
- (d) not engage any Sub-processor except as permitted under clause 14.4 and Schedule 5, and ensure that any Sub-processor is bound by written terms providing the same level of protection as this Schedule 4;
- (e) assist the Customer (taking into account the nature of the processing and the information available to the Supplier) in fulfilling the Customer's obligations to respond to data subject requests;
- (f) assist the Customer in ensuring compliance with the Customer's obligations under Articles 32 to 36 of the UK GDPR (security, breach notification, data protection impact assessments, and prior consultation);
- (g) on termination or expiry of this Agreement, return or, at the Customer's option, securely delete all Personal Data, save where retention is required by law; and
- (h) make available to the Customer all information necessary to demonstrate compliance with the Supplier's obligations under this Schedule 4, and allow for and contribute to audits, including inspections, conducted by the Customer or another auditor mandated by the Customer (such audits to be conducted no more than once in any twelve-month period save where reasonably required following a security incident, on reasonable prior notice, and during Business Hours).

## 6. International transfers

The Supplier shall not transfer Personal Data outside the United Kingdom or the European Economic Area unless: (a) the transfer is to a country recognised as providing an adequate level of protection; or (b) the transfer is subject to appropriate safeguards under Article 46 of the UK GDPR (including the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses), copies of which shall be provided to the Customer on request.

## 7. Personal data breach notification

The Supplier shall notify the Customer **without undue delay**, and in any event within **forty-eight (48) hours** of becoming aware, of any personal data breach affecting Customer Personal Data, providing such information as is then available and updates as further information becomes available.

## 8. Technical and organisational measures

The Supplier shall implement and maintain at least the following measures:

- TLS 1.2 or higher in transit; AES-256 (or equivalent) at rest in the database and Storage layers
- Mandatory multi-factor authentication for all administrator and assessor accounts
- Role-based access control with the principle of least privilege
- Data minimisation in User-facing views (default-anonymised queues, audit-logged name reveals)
- Time-limited, signed URLs for document access
- Immutable audit trail of create / update / delete operations on records
- OWASP Top 10 hardening, Content Security Policy headers, rate-limited authentication, virus scanning of uploads
- Daily automated backups with point-in-time recovery (≥30-day window)
- Annual GDPR review (clause 9.2); independent security review and penetration testing prior to Go-Live (clause 14.6)
- Sub-processors maintaining ISO 27001, SOC 2 Type II or equivalent certifications

## 9. Records

The Supplier shall maintain a written record of all categories of processing activities carried out on behalf of the Customer, in accordance with Article 30(2) of the UK GDPR, and shall make such record available to the Customer or a supervisory authority on request.

---

# Schedule 5 — Approved Sub-processors

The Customer authorises the Supplier to engage the following Sub-processors as at the Effective Date. Where any Sub-processor processes data outside the United Kingdom or the European Economic Area, the relevant transfer mechanism (the UK International Data Transfer Agreement and/or the UK Addendum to the EU Standard Contractual Clauses) shall apply, in accordance with paragraph 6 of Schedule 4.

**Vercel Inc.** Role: production hosting, edge network and deployment platform for the Platform. Location of processing: a UK or EEA region (such as Vercel's London or Frankfurt regions). Transfer mechanism: where any data is processed in the United States for control-plane or observability purposes, the UK IDTA / UK Addendum to the EU SCCs shall apply.

**Supabase Inc.** Role: managed PostgreSQL database, authentication services and encrypted Storage for the Platform. Location of processing: an EU region (such as Supabase's "eu-west-2 / London" region or equivalent). Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs, where applicable.

**GitHub, Inc.** (a Microsoft subsidiary). Role: hosting of the Source Code repository. Location of processing: EEA or United Kingdom where GitHub Enterprise data residency is available; otherwise the United States. Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs.

**Functional Software, Inc. (trading as Sentry).** Role: error monitoring and alerting. Location of processing: an EU region (Sentry EU data residency). Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs, where applicable.

**Resend, Inc.** Role: transactional email delivery (invitations, notifications, reminders). Location of processing: an EU region, where supported. Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs.

**Zoho Corporation Pvt. Ltd. (Zoho Desk).** Role: support ticketing platform. Location of processing: an EU region (Zoho EU data centre). Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs, where applicable.

**Engineering subcontractors.** Role: software development, code review and on-call rotation, engaged by the Supplier under written confidentiality and IP-flow-down terms in accordance with clauses 3.2 and 3.3. Location of processing: United Kingdom, EEA and/or United States. Transfer mechanism: the UK IDTA / UK Addendum to the EU SCCs, in respect of any processing outside the UK/EEA.

> **Drafting note:** The named legal entities and data-residency claims should be sense-checked against current vendor terms before execution, as some vendors have restructured (e.g., Vercel's UK entity, Supabase's EU subsidiary). Confirm exact geographic regions selected at deploy time.

---

# Schedule 6 — Support Model

## 1. Support channel

- **Primary channel:** Zoho Desk ticketing portal, with a dedicated support email address auto-creating tickets.
- **Self-service portal** for the Customer's nominated administrators to raise, track and view ticket history.
- All communications are recorded for audit purposes, including SLA timers and resolution.

## 2. Coverage

- **Day-to-day support:** Brian Wagner (primary contact), supported by the Supplier's wider engineering team.
- **Backup coverage:** The Supplier maintains a bench of engineering personnel capable of providing cover for leave, surges during the application round, and parallel work on enhancements. The Customer always has a route to a responder regardless of any individual's availability.

## 3. Hours

Business Hours (Mon–Fri, 09:00–17:30 UK time), save during the Hypercare Period and during the annual application round, where surge cover applies (Schedule 3, paragraph 2).

## 4. Quarterly review

The Parties shall hold a quarterly review meeting (in person or by video) to:

- review open tickets and the maintenance backlog;
- prioritise enhancements;
- review usage metrics and infrastructure health;
- discuss any anticipated surges (e.g. application round timing); and
- address any commercial questions including out-of-scope work.

## 5. Onboarding new staff

The Supplier shall provide reasonable onboarding support to new Customer staff at no additional charge, in particular by reference to the Documentation. Bespoke training sessions (beyond standard Documentation walk-throughs) shall be quoted separately under clause 9.5.

---

> **End of draft.**
>
> **Items to verify before execution:**
> 1. Trustee resolution / board minute authorising Roisha Hughes (CEO) to sign on behalf of the Foundation.
> 2. Sub-processor regional selections at deploy (Schedule 5) — confirm exact Vercel, Supabase, Sentry, Resend and Zoho data-centre regions.
> 3. Application round dates to be notified by the Customer to the Supplier in writing as required under Schedule 3, paragraph 2.
