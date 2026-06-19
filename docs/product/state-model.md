# Bursary System — Canonical State Model

The authoritative description of the states a bursary case moves through, who
may move it, and the rules that govern every transition. It models **three
parallel tracks** — the **Application**, the **Assessment**, and the **Bursary
Account** — and the cross-track gates that keep them in step.

> **Source of truth.** The signed-off diagram
> [`docs/diagrams/bursary-application-flow.drawio`](../diagrams/bursary-application-flow.drawio)
> is the authoritative picture of the topology (states and transitions). This
> document is the canonical *textual* specification of the same model. **Where
> this document and the diagram ever disagree, the diagram wins** — and the
> disagreement is a bug to be fixed here. How these states are *persisted*
> (enums, columns, RLS) is a separate concern, described in
> [`engineering/data-model.md`](../engineering/data-model.md).
>
> Derived from the diagram and the **2026-06-11** process-review meeting
> (Brian Wagner · Charlotte Perrier · Alex Skrzynski). Created 2026-06-19.

---

## 1. Overview

A bursary case is not a single status. Three lifecycles run **in parallel**,
each owned by a different concern:

| Track | What it tracks | Lives for |
|---|---|---|
| **Application** | The parent's form — from invitation to submission | One round (one assessment cycle) |
| **Assessment** | The assessor's review of a submitted application | One round, alongside the application |
| **Bursary Account** | The family/child "shell" that outlives any one application | Many rounds (Yrs 6–13), until closed |

The Application and Assessment tracks turn over **once per round**. The Bursary
Account is **long-lived**: a single account spawns a fresh Application →
Assessment pair each year a reassessment round opens, until it is closed.

The transitions below are colour-coded by **actor** (who performs the action),
matching the diagram's edge colours.

## 2. Actors

| Actor | Diagram colour | Role |
|---|---|---|
| **Applicant** | Blue | The parent / lead applicant. **Sole owner of application data** — the only party permitted to change it (directly, or via audited impersonation — see §9). |
| **Assessor** (staff) | Gold | Assessor **and admin** staff. Creates applicant records, sends invitations, runs assessments, requests documents, rejects, triggers material-change edits, and closes accounts on withdrawal. |
| **School / Admissions** | Purple | Decides the outcome of a **new** application: *Offered* or *Declined*. The assessor reports; the school decides. |
| **System** | Grey (dashed) | Automatic transitions: routing a submission to new/rollover, creating and discarding assessments, opening rollover rounds, keeping rollover accounts active. |

---

## 3. Application track

The parent-facing form lifecycle. One Application instance exists per round.

### States

| State | Meaning | Entered when |
|---|---|---|
| **Sent** | Applicant record created and invitation sent; the applicant has not yet acted. | Assessor creates the record & sends the invitation. |
| **Started** | The applicant has opened the invitation link and set a password — they can log in and look around. At minimum the child's name exists. | Applicant opens the link · sets a password. |
| **In Progress** | The applicant is actively working the form: ≥ 1 field entered or ≥ 1 document uploaded. Free navigation between sections; partial saves allowed. | Applicant enters a field / uploads a document. |
| **Complete** | Every required field **and** required document is present — but the applicant has **not yet pressed Submit**. A distinct, visible state so staff can see "all done, just needs the button" and chase accordingly. | All required fields + documents present. |
| **Submitted** | A **brand-new** application that has been submitted. | Applicant hits Submit and **no** existing account (new). |
| **Received** | A **rollover** application (existing account with a prior round schedule) that has been submitted. Same applicant action as *Submitted*; the distinct label flags it as a reassessment, not a first-time application. | Applicant hits Submit and **an** existing account (rollover). |
| **Submitted with Correction** | The assessor has requested additional documentation. The application stays effectively submitted, the **original submission date is preserved**, and it is awaiting the missing docs. | Assessor requests documentation during assessment. |

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(START)* | Sent | creates applicant record & sends invitation | Assessor |
| Sent | Started | opens invitation link · sets password | Applicant |
| Started | In Progress | enters a field / uploads a document (partial save) | Applicant |
| In Progress | Complete | all required fields + documents present | Applicant |
| Complete | **Submitted** | hits Submit — **new** (no existing account) | Applicant → *System* routes |
| Complete | **Received** | hits Submit — **rollover** (existing account) | Applicant → *System* routes |
| Submitted / Received | **Submitted with Correction** | assessor requests documentation — *original submission date kept* | Assessor |
| Submitted with Correction | *(assessment resumes)* | applicant uploads the missing documents | Applicant |
| Submitted / Received | **Started** | **REJECT** → hard reset: login kept, **all fields cleared**, all sections "not visited" | Assessor |
| Submitted / Received | **In Progress** | **material change** → re-submission needed (assessor edits via impersonation, §9) | Assessor |
| Active *(account)* | In Progress | next round opens (rollover) — a fresh Application for the applicant to update & resubmit | System |

> The reject / material-change / request-documentation actions are initiated
> from the assessment context (Assessment = *In Progress*) but they change the
> **Application** state. Their effect on the assessment is in §4 and §6.

