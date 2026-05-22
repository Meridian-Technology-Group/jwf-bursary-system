## 7. System Components & Modules

Each module is described in terms of its responsibility, key components, interfaces, and dependencies. Modules align to the `src/` directory structure defined in Section 3.1.2.

### 7.1 Applicant Portal

**Responsibility:** Provide an invitation-only, mobile-first web application where lead applicants complete multi-step bursary applications with document uploads, save/resume capability, and clear progress tracking.

**Routes:** `src/app/(portal)/...`

**Key components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `SectionForm` | `components/portal/section-form.tsx` | Generic wrapper for each form section. Handles field rendering from a section schema, conditional logic, inline validation, and save (server action). |
| `FileUpload` | `components/portal/file-upload.tsx` | Drag-and-drop upload slot per document type. Shows file name, size, status (uploading / uploaded / error). Supports PDF, JPEG, PNG up to 20 MB. Calls `/api/documents` for upload. |
| `ProgressBar` | `components/portal/progress-bar.tsx` | Left sidebar (desktop) or top bar (mobile) showing all sections with complete/incomplete/not-started status. Clicking a section navigates to it. |
| `ValidationSummary` | `(portal)/apply/review/page.tsx` | Pre-submission screen listing all incomplete required fields and missing uploads, grouped by section with click-through links. Submit button enabled only when all requirements are met. |
| `ConditionalField` | `components/portal/conditional-field.tsx` | Renders or hides fields based on parent field values. Driven by a declarative condition map (see below). |

**Form section schema:** Each section is defined as a declarative schema object:

```typescript
// Example: simplified section schema
const childDetailsSchema: SectionSchema = {
  section: 'CHILD_DETAILS',
  fields: [
    { name: 'school', type: 'select', required: true, options: ['Trinity School', 'Whitgift School'] },
    { name: 'entry_year', type: 'select', required: true, options: ['Year 6', 'Year 7', 'Year 9', 'Year 12', 'Other'] },
    { name: 'child_full_name', type: 'text', required: true },
    { name: 'child_dob', type: 'date', required: true },
    // ...
  ],
  conditions: [
    { when: { field: 'entry_year', equals: 'Other' }, show: ['entry_year_other'] },
    { when: { field: 'child_address_same_as_parent', equals: false }, show: ['child_address_line_1', 'child_address_line_2', 'child_city', 'child_postcode', 'child_country'] },
  ],
  uploads: [
    { slot: 'BIRTH_CERTIFICATE', label: 'Child\'s full birth certificate', required: true },
  ],
};
```

This declarative approach means adding or modifying form fields requires editing schema objects, not component code. The `SectionForm` component renders any section from its schema.

**Save and resume:** Each section saves independently via a server action that upserts the `ApplicationSection` row for that section. Data is serialised as JSONB. The `is_complete` flag is computed by checking all required fields and uploads for the section. On return visits, the page loads the saved JSONB and hydrates the form.

**Pre-population for re-assessments:** When `Application.is_reassessment = true`, the server component loads the previous year's `ApplicationSection` data for `CHILD_DETAILS` and `PARENT_DETAILS` sections and passes it as `defaultValues` to the form. The applicant can edit these values. The `FAMILY_ID` section is hidden entirely (ID documents are not re-collected).

**Mobile responsiveness:** All form components use Tailwind responsive classes. The progress sidebar collapses to a horizontal stepper on mobile. File upload uses the native file picker (no drag-and-drop on mobile). Currency inputs use `inputmode="decimal"` for numeric keyboard.

**Dependencies:**
- `lib/db/queries/applications.ts` — CRUD for Application and ApplicationSection
- `lib/storage/documents.ts` — file upload
- `lib/auth/supabase.ts` — session + user context

---

### 7.2 Admin Console

**Responsibility:** Provide the assessor's workspace for managing rounds, reviewing applications, performing assessments, producing recommendations, and running reports.

**Routes:** `src/app/(admin)/...`

