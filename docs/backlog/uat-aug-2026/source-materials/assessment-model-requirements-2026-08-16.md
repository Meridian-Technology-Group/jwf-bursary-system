# ASSESSMENT MODEL REQUIREMENTS — 16.08.26 (workbook extraction)

Faithful cell-by-cell extraction of Charlotte's workbook
`assessment-model-requirements-2026-08-16.xlsx` (attachment on Gmail message
`1a00a4e5911c9fcd`, "Testing the assessment model", 2026-08-16). The `.xlsx`
sits next to this file and remains the authority if a transcription doubt
arises; this markdown exists so agents can read the requirements without
spreadsheet tooling. Charlotte's labels, spellings, and casing are preserved
verbatim (including e.g. "SILBINGS", "EESA", "STUCTURE").

Three sheets: **ASSESSMENT MODEL (1-4)** · **BURSARY AWARD (5)** ·
**ASSESSMENT ADMIN**.

Charlotte's email framing: *"I have removed the calculations (they remain the
same so there won't be a change) however, I would need first to see the
infrastructure set out as we need it."* — i.e. this specifies **layout,
labels, and fill-mode** (`autofill` / `manual fill` / `AUTO FILLED NUMBER` /
`displayed` / `hidden`), not new maths. Every `AUTO` cell must come from the
existing v2 engine; see LA-8 in the implementation plan if a row has no
engine counterpart.

---

## Sheet 1 — ASSESSMENT MODEL (1-4)

### PART 1 - BURSARY RECIPIENT'S & FAMILY DETAILS

| Row label | Fill mode | Visibility |
|---|---|---|
| Bursary recipient's First name | autofill | displayed |
| Bursary recipient's Surname | autofill | displayed |
| Bursary award year of entry: | manual edit | displayed |
| Bursary recipient's Scholarship | manual edit | displayed |
| Bursary recipient's sibling 1 at the school | manual edit | displayed |
| Bursary recipient's sibling 2 at the school | manual edit | displayed |
| Bursary recipient's sibling 3 at the school | manual edit | displayed |
| Family category | manual selection from dropdown box | displayed |
| Remaining years at the school | manual edit | displayed |
| Number of schooling age children | manual edit | displayed |
| Annual school fees | autofill | hidden |

> Note: her email body lists *Remaining years at the school* as **autofill**
> while the workbook cell says **manual edit**. Resolve as
> prefilled-from-engine but editable (matches AE-11 "editable for override").

### PART 2 - HOUSEHOLD INCOME

