# JWF Bursary System — Live Demo Script

A follow-along script for demoing the **primary features** (not edge cases) on a
long video call. It is mapped **chronologically** and you play **every persona**
(Admin, Assessor, Parent), so it's built around switching between three
pre-opened browser windows rather than logging in and out.

> **Tags used below:** 🟦 ADMIN window · 🟩 ASSESSOR window · 🟧 PARENT window ·
> **DO** = what to click · **SAY** = talking points · **Signpost** = watch out.

---

## Pre-flight checklist (do this the day before — don't wing it live)

**Environment**
- [ ] Demo on **staging** (it *is* the client-testing environment, safe to
      create/delete data) — not local (emails won't send), not prod (avoid demo
      PII in production).
- [ ] **Turn MFA on for the demo:** set `STAFF_MFA_ENFORCED=true` in the staging
      Vercel env and redeploy. Without this, staging won't prompt for MFA and
      Scenes 1 & 6 fall flat.
- [ ] Confirm **Resend** is sending on staging (invitation + outcome emails must
      arrive).

**Accounts & access**
- [ ] You can **log in as an administrator** (admins are provisioned during
      setup — confirm you have the credentials).
- [ ] An **authenticator app** on your phone — you'll add **two** entries live
      (admin, assessor).
- [ ] Use **plus-addressed real emails** you control so every invite/outcome
      lands in one inbox: `you+admin@…`, `you+assessor@…`, `you+parent@…`.

**Browser setup — the single most important logistics tip**
- [ ] Open **three separate windows / profiles**, kept logged in throughout, so
      you switch instead of re-authenticating:
      🟦 ADMIN · 🟩 ASSESSOR (incognito/2nd profile) · 🟧 PARENT (3rd profile).
- [ ] Share the **screen**, not a single window, so switching is seamless.

**Content to stage**
- [ ] Sample documents on the desktop (the repo has usable images in
      `docs/assets/images/`: `birth_certificate.png`, `passport_man.png`,
      `payslip.png`, `bank_account.png`).
- [ ] The **demo data sheet** (appendix below) so numbers flow and you land a
      **Qualifies** outcome.
- [ ] **Rehearse end-to-end once** on staging — especially the assessment maths.

**Optional clean slate:** running the demo seed against nonprod gives a known
baseline (existing families for the reports/sibling scenes) — but it's
destructive, so do it *before* creating your live accounts.

> ⏱️ Budget ~50–70 min. Scenes marked **(skippable)** are where to trim.

---

## The tour

### Scene 1 — 🟦 Admin: log in & enrol MFA *(~4 min)*
**DO:** Login page → sign in as admin → routed to `/login/mfa` → scan the QR with
your authenticator → enter the 6-digit code → land on the admin dashboard.

**SAY:**
- "Access is **invitation-only** — applicants can't self-register, and even
  administrators can't self-serve; the first admin is provisioned during
  onboarding. A deliberate control for a system holding family financial data."
- "Every staff member is forced through **MFA** on first sign-in — contractually
  required, enforced in production."

**Signpost:** No MFA screen ⇒ the `STAFF_MFA_ENFORCED` flag isn't set. Fix before
continuing.

---

### Scene 2 — 🟦 Admin: orientation *(~4 min)*
**DO:** Walk the left-hand nav. Land on the **Dashboard** (`/admin`); read the
status tiles. Open the **Queue** (`/queue`) briefly.

**SAY:**
- "The dashboard is the at-a-glance health of the current round."
- On the queue: "**Names are hidden by default** — reference, school, status.
  There's a **Show Names** toggle and every reveal is **audit-logged**. Data
  minimisation is baked in." *(Toggle once; we revisit the audit trail at the end.)*

---

### Scene 3 — 🟦 Admin: reference data (the calculation backbone) *(~5 min, partly skippable)*
**DO:** **Settings** (`/settings`) → tour the tabs: **Family Types**,
**School Fees**, **Council Tax**, **Reason Codes**, **Email Templates**.

