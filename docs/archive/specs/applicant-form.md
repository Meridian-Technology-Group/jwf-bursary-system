# Bursary Application Portal - Complete Input Mapping

> **✅ Reconciled against the implementation on 2026-05-24.**
> This field map has been walked field-by-field against the shipped portal
> (`src/components/portal/sections/*`, `src/lib/schemas/*`, `src/types/application.ts`,
> and `prisma/schema.prisma`). It now describes the form **as built**, with the
> pre-build design having been corrected throughout. Code remains the source of
> truth; where this doc and the code disagree, fix the doc.
>
> Items the **types/schemas define but the UI does not yet collect** are marked
> inline as **⚠️ NOT YET BUILT (stub)** so QA and screenshot capture are not
> misled. Those stubs are genuine implementation gaps, not doc drift — see the
> "Implementation gaps" note at the foot of this document.
>
> For the user-facing source of truth, see the
> [Applicant User Guide](../../guides/applicant-guide.md) and the
> [applicant walkthroughs](../../guides/walkthroughs/applicants/).
> Reconciliation tracked in
> [`docs/backlog/applicant-form-spec-stale-vs-implementation.md`](../../backlog/applicant-form-spec-stale-vs-implementation.md).

## Overview

The John Whitgift Foundation Bursary Portal is a multi-step application form
for bursary assessment. The form is a **sequential wizard**: each section is its
own page (`/apply/[section]`), and the applicant moves through them in a fixed
order with **Previous** / **Next** / **Save** controls. A left sidebar shows
progress and section completion. A final **Review** page
(`/apply/review`) lists section completion before submission — this is the
review/summary screen, *not* a data-entry section.

### Section model (source of truth: `ApplicationSectionType` enum)

There are **10 data sections**, each persisted as one `ApplicationSection` row
with a JSONB `data` payload typed in `src/types/application.ts`. The wizard
order (`SECTION_ORDER` in `src/app/(portal)/apply/[section]/page.tsx`) is:

| # | Enum value | Slug | Title in UI |
|---|------------|------|-------------|
| 1 | `CHILD_DETAILS` | `child-details` | Details of Child |
| 2 | `FAMILY_ID` | `family-id` | Family Identification |
| 3 | `PARENT_DETAILS` | `parent-details` | Parent / Guardian Details |
| 4 | `DEPENDENT_CHILDREN` | `dependent-children` | Dependent Children |
| 5 | `DEPENDENT_ELDERLY` | `dependent-elderly` | Dependent Elderly |
| 6 | `OTHER_INFO` | `other-info` | Other Information Required |
| 7 | `PARENTS_INCOME` | `parents-income` | Parents' Income |
| 8 | `ASSETS_LIABILITIES` | `assets-liabilities` | Parents' Assets & Liabilities |
| 9 | `ADDITIONAL_INFO` | `additional-info` | Additional Information |
| 10 | `DECLARATION` | `declaration` | Declaration |

> **Re-assessments:** `FAMILY_ID` is hidden entirely for re-assessment
> applications (`REASSESSMENT_SECTION_ORDER`), so the wizard runs across 9
> sections. ID is only checked in year 1.

