# CR-001: Assessor Edit-on-Behalf ("Impersonation")

**Change Request and Statement of Work under clause 9.5 of the Master Services Agreement**

> **DRAFT v1, for the Customer's approval.** Drafting notes are shown in
> blockquotes like this and must be removed before execution. No work will be
> undertaken until the Customer has approved this quote in writing (MSA
> clause 9.5(c)).

---

## 1. Reference and parties

| **CR reference**        | CR-001                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Title**               | Assessor edit-on-behalf of an applicant ("impersonation")                                                                |
| **Supplier**            | Result Driven Development LLC, trading as Meridian Technology Group                                                      |
| **Customer**            | The John Whitgift Foundation                                                                                             |
| **Governing agreement** | Master Services Agreement dated 1 May 2026 (the **"MSA"**)                                                               |
| **Mechanism**           | Change control, MSA clause 9.5; on approval this document becomes the signed statement of work required by clause 9.5(d) |
| **Classification**      | New major feature, **excluded** from the Annual Licence Fee under MSA clause 9.3, and therefore quoted separately        |

Capitalised terms not defined here have the meanings given to them in the MSA.

---

## 2. Background and rationale

The Platform as accepted is built on a deliberate division of responsibility:
the **applicant** completes the ten-section application form through the
Applicant Portal, and after submission the form becomes **read-only to the
applicant** (PRD AP-10) and is shown **read-only to staff** in the Admin
Console (PRD AC-04). The only "on behalf of" capability in the accepted scope
is **document attachment**: an assessor may upload supporting documents
received by email (PRD DM-02; Feature Verification Checklist §13). There is no
facility for an assessor to edit, correct or complete the **form fields**
themselves; where a submitted form is inadequate, the accepted process is to
**reject and ask the applicant to restart** (legacy process answer Q11).

The Customer has asked for a new capability allowing an assessor to **enter or
amend an applicant's form data on the applicant's behalf**, for example where
an application arrives by post or telephone, or where an applicant cannot
complete the Portal unaided. The Customer's informal name for this is
**"impersonation"**.

This is net-new functionality that **reverses an accepted design decision**
(read-only-after-submission; reject-and-restart). It is therefore handled as a
change request rather than as support or a minor enhancement, and it carries an
explicit Customer decision to depart from the accepted process, which approval
of this CR provides.

---

## 3. Solution overview

The change will be implemented as **scoped edit-on-behalf**, not as true
session impersonation.

> **Drafting note, why not "literal" impersonation.** True session
> impersonation (the assessor's browser assumes the applicant's identity) is
> deliberately **not** proposed. It is worse for the very thing a bursary
> assessment depends on (a trustworthy record of *who entered what*), because
> the assessor's actions would be indistinguishable from the applicant's in the
> audit trail. Scoped edit-on-behalf keeps the assessor logged in **as
> themselves**, opens the relevant application's form for editing, and stamps
> every assessor-entered value with the assessor's identity. It is the safer,
> more auditable, and lower-risk design, and it mirrors the existing
> "uploaded by assessor" document indicator the Customer already accepted
> (Feature Verification Checklist §13).

In summary, an authorised assessor will be able to:

- open a nominated application's form **in an editable mode** from the Admin
  Console, including after submission;
- complete or amend any section of the ten-section form on the applicant's
  behalf, using the same validation rules the applicant is held to; and
- do so under a clear, persistent visual indication that they are editing on
  the applicant's behalf.

Every such edit is **attributed to the assessor** and recorded in the audit
trail, and assessor-entered data is **visually distinguished** from
applicant-entered data in the same spirit as the existing document indicator.

---

## 4. Scope of work

### 4.1 In scope

- **(a) Assessor edit mode.** A new, permission-gated path from the Admin
  Console application detail view that opens the application's form for editing
  by an assessor, reusing the existing ten-section form and its validation
  rather than building a parallel form.
- **(b) Unlock of the read-only state.** Controlled relaxation of the
  post-submission read-only rule **for authorised assessors only**, scoped to a
  single named application at a time. The form remains read-only to the
  applicant.
- **(c) Permission and access control.** The capability is restricted to the
  **ASSESSOR** role (and above); **VIEWER** (read-only) accounts cannot edit.
  Access is enforced at the server, including at the database row-security
  layer, so an assessor cannot reach an application they are not entitled to.
- **(d) Provenance and audit.** Every field or section saved by an assessor on
  behalf of an applicant is attributed to that assessor, written to the audit
  trail as a distinct action, and **visually flagged** in the form as
  "entered by assessor" (consistent with the existing "uploaded by assessor"
  document indicator).
- **(e) Status and notification behaviour.** Defined, predictable interaction
  with the existing application status / paused / missing-documents model, and
  a single agreed decision on whether the applicant is notified when an
  assessor edits their application (see Decision D-CR1-1 in §9).
- **(f) Tests.** Automated test coverage for the new permission path, the
  row-security rules, and the audit/provenance behaviour, consistent with the
  Platform's existing test suite.
- **(g) Documentation.** Update of the Admin & Assessor Guide and a new line
  item in the Feature Verification Checklist so the capability can be signed
  off in the same way as the rest of the Platform.