**SAY:**
- "The assessment engine is **configurable, not hard-coded**. Notional rents,
  utility/food costs, school fees, council-tax default — the Foundation owns
  these; changes apply to new assessments while **historical assessments keep
  the values in force at the time**."
- Email Templates: "Every transactional email is editable here with merge
  fields — no developer needed."
- Reason Codes: "These explain year-on-year fee changes at re-assessment."

**Signpost:** Don't save edits live unless rehearsed; just tour.

---

### Scene 4 — 🟦 Admin: create & open a round *(~3 min)*
**DO:** **Rounds** (`/rounds`) → **Create** (academic year e.g. "2026/27",
open/close dates, decision target) → starts **DRAFT** → **Open** it.

**SAY:** "Everything hangs off a **round**. Only **one is open at a time** — the
system enforces that. Opening it is what lets applicants register."

---

### Scene 5 — 🟦 Admin: invite an assessor *(~2 min)*
**DO:** **Users** (`/users`) → invite staff → `you+assessor@…`, role
**ASSESSOR** → send.

**SAY:** "Role-based access: **Admin** owns the system, **Assessor** does case
work, **Viewer** is read-only. They'll get a single-use link and set their own
password."

---

### Scene 6 — 🟩 Assessor: accept, enrol MFA, log in *(~4 min)*
**DO:** 🟩 ASSESSOR window → invitation email → link → **set a password** → log
in → enrol MFA (second authenticator entry) → land on the assessor view.

**SAY:** "Same MFA enforcement. Notice the assessor's **queue is empty** —
assessors only see applications **explicitly assigned to them**, enforced at the
database level with row-level security, not just in the UI."

**Signpost:** Keep this window logged in — you return in Scene 11.

---

### Scene 7 — 🟦 Admin: invite a parent *(~2 min)*
**DO:** 🟦 ADMIN → **Invitations** (`/invitations`) → new → `you+parent@…`,
**child's name**, **school** → send.

**SAY:** "Now the family. The admin sends a branded invitation tied to the open
round. The parent sees nothing until invited."

---

### Scene 8 — 🟧 Parent: accept & complete the application *(~10–12 min — heart of the applicant story)*
**DO:** 🟧 PARENT window → invitation email → link → **set a password** → confirm
child/school on the welcome card → land on the **dashboard with the progress
stepper**. Then walk the **10-section wizard** (use the data sheet; keep brisk):

1. **Details of Child** — school, year group, DOB; **upload birth certificate**.
2. **Family Identification** — passports *(year-one only)*; **upload a passport**.
3. **Parent/Guardian Details** — contact + employment. *(Show the **sole-parent
   toggle** hiding Parent 2, then untick it.)*
4. **Dependent Children** → 5. **Dependent Elderly** → 6. **Other Information** —
   add a row or two; skip what doesn't apply.
7. **Parents' Income** — gross figures; **upload a payslip/P60**.
8. **Assets & Liabilities** — savings, property; **upload bank statements**
   (show the **multi-file** slot).
9. **Additional Information** — free-text circumstances.
10. **Declaration** → the **pre-submission review page** (flags anything
    incomplete) → **Submit**.

**SAY (sprinkle):**
- "Invitation-only, **save-and-resume**, fully **mobile-friendly** — many parents
  use a phone."
- "Each document has a **named slot**, so the assessor knows exactly what they're
  looking at. Up to 20 MB, PDF/JPEG/PNG."
- "The form **shows/hides** sections by answer and **won't submit** until
  complete — no wall of errors at the end."

**Signpost:** Pre-stage the sample files so uploads are instant. Short on time?
Pre-fill 4–6 in rehearsal and just *show* them.

---

### Scene 9 — 🟧 Parent: submission confirmation *(~1 min)*
**DO:** Show the confirmation screen + the **confirmation email**. Note the
application is now **read-only** to the parent.

**SAY:** "Immediate confirmation; the family can check status any time without
emailing the office."

---

### Scene 9B — 🟦/🟩 + 🟧 Separated families: invite a second parent *(optional, ~4 min)*
*Show this when the audience cares about divorced/separated households — the
Foundation assesses on **both** parents' income regardless of marital status,
but the two parents usually can't share one login or see each other's finances.*

