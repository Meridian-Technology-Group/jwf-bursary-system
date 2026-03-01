# John Whitgift Foundation — Bursary Assessment System

## Background

The **John Whitgift Foundation** is a charitable foundation that provides means-tested bursaries to families applying for places at its schools: **Trinity School** and **Whitgift School** in Croydon, South London. The bursary programme assesses the financial circumstances of applicant families and awards fee reductions to those who demonstrate genuine need.

The Foundation currently runs its bursary application and assessment process on **Symplectic Grant Tracker**, a research-grant lifecycle management platform built by Digital Science. Grant Tracker was never designed for means-tested bursary assessment — it is a research charity funding tool that has been heavily customised to fit this purpose. On **14 July 2025**, Digital Science announced that Symplectic Grant Tracker will be **sunset on 31 December 2026**, making a migration mandatory.

This project is the replacement system: a purpose-built bursary assessment platform designed from the ground up for the Foundation's specific needs.

---

## What the System Does

The system manages the full lifecycle of a bursary application, from the moment a parent begins filling in the form through to the annual re-assessment of an active bursary. There are four main functional areas:

### 1. Applicant Portal

A web application where invited parents/guardians apply for a bursary. This is a **single-user portal** — only the lead applicant has access (via their email address). They answer on behalf of both parents where applicable. There is no dual-login or second-parent access.

Access is not open to the public — an admin must first invite the applicant (typically after the family has been offered a place at one of the schools). The invited parent then registers on the portal and completes the application form, which collects comprehensive financial and household information across multiple sections:

- **Child details** — school selection, **entry year** (Year 6, Year 7, Year 9, or Year 12), identity, address, birth certificate
- **Family identification** — passport/right-to-remain documents for every household member (initial application only; hidden/disabled for re-assessments)
- **Parent/guardian details** — contact information, employment status, and employment evidence for one or two parents (conditional on sole-parent status)
- **Household composition** — dependent children (at Foundation schools and elsewhere) and dependent elderly (at home or in care homes)
- **Other financial commitments** — court orders for fees, insurance policies, outstanding school fees
- **Income** — a full gross income breakdown for each parent across ~14 income sources (salary, benefits, dividends, rent, maintenance, etc.) for the relevant tax year, with supporting P60/HMRC documents
- **Assets & liabilities** — property ownership/rental, vehicles, investments, bank statements (3 months for all accounts), mortgages, overdrafts, hire purchase agreements
- **Additional circumstances** — free-text narrative plus evidence uploads for divorce, separation, redundancy, illness, etc.
- **Declaration** — legal declaration that all information is true and complete

