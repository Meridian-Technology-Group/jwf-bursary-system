# Open Questions & Requirements Gaps

This document captures identified gaps in the documented requirements that need clarification before the system can be built. Items are grouped by category and ranked by priority.

---

## Critical (blocks core architecture decisions)

### Q1. What does "validation" actually produce?

When the assessor validates a submitted application, do they:

**(a)** Simply confirm the application is complete and documents are present (a pass/fail gate), then work with the applicant's declared figures in the assessment calculation? A: I believe it only confirms that all the documents have been uploaded (tabs all green ticked)

**(b)** Re-enter a parallel set of **assessor-verified figures** derived from the uploaded documents (P60s, tax returns, bank statements) that replace/override the applicant's self-declared values?

The answer determines whether the assessment engine operates on applicant-entered data or assessor-entered data, which is a fundamental architectural decision affecting the data model.

**Related sub-question:** The application collects **GROSS income** ("before deduction of tax from all sources"). The assessment model calculates using **NET income** (net pay, net dividends after tax, net profits after tax). Where does the gross-to-net transformation happen? Does the assessor read net figures from the P60 and enter them into the checklist? A: We ask for the gross total as these are the easiest to not get wrong; however, the assessor will manually work out the correct net amount whether it is from a P60, a P45 or a tax return

---

### Q2. How is the calculated break-even figure turned into an actual bursary award?

The assessment calculation produces a "Required Bursary Level to Break Even" — the gap between school fees and household disposable income. But:

- Is this figure the actual awarded bursary, or does the committee adjust it? A: Yes, this is the bursary award in nominal value.  As we have a logic of payable fees, we have scholarships coming into the calculations as % but bursaries are calculated as nominal values.
- Are bursaries awarded as exact pound amounts, percentages of fees, or in bands/tiers (e.g. 25%, 50%, 75%, 100%)? A: Nominal values, not %
- Is there a minimum threshold below which a bursary is not awarded? A: Yes, £27,000 as a benchmark
- Is there a maximum cap? Can a bursary cover 100% of fees? A: Yes, £90,000 as a benchmark. Yes a bursary will cover the entire annual school fees if the household earns £27K or less, or they might earn more but have more deductions which makes them qualify for a full bursary.
- Can the committee award more or less than the calculated break-even figure, and if so, do they record a reason? A:  Yes, if for instance, we have an internal bursary request due to a parent falling gravely ill for instance, there might be some exceptional adjustments on pastoral grounds. Also, if a parent was assessed originally 6 years ago and their assessment was not accurate (we had issues prior to moving to a digital solution with the previous bursary team, before my time) then their payable fees might need to be adjusted to reflect the fact that we have to honour the original level of fees which act as an original benchmark. (for example, a place at £1,500 a year is confirmed to parent A; on the following year, we discover that the original assessment had not looked at the fact that the family had £90,000 in savings. Yet they had added it on their application. This would mean that we cannot increase the payable fees due to the savings; we will only be able to increase the payable fees if we can demonstrate that there has been a positive change to the financials of that family year on year)

---

### Q3. How does the second parent/guardian access the application?

The current system shows a "Registered on:" field for Parent/Guardian 2, implying they have their own portal account. Clarifications needed:

- Does the admin invite both parents, or just the lead applicant? A: Rarely we create a separate application if parents are right in the middle of an acrimonious separation and not in talking terms. If parents are divorced, we assess the one with the main custody. If the custody is shared 50/50, we asses both of them
- Does the lead applicant invite the second parent from within the application form? A: No
- Do both parents edit the same application, or does each parent only complete their own sections (contact details, employment, income, declaration)?
- Can both parents be logged in and editing simultaneously? A: No, only the lead applicant has access via their email address
- Does Parent 2 get full visibility of the entire application, or only their own sections? A: Most of the time, the lead applicant answers on behalf of both parents, they tick the box ‘ married couple’ or the divorced parent or separated parent or single parent applies as a sole parent and we check that this is really the case.

---

## High Priority (affects data model and calculation engine)

### Q4. Gross-to-net income: who calculates it and how?

The application collects gross income across ~14 generic line items. The assessment model needs net income categorised by employment type. Specifically:

