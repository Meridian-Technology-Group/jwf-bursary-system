# Charlotte Perrier — feedback, 17 Aug 2026

Catalogue of the 2 emails received from Charlotte (charlotteperrier@johnwhitgiftfoundation.org, cc Alex Skrzynski) on Monday 17 Aug 2026, both replies to Brian's 16 Aug evening responses (sent after the Epic 14 ship). Captured for analysis/triage — **no replies sent yet**. Gmail links open under the `brian@meridiantech.group` account.

Item IDs (`CH-*`) continue the series: `CF-*` = 13 Aug batch ([2026-08-13-charlotte-feedback.md](2026-08-13-charlotte-feedback.md)), `CG-*` = 16 Aug batch ([epic-14-uat-round-2.md](../backlog/uat-aug-2026/epic-14-uat-round-2.md)).

> ✅ **Batch now complete.** E2 covers the banner and Parts 1–3 only; the promised Parts 4–6 feedback landed on **20 Aug** and is catalogued as `CI-*` in [2026-08-20-charlotte-feedback.md](2026-08-20-charlotte-feedback.md) (E8), along with 7 further emails incl. a **go-live request for 21 Aug** (CI-09). Triage CH + CI as one set. On 20 Aug Charlotte re-sent this entire email asking for a delivery timeline.

---

## E1 — 19:47 · RE: Application - applied testing feedback