### 4.2 Out of scope

The following are explicitly **not** included in this CR and would be quoted
separately if required:

- True session impersonation (assessor assuming the applicant's login/identity).
- A second-parent or multi-user login, or any change to the single-lead-applicant
  model (PRD AP-02).
- A dedicated postal/telephone **intake workflow** (queueing, batch entry,
  call-handling screens) beyond the single-application edit path in §4.1.
- Any change to the four-stage calculation model or the assessor's separate
  assessment data entry (these remain as accepted; this CR concerns the
  **applicant form**, not the assessment calculation).
- Applicant e-signature / re-declaration capture on an assessor-completed form,
  beyond the single notification decision in D-CR1-1.
- Migration or bulk back-entry of historical paper applications.

---

## 5. Acceptance criteria

The change is accepted when, on the staging environment and using an
**ASSESSOR** account:

- [ ] An assessor can open a submitted application and edit any of its ten sections, with the same validation the applicant experiences.
- [ ] A **VIEWER** (read-only) account **cannot** access edit mode.
- [ ] The application remains **read-only to the applicant** throughout.
- [ ] While editing, the assessor sees a **clear, persistent indication** that they are acting on the applicant's behalf.
- [ ] Fields/sections saved by the assessor are **visually distinguished** from applicant-entered data.
- [ ] Each assessor edit appears in the **audit trail**, attributed to the assessor, with a timestamp.
- [ ] An assessor cannot reach or edit an application they are not entitled to (server- and row-security-enforced).
- [ ] The agreed notification behaviour (D-CR1-1) is implemented as decided.
- [ ] The Admin & Assessor Guide and the Feature Verification Checklist are updated to cover the capability.

These criteria will be folded into the Feature Verification Checklist as a new
section so the Customer signs the change off using the established process.

---

## 6. Charges

| Item | Basis | Amount |
|---|---|---|
| CR-001 Assessor edit-on-behalf | **Fixed price** | **£600 (six hundred pounds sterling)** |

- The fee is a **fixed price** for the scope set out in §4.1, offered in
  preference to time-and-materials against the indicative rate card in MSA
  Schedule 2 §4.
- The fee is stated **net of VAT**, on the basis described in MSA clause 11.5
  (the Supplier is not registered for UK VAT as at the Effective Date; reverse
  charge applies where relevant).
- **Invoicing:** on Customer acceptance of the change (per §5), payable within
  **thirty (30) days** of the date of invoice, consistent with MSA clause 11.

> **Drafting note, pricing basis.** The Build Fee (£5,000) and Annual Licence
> Fee (£7,000) are priced as a proportion of system scope and value, reflecting
> AI-assisted delivery rather than team-based effort. This CR is priced on the
> same logic: a modest share of total system scope, with a change-request
> uplift over a strict pro-rata because it is a discrete piece of work that
> (a) carries none of the shared overhead of the bundled build, (b) touches the
> three highest-risk layers (authentication, row-level security, and the audit
> trail), and (c) requires the design judgement to reverse an accepted policy
> safely. £600 is the agreed fixed price on that basis.

---

## 7. Timeline

> **Drafting note:** confirm against the current branch (the
> missing-documents-workflow is in flight) and the next maintenance cycle.

- Indicative delivery: within **[X] Business Days** of written approval,
  delivered to the **staging** environment for the Customer's acceptance.
- Promotion to **production** follows Customer acceptance, under the normal
  release process, at a time agreed with the Customer.

---

## 8. Assumptions and dependencies

- The existing ten-section application form, its validation, the audit trail,
  and the role model (ASSESSOR / VIEWER) are reused as the basis for this work;
  no change to the calculation engine is required.
- Delivery follows the standard branch → staging → production workflow; the
  change is accepted on staging before any production promotion.
- The Customer provides a timely decision on D-CR1-1 (§9). Pricing assumes the
  single notification decision described there; a full applicant
  re-declaration / e-signature flow is out of scope (§4.2) and would be a
  separate CR.
- No change to infrastructure, vendors, or the Annual Licence Fee arises from
  this CR.

---

## 9. Open decision for the Customer

**D-CR1-1, Applicant notification on assessor edit.** When an assessor edits
an application on an applicant's behalf, should the applicant be:

- (a) **not notified** (assessor edits silently; audit trail is the record); or
- (b) **notified by email** that their application was updated by the bursary
      team on their behalf.

> **Drafting note:** the Supplier's recommendation is **(b)** for transparency
> and GDPR good practice (the applicant remains the data subject of the form),
> implemented as a single templated email reusing the existing email
> infrastructure. This is included within the £600 fixed price. Anything beyond
> a single notification (for example requiring the applicant to review and
> re-confirm an assessor-completed form) is out of scope (§4.2).

---

## 10. Signatures

On approval, this document constitutes the statement of work required by MSA
clause 9.5(d) and is governed by the terms of the MSA.

| | Supplier | Customer |
|---|---|---|
| **Name** | | |
| **Title** | | |
| **Signature** | | |
| **Date** | | |
