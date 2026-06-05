---
title: Application form scoping — markdown transcription of the workbook
status: reference
area: source-material
opened: 2026-06-05
note: >
  Faithful transcription of "New Bursary - Application Form.xlsx" (11 sheets)
  so engineering can work without opening Excel. The .xlsx remains the
  authoritative original; this captures structure, branch logic, and document
  uploads. Display copy (FAQs / guidance) is summarised — see the workbook for
  verbatim wording. Tax-year / date references in the workbook are hard-coded to
  2025-26; in the build these MUST be derived from the round (Decision D5).
---

# Application form — scoping transcription

## Front page — section map

The form presents these sections in the left nav. "Application Form Status –
Pre Submission" is the header state.

1. **Section 1 – How to Apply** (guidance + FAQs)
2. **Section 2 – Checklist**
3. **Section 3 – Details of Child**
4. **Section 4 – Parental / Guardian Details**
5. **Section 5 – Other Information Required**
6. **Section 6 – Parents' Income**
7. **Section 6 – Parents' Assets & Liabilities** *(workbook numbers both "6")*
8. **Section 7 – Additional Information**
9. **Section 8 – Declaration** (tick to confirm understanding of T&Cs by each parent)
10. **Section 8 – Validation Summary** (shows what still needs completing)

Navigation uses **Previous / Next / Save and Close** buttons that validate each
tab. Footer note: *"The form should be completed and submitted within the
deadline mentioned in the email. Forms submitted late will not be assessed."*

---

## Section 1 — How to Apply (guidance + FAQ)

Display content (summarised; verbatim in workbook). Intro explains the portal
calculates the actual bursary award, asks for documents that must be legible,
"where a value is required but not relevant, enter 0", and gives the bursaries
contact `fees@johnwhitgiftfoundation.org`.

**FAQ topics** (each has a full answer in the workbook):
- Bursary vs scholarship difference
- Eligibility & amount; bursaries Y6+ at Whitgift & Trinity; not for Whitgift boarders
- Scholarship eligibility (income-independent, up to 50% off fees)
- Can apply for both bursary & scholarship
- How many new bursaries awarded each year (~600 registrations, ~⅓ invited)
- When you find out (new applicants hear at school's place-offer day; re-assessments ~7 June)
- Divorced / separated / single / widowed / foster / remarried / mid-divorce scenarios (long; see §9 of the programme — **complex household**)
- Applying at more than one Foundation school (one application covers both; **one application per child** — twins need two)
- Help available; how long a bursary lasts (duration of schooling, annual re-assessment)
- Changed circumstances; more than one child; extras/allowance (lunches/uniform/trips); payment (termly invoice or monthly DD); what if you can't pay

**Guidance notes** cover: residency & Indefinite Leave to Remain evidence;
who may complete the form (natural parents / resident parent + partner /
guardian); dependent-children allowance; school-fee court orders & insurance
policies; income/assets/liabilities evidence (P60, SA302, benefits letters,
property, business accounts); declaration must be ticked by both parents.

---

## Section 2 — Checklist

Checklist notes: how to upload (scans / clear phone photos; bank statements as
PDF, not page-by-page photos); status check after submission; questions by
email only in Apr/May; accuracy responsibility; provide everything or risk
rejection.

**Checklist items** (each maps to required documents):
- **Personal/family identity** — birth certificate (named child), British
  passports per family member (expired OK; young child → birth certificate),
  or VISA with ILR / EU Settled Status. *Only required on the FIRST application*
  (rolling-over re-assessments skip identity).
- Divorced/widowed evidence (decree nisi/absolute, death certificate); elderly
  dependants care-home invoices.
- **What you earn (both parents)** — P60; most recent / latest-March payslip;
  benefits letters; self-employed SA302 + business accounts.
- **Property** — mortgage statements (every property), tenancy agreement,
  council-tax bill.
- **Other assets** — car insurance certificate(s).
- **Other (all)** — last 3 months' detailed PDF bank statements (all accounts,
  both parents, businesses); credit-card/loan statements; investments; court
  orders re fees; child maintenance; debt with another school; school-fee
  insurance; redundancy (P45 + letter); P45 if not currently working.
- **Additional Information** tab for any other context + supporting docs.

---

## Section 3 — Details of Child *(all questions mandatory)*

- **Q1 School applying for** — select Trinity **or** Whitgift (type-ahead).
  *(Build: set & lock at admin invite — Decision D1.)*
- **Q2 Applying to another school?** No → Q3; Yes → free-text school name.
- **Q3** Child's full name. **Q4** Date of birth. **Q5** Place of birth.
- **Q6 Birth certificate** — mandatory upload (must include parents' names &
  places of birth).
