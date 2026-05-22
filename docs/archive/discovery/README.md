# Discovery

As-is artifacts captured during the discovery phase — documentation of the
**legacy systems and processes this project replaces**. These describe *what
existed before*, not what we built.

Keep this separate from [`product/`](../product/) (the requirements and specs
for the system we're building) so the two are never confused: a discovery doc
records the old world for context and traceability; a product spec defines the
new one.

## Contents

| Document | What it captures |
|---|---|
| [`admin-console.md`](admin-console.md) | The Foundation's legacy **Symplectic Grant Tracker** management console — the as-is admin/assessor workflow the new system replaces. Originally the "baseline for the replacement" referenced from the PRD. |

> The applicant-side as-is form lived in `product/specs/applicant-form.md`; that
> file remains under `product/specs/` because it is maintained as the field-level
> spec for the **new** portal (see its own status banner for currency).
