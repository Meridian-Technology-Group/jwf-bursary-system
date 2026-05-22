## 3. Architectural Overview

### 3.1 System Architecture

The system is a **server-rendered monolith** built with Next.js (App Router) and deployed on Vercel. All persistent state — database, authentication, and document storage — is managed by Supabase in the London (eu-west-2) region. The application server itself is stateless.

#### 3.1.1 Why a Monolith

The concurrency ceiling (~55 users), shared data model, single development team, and tight deadline all point to a monolith. There is no axis along which the system needs to scale independently — the applicant portal and admin console read and write the same entities (applications, documents, assessments, bursary accounts). Splitting them would double deployment complexity for zero benefit.

The monolith is **modular by convention**: Next.js route groups, shared library directories, and a clear separation between UI components, server actions, and pure business logic (the assessment engine). This gives the *organisational* benefits of modularity without the *operational* cost of distributed services.

#### 3.1.2 Application Structure

The Next.js App Router provides the structural backbone:

```
src/
├── app/
│   ├── (portal)/              # Applicant-facing routes
│   │   ├── layout.tsx         # Portal shell: minimal nav, progress sidebar
│   │   ├── page.tsx           # Application dashboard (post-login landing)
│   │   ├── apply/
│   │   │   ├── [section]/     # Dynamic route per form section
│   │   │   │   └── page.tsx
│   │   │   └── review/        # Validation summary / pre-submission
│   │   │       └── page.tsx
│   │   ├── status/            # Application status view
│   │   └── submitted/         # Read-only post-submission confirmation
│   │
│   ├── (admin)/               # Assessor-facing routes
│   │   ├── layout.tsx         # Admin shell: sidebar nav, header
│   │   ├── page.tsx           # Dashboard (round summary tiles)
│   │   ├── queue/             # Application queue (filterable table)
│   │   ├── applications/
│   │   │   └── [id]/          # Application detail (tabbed view)
│   │   │       ├── page.tsx   # Tab 1: Applicant Data
│   │   │       ├── assess/    # Tab 2: Split-screen assessment
│   │   │       ├── recommend/ # Tab 3: Recommendation & reason codes
│   │   │       └── history/   # Tab 4: Year-on-year history
│   │   ├── rounds/            # Round management
│   │   ├── invitations/       # Invitation management
│   │   ├── settings/          # Reference table management
│   │   └── reports/           # Reporting & analytics
│   │
│   ├── (auth)/                # Authentication routes (shared)
│   │   ├── login/
│   │   ├── register/          # Invitation-based registration
│   │   ├── reset-password/
│   │   └── verify/            # Email verification / MFA
│   │
│   ├── api/                   # API routes (server-side only)
│   │   ├── applications/
│   │   ├── assessments/
│   │   ├── documents/
│   │   ├── exports/           # CSV/XLSX/PDF generation
│   │   ├── invitations/
│   │   └── webhooks/          # Supabase Auth webhooks, Resend webhooks
│   │
│   ├── layout.tsx             # Root layout (providers, fonts, metadata)
│   └── middleware.ts          # Edge middleware: auth check + role routing
│
├── lib/
│   ├── assessment/            # Pure business logic (no DB, no UI)
│   │   ├── calculator.ts      # Orchestrator: runs all four stages
│   │   ├── stage1-income.ts   # Total Household Net Income
│   │   ├── stage2-assets.ts   # Net Assets Position
│   │   ├── stage3-living.ts   # Family Living Costs → HNDI after NS
│   │   ├── stage4-bursary.ts  # Bursary Impact
│   │   ├── payable-fees.ts    # Scholarship → bursary → VAT formula
│   │   ├── sibling.ts         # Sibling linking / fee absorption logic
│   │   ├── types.ts           # Assessment input/output types
│   │   └── __tests__/         # Unit tests against spreadsheet test cases
│   ├── db/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   └── queries/           # Reusable query functions by domain
│   ├── auth/
│   │   ├── supabase.ts        # Supabase client (server + browser)
│   │   ├── roles.ts           # Role constants and guard helpers
│   │   └── middleware.ts       # Auth check + role resolution for middleware
│   ├── email/
│   │   ├── resend.ts          # Resend client
│   │   └── templates/         # Email template components (React Email)
│   ├── storage/
│   │   └── documents.ts       # Upload, download URL generation, deletion
│   └── export/
│       ├── xlsx.ts            # ExcelJS helpers
│       └── pdf.ts             # @react-pdf/renderer templates
│
├── components/
│   ├── ui/                    # shadcn/ui primitives (button, input, table, etc.)
│   ├── portal/                # Applicant portal components
│   │   ├── section-form.tsx   # Generic section form wrapper
│   │   ├── file-upload.tsx    # Document upload slot
│   │   └── progress-bar.tsx   # Section progress indicator
│   ├── admin/                 # Admin console components
│   │   ├── application-table.tsx
│   │   ├── assessment-form.tsx
│   │   ├── document-viewer.tsx    # PDF/image viewer (split-screen left panel)
│   │   ├── split-screen.tsx       # Resizable split layout
│   │   ├── calculation-display.tsx
│   │   └── recommendation-form.tsx
│   └── shared/                # Shared across portal and admin
│       ├── auth-guard.tsx
│       └── email-template-preview.tsx
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/
│
└── types/                     # Shared TypeScript types
    ├── application.ts
    ├── assessment.ts
    ├── bursary-account.ts
    └── reference-tables.ts
```

