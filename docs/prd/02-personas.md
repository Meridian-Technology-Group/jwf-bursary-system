## 2. Target Audience & User Personas

### 2.1 User Segments

The system serves three distinct user groups, only two of which interact with the platform directly:

| Segment | System Access | Volume |
|---------|--------------|--------|
| **Applicant (Lead Parent/Guardian)** | Applicant Portal | ~100-200 per annual round |
| **Assessor (Foundation Bursary Staff)** | Admin Console | 1-3 concurrent users |
| **School (Headmaster / Admissions)** | None (receives external exports) | 2 schools |

### 2.2 Persona: Lead Applicant

| Attribute | Detail |
|-----------|--------|
| **Who** | A parent or legal guardian applying for a bursary for their child. Typically the parent with primary custody, or one parent acting on behalf of a married/partnered couple. |
| **Context** | Their child has been offered a place (or is being considered for a place) at Trinity or Whitgift. The family believes they cannot afford the full school fees. They have been invited to apply by the Foundation. |
| **Technical comfort** | Varies widely — from digitally confident professionals to parents with limited English or low digital literacy. |
| **Goals** | Submit a complete, accurate application with all supporting documents within the deadline. Understand what is required at each step. Receive a clear outcome. |
| **Pain points with current system** | <ul><li>Confusing form layout — unclear what is required vs. optional</li><li>Difficulty understanding financial terminology (net vs. gross, monthly vs. yearly)</li><li>No clear progress indicator — unsure if the application is complete</li><li>Cannot easily see which documents are missing</li><li>Must re-enter all information from scratch for annual re-assessments with minimal pre-population</li><li>Receives no in-system status updates — relies on email from the assessor</li></ul> |
| **Single-user model** | Only the lead applicant has portal access. They answer on behalf of both parents. There is no second-parent login. |

### 2.3 Persona: Foundation Assessor

| Attribute | Detail |
|-----------|--------|
| **Who** | A member of the Foundation's bursary team responsible for reviewing applications, verifying financial data against source documents, running the assessment calculation, and producing recommendations for schools. |
| **Context** | Processes ~100-200 applications per annual round (new + re-assessments), plus ad-hoc internal bursary requests year-round. Works alone or with 1-2 colleagues. Is the sole maintainer of reference tables (notional rents, food/utility costs, school fees, council tax default). |
| **Technical comfort** | Confident with spreadsheets and the current Grant Tracker system. Not a developer, but comfortable with structured data entry and configurable settings. |
| **Goals** | Accurately assess each family's financial position. Produce a defensible, consistent recommendation. Manage the annual cycle efficiently. Maintain historical continuity across years for each bursary account. |
| **Pain points with current system** | <ul><li>Assessment is partly done in external spreadsheets — not integrated into the system</li><li>No side-by-side year-on-year comparison during re-assessments</li><li>Sibling linking is manual and fragile</li><li>No payable fees benchmark tracking — must manually compare against prior years</li><li>Recommendation text is stored in a plain text box with no structure</li><li>Missing documents require email communication outside the system, then manual re-attachment</li><li>The system uses research-grant terminology (grants, progress reports, funding rounds) that doesn't match the bursary domain</li><li>Limited export capabilities for reporting to schools</li></ul> |
| **Key responsibility** | The assessor builds an independent financial picture from source documents (P60s, tax returns, bank statements). They do **not** use the applicant's declared figures for the calculation — only the uploaded evidence. This "two-layer" model is fundamental to the role. |

### 2.4 Persona: School Headmaster / Admissions

| Attribute | Detail |
|-----------|--------|
| **Who** | The Headmaster (or delegated admissions staff) at Trinity School or Whitgift School. |
| **Context** | Receives the Foundation's bursary recommendations externally (spreadsheet export) and decides which candidates receive bursary-supported places, based on the recommendation, entrance exam results, and available funds. |
| **System access** | **None.** All communication is external due to GDPR. The school never logs into or views the bursary system. |
| **What they receive** | A recommendation per candidate containing: family synopsis (single/married, number of children, employment roles), accommodation status, income and property categories (not precise figures), bursary award recommendation (nominal £), payable fees recommendation (yearly/monthly), and any red flags. |
| **Implication for the product** | The system must produce a structured, exportable recommendation. No school-facing UI is required. |

---