Header: *"Instructions for the assessor"* — displayed. Two value columns in
the workbook (F and G) = **Parent 1 and Parent 2 columns of one table**
(per her email: "I really need both parent 1 and parent 2 in two columns but
within the same table, not one after the other"). All rows displayed.

| Status block (column D) | Row (column E) |
|---|---|
| IF UNEMPLOYED & NOT ON BENEFITS | NO CHANGE (0) |
| IF PAYE STATUS | ADD YEARLY NET PAY |
| IF SELF-EMPLOYED & A DIRECTOR | ADD NET SALARY |
| | ADD NET DIVIDENDS AFTER TAX |
| | ADD PROPERTY INCOME AFTER TAX |
| | ADD INVESTMENT / OTHER INCOME AFTER TAX |
| IF SELF-EMPLOYED & A PARTNER OR SOLE TRADER | ADD YEARLY COMPANY NET PROFITS AFTER TAX |
| IF ON BENEFITS | ADD YEARLY UNIVERSAL CREDIT |
| | ADD YEARLY HOUSING BENEFITS |
| | ADD YEARLY CHILD BENEFITS |
| | ADD TAX CREDITS (WORKING & CHILD) |
| | ADD YEARLY INCOME SUPPORT OR EESA |
| | ADD YEARLY DLA |
| | ADD YEARLY PIP |
| | ADD YEARLY CARER'S ALLOWANCE |
| | ADD YEARLY CHILDCARE SUPPORT |
| | ADD YEARLY OTHER BENEFITS |
| IF UNEMPLOYED/ IN BETWEEN ROLES | ADD NET FINAL SALARY STATED ON P45 |
| | ADD REDUNDANCY/ SEVERANCE PAY |
| | ADD JSA SUPPORT |
| | ADD STUDENT SUPPORT |
| | ADD PARENTAL/ADOPTION/SICKNESS NET PAY |
| IF RETIRED | ADD YEARLY STATE PENSION |
| | ADD YEARLY PRIVATE PENSION/ OTHER PLAN |
| IF SEPARATED/DIVORCED | ADD YEARLY CHILD MAINTENANCE |
| | ADD EARNED INCOME PORTION FROM NEW SPOUSE IF REMARRIED |
| IF RECEIVING SUPPORT FROM FRIENDS/FAMILY/OTHER 3RD PARTY | ADD ADJUSTED LAST 12 MONTHS' RECEIVED CASH SUPPORT/NBER OF KIDS |

Closing row: **HOUSEHOLD'S OVERALL NET INCOME** — `AUTO*` — *"this is the sum
of all entries within the income section"*.

### PART 3 - NOTIONAL SPEND BENCHMARKING

Charlotte: *"please display these calculation steps in a table like this one
below"*.

**Family type category selector** — "SELECT FAMILY STUCTURE" with options:
sole parent with 1 child · parents with 1 child · parents with 2 children ·
parents with 3 children · parents with 4 children · parents with 5 children
or more. Then: **FAMILY CATEGORY** — AUTO FILLED NUMBER — *"'autofill' here
as taken from the original manual selection in part 1"*.

| Block | Row | Fill mode |
|---|---|---|
| NOTIONAL ACCOMMODATION SPEND | DEDUCT NOTIONAL RENT | AUTO FILLED NUMBER |
| IF THE FAMILY HOME IS MORTGAGE FREE/ or LIVING RENT FREE, ADD FULL NOTIONAL BACK IN - or if FAMILY HAS A LOWER RENT, ADD 25% BACK IN OF THE NOTIONAL RENT | ADD BACK IN NOTIONAL RENT APPLIED | manual fill |
| IF HOUSEHOLD OWNS AT LEAST TWO PROPERTIES AND EITHER 1- PROPERTY INCOME IS NOT MAIN INCOME OR 2- EVIDENCE OF STABLE (PAYE OVER S-E) MEDIUM TO HIGH OR HIGH INCOME 3- CASH DRAWDOWN NOT SOLELY TO DEBT CONSOLIDATE | ADD BACK NOTIONAL RENT | manual fill |
| COUNCIL TAX NOTIONAL | DEDUCT ANNUAL COUNCIL TAX | AUTO FILLED NUMBER |
| IF HOUSEHOLD RECEIVES FULL COUNCIL TAX SUPPORT | ADD BACK IN COUNCIL TAX NOTIONAL | manual fill |
| NOTIONAL ESSENTIALS SPEND | DEDUCT NOTIONAL ESSENTIALS | AUTO FILLED NUMBER |
| NOTIONAL TRANSPORTATION SPEND — CAR USE | DOES THE FAMILY USE A CAR? | manual fill |
| | IF YES, DEDUCT NOTIONAL CAR SPEND | AUTO FILLED NUMBER |
| NOTIONAL TRANSPORTATION SPEND — PUBLIC TRANSPORT USE | DOES THE FAMILY USE PUBLIC TRANSPORT? | manual fill |
| | IF YES, DEDUCT NOTIONAL PUBLIC TRANSPORT SPEND | AUTO FILLED NUMBER |
| NOTIONAL JWF BURSARY RECIPIENT ALLOWANCE | DEDUCT NOTIONAL JWF BURSARY RECIPIENT ALLOWANCE | AUTO FILLED NUMBER |
| NOTIONAL SAVINGS ADJUSTMENT | DISPLAY ONLY - ENTER TOTAL CASH HELD | manual fill |
| | DISPLAY ONLY - ENTER TOTAL SAVINGS | manual fill |
| | DISPLAY ONLY - TOTAL CASH & SAVINGS | AUTO TOTAL (sum of the two above) |
| | TOTAL NUMBER OF CHILDREN OF SCHOOL AGE | AUTO FILLED NUMBER (*"from the manual entry entered in part 1"*) |
| | NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT | AUTO FILLED NUMBER (*"from the manual entry entered in part 1"*) |
| | DISPLAY ONLY - ADJUSTED SAVINGS TOTAL | AUTO CALCULATION |
| | DEDUCT NOTIONAL SAVINGS | AUTO FILLED NUMBER |
| | DISPLAY ONLY - SAVINGS CUSHION ALLOWANCE | AUTO FILLED NUMBER |
| | DISPLAY ONLY - SAVINGS TEST NUMBER | AUTO FILLED NUMBER |
| | IF SAVINGS TEST NUMBER IS POSITIVE, ADD IT IN | AUTO FILLED NUMBER |
| NOTIONAL SCHOOL FEES INSURANCE | IF THE APPLICANT HAS INSURED SCHOOL FEES PAYMENT, ADD YEARLY INSURED TOTAL BACK IN | manual fill |
| — | TOTAL DEDUCTED NOTIONAL SPEND | AUTO |
| (HNDI after NS) | HOUSEHOLD'S NET DISPOSABLE INCOME AFTER NOTIONAL SPEND | AUTO |
| HOUSEHOLD'S INCOME CATEGORY | HOUSEHOLD'S INCOME CATEGORY IS: | AUTO FILLED NUMBER |

### PART 4 - HOUSEHOLD'S ASSETS CATEGORIES

**Property asset structure selector** — options: NO PROPERTY, RENTING ·
SINGLE PROPERTY - FAMILY HOME · TWO PROPERTY PORTFOLIO · MULTIPLE PROPERTY
PORTFOLIO.

| Row | Fill mode |
|---|---|
| DISPLAY ONLY - TOTAL FAMILY HOME MARKET VALUE | manual fill |
| DISPLAY ONLY - TOTAL FAMILY HOME MORTGAGE BALANCE | manual fill |
| DISPLAY ONLY - TOTAL SECOND PROPERTY MARKET VALUE | manual fill |
| DISPLAY ONLY - TOTAL SECOND PROPERTY MORTGAGE BALANCE | manual fill |
| DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MARKET VALUE | manual fill |
| DISPLAY ONLY - TOTAL OTHER PROPERTY (IES) MORTGAGE BALANCE | manual fill |
| DISPLAY ONLY - HOUSEHOLD'S TOTAL PROPERTY VALUE | AUTO FILLED NUMBER |
| DISPLAY ONLY - HOUSEHOLD'S EQUITY ON FAMILY HOME | AUTO FILLED NUMBER |
| DISPLAY ONLY - HOUSEHOLD'S EQUITY ON SECOND PROPERTY | AUTO FILLED NUMBER |
| DISPLAY ONLY - HOUSEHOLD'S EQUITY ON OTHER PROPERTIES | AUTO FILLED NUMBER |
| HOUSEHOLD'S PROPERTY CATEGORY IS: | AUTO FILLED NUMBER |
| HOUSEHOLD'S TOTAL EQUITY HELD ON PROPERTY ASSETS | AUTO FILLED NUMBER |
| HOUSEHOLD'S PROPERTY EQUITY CATEGORY IS: | AUTO FILLED NUMBER |
| HOUSEHOLD'S TOTAL EQUITY HELD ON FINANCIAL ASSETS | AUTO FILLED NUMBER |
| HOUSEHOLD'S FINANCIAL EQUITY CATEGORY IS: | AUTO FILLED NUMBER |

### "PART 5 - HOUSEHOLD'S PERSONAL DEBT (NON-PROPERTY)" — on the model sheet

> ⚠️ Numbering quirk: this block is labelled "PART 5" but lives on the
> **ASSESSMENT MODEL (1-4)** sheet, while the award sheet is *also* "PART 5".
> Locked assumption **LA-6**: this block renders on the Assessment Model tab
> as the continuation of part 4; "(5)" in the tab name refers to the award
> sheet.

| Row | Fill mode |
|---|---|
| DISPLAY ONLY - ENTER TOTAL CREDIT CARD DEBT | manual fill |
| DISPLAY ONLY - ENTER TOTAL LOAN BALANCES | manual fill |
| DISPLAY ONLY - ENTER TOTAL OWED LEASE BALANCES | manual fill |
| DISPLAY ONLY - ENTER OWED OTHER SCHOOL FEES BALANCES OR OTHER DEBT | manual fill |
| NUMBER OF SCHOOL YEARS LEFT FOR THE BURSARY RECIPIENT | manual fill |
| DISPLAY ONLY - DERIVED YEARLY DEBT REPAYMENTS | AUTO FILLED NUMBER |
| YEARLY DEBT EXPOSURE (NETTED OFF YEARLY SAVINGS) | AUTO FILLED NUMBER |
| DEBT OVER NET DISPOSABLE INCOME RATIO | AUTO FILLED NUMBER |
| Minimum Debt Repayment Duration in months without school fees payments | AUTO FILLED NUMBER |
| DEBT STATUS | AUTO FILLED TEXT |
| DEBT SITUATION WITH THE FOUNDATION — DISPLAY ONLY - IS THE FAMILY BEHIND WITH THEIR SCHOOL FEES PAYMENTS? | MANUAL FILL YES/NO |

**LIFESTYLE SQUEEZE AFFORDABILITY RATIO** block:

| Row | Fill mode |
|---|---|
| CALCULATING NDI over NET INCOME % | AUTO FILLED NUMBER % |
| CALCULATING (NDI after YEARLY DEBT EXPOSURE) over NET INCOME) LIFESTYLE RATIO % | AUTO FILLED NUMBER % |
| SCHOOL FEES USE BENCHMARKING | AUTO FILLED NUMBER |
| LIFESTYLE SQUEEZE AFFORDABILITY RATIO | AUTO FILLED NUMBER % |
| LIFESTYLE SQUEEZE AFFORDABILITY STATUS | AUTO FILLED TEXT |