- **Message ID**: `1a011439b7e3c2a0` · [open message](https://mail.google.com/mail/u/0/#all/1a011439b7e3c2a0) · [thread](https://mail.google.com/mail/u/0/#all/19f6bc803f005771) (thread `19f6bc803f005771`)
- Acknowledgment only — thanks for the Epic 14 fixes (UC duplicate detection, upload progress bar, 60-min timer, download flow). **She will complete one full application one more time and report back.** No action items.

## E2 — 21:47 · RE: Testing the assessment model

- **Message ID**: `1a011b1a96a0f3b3` · [open message](https://mail.google.com/mail/u/0/#all/1a011b1a96a0f3b3) · [thread](https://mail.google.com/mail/u/0/#all/1a00a4e5911c9fcd) (thread `1a00a4e5911c9fcd`)
- Context: her first pass over the **rebuilt assessment workspace** (Epic 14 E-track). Tone is positive — new Assessments list appreciated, Part 2 "perfect", Part 3 "looks good" — but with one loud recurring principle: **nothing in the model may be prefilled from the application form; the assessor enters everything** (only the explicitly agreed autofill fields survive).
- The email embeds **22 screenshots** (`image001`–`image022`) pinpointing exact UI elements; a few items below are ambiguous from text alone and need the screenshot pulled before implementation (flagged 📷).

### Assessments list

| ID | Type | Item |
|---|---|---|
| CH-01 | Bug | Assessments list rows render with **mixed fonts** ("different fonts all over each row … looking a bit weird"). 📷 image002 |
| CH-02 | Question | Confirm the assessment environment for the recipient she picked reflects all the new changes. |

### Assessment page — banner & statuses

| ID | Type | Item |
|---|---|---|
| CH-03 | Change request | **Compress the three stacked header layers into a single tab-level row** at the top (her mock-up in the email). 📷 image004 (current) / image003 (wanted) |
| CH-04 | Question | What is the difference between the **blue MARK COMPLETE** button and the **green COMPLETE** button? |
| CH-05 | Change request | Replace the buttons with the **four possible assessment statuses**: **NOT STARTED** (default) → **PAUSED** (as soon as ≥1 entry saved) → **COMPLETE** (assessor confirms complete) → **LOCKED** (assessor validates the complete version as final). Only **one button green at a time**. 📷 image007. (Extends CF-10's revert/lock request into an explicit 4-state lifecycle.) |
| CH-06 | Change request | Hide the **"Actions > Review in progress"** labelling (redundant once CH-05 exists). |
| CH-07 | Change request | Middle of page: **remove the top line** now duplicated by the second line. 📷 image005 |
| CH-08 | Change request | **Remove a further block** from the assessment page. 📷 image008 — identify from screenshot |

### PART 1 — Bursary recipient & family details

| ID | Type | Item |
|---|---|---|
| CH-09 | Bug + change request | She was able to **send an invitation without the recipient's surname and first name** (legacy of the single name field). Make **both fields compulsory** on invitation prep. Recipient record should be exactly: **first name, surname, date of birth, assigned school, assigned year of entry** — no title. |
| CH-10 | Spec clarification | **Entry year vs academic year are being conflated.** Entry year is one of Year 6–13; academic year is always dual-year (e.g. 2027/2028). Example: year of entry = Year 7, academic year = 2027/2028. |
| CH-11 | Change request | Part 1 is **missing three fields**: (1) **recipient's school** — Trinity School or Whitgift School; (2) **bursary award year of entry** — Year 7…Year 13; (3) **recipient's scholarship**. All three: **empty, mandatory, NO prefill / no default value**. 📷 image010 shows a current wrong prefill to correct. |
| CH-12 | Spec | Hidden **remaining-years matrix** driven by entry year: Y6→8, Y7→7, Y8→6, Y9→5, Y10→4, Y11→3, Y12→2, Y13→1. When the assessor enters the entry year, the remaining-years field **auto-fills** accordingly. 📷 image014 |
| CH-13 | Change request | **Scholarship field**: accepts a **% from 1 to 100**, manually editable. Needed at the start of a **rolling-over** assessment (records the current scholarship); irrelevant for new applications but required for existing accounts. 📷 image012 |
| CH-14 | Change request | **School field must be manually editable** (not derived). Real scenario: both schools want the same family assessed → one assessment run with Trinity, then the assessor switches the school to Whitgift to recalculate, since the parents haven't chosen yet. |
| CH-15 | Change request | One field must accept a **number from 1 to 20, no default value**. 📷 image015 — identify the exact field from screenshot |
| CH-16 | Change request | Net Part 1 additions: **school picker (2 options)** and **annual school fees selector (2 options: current year vs following year)**. 📷 image016 |
| CH-17 | Change request | **Admin settings — school fees model change**: each school needs an annual fee **per academic year** — current year and next year — and the system should retain **historical fee values** as years pass. Figures supplied (annual fees before VAT): 2025-26 Trinity **£24,366.67** / Whitgift **£25,200.00**; 2026-27 Trinity **£25,390.00** / Whitgift **£26,175.00**. 📷 image009 |

### PART 2 — Household income

Verdict: *"This is perfect 😊 … this makes things much easier."* Two comments:

| ID | Type | Item |
|---|---|---|
| CH-18 | Bug/question | The page showed **entries where it should be blank** — asks whether they were Brian's test entries. Requirement: **blank page, no autofill**. 📷 image011 |
| CH-19 | Change request | **Remove the light-brown "Mr Bot" comments**. If those cells/comments are generated from what the applicant filled in, **stop that linkage**. 📷 image013 / image017 |
| CH-20 | Change request | **Remove one section** — the divorced-parents template already captures child maintenance / new partner's earnings, so this section duplicates it. 📷 image018 — identify from screenshot |

### PART 3 — Notional spend benchmarking

Verdict: "looks good", but worried about anything prefilled.

| ID | Type | Item |
|---|---|---|
| CH-21 | Change request | First flagged question: keep the **dropdown (4 options)** but add a **fully editable manual field** able to **override** the dropdown value. 📷 image019 |
| CH-22 | Change request | Second flagged question: **manual, fully editable field**, with the dropdown available to apply the **default value**. 📷 image020 |
| CH-23 | Change request | Values she found prefilled: if derived from the application form, **delete the linkage and leave the fields empty** for the assessor. 📷 image021 |
| CH-24 | Spec / calc convention | **Sign convention**: all **DEDUCT** lines must show a **negative total** (they reduce available income); **ADD BACK** lines are **recharges** (cancelling a deduction when the family pays no rent/mortgage/council tax). She will re-verify the calculations herself using one of her real-data applications. 📷 image022 |

### Tabs

| ID | Type | Item |
|---|---|---|
| CH-25 | Change request | There is a **Part 5 inside the assessment section**, so rename the tabs: **ASSESSMENT MODEL (1-5)** and **BURSARY AWARD CALCULATION (6)** (currently 1-4 / 5). |

---

## Cross-cutting themes for triage

1. **No-prefill principle hardens** (CH-11, CH-18, CH-19, CH-21–CH-23): anything derived from the applicant's form inside the model must be unlinked and left empty. This **partially walks back** the 16 Aug position that Part 1's autofill rows (year of entry etc.) were wanted — reconcile against the committed workbook extraction before building.
2. **Assessment lifecycle** (CH-04–CH-06): the 4-state NOT STARTED/PAUSED/COMPLETE/LOCKED model is a real workflow change, and the natural resolution of CF-10 (revertible completion) — design once, not twice.
3. **School-fees data model** (CH-16, CH-17): per-school, per-academic-year fee records with history, plus an assessor-facing current-vs-next-year selector and a manually switchable school (CH-14) — schema + admin settings + Part 1 UI all touched.
4. **Invitation data contract** (CH-09, CH-10): split mandatory first name/surname, no title, and an entry-year vs academic-year distinction that likely ripples into references, schedules and the portal.
5. **Screenshot-dependent items** (CH-08, CH-15, CH-20, and the exact fields in CH-21/22/23): pull the embedded images from message `1a011b1a96a0f3b3` before implementation — the text alone under-specifies them.
6. **Wait for the rest**: Parts 4–5 and tab 6 feedback arrives ~18 Aug; triage the whole batch together.
