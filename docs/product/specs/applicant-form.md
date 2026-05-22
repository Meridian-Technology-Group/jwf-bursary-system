# Bursary Application Portal - Complete Input Mapping

## Overview

The John Whitgift Foundation Bursary Portal is a multi-page application form for bursary assessment (e.g. 2026/27 academic year). A left sidebar shows progress (percentage complete) and navigation across all sections. Each page has **Previous**, **Next**, and **Save And Close** buttons.

---

## Navigation Structure (Sidebar Sections)

1. How to Apply
2. Checklist
3. **Details of child**
4. **Parent/guardian details**
   - Dependent children
   - Dependent elderly
5. **Other information required**
6. **Parents' income**
7. **Parents' assets & liabilities**
8. **Additional information**
9. **Declaration**
10. Validation summary
11. Terms and Conditions (link)

---

## Section 1: Details of Child

### 1.1 School Selection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| School you are applying for | Autocomplete text input | Yes | Must select "Trinity School" or "Whitgift School" from options that appear as you type |
| Are you applying to another school? | Radio: Yes / No | Yes | |

### 1.2 Child Information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Child's full name | Text input | Yes | |
| Gender | Dropdown | Yes | |
| Date of birth | Date picker (DD/MM/YYYY) | Yes | |
| Place of birth | Dropdown (countries) | Yes | |

### 1.3 Birth Certificate

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Child's full birth certificate | File upload | Yes | "Must include names of parents and place of birth." Actions: Attach / Document Attached / View / Use / Delete |

### 1.4 Child's Current Address

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Is the child's current address the same as Parent/Guardian 1? | Radio: Yes / No | Yes | |

**If "No" (or address differs):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Address Line 1 | Text input | Yes | Note: "The address details can be edited in the 'Manage My Details' section of the Portal" |
| Address Line 2 | Text input | No | |
| City/Town | Text input | Yes | |
| Postcode | Text input | Yes | |
| Country | Dropdown | Yes | |

### 1.5 Current School

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| School currently attended by child | Dropdown | Yes | |
| Start Date of school currently attended | Date picker (DD/MM/YYYY) | Yes | |

### 1.6 Identification for All Family Members

Instruction: *"Note: this includes all dependent children and any dependent elderly."*

Repeatable sub-form via **"Add..."** button (opens modal dialog):

#### Family Member Modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Family Member | Text input | Yes | Name of the family member |
| Is this family member a British citizen? | Radio: Yes / No | Yes | Drives conditional uploads below |

**If British citizen = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload UK Passport | File upload | Yes | |

**If British citizen = No:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload Passport | File upload | Yes | |
| Upload Evidence of Indefinite Leave to Remain in the UK | File upload | Yes | |

Modal has **Save** and **Cancel** buttons.

---

## Section 2: Parent/Guardian Details

### 2.1 Sole Parent Question

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Are you applying as a sole parent / guardian? | Radio: Yes / No | Yes | "If yes, only sections relevant to you will be displayed on this list." "If no, both sections should appear on this list for you and your partner to fill in." |

### 2.2 Relationship Status

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Please indicate your relationship status as applicants | Radio group | Yes | Options: Single / Married / Widowed / Separated / Divorced / In a Civil Partnership / Cohabiting |

### 2.3 Parent / Guardian 1 - Contact Details

Note: *"Your contact details are in the 'Manage My Details' section of the Portal."*

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Dropdown | Yes | |
| First Name(s) | Text input | Yes | |
| Last Name | Text input | Yes | |
| Telephone No | Text input | No | |
| Telephone No 2 | Text input | No | |
| Mobile No | Text input | No | |
| Email address | Text (read-only) | N/A | Pre-populated from portal account |
| Address Line 1 | Text input | Yes | |
| Address Line 2 | Text input | No | |
| City/Town | Text input | Yes | |
| Postcode | Text input | Yes | |
| Country | Dropdown | Yes | |

### 2.4 Parent / Guardian 1 - Employment Details

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Employment status | Radio group | Yes | Options: Employed / Unemployed / Self-employed / Self-employed (CIS registered) / Self-employed and employed / Retired |

#### Conditional fields based on employment status:

**If Employed, Self-employed, Self-employed (CIS), or Self-employed and employed:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Your profession, business or trade | Text input / Dropdown | Yes | |
| Name and address of employer or address of business | Text area | Yes | |
| Book/Account year end date | Date field | Yes | Reference date for accounts |
| Are you a director of this company? | Radio: Yes / No | Yes | |

**If director = Yes (sub-conditional):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Please state proportion or exact value of shares or stake in % | Text / Number input | Yes | |
| Copy of latest certified/audited accounts | File upload | Yes | |
| Copy of latest Balance Sheet | File upload | Yes | |

**Continuing for employed/self-employed statuses:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Have you left self-employment since April [year]? | Radio: Yes / No | Yes | Year is dynamic based on assessment period |

**If left self-employment = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload evidence of previous self-employment | File upload | Yes | |

**Continuing:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Gross Pay | Currency (£) input | Yes | |
| Do you receive a scholarship / maintenance? | Radio: Yes / No | Yes | |

**If receives scholarship/maintenance = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload evidence of your scholarship / maintenance | File upload | Yes | |

**If Unemployed:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Please provide details | Text area | Yes | Details of circumstances |

### 2.5 Declaration of Parent / Guardian 1

Declaration text reads (paraphrased): *"I declare to the best of my knowledge and belief, all the particulars here submitted are true and contain a full statement of our income from all sources during the period stated. I understand that the provision of false information will lead to my application being disqualified from assessment under the bursary scheme and full fees would become payable thereafter."*

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Acceptance checkbox/radio | Checkbox or Radio | Yes | Must confirm declaration |

### 2.6 Parent / Guardian 2 - Contact Details

**Conditional: Only shown when "sole parent" = No.**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Dropdown | Yes | |
| First Name | Text input | Yes | |
| Last Name | Text input | Yes | |
| Email address | Text input | Yes | |
| Telephone No | Text input | No | |
| Mobile No | Text input | No | |
| Surname (birth/maiden) | Text input | No | |
| Registered on (portal) | Display text | N/A | Indicates whether this parent has registered on the portal |

### 2.7 Parent / Guardian 2 - Employment Details

**Conditional: Only shown when "sole parent" = No.**

Same structure as Parent/Guardian 1 employment details (Section 2.4), with identical fields and conditional logic.

### 2.8 Declaration of Parent / Guardian 2

**Conditional: Only shown when "sole parent" = No.**

Same declaration text and acceptance field as Parent/Guardian 1 (Section 2.5).

---

## Section 3: Dependent Children

### 3.1 Number of Dependent Children

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| How many children do you have still living at your address, or who are still financially dependent on you (e.g. studying at University)? | Number input | Yes | |

### 3.2 Dependent Children at John Whitgift Foundation Schools

Instruction: *"Please provide information on the child named in this application as well as any other dependent children."*

Displayed as a table with columns:

| Column | Type | Notes |
|--------|------|-------|
| Name | Text (may be pre-populated) | Name of child; the named applicant child is pre-filled |
| Dependent status (date) | Date / Text | |
| Surname of other parent | Text | If applicable |
| Amount of bursary | Currency (£) | Current bursary amount, if any |
| School | Text / Dropdown | Which school they attend |

Rows can be added via **"Add..."** button.

### 3.3 Dependent Children at Other Schools

Additional section for children at non-Foundation schools (details can be added).

### 3.4 Add Child Modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Is this child | Dropdown | Yes | Options include: "(Select)" / "The named child of this application" / other dependent children |
| Children's unearned income | Currency (£) input | Yes | "Where a value is not applicable for you, please enter 0." Label: "Actual to [date]" (e.g. 06/04/2021, dynamic based on tax year) |

**If "The named child of this application" is selected:**
- Displays read-only: **"Child (named on this application): [Child Name]"**

Modal has **Save** and **Cancel** buttons.

---

## Section 4: Dependent Elderly

### 4.1 Elderly Dependants at Home

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any elderly dependant that you are providing for at home? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| How many? | Number input | Yes | |
| Please provide information about the elderly dependants | Repeatable sub-form via **"Add..."** button | Yes | Opens modal |

