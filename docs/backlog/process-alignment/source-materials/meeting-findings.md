## To-dos

### Bugs / things that did not work as expected

- Fix **“Show names” toggle** in admin so it actually reveals names when switched on.
- Fix **reference data edits not saving** correctly in admin settings. You changed a value and the audit log captured it, but the UI did not persist it as expected.
- Fix **round creation error handling**. Creating a round showed “unexpected error” even though the round was actually created.
- Fix **invitation UX clarity** so it is obvious whether you are sending a parent invite vs staff/assessor invite. This caused the wrong invite flow to be used during the demo.
- Enforce **required surname / child / school fields** where applicable during invitation setup. Missing/partial invite data slipped through.
- Fix **parent progress indicators** on the left nav and completion percentage so they update correctly when sections/documents are completed.
- Fix **review/completion counts mismatch** in parent review step (e.g. “fully complete” while still showing incomplete counts).
- Add proper **logout/session behavior** in parent portal; logout visibility was missing.
- Fix **cross-tab/session behavior** where logging in/out across personas caused confusion or unexpected state collisions.
- Fix assessor portal labeling where **admin wording appeared in assessor view**.
- Fix application state/update logic where beginning review did not reflect the expected **in-progress** state cleanly.
- Fix **application audit/history timeline** so entries and timestamps are accurate and correctly localized.
- Fix **Notion/user guide delivery issue**; shared guides were inaccessible and/or expired, requiring re-send/PDF backup.

### Admin / round management changes

- Remove current limitation that only **one round can be open at a time**; support cases where two rounds are open concurrently.
- Allow **editing/extending round dates** after creation.
- Support **per-application submission-by date**, not just round-level timing, because some applicants get extended deadlines.
- Filter parent invitation round choices to **active/live rounds only**.
- Replace round dropdown with a simpler UI if there are typically only **two active rounds**.
- Add **invitation confirmation step** if useful, to prevent accidental sends.
- Rework invitation/admin data model around a **lead applicant contact database**, not just ad hoc invites.
- Add admin-managed **contact records** holding parent details, address, child, school, year, etc.
- Add action from contact record to **send invitation** using the stored lead-applicant data.

### Authentication / access

- Disable **MFA in staging/test environment** to make testing easier.
- Keep MFA enforced in production for admin/assessor roles.
- Add **federated Microsoft sign-in / SSO** as a backlog item.
- Consider optional **session timeout/inactivity logout** policy.

### Parent invitation + setup logic

- Move **school selection** to admin invitation/setup stage; do not let parent choose it.
- Move **entry year / applying year** selection to admin invitation/setup stage; do not let parent choose it.
- Ensure the parent cannot edit **school** or **entry year** once invited.
- Support **one account per child** for nominative applications, including twins.

### Parent form changes

- Rework the parent application form to match the **actual scoping document/current form**, removing extra or incorrect fields.
- Remove **gross pay** question from the parent section where it should not appear.
- Remove **bonus** question where not part of the actual form.
- Remove other parent questions that came from the wrong model / are not in scope, including parts of the extra financial/circumstance checklist structure.
- Replace declaration text with **their actual declaration wording**.
- Make **telephone number mandatory**.
- Make **email address mandatory** and explicitly captured, even if invitation was sent by email.
- Auto-populate the **“left employment since April …”** wording using the correct April tied to the relevant tax/round year.
- Ensure if parent says child is at same address, the system shows the **stored address** from contact data rather than relying on fresh free-text entry.
- Add/align **postcode logic** needed for transport/bursary form processes.
- Simplify/revise parent sections that were described as overkill or from the wrong flow.

### Parent portal behavior

