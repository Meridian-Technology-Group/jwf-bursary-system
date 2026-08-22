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

### Follow-up for Charlotte

Once this promotes, **`Jack Curror` should be re-opened and given his real entry school year** — he is currently `OTHER`, which suppresses the schooling-years and schedule derivation for that account.
