# Charlotte Perrier — feedback, 20 Aug 2026

Catalogue of the 8 emails received from Charlotte (charlotteperrier@johnwhitgiftfoundation.org) on Thursday 20 Aug 2026. Captured for analysis/triage — **no replies sent yet**. Gmail links open under the `brian@meridiantech.group` account.

Item IDs (`CI-*`) continue the series: `CF-*` = 13 Aug batch ([2026-08-13-charlotte-feedback.md](2026-08-13-charlotte-feedback.md)), `CG-*` = 16 Aug batch ([epic-14-uat-round-2.md](../backlog/uat-aug-2026/epic-14-uat-round-2.md)), `CH-*` = 17 Aug batch ([2026-08-17-charlotte-feedback.md](2026-08-17-charlotte-feedback.md)).

**This email completes the CH batch**: E8 below is the promised feedback on Parts 4–5 and the Bursary Award Calculation tab (6). The CH-01…25 items and today's CI items should be **triaged as one set**. Charlotte also re-sent the full CH-01…25 email today asking for a delivery timeline (E1) — she is explicitly waiting on a plan.

> 🚨 **Go-live signal (E7).** Charlotte has three real internal bursary requests and wants accounts set up + invitations sent **Friday 21 Aug**, parent submission deadline **Thursday 27 Aug**. That makes the Part 6 error (CI-11) and the parent password-reset loop (CI-01) the critical path. She has offered a call and has an offline fallback for the assessments, so the parent-facing path is the hard deadline; the assessment model has ~1 week of slack.

Not catalogued here: the two 18 Aug messages on the `PO114282` invoice thread (commercial, not product) — Brian to reissue the 2026-27 invoice dated in August without the "due 30/09/2026" line.

---

## E1 — 13:21 · RE: Testing the assessment model (re-send)