- Let parents save drafts and return later **before deadline**.
- Prevent editing once **submission deadline has passed** for a still-draft application.
- Show clear banner/countdown with **time remaining to submit**.
- Show clear **deadline missed** state when submission date has passed.
- After submission, let parents see a **read-only summary** of what they submitted.
- Add ability for parents to **download their submitted application** as PDF.
- Preserve access to historic **submitted summaries/PDF downloads** for reference, rather than editable forms.
- Do **not** expose editable submitted applications back to the parent.
- Remove/limit parent-facing **status visibility** so they do not see internal workflow states unnecessarily.
- Expand parent portal from one-off application view to a **multi-round/account history view**.
- Show future/dormant **lineup of upcoming rounds** for active bursary recipients.
- Add parent-side ability to upload **requested missing documents through the portal** after assessor follow-up, while keeping the submission date intact.
- Keep manual admin-side document attach flow too, since some parents will still send docs by email.

### Status / workflow model redesign

- Redesign statuses so they separate:
    - **form/application lifecycle**
    - **assessment lifecycle**
    - **final bursary/award outcome**
- Keep original **submission date fixed** once submitted, even if more documents are requested later.
- Add a specific state for **submitted but awaiting extra documents**.
- Clarify/replace ambiguous **Paused** status with a more explicit status, likely around awaiting applicant documents.
- Distinguish **draft** vs **submitted** vs **assessment in progress** vs **assessment complete** cleanly.
- Remove or rethink **“qualifies / does not qualify”** as an assessor-facing workflow state; that was described as not matching their real process.
- Model the difference between:
    - applicant **does not qualify**
    - applicant **qualifies but is not awarded**
    - applicant **awarded and becomes rolling/active**

### Assessor experience / UI

- Rework assessor UI to match the **real assessment scoping document**, not the shortened/incomplete current version.
- Add the **missing assessment fields and logic** Charlotte said were absent.
- Reduce the number of freeform qualitative sections to **one synopsis box**.
- Keep the synopsis visible at the bottom during assessment **and also on the post-completion/final screen**.
- Allow synopsis to remain **editable after assessment completion**.
- Revisit assessor layout for smaller screens/laptops:
    - documents left
    - data center
    - calculations collapsed/persistent at top instead of always full right panel
- Keep document navigation workable for **30+ documents**.
- Ensure assessor workflow is optimized for **document-data-document** review rather than forcing large persistent summary panes.

### Assessment calculations / data structure

- Validate all calculations against **real historical assessments**.
- Make sure assessor-entered values and calculation inputs fully reflect the **agreed assessment model**.
- Add support for **current-year fees and next-year fees** where needed for calculations/monthly payment logic.
- Ensure only the correct data is auto-populated; assessor should still independently assess/enter what is required.

### Recommendation / outcome area

- Replace current recommendation/outcome area so it reflects their actual process and terminology, likely around **final bursary and scholarship awards** rather than simplified qualify/not qualify.
- Add missing concepts around **scholarships, siblings, and choice between views/options** that Charlotte said were absent.
- Remove assessor-side **PDF output** from this step if it is not used.
- Replace current **reason codes** with the actual current paperwork codes if the existing set is outdated/wrong.

### Second parent / complex household handling

- Review and validate the **second parent flow** for correctness.
- Confirm combined-income / separated-parent logic aligns with their real process.
- Ensure second-parent section only asks the right subset of questions.

### Data retention / account lifecycle

- Implement automatic **purge/deletion** for declined and non-awarded applications.
- Support distinction between **active accounts** and **closed accounts**.
- Revisit retention for **qualified but not awarded** applicants; Charlotte raised possible six-year retention instead of immediate purge.
- Revoke parent portal access appropriately when an account is no longer active.
- For successful applicants, create/promote them into **active rolling bursary accounts** with future rounds generated.

### Process / coordination follow-ups

- Get **latest scoping document** from Charlotte and reconcile the build against it.
- Have Charlotte send the **correct form/questions** and declaration text.
- Push a large batch of fixes before **Monday testing**, then send Sunday evening update email summarizing changes.
- Use **off-hours/staged releases** to avoid disrupting testing.
- Send **PDF user guides** as fallback while Notion sharing is fixed.

If you want, I can turn this into a cleaner **engineering ticket list grouped by priority** (P0/P1/P2) next.