- **Q7 Child's current address** — "same as Parent/Guardian 1?" Yes → show
  Parent 1's stored address (editable only in "Manage My Details"); No → blank
  correspondence-address template (Line 1/2, City, Post code, Country).
- **Q8** School currently attended. **Q9** Start date at current school.
- **Q10 Identification for all family members** — repeatable "add family
  member": British citizen? Yes → upload UK passport; No → upload passport **and**
  Evidence of Indefinite Leave to Remain. Repeat for as many members as needed
  (includes dependent children & dependent elderly).

---

## Section 4 — Parental / Guardian Details *(all mandatory)*

- **Q1 Applying as sole parent/guardian?** If No, a second parent/guardian
  section opens below with the same questions.
- **Q2 Marital status** (informative tick): Single / Married / Widowed /
  Separated / Divorced / Civil Partnership / Cohabiting.
- **Q3 Parent/Guardian 1** — Full name, Mobile, Email, Address (Line 1/2, City,
  Post code). *(Telephone & email mandatory — meeting-findings.)*
- **Q4 Details of P/G 1 — employment status** (mutually exclusive):
  1. **Unemployed or Retired** → "Left employment in last 12 months?" Yes →
     upload P45 **and** "Received a redundancy/severance package?" Yes → upload
     evidence.
  2. **Employed** → profession/trade (free text); employer name/address (free
     text, max 1000 words); "Director of this company?" Yes → state % of each
     share class; "Left employment in last 12 months?" Yes → upload P45 +
     redundancy branch.
  3. **Self-employed** → profession/trade; company name; position (Director /
     Partner / Sole Trader); "Left employment & set up new business / became
     director in last 12 months?" Yes → P45 + redundancy branch.
- **Q5 Declaration of P/G 1** — compulsory tick (truthful, full statement of
  income; false info → disqualification, full fees payable).
- **Q6 Parent/Guardian 2** — same contact block as Q3 (only if not sole parent).
- **Q7 Details of P/G 2** — same employment branches as Q4.
- **Q8 Declaration of P/G 2** — compulsory tick.
- **Q9 Dependent children** — "How many children still living at your address or
  financially dependent (e.g. at university)?" (number).
- **Q10 Dependent children at a JWF school** — for the named child + any others:
  is this the named child (auto-populated) or another dependent child (first/
  surname/DOB/Trinity-or-Whitgift); repeatable for 2–3 children.
- **Q11 Dependent children at other schools** — first/surname/DOB/school name/
  school post code; "outstanding debt with this school?" Yes → upload recent
  statement showing balance. Repeatable.
- **Q12 Dependent elderly at home?** Yes → how many.
- **Q13 Dependent elderly in care home?** *(mandatory)* Yes → how many + per
  elder: first/surname/DOB/care-home name/yearly fees/latest invoice upload.

---

## Section 5 — Other Information Required *(all mandatory)*

- **Q1 Court orders** — "Court order for payment of school fees?" Yes → amount
  for the school year + which school year + which amount + upload evidence.
- **Q2 Child maintenance** (amicable or court-ordered) — "Who pays maintenance
  to the other parent?" You → "Are you divorced?" Yes → upload decree absolute;
  Separated → confirm the mutual agreement (free text). Your ex-partner → end.
- **Q3 Insurance policies** — "Any insurance policy specifically to pay fees?"
  Yes → amount for the school year + which year + upload evidence.
- **Q4 Outstanding school fees** — "Owe fees at any other school?" Yes → name of
  school + amount owed.

---

## Section 6 — Parents' Income

Per-parent columns (P/G 1 and P/G 2). All sub-sections shown regardless of the
employment status picked. **If a section has a value other than £0, its upload
is mandatory — except Child Benefits.** Header: *"GROSS INCOME (before tax) from
all sources for the financial year ended 4 April **YYYY**"* (derive YYYY from
round — D5). "Where not applicable, enter 0."

**Employed:** Gross earned income / annual salary (PAYE, as on P60) → upload P60
(dated April YYYY) **and** March YYYY payslip (≥1 mandatory of the two).

**Self-employed (SA302):** gross salaried income; property income; dividends;
additional other interest/investment income (share-dealing profit, equity
release, inheritance) → upload SA302 (tax year YYYY-1/YYYY; prior year if FY-end
Apr–Sep).

**On benefits** (totals Apr–Mar):
- Universal Credit (excl. childcare) → upload UC 12-month statement **and** 3
  separate detailed monthly UC payment docs.
