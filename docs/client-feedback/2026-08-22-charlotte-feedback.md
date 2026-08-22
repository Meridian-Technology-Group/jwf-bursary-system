# Charlotte Perrier — feedback, 22 Aug 2026

Catalogue of the emails received from Charlotte (charlotteperrier@johnwhitgiftfoundation.org) on Saturday 22 Aug 2026. Gmail links open under the `brian@meridiantech.group` account.

Item IDs continue the series: `CF-*` = 13 Aug ([2026-08-13-charlotte-feedback.md](2026-08-13-charlotte-feedback.md)), `CG-*` = 16 Aug ([epic-14-uat-round-2.md](../backlog/uat-aug-2026/epic-14-uat-round-2.md)), `CH-*` = 17 Aug ([2026-08-17-charlotte-feedback.md](2026-08-17-charlotte-feedback.md)), `CI-*` = 20 Aug ([2026-08-20-charlotte-feedback.md](2026-08-20-charlotte-feedback.md)). Today's single item extends the **CH** series as `CH-26`.

> ⚠️ **She is now working in production.** Every fix from here follows the full path — fix → validate → merge to `staging` → promote `staging → main` — rather than landing on staging and waiting for a batch promotion. The live round (`2026/27`) is OPEN and her three real internal bursary applicants are in flight (CI-09, submission deadline Thu 27 Aug).

---

## E1 — 08:22 · Email template amendments