**DO:**
- 🟦/🟩 On the **application detail**, use **"Add second parent"** → enter the
  other parent's email + name → send. *(Admins **and** assessors can do this, at
  any point — at first invite, after submission, or mid-assessment.)*
- 🟧 In a **second-parent window**, accept the invite → set a password → land on
  a **restricted `/contribute` portal**: only **their own** Parent Details,
  Income, and Assets & Liabilities, plus document uploads. The **child's name is
  read-only**; they see **nothing** of the first parent's data or documents.
  Complete the short wizard → **Submit**.

**SAY:**
- "One parent is **primary** — they own the child's application and receive every
  communication, including the final outcome. The **second parent** is invited
  only to supply **their own** financial picture."
- "**Strict privacy both ways**: neither parent can see the other's income,
  contact details, or documents. The assessor sees **both**, side by side."
- "If the second parent never responds, the assessor isn't stuck — they can
  **proceed without the second parent**, recording a reason (we'll see that next)."

**Signpost:** Pre-create a second-parent invite in rehearsal so the inbox link is
ready; otherwise this adds an email round-trip.

---

### Scene 10 — 🟦 Admin: assign to the assessor *(~2 min)*
**DO:** 🟦 ADMIN → **Queue** → the new submission appears → open it → header
**Assign Assessor** dropdown → select your assessor.

**SAY:** "The admin triages and **assigns** the case. The moment I assign it, it
appears in *that* assessor's queue and nobody else's."

---

### Scene 11 — 🟩 Assessor: review & run the assessment *(~10–12 min — heart of the staff story)*
**DO:** 🟩 ASSESSOR → refresh **Queue** → the assigned application is there → open it.
- **Tab 1 — Applicant Data:** read-only submission; **verify documents** (tick each).
  - *(separated families — if you ran Scene 9B)* The data + documents show **both
    parents side by side**, labelled **Parent 1 (primary)** and **Parent 2 (second
    parent)**. Note the **completeness gate**: the case can't be assessed until
    the primary has submitted **and** the second parent has submitted (or you
    click **Proceed without second parent** and give a reason). The queue shows a
    **2nd-parent status** indicator (Submitted / Awaiting / Override).
- *(skippable)* Show **Request Missing Documents** — templated email + how it
  pauses the case. Then move on.
- **Tab 2 — Assessment:** the **split-screen** — documents left, data-entry right.
  - **Stage 1 — Income:** employment status per parent; enter **verified net
    figures** from the documents; included vs excluded benefits. *(For a separated
    family, you key the primary as Parent 1 and the second parent as Parent 2 —
    both incomes combine, against the child's single household costs.)* Household
    net income updates live.
  - **Stage 2 — Assets:** savings, property, savings divisor.
  - **Stage 3 — Living costs:** auto-populated from family type; **HNDI after
    necessary spending**.
  - **Stage 4 — Bursary impact:** required bursary, scholarship %, **bursary
    award**, VAT, **yearly & monthly payable fees**.
  - Show **manual adjustment** (with reason) and **property category + red flags**.
  - **Save**.

**SAY:**
- "This is the **two-layer model**. The assessor builds an **independent
  financial picture from source documents** — they do **not** trust the typed
  figures; those are a cross-reference only."
- "The four-stage calculation **replicates the Foundation's spreadsheet** — same
  results, now integrated, audited, re-runnable."
- "Assessor judgement is paramount — every auto-filled value is **editable**, and
  the manual adjustment handles exceptional/pastoral cases."

**Signpost:** Rehearsed numbers matter most here — enter values you know produce
a clean **Qualifies** result.

---

### Scene 12 — 🟩 Assessor: recommendation & outcome *(~5 min)*
**DO:** **Tab 3 — Recommendation:** family synopsis, accommodation/income/
**property categories** (categories, not exact figures), **bursary award &
payable fees**, the **narrative**. Then **Complete the assessment** → outcome
**Qualifies**.

**SAY:**
- "The recommendation is **structured**, and the export to schools carries
  **categories, not precise financials**, for GDPR. The school never logs in."
- "Completing the assessment **notifies the family automatically** and opens a
  bursary account for re-assessment next year."

---

### Scene 13 — 🟧 Parent: read the outcome *(~2 min)*
**DO:** 🟧 PARENT → show the **outcome email** and the **outcome on the
dashboard**.

**SAY:** "A clear, templated outcome — no ambiguity, no chasing."

---

### Scene 14 — 🟩/🟦 Hand-off to schools: PDF + export *(~3 min)*
**DO:** On the recommendation, **Download PDF**. Then **Exports** (`/exports`) →
export the recommendation list as **XLSX/CSV**; open it.

**SAY:** "Two outputs: a per-application **PDF** for the file, and a
**spreadsheet** for admissions — generated, not hand-typed."

---

### Scene 15 — 🟦 Admin: breadth at scale (lean on seeded data) *(~6 min, partly skippable)*
**DO:** Use the **existing seeded caseload** so it looks real:
- **Queue** filtered/sorted across multiple applications and schools.
- **Sibling linking:** open a multi-child family → **Link Siblings** → show the
  household assessed as one unit and fees cascading across siblings.
- **Reports** (`/reports`): Award Distribution, School Comparison, Income Bands,
  Property Categories, Reason Codes, Final-Year Bursaries, Sibling Summary.

**SAY:** "A real round is 100–200 applications across two schools. Here it is at
scale — filterable queue, **sibling-aware** assessment, live **reporting** for
the Foundation and trustees."

---

### Scene 16 — 🟦 Admin: governance & security *(~4 min)*
**DO:** **Audit log** (`/audit`) → filter to the **name-reveal** and assessment
events from the demo. *Describe* **GDPR deletion** (two-step, 7-year-retention
guard) rather than running it. Mention **Reset MFA** on the Users page.

**SAY:**
- "Everything sensitive is **audit-logged** — who revealed a name, when, what
  changed. The GDPR accountability trail."
- "Defence in depth: invitation-only access, **enforced MFA**, **row-level
  security**, encrypted document storage with time-limited links, **7-year
  retention** + **right-to-erasure**, and **error monitoring** via Sentry."

---

### Scene 17 — Re-assessment story *(~2 min, talk-only)*
**SAY:** "Next year, the Foundation re-invites bursary holders in **one batch**.
Details pre-fill, the ID section is skipped, finances are re-entered. The
assessor sees **last year's figures side-by-side** and a **benchmark** so awards
stay consistent — the year-on-year continuity the old grant tool couldn't do."
*(If a multi-year account is seeded, show the History tab.)*

---

### Wrap-up *(~2 min)*
**SAY:** "End-to-end: invite → apply → verify → assess on the trusted four-stage
model → recommend → export to the school → and re-assess year after year — all in
one secure, GDPR-aware system purpose-built for the bursary programme, replacing
the repurposed grant tool before its December sunset." Invite questions.

---

## Appendix — suggested demo dataset (rehearse to confirm it lands "Qualifies")

> Adjust against the **actual** seeded school fees / family-type values on staging
> during rehearsal — the goal is a clean partial-to-full bursary.

- **Child:** Year 7, Whitgift School.
- **Household:** two parents (untick sole-parent), renting.
- **Parent 1:** PAYE, **net ~£26,000/yr** (payslip/P60).
- **Parent 2:** PAYE part-time, **net ~£9,000/yr**.
- **Savings:** ~£6,000 cash; no second property.
- **Family type:** a mid category (drives notional rent/utilities/food).
- **Expected shape:** fees ~£20k+ vs modest disposable income → a meaningful
  bursary award and a clear **Qualifies** outcome.

---

## Known gotchas (so nothing surprises you live)
- **MFA + emails** are the two things most likely to trip you up — confirm the
  staging `STAFF_MFA_ENFORCED` flag and Resend sending in rehearsal.
- The **family synopsis doesn't auto-populate** (you type it).
- The **single-applicant invite is admin-only** (it's an admin action above).
- Keep the assessment numbers rehearsed — that's the moment the value lands.