#### 7.2.1 Application Queue

**Route:** `(admin)/queue/page.tsx`

| Aspect | Detail |
|--------|--------|
| **Rendering** | Server component fetches data; client component handles filtering/sorting |
| **Default columns** | Reference, School, Status, Submission Date, Assessor Notes flag, Red Flags |
| **Name masking (NM-01)** | Child Name and Lead Applicant columns are **not included in the initial server query**. A "Show Names" toggle triggers a separate client-side fetch to `/api/applications/names?ids=...` that returns names for the current page. This fetch is audit-logged server-side (action: `NAME_REVEAL`, context: `application_queue`). |
| **Filtering** | Status (multi-select), School (Trinity/Whitgift), Round (dropdown). Applied server-side via query params. |
| **Sorting** | Click column headers. Client-side for the current page; server-side for full-set sort (pagination reset). |
| **Pagination** | Cursor-based pagination, 25 rows per page. |
| **Actions** | Row click → Application Detail. Bulk select → batch status update or batch reminder email. |

**Key component:** `components/admin/application-table.tsx` — built on shadcn/ui's `DataTable` (Tanstack Table underneath). Column definitions include the conditional name columns.

#### 7.2.2 Application Detail

**Route:** `(admin)/applications/[id]/...`

A tabbed layout with four tabs, each a nested route:

| Tab | Route | Content | Rendering |
|-----|-------|---------|-----------|
| **Applicant Data** | `.../page.tsx` | Read-only view of all applicant-submitted form sections + inline document viewer. Full names visible (NM-04 context). | Server component |
| **Assessment** | `.../assess/page.tsx` | Split-screen: document viewer + data entry form. See 7.2.3. | Client component |
| **Recommendation** | `.../recommend/page.tsx` | Structured recommendation form with reason codes. | Client component |
| **History** | `.../history/page.tsx` | Previous years' assessments (for re-assessments), audit trail. | Server component |

#### 7.2.3 Split-Screen Assessment

**Route:** `(admin)/applications/[id]/assess/page.tsx`

The core assessor workspace (PRD AE-17, US-B15). Implemented as a client component with data fetched on mount via server action.

```
┌───────────────────────────────────────────────────────────────────┐
│  Reference: WS-0042  │  Family Type: ▼ Cat 3  │  Status: ●       │
├────────────────────────┬──────────────────────────────────────────┤
│                        │                                          │
│   DOCUMENT VIEWER      │   DATA ENTRY FORM                       │
│                        │                                          │
│  ┌──────────────────┐  │   Parent 1 — Employment Status           │
│  │ Select document ▼│  │   ┌────────────────────────────────┐    │
│  │ • P60 - Parent 1 │  │   │ ○ PAYE  ○ Benefits  ○ Self-emp│    │
│  │ • Tax Return P1  │  │   └────────────────────────────────┘    │
│  │ • Bank Stmt P1   │  │                                          │
│  │ • P60 - Parent 2 │  │   Net Pay          £ [__________]       │
│  │ • Council Tax    │  │   Benefits (incl)  £ [__________]       │
│  └──────────────────┘  │   Benefits (excl)  £ [__________]       │
│                        │   Dividends        £ [__________]       │
│  ┌──────────────────┐  │                                          │
│  │                  │  │   Parent 2 — Employment Status           │
│  │   [PDF/Image     │  │   ...                                    │
│  │    rendered       │  │                                          │
│  │    inline]        │  │  ┌──────────────────────────────────┐   │
│  │                  │  │  │ Stage 1: Net Income    £42,500.00│   │
│  │  ← Page  1/3 →  │  │  │ Stage 2: Net Assets   £38,020.00│   │
│  │  🔍 Zoom + / -   │  │  │ Stage 3: HNDI after NS£27,520.00│   │
│  │                  │  │  │ Stage 4: Bursary      £ 4,232.00│   │
│  └──────────────────┘  │  │                                  │   │
│                        │  │ Yearly Payable Fees   £25,463.20│   │
│  ◄──── drag ────►     │  │ Monthly Payable Fees  £ 2,121.93│   │
│                        │  └──────────────────────────────────┘   │
└────────────────────────┴──────────────────────────────────────────┘
```