#### Add Elderly Dependant (At Home) Modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | Text input | Yes | |
| Middle Name(s) | Text input | No | |
| Surname | Text input | Yes | |
| Date of birth | Date picker | No | "Please note that dates 100+ years ago cannot be inputted. If this is the case, please use the checkbox below." |
| The elderly dependant is 100+ years old | Checkbox | No | Use when DOB cannot be entered due to system limitation |

### 4.2 Elderly Dependants in a Care Home

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any elderly dependant that you are providing for in a care home? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| How many? | Number input | Yes | |
| Please provide information about the elderly dependants | Repeatable sub-form via **"Add..."** button | Yes | Opens modal |

#### Add Elderly Dependant (Care Home) Modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | Text input | Yes | |
| Middle Name(s) | Text input | No | |
| Surname | Text input | Yes | |
| Date of birth | Date picker | No | Same 100+ year note as above |
| The elderly dependant is 100+ years old | Checkbox | No | |
| Care Home Name | Text input | Yes | |
| Care Home Fees | Currency (£) input | Yes | |
| Latest invoice from the care home regarding monthly charges for your dependent elderly | File upload | Yes | |

Modal has **Save** and **Cancel** buttons.

---

## Section 5: Other Information Required

### 5.1 Court Orders

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have a court order for the payment of school fees? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Amount to be paid (Term) | Currency (£) input | Yes | Amount per term |
| Amount to be paid (Year) | Currency (£) input | Yes | Amount per year |
| Please upload evidence of the Court Order | File upload | Yes | |

### 5.2 School Maintenance Payments

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload school/maintenance payment evidence | File upload | Conditional | "Not Maintained / Financial Statement" option visible |

### 5.3 Insurance Policies

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have the benefit of any insurance policies specifically to pay school? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Amount to be paid in respect of this school year starting | Currency (£) input | Yes | |
| Date range fields | Date pickers | Yes | Start/end dates for the policy period |

### 5.4 Outstanding School Fees

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Are any outstanding school fees at any other school? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name(s) of school | Text input | Yes | |
| Amount owed | Currency (£) input | Yes | |

---

## Section 6: Parents' Income

Page header: *"Please complete the table below showing GROSS INCOME before deduction of tax from all sources of income for the financial year ended 5 April [year]."*

*"Where a source is not applicable to you, please enter 0."*

**This entire section is repeated for each Parent/Guardian (1 and 2, if applicable).**

### 6.1 Income Table (per parent)

Header: **"Parent / Guardian [N] - Income"**

Column: **"To April [year] (Actual)"**

| Income Source | Type | Required | Notes |
|--------------|------|----------|-------|
| Salary / wages, state or private pension(s) | Currency (£) | Yes | Enter 0 if N/A |
| Any supplement(s) and/or bonus | Currency (£) | Yes | Enter 0 if N/A |
| Any other benefits and commission(s) | Currency (£) | Yes | Enter 0 if N/A |
| Amount supplied by partner | Currency (£) | Yes | Enter 0 if N/A |
| Working tax credits | Currency (£) | Yes | Enter 0 if N/A |
| Gross interest received (on deposits) | Currency (£) | Yes | Enter 0 if N/A |
| All dividend income (UK or overseas) | Currency (£) | Yes | Enter 0 if N/A |
| Gross rent(s) received | Currency (£) | Yes | Enter 0 if N/A |
| All income (bonds) | Currency (£) | Yes | Enter 0 if N/A |
| Other gross income(s) | Currency (£) | Yes | Enter 0 if N/A |
| Maintenance or equivalent(s) | Currency (£) | Yes | Enter 0 if N/A |
| Bursaries / sponsorships | Currency (£) | Yes | Enter 0 if N/A |
| Other income not included above | Currency (£) | Yes | Enter 0 if N/A |
| Other income | Currency (£) | Yes | Enter 0 if N/A |

### 6.2 Supporting Documents (per parent)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any regular capital repayments? | Radio: Yes / No | Yes | |
| Upload details of repayments | File upload | Conditional | If Yes to above |
| Last P60 to April [year] | File upload | Yes | P60 / P45 or equivalent |
| HMRC Self Assessment tax return | File upload | Conditional | If self-employed or filed self-assessment |
| Upload benefits evidence | File upload | Conditional | If receiving state benefits |