- Housing Benefit (if not in UC) → upload award letter.
- Child Benefit → number (upload **non-mandatory**).
- Child/Working Tax Credit; EESA; Disability Allowance or PIP; Carer's
  Allowance; Childcare Support; Other → upload other-benefits docs.

**If unemployed / in between roles (last 12 months):** Final gross pay (P45) →
upload P45; Redundancy/severance → upload redundancy letter; JSA → upload award
letter; Student grant/support → upload letter; Parental/Adoption/Sickness leave
pay → upload status-change doc.

**If retired:** State Pension; Private Pension & Other Plan → upload pension docs.

**If divorced or separated:** Child Maintenance Allowance received → upload
letter; explain shared-custody arrangement (free text).

**Third-party support (friends/family/other):** Additional Income Support
received; explain who/how regularly/how long (free text).

Each parent's column ends with a **TOTAL (£)** = sum of all numeric cells, and a
compulsory **"I confirm all documents on this page are correct and legible"**
tick.

---

## Section 6/7 — Parents' Assets & Liabilities *(all mandatory)*

**Property:**
- **Q1 Own or rent the family home?**
  - **Own** → approximate market value (£, non-zero required); "Mortgage on
    family home?" Yes → balance due + monthly repayment + upload latest mortgage
    statement; No → paid off.
  - **Rent** → which arrangement (pick 1 of 4, mutually exclusive): private
    tenants (monthly £) / council tenants (monthly £) → upload tenancy agreement;
    council, no rent → upload council full-Housing-Benefit letter; living with
    relatives, no rent but contribute to bills → upload relative's letter.
- **Q2 Other properties beyond the family home?** Yes → repeatable "add
  property": Address Line 1, Post code, current market value, current mortgage
  balance, monthly mortgage repayment, used as rental? (Y/N), upload latest
  mortgage statement. *(Currently a STUB in the build.)*
- **Q3 Charging order against any owned property?** Yes → address + value of the
  charging order.
- **Q4 Council Tax letter** (for the tax year, property you reside in) —
  mandatory upload.

**Car & home contents:**
- **Q5 Own a car / cars?** Yes → approximate market value; or Lease → monthly
  lease charge + upload lease agreement (upload not mandatory).
- **Q6 Use public transport regularly?** Yes → household monthly transport spend.
- **Q7** Value of other possessions incl. home contents (£).
- **Q8** Approximate value of any other non-financial assets (£).

**Financial assets & debt:**
- **Q9** Total cash balance at all banks / elsewhere (£).
- **Q10** Approximate value of investments (shares, PEPs, ISAs) (£).
- **Q11 Bank account statements** — per parent: Current accounts → upload last 3
  months' detailed statements (≥1 mandatory); Savings accounts → same;
  Investment portfolios "own stocks or bonds?" Yes → upload latest portfolio
  value docs. *(P/G 2 block only when not sole parent.)*
- **Q12 Personal debt (excl. mortgages)?** Yes → total credit-card balance +
  upload statements; total overdraft(s); total loan balances owed to credit
  agencies + upload loan statements; total loans owed to friends/family; total
  school-fee balances owed to children's schools; upload any other debt docs.

Section ends with a compulsory legibility tick.

---

## Section 7 — Additional Information

- Shows the list of currently-uploaded documents (file names).
- **Mandatory** free-text field for any other contextual information relevant to
  the assessment (at least one character to proceed), plus an upload area for
  documents not covered by the checklist (e.g. adverse news, health, separation,
  pastoral situations).

---

## Section 8 — Declaration

Closing declaration (verbatim in workbook). Confirms the information is a
complete & accurate declaration of income and assets; a JWF bursary is a
discretionary grant; and the terms apply between the applicant, the Foundation,
and the School. Six numbered terms cover: termly fee credit while the award is
in effect; annual review & declaration; previous years not re-reviewed; notify
material changes immediately; withdrawal/reduction triggers (Parent Contract
breach, requested info not provided, debt balance carried between terms, positive
material change); withdrawal if false information was provided.

Tick boxes: **on behalf of First Parent/Guardian 1** (compulsory) and **on
behalf of Parent/Guardian 2** (compulsory). *(Replace current single-tick — see
Decision D11 for final wording.)*

---

## Section 8 — Validation Summary

A helper screen listing, per section, the outstanding mandatory items, each a
link to the relevant page. Examples from the workbook: "Child's full birth
certificate is a mandatory field — please upload a valid document"; "Please
select as appropriate: is required"; "Parent/Guardian 1 – Property Income answer
is not filled in"; "I confirm all documents… is required"; "additional
contextual information is required". After fixing, the applicant returns to the
Validation Summary to see remaining items, then submits.