**Left panel — Document Viewer:**

| Component | Detail |
|-----------|--------|
| `DocumentViewer` | `components/admin/document-viewer.tsx` |
| Document selector | Dropdown listing all documents uploaded for this application, grouped by slot (e.g., "P60 — Parent 1", "Bank Statement — Parent 1 — Page 1"). |
| PDF rendering | Uses the browser's native PDF rendering via `<iframe>` with the pre-signed URL from Supabase Storage. Fallback: `react-pdf` library for more control. |
| Image rendering | `<img>` tag with pre-signed URL. Zoom via CSS transform. |
| Page navigation | For multi-page PDFs, browser-native controls within the iframe. |
| Zoom | +/− buttons that scale the iframe or image. |

Pre-signed URLs are fetched server-side with a 60-minute expiry. The document viewer requests a URL when the assessor selects a document.

**Right panel — Data Entry Form:**

| Component | Detail |
|-----------|--------|
| `AssessmentForm` | `components/admin/assessment-form.tsx` |
| Form state | React Hook Form (`useForm`) with Zod validation schema. |
| Live calculation | On every field change, the pure assessment functions (`lib/assessment/calculator.ts`) run client-side. Results update instantly in the calculation display at the bottom. No server round-trip. |
| Anonymised labels | Header shows reference number. Earner sections labelled "Parent 1", "Parent 2" — not real names (NM-02). |
| Reference value pre-fill | When the assessor selects a Family Type Category, notional rent / utility / food fields auto-populate from the reference config. School selection auto-populates fees. Entry year auto-populates years remaining. All are editable. |
| Save | Server action `saveAssessment()`. Re-runs the calculation server-side, compares with client result, stores the server-computed values as canonical. |

**Resizable split:** `components/admin/split-screen.tsx` — built on shadcn/ui's `ResizablePanelGroup` (which wraps `react-resizable-panels`). Default split: 40% document viewer / 60% form. Drag handle in the middle. Minimum panel width: 300px.

#### 7.2.4 Round Management

**Route:** `(admin)/rounds/...`

| Feature | Detail |
|---------|--------|
| Create round | Form: academic year, open date, close date, decision date. Only one round can be `OPEN` at a time. |
| View rounds | Table of all rounds with status. Click to view/edit. |
| Close round | Changes status to `CLOSED`. Prevents new submissions. Existing applications remain accessible. |

#### 7.2.5 Reference Table Management

**Route:** `(admin)/settings/...`

Tabbed interface. Each tab shows the current reference values in an editable table.

| Tab | Entity | Editable fields |
|-----|--------|----------------|
| Family Types | FamilyTypeConfig | Notional rent, utility costs, food costs per category (1–6) |
| School Fees | SchoolFees | Annual fees per school |
| Council Tax | CouncilTaxDefault | Amount, description |
| Reason Codes | ReasonCode | Label, sort order, deprecated flag. Add new codes. |

**Versioning:** When values are updated, a new row is inserted with `effective_from = today`. The previous row remains for historical reference. The system always reads the row with the latest `effective_from` for new assessments.

#### 7.2.6 Dashboard

**Route:** `(admin)/page.tsx`

Server component. Fetches aggregate counts for the current (or most recent) round:

| Tile | Query |
|------|-------|
| Pre-Submission | `WHERE status = 'PRE_SUBMISSION'` |
| Submitted | `WHERE status = 'SUBMITTED'` |
| Not Started | `WHERE status = 'NOT_STARTED'` |
| Paused | `WHERE status = 'PAUSED'` |
| Completed | `WHERE status = 'COMPLETED'` |
| Qualifies | `WHERE status = 'QUALIFIES'` |
| Does Not Qualify | `WHERE status = 'DOES_NOT_QUALIFY'` |

