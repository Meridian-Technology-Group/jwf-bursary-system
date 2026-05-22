# 23 — Link siblings

Backlink: [[README#Sibling linking]]

Link this child to another bursary account so their assessments share
a family group. Sibling linking changes how the calculator absorbs
payable fees — older sibling fees are deducted from family HNDI
before computing the younger sibling's bursary.

## Prerequisites

- The current application has a `bursaryAccountId` (created on
  submission).
- The other child also has a `BursaryAccount` in the system (i.e. has
  registered against any round).
- Signed in as `ASSESSOR` or `ADMIN`.

## Steps

1. Open the application's **Applicant Data** tab. Scroll to the
   **Sibling Links** section at the bottom.
2. The **Link a Sibling** card sits below the existing **Linked
   Siblings** list. Strapline: *"Search for another bursary account
   to link as a sibling. Siblings are assessed sequentially — the
   older child's payable fees are deducted from the family HNDI before
   calculating the younger child's bursary."*
3. Type into the search box — placeholder *"Search by child name,
   reference, or email…"*. Query is debounced 300 ms and hits
   `GET /api/siblings/search?q=…`.
4. Results dropdown shows each match: child name, school, reference,
   lead applicant email. The current child is greyed out with
   *(current child)* and offers no link button.
5. Click **Link as Sibling** on the row you want to link. The icon
   spinner shows *"Linking…"*.
6. On success: toast *"`<Child name>` linked as sibling
   successfully"*; the **Linked Siblings** card refreshes with the
   new row.

## What happens server-side

- `POST /api/siblings` either creates a new `FamilyGroup` or joins the
  current child to the existing group of the target account.
- A `SiblingLink` row is written for the current child (and one for
  the target child if not already present).
- An audit entry records the link.

## Verification

- The **Linked Siblings** card shows both children with priority
  badges (1, 2, …). The current child has the primary-navy **This
  child** chip.
- Re-opening the assessment workspace shows the older sibling's
  yearly payable fees absorbed in the calculation sidebar.

## Troubleshooting

- *"Cannot link an account to itself"* — clicked **Link** on the
  current child row. Pick a different account.
- *"Failed to create sibling link"* — typically duplicate link or RLS;
  refresh the page and check the existing list.