> **Correction vs. the pre-build design:** the original design folded Family
> Identification into "Details of Child" and listed a "Validation Summary"
> section plus standalone "How to Apply"/"Checklist"/"Terms and Conditions"
> pages. In the shipped form, Family Identification is its own section (#2), and
> there is no Validation-Summary *data* section — completion is shown on the
> Review page.

---

## Section 1: Details of Child (`CHILD_DETAILS`)

Implemented in `src/components/portal/sections/child-details-form.tsx`;
validated by `src/lib/schemas/child-details.ts`; typed by `ChildDetailsData`.

### 1.1 School selection

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| School you are applying for | **Dropdown** (`Select`) | Yes | Two options: **Trinity School** (`TRINITY`) / **Whitgift School** (`WHITGIFT`). Stored as `school`. |
| School year your child is applying to enter | **Dropdown** (`Select`) | Yes | Options: Year 6 (`Y6`) / Year 7 (`Y7`) / Year 9 (`Y9`) / Year 12 (`Y12`) / Other (`OTHER`). Stored as `entryYearGroup`. |

> **Correction:** school is a **dropdown**, not an autocomplete/type-ahead. The
> pre-build "Are you applying to another school? (Yes/No)" field **does not
> exist**. A **new** required field — *School year your child is applying to
> enter* (`entryYearGroup`) — has been **added** since the design (per §4 of the
> spec; the assessor reconciles `OTHER` by hand).

### 1.2 Child information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Child's full name | Text input | Yes | `childFullName` |
| Gender | Dropdown | Yes | Options: Male / Female / Prefer not to say / Other. `gender` |
| Date of birth | Date input | Yes | `dateOfBirth` (ISO `YYYY-MM-DD`) |
| Place of birth | **Country combobox** | Yes | Searchable country picker. `placeOfBirth` |

### 1.3 Birth certificate

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Birth Certificate | File upload (functional) | Yes | Slot `BIRTH_CERTIFICATE`. Hint: "must show child's name, date of birth, place of birth, and parents' names." Stored as `birthCertificateDocumentId`. |

### 1.4 Child's current address

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Does the child live at the same address as Parent/Guardian 1? | Yes/No toggle | Yes | `sameAddressAsParent1` |

**If "No" (`sameAddressAsParent1 === false`)** the child's address fields appear
(`childAddress.*`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Address line 1 | Text input | Yes | |
| Address line 2 | Text input | No | |
| City / Town | Text input | Yes | |
| Postcode | Text input | Yes | Rendered uppercase |
| Country | Country combobox | Yes | |

### 1.5 Current school

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| School currently attended | Text input | Yes | `currentSchool` (free text, **not** a dropdown) |
| Start date at current school | Date input | Yes | `currentSchoolStartDate` |

---

## Section 2: Family Identification (`FAMILY_ID`)

Implemented in `family-id-form.tsx`; typed by `FamilyIdData` /
`FamilyMemberIdentity`. Hidden for re-assessments.

Instruction banner: *"This includes all dependent children and any dependent
elderly family members."*

A repeatable list of family members. **"Add family member"** opens a modal that
collects **only the member's name**; the citizenship question and uploads live
on the member's card after it is added.

#### Add family member modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Family member name | Text input | Yes | Modal has **Save** / **Cancel** |

> **Correction:** in the pre-build design the modal also asked the
> British-citizen question and held the uploads. In the shipped form the modal
> captures the **name only**; the citizenship toggle and conditional uploads are
> rendered on the per-member **card** in the list.

#### Per-member card

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Is this family member a British citizen? | Yes/No toggle | — | `isBritishCitizen` (defaults to **Yes** when the member is added) |

**If British citizen = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| UK Passport | File upload (functional) | — | Slot `FAMILY_ID_PASSPORT_{index}`; `ukPassportDocumentId` |

**If British citizen = No:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Passport | File upload (functional) | — | Slot `FAMILY_ID_PASSPORT_{index}`; `passportDocumentId` |
| Evidence of Indefinite Leave to Remain in the UK | File upload (functional) | — | Slot `FAMILY_ID_ILR_{index}`; `ilrDocumentId` |

---

## Section 3: Parent / Guardian Details (`PARENT_DETAILS`)

Implemented in `parent-details-form.tsx`; validated by
`src/lib/schemas/parent-details.ts`; typed by `ParentDetailsData`.

### 3.1 Sole parent

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Are you applying as a sole parent / guardian? | Yes/No toggle | Yes | `isSoleParent`. When Yes, the Parent/Guardian 2 blocks are hidden across this section, Parents' Income, and Assets & Liabilities. |

### 3.2 Relationship status

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Relationship status | Radio group | Yes | Options: Single / Married / Widowed / Separated / Divorced / In a Civil Partnership / Cohabiting. `relationshipStatus` |

### 3.3 Parent / Guardian 1 — Contact details (`parent1Contact`)

Helper text: *"Your contact details are in the 'Manage My Details' section of the
Portal."*

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | Dropdown | Yes | Mr / Mrs / Ms / Miss / Dr / Prof / Other |
| First name(s) | Text input | Yes | |
| Last name | Text input | Yes | |
| Telephone no. | Text input (`tel`) | No | |
| Mobile no. | Text input (`tel`) | No | |
| Address line 1 | Text input | Yes | |
| Address line 2 | Text input | No | |
| City / Town | Text input | Yes | |
| Postcode | Text input | Yes | Validated against a UK postcode pattern when country is UK/blank |
| Country | Country combobox | Yes | |

> **Correction:** Parent/Guardian **1** has **no email field rendered** (email
> comes from the portal account). The pre-build "Telephone No 2" field is
> **not** rendered for either parent (the `telephone2` key exists in the schema
> but has no input). The schema marks `telephone`, `telephone2`, `mobile`, and
> `email` as optional.

### 3.4 Parent / Guardian 1 — Employment details (`parent1Employment`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Employment status | Radio group | Yes | **7 options** (see below). `status` |

**Employment status options** (values mirror the assessor-side
`EmploymentStatus` enum so the applicant's choice flows into Stage 1 income — see
B11):

| Value | Applicant-facing label |
|-------|------------------------|
| `PAYE` | Employed (PAYE) |
| `BENEFITS` | Receiving benefits only (not working) |
| `SELF_EMPLOYED_DIRECTOR` | Self-employed — company director |
| `SELF_EMPLOYED_SOLE` | Self-employed — sole trader |
| `OLD_AGE_PENSION` | Receiving state / old-age pension |
| `PAST_PENSION` | Receiving private or occupational pension |
| `UNEMPLOYED` | Unemployed |

> **Correction:** the pre-build option set (Employed / Self-employed / CIS /
> Self-employed and employed / Retired) is **superseded** by the 7-option set
> above.

**Conditional — "working" statuses (`PAYE`, `SELF_EMPLOYED_DIRECTOR`,
`SELF_EMPLOYED_SOLE`):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Profession, business or trade | Text input | Yes (when working) | `profession` |
| Name and address of employer or business | Textarea | Yes (when working) | `employerAddress` |
| Book / Account year end date | Date input | No | `bookYearEndDate` |
| Are you a director of this company? | Yes/No toggle | No | `isDirector` |

**If director = Yes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Proportion or exact value of shares / stake (%) | Text input | Yes (when director) | `sharePercentage` |
| Copy of latest certified/audited accounts | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box: "Document upload available once application is created." `certifiedAccountsDocumentId` exists in the type but no upload control is wired. |
| Copy of latest balance sheet | **⚠️ NOT YET BUILT (stub)** | — | As above. `balanceSheetDocumentId`. |

**Continuing (working statuses):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Have you left self-employment since April? | Yes/No toggle | No | `leftSelfEmployment` |
| Evidence of previous self-employment | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box. The **schema** requires `leftSelfEmploymentDocumentId` when `leftSelfEmployment` is true, but no upload control is rendered — see "Implementation gaps". |
| Gross pay | Currency (£) | Yes (when working) | `grossPay` |
| Do you receive a scholarship / maintenance? | Yes/No toggle | No | `receivesScholarship` |
| Evidence of scholarship / maintenance | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box. Schema requires `scholarshipDocumentId` when `receivesScholarship` is true, but no upload control is rendered. |

**Conditional — `UNEMPLOYED`:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Please provide details | Textarea | Yes (when unemployed) | `unemployedDetails` |

> Note: `BENEFITS`, `OLD_AGE_PENSION`, and `PAST_PENSION` reveal **neither** the
> working-fields block nor the unemployed details box.

### 3.5 Declaration of Parent / Guardian 1

Inline declaration text ("I declare to the best of my knowledge and belief …
full fees would become payable thereafter.") followed by:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| I accept the above declaration | Checkbox | — (not enforced in schema) | `declarationAccepted` |

### 3.6–3.8 Parent / Guardian 2 (`parent2Contact`, `parent2Employment`)

Shown **only when `isSoleParent === false`**. Same contact, employment, and
declaration structure as Parent/Guardian 1, **plus** one extra field:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Email address | Text input (`email`) | Yes (when shown) | `parent2Contact.email` — rendered for Parent 2 only |

> **Correction:** the pre-build "Surname (birth/maiden)" and "Registered on
> (portal)" fields for Parent 2 are **not** in the shipped form. Parent 2's
> contact/employment are validated by re-running the Parent 1 schema inside
> `superRefine` only when not a sole parent.

---

## Section 4: Dependent Children (`DEPENDENT_CHILDREN`)

Implemented in `dependent-children-form.tsx`; validated by
`src/lib/schemas/dependent-children.ts`; typed by `DependentChildrenData`.

### 4.1 Count

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| How many children do you have still living at your address, or who are still financially dependent on you? | Number input | Yes | Help text: "Include children studying at university or college." `numberOfDependentChildren` |

### 4.2 Children table

One flat, repeatable table (**no** separate "Foundation schools" vs. "other
schools" sub-tables). Columns: **Name**, **School**, **Bursary (£)**,
**Unearned income (£)**, Actions. Rows are added/edited via the **Add child** /
**Edit child** modal.

> **Validation:** `superRefine` requires **at least one** child row and at most
> **one** row flagged as the named child of this application.

#### Add / Edit child modal

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| This is the named child of this application | Checkbox | No | When checked, **Name** is auto-filled from Section 1's child name and locked. `isNamedChild` |
| Child name | Text input | Yes | `name` (disabled when named-child is checked) |
| School | Text input | No | `school` |
| Amount of bursary (£) | Currency input | No | `bursaryAmount` |
| Children's unearned income (£) | Currency input | Yes | Help text: "Where a value is not applicable, please enter 0." `unearnedIncome` |

> **Correction:** the pre-build "Dependent status (date)" and "Surname of other
> parent" columns/fields are **not** in the shipped modal (the
> `dependentStatusDate` / `surnameOtherParent` keys exist in the type but are
> not collected). There is no dropdown for "Is this child"; selection of the
> named child is the checkbox above.

---

## Section 5: Dependent Elderly (`DEPENDENT_ELDERLY`)

Implemented in `dependent-elderly-form.tsx`; validated by
`src/lib/schemas/dependent-elderly.ts`; typed by `DependentElderlyData`.

### 5.1 Elderly dependants at home

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any elderly dependant that you are providing for at home? | Yes/No toggle | Yes | `hasElderlyAtHome` |
| How many? | Number input | Yes (when Yes) | `elderlyAtHomeCount` |
| Per-dependant details (names, DOB, 100+ flag) | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box: "Elderly dependant details form will be fully implemented in a future work package." |

### 5.2 Elderly dependants in a care home

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any elderly dependant that you are providing for in a care home? | Yes/No toggle | Yes | `hasElderlyInCare` |
| How many? | Number input | Yes (when Yes) | `elderlyInCareCount` |
| Per-dependant + care home details (name, DOB, care home name, fees, invoice upload) | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box: "Care home dependant details form will be fully implemented in a future work package." |

> **Correction:** the rich per-dependant modals described in the pre-build
> design (first/middle/surname, DOB with 100+ checkbox, care home name/fees,
> invoice upload) are **defined in the type and Zod schema**
> (`ElderlyDependant`) **but the UI only collects the Yes/No + count today.** See
> "Implementation gaps."

---

## Section 6: Other Information Required (`OTHER_INFO`)

Implemented in `other-info-form.tsx`; typed by `OtherInfoData`.

### 6.1 Court orders

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have a court order for the payment of school fees? | Yes/No toggle | Yes | `hasCOurtOrder` (note the camelCase typo `hasCOurtOrder` in the type/field name) |
| Amount per term | Currency (£) | Yes (when Yes) | `courtOrderTermAmount` |
| Amount per year | Currency (£) | Yes (when Yes) | `courtOrderYearAmount` |
| Evidence of Court Order | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box. `courtOrderDocumentId` exists in the type but no upload control is wired. |

### 6.2 Insurance policies

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have the benefit of any insurance policies specifically to pay school fees? | Yes/No toggle | Yes | `hasInsurancePolicy` |
| Amount to be paid this school year | Currency (£) | Yes (when Yes) | `insurancePolicyAmount` |

> **Correction:** the pre-build insurance **date-range** fields are **not**
> rendered (`insurancePolicyStartDate` / `insurancePolicyEndDate` exist in the
> type but have no inputs). The pre-build "School Maintenance Payments" upload
> sub-section is **not** present (`maintenancePaymentDocumentId` is unused by the
> UI).

### 6.3 Outstanding school fees

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Are any outstanding school fees owed at any other school? | Yes/No toggle | Yes | `hasOutstandingFees` |
| Name(s) of school | Text input | Yes (when Yes) | `outstandingFeesSchoolName` |
| Amount owed | Currency (£) | Yes (when Yes) | `outstandingFeesAmount` |

---

## Section 7: Parents' Income (`PARENTS_INCOME`)

Implemented in `parents-income-form.tsx`; typed by `ParentsIncomeData` /
`ParentIncomeRecord`. The whole block repeats for Parent/Guardian 2 unless
`isSoleParent` is true.

Banner: *"Please complete the table below showing GROSS INCOME before deduction
of tax from all sources of income. Where a source is not applicable to you,
please enter 0."* Single column header: **"To April (actual)."**

### 7.1 Income table (per parent) — 14 line items

All 14 are currency (£) inputs; enter 0 where not applicable:

`salaryWagesPension`, `supplementsAndBonus`, `otherBenefitsAndCommissions`,
`amountFromPartner`, `workingTaxCredits`, `grossInterestReceived`,
`allDividendIncome`, `grossRentsReceived`, `allIncomeBonds`, `otherGrossIncomes`,
`maintenanceOrEquivalents`, `bursariesOrSponsorships`, `otherIncomeNotIncluded`,
`otherIncome`.

### 7.2 Supporting documents (per parent) — all functional uploads

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| P60 | File upload (functional) | **Yes — always** | Slot `P60_PARENT_{N}`; `p60DocumentId` |
| Self-assessment tax return (SA302) | File upload (functional) | Conditional | Shown when `allDividendIncome > 0` OR `grossRentsReceived > 0` OR `allIncomeBonds > 0`. Slot `SELF_ASSESSMENT_PARENT_{N}`; `selfAssessmentDocumentId` |
| Benefits / tax credits evidence | File upload (functional) | Conditional | Shown when `workingTaxCredits > 0` OR `otherBenefitsAndCommissions > 0`. Slot `BENEFITS_EVIDENCE_PARENT_{N}`; `benefitsEvidenceDocumentId` |
| Do you make regular capital repayments? | Yes/No toggle | Yes | `hasCapitalRepayments` |
| Capital repayments evidence | File upload (functional) | Conditional | Shown when `hasCapitalRepayments` is true. Slot `CAPITAL_REPAYMENTS_PARENT_{N}`; `capitalRepaymentsDocumentId` |

> **Correction:** the conditional triggers above are **derived from the income
> figures** (and the capital-repayments toggle), not from the employment status.
> These uploads are **functional**, unlike the stubs elsewhere.

### 7.3 Confirmation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| I confirm that all documents uploaded on this page are current and legible | Checkbox | Yes | `documentsConfirmed` |

---

## Section 8: Parents' Assets & Liabilities (`ASSETS_LIABILITIES`)

Implemented in `assets-liabilities-form.tsx`; typed by `AssetsLiabilitiesData`.

### 8.1 Capital assets — what you own

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you own or rent your home? | Dropdown | Yes | Own (`OWN`) / Rent (`RENT`). `propertyOwnership` |
| Approximate value of residence/property | Currency (£) | Yes | `residenceValue` |
| Value of your car(s) | Currency (£) | Yes | `carValue` |
| Value of other possessions including home contents | Currency (£) | Yes | `otherPossessionsValue` |
| Total of all stocks or shares / equities | Currency (£) | Yes | `stocksAndSharesValue` |
| Approximate value of investments (Bonds, PEPs, ISAs, etc.) | Currency (£) | Yes | `investmentsValue` |
| Approximate value of any other assets not included above | Currency (£) | Yes | `otherAssetsValue` |

### 8.2 Other properties

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Do you have any other properties? | Yes/No toggle | Yes | `hasOtherProperties` |
| Total value of any other properties owned | Currency (£) | Yes (when Yes) | `otherPropertiesTotalValue` |
| Property list table (address / postcode / value rows) | **⚠️ NOT YET BUILT (stub)** | — | Placeholder box: "Property list table will be fully implemented in a future work package." The `otherProperties[]` array and `OtherProperty` type exist but no add-property modal is rendered. |

> **Correction:** the shipped form does **not** render the separate "rental
> property" radio/value (`hasRentalProperty` / `rentalPropertyValue` are in the
> type, no inputs), nor the "Other Outstanding Mortgage Balance"
> (`otherMortgageBalance`) field as a standalone control.

### 8.3 Capital liabilities — what you owe

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Outstanding mortgage (main family home) | Currency (£) | Yes | `outstandingMainMortgage` |
| Total of all other outstanding mortgages | Currency (£) | Yes | `totalOtherMortgages` |
| Total of any current overdraft | Currency (£) | Yes | `currentOverdraft` |
| Do you have any hire / hire purchase agreements? | Yes/No toggle | Yes | `hasHirePurchase` |
| Total of all hire purchase balances outstanding | Currency (£) | Yes (when Yes) | `hirePurchaseBalance` |

> **Correction:** the shipped form does **not** render the pre-build
> "changes to liabilities" question (`hasLiabilityChanges` is in the type, no
> input), the liabilities evidence uploads (`liabilitiesAgreementsDocumentId` /
> `liabilitiesStatementDocumentId`), or a separate other-properties liabilities
> table.

### 8.4 Supporting documents — all functional uploads

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Council tax bill | File upload (functional) | **Yes — always** | Slot `COUNCIL_TAX`; `councilTaxDocumentId` |
| Bank statements — Parent / Guardian 1 | File upload, **multiple** (functional) | **Yes — always** | Slot `BANK_STATEMENT_PARENT_1`; `parent1BankStatementDocumentIds[]`. Hint: "three most recent monthly statements." |
| Bank statements — Parent / Guardian 2 | File upload, **multiple** (functional) | Yes (when not sole parent) | Slot `BANK_STATEMENT_PARENT_2`; `parent2BankStatementDocumentIds[]` |

### 8.5 Confirmation

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| I confirm that all documents uploaded on this page are current and legible | Checkbox | Yes | `documentsConfirmed` |

---

## Section 9: Additional Information (`ADDITIONAL_INFO`)

Implemented in `additional-info-form.tsx`; typed by `AdditionalInfoData`.

### 9.1 Circumstances checklist

Six circumstances; each is a Yes/No toggle (`.applies`). When set to Yes, a
**stub** upload box appears:

| Circumstance | Key | Upload |
|--------------|-----|--------|
| Divorced (if applicable) | `divorced` | **⚠️ NOT YET BUILT (stub)** — "Document upload available once application is created." |
| Separated (if applicable) | `separated` | **⚠️ NOT YET BUILT (stub)** |
| Sick / unable to work | `sickUnableToWork` | **⚠️ NOT YET BUILT (stub)** |
| Paying rent (current statement or lease) | `rent` | **⚠️ NOT YET BUILT (stub)** |
| Been made redundant or lost employment | `madeRedundant` | **⚠️ NOT YET BUILT (stub)** |
| Receiving benefits | `receivingBenefits` | **⚠️ NOT YET BUILT (stub)** |

> Each `CircumstanceItem` has a `documentId` slot in the type, but the upload
> controls are placeholder boxes today.

### 9.2 Additional narrative

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Additional narrative | Textarea | No | `additionalNarrative`. Live character counter, **3000**-character soft limit. |

> The `additionalDocumentIds[]` "extra supporting documents" slot exists in the
> type but there is **no general additional-document upload control** in the UI.

---

## Section 10: Declaration (`DECLARATION`)

Implemented in `declaration-form.tsx`; typed by `DeclarationData`.

A numbered legal declaration (10 points) followed by:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| By clicking this box, I/we agree to the terms and conditions … | Checkbox | Yes | `accepted` |
| On behalf of the applicant | Text input | Yes | `signedOnBehalfOf` — full name of the person accepting |

A warning note reminds the applicant that submitting is a legal commitment.

---

## Review / submission

After the 10 sections, `/apply/review` shows section completion (X of 10
complete, percentage) and gates submission. This is the screen the pre-build
design called the "Validation Summary" — it is **not** a data-entry section.

---

## Implementation gaps surfaced during reconciliation

The reconciliation found several fields that are **typed and/or Zod-validated
but not yet collected by the UI**. These are flagged inline as **⚠️ NOT YET
BUILT (stub)** above. They are implementation gaps, not documentation drift, and
the most material ones are recorded here so they are not lost:

1. **Document uploads rendered as placeholder boxes** (no working upload):
   director's certified accounts & balance sheet, evidence of previous
   self-employment, scholarship/maintenance evidence (Section 3); court-order
   evidence (Section 6); all six circumstance uploads (Section 9). The
   parent-details `superRefine` **requires** `leftSelfEmploymentDocumentId` and
   `scholarshipDocumentId` when their toggles are Yes — but the form provides
   **no control to satisfy that rule**, which can block progress. *Worth a
   separate form-bug ticket if not already tracked.*
2. **Dependent Elderly detail capture** (Section 5): only Yes/No + count is
   collected; the per-dependant and care-home detail modals (and the care-home
   invoice upload) are stubbed.
3. **Other-properties list table** (Section 8): only the total value is
   collected; the per-property address/postcode/value rows are stubbed.
4. **Unused liability/insurance fields**: `hasRentalProperty`,
   `rentalPropertyValue`, `otherMortgageBalance`, `hasLiabilityChanges`,
   liabilities evidence uploads, and insurance date-range fields are defined in
   the types but not rendered.

Per the backlog item's "Out of scope" note, these are **not** fixed here — this
pass only makes the doc TRUE. Build decisions for the stubs belong in their own
tickets.

---

## Appendix: Field type legend

| Type | Description |
|------|-------------|
| Text input | Single-line text field |
| Textarea | Multi-line text field |
| Dropdown (`Select`) | Select from predefined options |
| Country combobox | Searchable country picker |
| Yes/No toggle | Binary toggle component (`YesNoToggle`) |
| Radio group | Multiple radio options (select one) |
| Checkbox | Single tickbox for confirmation/boolean |
| Date input | Date field (`DateInput`) |
| Currency (£) input | Numeric input with pound prefix (`CurrencyInput`) |
| Number input | Numeric-only input |
| File upload (functional) | Working `FileUpload` control (attach / view / remove) |
| ⚠️ NOT YET BUILT (stub) | Placeholder box; no working control rendered yet |

## Appendix: Conditional logic summary (as built)

| Trigger | Condition | Effect |
|---------|-----------|--------|
| `isSoleParent` | = Yes | Hide Parent/Guardian 2 contact, employment, declaration, income block, and P2 bank statements |
| `isSoleParent` | = No | Show all Parent/Guardian 2 blocks (P2 email field becomes required) |
| `sameAddressAsParent1` | = No | Show child's separate address fields |
| `isBritishCitizen` (per family member) | = Yes | Show UK Passport upload only |
| `isBritishCitizen` (per family member) | = No | Show Passport + ILR uploads |
| `status` ∈ {`PAYE`, `SELF_EMPLOYED_DIRECTOR`, `SELF_EMPLOYED_SOLE`} | true | Show profession/employer/director/gross-pay/scholarship block |
| `status` = `UNEMPLOYED` | true | Show "Please provide details" textarea |
| `isDirector` | = Yes | Show share % (+ stubbed accounts/balance-sheet upload boxes) |
| `leftSelfEmployment` | = Yes | Show stubbed self-employment evidence box (schema also requires the doc id) |
| `receivesScholarship` | = Yes | Show stubbed scholarship evidence box (schema also requires the doc id) |
| `isNamedChild` (Add child modal) | = checked | Auto-fill and lock the child name from Section 1 |
| `hasCOurtOrder` | = Yes | Show term/year amounts + stubbed evidence box |
| `hasInsurancePolicy` | = Yes | Show amount-this-year field |
| `hasOutstandingFees` | = Yes | Show school name + amount owed |
| `hasElderlyAtHome` | = Yes | Show "How many?" + stubbed details box |
| `hasElderlyInCare` | = Yes | Show "How many?" + stubbed details box |
| `hasOtherProperties` | = Yes | Show total value + stubbed property-list box |
| `hasHirePurchase` | = Yes | Show outstanding balance field |
| `allDividendIncome` / `grossRentsReceived` / `allIncomeBonds` > 0 | true | Show SA302 upload (per parent) |
| `workingTaxCredits` / `otherBenefitsAndCommissions` > 0 | true | Show benefits evidence upload (per parent) |
| `hasCapitalRepayments` | = Yes | Show capital repayments evidence upload (per parent) |
| Circumstance `.applies` (Section 9) | = Yes | Show stubbed circumstance evidence box |