Each tile is a clickable card that navigates to the queue pre-filtered by that status.

---

### 7.3 Assessment Engine

**Responsibility:** Implement the four-stage financial calculation and payable fees formula as pure, deterministic, testable TypeScript functions.

**Location:** `src/lib/assessment/`

This module is covered in detail in Section 3.5. This section specifies the function signatures and integration pattern.

#### 7.3.1 Function Signatures

```typescript
// lib/assessment/types.ts

interface EarnerInput {
  earnerLabel: 'PARENT_1' | 'PARENT_2';
  employmentStatus: EmploymentStatus;
  netPay: number;
  netDividends: number;
  netSelfEmployedProfit: number;
  pensionAmount: number;
  benefitsIncluded: number;
  benefitsExcluded: number;  // recorded but not added to income
}

interface AssessmentInput {
  earners: EarnerInput[];
  familyTypeCategory: number;           // 1–6
  notionalRent: number;
  utilityCosts: number;
  foodCosts: number;
  annualFees: number;
  councilTax: number;
  schoolingYearsRemaining: number;
  isMortgageFree: boolean;
  additionalPropertyIncome: number;
  cashSavings: number;
  isasPepsShares: number;
  schoolAgeChildrenCount: number;
  scholarshipPct: number;               // 0–100
  vatRate: number;                       // default 20
  manualAdjustment: number;             // default 0
  siblingPayableFees: number[];         // payable fees of older siblings (for deduction)
}

interface StageResults {
  stage1_totalHouseholdNetIncome: number;
  stage2_netAssetsYearlyValuation: number;
  stage3_hndiAfterNS: number;
  stage4_requiredBursary: number;
}

interface AssessmentOutput {
  stages: StageResults;
  grossFees: number;
  scholarshipDeduction: number;
  bursaryAward: number;
  netYearlyFees: number;
  vatAmount: number;
  yearlyPayableFees: number;
  monthlyPayableFees: number;
  adjustedYearlyPayableFees: number;    // after manual adjustment
  adjustedMonthlyPayableFees: number;
}
```

```typescript
// lib/assessment/calculator.ts

function calculateAssessment(input: AssessmentInput): AssessmentOutput;

// Individual stages (exported for unit testing)
function calculateHouseholdIncome(earners: EarnerInput[]): number;
function calculateNetAssets(income: number, property: PropertyInput, savings: SavingsInput): number;
function calculateLivingCosts(netAssets: number, utilityCosts: number, foodCosts: number): number;
function calculateBursaryImpact(hndiAfterNS: number, annualFees: number): number;
function calculatePayableFees(grossFees: number, scholarshipPct: number, bursaryAward: number, vatRate: number, manualAdjustment: number): PayableFeesResult;
function applySiblingDeductions(hndiAfterNS: number, siblingPayableFees: number[]): number;
```

#### 7.3.2 Integration Pattern

```
                     AssessmentForm (client component)
                           │
                           │ on field change
                           ▼
              ┌─── calculateAssessment(input) ───┐
              │    (client-side, instant)         │
              │    → updates calculation display  │
              └──────────────────────────────────┘
                           │
                           │ on save
                           ▼
              ┌─── saveAssessment() server action ─┐
              │    1. Validate input (Zod)          │
              │    2. calculateAssessment(input)     │
              │       (server-side, canonical)       │
              │    3. Compare client vs server result│
              │       (log warning if mismatch)      │
              │    4. Upsert Assessment + Earner +   │
              │       Property rows (Prisma)         │
              │    5. Return saved result            │
              └─────────────────────────────────────┘
```

The same `calculateAssessment` function is imported by both the client component and the server action. This is possible because it has no server-only dependencies (no Prisma, no Supabase, no Node APIs).

#### 7.3.3 Sibling Deduction Flow

When sibling links exist, the assessment flow is:

