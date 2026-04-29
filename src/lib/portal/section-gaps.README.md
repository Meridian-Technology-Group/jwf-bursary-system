# section-gaps.ts — Mental Model & Usage Guide

## The Two-Layer Completeness Model

The portal tracks completeness in two layers:

**Layer 1 — DB boolean (`ApplicationSection.isComplete`)**
Set by the form's "Save & Continue" action. It answers "has the applicant
filled in and saved the form fields for this section?". It cannot answer
"are all required supporting documents uploaded?" or "is the children list
structurally valid?" because documents and list contents aren't captured by
the form-save boolean.

**Layer 2 — Derived validity (`SectionGapStatus.isFullyValid`)**
Computed by `getSectionGapStatuses()`. It combines the DB boolean with a
rule-evaluated `gaps` array. A section is `isFullyValid` only when:
  - `isDbComplete === true` (form has been saved), AND
  - no `error`-severity gaps remain (all required docs present, structural
    rules satisfied).

`warning`-severity gaps are surfaced in the review panel but do not block
submission gating.

## Gap Anatomy

```ts
{
  id: "PARENTS_INCOME:P60_PARENT_1",  // stable key for React + deep-links
  sectionType: "PARENTS_INCOME",
  label: "P60 for Parent/Guardian 1 is required",
  severity: "error",
  fieldRef: "parent1Income.p60DocumentId",  // scroll-to anchor in the form
}
```

## How to Add a New Rule

1. Find (or create) the evaluator for the target section in `SECTION_EVALUATORS`:

```ts
MY_SECTION: (raw, uploadedSlots) => {
  const gaps: SectionGap[] = [];
  const data = parseSectionData<MySectionData>(raw);
  if (!data) return gaps; // Not yet saved — no gaps.

  if (someCondition(data) && !uploadedSlots.has("MY_SLOT")) {
    gaps.push({
      id: "MY_SECTION:MY_SLOT",
      sectionType: "MY_SECTION",
      label: "Human-readable label for review panel",
      severity: "error",
      fieldRef: "myField.documentId",
    });
  }
  return gaps;
},
```

2. Update `SECTION_ITEM_TOTALS` in `computeProgress()` if the section now has
   more known required items than before (drives the progress bar denominator).

3. Run `npx tsc --noEmit` to confirm no type errors.

## Consuming the Output

### B2 — Document-Upload Gating
Call `getSectionGapStatuses(applicationId)` in the section page Server
Component. Use `status.gaps` to render inline "missing document" callouts.
Use `status.progress` to drive the per-section progress bar numerator/
denominator. A section gate (blocking "Save & Continue") should check
`status.isFullyValid` rather than the raw DB boolean.

### B3 — Dependent-Children Rule
`getSectionGapStatuses()` already derives:
- `DEPENDENT_CHILDREN:at_least_one` — no children in the list
- `DEPENDENT_CHILDREN:named_child_missing` — none marked isNamedChild
- `DEPENDENT_CHILDREN:named_child_duplicate` — more than one isNamedChild

Surface these in the `DependentChildrenForm` by passing the `gaps` array
down from the Server Component. The gap `fieldRef: "children"` points to
the list.

### B4 — Review Summary Issues Panel
Iterate over all `SectionGapStatus` results. For each section with
`gaps.length > 0`, render the gaps grouped under the section label.
Link each gap to `/apply/<section-slug>#<gap.fieldRef>` so applicants can
jump directly to the problem field. Only `error` gaps block submission;
show `warning` gaps with a softer indicator.

## Rules Currently Encoded

| Section | Doc/Rule | Condition |
|---|---|---|
| CHILD_DETAILS | BIRTH_CERTIFICATE | always (when section saved) |
| DEPENDENT_CHILDREN | at-least-one-child | children[] is empty |
| DEPENDENT_CHILDREN | named-child-present | none have isNamedChild=true |
| DEPENDENT_CHILDREN | named-child-unique | more than one isNamedChild=true |
| PARENTS_INCOME | P60_PARENT_1 | always |
| PARENTS_INCOME | P60_PARENT_2 | when parent2Income data present |
| PARENTS_INCOME | SELF_ASSESSMENT_PARENT_1 | dividend / rental / bond income > 0 |
| PARENTS_INCOME | SELF_ASSESSMENT_PARENT_2 | same, for P2 |
| PARENTS_INCOME | BENEFITS_EVIDENCE_PARENT_1 | working tax credits / other benefits > 0 |
| PARENTS_INCOME | BENEFITS_EVIDENCE_PARENT_2 | same, for P2 |
| PARENTS_INCOME | CAPITAL_REPAYMENTS_PARENT_1 | hasCapitalRepayments === true |
| PARENTS_INCOME | CAPITAL_REPAYMENTS_PARENT_2 | same, for P2 |
| ASSETS_LIABILITIES | COUNCIL_TAX | always |
| ASSETS_LIABILITIES | BANK_STATEMENT_PARENT_1 | always |
| ASSETS_LIABILITIES | BANK_STATEMENT_PARENT_2 | when P2 data present in form |

## Rules NOT Yet Encoded (for B2/A4)

- **FAMILY_ID**: Passport / ILR docs are per-family-member with dynamic slot
  keys (FAMILY_ID_PASSPORT_0, FAMILY_ID_ILR_0, …). Requires enumerating
  familyMembers and checking each one's citizenship flag.

- **PARENT_DETAILS**: Certified accounts / balance sheet for directors are
  stored as document IDs in the form data but don't yet map to canonical
  Document slots (CERTIFIED_ACCOUNTS_PARENT_1/2). Wire once upload UI is done.

- **DEPENDENT_ELDERLY / OTHER_INFO**: Care-home invoice and court-order docs
  are optional evidence; assess whether they should become required.