---

## Sheet 2 — BURSARY AWARD (5)

### PART 5 - BURSARY AWARD CALCULATION

Header block: *CALCULATING BURSARY AWARD FOR* — AUTO FILLED TEXT (name on
application) · school — SELECT WHITGIFT OR TRINITY / AUTO SELECTION.

**SILBINGS' FEES ALREADY AT A JWF SCHOOL** *(sic)* — column headings:
"SELECT WHITGIFT OR TRINITY" · "NET PAYABLE FEES":

| Row | Fill mode |
|---|---|
| ENTER CHILD NAME 1 - MANUAL | school select + MANUAL FILL fees |
| ENTER CHILD NAME 2 - MANUAL | school select + MANUAL FILL fees |
| ENTER CHILD NAME 3 - MANUAL | school select + MANUAL FILL fees |

| Row | Fill mode |
|---|---|
| ANNUAL SCHOOL FEES | AUTO FILLED NUMBER |
| SIBLINGS' NET PAYABLE FEES | AUTO FILLED NUMBER |
| ACTUAL NET REMAINING DISPOSABLE INCOME | AUTO FILLED NUMBER |
| THEORETICAL BENCHMARKING DISPOSABLE INCOME | AUTO FILLED NUMBER |
| AFFORDABILITY ADJUSTED DISPOSABLE INCOME | MANUAL FILL |
| RECOMMENDED YEARLY PAYABLE FEES - FUTURE YEAR | MANUAL FILL |
| SCHOOL FEES NEXT YEAR | AUTO FILLED NUMBER |
| % SCHOLARSHIP | MANUAL FILL % |

