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
| **Applicant** | Blue | The parent / lead applicant. **Owner of application data** — changes are made directly by the applicant, or by staff via the audited CR-001 scoped edit-on-behalf mechanism with per-field provenance (see §9). |
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
| **In Progress** | The applicant is actively working the form: ≥ 1 field entered or ≥ 1 document uploaded. Free navigation between sections; partial saves allowed. | Applicant enters a field / uploads a document. |
| **Complete** | Every required field **and** required document is present — but the applicant has **not yet pressed Submit**. A distinct, visible state so staff can see "all done, just needs the button" and chase accordingly. | All required fields + documents present. |
| **Submitted** | A **brand-new** application that has been submitted. | Applicant hits Submit and **no** existing account (new). |
| **Received** | A **rollover** application (existing account with a prior round schedule) that has been submitted. Same applicant action as *Submitted*; the distinct label flags it as a reassessment, not a first-time application. | Applicant hits Submit and **an** existing account (rollover). |

> **"Started" is not a distinct runtime state.** The accepted pre-work state is
> **`CREATED`** — the record exists and the applicant can log in, but no
> assessable work has been done. We deliberately do **not** model a separate
> "Started" state (the earlier "opened the link / set a password" idea): there
> is **no login telemetry** to detect it reliably, so distinguishing it from
> `CREATED` would be unobservable. *Sent* (invitation issued) and *CREATED*
> (record present, pre-work) cover the pre-`In Progress` lifecycle; the first
> observable signal is the move to *In Progress* when a field is entered or a
> document is uploaded.

> **A correction request is not a separate application state.** When the
> assessor requests additional documentation, the application form **stays
> Submitted/Received** with its **original submission date preserved** — the
> hold lives on the assessment as `AssessmentStatus.PAUSED` + `pausedUntil`
> (§4), and the parent continues to see "Being assessed".

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(START)* | Sent | creates applicant record & sends invitation | Assessor |
| Sent | CREATED | applicant record exists; applicant can log in (pre-work) | Applicant / System |
| CREATED | In Progress | enters a field / uploads a document (partial save) | Applicant |
| In Progress | Complete | all required fields + documents present | Applicant |
| Complete | **Submitted** | hits Submit — **new** (no existing account) | Applicant → *System* routes |
| Complete | **Received** | hits Submit — **rollover** (existing account) | Applicant → *System* routes |
| Submitted / Received | *(assessment paused)* | assessor requests documentation — form unchanged, *original submission date kept*; assessment → `PAUSED` + `pausedUntil` (§4) | Assessor |
| *(assessment paused)* | *(assessment resumes)* | applicant uploads the missing documents | Applicant |
| Submitted / Received | **CREATED** | **REJECT** → void + recreate: the prior application is voided and a new one is created reusing the **same application reference**; login kept, fields cleared, no submission date carried over | Assessor |
| Submitted / Received | **In Progress** | **material change** → re-submission needed (assessor edits via CR-001 scoped edit-on-behalf, §9) | Assessor |
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
| **Paused** | The assessment is held awaiting requested documentation. Persisted as `AssessmentStatus.PAUSED` + a `pausedUntil` date; the application form stays Submitted/Received and the parent sees "Being assessed". Resumes (not discarded) when the docs arrive. | Assessor requests documentation. |
| **Complete** *(report to school)* | Assessment finished and reported to the school / admissions. | Assessor marks Complete. |

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(application Submitted / Received)* | **Not Started** | application submitted / received | System |
| Not Started | In Progress | begins assessment | Assessor |
| In Progress | **Paused** | request documentation → `AssessmentStatus.PAUSED` + `pausedUntil`; form unchanged | Assessor |
| Paused | **In Progress** | applicant uploads the missing documents → **assessment resumes** (not discarded) | Applicant |
| In Progress | **Complete** | marks Complete & reports to school | Assessor |
| In Progress | **Not Started** | **assessment discarded** — on REJECT or material change | System |

> **Documents vs. data — the critical distinction.** Requesting *documents*
> **pauses** the assessment (`AssessmentStatus.PAUSED` + `pausedUntil`) and
> resumes it when they arrive — the data the parent submitted is untouched and
> the form stays Submitted/Received. A *material change* to the data **discards**
> the assessment, which must be re-run after re-submission. See §7.

---

## 5. Bursary Account track

The long-lived family/child shell. Outlives individual applications and carries
the round schedule.

### States

| State | Meaning |
|---|---|
| **Active** | The account is live. It has two facets in the diagram, both the same *Active* state at different points in the lifecycle: **· Application available** — the portal is open and an application is in flight (entered once the application reaches *In Progress*); **· rounds scheduled (Yrs 6–13)** — after an award, with a schedule of future assessment rounds attached. |
| **Closed** | The account is closed. **Not** an immediate purge: closure starts the tiered-retention clock (D6) — a grace window, then tiered retention years, after which data is purged subject to `RETENTION_PURGE_ENABLED`. Terminal for the lifecycle; data disposal follows the retention policy below. |

