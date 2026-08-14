# Charlotte Perrier — feedback & questions, 13 Aug 2026

Catalogue of the 7 emails received from Charlotte (charlotteperrier@johnwhitgiftfoundation.org, cc Alex Skrzynski) on Thursday 13 Aug 2026. Captured for analysis/triage — **no replies sent yet** (except E7, which Brian answered same day). Gmail links open under the `brian@meridiantech.group` account.

Item IDs (`CF-*`) are for triage reference only.

---

## E1 — 10:07 · RE: Assessment of WS-202627-0008

- **Message ID**: `19ffa97d1d03fc56` · [open message](https://mail.google.com/mail/u/0/#all/19ffa97d1d03fc56) · [thread](https://mail.google.com/mail/u/0/#all/19f4c3dbcb32ca24) (thread `19f4c3dbcb32ca24`)
- Context: assessing real-data application **WS-202627-0008**.

| ID | Type | Item |
|---|---|---|
| CF-01 | Bug | Assessment shows as **completed** but incorrect information seems to have been auto-entered (screenshot in email). |
| CF-02 | Change request | Wants an **EDIT button allowing her to edit any cells on the assessment page** — asked for it same-day so she can complete one full assessment. |
| CF-03 | Change request | **Remove the "qualifying" buttons** on the admin page — "the 'qualifying' aspect within the admin page doesn't work for our logic." (Note: relates to CP10 "Set Qualifies" from the calc-v2 work.) |

## E2 — 10:13 · RE: Assessment of WS-202627-0008

- **Message ID**: `19ffa9d08986b992` · [open message](https://mail.google.com/mail/u/0/#all/19ffa9d08986b992) · same thread `19f4c3dbcb32ca24`

| ID | Type | Item |
|---|---|---|
| CF-04 | Change request | **Application reference format**: needs the assessed child's name visible. Instead of `WS-202627-0009`, use: (1) school prefix — Whitgift `WS-`, Trinity `TS-`; (2) child's name as `Surname, Firstname`. Example: `TS-Skrzynski, Wolfgang`. |

## E3 — 10:27 · RE: Assessment of WS-202627-0008

- **Message ID**: `19ffaa9c6cf220f0` · [open message](https://mail.google.com/mail/u/0/#all/19ffaa9c6cf220f0) · same thread `19f4c3dbcb32ca24`
- This is a **business-rules specification** for two-parent assessments (answers a question Brian had asked on 18 Jul):

| ID | Type | Item |
|---|---|---|
| CF-05 | Business rule | **Together**: two parents applying on one application → assess the **combined household** position (income, savings, investments, debts of both). |
| CF-06 | Business rule | **Divorced/separated**: parent 1 is the main applicant (sole parent). Parent 2 provides only: contact, employment, income, current-account bank statements, council tax letter. |
| CF-07 | Business rule | Model calculates overall totals from **parent 1's data only**; the assessor **manually adjusts** income for what's relevant from parent 2 (hence the EDIT button, CF-02). Parent 2's assets are NOT considered (usually the maintenance-paying parent). |
| CF-08 | Business rule | **Family category follows parent 1**: e.g. divorced father with 1 child = sole-parent household. Savings/debts: only parent 1's data. Cars/transport: only parent 1's data. |
| CF-09 | Business rule | **New partners**: parent 2's new partner's income is not counted. Parent 1's new partner, if married to parent 1 or actively engaged in household spend, means the application **stops being a sole-parent application** (established by investigating parent 1's uploaded documents). |

## E4 — 10:35 · Assessment of TS-202627-0002

- **Message ID / Thread ID**: `19ffab125e22978b` · [open message](https://mail.google.com/mail/u/0/#all/19ffab125e22978b)
- Context: testing the assessment page with Alex's application (**TS-202627-0002**).

| ID | Type | Item |
|---|---|---|
| CF-10 | Change request | Pressing **COMPLETED locks the assessment**; assessor can no longer add/amend anything. Wants an **EDIT button to revert a completed assessment back to editable**, optionally with a separate "LOCKED ASSESSMENT" state if we prefer an explicit lock. Rationale: the real assessment journey has post-completion changes (e.g. admissions team offers a new scholarship after the original assessment is completed; the assessor must amend accordingly). "The assessment environment is too rigid right now." |

## E5 — 10:58 · Invitation email for a bursary application : submission deadline

- **Message ID / Thread ID**: `19ffac63225c97e4` · [open message](https://mail.google.com/mail/u/0/#all/19ffac63225c97e4)

| ID | Type | Item |
|---|---|---|
| CF-11 | Question | The applicant invitation email references a **submission deadline** — where is the deadline field editable in the system? |
| CF-12 | Change request | Wants **two deadline fields**: (1) one main deadline for all **rolling-over bursaries** (next April); (2) one **editable** deadline for all **new applications**. |

## E6 — 12:39 · RE: Application - applied testing feedback

- **Message ID**: `19ffb22dc6796f35` · [open message](https://mail.google.com/mail/u/0/#all/19ffb22dc6796f35) · [thread](https://mail.google.com/mail/u/0/#all/19f6bc803f005771) (thread `19f6bc803f005771`)
- Context: completing a fresh application with **real data** under `test3@john...`, re-testing the fixes Brian reported on 21 Jul. Longest email — mixes confirmations, bugs, and new requests.

### Confirmed fixed by her re-test
- Gender options ("Prefer not to say" removed) ✔
- Family Identification intro guidance rewording ✔
- Add-family-member pop-up (relationship + document type) ✔
- Dependent-children count validation ("has worked well") ✔
- Two-parent households auto-opening both sections/columns ✔
- Dependent elderly entry requirement ✔
- Assets & liabilities rewording + third car option ✔
- Declaration point 5 wording ✔

### Bugs

| ID | Item |
|---|---|
| CF-13 | **Sole-parent / remarried question logic is inverted**: ticking YES to "applying as a sole parent" does NOT show the remarried question; ticking certain statuses wrongly shows it. Her required matrix (rows = relationship status, columns = sole-parent YES/NO): Single Y+N, Widowed Y+N, Separated Y+N, Divorced Y+N → show question; Married, Civil Partnership, Cohabiting → show only when sole-parent = YES. Also **remove the auto-generated sentence** "if so we assess your current household together and capture the absent natural parent's contribution as maintenance." |
| CF-14 | **Birth certificate PDF upload fails with HTTP 413** (payload too large) even for 1-page PDFs; JPG passports upload fine. |
| CF-15 | **Kicked out of the application** by an error after completing the parent/guardian section. Question: is there a session timer? Applicants must not be kicked out. |
| CF-16 | **Data loss — parent/guardian page**: after logging back in, all entered data was gone; had to re-enter everything. |
| CF-17 | **Cohabiting status blocks progression**: validation error tied to "cohabiting", which for form purposes should behave the same as "married" (selecting "married" lets her through). |
| CF-18 | **Number-entry fix only applied to parent 1's fields** (select-0-on-focus / leading zeros) — parent 2's fields still broken. |
| CF-19 | **Data loss — income page**: navigating via the left-hand tab instead of "Save and continue" lost the fully-completed income section including 4 uploaded documents. |
| CF-20 | **Documents cannot be re-uploaded** after the loss — error message when retrying (screenshot). Why? |
| CF-21 | **Zero-income path blocked**: with £0.00 and all "no income in the assessed tax year" boxes ticked, form still won't progress to next page. |
| CF-22 | **Left-tab navigation kicks her out**; after re-login the next tab is suddenly accessible but the **income tab shows as disabled**. |
| CF-23 | **Summary — year of entry still NOT FIXED** (still shows wrong/–). Additionally: **Year of Entry should not be entered by the applicant at all**, and it is blocking validation of the "Details of the child" tab. |
| CF-24 | **Passport upload for a family member (child "Levi Amoah") not accepted** — left that tab unfinished; why? |
| CF-25 | **Submission error leaks internals**: attempting to submit with 2 invalid fields showed the user a full internal query/explanation. Error should simply say the form cannot be submitted. |
| CF-26 | Untestable for her yet: Summary — dependent children columns fix ("can't test as can't submit"). |

### Change requests

| ID | Item |
|---|---|
| CF-27 | **Remove the application-history section** from the applicant view entirely — applicants must not see everything they submitted (risk of "tailor-made" applications). Replace with a **one-time PDF download at the moment of submission**. |
| CF-28 | **Universal Credit uploads**: split into two sections — (1) UC statement, (2) **three separate entries** for different UC monthly payment calculations — so at least 4 distinct UC documents are required (currently a single upload satisfies validation). Also: **detect the same document uploaded multiple times**. |
| CF-29 | **Autosave**: their current (old) application form autosaves; requests autosave on this form to prevent CF-16/CF-19-style losses. |
| CF-30 | **Loan documents**: "Latest loan statement" must NOT say "optional"; add a new **compulsory "loan agreement" upload** section. |
| CF-31 | Add to the help/contact text: "please contact the bursary team by email at **fees@johnwhitgiftfoundation.org**" — to divert phone calls (no capacity for a call centre). |
| CF-32 | **Separate REVIEW and SUBMIT buttons**: current combined button is stressful; REVIEW should redirect to the review tab with no submission prompt, SUBMIT stands alone. |

### Her stated goal
Work through these points, then she will **submit this form and use it to test the assessment functionality** end-to-end.

## E7 — 12:45 · RE: A question for go-live (commercial, not system feedback)

- **Message ID**: `19ffb28575c9ca28` · [open message](https://mail.google.com/mail/u/0/#all/19ffb28575c9ca28) · [thread](https://mail.google.com/mail/u/0/#all/19f799b1c2253674) (thread `19f799b1c2253674`)

| ID | Type | Item |
|---|---|---|
| CF-33 | Commercial | Invoicing instructions for the £7,000 annual licence: (1) invoice July+August 2026 at a rate Brian sees fit (delay was on JWF's side), coded to JWF FY 2025-26 (FY ends 31 Aug), paid by end of August; (2) invoice 12 months of portal service + IT support for 2026-27, coded to FY 2026-27, paid in full in September. |

**Status: HANDLED** — Brian replied same day (13 Aug 22:55 UK) attaching invoice INV-018 for July/August pro-rata, and proposed a catch-up meeting next week to review the other emails' feedback.

---

## Cross-cutting themes for triage

1. **Assessment editability** is the loudest signal (CF-01, CF-02, CF-07, CF-10): completed assessments must be revertible/amendable, and assessors need manual cell-level adjustment (especially for divorced/separated parent-2 income add-ons).
2. **Form data loss / navigation** (CF-15, CF-16, CF-19, CF-22, CF-29): left-tab navigation loses unsaved work and can eject the user; autosave requested.
3. **Upload pipeline** (CF-14 [413], CF-20, CF-24, CF-28): PDF size/re-upload/acceptance failures plus new UC multi-document validation.
4. **Two-parent / sole-parent logic** (CF-05–CF-09, CF-13, CF-17): a full business-rules spec now exists in E3; the remarried-question matrix in E6 is its form-side counterpart.
5. **Reference & visibility** (CF-04, CF-27): human-readable references with child names; applicants see less, staff see more.
6. She is **blocked from submitting** (CF-23, CF-24, CF-25) — unblocking submission unblocks her end-to-end assessment test, which is the gating path to go-live.