- Does the assessor read net pay from the P60 and enter it into the checklist, ignoring the applicant's gross figure? A: Yes, absolutely. We look at the tax document, not what the applicant fills in.
- For self-employed applicants, does the assessor derive net profit from the uploaded accounts? A: Yes, absolutely. We look at the tax document, not what the applicant fills in.
- For benefits, does the assessor extract specific amounts (HB, UC, JSA, ESA, DLA, Carer's, Tax Credits) from uploaded evidence? A: Yes, absolutely. We look at the benefits documents and the bank statements, not what the applicant fills in.
- Is there any automated tax calculation, or is this entirely manual? A: It is manual as a human eye needs to check the form is HMRC referenced etc…

If the assessor manually re-enters all figures from source documents, the applicant's income table is essentially a guide/cross-reference rather than the calculation input. A: Well on the first page when working out the overall net income yes. It is afterwards that the calculations are applied. I have given you a short version of it just for you to see the logic without having to go through it in full.

---

### Q5. How are specific benefit types captured?

The assessment model needs individual amounts for: Housing Benefit, Universal Credit, Tax Credits (Working & Child), Income Support, JSA, Disability Allowance, ESA, and Carer's Allowance.

The application form income table has generic rows ("working tax credits", "state benefits") that don't break down to this level. Are these:

- Extracted by the assessor from uploaded benefit letters and entered into the checklist? A: Yes , there are quarterly paid benefits, monthly paid benefits, it is easier the full amount calculated on the side as you should see what parents send in…
- Expected to be declared by the applicant in more detail than the current form captures (i.e. the form needs additional benefit-specific fields)? A: Yes , some benefits might not be included as income (disability of a child for instance, whilst DLA for a parent, is included)

---

### Q6. Number of schooling years remaining

The savings formula divides total savings by "number of schooling years left for the bursary recipient." This value is not collected in the application form.

- Is it derived from the child's date of birth? If so, what is the assumed end point — Year 11 (age 16)? Year 13 (age 18)? Does it depend on the school or the child's current year group?
- Or does the assessor enter this manually? A: No, it is derived from the year of entry but entered manually. So year 6- 8 years till year 13; year 7 – 7 years till year 13;  year 9: 5 years till year 13; year 12: 2 years till year 13. These are the four possible entries for a bursary. Yet, internal bursary requests can apply any time

---

### Q7. Council Tax band

The assessment deducts council tax using a band-based lookup (default Band D = £2,480). The application asks the applicant to upload a council tax bill but does not ask them to state their band.

- Does the assessor read the band from the uploaded bill and select it in the checklist? A: No, it should apply the value £2480 by default.
- Should the application form be updated to ask the applicant to select their council tax band directly? A: No, we use the Council tax letter to do some other checks. Parents may choose to live in a very expensive mansion and therefore we should not deduct for instance the highest Council tax amount for that reason. However, council rates change every year so the £2480 number needs to be updated accordingly.

---

### Q8. Property classification table (categories 1-12)

The property classification table exists in the assessment spreadsheet (from "Renting" through to "Portfolio > £1.8m") but is not referenced in the four-stage calculation flow.

- Is it used as a qualitative classification for committee context? A: Well, it can show that a family does not qualify for a bursary because for instance they own 3 properties totalling £1.5m. (The qualifying criteria when it comes to property is officially have one property valued less than £750K). This is used for reporting purposes back to the school as we will never share precise information.
- Does it feed into a calculation step not documented in the spreadsheet? A: No
- Does it influence the bursary decision beyond the numerical calculation (e.g. an applicant in category 10+ would be automatically rejected)? A: Yes

---

### Q9. Multiple children from one family

If a family has two children at Foundation schools:

- Is it one application per child, or one application per family? A: One per child, it is nominative
- The reference format includes the child's name, suggesting per-child. If so:
  - Does the family re-enter all financial information for each child's application? A: Yes, as the first application is then used to create the active bursary account; the original reference is amended to the account reference on the fees billing system with the child’s name
  - Or does a second child's application inherit the household financial data?
- How does the bursary calculation work — is the "Required Bursary Level" per child, or is the household need divided across children? A: No the first child usually takes up any net disposable income available, then the second child qualifies for a full bursary, on the logic that all the available funds of the household have gone to child one already
- If one child already has a bursary, how does that factor into a new application for a sibling? A: The payable fees for child 1 appear as a deduction in the net disposable income calculation of child 2.

---

## Medium Priority (affects workflow and UX)

### Q10. Committee review process

"Bursary Committee Review" appears as an action in the admin console. How does the committee work?

- Do multiple assessors/committee members review each application, or is it one assessor per application? A: one assessor per application
- Is there a formal vote or scoring by individual committee members? A: Not a vote. The assessment model gives us the bursary award that should be given. The Foundation only carries out the assessments. Our recommendations are sent to the school  and the school decides, based on how well the candidate has done at the entrance exam and the funds available for that year, which candidate will get a bursary supported place.
- Does each committee member log in and record their view, or does one person operate the system during a meeting? A: No, the system is locked, only the Bursary team accesses the bursary portal
- Is there a "recommend" step (assessor recommends, committee approves)? A: As above

---

### Q11. Requesting additional information from applicants

If submitted documents are inadequate or information is missing:

- Can the admin send the application back to the applicant for corrections? A: The assessor very often pauses the assessment if the application is missing some documents. The applicant receives an email from the bursary team. They email the missing document or information and the assessor attaches the missing document to the application form and ‘regenerates it’ to reflect that it now has the document. If the form is too botched up, the application is rejected and the applicant is asked to either start again all over or complete and all the fields not correctly filled in.
- If so, does the application status revert to "in progress" and the applicant can edit and re-submit? A: Well technically yes, but there is a bug so no.
- Or is communication handled outside the system (email/phone) with the admin making corrections on their side? A: Yes

---

### Q12. Re-assessment invitation flow

For annual re-assessment of existing bursary holders:

- Is the re-assessment invitation automatic (system emails all active bursary holders when a new round opens)? A: The application goes back into the portal with its original status of not being submitted
- Or does the admin manually trigger invitations for each existing holder? A: The assessor sends a prewritten email asking the applicant to start again with a new submission due date
- Does the applicant's portal account persist between years, or must they re-register? A: No, we take care, via the rounds logic, of inviting the relevant contacts each year, they don’t have to worry or remind us who needs to be assessed
- Is any data pre-populated from the previous year's application (e.g. child details, address)? A: Only the lead applicant’s address details

---

### Q13. Assessor-entered checklist fields

The checklist tabs beyond "Net Assets Position" are mentioned but their specific input fields are not documented: A: irrelevant at this stage

- **Living Conditions / Other JWF Children** — what fields? Free text? Scored inputs?
- **Debt Situation** — does the assessor enter verified debt figures, or is it qualitative?
- **Other Fees with the Foundation** — what is captured here?
- **Staff Situation** — is this a simple yes/no, or more detailed?
- **Financial Profile Impact** — how are life events (divorce, redundancy, illness) scored or weighted?

Are any of these tabs scored numerically, or are they qualitative context for the committee?

---

### Q14. Historical comparison for re-assessments

When assessing a re-application:

- Does the assessor need to see the previous year's figures alongside the current year? A: Yes
- Is there a year-on-year comparison view? A: Kind of , not what I would hope to see
- Are significant changes (income drop/rise, new property, change in household composition) flagged automatically? A: No

---

### Q15. Bursary outcome statuses

What are the possible outcomes of an assessment? Specifically:

- Is it binary (Approved / Rejected)? A: Either qualifies for a bursary, if so, the specific award is or does not qualify
- Or are there intermediate statuses (Approved at X%, Waitlisted, Deferred, Approved subject to conditions, Under review)? A: No at the stage of the assessment, providing that the assessor has received all the documents, the assessment will be either paused or not started or completed and then the bursary outcome will either be qualify or doesn’t qualify. The waiting list is with the admissions teams once they have awarded the bursaries and used up all their funds, they will have a waiting list and will need one declined bursary supported place before being able to offer a new bursary to the first one on the waiting list
- If approved, what data is recorded — just the bursary amount/percentage, or also conditions, review notes, committee minutes? A: Bursary amount, we have a payable fees logic, not a % logic


---

## Lower Priority (affects completeness but not MVP)

### Q16. Appeals process

Is there a formal appeals process if an applicant disagrees with the outcome?

- If so, does the system need to support it (appeal submission, review workflow, outcome tracking)? A: Every year, a rolling-over assessment is done of a family and the family has 4 weeks to appeal if they disagree with the outcome. This takes place outside the console, by email, and the assessment is rarely changed unless an error has been made. (we don’t increase a bursary because a parent has negotiated with us or asked us to do so as we stick to the outcome given by the assessment model)
- Or is it handled outside the system? A: Yes

---

### Q17. Mid-year changes

If a family's circumstances change drastically mid-year (e.g. job loss, bereavement):

- Is there a process for emergency reassessment outside the annual cycle? A: Separate/ different
- If so, does the system need to support ad-hoc applications/reviews? A: The internal bursary requests sometimes, as explained above, for pastoral reasons

---

### Q18. Admin roles and permissions

What admin roles are needed?

- Is there a distinction between the person who validates and the person who makes the final decision? A: Yes the person who validates is the one doing the assessment; the person who decides if the bursary is awarded is the school’s HM
- Can certain staff only see applications for a specific school?
- Are there read-only roles (e.g. committee members who can view but not edit)? A: No
- Who can update the reference tables (notional rents, food costs, school fees)? A: The assessor, so I can. I review the amounts every year according to CPI etc..

---

### Q19. Data retention and GDPR

- How long are applications and uploaded documents retained? A: We need to keep them legally for 7 years but parents, once the 4 week appeal period has passed, cannot challenge their award afterwards or for previous years. This used to be the case 7 years ago and this was a nightmare
- Are rejected applications retained or purged after a period? A: Purged
- When a bursary ends (child leaves school), when is the data deleted? A: Yes after 7 years
- Do applicants have the right to request deletion of their data, and what does that mean for historical assessment records? A: Yes absolutely, they often do especially if they learn that they do not qualify when they think they would.

---

### Q20. Income line item mapping

The application collects ~14 generic income rows. The assessment model categorises income by employment type. Is there a defined mapping between the two, or does the assessor disregard the applicant's line items and work entirely from source documents? A: The assessor disregards the applicant's line items and works entirely from source documents. Many parents call themselves many things  (for example, unemployed when they are directors of their company or property landlords) so the assessor’s role is to draw the correct picture from all this and calculate the correct overall net income for the household.

If there is a mapping, it should be documented so the system can pre-populate or assist the assessor.

---

## Follow-Up Questions (arising from answers to Q1-Q20)

The answers above revealed several new concepts and mechanics that were not previously documented. These questions need clarification before the system architecture can be finalised.

### Q21. Payable fees and scholarship interaction

The answer to Q2 introduced a "payable fees logic" where scholarships are percentages and bursaries are nominal values. The exact interaction is unclear:

- What is the formula? Is it: `Payable Fees = (Annual Fees × (1 - Scholarship%)) - Bursary Amount`? Or a different order of operations? A: See the file @image001.png. If the place offer is without a scholarship then a 0% is entered in the scholarship section.
- Does the bursary calculation need the scholarship percentage as an input? If so, where does that come from — does the school provide it before the bursary assessment, or after?
- Can a child have both a scholarship and a bursary simultaneously? A: yes

This affects the core calculation engine.

---

### Q22. Sibling application linking

The answer to Q9 revealed that Child 1's payable fees appear as a deduction in Child 2's calculation. This raises:

- How does the system identify sibling applications? By matching the lead applicant's email/identity? Or does the assessor explicitly link them? A: The assessor manually links them and it is better that way as a sibling may move on etc..
- Is it always sequential (Child 1 absorbs all disposable income, Child 2 gets full bursary), or can the assessor choose how to allocate? A: yes first child to be offered a bursary then usually by child 2, the net disposable income is used up; when child 1 leaves the school, child 2 becomes the one with payable fees to pay etc..
- If Child 1's payable fees change during re-assessment, does Child 2's calculation automatically update, or is it re-assessed independently? A: This would not happen. Both reassessments happen during the same period. If child 1 has been awarded a new scholarship for instance, he is still the one using most certainly all the disposable income available and if not, this would mean that child 2 has a large bursary but not a full one.
- What if children are at different Foundation schools (one at Trinity, one at Whitgift)? A: Same logic, we assess the family as one family and chronologically the child who has the oldest bursary award takes up the available income first.

---

### Q23. Output to the school

The answer to Q10 clarified that the Foundation produces recommendations and the school's Headmaster decides. The answer to Q8 states "we will never share precise information" regarding property (using the classification table for reporting instead).

- What format does the recommendation take? PDF report? Spreadsheet export? A view in the system? A: A spreadsheet export which is saved in a text box on each bursary account and on each year. That way the assessor looks at previous year assessment and can straight away see the family details.  A typical recommendation will list first whether we are looking at a single parent or married couple, number of kids, both employment roles of each parent. Then, their accommodation status: whether they have a mortgage or rent their accommodation; a couple of more things. Then the recommendation quotes the income category, property category etc.. and ends with a bursary award recommendation and payable fees recommendation.
- Does the school have any access to the system, or is everything sent externally? A: Everything sent externally due to GDPR we have to keep it this way
- What information is included in the recommendation vs. redacted? Specifically, does the school see income figures, or only the property classification category and the recommended bursary amount?

---

### Q24. Entry year / year group capture

The answer to Q6 confirmed that schooling years remaining is derived from the year of entry (Year 6 = 8 years, Year 7 = 7, Year 9 = 5, Year 12 = 2) and entered manually by the assessor.

- Is the entry year currently captured in the application form, or does the assessor know it from the admissions process? A: The assessor knows it from the admissions process, then the year of entry is entered at the end of the assessment which then becomes a field for reporting
- Should the new system collect the entry year explicitly in the application form (since the school is already selected)? A: Yes please
- For re-assessments, should the years remaining decrement automatically each year, or does the assessor re-enter it? A: No they are captured on what the current console calls a progress report which shows as follows: for example for the one below, it will stop in year 4. See @image002.png.

---

### Q25. Assessor data entry interface

The answers to Q1, Q4, and Q20 confirmed that the assessor builds a completely separate financial picture from source documents. The applicant's declared figures are a cross-reference, not the calculation input.

- What exactly does the assessor enter? Is it the income components from the Stage 1 table (net pay, individual benefit amounts, net dividends, net profits, pension amounts)? A: Yes, manually taken from the documents, ignoring the numbers entered by the applicant
- Is it a single total per earner, or broken down by income type? A: The total is per household, parent 1 and parent 2 but at the bottom, all calculated as one total.
- Are there fields for the assessor to record notes or flag discrepancies per line item? A: No, it is irrelevant to try to correct the application for the applicant as tax documents and bank statements are used as official evidence of what is earned
- Is the assessor's data entry the "checklist" referenced in the admin screenshots, or is it a separate step? A: This is getway to the assessor’s form to fill in, but for the rolling-over bursaries, the assessor does not need to go through that link. I am not sure why it is called ‘checklist’ for the new bursaries, that’s a good question. A: The assessor’s data entry is a critical part of the process. Many applicants don’t understand net and gross, and sometimes they enter monthly totals when the form asks for yearly totals. Sometimes they can’t convert weekly payments into monthly or yearly.

---

### Q26. Historical payable fees benchmark

The answer to Q2 described a rule where original payable fees act as a floor: "we cannot increase the payable fees due to [previously overlooked information]; we will only be able to increase the payable fees if we can demonstrate that there has been a positive change to the financials."

- Is the benchmark the payable fees from the very first year's assessment? A: Yes, correct. Then, on the next assessment, if the overall earned income, then the payable fees might go up slightly, unless the notional rents/costs of living eat up that income increase.
- How is this tracked — is there a specific "original benchmark" field, or does the assessor compare against the full history? A: There isn’t but I would love to have something like that, as this is the key basis of ensuring consistency and accuracy of the following assessments. In fact, I think I would use some time in the near future to think this console through a bit more to see what could potentially be added or improved to make the job of the assessor easier. It has not to do with the actual assessment logic or asking an IA robot to pick amounts into forms when the error rate is too high due to the fact that the applicant is a human being who will upload what they want to upload. However, there should be new requests to make the assessing job easier such as keeping a benchmark and a history of the payable fees over time for instance in one place. I could conceptualise this for phase 2.
- Can payable fees decrease below the original benchmark if the family's situation worsens? (Presumably yes, since bursaries can increase.) A: yes. Unless they start with a full bursary and in that case, there payable fees stay at £0.00 as we don’t offer 110% bursaries like some other schools do.
- Does the system need to enforce this rule automatically, or is it the assessor's judgment? A: Well we have kept some flexibility with the system as we would not want this part hardwritten when sometimes some adjustments need to be made. So on the overall calculation of the payable fees, there would be a need to enter adjustments.

---

### Q27. Internal bursary requests

The answers to Q2, Q6, and Q17 all reference "internal bursary requests" as a separate pathway for pastoral/emergency cases.

- Do these use the same application form and assessment model? A: Yes same process, same forms, as far as applying and assessing are concerned.
- Or are they a lighter-weight process (e.g. assessor creates an assessment directly without an applicant submission)? A: No, we still need the parent to send an application. It is just that they are not asked to fill in an application following their son doing well at an entrance exam, but following the parent calling in saying that they have had a really big change in circumstances.
- Are they within scope for the replacement system, or handled entirely outside it? A: They are handled with the others. Sometimes they become rolling-over bursaries on future years
- Can internal bursary requests happen at any entry year (not just Year 6/7/9/12)? A: Any time fate strikes

---

### Q28. Income threshold benchmarks (£27K and £90K)

The answer to Q2 mentioned £27,000 as a minimum income threshold and £90,000 as a maximum benchmark.

- Are these hard system thresholds (the system auto-flags or auto-qualifies/disqualifies)? A: No, reason for that is that some parents may be on a £170K a year salary and still apply even if they can read about the benchmarks; as their son for instance has done very well at the entrance exam and as they may ‘feel’ like they would financially struggle. These types of parents are convinced they should really qualify. They get assessed and the outcome of the assessment shows that they do not qualify.
- Or are they soft guidelines applied with assessor judgment? A:  Sometimes, we may have one parent from an internal bursary technically on £150K a year but terminally ill. So again, we need a system which allows the assessor to enter any details, as the assessment will decide anyway if a bursary can be given or not.  Our admissions teams may think that telling parents that there is a threshold would deter everyone but I usually have circa 25 parents every year who thinks that they need a bursary when they are well over the qualifying criteria
- Do they change annually? If so, are they part of the configurable reference tables? A: They change depending on how the level of fees changes. For instance, they had not changed much since 2020 but since VAT was introduced, this has caused us to push the qualifying thresholds up, as we have a payable fees logic.
- Is £27K the income level at which a family qualifies for a full (100%) bursary? A: Yes
- Is £90K the income level above which a family is assumed to not need a bursary? A: Yes

---

### Q29. Benefit inclusion/exclusion rules

The answer to Q5 noted that some benefits are not counted as income (e.g. child's disability allowance) while others are (e.g. parent's DLA).

- Is there a definitive list of which benefits count as assessable income and which are excluded? A: This has to do with the training of the assessor. If the benefit such as DLA, EESA, PIP, carer’s allowance is for the unemployed parent, then it constitutes the income generated by that parent. Now, if the parent has a severely disabled child, and they receive a DLA, PIP or any other benefits, then this is a payment made by the council to that family for the specific needs of their child (getting equipment, maintaining the equipment , getting medical support) so these funds are paid to the parents but spent by the parents to look after the child so they don’t qualify as income
- Does the system need to enforce these rules (e.g. separate input fields for included vs. excluded benefits), or is it entirely the assessor's judgment when entering figures? A: It does not at the moment, however, if there was a section for benefits which are counted as income and the ones which aren’t, again this would be an improved feature.

---

### Q30. Re-assessment data pre-population

The answer to Q12 stated that only the lead applicant's address details are pre-populated for re-assessments.

- Would it be desirable to pre-populate more fields (child details, family member names, identification documents already on file)? A: Well child details, potentially yes, I saw about 5 or 6 changes in child’s name in the last 6 years so it happens but it is an exception. Yes, if the names of the family members could be saved up so that they belong to that family and then we have that on record, this would help.
- For identification documents that carry forward — are they visibly linked to the new application so the assessor can confirm they're still valid, or are they simply "known to exist" from a previous year? A: We only check ID documents in year 1. Some bursaries are rejected due to not passing the ID checks. Once a family has passed the ID checks, we never ask the family to attach the documents again. This is why on the rolling-over form , the ID documents section of the form is hidden/disabled.
- Does the child's school selection carry forward (since they're already attending)? A: Once they are at a school, I amend the bursary ‘ account’ reference and it starts with WS – for a Whitgift School bursary recipient for instance or by TS- for a Trinity School bursary recipient.

There are two aspects of the comments made at the end of the assessment:
1- the category logic, synopsis view of the family, bursary recommendation, any red flags (*such as dishonesty re flag; credit risk red flag etc..), and recommended payable fees.
2- but also as extra fields to report to the schools on the summarised reasons for the change in payable fees year on year such as those ones below. Again, I would use what is happening as an opportunity to review these fields. See @image003.png.
Reason 27 was used a lot six years ago, not anymore.  This is just an illustration.