---

## 4. Assessment track

The assessor's review. Runs in parallel with the Application once it is
submitted. **Reject is an *action*, not an assessment state** — it discards the
assessment back to *Not Started*.

### States

| State | Meaning | Entered when |
|---|---|---|
| **Not Started** | An assessment record exists but work has not begun. Also the state returned to when an assessment is discarded. | Application reaches *Submitted* / *Received*. |
| **In Progress** *(assessing)* | The assessor is actively assessing. | Assessor begins the assessment. |
| **Complete** *(report to school)* | Assessment finished and reported to the school / admissions. | Assessor marks Complete. |

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(application Submitted / Received)* | **Not Started** | application submitted / received | System |
| Not Started | In Progress | begins assessment | Assessor |
| In Progress | **Complete** | marks Complete & reports to school | Assessor |
| In Progress | **Not Started** | **assessment discarded** — on REJECT or material change | System |
| In Progress | *(held, then)* In Progress | request documentation → applicant uploads → **assessment resumes** (not discarded) | Assessor, then Applicant |

> **Documents vs. data — the critical distinction.** Requesting *documents*
> holds the assessment and resumes it (the data the parent submitted is
> untouched). A *material change* to the data **discards** the assessment, which
> must be re-run after re-submission. See §7.

---

## 5. Bursary Account track

The long-lived family/child shell. Outlives individual applications and carries
the round schedule.

### States

| State | Meaning |
|---|---|
| **Active** | The account is live. It has two facets in the diagram, both the same *Active* state at different points in the lifecycle: **· Application available** — the portal is open and an application is in flight (entered once the applicant has *Started*); **· rounds scheduled (Yrs 6–13)** — after an award, with a schedule of future assessment rounds attached. |
| **Closed** | The account is closed and its **data is purged**. Terminal. |

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(applicant Started)* | **Active** · Application available | an application is available to work on | System |
| *(assessment Complete — **new**)* | **School decision** | report to admissions | Assessor |
| School decision | **Active** · rounds scheduled | **OFFERED** → activate + attach round schedule | School / Admissions |
| School decision | **Closed** | **DECLINED** → close & purge data | School / Admissions |
| *(assessment Complete — **rollover**)* | **Active** *(stays)* | no decision needed | System |
| Active | **Closed** | **WITHDRAWAL** → assessor closes (any time · account level · no documents) | Assessor |

---

## 6. Cross-track synchronisation & gates

How the three tracks stay in step:

1. **Assessment gate.** An assessment **cannot begin until the application is
   *Submitted* or *Received***. There is no assessing of an in-flight form.
2. **Auto-create.** Reaching *Submitted* / *Received* creates the Assessment in
   *Not Started* (system).
3. **Documents-only correction.** Assessment *In Progress* → application
   *Submitted with Correction*; the assessment is **held, not discarded**, and
   **resumes** when the applicant uploads the docs. **Original submission date
   preserved.**
4. **Hard reject.** Assessment *In Progress* → **discarded** to *Not Started*;
   application **hard-reset** to *Started* (fields cleared, login kept). No
   submission date.
5. **Material change.** Assessment *In Progress* → **discarded** to *Not
   Started*; application back to *In Progress*; **new submission date** on
   re-submit; a **fresh** assessment runs.
6. **Completion.** Assessment *Complete* → for a **new** application, a *School
   decision*; for a **rollover**, the account simply **stays Active**.
7. **Award.** *Offered* → account *Active · rounds scheduled* + schedule
   attached. *Declined* → account *Closed* + data purged.
8. **Rollover loop.** An *Active* account opens the next round → a new
   Application in *In Progress* → … → *Received* → reassessed. Repeats per the
   round schedule.
9. **Withdrawal.** An *Active* account → *Closed* at any time, account-level.

---

## 7. Invariants & key rules

The subtle rules that are easy to get wrong. These are normative.

1. **Assessment gate** — no assessment may start before the application is
   *Submitted* / *Received* (§6.1).
2. **Two correction paths, different semantics:**
   - **Documents-only** (*request documentation* → *Submitted with
     Correction*): original submission date **kept**; assessment **preserved**
     and resumed; the submitted **data is not altered**. This is append-only —
     it preserves evidence and any dishonesty flags the assessor has noticed.
   - **Data change** (*material change* → application *In Progress*): submission
     date **reset** on re-submit; assessment **discarded** and re-run. **Any**
     material change — accidental, a misunderstanding, or deliberate —
     invalidates an in-flight assessment.
3. **Hard reject is a reset, not a deletion.** Login / password are kept; all
   fields are cleared; all sections return to "not visited"; there is no
   submission date. The parent re-enters from *Started* (directly, or via
   impersonation). *"We never give up on the parent."*
4. **New vs. rollover** diverge at two points: the submission label
   (*Submitted* vs *Received*) and completion behaviour (*School decision* vs
   *stays Active*). See §8.
5. **Rollover never fails out.** A rollover assessment that does **not** qualify
   still reaches *Complete* and the account **stays Active**.
