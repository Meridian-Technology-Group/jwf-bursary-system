# Item 6: Export format — Excel (likely already satisfied)

> Source: `docs/backlog/post-demo-change-list.md` — item 6. Status: Needs client confirmation — probably no work required.

The client asked to change the export format "from PDF to Excel," but there is no PDF list export to convert: the exports feature (`/exports` + `/api/exports/recommendations`, backed by ExcelJS) already produces XLSX/CSV. The only PDF in the system is the per-application *submission* document (`/api/pdf/submission/[applicationId]`), a single-application artefact rather than a list export. This is a confirmation spike, not a build task.

## Story 6.1 — Confirm the export already meets the client's Excel requirement
**As an** ADMIN (Charlotte), **I want** to confirm with the JWF team which export they were referring to, **so that** we can close this item if the current Excel output already satisfies them — or scope a genuinely new request if they meant something else.

**Acceptance criteria**
- [ ] Demonstrate the existing export to the client from `/exports`, showing that "Export recommendations" downloads a native `.xlsx` (and CSV) file, not a PDF.
- [ ] Confirm in writing (email/meeting note) which output the client saw when they raised "change from PDF to Excel" — the list export, the per-application submission PDF, or another artefact.
- [ ] If the client confirms the existing XLSX/CSV export is what they wanted: mark item 6 **Closed — no work required** in `docs/backlog/post-demo-change-list.md`, citing the confirmation.
- [ ] If the client instead meant the per-application submission PDF (`/api/pdf/submission/[applicationId]`) should also be available as Excel: record this as a **new, separate backlog item** with its own scope and acceptance criteria; do NOT expand item 6 to cover it.
- [ ] No code change is made under this story unless a new, distinct request is confirmed and separately scoped.

**Notes / dependencies**
- Premise check confirmed in code: there is no PDF list export to migrate. The list export is already Excel-native via ExcelJS (`/exports`, `/api/exports/recommendations`).
- The only PDF is `/api/pdf/submission/[applicationId]` — a single-application submission document, deliberately a PDF and out of scope for a list-export format change.
- Blocked on client availability for the confirmation conversation; no engineering dependency.
- Likely outcome: close with no work. Any real follow-on (e.g. an Excel variant of a per-application document) is a fresh item, sized on its own merits.