### Transitions

| From | To | Trigger / action | Actor |
|---|---|---|---|
| *(application In Progress)* | **Active** · Application available | an application is available to work on | System |
| *(assessment Complete — **new**)* | **School decision** | report to admissions | Assessor |
| School decision | **Active** · rounds scheduled | **OFFERED** → activate + attach round schedule | School / Admissions |
| School decision | **Closed** | **DECLINED** → close; data retained then purged per the tiered-retention policy (D6), not purged on decline | School / Admissions |
| *(assessment Complete — **rollover**)* | **Active** *(stays)* | no decision needed | System |
| Active | **Closed** | **WITHDRAWAL** → assessor closes (any time · account level · no documents) | Assessor |

> **Closure does not purge immediately (D6, built).** Whether a *Declined* (new)
> or *Withdrawal* close, the account enters *Closed* and data is governed by the
> **tiered-retention policy**: a grace window followed by tiered retention years,
> with the purge step gated by the `RETENTION_PURGE_ENABLED` flag. That flag is
> currently **unset**, so the purge cron runs **report-only** — nothing is
> destroyed yet.
>
> ⚠️ **Flagged for review:** the **DPO still owes the retention-year sign-off**
> (D6). The concrete retention durations are not finalised until that sign-off
> lands.

---

## 6. Cross-track synchronisation & gates

How the three tracks stay in step:

1. **Assessment gate.** An assessment **cannot begin until the application is
   *Submitted* or *Received***. There is no assessing of an in-flight form.
2. **Auto-create.** Reaching *Submitted* / *Received* creates the Assessment in
   *Not Started* (system).
3. **Documents-only correction.** Assessment *In Progress* → assessment
   **`PAUSED` + `pausedUntil`** (the application form stays Submitted/Received;
   the parent sees "Being assessed"); the assessment is **held, not discarded**,
   and **resumes** when the applicant uploads the docs. **Original submission
   date preserved.**
4. **Hard reject — void + recreate.** Assessment *In Progress* → **discarded**
   to *Not Started*; the application is **voided and a new one recreated reusing
   the same application reference** — a hard reset of the outcome, not an
   in-place reset: the login is kept, all fields are cleared, and no submission
   date is carried over. *(GDPR: see §7.3.)*
5. **Material change.** Assessment *In Progress* → **discarded** to *Not
   Started*; application back to *In Progress*; the **original submission date
   is preserved** (write-once) on re-submit; a **fresh** assessment runs.
   *(Per D-G6/D3 — see §7.6.)*
6. **Completion.** Assessment *Complete* → for a **new** application, a *School
   decision*; for a **rollover**, the account simply **stays Active**.
7. **Award.** *Offered* → account *Active · rounds scheduled* + schedule
   attached. *Declined* → account *Closed*; data is **retained then purged per
   the tiered-retention policy (D6)**, not purged on decline (see §5).
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
   - **Documents-only** (*request documentation* → assessment **`PAUSED` +
     `pausedUntil`**, form unchanged): original submission date **kept**;
     assessment **preserved** and resumed; the submitted **data is not altered**.
     This is append-only — it preserves evidence and any dishonesty flags the
     assessor has noticed.
   - **Data change** (*material change* → application *In Progress*): the
     **original submission date is preserved** (write-once) on re-submit;
     assessment **discarded** and re-run. **Any** material change — accidental,
     a misunderstanding, or deliberate — invalidates an in-flight assessment.
3. **Hard reject is void + recreate, not an in-place reset.** The prior
   application is **voided and a new one is recreated reusing the same
   application reference**: login / password are kept, all fields are cleared,
   and no submission date is carried over. The parent re-enters from a fresh
   *CREATED* application. *"We never give up on the parent."*
   ⚠️ **Flagged for review:** the **GDPR-acceptability of destroying the prior
   application data** on reject should be confirmed before this is relied upon in
   production.
4. **New vs. rollover** diverge at two points: the submission label
   (*Submitted* vs *Received*) and completion behaviour (*School decision* vs
   *stays Active*). See §8.
5. **Rollover never fails out.** A rollover assessment that does **not** qualify
   still reaches *Complete* and the account **stays Active**.
6. **Submission date** is **write-once** (D-G6/D3): the **original** Submit
   date is preserved across **both** correction paths — the documents-only
   pause and the material-change re-submit — and is never re-stamped within an
   application's lifecycle. (A rollover round is a *new* application with its
   own submission date.)
7. **Withdrawal** is account-level, available at any time, and requires **no
   documents**.