1. Assessor opens Child 2's assessment.
2. Server action loads Child 1's completed assessment and extracts `yearlyPayableFees`.
3. This value is passed into `AssessmentInput.siblingPayableFees`.
4. `applySiblingDeductions()` subtracts these fees from Child 2's `hndiAfterNS` before Stage 4.
5. Result: Child 2 qualifies for a larger bursary because the household's disposable income is already committed to Child 1's fees.
6. For a third child: `siblingPayableFees = [child1Fees, child2Fees]`, both deducted.

---

### 7.4 Document Management

**Responsibility:** Handle file uploads, storage, access control, inline viewing, and lifecycle management for applicant-submitted documents.

**Location:** `src/lib/storage/documents.ts`, `src/app/api/documents/...`

#### 7.4.1 Upload Flow

```typescript
// POST /api/documents
// Multipart form data: file, application_id, slot

async function uploadDocument(req: Request) {
  // 1. Authenticate — verify user is the application's lead applicant or an assessor
  // 2. Validate file type (PDF, JPEG, PNG only) and size (≤ 20 MB)
  // 3. Generate storage path: documents/{application_id}/{slot}/{uuid}_{filename}
  // 4. Upload to Supabase Storage (encrypted bucket)
  // 5. Insert Document row in database (Prisma)
  // 6. Return { id, filename, slot, uploaded_at }
}
```

#### 7.4.2 Download / View

```typescript
// GET /api/documents/[id]/url
// Returns a pre-signed URL for the document (60-minute expiry)

async function getDocumentUrl(documentId: string) {
  // 1. Authenticate
  // 2. Authorise: applicant can only access own documents; assessor can access all
  // 3. Look up storage_path from Document table
  // 4. Call supabase.storage.from('documents').createSignedUrl(path, 3600)
  // 5. Return { url, expires_at }
}
```

The split-screen document viewer (Section 7.2.3) calls this endpoint when the assessor selects a document. The URL is loaded into an iframe (PDF) or img tag (image).

#### 7.4.3 Verification

The assessor marks each document slot as verified via a server action:

```typescript
async function verifyDocument(documentId: string, isVerified: boolean) {
  // 1. Authorise: assessor only
  // 2. Update Document.is_verified
  // 3. Log to AuditLog
}
```

The application detail view shows a summary of document completeness (all slots green-ticked = ready for assessment).

#### 7.4.4 Admin Upload (Email-Received Documents)

When an applicant sends documents by email, the assessor can attach them to the application:

```typescript
// POST /api/documents (same endpoint, different authorisation path)
// uploaded_by = assessor's profile ID
```

The `uploaded_by` field distinguishes applicant-uploaded from assessor-uploaded documents.

#### 7.4.5 Deletion

When a right-to-deletion request is processed, all documents for the applicant are:
1. Deleted from Supabase Storage (`supabase.storage.from('documents').remove(paths)`)
2. Document rows deleted from the database
3. Audit log entry created

---

### 7.5 Email Service

**Responsibility:** Send transactional emails at key workflow points using configurable templates with merge fields.

**Location:** `src/lib/email/...`

#### 7.5.1 Architecture

```
EmailTemplate (DB)  ──►  renderTemplate(template, mergeData)  ──►  Resend API
                              │
                              ▼
                    React Email component
                    (HTML + plain text)
```

Templates are stored in the `EmailTemplate` table and editable by assessors in the admin console. The merge field syntax is `{{field_name}}`. Rendering replaces merge tags with actual values and produces HTML via React Email components for consistent styling.

#### 7.5.2 Email Types

