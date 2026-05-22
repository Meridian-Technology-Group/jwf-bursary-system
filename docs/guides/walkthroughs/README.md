# Walkthrough Guides

Step-by-step task guides organised by the person doing the work. Each
persona has its own folder; each guide inside a folder walks one
discrete workflow from start to finish, written in plain language with
screenshots and "what to do if it goes wrong" notes.

These guides are deliverables for MSA Schedule 1 §4 (user guide,
admin/assessor guide). They are **not** the technical/operational
runbook — that lives separately under `docs/` and is intended for
engineers, not end users.

---

## The three personas

### Admin

Foundation staff with full system rights. Sets up rounds, invites
applicants and other staff, configures reference data (school fees,
family-type weightings, council-tax defaults, email templates, reason
codes), reviews recommendations, deletes records under GDPR, and is the
on-call account for resetting an assessor's MFA or fixing a stuck
invitation.

In short: anyone who owns the **system itself**, not just an individual
application.

→ Guides live in [`admins/`](./admins/).

### Assessor

Foundation staff (or contracted assessors) who handle bursary
applications day-to-day. They open the assessment queue, read an
applicant's submitted form, check the supporting documents, run the
calculation engine across Stages 1–4, write a recommendation with
reason codes, and either approve, decline, or send the application
back to the applicant for missing information.

Assessors **cannot** invite new applicants, change reference data, or
delete records — those are admin actions.

→ Guides live in [`assessors/`](./assessors/).

### Applicant

A parent or guardian applying for a bursary on behalf of a child. They
arrive via an emailed invitation link, set a password, complete the
10-section application form across multiple sessions, upload the
required documents (birth certificate, passports, payslips, bank
statements, etc.), sign the declaration, and submit. After submission
they can check status and, in subsequent years, complete a lighter
re-assessment.

Applicants only see their own data. They never see the assessment
calculation or recommendation.

→ Guides live in [`applicants/`](./applicants/).

---

## House style

Each guide should:

- Open with a one-line **goal** ("By the end of this guide you will
  have…") and a **prerequisites** list.
- Number every step. Each step has a single action verb at the start.
- Include a screenshot for every screen the user lands on. Crop to the
  relevant area; annotate with arrows or numbered callouts when the
  step requires picking one button out of several.
- End with a **What if it goes wrong?** section listing the common
  failure modes for that workflow and what to do about each.
- Cross-link to other guides where a workflow hands off to another
  persona (e.g. admin's "Send an invitation" → applicant's "Accept
  your invitation").

Keep paragraphs short. Bullet lists where possible. Avoid jargon — the
applicant guides especially should read like a friendly letter, not a
technical manual.