### 6.3 Confirmation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| I confirm that all documents uploaded on this page are current and legible | Checkbox | Yes | |

---

## Section 7: Parents' Assets & Liabilities

### 7.1 Capital Assets - What You Own

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you own or rent your house? | Dropdown | Yes | Options: Own / Rent (and possibly other options) |
| Approximate value of residence/property | Currency (£) | Yes | |
| Value of your car(s) | Currency (£) | Yes | |
| Value of other possessions including home contents | Currency (£) | Yes | |
| Total of all stocks or shares/equities | Currency (£) | Yes | |
| Approximate value of investments (Bonds, PEPs, ISAs etc) | Currency (£) | Yes | |
| Approximate value of any other assets not included above | Currency (£) | Yes | |

### 7.2 Other Properties

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any other properties? | Radio: Yes / No | Yes | |

**If Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Total value of any other properties owned (in the UK or abroad) | Currency (£) | Yes | |
| Is any other property rental insurance? | Radio: Yes / No | Conditional | |
| Total value of any other properties rented (in the UK or abroad) | Currency (£) | Conditional | |

### 7.3 Outstanding Community / Mortgage Balance

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Other Outstanding Mortgage Balance | Currency (£) | Yes | |

### 7.4 Property Evidence Upload

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload Council Tax bill OR EVIDENCE for the property in which you reside | File upload | Yes | |

### 7.5 Bank Statements

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Last 3 months bank statements/investment accounts for ALL accounts and evidence of shareholdings (Parent/Guardian 1) | File upload (multiple) | Yes | "Please upload one attachment at a time." Multiple upload slots available |
| Last 3 months bank/building/investment/pension accounts for all accounts and holdings (Parent/Guardian 2) | File upload (multiple) | Conditional | Only if two parents; multiple upload slots available |

### 7.6 Other Owned Properties List

Instruction: *"List the addresses below of all other owned properties and value of each."*

Table with columns:

| Column | Type | Required |
|--------|------|----------|
| Address | Text | Yes |
| Postcode | Text | Yes |
| Value | Currency (£) | Yes |

Rows added via **"Add..."** button.

#### Add Property Modal

| Field | Type | Required |
|-------|------|----------|
| Address | Text input | Yes |
| Postcode | Text input | Yes |
| Value | Currency (£) input | Yes |

Modal has **Save** and **Cancel** buttons.

### 7.7 Capital Liabilities - What You Owe

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Outstanding mortgage (main property/family home) | Currency (£) | Yes | |
| Total of all other outstanding mortgages as referred to in section above | Currency (£) | Yes | |
| Total of any current overdraft | Currency (£) | Yes | |
| Do you have any hire/hire purchase agreements? | Radio: Yes / No | Yes | |

**If hire purchase = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Total of all hire/hire balances outstanding | Currency (£) | Yes | |

### 7.8 Liabilities Evidence Upload

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Upload Liabilities Agreements | File upload | Yes | |
| Upload most recent statement/monthly statement or similar | File upload | Yes | |

### 7.9 Changes to Liabilities

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any changes that could affect the amount you owe? | Radio: Yes / No | Yes | |

### 7.10 Other Owned Properties - Liabilities

Instruction: *"List the addresses below of all other owned properties and value and charges of each."*

Same table structure as 7.6 but for recording liabilities/charges against other properties.

### 7.11 Confirmation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| I confirm that all documents uploaded on this page are current and legible | Checkbox | Yes | |

---

## Section 8: Additional Information

### 8.1 Circumstances Checklist

Instruction: *"Please use the form to tell us if in a current / previous application:"*

Each circumstance has a Yes/No indicator and a file upload field:

| Circumstance | Type | Required | Notes |
|-------------|------|----------|-------|
| Divorced (if applicable) | Yes/No + File upload | Conditional | Upload supporting documents |
| Separated (if applicable) | Yes/No + File upload | Conditional | Upload supporting documents |
| Sick / unable to work | Yes/No + File upload | Conditional | Upload supporting documents |
| Rent (current statement or lease) | Yes/No + File upload | Conditional | Upload supporting documents |
| Been made redundant or lost employment | Yes/No + File upload | Conditional | Upload supporting documents |
| Receiving benefits | Yes/No + File upload | Conditional | Upload supporting documents |