| Type | Trigger | Merge Fields | PRD Ref |
|------|---------|-------------|---------|
| `INVITATION` | Assessor invites applicant | `applicant_name`, `child_name`, `school`, `deadline`, `registration_link` | EN-01 |
| `CONFIRMATION` | Applicant submits | `applicant_name`, `child_name`, `school`, `reference`, `submitted_date` | EN-02 |
| `MISSING_DOCS` | Assessor requests documents | `applicant_name`, `child_name`, `missing_documents_list` | EN-03 |
| `OUTCOME_QUALIFIES` | Assessment completed (qualifies) | `applicant_name`, `child_name`, `school` | EN-04 |
| `OUTCOME_DNQ` | Assessment completed (does not qualify) | `applicant_name`, `child_name`, `school` | EN-04 |
| `REASSESSMENT` | New round opens | `applicant_name`, `child_name`, `school`, `deadline`, `portal_link` | EN-05 |
| `REMINDER` | Assessor sends reminder | `applicant_name`, `child_name`, `deadline` | EN-07 |

#### 7.5.3 Sending

```typescript
// lib/email/resend.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to: string, templateType: EmailTemplateType, mergeData: Record<string, string>) {
  // 1. Load template from DB (cached in memory for current request)
  // 2. Replace merge tags: template.subject and template.body
  // 3. Render via React Email component (wraps body in styled layout)
  // 4. Send via Resend
  // 5. Log result (success/failure) — not the email content (GDPR)
}

async function sendBatchEmails(recipients: BatchRecipient[], templateType: EmailTemplateType) {
  // For batch operations (reminders, re-assessment invitations)
  // Uses Resend's batch API (up to 100 per call)
}
```

**Error handling:** If Resend returns a failure, the error is logged and the assessor is notified in the UI. Emails are not retried automatically — the assessor can re-trigger manually. This avoids accidental duplicate emails.

---

### 7.6 Reporting & Export

**Responsibility:** Generate canned reports, support ad-hoc queries, and export data as XLSX, CSV, and PDF.

**Location:** `src/lib/export/...`, `src/app/(admin)/reports/...`, `src/app/api/exports/...`

#### 7.6.1 Canned Reports

Each canned report is a server component that runs a Prisma query and renders the result as a table + chart.

| Report | PRD Ref | Data Source | Visualisation |
|--------|---------|-------------|---------------|
| Round Summary | RP-01 | Application count by status, by school | Bar chart + table |
| Bursary Awards | RP-02 | Assessment totals, averages by school/round | Trend line + table |
| Income Distribution | RP-03 | Assessment income banded histogram | Bar chart |
| Property Categories | RP-04 | Assessment property category counts | Bar chart |
| Reason Code Frequency | RP-05 | RecommendationReasonCode counts | Ranked list |
| Approaching Final Year | RP-06 | BursaryAccount where entry year + years elapsed ≥ 12 | Table |
| Sibling Summary | RP-07 | SiblingLink + Assessment payable fees | Table (references, not names — NM-03) |

**Charts:** Rendered client-side using a lightweight charting library (Recharts — already React-based, works well with shadcn/ui styling). Chart data is computed server-side and passed as props.

**Filters:** Each report has filter controls at the top (round, school, date range). Filters are URL search params — changing a filter re-fetches the server component.

#### 7.6.2 Ad-hoc Report Builder

**Route:** `(admin)/reports/builder/page.tsx` (PRD RP-08)

A client component with:
1. **Data source selector:** Applications, Assessments, Active Bursaries
2. **Filter controls:** Round, School, Status, Outcome, Property Category, Income Range, Entry Year
3. **Group-by selector:** School, Round, Outcome, Property Category, Family Type
4. **Visualisation selector:** Table, Bar Chart, Pie Chart, Line Chart
5. **Execute:** Sends filters + grouping to a server action that runs the query and returns aggregated data
6. **Export:** Same data, formatted as XLSX or CSV

The builder operates on pre-defined fields and aggregations — it does not expose raw SQL.

#### 7.6.3 XLSX Export