**BURSARY AWARD SUMMARY:**

| Row | Fill mode |
|---|---|
| SCHOLARSHIP VALUE (after VAT) | MANUAL FILL |
| BURSARY AWARD VALUE (after VAT) | MANUAL FILL |
| PAYABLE SCHOOL FEES NEXT YEAR | MANUAL FILL |
| ACADEMIC YEAR | AUTO FILLED NUMBER |
| School's bursary spend for this pupil (before VAT) | AUTO FILLED NUMBER |

**Reconciliation block:**

| Row | Fill mode |
|---|---|
| GAP FROM REC PF TO CONFIRM PF: | (computed gap) |
| REASONS FOR GAP | MULTIPLE CHOICE BOX (9-code list, below) |
| LAST ASSESSMENT'S PAYABLE FEES | MANUAL FILL |
| REASONS FOR YEAR ON YEAR CHANGE: | MULTIPLE CHOICE BOX (36-code list, below) |
| ASSESSMENT COMPLETED ON: | dd/mm/yyyy |

---

## Sheet 3 — ASSESSMENT ADMIN

Layout blocks, top to bottom:

**Account Synopsis*** — free text, alongside: Bursary recipient's Name ·
Bursary Reference · Bursary recipient's School · Fees Account Code.
Her example: *"Married couple with 3 kids. Mr is an employed architect. Mrs
is a part-time teaching assistant. They rent their accommodation in the CR0
post code area. They qualify for CHB for 2 kids (their eldest is at Uni).
They have a large loan weighing on their finances. Some saving capacity. Mr
lost his job last year."*

**Assessor's wizard - Things to look out for with this family*** — free
text, alongside: Bursary recipient's siblings · Bursary Reference · siblings'
school · Fees Account Code. Her example: *"Mrs works for two schools- check
that she attaches two P60s. They have Lloyds savings bank account that they
had not attached originally (account no ****4555)"*.