- **Message ID**: `1a028598c75d7093` · [open message](https://mail.google.com/mail/u/0/#all/1a028598c75d7093) · thread `1a028598c75d7093`
- Cc: Alex Skrzynski
- ✅ **Verified**: the previous night's access issues are gone — *"I was able to log into the live system on the first attempt."* This closes out the login-loop incident (the prod env var rebake, promotion #338).
- **Question, not a defect**: when amending email-template text, must she edit in the test environment and have Brian release it, or can she edit production directly — would direct edits put the databases out of sync?
- **Answered** (08:25, `1a0285c54f29dae4`): the environments share nothing, so production changes are made in production and there is nothing to sync. No code action.

## E2 — 08:28 · Entry year within the contacts tab

- **Message ID**: `1a0285f5a1758f5c` · [open message](https://mail.google.com/mail/u/0/#all/1a0285f5a1758f5c) · thread `1a0285f5a1758f5c`
- 📷 image001 — the *Entry year group* dropdown open, showing only Year 6 / Year 7 / Year 9 / Year 12 / Other, with **Other** selected.

| ID | Type | Item |
|---|---|---|
| CH-26 | Change | **Entry year must read as the academic year.** *"The entry year in the contacts tab should not be one year. It should reflect the academic year: so if we are looking at a new application for a 2027/2028 entry year, it should have the field for 2027/2028 and not be 2027."* |
| CH-26 | Change | **Entry year group must offer Years 6–13.** *"Could we have every year option from year 6 till year 13, due to the internal bursary requests being on any school year?"* |
| CH-26 | Copy | Relabel *Entry year* → **Academic year**. |
| CH-26 | Copy | Relabel *Entry year group* → **Entry school year**. |

### Analysis

The screenshot is the tell: her one live contact (`Jack Curror`) is recorded as **`OTHER`**, because the enum had nowhere to put a child entering in any year other than 6/7/9/12. `OTHER` is not cosmetic — it makes `getTotalSchoolingYearsForGroup` return `null`, so the schooling-years derivation and the multi-year schedule horizon both fall back instead of deriving. Internal bursary requests are exactly the case that lands outside the four common entry points, which is why she hit it immediately.

The derived model already carried her full Year 6–13 matrix from CH-12 (`remainingYearsForEntrySchoolYear`); only the *enum* and the capture dropdowns were still restricted to the four historic entry points.

### Resolution — PR #339

Shipped in `fix/ch26-academic-year-and-year-groups`:

- **Academic-year display** — `entryAcademicYearLabel()` in `src/lib/schools/academic-year.ts`. `entry_year` stays the `Int` **start** year and every dropdown still submits that 4-digit value, so there is **no data migration** and the fee-year / tax-year anchors that read the column are untouched. Applied to the contact register + form, invite-from-contact summary, internal-request dialog, application header, sibling linker/list and the active-bursaries report — so no surface is left showing a bare year. The contacts field also becomes a select (it was free text, which is how the ambiguous `2027` could be entered), always including the record's own year so editing a back-dated entrant cannot silently blank it.
- **Years 6–13** — additive migration `20260822090000_ch26_entry_year_group_all_school_years`: `ALTER TYPE "EntryYearGroup" ADD VALUE IF NOT EXISTS` for `Y8`/`Y10`/`Y11`/`Y13`, positioned with `BEFORE` so the enum sorts in school order. `OTHER` retained for historic rows and genuinely unknown cases.
- **Labels** — renamed on every surface carrying those two fields (including the assessment tab), so the app does not disagree with itself.
- **Latent bug fixed en route** — four modules (`schedule.ts`, `schedule-home.ts`, `portal-schedule.ts`, `payable-fees-schedule.ts`) each kept a private copy of the same `group → school-year` switch. Adding enum values without editing all four means a `Y10` entrant falls through `default: return null` and *silently* gets the 8-year default horizon: a wrong schedule with no error. They now share one exported `schoolYearForEntryYearGroup()`.

**Validated**: 2164 unit tests (new coverage for the label helpers, the full 6–13 group model and every group's schedule horizon); `tsc` / `next build` / ESLint clean; migration run against nonprod with the enum confirmed in school order; and driven through the real UI on both local-against-nonprod and the deployed preview — a `Y10` contact saved and round-tripped to Postgres.

## E3 — 08:37 · RE: Entry year within the contacts tab

- **Message ID**: `1a028676d155d539` · [open message](https://mail.google.com/mail/u/0/#all/1a028676d155d539)
- 📷 image003 — the contact she has just created; image004 — the Send Invitation screen; image001 — the settings template picker.
- Restates CH-26 as a **blocker**, not a preference: *"I have created the first contact but to be able to proceed, I need the entry year to show as 'academic year' and the field to be 2026/2027… I need to be able to pick year 11 for that one."* Confirms the full list she wants: years 6, 7, 8, 9, 10, 11, 12, 13.

| ID | Type | Item |
|---|---|---|
| CH-27 | Feature | **Preview the invitation email before sending, with the option to edit it for that one send.** *"When I click on send the invitation: would it be possible to have a preview of the email about to be sent, with an editable functionality? So that when I click on 'send invitation', it is exactly as required in that particular case?"* |
| CH-28 | Already built | Asks for per-situation invitation templates — *"Invitation - new application - generic / rolling over / internal bursary… could you add two more and link each to each situation."* |

## E4 — 09:03 · RE: Entry year within the contacts tab

- **Message ID**: `1a0287f4dd90b2f0` · [open message](https://mail.google.com/mail/u/0/#all/1a0287f4dd90b2f0)
- *"Oops I tried to create an additional template and I can see that Mr Bot is working on it so please delete it."*

| ID | Type | Item |
|---|---|---|
| CH-29 | Already built | *"There is no option to delete a new email template once created."* |

## E5 — 09:21 · RE: Entry year within the contacts tab · **most recent**

- **Message ID**: `1a028900301ec618` · [open message](https://mail.google.com/mail/u/0/#all/1a028900301ec618)
- 📷 image001 — the three real contacts she is proceeding with.
- *"I am going to proceed with those three… Could you change for all of them the 'entry year: 2026' to academic year: 2026/27'. Could you edit the school year (as the option is only other at the moment) to show as year 11 for both Jack Curror and Aditya J."*

| ID | Type | Item |
|---|---|---|
| CH-30 | Data fix 🚨 | Set the entry school year to **Year 11** for **Jack Curror** and **Aditya JAYAPRAKASH** — both currently `OTHER` because Year 11 was not offered. Blocked on the CH-26 enum reaching production. |

### The three live contacts (production, all `situation = INTERNAL`, `entry_year = 2026`)

| Child | Parent | School | Entry school year |
|---|---|---|---|
| Jack Curror | Ms Helen Cord · helencord@hotmail.com | Whitgift | `OTHER` → **Y11** |
| Aditya JAYAPRAKASH | Mr J Raveendran · jayaprakash.raveendran@gmail.com | Trinity | `OTHER` → **Y11** |
| Denzel Williams | Mr Dima Williams · williams.dima@gmail.com | Trinity | `Y12` — already correct, no change |

---

## CH-28 and CH-29 were already built — the real defect was discoverability

Both asks describe features that shipped in Epic 14. Worth recording *why* she could not find them, because the cause was a live risk, not a misunderstanding.

**CH-28.** The five per-situation invitation templates exist and are selected automatically by `resolveInvitationTemplate(situation, school)` — new/internal per school, plus rolling-over for both. Her three internal invitations resolve to `INVITATION_INTERNAL_WS` (Jack) and `INVITATION_INTERNAL_TS` (Aditya, Denzel). What she asked for is not only built, it is *finer-grained* than her three (it splits by school as well).

She could not see them because the settings picker listed templates in `EmailTemplateType` enum order: the legacy generic `INVITATION` came **first** and was the default selection, and the five real variants came **last**, behind fifteen unrelated emails. Her screenshot shows "Invitation (generic fallback)" selected.

> 🚨 **This was a live wrong-email risk.** Had she edited the generic fallback — the one the picker opened on — and then sent her three real invitations, none of her edits would have reached the parents, because no current send path resolves to that template. Nothing would have errored.

**CH-29.** Delete is implemented for custom templates (`deleteEmailTemplateAction`, soft-delete via `deletedAt`; system templates are deliberately non-deletable). The button renders next to **Save Template** — but at the *bottom* of the editor, below the subject field, a tall body textarea and the merge-field panel, and only when a Custom template is selected. Verified end-to-end on nonprod: creating a custom template shows **Delete**, and confirming it sets the tombstone and drops the row from the picker.

### Resolution — same PR (#339)

The picker now groups templates and names the trap:

- **"Invitations — sent to parents"** first, with the five live variants at the top and the legacy fallback last, relabelled **"Invitation — legacy fallback (not used for new sends)"**.
- Then **"Other system emails"**, then **"Custom templates"**.
- The editor opens on a real invitation variant rather than the fallback.
- Selecting the fallback shows an amber note: *"Editing this will not change the invitations you send."*

Grouping is presentation-only — `getAllEmailTemplates` and every other consumer are untouched. Pinned by tests that assert every template `resolveInvitationTemplate` can return is in the invitation group (exhaustive over situation × school), that the fallback sorts last, and that its label still says "legacy" and "not used".

No code needed for CH-29 — she should be told where the button is.

---

## Outstanding

| Item | Status |
|---|---|
| CH-26 | Fixed in PR #339, CI green — **awaiting `staging → main` promotion** (Brian) |
| CH-28 | No build needed; picker fix in #339 |
| CH-29 | No build needed; tell her where Delete is |
| CH-30 | **Blocked on the promotion**, then set the two contacts to Y11 |
| CH-27 | **Deferred** (Brian, 22 Aug) — preview + editable-for-this-send, to be built as a later change. Design note: an edited send must be recorded as the sent text in the `email_log` (CI-02), not as the template, or the sent-emails log will misreport what the parent received. |
| Her stray template | `50f29de6-7397-418e-b8ac-99df38670cb2` — "Invitation - new application - generic", custom, not deleted. To be soft-deleted after the promotion. |
| Reply | None sent on CH-26…30. She is also still waiting on a timeline for the CH/CI batch. |