6. **Submission date** shown is the **latest** Submit, **except** on the
   documents-only path, where the **original** date is preserved (§7.2).
7. **Withdrawal** is account-level, available at any time, and requires **no
   documents**.
8. **Data ownership.** The applicant is the sole owner and editor of
   application data. Staff changes happen **only** through audited impersonation
   (§9) — never by direct staff write to the parent's data.

---

## 8. New vs. rollover

The same Application and Assessment tracks serve both, but two behaviours
differ:

| | **New application** | **Rollover** (existing account) |
|---|---|---|
| Account before submit | *Active · Application available* (no prior rounds) | *Active · rounds scheduled* (prior rounds exist) |
| Submission label | **Submitted** | **Received** |
| After assessment *Complete* | Goes to **School decision** (report to admissions) | **No decision** — account **stays Active** |
| Possible outcomes | *Offered* → Active + rounds · *Declined* → Closed + purge | Continues; even non-qualifying rounds Complete and stay Active |
| Who triggers the next application | — | System opens the next round → new *In Progress* application |

The school's outcome terminology is **Offered** / **Declined**. The assessor
reports a batch of completed assessments to admissions; the school selects which
are offered (e.g. 60 reported → 20 offered → 40 declined & purged).

---

## 9. Edit-on-behalf (impersonation)

**Requirement.** Some parents (~10) need staff to complete or correct their
application for them — they cannot find Submit, do not know how to reveal the
second-parent section, or otherwise cannot self-serve. Staff must be able to act
on the application **as the applicant**.

**Mechanism — impersonation, not direct admin write.** Staff "view / open as"
the applicant and act within the applicant's identity. This honours the
data-ownership invariant (§7.8): the applicant remains the nominal author, and
staff never get a direct write path into another party's data.

**Audit / GDPR — the load-bearing requirement.** Every impersonated edit is
**audited as the staff member's action, performed while impersonating**. The
change must be attributable to the staff member, not silently recorded as the
parent's own edit. This is what makes the feature GDPR-defensible.

**Status interaction.** To edit a *Submitted* / *Complete* application, staff
first move it back to **In Progress**, then impersonate, edit, and re-submit.
Preferred flow: hand it back so the **applicant** presses Submit; staff may
submit on their behalf where the applicant cannot.

- **Submission date** follows the standard rule — the re-submit date applies
  (this is the *material-change* path, §7.2).
- **Assessment** — if one was already *In Progress* and a material change is
  made, it is **discarded and re-run** after re-submission (§6.5).
- **Communications** — **no** automated / templated "your application was
  updated" email. Staff notify the parent personally. Build the functionality,
  not the comms.

> Implementation is tracked separately in
> [`engineering/cr-001-edit-on-behalf-implementation-plan.md`](../engineering/cr-001-edit-on-behalf-implementation-plan.md).
> This section defines the *model* the implementation must satisfy.

---

## 10. Rounds & funding rules

For accounts that reach *Active · rounds scheduled*:

- The schedule **always displays the full span Yr 6 → Yr 13** (8 possible
  rounds); years **outside** the award are greyed out.
- **Standard** bursaries start at **Yr 6, 7, 9, or 12**.
- **Internal** bursaries can start at **any** year.
- Funding length: **max 8 years** (Yr 6 entry) · **min 1 year**.

**Parent view.** Active families see the schedule as a **read-only calendar** in
the portal (academic years + "due to be assessed May 2028, May 2029…"). It is
**informational only** — no action to take, and **no access to prior application
data**. Its value is the reassurance of a guaranteed future assessment each
remaining year.

---

## 11. Related form rules (income)

These are form-level rules, not states, but they define when the Application
reaches **Complete** (the required-fields/required-documents gate, §3):

- **Income layout** — a compact two-column ("balance sheet") layout: line item
  on the left, evidence on the right.
- **Conditional evidence** — an evidence upload is required **only when the line
  amount is > 0**; the application **cannot be submitted** until it is provided.
- **Self-employed** — a **single document** covers all self-employment lines.
- **Field rename** — the self-employed "(gross) salaried income" line is
  **"Gross earned income"**, to capture sole traders **and** owners who pay
  themselves a director's salary.
- **Zero-income acknowledgement** — when income is **0**, a
  **conditionally-required acknowledgement** must be ticked. It is a
  **persistent required field, not a dismissible pop-up**, so it cannot be
  bypassed: the application cannot be submitted until the applicant explicitly
  confirms zero income.

---

## 12. Provenance & change control

- **Origin** — the signed-off diagram
  [`bursary-application-flow.drawio`](../diagrams/bursary-application-flow.drawio)
  and the 2026-06-11 review meeting.
- **Precedence** — the diagram is authoritative on topology; this document is
  authoritative on definitions and rules. If they diverge, **re-sync to the
  diagram** and treat the divergence as a bug.
- **Persistence** — how these states map to enums, columns, and RLS is in
  [`engineering/data-model.md`](../engineering/data-model.md); where this model
  and the schema disagree, that is a bug to file.
- **Changes** — amend this document and the diagram **together**; never let one
  drift from the other.