8. **Data ownership.** The applicant is the owner of application data. Staff
   changes happen **only** through the audited **CR-001 scoped edit-on-behalf**
   mechanism (§9), with each edited field attributed to the staff member via
   `assessor_provenance` — never by a silent or unattributed staff write.

---

## 8. New vs. rollover

The same Application and Assessment tracks serve both, but two behaviours
differ:

| | **New application** | **Rollover** (existing account) |
|---|---|---|
| Account before submit | *Active · Application available* (no prior rounds) | *Active · rounds scheduled* (prior rounds exist) |
| Submission label | **Submitted** | **Received** |
| After assessment *Complete* | Goes to **School decision** (report to admissions) | **No decision** — account **stays Active** |
| Possible outcomes | *Offered* → Active + rounds · *Declined* → Closed (data retained then purged per tiered retention, §5) | Continues; even non-qualifying rounds Complete and stay Active |
| Who triggers the next application | — | System opens the next round → new *In Progress* application |

The school's outcome terminology is **Offered** / **Declined**. The assessor
reports a batch of completed assessments to admissions; the school selects which
are offered (e.g. 60 reported → 20 offered → 40 declined, each closed and held
for the tiered-retention window before purge, §5).

> The **Submitted** (new) and **Received** (rollover) labels above are
> authoritative and unchanged. The application code now matches the model on
> these labels — the previously inverted side was in the code and was corrected
> separately; this document was already correct.

---

## 9. Edit-on-behalf (scoped, per-field provenance)

**Requirement.** Some parents (~10) need staff to complete or correct their
application for them — they cannot find Submit, do not know how to reveal the
second-parent section, or otherwise cannot self-serve. Staff must be able to act
on the application on the applicant's behalf.

**Mechanism — CR-001 scoped edit-on-behalf, not impersonation.** Staff **remain
themselves** throughout; they do **not** assume the applicant's identity. They
make a scoped edit to the application and **each edited field is attributed to
the staff member via `assessor_provenance`** — so the record carries exactly who
changed what, field by field, alongside the applicant's own entries.

**Why not impersonation.** An impersonation design (staff acting *as* the
applicant) was **considered and rejected by contract**, on
audit-trustworthiness grounds: recording a staff edit as if it were the
parent's own action makes the audit trail misrepresent authorship. Per-field
provenance is the GDPR-defensible alternative — the change is always
attributable to the staff member, never silently folded into the parent's edits.

> The signed-off diagram is **silent on the edit mechanism** — it does not
> depict impersonation or provenance — so specifying CR-001 scoped
> edit-on-behalf here does **not** conflict with "the diagram wins" (§12).

**Status interaction.** To edit a *Submitted* / *Complete* application, staff
first move it back to **In Progress**, then make the scoped edit and re-submit.
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

### Reconciliation log

- **2026-06-19 — reconciled to as-built (decisions D-G1, D-G3, D-G5, D-G8,
  D-G12).** Following the gap analysis, the model text was amended where the
  as-built system is authoritative. The diagram topology is unchanged; these are
  textual corrections only.
  - **D-G1 (§3)** — dropped "Started" as a distinct runtime state; `CREATED` is
    the accepted pre-work state (no login telemetry to detect "Started").
  - **D-G3 (§3/§4/§6/§7)** — a paused assessment is `AssessmentStatus.PAUSED` +
    `pausedUntil`; the application form stays Submitted/Received ("Being
    assessed"). Replaces the app-side "Submitted with Correction" notion;
    functionally identical to the model's intent.
  - **D-G5 (§3/§6.4/§7.3)** — reject is **void + recreate** reusing the same
    application reference, not an in-place reset. ⚠️ GDPR-acceptability of
    destroying the prior application data **flagged for external sign-off**.
  - **D-G8 (§9, §2)** — edit-on-behalf is the CR-001 **scoped, per-field
    provenance** mechanism (`assessor_provenance`); impersonation was rejected by
    contract on audit-trustworthiness grounds. The diagram is silent on the
    mechanism, so this does not conflict with "diagram wins".
  - **D-G12 (§5/§7/§8)** — decline/closure does **not** purge immediately;
    governed by the D6 tiered-retention policy (grace window + tiered retention
    years, `RETENTION_PURGE_ENABLED` report-only today). ⚠️ DPO **retention-year
    sign-off** still owed — **flagged for external sign-off**.
  - **D-G6/D3 (§6.5/§7.2/§7.6)** — post-submission material change **keeps the
    original submission date** (write-once), rather than re-stamping a new one.
    The assessment is still discarded and re-run; only the date semantics were
    aligned to the built behaviour (no `submitted_at` migration).
  - **§10** — confirmed the final eligible school year is **Year 13** (no change
    required).
  - **Submitted/Received labels** — confirmed correct as written; the code was
    the inverted side and was fixed separately.