> Note: "Fees Account Code" appears as a display column here. Epic 13
> D13-1a **removed** `BursaryAccount.feesAccountCode`; the fees-system
> identity now lives in the editable `Application.reference`. Render the
> reference; do not resurrect the dropped column.

**Year-on-year history table** — columns: Assessment Year · HOUSEHOLD'S
OVERALL NET INCOME · Total Savings · Total Property Equity · Total Yearly
Debt Exposure · Yr on Yr Change In Overall Net Incme *(sic)* · Yr on Yr
Change In Total Savings · Yr on Yr Change In Property Equity · Yr on Yr
Change In Yearly Debt Exposure · Living arrangement · Lifestyle Squeeze
Ratio. Change columns are simple deltas vs the prior row. Her example rows:

| Year | Net income | Savings | Prop. equity | Debt exposure | ΔIncome | ΔSavings | ΔEquity | ΔDebt | Living | Squeeze |
|---|---|---|---|---|---|---|---|---|---|---|
| 2023/24 | 62150 | 8400 | 0 | 5400 | n/a | n/a | n/a | n/a | n/a | n/a |
| 2024/25 | 40200 | 0 | 0 | 8700 | -21950 | -8400 | 0 | 3300 | rent | IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE |
| 2025/26 … 2030/31 | (empty forward rows) | | | | | | | | | |

**Payable-fees schedule table** — columns: Academic Year · Year on Year
Assessment Comments re Payable Fees Change* (reason codes) · Payable fees ·
Payable fees - Year on Year change · School Year · App to be submitted by ·
Application Status · Assessment Status · Bursary Status. Example rows:

| Year | Comments (codes) | Payable | Δ | School yr | Submit by | App status | Assessment status | Bursary status |
|---|---|---|---|---|---|---|---|---|
| 2024/25 | 1 - No year on year comparison, first assessment | 11500 | n/a | Year 6 | (date) | Received | Completed | Active |
| 2025/26 | 8- Sudden unemployment; 11 - Increase in Benefits; 36- Reduced savings | 2500 | -9000 | Year 7 | (date) | Received | Completed | Active |
| 2026/27 → 2031/32 | | | | Year 8 → Year 13 | (dates) | Scheduled | Not started | Active |

*(The "Submit by" cells hold Excel date serials 45435–47991 ≈ late-May dates
each year — consistent with the RA 22 May submission deadline.)*

### REASONS FOR YEAR ON YEAR CHANGE — multi-selection (36 codes)

1 - No year on year comparison, first assessment · 2 - No real change ·
3 - Additional family member since last year · 4 - One of their children has
left school since last year · 5 - Divorce or separation · 6 - Bereavement ·
7 - Illness · 8 - Sudden unemployment · 9 - Self-employed net profit
increase/decrease · 10 - Bonus change year on year · 11 - Increase in
Benefits · 12 - Salary increase · 13 - New job and decreased pay · 14 - New
job and increased pay · 15 - Increased savings · 16 - Inheritance · 17 -
Early Pension drawing · 18 - More Profitable or New Investments · 19 -
Additional income not disclosed last year · 20 - Stopped work to study ·
21 - Became a student · 22 - Mortgage now fully paid · 23 - New property
asset acquired · 24 - Property asset has increased in value · 25 -
Additional asset not disclosed last year · 26 - Re-mortgage agreement ·
27 - Change in accommodation arrangements · 28 - Failure to meet the
deadline · 29 - Out of date documents used last year · 30 - Forged or
tampered with documents · 31 - Failure to provide required documents ·
32 - Other · 33 - Error made by previous assessor · 34 - Reduced Payable
fees due to scholarship offer · 35 - Internal Bursary request originally ·
36 - Reduced savings

### REASONS FOR GAP — multi-selection (9 codes; her numbering repeats 5)

1 - Out of sync due to scholarship applied on place offer · 2 - Original Old
Assessment Benchmark (2020) · 3 - Pastoral Exceptional Leniency - Social
Services · 4 - Pastoral Exceptional Leniency - Fostering · 5 - Pastoral
Exceptional Leniency - Homed Boarder · 5 - Out of sync due to new
scholarship offered mid cursus *(duplicate "5" in source — renumber 5/6 and
confirm with Charlotte)* · 6 - Internal Bursary Bias - Bereavement · 7 -
Internal Bursary Bias - Severe Illness · 8 - Affordability Adjusted
Calculation Preferred · 9 - Theoretical Benchmark Calculation Preferred