```typescript
// lib/export/xlsx.ts

import ExcelJS from 'exceljs';

async function generateRecommendationExport(roundId: string, school?: School): Promise<Buffer> {
  // 1. Query completed assessments with recommendations for the round
  //    (this is a name-revealed context — NM-04 — as the export goes to schools)
  // 2. Build workbook:
  //    - Sheet 1: Recommendations (one row per application)
  //      Columns: Reference, Child Name, School, Family Synopsis,
  //               Accommodation, Income Category, Property Category,
  //               Bursary Award, Yearly Payable Fees, Monthly Payable Fees,
  //               Reason Codes, Red Flags
  //    - Sheet 2: Summary statistics
  // 3. Apply formatting (headers bold, currency columns formatted, column widths)
  // 4. Return buffer for download
}

async function generateReportExport(reportData: ReportData): Promise<Buffer> {
  // Generic export: takes any report's data and produces a formatted XLSX
}
```

**API route:** `GET /api/exports/recommendations?round_id=xxx&school=WS` → returns XLSX download.

#### 7.6.4 PDF Generation

```typescript
// lib/export/pdf.ts

import { renderToBuffer } from '@react-pdf/renderer';
import { RecommendationPDF } from './templates/recommendation-pdf';

async function generateRecommendationPDF(assessmentId: string): Promise<Buffer> {
  // 1. Query assessment + recommendation data
  // 2. Render RecommendationPDF React component to buffer
  // 3. Return buffer for download
}
```

PDF generation is a Should Have feature. The React component `RecommendationPDF` defines the layout using `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`).

---

### 7.7 Audit & Logging

**Responsibility:** Maintain an immutable, append-only audit trail of all significant system actions for GDPR accountability and operational traceability.

**Location:** `src/lib/audit/...`

#### 7.7.1 What Is Logged

| Action | Trigger | Context | PRD Ref |
|--------|---------|---------|---------|
| `NAME_REVEAL` | Assessor toggles names on in queue | `application_queue` | NM-05 |
| `APPLICATION_SUBMITTED` | Applicant submits application | `portal` | — |
| `ASSESSMENT_SAVED` | Assessor saves assessment data | `assessment_form` | — |
| `ASSESSMENT_COMPLETED` | Assessor marks assessment complete | `assessment_form` | — |
| `STATUS_CHANGED` | Any application status change | entity type + old/new status | AC-07 |
| `DOCUMENT_UPLOADED` | File uploaded (by applicant or assessor) | slot name | — |
| `DOCUMENT_VERIFIED` | Assessor marks document as verified | slot name | — |
| `SIBLING_LINKED` | Assessor creates sibling link | both account references | — |
| `RECOMMENDATION_SAVED` | Assessor saves recommendation | — | — |
| `INVITATION_SENT` | Assessor sends invitation email | email address | — |
| `EMAIL_SENT` | Any email sent via the system | template type | — |
| `REFERENCE_TABLE_UPDATED` | Assessor updates config values | table name, old/new values | — |
| `DATA_DELETED` | Assessor processes deletion request | anonymised reference only | GD-03 |
| `EXPORT_GENERATED` | Assessor downloads an export | export type, filters | — |

#### 7.7.2 Logging Function

```typescript
// lib/audit/log.ts

async function auditLog(params: {
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      context: params.context,
      metadata: params.metadata ?? {},
    },
  });
}
```

This function is called from server actions and API routes. It is **not** called from client code — all audit logging happens server-side.

#### 7.7.3 Viewing Audit History

- **Per application:** The History tab (`(admin)/applications/[id]/history`) shows all audit log entries where `entity_type = 'Application'` and `entity_id = application.id`, plus related Assessment and Document entries.
- **Global audit view:** An admin-only route `(admin)/audit` shows a paginated, filterable log (by user, action type, date range, entity type).

#### 7.7.4 Immutability

The `AuditLog` table has:
- No `UPDATE` or `DELETE` operations in the application code
- RLS policy: `INSERT` allowed for authenticated users, `SELECT` for assessors, no `UPDATE` or `DELETE` for any role
- No Prisma `update` or `delete` methods exposed for this model
- A database trigger (optional, defence-in-depth) that rejects `UPDATE` and `DELETE` statements on the table

---