#### 3.1.3 Rendering Strategy

Next.js App Router provides three rendering modes. The choice per route is driven by interactivity needs:

| Route | Rendering | Rationale |
|-------|-----------|-----------|
| Portal: section forms | Client component with server data fetch | Forms are interactive (conditional logic, validation, file upload). Data is fetched server-side via server component parent, passed as props. |
| Portal: dashboard, status | Server component | Read-only display of application status. No client interactivity needed. |
| Admin: application queue | Server component + client table | Initial data fetched server-side. Table filtering/sorting handled client-side for responsiveness. |
| Admin: assessment form | Client component | Highly interactive: split-screen, live calculation, field dependencies, document viewer. Mounted as a client component with data fetched via server action on load. |
| Admin: reports | Server component + client charts | Data aggregated server-side. Chart rendering client-side (lightweight chart library or SVG). |
| API routes | Serverless functions | Mutations (save application, submit, create assessment), exports (XLSX/PDF generation), webhook handlers. |
| Middleware | Edge runtime | Auth token verification and role-based route protection. Runs before every request. |

#### 3.1.4 Server Actions vs. API Routes

Both are available in Next.js App Router. The division:

- **Server Actions** — form submissions, data mutations tightly coupled to a specific page (save section, submit application, save assessment). Called directly from components via `useActionState` or form `action`. Simpler, no manual fetch/endpoint wiring.
- **API Routes** — operations consumed by multiple clients or requiring non-form semantics: document upload/download URLs, export file generation (returns a binary stream), webhook receivers, and any endpoint that might be called programmatically in future.

### 3.2 Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                    │
│                                                                         │
│  ┌──────────────────────┐           ┌────────────────────────────────┐  │
│  │   APPLICANT PORTAL   │           │         ADMIN CONSOLE          │  │
│  │                       │           │                                │  │
│  │  Section Forms        │           │  Application Queue            │  │
│  │  File Upload          │           │  ┌──────────────────────────┐ │  │
│  │  Progress Tracker     │           │  │ Assessment Split-Screen  │ │  │
│  │  Status View          │           │  │ ┌──────────┬───────────┐ │ │  │
│  │                       │           │  │ │ Document │ Data Entry│ │ │  │
│  │                       │           │  │ │ Viewer   │ Form +    │ │ │  │
│  │                       │           │  │ │ (PDF/IMG)│ Live Calc │ │ │  │
│  │                       │           │  │ └──────────┴───────────┘ │ │  │
│  │                       │           │  └──────────────────────────┘ │  │
│  │                       │           │  Recommendation Form          │  │
│  │                       │           │  Reports & Export             │  │
│  └──────────┬───────────┘           └──────────────┬─────────────────┘  │
│             │                                      │                    │
└─────────────┼──────────────────────────────────────┼────────────────────┘
              │              HTTPS                    │