> **Important:** The applicant's form is primarily a **document collection exercise**. Many applicants confuse net and gross income, enter monthly figures when yearly is requested, or misrepresent their employment status. The assessor independently derives all financial figures from the uploaded source documents (P60s, tax returns, bank statements) — not from the applicant's declared values. See [Two-Layer Data Model](#two-layer-data-model).

The full input mapping is documented in **[APPLICATION.md](./APPLICATION.md)**.

### 2. Admin / Assessment Console

An internal tool used by Foundation bursary staff to manage rounds, review submissions, perform financial assessments, and manage active bursaries.

**Round management** — each academic year has a bursary assessment round with open/close dates and access controls.

**Application processing workflow:**

1. Applications arrive in a **Submitted** queue
2. The assessor checks that all required documents have been uploaded (all tabs showing green ticks)
3. The assessor works through a **split-screen assessment form**: the left panel displays the applicant's uploaded source documents (with navigation, zoom, and page controls), while the right panel shows the data entry form — allowing the assessor to read figures directly from P60s, tax returns, and bank statements while entering verified values
4. **Assessment statuses:** Not Started → Paused (awaiting documents from applicant) → Completed
5. **Outcome:** Qualifies for a bursary (with nominal £ amount and payable fees) OR Does Not Qualify
6. The assessor produces a recommendation (see [Assessment Output](#assessment-output--recommendation-to-schools)) which is sent to the school externally

**If documents are missing**, the assessor pauses the assessment and emails the applicant requesting the missing items. The applicant responds by email; the assessor attaches the documents to the application and regenerates it. If the application is too incomplete, it may be rejected and the applicant asked to start over.

**Data minimisation in the admin console** — the application queue hides applicant and child names by default, showing only reference numbers, school, and status. The assessor can toggle name visibility when needed (e.g., for communication), and these reveal actions are audit-logged. The assessment form uses anonymised labels ("Parent 1", "Parent 2") instead of real names, and displays the bursary reference number rather than the family name. Reports and analytics use aggregate data and reference numbers by default. Names are only shown in contexts where identification is necessary: applicant detail view, communication screens, and the recommendation export.

**One assessor per application** — there is no committee review step within the system. The Foundation assesses and recommends; the school's Headmaster decides whether to award a bursary-supported place based on the recommendation, the candidate's entrance exam results, and the available funds for that year.

The admin system structure is documented in **[ADMIN.md](./ADMIN.md)**.

### 3. Annual Re-assessment

Bursaries are not permanent — they are re-assessed every year. Each round (academic year), existing bursary holders must submit a **new application** for the upcoming year. The re-assessment process works as follows:

1. **Invitation:** The assessor sends a prewritten email asking the applicant to submit a new application by a due date. The application in the portal resets to a "not submitted" status. The rounds logic manages which contacts are invited each year.
2. **Pre-population:** The lead applicant's **address** is pre-populated from the previous year. In the new system, **child details** and **family member names** should also carry forward.
3. **ID documents:** The identification documents section is **hidden/disabled** for re-assessments — ID is only checked in year 1. Once a family passes the initial ID checks, they never need to re-upload these documents.
4. **Everything else:** All other sections — income, assets & liabilities, household composition, employment details, supporting documents — must be completed afresh with current figures.
5. **Assessment:** The re-assessment goes through the same validation and calculation workflow as a first-time application.

**School prefix:** Once a child is at a school, the bursary account reference is amended to start with **WS-** (Whitgift School) or **TS-** (Trinity School).

### 4. Internal Bursary Requests

In addition to the standard application cycle (triggered by entrance exam + place offer), bursaries can also be requested **internally** for pastoral or emergency reasons — for example, a parent falling gravely ill, or a sudden change in family circumstances.

- Internal requests use the **same forms and assessment process** as standard applications
- The parent still submits an application through the portal
- They can happen at **any time** during the school year (not just at the standard entry points)
- They can become **rolling-over bursaries** that are re-assessed annually like any other bursary
- These are within scope for the replacement system

---

## Two-Layer Data Model

A critical architectural feature of this system is the separation between **applicant-entered data** and **assessor-entered data**:

| Layer | Who enters | Purpose | Used in calculation? |
|-------|-----------|---------|---------------------|
| **Applicant layer** | Parent/guardian via portal | Document collection — gathers supporting evidence (P60s, tax returns, bank statements, benefit letters) and provides a cross-reference of declared figures | **No** |
| **Assessor layer** | Foundation assessor in admin console | Verified financial picture — independently derived NET figures extracted from source documents | **Yes** |

The applicant's declared income, assets, and liabilities are **not** fed into the assessment calculation engine. The assessor:

1. Receives the uploaded source documents (P60s, tax returns, bank statements, benefit letters, council tax bills)
2. Manually reads the correct NET figures from these documents
3. Enters verified figures into the assessment form, categorised by income type
4. The calculation engine runs exclusively on the assessor-entered data

This two-layer approach exists because:
- Applicants often confuse net and gross income
- Some enter monthly totals when yearly is requested (and vice versa)
- Some misrepresent their employment status (e.g., claiming "unemployed" while being a company director or property landlord)
- Tax documents and bank statements are used as the official evidence of what is earned

The total is calculated **per household** (Parent 1 + Parent 2 combined), not per individual.

---

## Application Lifecycle

```
  APPLICANT SIDE                          ADMIN SIDE
  ──────────────                          ──────────

                                     Admin invites applicant
                                     (sends portal invitation)
                                            │
  Receives invitation ◄────────────────────┘
         │
         ▼
  Registers on portal
  (single-user: lead
   applicant only)
         │
         ▼
  Starts application ──────────────► Visible as "Pre-Submission"
  (saves progress,                   on round dashboard
   multi-session)
         │
         ▼
  Submits completed ───────────────► Appears in Submitted queue
  application with                         │
  supporting documents                     ▼
                                    Assessor checks documents
                                    (all tabs green-ticked?)
                                           │
                                    ┌──────┴──────────┐
                                    ▼                  ▼
                              Documents OK        Missing docs
                                    │              (status: Paused)
                                    │                  │
                                    │           Email applicant ───► Applicant
                                    │           for missing docs     uploads/emails
                                    │                  │             missing items
                                    │                  ◄─────────────┘
                                    ▼
                             Assessor derives NET figures
                             from source documents (P60s,
                             tax returns, bank statements)
                             and enters into assessment form
                                    │
                                    ▼
                             Runs 4-stage calculation
                             (income → assets → living
                              costs → bursary impact)
                                    │
                             ┌──────┴──────┐
                             ▼             ▼
                         Qualifies    Does Not Qualify
                         (nominal £       │
                          + payable     Applicant
                          fees)         notified
                             │         (4-week appeal
                             ▼          window, handled
                      Produces           externally)
                      recommendation
                      (spreadsheet export)
                             │
                             ▼
                      Sends to school ──────► School Headmaster
                      externally (GDPR)       decides based on:
                                              - entrance exam
                                              - available funds
                                              - recommendation
                                                    │
  Notified of outcome ◄──────────────────── Place offered/declined
         │
         ▼
  Child attends school              Active bursary on record
  with fee reduction                      │
         │                                ▼
         ▼                         Next round opens
  Receives re-assessment ◄──── Assessor sends prewritten
  email                         email; application resets
         │                      to not-submitted status
         ▼
  Completes new application
  (address pre-populated,
   ID section hidden,
   all else fresh)
         │
         ▼
  Submits ─────────────────► Assessed as per initial
                              application
                                    │
                             ┌──────┴──────┐
                             ▼             ▼
                         Renewed      Closed/Adjusted
                         (with reason codes
                          for YoY changes)
```

---

## Assessment Calculation Model

The assessment produces a single bottom-line figure: the **Required Bursary Level to Break Even**. This is the amount of fee reduction the family needs for school to be affordable, calculated by comparing the family's disposable income against the annual school fees.

> **Note:** The calculation operates on **assessor-entered data**, not applicant-declared data. See [Two-Layer Data Model](#two-layer-data-model) above.

The calculation flows through four stages:

### Stage 1: Total Household Net Income

The assessor validates and sums **net** income for each earner (First Earner and Second Earner) based on their employment status. Figures are derived from source documents (P60s, tax returns, bank statements), not from the applicant's declared values.

| Employment Status | Income Components |
|-------------------|-------------------|
| **Unemployed & not on benefits** | £0 |
| **PAYE employed** | Yearly net pay |
| **On benefits** | Housing Benefit or Universal Credit entitlement (excl. council tax) + Tax Credits (Working & Child) + Income Support + JSA + Disability Allowance + other benefits (ESA, Carer's, etc.) |
| **Self-employed (director)** | Net salary + net dividends after tax |
| **Self-employed (partner/sole trader)** | Yearly company net profits after tax |
| **In receipt of old age pension** | Yearly pension payments |
| **In receipt of past employment pension** | Pension amount as stated on P60 |

**Benefit inclusion/exclusion rules** (assessor judgment, not system-enforced):
- **Counted as income:** DLA, ESA, PIP, Carer's Allowance when paid to an unemployed **parent** (this constitutes their income)
- **NOT counted as income:** DLA, PIP, or any disability benefit paid for a **child's** specific needs (these funds are spent on the child's care, equipment, and medical support)
- **Improvement for new system:** Provide separate input fields for included benefits (counted as income) and excluded benefits (not counted), to make the distinction explicit

Note: HB is paid every 4 weeks. UC is paid every 4 weeks but as a monthly amount with one period of 8 weeks rest.

> **TOTAL HOUSEHOLD NET INCOME** = First Earner income + Second Earner income

### Stage 2: Net Assets Position

Adjustments are applied based on property ownership and savings. The **Family Type Category** (1-6) drives the notional rent lookup.

**Property adjustments:**
- **Deduct** Notional Rent (auto-looked up from Family Type Category — see reference tables below)
- **If the owned property is mortgage-free:** Add back the notional rent (cancels the deduction, since there's no housing cost)
- **If more than one property is owned:** Add back the additional yearly property income
- **Deduct** annual Council Tax — **always** Band D Croydon (currently £2,480), regardless of the family's actual council tax band. The council tax bill is collected for other verification checks but does not change this fixed deduction. This value is updated annually.

**Savings adjustments:**
- Take total Cash Savings at bank
- Add total ISAs, PEPs, Shares
- **Divide** by number of children at schooling age
- **Divide** by number of schooling years left for the bursary recipient
- This produces a **Derived Savings Annual Total** — an annualised per-child figure representing how much of the family's savings could theoretically contribute to fees each year
- **Add back** this derived savings annual total

**Schooling years remaining** (derived from entry year):

| Entry Year | Years to Year 13 |
|------------|-------------------|
| Year 6 | 8 years |
| Year 7 | 7 years |
| Year 9 | 5 years |
| Year 12 | 2 years |

For internal bursary requests, the entry can happen at any year.

> **TOTAL RELEVANT NET ASSETS YEARLY VALUATION** = Income + property adjustments + annualised savings

### Stage 3: Family Living Costs

Standard living costs are deducted based on the Family Type Category:

- **Deduct** notional Utility & Food costs (auto-looked up from Family Type Category — see reference tables below)

> **HNDI after NS** (Household Net Disposable Income after Necessary Spending) = Net Assets Valuation - Living Costs

### Stage 4: Bursary Impact on Financial Profile

The final calculation compares disposable income to school fees:

> **Required Bursary** = Annual School Fees - HNDI after NS

- If the result is **negative or zero**: the family can afford the fees — **no bursary needed**
- If the result is **positive**: that amount is the **required bursary level to break even** — this becomes the nominal bursary award

The bursary amount IS the award — it is not adjusted by committee. However, exceptional adjustments may be made by the assessor on pastoral grounds (e.g., internal bursary for sudden illness) or to honour a historical benchmark.

---

## Payable Fees Calculation

The **payable fees** are what the bursary recipient's family actually pays. This is the figure communicated to parents when a bursary place is offered or when a re-assessment award is updated.

School fees are quoted **before VAT**. Scholarships (if any) are applied as a **percentage** of gross fees. Bursaries are applied as a **nominal £ amount**. Both can apply simultaneously. If there is no scholarship, 0% is entered.

### Formula

```
Gross Fees (before VAT)                         e.g.  £26,208.00
−  Scholarship (% of gross fees)                e.g. − £7,862.40  (30%)
−  Bursary Award (nominal £, pre-VAT)           e.g. −£10,374.67
                                                     ───────────
=  Net Yearly Fees                               e.g.   £7,970.93
+  VAT at 20%                                    e.g. + £1,594.19
                                                     ───────────
=  Yearly Payable Fees                           e.g.   £9,565.12

÷  12
=  Monthly Payable Fees                          e.g.     £797.09
```

### Historical Payable Fees Benchmark

The payable fees from the **first year's assessment** act as a **benchmark floor**:

- Payable fees can only **increase** if the assessor can demonstrate a **positive change** in the family's financial situation year-on-year
- Payable fees **can decrease** if the family's situation worsens
- If a family starts with a full bursary (£0 payable fees), they remain at £0 unless circumstances improve
- The system should allow **manual adjustments** to payable fees for exceptional cases (the logic should not be hard-coded)

> **Phase 2 feature request:** A benchmark tracking dashboard showing the history of payable fees over time for each bursary account.

---

## Sibling Application Linking

Applications are **per child** (nominative). When a family has multiple children at Foundation schools, each child has their own application and bursary account. However, the assessments are financially linked:

1. **Manual linking:** The assessor explicitly links sibling applications. The system does not auto-detect siblings.
2. **Sequential absorption:** The child with the **oldest bursary award** (chronologically first) absorbs the household's available disposable income. Their payable fees are set based on HNDI.
3. **Second child:** Child 1's payable fees appear as a **deduction** in Child 2's disposable income calculation. Since Child 1 has typically absorbed all available income, Child 2 qualifies for a near-full or full bursary.
4. **Cross-school:** The same logic applies even if children are at different Foundation schools (one at Trinity, one at Whitgift). The family is assessed as one unit.
5. **When Child 1 leaves:** Child 2 becomes the primary bursary holder and takes on the payable fees. A new child entering would then benefit from Child 2's fees being deducted.

---

## Assessment Output & Recommendation to Schools

The Foundation produces **recommendations** — the school decides whether to award a bursary-supported place. All information is sent **externally** (spreadsheet export) due to GDPR. The school has no access to the bursary system.

### Recommendation Content

A typical recommendation, saved as a text export on each bursary account for each year, includes:

1. **Family synopsis:** Single parent or married couple, number of children, both parents' employment roles
2. **Accommodation status:** Whether they rent or have a mortgage
3. **Income category** (from the assessment)
4. **Property category** (1-12 classification — used for reporting instead of precise property values)
5. **Bursary award recommendation** (nominal £ amount)
6. **Payable fees recommendation** (yearly and monthly)
7. **Red flags** (if applicable): Dishonesty flag, Credit risk flag

### Year-on-Year Change Reason Codes

For re-assessments, the assessor selects one or more reason codes explaining why the bursary award or payable fees have changed compared to the previous year. These are configurable (some may be added or deprecated over time). Current codes:

| Code | Reason |
|------|--------|
| 1 | No real change |
| 2 | Property asset has increased in value |
| 3 | New property asset acquired |
| 4 | Increased savings |
| 5 | More Profitable or New Investments |
| 6 | Salary increase |
| 77 | Self-employed net profit increase |
| 8 | Additional family member since last year |
| 9 | Divorce or separation |
| 10 | Bereavement |
| 11 | Serious Illness |
| 12 | Additional income not disclosed last year |
| 13 | Additional asset not disclosed last year |
| 14 | Sudden unemployment |
| 15 | New job and increased pay |
| 16 | New job and decreased pay |
| 17 | Increase in Benefits |
| 18 | Inheritance |
| 19 | Bonus change year on year |
| 20 | Re-mortgage agreement |
| 21 | Early Pension drawing |
| 22 | Change in accommodation arrangements |
| 23 | Mortgage now fully paid |
| 24 | Failure to provide required documents |
| 25 | Failure to meet the deadline |
| 26 | Forged or tampered with documents |
| 27 | Error made in previous assessment |
| 28 | Reduced net self-employed profit |
| 29 | New asset acquired since last year |
| 30 | No year on year comparison, first assessment |
| 31 | One of their children has left school since last year |
| 32 | Other |
| 33 | Property asset has decreased in value |
| 34 | Reduced savings |
| 35 | Stopped qualifying for some benefits |

These reason codes are reported to schools as part of the year-on-year payable fee change summary.

---

## Assessment Reference Tables

These are the configurable lookup tables used in the calculation. Values are updated periodically (typically annually, based on CPI and fee changes) by the assessor.

### Family Type Categories

| Category | Description |
|----------|-------------|
| 1 | Sole parent with 1 child |
| 2 | Parents with 1 child |
| 3 | Parents with 2 children |
| 4 | Parents with 3 children |
| 5 | Parents with 4 children |
| 6 | Parents with 5 or more children |

### Annual Notional Rents (by Family Type Category)

| Category | 1 | 2 | 3 | 4 | 5 | 6 |
|----------|---|---|---|---|---|---|
| **Annual Notional Rent** | £13,000 | £15,000 | £18,000 | £20,000 | £23,000 | £26,000 |

### Utility & Food Costs (by Family Type Category)

| Category | 1 | 2 | 3 | 4 | 5 | 6 |
|----------|---|---|---|---|---|---|
| **Utilities** | £1,200 | £1,500 | £2,000 | £2,500 | £3,000 | £3,300 |
| **Food** | £5,000 | £7,500 | £8,500 | £9,500 | £10,500 | £12,000 |
| **Total** | £6,200 | £9,000 | £10,500 | £12,000 | £13,500 | £15,300 |

### Property Classification Table

Used for **reporting to schools** (not in the financial calculation), and for **qualifying criteria** checks.

**Official qualifying criterion:** The family must own **one property valued at less than £750K**. Families with property portfolios above this threshold may be automatically disqualified.

| Category | Description |
|----------|-------------|
| 1 | Renting, does not own a property |
| 2 | Owns a property < £360K & paying a mortgage |
| 3 | Owns a property £360K-£500K & paying a mortgage |
| 4 | Owns a property < £360K & fully paid |
| 5 | Owns a property £360K-£500K & fully paid |
| 6 | Owns a property £500K-£800K |
| 7 | Owns a property portfolio (2+ properties) £500K-£800K |
| 8 | Owns a property portfolio £800K-£1m |
| 9 | Owns a property portfolio £1m-£1.2m |
| 10 | Owns a property portfolio £1.2m-£1.5m |
| 11 | Owns a property portfolio £1.5m-£1.8m |
| 12 | Owns a property portfolio > £1.8m |

### Income Guideline Thresholds

These are **soft guidelines**, not hard system rules. They change as school fee levels change (e.g., the introduction of VAT on school fees pushed the thresholds up).

| Threshold | Approximate Level | Meaning |
|-----------|-------------------|---------|
| **Full bursary** | ~£27,000 household income | Family qualifies for a full bursary (£0 payable fees) |
| **No bursary** | ~£90,000 household income | Family is assumed to not need a bursary |

Applicants above £90K still apply and are assessed — the model determines whether they qualify based on deductions and family size. Approximately 25 families per year apply who are well over the qualifying criteria.

### Council Tax (Croydon 2025-26)

The assessment **always uses Band D Croydon** (currently £2,480) regardless of the family's actual council tax band. This value is updated annually. The council tax bill is collected from applicants for other verification checks (e.g., confirming address, detecting expensive properties).

| Band | Croydon Services | Adult Social Care | GLA Precept | **Total** |
|------|-----------------|-------------------|-------------|-----------|
| A | £1,133 | £194 | £327 | **£1,654** |
| B | £1,321 | £226 | £381 | **£1,930** |
| C | £1,510 | £259 | £436 | **£2,205** |
| **D (default)** | **£1,699** | **£291** | **£490** | **£2,480** |
| E | £2,077 | £356 | £599 | **£3,032** |
| F | £2,454 | £421 | £708 | **£3,583** |
| G | £2,832 | £485 | £817 | **£4,134** |
| H | £3,398 | £582 | £981 | **£4,961** |

### Annual School Fees (2026-27, before VAT)

| School | Annual Fees (ex-VAT) |
|--------|---------------------|
| Trinity School | £30,702 |
| Whitgift School | £31,752 |

Note: VAT at 20% is applied after scholarship and bursary deductions. See [Payable Fees Calculation](#payable-fees-calculation).

---

## Assessment Checklist Tabs

In addition to the calculation model above, the assessor's checklist includes qualitative evaluation tabs:

| Tab | What It Covers |
|-----|----------------|
| **Bursary Assessment Details** | Core application data validation and summary |
| **Living Conditions / Other JWF Children** | Housing situation, other siblings at Foundation schools (who may already have bursaries) |
| **Debt Situation** | Mortgages, overdrafts, hire purchase, outstanding obligations |
| **Other Fees with the Foundation** | Any existing financial relationship with the Foundation |
| **Staff Situation** | Whether the applicant is employed by the Foundation (relevant to eligibility/conflict) |
| **Financial Profile Impact** | Significant life events (divorce, redundancy, illness) that affect financial position |
| **Net Assets Position** | The calculated financial model described above |

---

## Key Domain Concepts

| Concept | Description |
|---------|-------------|
| **Round** | A bursary assessment cycle for one academic year (e.g. "Bursary Assessment 2026/27"). Has open/close dates for applications and a funding decision date. |
| **Application** | A submitted bursary request from a parent/guardian for a specific child at a specific school. One application per child. |
| **Invitation** | The admin-initiated first step. An applicant cannot self-register; they must be invited to the portal by an admin (typically after the child has been offered a school place). |
| **Lead Applicant** | The parent/guardian who is invited, registers on the portal, and submits the application. The only person with portal access — answers on behalf of both parents. |
| **Reference** | An auto-generated identifier. Format during assessment: `YY/YY_SchoolName_ChildName_Seq`. Once active, amended to the school's billing system format with prefix: **WS-** (Whitgift) or **TS-** (Trinity). |
| **Entry Year** | The year group at which the child enters the school. Standard entry points: Year 6 (8 years to Year 13), Year 7 (7 years), Year 9 (5 years), Year 12 (2 years). Determines "schooling years remaining" for savings calculations. Internal bursary requests can occur at any year. |
| **Family Type Category** | A classification (1-6) based on household composition: 1 = sole parent with 1 child, through to 6 = parents with 5+ children. Drives notional rent and utility/food cost lookups. |
| **HNDI after NS** | Household Net Disposable Income after Necessary Spending — the key calculated figure. Compared against school fees to determine bursary level. |
| **Required Bursary Level** | The output of Stage 4: Annual School Fees minus HNDI after NS. If positive, this nominal £ amount IS the bursary award. |
| **Payable Fees** | What the family actually pays after scholarship (%) and bursary (£) deductions, plus VAT. This is the figure communicated to parents. See [Payable Fees Calculation](#payable-fees-calculation). |
| **Scholarship** | A percentage-based fee reduction awarded by the school (typically for academic or sporting merit). Applied before the bursary deduction. Entered as 0% if no scholarship. |
| **Benchmark** | The payable fees from the first year's assessment, which act as a floor. Fees can only increase if positive financial change is demonstrated. Can decrease if circumstances worsen. |
| **Sibling Linking** | The assessor manually links applications for siblings. The child with the oldest bursary absorbs household disposable income; subsequent children qualify for near-full bursaries. |
| **Internal Bursary Request** | A bursary request initiated for pastoral/emergency reasons (e.g., parent's sudden illness) rather than at school entry. Uses the same forms and assessment process. Can happen at any time. |
| **Annual Re-assessment** | Each year, existing bursary holders submit a new application. Identical to initial except ID documents are hidden/disabled. Address and (in new system) child details/family names are pre-populated. |
| **Validation (Document Check)** | The first step of admin review — confirming all required documents have been uploaded (all tabs green-ticked). |
| **Assessment** | The core assessor activity: independently deriving NET financial figures from source documents and entering them into the calculation model. Operates on assessor-entered data, not applicant-declared data. |
| **Notional Rent** | An imputed housing cost deducted from income based on Family Type Category. Added back if the property is mortgage-free. Normalises comparisons between renters and owners. |
| **Derived Savings Annual Total** | Total savings / number of school-age children / schooling years remaining. The annualised per-child savings contribution. |
| **Property Classification** | A 12-category classification (Renting through to Portfolio > £1.8m) used for reporting to schools. Also used for qualifying criteria: one property < £750K. |
| **Red Flags** | Tags an assessor can apply: Dishonesty flag (misrepresentation detected), Credit risk flag. Included in the recommendation to schools. |
| **Reason Codes** | Configurable codes (currently 35) explaining year-on-year changes in bursary award / payable fees. Selected by the assessor during re-assessment. Reported to schools. |
| **Name Masking** | Personal identifiers are hidden by default in the application queue, assessment form, and reports. The queue shows reference numbers only; the assessment form uses "Parent 1"/"Parent 2" labels and the bursary reference instead of the family name. Name-reveal actions are audit-logged for GDPR accountability. |

---

## Data & GDPR

| Policy | Detail |
|--------|--------|
| **Retention period** | 7 years (legal requirement) |
| **Rejected applications** | Purged after the 4-week appeal window |
| **End of bursary** | Data retained for 7 years after the child leaves school, then deleted |
| **Right to deletion** | Applicants can request deletion of their data at any time (and often do, especially after learning they don't qualify) |
| **Appeal window** | 4 weeks from outcome notification. Handled externally by email. Rarely results in changes — the assessment model's output is upheld unless an error is identified |
| **School access** | None. All information sent to schools externally as spreadsheet exports. The school never accesses the bursary system directly. |
| **Data minimisation** | Personal identifiers (names, email addresses) are masked by default in assessment and reporting contexts. Revealed only where identification is necessary (applicant detail, communication, recommendation export). Name-reveal actions are audit-logged for GDPR accountability. |

---

## Project Scope

This replacement system must cover:

### Must Have

- **Applicant portal** — single-user (lead applicant only), multi-step application form with conditional logic, file uploads, save-and-resume, progress tracking, and validation summary. Must collect **entry year** (Year 6/7/9/12). See [APPLICATION.md](./APPLICATION.md) for full input specification
- **Admin console** — round management, application queue, document verification, structured assessment form with financial calculations
- **Two-layer data model** — applicant-entered data (document collection) kept separate from assessor-entered data (calculation input). The assessment engine operates exclusively on assessor-entered figures
- **Assessment engine** — implements the four-stage calculation model (income, net assets, living costs, bursary impact) with configurable reference tables (notional rents, utility/food costs, council tax, school fees, property classifications) that the Foundation can update annually
- **Payable fees calculation** — applies scholarship (%) then bursary (£) deductions, adds VAT, produces yearly and monthly payable fees
- **Sibling linking** — assessor can manually link sibling applications; Child 1's payable fees deducted from Child 2's disposable income calculation
- **Annual re-assessment** — invitation flow, pre-population (address, child details, family names), ID section hidden/disabled, same assessment workflow as initial application
- **Internal bursary requests** — same forms and process, can happen at any time, can become rolling-over bursaries
- **Assessment output** — recommendation text (family synopsis, income/property categories, bursary award, payable fees, red flags), stored per account per year. Exportable for external transmission to schools
- **Year-on-year reason codes** — configurable reason codes for payable fee changes, selectable during re-assessment
- **Benefit fields** — separate input sections for benefits counted as income vs. benefits excluded from income
- **Split-screen document viewer** — the assessment form displays as a split-screen: left panel shows uploaded source documents (with navigation and zoom), right panel shows the data entry form, allowing the assessor to read and enter figures simultaneously
- **Data minimisation & name masking** — application queue hides names by default (reference numbers only); assessment form uses anonymised labels ("Parent 1", "Parent 2") and bursary reference instead of family name; reports use aggregate data; name-reveal actions are audit-logged
- **Document management** — upload, storage, and viewing of supporting documents (passports, P60s, bank statements, council tax bills, etc.)
- **User management** — admin-initiated applicant invitation, applicant registration via invite link, admin roles and access control. Assessor can update all reference tables
- **Email notifications** — templated communications at key workflow stages (invitation, submission confirmation, missing documents request, outcome notification, re-assessment invitation)
- **Data export** — field-level export for reporting and analysis
- **GDPR compliance** — 7-year retention, purge rejected applications, support right-to-deletion requests

### Should Have

- **Dashboard** — at-a-glance status of the current round (pre-submission count, submitted, assessed, qualifies, does not qualify)
- **Year-on-year comparison** — side-by-side view of previous year's figures alongside current year during re-assessment
- **PDF generation** — ability to generate a PDF summary of any application and assessment
- **Audit trail** — history of all changes to an application and assessment
- **Bulk operations** — batch reminder sending, batch status updates
- **Reporting & analytics** — canned reports (round summary, bursary awards, income distribution, property categories, reason code frequency, approaching final year, sibling summary) with filter controls and chart visualisations. Ad-hoc report builder for custom queries by data source, filters, grouping, and chart type. All reports exportable as CSV/XLSX; charts as PNG/PDF

### Phase 2 (Desirable Future Enhancements)

- **Payable fees benchmark tracking** — dashboard showing the history of payable fees over time for each bursary account, with the original benchmark highlighted
- **Automatic flagging** — detect significant year-on-year changes (income drop/rise, new property, household composition change)
- **Report scheduling** — automated delivery of canned reports on a schedule (e.g., weekly round summary email)

### Won't Have (Out of Scope)

- Finance/payments module (handled separately by the schools)
- Full CRM/contacts management (beyond what's needed for applicants)
- Calendar/scheduling features
- School-facing portal (all communication is external due to GDPR)
- Automated tax calculation (assessor judgment is required)
- Hard income threshold enforcement (£27K/£90K are soft guidelines)

---

## Reference Documents

| Document | Description |
|----------|-------------|
| [APPLICATION.md](./APPLICATION.md) | Complete field-by-field mapping of every input in the applicant portal, including conditional logic |
| [ADMIN.md](./ADMIN.md) | Documentation of the current admin console structure, workflows, and assessment tools |
| [docs/Assessment Model Notional Calculations - BW.xlsx](./docs/Assessment%20Model%20Notional%20Calculations%20-%20BW.xlsx) | Source spreadsheet for the assessment calculation model, reference tables, and council tax bands |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | 30 requirements questions with stakeholder answers — the primary source of business logic clarification |
| [payable_fees_logic.png](./payable_fees_logic.png) | Payable fees formula showing scholarship, bursary, and VAT interaction |
| [image002.png](./image002.png) | Progress report schedule showing year-by-year re-assessment tracking |
| [image003.png](./image003.png) | Year-on-year bursary change reason codes (35 configurable codes) |