- **Message ID**: `1a01f55bba7424a5` · [open message](https://mail.google.com/mail/u/0/#all/1a01f55bba7424a5) · [thread](https://mail.google.com/mail/u/0/#all/1a00a4e5911c9fcd) (thread `1a00a4e5911c9fcd`)
- Re-sends the full 17 Aug CH-01…25 email verbatim with: *"Please let me know when the changes below can be made."* No new items — a **timeline request** for the CH batch.

## E2 — 13:27 · RE: Testing the assessment model

- **Message ID**: `1a01f5b811d26ffe` · [open message](https://mail.google.com/mail/u/0/#all/1a01f5b811d26ffe)
- *"Oh yes, fair point. 😊"* — acknowledgment of Brian's reply. No action items.

## E3 — 13:33 · RE: Rounds & applications

- **Message ID**: `1a01f60208e92d77` · [open message](https://mail.google.com/mail/u/0/#all/1a01f60208e92d77) · [thread](https://mail.google.com/mail/u/0/#all/1a009b95bcb3ccd2) (thread `1a009b95bcb3ccd2`)
- ✅ **Verified**: the rounds/applications behaviour is confirmed — *"I can see them, this is exactly the required logic."* 📷 image001

| ID | Type | Item |
|---|---|---|
| CI-01 | Bug 🚨 | **Parent password reset loops back to login.** Resetting the password for `test3@johnwhitgiftfoundation.org` redirects her to the credentials screen instead of a set-new-password window. 📷 image002. Parent-facing — must work before the 21 Aug invitations (E7). |

## E4 — 13:40 · RE: Invitation emails

- **Message ID**: `1a01f66b2fd99154` · [open message](https://mail.google.com/mail/u/0/#all/1a01f66b2fd99154) · [thread](https://mail.google.com/mail/u/0/#all/1a00a63c8286ccab) (thread `1a00a63c8286ccab`)
- ✅ **Verified**: the updated contact page situation-picker works. 📷 image001

| ID | Type | Item |
|---|---|---|
| CI-02 | Feature request | **Sent-email visibility**: where does she go to see sent emails? Proposes an admin tab acting as the **Bursary Department inbox** — received emails and sent items in one place. |
| CI-03 | Question / config | **Where do parents' replies to automated emails go?** Can they be routed to `fees@johnwhitgiftfoundation.org`, or must they stay within the portal? (Repeats a question from another thread. Note: the fees@ reply-to fallback shipped in E14-B1/#318 is **production-only** — staging behaviour will differ from what she'll see live.) |
| CI-04 | Change request | **Create a contact without auto-generating the email.** She needs the option to add a contact and then send an ad-hoc email from her own Outlook — how would she do that? |
| CI-05 | Change request | **BCC support** on outgoing emails when required. |
| CI-06 | UX theme | The layout *"brings forward the underlying actions regarding the functionality when a lot of it should be hidden"* — she can't see the content that matters to her as the user. General surface-plumbing-less principle; overlaps CH-03/CH-06–08 (banner/labels tidy-up). |

## E5 — 13:41 · RE: Bursary application received — Levi Amoah

- **Message ID**: `1a01f67adb7d4c92` · [open message](https://mail.google.com/mail/u/0/#all/1a01f67adb7d4c92) · [thread](https://mail.google.com/mail/u/0/#all/1a009d4724d8b0ad)
- *"That's perfect, thanks."* No action items.

## E6 — 13:45 · RE: Request Missing Documents

- **Message ID**: `1a01f6b848df379f` · [open message](https://mail.google.com/mail/u/0/#all/1a01f6b848df379f) · [thread](https://mail.google.com/mail/u/0/#all/1a009e2ebb90dc14) (thread `1a009e2ebb90dc14`)
- The proposed missing-documents flow "sounds good", with two guardrails:

| ID | Type | Item |
|---|---|---|
| CI-07 | Change request | **One-shot upload window.** Once the parent has uploaded the requested missing documents (form back to 'submitted with all requested documents'), further parent uploads must be **blocked**. |
| CI-08 | Change request | **Scope the reopened window to uploads only.** While the missing-documents window is open, the parent must NOT be able to edit other sections of the form — rest of the form read-only to the parent but **still editable by the assessor** if needed. |

## E7 — 13:51 · Bursary applications FOR REAL :)

- **Message ID**: `1a01f71071b657af` · [open message](https://mail.google.com/mail/u/0/#all/1a01f71071b657af) (new thread)

| ID | Type | Item |
|---|---|---|
| CI-09 | Milestone / ops 🚨 | **First real applicants.** Three internal bursary requests received. Plan: set the three accounts up and send invitation emails **tomorrow (Fri 21 Aug)**; parent submission deadline **Thu 27 Aug**; assessment-model testing finished within that week. Fallback: she can run the assessments outside the system, "so no stress". If all three are awarded, their data is transferred post-assessment and they become the **first 3 active bursaries on the portal**. She asks *"What needs doing to ensure this happens?"* and offers a call. **Needs a reply + readiness checklist** (prod vs staging environment, real email sending, invitation windows/rounds, GDPR/live-data posture). |

## E8 — 15:03 · RE: Testing the assessment model — PARTS 4–6 (completes the CH batch)

- **Message ID**: `1a01fb2f04fbedcd` · [open message](https://mail.google.com/mail/u/0/#all/1a01fb2f04fbedcd) · [thread](https://mail.google.com/mail/u/0/#all/1a00a4e5911c9fcd) (thread `1a00a4e5911c9fcd`)
- Embeds screenshots `image023`–`image028`.

### PART 4 — Household's assets categories

✅ **Verified correct** — both flagged category calculations, including *"the financial assets have been netted off of the total debt balance"*. 📷 image023 / image024 / image026. No items.

### PART 5 — Household's personal debt (non-property)

✅ Section verified correct, one removal:

| ID | Type | Item |
|---|---|---|
| CI-10 | Change request | **Remove the flags block** from Part 5 — *"we will stop using the flags there"*. 📷 image025 — identify the exact block from the screenshot. |

### PART 6 — Bursary award calculation

| ID | Type | Item |
|---|---|---|
| CI-11 | Bug 🚨 blocker | **Part 6 throws an error message and she cannot complete the assessment.** 📷 image027 — pull the screenshot for the exact error. Blocks all formula testing downstream and the E7 go-live assessments. |
| CI-12 | Change request / spec | **Rebuild Part 6 as the natural continuation of Part 5 on the new tab**, laid out per the scoping document (she titles it "PART 5 — BURSARY AWARD CALCULATION" but it is tab 6 per CH-25). Full field list below. 📷 image028 |

Her field-by-field layout (label → fill mode):

| Field | Fill mode |
|---|---|
| CALCULATING BURSARY AWARD FOR | Auto-filled text (name on application) + SELECT WHITGIFT OR TRINITY (auto selection) |
| SIBLINGS' FEES ALREADY AT A JWF SCHOOL — NET PAYABLE FEES | — |
| ENTER CHILD NAME 1 / 2 / 3 | Manual, each with SELECT WHITGIFT OR TRINITY + manual fill |
| ANNUAL SCHOOL FEES | Auto-filled number |
| SIBLINGS' NET PAYABLE FEES | Auto-filled number |
| ACTUAL NET REMAINING DISPOSABLE INCOME | Auto-filled number |
| THEORETICAL BENCHMARKING DISPOSABLE INCOME | Auto-filled number |
| AFFORDABILITY ADJUSTED DISPOSABLE INCOME | Manual fill |
| RECOMMENDED YEARLY PAYABLE FEES — FUTURE YEAR | Manual fill |
| SCHOOL FEES NEXT YEAR | Auto-filled number |
| % SCHOLARSHIP | Manual fill (%) |
| **BURSARY AWARD SUMMARY** | |
| SCHOLARSHIP VALUE (after VAT) | Manual fill |
| BURSARY AWARD VALUE (after VAT) | Manual fill |
| PAYABLE SCHOOL FEES NEXT YEAR | Manual fill |
| ACADEMIC YEAR | Auto-filled |
| School's bursary spend for this pupil (before VAT) | Auto-filled number |
| **GAP FROM REC PF TO CONFIRM PF** | |
| REASONS FOR GAP | Multiple-choice box |
| LAST ASSESSMENT'S PAYABLE FEES | Manual fill |
| REASONS FOR YEAR ON YEAR CHANGE | Multiple-choice box |
| ASSESSMENT COMPLETED ON | dd/mm/yyyy |

*"Once this section has been added on, I will be able to pursue and complete the assessment and the testing of the formulas used."*

### Assessment admin tab — history scaffold

| ID | Type | Item |
|---|---|---|
| CI-13 | Change request | Replace **"no history"** on the assessment admin tab with the **empty infrastructure of the history tables**, so the shape of what's coming is visible at a glance. She supplies two example tables (below). |

Table 1 — per-assessment-year financial history: Assessment Year · Household's Overall Net Income · Total Savings · Total Property Equity · Total Yearly Debt Exposure · Yr-on-Yr change in each of those four · Living arrangement · **Lifestyle Squeeze Ratio** (example flag value: *"IMPORTANT LIFESTYLE SQUEEZE, WILL STRUGGLE"*). Rows 2023/24 → 2030/31; example: 2023/24 £62,150 / £8,400 / £0 / £5,400; 2024/25 £40,200 / £0 / £0 / £8,700 with deltas −£21,950 / −£8,400 / £0 / +£3,300, living arrangement "rent".

Table 2 — per-academic-year schedule: Academic Year · Year-on-Year Assessment Comments re Payable Fees Change (reason codes, e.g. *"8 - Sudden unemployment; 11 - Increase in Benefits; 36 - Reduced savings"*) · Payable fees · Payable fees Yr-on-Yr change · School Year · App to be submitted by · Application Status · Assessment Status · Bursary Status. Rows 2024/25 → 2031/32; example: 2024/25 £11,500.00, Year 6, due 23/05/2024, Received/Completed/Active; 2025/26 £2,500.00 (−£9,000.00), Year 7; later years Scheduled/Not started/Active out to Year 13.

---

## Cross-cutting themes for triage

1. **Go-live is now on the calendar** (CI-09): parent-facing path (invitations, portal login, password reset CI-01, submission, missing-docs windows CI-07/08) must be solid by **21 Aug**; assessment model (CH batch + CI-10…13) has until ~**27 Aug**. Decide the environment question (prod vs staging, real emails) before setup.
2. **Part 6 is the critical path** (CI-11 blocker + CI-12 rebuild): she cannot finish testing the formulas or complete any assessment until this lands — and it gates the CH-25 tab rename and the CH-24 sign-convention verification she plans to run with real data.
3. **Parts 4–5 calculations are signed off** — first verified-correct verdicts on the rebuilt model. The remaining model risk concentrates in Part 6.
4. **Comms surface is a growing gap** (CI-02…05 + her repeated reply-routing question): sent-items visibility, reply routing to fees@, ad-hoc/Outlook sends, BCC. Needs a deliberate design decision (in-portal outbox vs shared mailbox), not piecemeal fixes — and note the single-Resend-environment constraint (webhook/prod-only reply-to).
5. **Missing-docs window hardening** (CI-07/08) extends the just-shipped E14 request-missing-documents flow with lock semantics — same code area, do together.
6. **History scaffold** (CI-13) previews the rolling/multi-year data model (links CH-12 remaining-years matrix, CH-13 scholarship-at-rollover, CH-17 per-year fee history). Even as an empty shell it fixes the column contract — worth confirming headers with her before building.
7. **She is waiting on a timeline** (E1): the reply to E7 should include the CH+CI delivery plan, not just go-live logistics.