### 8.2 Additional Narrative

Instruction: *"Please help us identify any difficulties which you think we may consider to be factors in assessing need for this award. The bursary committee is unable to consider any information that is not included in your application."*

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Free-text explanation | Text area (large, multi-line) | No | Character/word limit indicator visible (shows remaining count) |

### 8.3 Additional Document Upload

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Additional supporting documents | File upload via **"Add"** button | No | For any extra evidence not covered by other sections |

---

## Section 9: Declaration

### 9.1 Declaration Text

A comprehensive legal declaration stating (summarised):

1. "I/We the undersigned do solemnly and sincerely declare that to the best of our knowledge the information provided is accurate and complete."
2. Income and assets are truthfully declared from all sources.
3. The Foundation and Whitgift School may verify information provided.
4. False information will result in disqualification from the bursary scheme.
5. Bursary awards are subject to annual re-assessment; parents/guardians must re-apply.
6. Parents/guardians accept that the Foundation's decision is final.
7. Acceptance of the Bursary Contract terms - agreement to the assessment and any resulting conditions.
8. Financial information submitted will be used solely for the bursary application process.
9. Reference to a separate Bursary Contract which governs the award terms.
10. Acknowledgement regarding data protection and privacy.

### 9.2 Declaration Acceptance

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| "By clicking this box, we are of the view this declaration you agreed to the terms and conditions above." | Checkbox | Yes | Must be checked to submit |
| On behalf of the Applicant | Text / Signature | Yes | Name of person accepting |

---

## Section 10: Validation Summary

Not captured in screenshots. This is an auto-generated page that lists all incomplete or invalid fields across the entire application, allowing the applicant to identify and fix issues before final submission.

---

## Appendix: Field Type Legend

| Type | Description |
|------|-------------|
| Text input | Single-line text field |
| Text area | Multi-line text field |
| Dropdown | Select from predefined options |
| Autocomplete text input | Type-ahead search with suggestions |
| Radio: Yes / No | Binary radio button choice |
| Radio group | Multiple radio button options (select one) |
| Checkbox | Single tickbox for confirmation/boolean |
| Date picker | Date input field (DD/MM/YYYY format) |
| Currency (£) input | Numeric input with pound sterling prefix |
| Number input | Numeric-only input |
| File upload | File attachment control with Attach/View/Delete actions |
| Display text | Read-only information, not an input |

## Appendix: Conditional Logic Summary

| Trigger | Condition | Effect |
|---------|-----------|--------|
| Sole parent/guardian | = Yes | Hide Parent/Guardian 2 sections entirely |
| Sole parent/guardian | = No | Show Parent/Guardian 2 contact, employment, and declaration sections |
| Child address same as Parent 1 | = No | Show child's separate address fields |
| Family member is British citizen | = Yes | Show "Upload UK Passport" only |
| Family member is British citizen | = No | Show "Upload Passport" + "Upload Evidence of Indefinite Leave to Remain" |
| Employment status | = Employed / Self-employed / etc. | Show profession, employer, director question, and related fields |
| Employment status | = Unemployed | Show explanation text area |
| Are you a director? | = Yes | Show share %, upload audited accounts, upload balance sheet |
| Left self-employment since April? | = Yes | Show upload for evidence of previous self-employment |
| Receive scholarship/maintenance? | = Yes | Show upload for scholarship/maintenance evidence |
| Court order for school fees? | = Yes | Show amount fields + upload evidence |
| Insurance policies to pay school? | = Yes | Show amount + date range fields |
| Outstanding fees at other school? | = Yes | Show school name + amount owed |
| Elderly dependant at home? | = Yes | Show "How many?" + Add dependant form |
| Elderly dependant in care home? | = Yes | Show "How many?" + Add dependant form (with care home fields) |
| Other properties? | = Yes | Show total value + property list table |
| Hire/hire purchase agreements? | = Yes | Show total balances outstanding |
| Add Child > "Is this child" | = "The named child of this application" | Display child name read-only |
| Elderly dependant 100+ years old | = Checked | Bypass date of birth input limitation |