┌─────────────▼──────────────────────────────────────▼────────────────────┐
│                         VERCEL (Edge + Serverless)                      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      EDGE MIDDLEWARE                              │   │
│  │  1. Verify Supabase Auth session token                           │   │
│  │  2. Read user role from custom claims                            │   │
│  │  3. Enforce route access:                                        │   │
│  │     /(portal)/* → requires role: applicant                       │   │
│  │     /(admin)/*  → requires role: assessor | viewer               │   │
│  │     /(auth)/*   → public (login, register, reset)                │   │
│  │  4. Redirect unauthenticated users to /login                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  SERVER           │  │  SERVER ACTIONS   │  │  API ROUTES          │  │
│  │  COMPONENTS       │  │                   │  │                      │  │
│  │                   │  │  saveSection()    │  │  POST /api/documents │  │
│  │  Fetch data via   │  │  submitApp()      │  │  GET  /api/documents │  │
│  │  Prisma, render   │  │  saveAssessment() │  │  GET  /api/exports/* │  │
│  │  HTML server-side │  │  createInvite()   │  │  POST /api/webhooks  │  │
│  │                   │  │  deleteApplicant()│  │                      │  │
│  └────────┬─────────┘  └────────┬──────────┘  └────────┬─────────────┘  │
│           │                     │                       │                │
│           └─────────────────────┼───────────────────────┘                │
│                                 │                                        │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
                    ┌─────────────┼──────────────────┐
                    │             │                   │
          ┌─────────▼──┐  ┌──────▼──────────┐  ┌────▼──────────┐
          │  Resend     │  │  Supabase       │  │  Supabase     │
          │             │  │  PostgreSQL     │  │  Storage      │
          │  send()     │  │                 │  │               │
          │             │  │  ┌───────────┐  │  │  Buckets:     │
          │  Templates: │  │  │  Prisma   │  │  │  /documents/  │
          │  invitation │  │  │  Client   │  │  │    {app_id}/  │
          │  confirm    │  │  │     ↕     │  │  │    {slot}/    │
          │  missing    │  │  │  Tables + │  │  │    {file}     │
          │  outcome    │  │  │  RLS      │  │  │               │
          │  reminder   │  │  └───────────┘  │  │  Pre-signed   │
          └─────────────┘  │                 │  │  URLs for     │
                           │  ┌───────────┐  │  │  read access  │
                           │  │ Supabase  │  │  │               │
                           │  │ Auth      │  │  └───────────────┘
                           │  │           │  │
                           │  │ Sessions  │  │
                           │  │ MFA       │  │
                           │  │ Claims    │  │
                           │  └───────────┘  │
                           │                 │
                           │  London         │
                           │  (eu-west-2)    │
                           └─────────────────┘
```

### 3.3 Key Request Flows

#### 3.3.1 Applicant Registration (Invitation Flow)

```
Assessor                    Next.js                Supabase Auth         Resend
   │                           │                        │                  │
   │  POST createInvitation    │                        │                  │
   │  (email, child, school)   │                        │                  │
   │ ─────────────────────────►│                        │                  │
   │                           │  inviteUserByEmail()   │                  │
   │                           │  (role: applicant)     │                  │
   │                           │───────────────────────►│                  │
   │                           │                        │                  │
   │                           │  ◄─ invite token ──────│                  │
   │                           │                        │                  │
   │                           │  Create application    │                  │
   │                           │  record in DB (Prisma) │                  │
   │                           │  status: PRE_SUBMISSION│                  │
   │                           │                        │                  │
   │                           │  Send invitation email ─────────────────►│
   │                           │  (template + invite    │                  │
   │                           │   link + deadline)     │                  │
   │                           │                        │                  │
   │  ◄── confirmation ────────│                        │                  │
   │                           │                        │                  │

                       ... later ...

Applicant                   Next.js                Supabase Auth
   │                           │                        │
   │  GET /register?token=xxx  │                        │
   │ ─────────────────────────►│                        │
   │                           │  verifyOtp(token)      │
   │                           │───────────────────────►│
   │                           │  ◄── valid + user_id ──│
   │                           │                        │
   │  ◄── registration form ───│                        │
   │  (set password)           │                        │
   │                           │                        │
   │  POST (password)          │                        │
   │ ─────────────────────────►│                        │
   │                           │  updateUser(password)  │
   │                           │───────────────────────►│
   │                           │                        │
   │  ◄── redirect to portal ──│                        │
```

#### 3.3.2 Document Upload

```
Applicant                   Next.js API            Supabase Storage       Database
   │                           │                        │                    │
   │  POST /api/documents      │                        │                    │
   │  (file, app_id, slot)     │                        │                    │
   │ ─────────────────────────►│                        │                    │
   │                           │                        │                    │
   │                           │  Validate:             │                    │
   │                           │  - file type (PDF/     │                    │
   │                           │    JPEG/PNG)           │                    │
   │                           │  - file size (≤20 MB)  │                    │
   │                           │  - user owns app_id    │                    │
   │                           │                        │                    │
   │                           │  upload(bucket,        │                    │
   │                           │    path, file)         │                    │
   │                           │───────────────────────►│                    │
   │                           │  ◄── storage path ─────│                    │
   │                           │                        │                    │
   │                           │  Create document record ──────────────────►│
   │                           │  (app_id, slot, path,  │                    │
   │                           │   filename, mime_type) │                    │
   │                           │                        │                    │
   │  ◄── success + doc_id ────│                        │                    │
```

#### 3.3.3 Assessment with Split-Screen Document Viewer

```
Assessor                    Next.js                Database              Supabase Storage
   │                           │                      │                       │
   │  GET /admin/applications  │                      │                       │
   │      /[id]/assess         │                      │                       │
   │ ─────────────────────────►│                      │                       │
   │                           │  Fetch assessment    │                       │
   │                           │  data (Prisma)       │                       │
   │                           │─────────────────────►│                       │
   │                           │  ◄── assessor fields,│                       │
   │                           │      ref tables,     │                       │
   │                           │      document list   │                       │
   │                           │                      │                       │
   │  ◄── split-screen page ───│                      │                       │
   │  Left: doc viewer (empty) │                      │                       │
   │  Right: assessment form   │                      │                       │
   │                           │                      │                       │
   │  Select document          │                      │                       │
   │  (e.g., "Parent 1 — P60")│                      │                       │
   │ ─────────────────────────►│                      │                       │
   │                           │  createSignedUrl()   │                       │
   │                           │  (60-min expiry)     ───────────────────────►│
   │                           │                      │  ◄── signed URL ──────│
   │  ◄── signed URL ──────────│                      │                       │
   │                           │                      │                       │
   │  Render PDF/image         │                      │                       │
   │  in left panel            │                      │                       │
   │  (browser-native viewer)  │                      │                       │
   │                           │                      │                       │
   │  Read P60 figure,         │                      │                       │
   │  enter into right panel   │                      │                       │
   │                           │                      │                       │
   │  ... enter all fields ... │                      │                       │
   │                           │                      │                       │
   │  Live calculation runs    │                      │                       │
   │  client-side (pure TS     │                      │                       │
   │  functions — no server    │                      │                       │
   │  round-trip)              │                      │                       │
   │                           │                      │                       │
   │  Save assessment          │                      │                       │
   │  (server action)          │                      │                       │
   │ ─────────────────────────►│                      │                       │
   │                           │  Upsert assessment   │                       │
   │                           │  record (Prisma)     │                       │
   │                           │─────────────────────►│                       │
   │                           │                      │                       │
   │  ◄── saved ───────────────│                      │                       │
```

**Key design note:** The four-stage calculation and payable fees formula run **client-side** as pure TypeScript functions. This gives the assessor instant feedback as they enter figures — no server round-trip for each keystroke. The same functions are executed **server-side** when saving, to validate the result and store the canonical calculation output. This "calculate on both sides" pattern ensures responsiveness without trusting client-computed values.

#### 3.3.4 Recommendation Export to School

```
Assessor                    Next.js API            Database
   │                           │                      │
   │  GET /api/exports/        │                      │
   │  recommendations?         │                      │
   │  round_id=xxx&school=WS   │                      │
   │ ─────────────────────────►│                      │
   │                           │  Fetch completed     │
   │                           │  assessments with    │
   │                           │  recommendations     │
   │                           │  (include names —    │
   │                           │  NM-04 context)      │
   │                           │─────────────────────►│
   │                           │  ◄── data ───────────│
   │                           │                      │
   │                           │  Build XLSX:         │
   │                           │  - One row per app   │
   │                           │  - Synopsis, income  │
   │                           │    category, property│
   │                           │    category, award,  │
   │                           │    payable fees,     │
   │                           │    flags, reason     │
   │                           │    codes             │
   │                           │  (ExcelJS)           │
   │                           │                      │
   │  ◄── XLSX file download ──│                      │
```

### 3.4 Security Architecture

#### 3.4.1 Authentication Flow

```
Browser                     Edge Middleware         Supabase Auth
   │                           │                        │
   │  Any request              │                        │
   │ ─────────────────────────►│                        │
   │                           │                        │
   │                           │  Read session cookie   │
   │                           │  (sb-access-token)     │
   │                           │                        │
   │                           │  Verify JWT locally    │
   │                           │  (Supabase public key  │
   │                           │   cached at edge)      │
   │                           │                        │
   │                           │  Extract:              │
   │                           │  - user_id             │
   │                           │  - role (from          │
   │                           │    app_metadata.role)  │
   │                           │  - mfa_verified        │
   │                           │                        │
   │                           │  Route check:          │
   │                           │  /(portal)/* → role    │
   │                           │    must be "applicant" │
   │                           │  /(admin)/* → role     │
   │                           │    must be "assessor"  │
   │                           │    or "viewer"         │
   │                           │  /(admin)/* → if role  │
   │                           │    is "assessor", MFA  │
   │                           │    must be verified    │
   │                           │                        │
   │  ◄── 302 /login ──────────│  (if unauthenticated) │
   │  ◄── 403 ─────────────────│  (if wrong role)      │
   │  ◄── 302 /verify ─────────│  (if MFA not done)    │
   │  ◄── proceed ─────────────│  (if all checks pass) │
```

#### 3.4.2 Role-Based Access Control

Three roles, enforced at three layers:

| Role | Route Access | Data Access (RLS) | Capabilities |
|------|-------------|-------------------|-------------|
| **applicant** | `/(portal)/*` only | Own application data only. Own documents only. | View/edit own application. Upload documents. View own status. |
| **assessor** | `/(admin)/*` | All applications, all assessments, all documents. All reference tables (read + write). | Full system access. Create invitations, perform assessments, manage rounds, export data, delete applicant data. |
| **viewer** | `/(admin)/*` (read-only subset) | All applications and assessments (read only). No reference table writes. | View applications and assessments. View reports. No mutations. |

**Enforcement layers:**

1. **Edge Middleware** — checks the role claim on every request and blocks access to wrong route groups. This is the first gate.
2. **Server Actions / API Routes** — each mutation re-verifies the user's role before executing. Defence in depth — never trust the middleware alone.
3. **Row Level Security (Supabase)** — database-level policies ensure that even if application code has a bug, an applicant's query cannot return another applicant's data. RLS policies are defined per table and checked on every query.

#### 3.4.3 Data Minimisation Implementation

The name masking model (PRD NM-01–NM-05) is enforced at the **query layer**, not just the UI:

| Context | Query behaviour | Names included? |
|---------|----------------|----------------|
| Application queue (`/(admin)/queue`) | Query selects `reference`, `school`, `status`, `submitted_at`. Names are **not fetched** by default. | No (until toggled) |
| Name toggle in queue | A separate client-side fetch retrieves names for the current page. The fetch is **audit-logged** server-side. | Yes (logged) |
| Assessment form (`/(admin)/applications/[id]/assess`) | Query selects assessor-entered data, reference tables, document list. Header shows reference number. Earner labels are "Parent 1" / "Parent 2". | No |
| Applicant detail tab (`/(admin)/applications/[id]`) | Full application data including names. This is a name-revealed context (NM-04). | Yes |
| Communication screens | Full names and email. Required for sending emails. | Yes |
| Recommendation export | Full names included. Required by schools for identification. | Yes |
| Reports and analytics | Aggregate data and reference numbers only. | No |

The key principle: **names are excluded from the SQL query itself in masked contexts, not just hidden in the UI.** This prevents accidental exposure through browser dev tools, network inspection, or logging.

#### 3.4.4 Document Access Control

Documents are stored in Supabase Storage with the following access model:

1. **No public access.** The storage bucket is private. Direct URLs do not work.
2. **Pre-signed URLs** are generated server-side with a 60-minute expiry. The server verifies the requesting user's role and ownership before generating the URL.
3. **Path structure** encodes ownership: `/documents/{application_id}/{slot}/{filename}`. RLS policies on the `documents` table ensure applicants can only request URLs for their own application's files.
4. **Assessors** can request URLs for any application's documents (required for the split-screen assessment workflow).

#### 3.4.5 Encryption

| Layer | Mechanism |
|-------|-----------|
| **In transit** | TLS 1.2+ enforced by Vercel (app) and Supabase (database + storage). All connections are HTTPS. |
| **Database at rest** | Supabase PostgreSQL uses AES-256 encryption at rest (AWS RDS underlying). |
| **Documents at rest** | Supabase Storage (S3-backed) uses AES-256 server-side encryption (SSE-S3). |
| **Backups** | Supabase automatic backups inherit the same at-rest encryption. |
| **Session tokens** | Signed JWTs with Supabase's private key. Stored as HttpOnly, Secure, SameSite=Lax cookies. |
| **Passwords** | Hashed with bcrypt by Supabase Auth. Never stored in plaintext. |

### 3.5 Assessment Engine Architecture

The assessment engine is the most critical business logic in the system. It is designed as a set of **pure, deterministic TypeScript functions** with no database access, no side effects, and no UI dependencies.

```
lib/assessment/
├── calculator.ts       # Orchestrator: runs all four stages in sequence
├── stage1-income.ts    # Total Household Net Income
├── stage2-assets.ts    # Net Assets Position (property + savings adjustments)
├── stage3-living.ts    # Family Living Costs deduction → HNDI after NS
├── stage4-bursary.ts   # Bursary Impact (fees − HNDI)
├── payable-fees.ts     # Scholarship %, bursary £, VAT → payable fees
├── sibling.ts          # Sibling fee absorption / deduction logic
├── types.ts            # Input/output type definitions
└── __tests__/          # Unit tests against known spreadsheet test cases
```

**Design properties:**

| Property | Implementation |
|----------|---------------|
| **Pure functions** | Each stage is a function: `(input) → output`. No database reads, no global state. This makes them trivially testable and safe to run on both client and server. |
| **Two-layer enforcement** | The calculator's input types accept only assessor-entered fields. There is no import path from applicant-layer types. This is a compile-time guarantee (DG-2). |
| **Overridable auto-values** | Reference table lookups (notional rent, food, utilities, fees, council tax, years remaining) are passed in as part of the input. The UI pre-populates them from reference tables, but the calculator treats them as plain numbers. If the assessor overrides a value, the override is what gets passed in. |
| **Deterministic** | Same input always produces the same output. No randomness, no date-dependent logic (dates are passed as input). |
| **Dual execution** | Runs client-side (instant feedback in the assessment form) and server-side (validation on save). Server-side result is canonical. |

#### Calculation flow:

```
AssessmentInput
  │
  ▼
Stage 1: calculateHouseholdIncome(earners[])
  │  → TotalHouseholdNetIncome
  ▼
Stage 2: calculateNetAssets(income, property, savings, familyType, schoolYears)
  │  → NetAssetsYearlyValuation
  ▼
Stage 3: calculateLivingCosts(netAssets, familyType)
  │  → HNDIafterNS
  ▼
Stage 4: calculateBursaryImpact(hndiAfterNS, annualFees)
  │  → RequiredBursary
  ▼
calculatePayableFees(grossFees, scholarshipPct, bursaryAward, vatRate)
  │  → { yearlyPayableFees, monthlyPayableFees }
  ▼
(if siblings linked)
applySiblingDeductions(siblingPayableFees[])
  │  → adjusted RequiredBursary for subsequent children
  ▼
AssessmentOutput
```

---
