# Technical Design Document
## John Whitgift Foundation — Bursary Assessment System

| Field | Value |
|-------|-------|
| **Author** | John Whitgift Foundation / Development Team |
| **Version** | 1.0 |
| **Date** | 2026-02-22 |
| **Status** | Complete |
| **PRD Reference** | [PRD.md](./PRD.md) v1.2 |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Goals & Constraints](#2-design-goals--constraints)
3. [Architectural Overview](#3-architectural-overview)
4. [Functional Requirements Mapping](#4-functional-requirements-mapping)
5. [Non-Functional Requirements Mapping](#5-non-functional-requirements-mapping)
6. [Data Design](#6-data-design)
7. [System Components & Modules](#7-system-components--modules)
8. [Implementation Strategy](#8-implementation-strategy)
9. [Deployment & Release Strategy](#9-deployment--release-strategy)
10. [Revision History](#10-revision-history)

---

## 1. Introduction

### 1.1 Project Overview

The John Whitgift Foundation requires a purpose-built bursary assessment platform to replace Symplectic Grant Tracker, which is being sunset on 31 December 2026. The replacement system manages the full lifecycle of means-tested bursary applications for Trinity School and Whitgift School in Croydon, South London.

The system comprises four functional areas:

1. **Applicant Portal** — an invitation-only, single-user web application where lead parents/guardians submit bursary applications with supporting financial documents.
2. **Admin Console** — an internal tool for Foundation assessors to manage assessment rounds, review submissions, perform standardised financial assessments, and produce recommendations.
3. **Assessment Engine** — a four-stage financial calculation model (income, net assets, living costs, bursary impact) that operates exclusively on assessor-entered data, producing bursary awards and payable fees.
4. **Annual Re-assessment Cycle** — workflow for yearly re-evaluation of active bursaries, with pre-population, year-on-year comparison, reason codes, and benchmark tracking.

The system handles approximately 100–200 applications per annual round, with 1–3 concurrent assessor users and up to 50 concurrent applicant sessions at peak.

### 1.2 Target Audience for This Document

| Audience | Interest |
|----------|----------|
| **Development team** | Architecture decisions, data model, component design, implementation approach |
| **Foundation bursary team** | Confirmation that the technical design supports all PRD requirements |
| **Infrastructure / DevOps** | Deployment strategy, hosting, security architecture |
| **Future maintainers** | Understanding of system structure, conventions, and decision rationale |

### 1.3 Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| Product Requirements Document | [PRD.md](./PRD.md) | Full functional and non-functional requirements |
| Master Requirements / Domain Model | [README.md](../README.md) | System overview, two-layer data model, calculation model, reference tables, domain concepts |
| Application Form Specification | [APPLICATION.md](./planning/APPLICATION.md) | Field-by-field mapping of every applicant portal input |
| Admin Console Specification | [ADMIN.md](./planning/ADMIN.md) | Current admin console structure and workflows |
| Open Questions & Answers | [OPEN_QUESTIONS.md](./planning/OPEN_QUESTIONS.md) | 30 requirements questions with stakeholder answers |
| Assessment Model Spreadsheet | [Assessment Model Notional Calculations - BW.xlsx](./Assessment%20Model%20Notional%20Calculations%20-%20BW.xlsx) | Source spreadsheet for calculation model and reference tables |

---

## 2. Design Goals & Constraints

### 2.1 Design Goals

| # | Goal | Rationale |
|---|------|-----------|
| DG-1 | **Replicate the assessment model exactly** | The four-stage calculation and payable fees formula are trusted and well-established. The system must produce identical results to the existing spreadsheet model for a verified set of test cases. Innovation is not wanted here — fidelity is. |
| DG-2 | **Enforce the two-layer data model at the architecture level** | Applicant-entered data and assessor-entered data must be structurally separate (distinct tables/schemas, not just UI separation). The calculation engine must be incapable of reading applicant-declared figures — this is a data integrity guarantee, not a convention. |
| DG-3 | **Privacy by design — data minimisation** | Personal identifiers (names, emails) are masked by default in assessment and reporting contexts. The assessment workflow is purely numerical; names are only exposed where functionally necessary (applicant detail, communication, recommendation export). Name-reveal actions are audit-logged (PRD NM-01–NM-05, NF-16). |
| DG-4 | **Assessor override capability on every calculated value** | The system informs and calculates; it does not restrict. Every auto-populated or auto-calculated value must be editable by the assessor. Manual adjustment fields with reason text support exceptional cases. |
| DG-5 | **Longitudinal continuity per bursary account** | Each bursary account persists across years with a stable reference (WS-xxx / TS-xxx). Historical assessments, recommendations, reason codes, and benchmarks are retained per account and accessible during re-assessment. |
| DG-6 | **Simplicity and maintainability** | The Foundation is a charity with a small team and finite budget. The technology stack must be proven, well-supported, and maintainable by a small development team. Avoid over-engineering, exotic dependencies, and infrastructure complexity. Favour managed services over self-hosted infrastructure. |
| DG-7 | **Mobile-first applicant experience** | Many applicants complete the form on a phone. The portal must be fully functional on mobile devices with touch-friendly document upload and clear progress tracking. |
| DG-8 | **GDPR compliance by construction** | Encryption at rest and in transit, UK data residency, 7-year retention with automated flagging, right-to-deletion support, no school access to the system. These are architectural constraints, not afterthoughts. |

### 2.2 Constraints

| # | Constraint | Technical Impact |
|---|-----------|-----------------|
| TC-1 | **Hard deadline: system live before 31 Dec 2026** | Must-have features only for launch. Technology choices must favour rapid development and low risk. No time for experimental frameworks or bespoke infrastructure. |
| TC-2 | **UK data residency (GDPR)** | Hosting provider must offer UK regions. Database, document storage, and backups must all reside in the UK. |
| TC-3 | **Low concurrency ceiling** | ~50 concurrent applicant sessions, ~5 admin sessions. No need for horizontal scaling, distributed caching, or microservices. A monolithic architecture is appropriate. |
| TC-4 | **No external integrations** | No school-facing API, no SSO federation, no payment gateway. The only outbound integration is transactional email. This simplifies the architecture significantly. |
| TC-5 | **Small development and operations team** | The stack must be operable by 1–2 developers. Favour convention-over-configuration frameworks, managed databases, and PaaS/serverless deployment over self-managed infrastructure. |
| TC-6 | **Assessment logic is fixed** | The four-stage calculation formula is not configurable — only the reference table values change. The calculation engine can be implemented as deterministic, stateless functions with well-defined inputs and outputs. |
| TC-7 | **Document storage volume** | ~200 applications/year, each with 10–20 documents up to 20 MB. Estimated annual storage: 20–80 GB. Modest, but documents must be encrypted at rest with access-controlled, time-limited URLs. |
| TC-8 | **Budget sensitivity** | Charity budget. Hosting costs must be predictable and modest. Avoid per-request pricing models that could spike unexpectedly. Prefer reserved/committed pricing or flat-rate managed services. |

### 2.3 Key Technical Decisions

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| TD-01 | **Application architecture** | Single Next.js app (monolith) | Low concurrency (~55 users), shared data model, one deployment. App Router route groups separate portal and admin concerns. No benefit from microservices or separate apps at this scale. |
| TD-02 | **Language** | TypeScript (full stack) | Team expertise. Single language across frontend, API routes, and server components. Strong typing catches errors at compile time. |
| TD-03 | **Framework** | Next.js (App Router) | Server components for data-heavy admin pages, client components for interactive forms and live calculation. API routes for server-side logic. Vercel-native deployment. |
| TD-04 | **Database** | PostgreSQL via Supabase | Full relational features (foreign keys, views, JSON columns, complex joins for sibling linking). Supabase provides managed hosting in London region (eu-west-2), connection pooling via Supavisor, Row Level Security, and automatic backups. |
| TD-05 | **ORM** | Prisma | Type-safe queries generated from a declarative schema. Excellent migration tooling. Most mature ORM in the Next.js/TypeScript ecosystem. Connects to Supabase Postgres via pooled connection string. |
| TD-06 | **Authentication** | Supabase Auth | Built-in `inviteUserByEmail()` matches the invitation-based registration model. RBAC via custom claims (applicant, assessor, viewer). MFA (TOTP) for admin users. Password reset, session management, and account lockout included. No per-user cost. |
| TD-07 | **Document storage** | Supabase Storage | S3-backed with Row Level Security policies at the database level. Encrypted at rest. Pre-signed time-limited URLs for document viewing. London region. Lifecycle policies for GDPR retention. |
| TD-08 | **App hosting** | Vercel | Native Next.js deployment platform. Serverless functions for API routes, edge middleware for auth checks, automatic HTTPS, preview deployments. The app server is stateless — all personal data resides in Supabase (London). |
| TD-09 | **Email service** | Resend | TypeScript-native SDK, built for Next.js/Vercel. Simple API for templated transactional emails (invitations, confirmations, missing documents, outcomes). Free tier (100 emails/day) covers this volume comfortably. |
| TD-10 | **UI component library** | shadcn/ui + Tailwind CSS | Copy-paste components built on Radix UI primitives. Owns the code (no heavy dependency). Excellent data table, form, dialog, and command palette components — critical for the data-dense admin console. Tailwind for responsive, mobile-first styling on the applicant portal. |
| TD-11 | **Spreadsheet export** | ExcelJS | Full XLSX generation with formatting, multiple sheets, and styling. Open source. Used for recommendation exports to schools and report downloads. |
| TD-12 | **PDF generation** | @react-pdf/renderer | Generate PDFs from React components server-side. Stays in the TypeScript stack. Used for recommendation summaries and application archives (Should Have). |
| TD-13 | **Virus scanning** | Deferred to post-launch | Upload validation (file type whitelist: PDF/JPEG/PNG, size limit: 20 MB) enforced at launch. Full antivirus scanning (ClamAV or managed API) added post-launch. Lower risk given accepted file types are not executable. |
| TD-14 | **Project structure** | Single Next.js app, single repo | One repo, one `next.config`, one Vercel project. Route groups `(portal)` and `(admin)` separate applicant and assessor UIs. Shared Prisma schema, shared component library, shared types. Simplest option for a small team. |

### 2.4 Technology Stack Summary

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENTS                          │
│  Applicant (mobile/desktop browser)                     │
│  Assessor  (desktop browser)                            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                    VERCEL                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Next.js App (TypeScript)            │    │
│  │                                                  │    │
│  │  /(portal)/...   — Applicant-facing pages        │    │
│  │  /(admin)/...    — Assessor-facing pages          │    │
│  │  /api/...        — Server-side API routes         │    │
│  │                                                  │    │
│  │  UI: shadcn/ui + Tailwind CSS                    │    │
│  │  ORM: Prisma                                     │    │
│  │  PDF: @react-pdf/renderer                        │    │
│  │  XLSX: ExcelJS                                   │    │
│  └──────────┬──────────────┬───────────────────────┘    │
│             │              │                             │
│      Edge Middleware    Serverless Functions              │
│      (auth + role check)                                │
└─────────────┬──────────────┬────────────────────────────┘
              │              │
    ┌─────────▼──┐    ┌──────▼─────────────────────┐
    │  Resend    │    │        SUPABASE             │
    │  (email)   │    │     London (eu-west-2)      │
    │            │    │                             │
    │ Invitations│    │  ┌───────────┐              │
    │ Reminders  │    │  │PostgreSQL │ Database     │
    │ Outcomes   │    │  │(Prisma)   │ + RLS        │
    └────────────┘    │  └───────────┘              │
                      │  ┌───────────┐              │
                      │  │Supabase   │ Sessions,    │
                      │  │Auth       │ MFA, RBAC    │
                      │  └───────────┘              │
                      │  ┌───────────┐              │
                      │  │Supabase   │ Documents    │
                      │  │Storage    │ (encrypted)  │
                      │  └───────────┘              │
                      └─────────────────────────────┘
```

---

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

## 4. Functional Requirements Mapping

This section traces every PRD functional requirement (Section 3.1) to its implementing component, data entities, and server action or API route. The mapping provides a completeness check: every requirement must have at least one implementing component and data entity.

**Key:**
- **Route** — Next.js page or route group that renders the feature
- **Component** — React component(s) that implement the UI
- **Server logic** — Server action or API route that executes the operation
- **Entities** — Prisma models / database tables involved
- **Module** — TDD Section 7.x module

### 4.1 Applicant Portal (AP-01 – AP-14)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AP-01 | Invitation-only registration | `(auth)/register/page.tsx` | `verifyOtp()` via Supabase Auth; `createInvitation()` server action | Profile, Invitation, Application | 7.1 |
| AP-02 | Single-user access model | Edge middleware (`middleware.ts`) | Role check: `applicant` role sees own data only | Profile (RLS) | 3.4.2 |
| AP-03 | Multi-step application form | `(portal)/apply/[section]/page.tsx`, `SectionForm`, `ProgressBar` | `saveSection()` server action | ApplicationSection | 7.1 |
| AP-04 | Conditional logic | `ConditionalField` component, section schema `conditions` array | Client-side; schema-driven show/hide | ApplicationSection (JSONB) | 7.1 |
| AP-05 | Entry year collection | `childDetailsSchema` — `entry_year` field (select) | `saveSection()` | ApplicationSection, Application (`entry_year`) | 7.1 |
| AP-06 | Document upload | `FileUpload` component | `POST /api/documents` | Document, Supabase Storage | 7.1, 7.4 |
| AP-07 | Save and resume | `SectionForm` save button | `saveSection()` — upserts ApplicationSection per section | ApplicationSection | 7.1 |
| AP-08 | Progress tracking | `ProgressBar` component (sidebar desktop / stepper mobile) | Server component loads `is_complete` per section | ApplicationSection | 7.1 |
| AP-09 | Validation summary | `(portal)/apply/review/page.tsx`, `ValidationSummary` | Server component queries all sections' `is_complete` + Document slot completeness | ApplicationSection, Document | 7.1 |
| AP-10 | Declaration and submission | Declaration section form + `submitApplication()` | `submitApplication()` — sets `Application.status = SUBMITTED`, `submitted_at`; sends confirmation email | Application, AuditLog | 7.1, 7.5 |
| AP-11 | Re-assessment pre-population | `SectionForm` receives `defaultValues` from previous year | Server component loads prior year's ApplicationSection JSONB for `CHILD_DETAILS`, `PARENT_DETAILS` | ApplicationSection, Application (`is_reassessment`) | 7.1 |
| AP-12 | Mobile-responsive design | All portal components use Tailwind responsive classes; `ProgressBar` collapses to horizontal stepper | N/A (CSS) | — | 7.1 |
| AP-13 | Status visibility | `(portal)/status/page.tsx` | Server component reads `Application.status` | Application | 7.1 |
| AP-14 | In-app messaging / notifications | `(portal)/page.tsx` (dashboard), notification badge | Server component reads recent AuditLog entries for the user's application | AuditLog, Application | 7.1 |

### 4.2 Admin Console — Round & Application Management (AC-01 – AC-09)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AC-01 | Round management | `(admin)/rounds/...` | `createRound()`, `updateRound()`, `closeRound()` server actions | Round | 7.2.4 |
| AC-02 | Applicant invitation | `(admin)/invitations/...` | `createInvitation()` — calls `supabase.auth.admin.inviteUserByEmail()`, creates Application record, sends email via Resend | Invitation, Profile, Application | 7.2, 7.5 |
| AC-03 | Application queue | `(admin)/queue/page.tsx`, `ApplicationTable` | Server component fetches Application list (names excluded — NM-01). Client-side filtering/sorting via Tanstack Table | Application | 7.2.1 |
| AC-04 | Application detail view | `(admin)/applications/[id]/page.tsx` (Tab 1: Applicant Data) | Server component loads all ApplicationSections + Documents. Names visible (NM-04 context) | Application, ApplicationSection, Document | 7.2.2 |
| AC-05 | Document verification | `DocumentViewer` + verify toggle per slot | `verifyDocument()` server action | Document, AuditLog | 7.4.3 |
| AC-06 | Missing documents workflow | Email action in application detail; admin upload | `sendEmail()` (MISSING_DOCS template), `POST /api/documents` (admin upload), `updateStatus()` to PAUSED | Application, Document, EmailTemplate, AuditLog | 7.2, 7.4.4, 7.5 |
| AC-07 | Application status management | Status dropdown / actions in application detail | `updateApplicationStatus()` server action; logs status change | Application, AuditLog | 7.2.2 |
| AC-08 | Bulk operations | Bulk select checkboxes in `ApplicationTable` | `sendBatchEmails()`, `batchUpdateStatus()` server actions | Application, EmailTemplate | 7.2.1 |
| AC-09 | Dashboard | `(admin)/page.tsx` | Server component runs aggregate COUNT queries grouped by `Application.status` | Application, Round | 7.2.6 |

### 4.3 Admin Console — Assessment Engine (AE-01 – AE-17)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AE-01 | Two-layer data model | Architecture: separate tables (ApplicationSection vs Assessment/AssessmentEarner) | `calculateAssessment()` input types accept only assessor-layer fields — compile-time enforcement | Application, ApplicationSection (layer 1); Assessment, AssessmentEarner, AssessmentProperty (layer 2) | 3.5, 7.3 |
| AE-02 | Assessor data entry form | `AssessmentForm` component (right panel of split-screen) | `saveAssessment()` server action | Assessment, AssessmentEarner | 7.2.3, 7.3 |
| AE-03 | Stage 1: Total Household Net Income | `calculateHouseholdIncome()` in `lib/assessment/stage1-income.ts` | Runs client-side (live) and server-side (on save) | AssessmentEarner | 7.3 |
| AE-04 | Benefit inclusion/exclusion | `AssessmentForm` — separate benefit fields per earner (included vs excluded) | `calculateHouseholdIncome()` sums only `benefitsIncluded` | AssessmentEarner (`benefits_included`, `benefits_excluded`) | 7.3 |
| AE-05 | Stage 2: Net Assets Position | `calculateNetAssets()` in `lib/assessment/stage2-assets.ts` | Runs client-side and server-side | Assessment, AssessmentProperty | 7.3 |
| AE-06 | Stage 3: Family Living Costs | `calculateLivingCosts()` in `lib/assessment/stage3-living.ts` | Runs client-side and server-side | Assessment (`utility_costs`, `food_costs`) | 7.3 |
| AE-07 | Stage 4: Bursary Impact | `calculateBursaryImpact()` in `lib/assessment/stage4-bursary.ts` | Runs client-side and server-side | Assessment (`annual_fees`, `required_bursary`) | 7.3 |
| AE-08 | Payable fees calculation | `calculatePayableFees()` in `lib/assessment/payable-fees.ts` | Runs client-side and server-side | Assessment (payable fees columns) | 7.3 |
| AE-09 | Auto-lookup of reference values | `AssessmentForm` — `onChange` handler for Family Type Category, School, Entry Year selects | Client-side: fetch current FamilyTypeConfig/SchoolFees/CouncilTaxDefault, populate form fields | FamilyTypeConfig, SchoolFees, CouncilTaxDefault → snapshotted to Assessment | 7.2.3, 7.3 |
| AE-10 | Manual adjustment field | `AssessmentForm` — `manual_adjustment` and `manual_adjustment_reason` fields | `saveAssessment()` stores values; `calculatePayableFees()` applies adjustment | Assessment (`manual_adjustment`, `manual_adjustment_reason`) | 7.2.3 |
| AE-11 | Schooling years remaining | `AssessmentForm` — auto-calculated from entry year, displayed in editable field | Calculated client-side; stored on Assessment | Assessment (`schooling_years_remaining`), Application (`entry_year`) | 7.2.3 |
| AE-12 | Configurable reference tables | `(admin)/settings/...` — tabbed interface | Server actions per table: `updateFamilyTypeConfig()`, `updateSchoolFees()`, `updateCouncilTax()`, `updateReasonCodes()` | FamilyTypeConfig, SchoolFees, CouncilTaxDefault, ReasonCode, AuditLog | 7.2.5 |
| AE-13 | Property classification | `AssessmentForm` — property category dropdown (1–12), threshold flag | Client-side: flag when category > threshold. `saveAssessment()` stores value | Assessment (`property_category`, `property_exceeds_threshold`) | 7.2.3 |
| AE-14 | Qualitative checklist tabs | `AssessmentForm` or separate sub-tabs within assessment view | `saveChecklist()` server action per tab | AssessmentChecklist | 7.2.3 |
| AE-15 | Year-on-year comparison | Assessment form shows prior year's values alongside current fields | Server action loads previous Assessment for same BursaryAccount | Assessment (current + previous year) | 7.2.3 |
| AE-17 | Split-screen document viewer | `SplitScreen` + `DocumentViewer` (left) + `AssessmentForm` (right) | `GET /api/documents/[id]/url` for pre-signed URLs | Document, Supabase Storage | 7.2.3 |
| AE-16 | Automatic change flagging (Phase 2) | Comparison logic in assessment form | Server action computes delta between prior and current year values | Assessment (two years) | — |

### 4.4 Sibling Linking (SL-01 – SL-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| SL-01 | Manual sibling linking | `(admin)/applications/[id]` — "Link Sibling" action, search dialog | `linkSiblings()` server action — search by reference/name/email, create SiblingLink rows | SiblingLink, BursaryAccount, AuditLog | 7.2, 7.3.3 |
| SL-02 | Sequential income absorption | `AssessmentForm` calculation display | `calculateAssessment()` receives `siblingPayableFees[]` from linked siblings' completed assessments | Assessment, SiblingLink | 7.3.3 |
| SL-03 | Sibling fee deduction | `applySiblingDeductions()` in `lib/assessment/sibling.ts` | Automatically loads older siblings' `yearlyPayableFees` on assessment form mount | Assessment, SiblingLink | 7.3.3 |
| SL-04 | Cross-school sibling support | Sibling search is not filtered by school | `linkSiblings()` does not enforce same-school constraint | SiblingLink, BursaryAccount | 7.3.3 |
| SL-05 | Sibling succession | Admin action to re-order priority | `updateSiblingPriority()` server action — updates `priority_order` | SiblingLink | 7.3.3 |

### 4.5 Assessment Output & Recommendations (AO-01 – AO-07)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| AO-01 | Structured recommendation | `(admin)/applications/[id]/recommend/page.tsx`, `RecommendationForm` | `saveRecommendation()` server action | Recommendation | 7.2.2 |
| AO-02 | Recommendation stored per account per year | Recommendation table FK to Assessment + BursaryAccount + Round | `saveRecommendation()` sets `bursary_account_id` and `round_id` | Recommendation, BursaryAccount, Round | 7.2.2 |
| AO-03 | Year-on-year reason codes | `RecommendationForm` — multi-select checkbox list | `saveRecommendation()` inserts RecommendationReasonCode junction rows | Recommendation, ReasonCode, RecommendationReasonCode | 7.2.2 |
| AO-04 | Reason code configuration | `(admin)/settings/` — Reason Codes tab | `updateReasonCodes()`, `createReasonCode()`, `deprecateReasonCode()` server actions | ReasonCode, AuditLog | 7.2.5 |
| AO-05 | Red flags | `RecommendationForm` — dishonesty + credit risk checkboxes | `saveRecommendation()` stores flags; `saveAssessment()` stores on Assessment too | Assessment, Recommendation (`dishonesty_flag`, `credit_risk_flag`) | 7.2.2 |
| AO-06 | Export for schools | Export button on reports page / recommendation tab | `GET /api/exports/recommendations?round_id=&school=` — `generateRecommendationExport()` (ExcelJS) | Recommendation, Assessment, Application (names included — NM-04) | 7.6.3 |
| AO-07 | PDF summary | Export button on application detail | `GET /api/exports/pdf/[assessment_id]` — `generateRecommendationPDF()` (@react-pdf/renderer) | Assessment, Recommendation, Application | 7.6.4 |

### 4.6 Annual Re-assessment Cycle (RA-01 – RA-08)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| RA-01 | Re-assessment invitation | `(admin)/invitations/` — batch invite button | `sendBatchReassessmentInvitations()` — iterates active BursaryAccounts, creates new Applications, sends REASSESSMENT emails | BursaryAccount, Application, Invitation, EmailTemplate | 7.2, 7.5 |
| RA-02 | Selective invitation | `(admin)/invitations/` — single invite form | `createInvitation()` with `bursary_account_id` set | Invitation, Application | 7.2 |
| RA-03 | Application pre-population | `SectionForm` receives `defaultValues` for address, child, family fields | Server component loads prior year's ApplicationSection JSONB | ApplicationSection, Application | 7.1 |
| RA-04 | ID section hidden | `SectionForm` schema — `FAMILY_ID` section hidden when `is_reassessment = true` | Conditional in server component: skip rendering `FAMILY_ID` section | Application (`is_reassessment`), ApplicationSection | 7.1 |
| RA-05 | Bursary account reference | Displayed in queue, assessment header, recommendation | Reference generated on BursaryAccount creation (`WS-xxx` / `TS-xxx`) | BursaryAccount (`reference`) | 7.2 |
| RA-06 | Progress schedule | `(admin)/applications/[id]/history/page.tsx` — year-by-year schedule | Server component queries all Applications for a BursaryAccount ordered by Round | Application, BursaryAccount, Round | 7.2.2 |
| RA-07 | Benchmark display | `AssessmentForm` — benchmark callout alongside calculation results | Server action loads `BursaryAccount.benchmark_payable_fees` | BursaryAccount, Assessment | 7.2.3 |
| RA-08 | Benchmark tracking dashboard (Phase 2) | `(admin)/reports/` — longitudinal benchmark chart | Server component loads all Assessments for an account across rounds | Assessment, BursaryAccount | 7.6 |

### 4.7 Internal Bursary Requests (IB-01 – IB-03)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| IB-01 | Ad-hoc application creation | `(admin)/invitations/` — "Create Application" action with no round constraint | `createInvitation()` with `is_internal = true`, `round_id` nullable or current round | Application (`is_internal`), Invitation | 7.2 |
| IB-02 | Non-standard entry year | `AssessmentForm` — `schooling_years_remaining` editable field accepts any value | `saveAssessment()` stores override | Assessment (`schooling_years_remaining`), Application (`entry_year`) | 7.2.3 |
| IB-03 | Conversion to rolling bursary | When assessment outcome = QUALIFIES, create BursaryAccount | `completeAssessment()` server action creates BursaryAccount if none exists, links Application | BursaryAccount, Application | 7.2 |

### 4.8 Document Management (DM-01 – DM-06)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| DM-01 | Structured upload slots | `FileUpload` component per slot in `SectionForm` | `POST /api/documents` with `slot` parameter | Document (`slot`) | 7.1, 7.4 |
| DM-02 | Admin document attachment | Upload control in application detail view | `POST /api/documents` — authorised for assessor; `uploaded_by` = assessor | Document (`uploaded_by`), Supabase Storage | 7.4.4 |
| DM-03 | Inline viewing | `DocumentViewer` component (iframe for PDF, img for images) | `GET /api/documents/[id]/url` — returns pre-signed URL (60-min expiry) | Document, Supabase Storage | 7.4.2 |
| DM-04 | Encrypted storage | Supabase Storage bucket configured as private + encrypted | N/A (infrastructure) — AES-256 SSE-S3 at rest, TLS in transit | Supabase Storage | 3.4.5 |
| DM-05 | Retention and deletion | Deletion cascade (Section 6.5); scheduled retention check | `deleteApplicantData()` server action triggers cascade; scheduled job flags expired records | All entities (cascade), AuditLog | 6.5, 7.7 |
| DM-06 | ID document carry-forward | Documents from prior application visible to assessor; `FAMILY_ID` section hidden for re-assessments | Server component loads Documents from prior Application for same BursaryAccount | Document, Application, BursaryAccount | 7.1, 7.4 |

### 4.9 User Management & Authentication (UM-01 – UM-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| UM-01 | Invitation-based applicant registration | `(auth)/register/page.tsx` — password form (email pre-filled from invite token) | `verifyOtp(token)`, `updateUser(password)` via Supabase Auth | Profile, Invitation | 3.4.1 |
| UM-02 | Applicant authentication | `(auth)/login/page.tsx`, `(auth)/reset-password/page.tsx` | `signInWithPassword()`, `resetPasswordForEmail()` via Supabase Auth | Profile (session) | 3.4.1 |
| UM-03 | Admin authentication | `(auth)/login/page.tsx` + `(auth)/verify/page.tsx` (MFA) | `signInWithPassword()` + `verifyMFA()` via Supabase Auth (TOTP) | Profile (session, `mfa_verified`) | 3.4.1 |
| UM-04 | Admin roles | Edge middleware role check; RLS policies | `app_metadata.role` set on user creation (assessor, viewer) | Profile (`role`) | 3.4.2 |
| UM-05 | Account persistence across rounds | No account deletion between rounds; re-assessment re-uses existing Profile | `sendBatchReassessmentInvitations()` resets Application, does not create new Profile | Profile, Application | 7.2 |

### 4.10 Email Notifications (EN-01 – EN-07)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| EN-01 | Invitation email | Triggered from `(admin)/invitations/` | `sendEmail(to, 'INVITATION', mergeData)` via Resend | EmailTemplate, Invitation | 7.5 |
| EN-02 | Submission confirmation | Auto-triggered on `submitApplication()` | `sendEmail(to, 'CONFIRMATION', mergeData)` | EmailTemplate, Application | 7.5 |
| EN-03 | Missing documents request | Triggered from application detail — "Request Documents" action | `sendEmail(to, 'MISSING_DOCS', mergeData)` | EmailTemplate, Document | 7.5 |
| EN-04 | Outcome notification | Triggered on `completeAssessment()` | `sendEmail(to, 'OUTCOME_QUALIFIES' or 'OUTCOME_DNQ', mergeData)` | EmailTemplate, Assessment | 7.5 |
| EN-05 | Re-assessment invitation | Triggered from batch re-assessment invitations | `sendEmail(to, 'REASSESSMENT', mergeData)` | EmailTemplate, BursaryAccount | 7.5 |
| EN-06 | Templated and configurable | `(admin)/settings/` — Email Templates tab, `EmailTemplatePreview` component | Server action `updateEmailTemplate()` | EmailTemplate | 7.5 |
| EN-07 | Reminder emails | Bulk action in application queue — "Send Reminders" | `sendBatchEmails(recipients, 'REMINDER')` via Resend batch API | EmailTemplate, Application | 7.5 |

### 4.11 Data Export & Reporting (DE-01 – DE-04)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| DE-01 | Recommendation export | Export button on reports / recommendation tab | `GET /api/exports/recommendations` — `generateRecommendationExport()` (ExcelJS) | Recommendation, Assessment, Application | 7.6.3 |
| DE-02 | Field-level data export | Export button on queue / report views | `GET /api/exports/data?filters=...` — `generateReportExport()` (ExcelJS) | Application, Assessment (filtered) | 7.6.3 |
| DE-03 | Report export | "Export" button on every canned/ad-hoc report | `GET /api/exports/report?type=...&format=xlsx` | Report-specific entities | 7.6.3 |
| DE-04 | Audit trail | `(admin)/applications/[id]/history/page.tsx` (Tab 4), `(admin)/audit/` (global) | Server component queries AuditLog filtered by entity or user | AuditLog | 7.7 |

### 4.12 Reporting & Analytics (RP-01 – RP-09)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| RP-01 | Round summary report | `(admin)/reports/round-summary` — Recharts bar/pie + table | Server component: `COUNT(Application) GROUP BY status, school` | Application, Round | 7.6.1 |
| RP-02 | Bursary awards report | `(admin)/reports/bursary-awards` — trend line + table | Server component: `SUM/AVG(Assessment.yearly_payable_fees) GROUP BY school, round` | Assessment, Round | 7.6.1 |
| RP-03 | Income distribution report | `(admin)/reports/income-distribution` — histogram | Server component: banded aggregation of `Assessment.total_household_net_income` | Assessment | 7.6.1 |
| RP-04 | Property category distribution | `(admin)/reports/property-categories` — bar chart | Server component: `COUNT(Assessment) GROUP BY property_category` | Assessment | 7.6.1 |
| RP-05 | Reason code frequency | `(admin)/reports/reason-codes` — ranked list | Server component: `COUNT(RecommendationReasonCode) GROUP BY reason_code_id` | RecommendationReasonCode, ReasonCode | 7.6.1 |
| RP-06 | Active bursaries approaching final year | `(admin)/reports/approaching-final-year` — table | Server component: BursaryAccount where `entry_year + elapsed ≥ 12` | BursaryAccount, Assessment | 7.6.1 |
| RP-07 | Sibling bursary summary | `(admin)/reports/sibling-summary` — table (reference numbers, not names — NM-03) | Server component: SiblingLink join BursaryAccount + Assessment | SiblingLink, BursaryAccount, Assessment | 7.6.1 |
| RP-08 | Ad-hoc report builder | `(admin)/reports/builder/page.tsx` — client component with filter/group/chart selectors | `buildReport()` server action: runs parameterised query, returns aggregated data | Application, Assessment, BursaryAccount (filtered) | 7.6.2 |
| RP-09 | Report scheduling (Phase 2) | Scheduled job (cron) | Cloud function or Vercel cron job | — | — |

### 4.13 GDPR & Data Governance (GD-01 – GD-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| GD-01 | 7-year retention | Scheduled job (Vercel cron or Supabase pg_cron) flags expired accounts | Queries BursaryAccount where `closed_at + 7 years < now()`, sets `retention_expired` flag | BursaryAccount (`retention_expires_at`) | 6.5 |
| GD-02 | Rejected application purge | Scheduled job flags DNQ applications past appeal window | Queries Application where `status = DOES_NOT_QUALIFY` and `completed_at + 28 days < now()` | Application, Assessment | 6.5 |
| GD-03 | Right-to-deletion | `(admin)/applications/[id]` — "Delete Applicant Data" action with confirmation dialog | `deleteApplicantData()` server action — full cascade (Section 6.5) + Supabase Auth user deletion | All entities (cascade), AuditLog | 6.5, 7.7 |
| GD-04 | No school access | Architecture: no school-facing routes, no school role | Edge middleware has no `school` role. Exports are file downloads, not live access. | — | 3.4.2 |
| GD-05 | Data encryption | Supabase (AES-256 at rest), Vercel (TLS 1.2+ in transit) | N/A (infrastructure) | — | 3.4.5 |

### 4.14 Data Minimisation & Name Masking (NM-01 – NM-05)

| ID | Requirement | Route / Component | Server Logic | Entities | Module |
|----|-------------|-------------------|--------------|----------|--------|
| NM-01 | Default name masking in queue | `ApplicationTable` — name columns absent by default; "Show Names" toggle | Toggle calls `GET /api/applications/names?ids=...` (separate fetch, audit-logged). Default query selects `reference, school, status, submitted_at` only. | Application, AuditLog | 7.2.1, 3.4.3 |
| NM-02 | Anonymised labels in assessment form | `AssessmentForm` header shows reference number; earner labels "Parent 1"/"Parent 2" | Query for assessment data does not join Profile names. Reference from BursaryAccount/Application. | Assessment, AssessmentEarner | 7.2.3, 3.4.3 |
| NM-03 | Anonymised reports and analytics | All report components use reference numbers; no name columns in report queries | Report queries join on reference, not name. Only recommendation export includes names (NM-04). | Varies by report | 7.6, 3.4.3 |
| NM-04 | Name-revealed contexts | Application detail (Tab 1), communication screens, recommendation export | These queries include Profile name fields. No audit log for these contexts (names are required). | Profile, Application, Recommendation | 7.2.2, 7.5, 7.6.3 |
| NM-05 | Audit logging of name reveal | Name toggle in queue logs to AuditLog | `GET /api/applications/names` handler calls `auditLog({ action: 'NAME_REVEAL', context: 'application_queue' })` | AuditLog | 7.7 |

### 4.15 Coverage Summary

| PRD Section | Requirement Count | All Mapped? |
|-------------|------------------|-------------|
| 3.1.1 Applicant Portal | 14 (AP-01 – AP-14) | Yes |
| 3.1.2 Round & Application Management | 9 (AC-01 – AC-09) | Yes |
| 3.1.3 Assessment Engine | 17 (AE-01 – AE-17, incl. AE-16 Phase 2) | Yes |
| 3.1.4 Sibling Linking | 5 (SL-01 – SL-05) | Yes |
| 3.1.5 Assessment Output | 7 (AO-01 – AO-07) | Yes |
| 3.1.6 Re-assessment Cycle | 8 (RA-01 – RA-08) | Yes |
| 3.1.7 Internal Bursary Requests | 3 (IB-01 – IB-03) | Yes |
| 3.1.8 Document Management | 6 (DM-01 – DM-06) | Yes |
| 3.1.9 User Management | 5 (UM-01 – UM-05) | Yes |
| 3.1.10 Email Notifications | 7 (EN-01 – EN-07) | Yes |
| 3.1.11 Data Export | 4 (DE-01 – DE-04) | Yes |
| 3.1.13 Reporting & Analytics | 9 (RP-01 – RP-09) | Yes |
| 3.1.12 GDPR & Data Governance | 5 (GD-01 – GD-05) | Yes |
| 3.1.14 Data Minimisation | 5 (NM-01 – NM-05) | Yes |
| **Total** | **104** | **Yes** |

Phase 2 items (AE-16, RA-08, RP-09) are noted but not architecturally detailed — they will be designed when prioritised.

---

## 5. Non-Functional Requirements Mapping

This section traces every PRD non-functional requirement (Section 3.2) to its technical implementation, the responsible technology or service, and the verification method.

| ID | Requirement | Implementation | Technology / Service | Verification |
|----|-------------|---------------|---------------------|-------------|
| NF-01 | Page load < 2s on 4G (portal) | Server components render HTML server-side (no client JS waterfall for initial paint). Static assets cached at Vercel edge. Images and fonts optimised via `next/image` and `next/font`. Portal routes are lightweight (form per section, not entire application at once). | Next.js Server Components, Vercel Edge Network | Lighthouse performance audit on 4G throttled connection; Vercel Analytics RUM (Real User Metrics) |
| NF-02 | Assessment calculation < 1s | Calculation engine is pure TypeScript functions running client-side on field change — no server round-trip for live results. On save, server-side re-computation adds ~100ms (no external calls). | `lib/assessment/calculator.ts` (pure functions) | Unit test timing assertions; browser performance profiling in assessment form |
| NF-03 | Document upload ≤ 30s for 20 MB | Direct upload to Supabase Storage via pre-signed upload URL (no Next.js serverless function in the upload path for large files). Supabase Storage is in London (eu-west-2), minimising latency for UK users. | Supabase Storage, `POST /api/documents` | Upload timing tests on broadband and 4G; file size validation in API route (reject > 20 MB) |
| NF-04 | 99.5% uptime | Vercel has a 99.99% SLA for Pro plans. Supabase has a 99.9% SLA for paid projects. The combined architecture has no single self-managed point of failure. | Vercel (app hosting), Supabase (data) | Uptime monitoring service (e.g., BetterUptime / UptimeRobot); Vercel status page; Supabase status page |
| NF-05 | 50 concurrent applicants, 5 admin | Vercel serverless functions auto-scale per request. Supabase connection pooling via Supavisor handles concurrent database connections. No in-memory session state. | Vercel (auto-scaling), Supabase Supavisor (connection pooling) | Load test with k6 or Artillery: 50 concurrent applicant sessions + 5 admin sessions performing typical operations |
| NF-06 | Authentication security (password hashing, MFA, rate limiting, lockout) | Supabase Auth handles password hashing (bcrypt), TOTP MFA for admin users, configurable rate limiting on sign-in attempts, and account lockout. Custom claims encode role in JWT. | Supabase Auth | Verify bcrypt hashing in Supabase config; test MFA enrolment and verification flow; test rate limiting by repeated failed logins; confirm lockout threshold |
| NF-07 | Role-based access control | Three-layer enforcement: (1) Edge middleware checks role claim on every request, (2) server actions re-verify role before mutations, (3) Supabase RLS policies restrict row access per role. Applicants see only their own data; assessors see all; viewers see all read-only. | Edge middleware, server action guards, Supabase RLS | E2E tests: attempt cross-role access (applicant accessing admin routes, applicant accessing another's data); RLS policy tests via Supabase test client |
| NF-08 | OWASP Top 10 compliance (XSS, SQLi, CSRF) | Prisma parameterises all queries (prevents SQL injection). React auto-escapes output (prevents XSS). Next.js includes CSRF protection for server actions. CSP headers configured in `next.config.js`. Input validation via Zod schemas on all server actions and API routes. | Prisma (SQLi), React (XSS), Next.js (CSRF), Zod (input validation) | OWASP ZAP scan against staging environment; manual security review of server actions; CSP header verification |
| NF-09 | Pre-signed, time-limited document URLs | Documents stored in a private Supabase Storage bucket (no public access). Pre-signed URLs generated server-side with 60-minute expiry via `createSignedUrl()`. Server verifies role and ownership before generating URL. | Supabase Storage, `GET /api/documents/[id]/url` | Test: access document URL after expiry (should 403). Test: applicant cannot generate URL for another's document. Verify bucket is private. |
| NF-10 | Virus scanning on upload | Deferred to post-launch (TD-13). At launch: file type whitelist (PDF, JPEG, PNG only — non-executable formats) and 20 MB size limit enforced in `POST /api/documents`. Post-launch: ClamAV integration or managed API (e.g., VirusTotal) scans files after upload. | File type validation (launch); ClamAV or managed API (post-launch) | Launch: test upload of non-whitelisted file types (reject). Post-launch: test upload of EICAR test file (detect and quarantine). |
| NF-11 | WCAG 2.1 AA (portal) | shadcn/ui components are built on Radix UI primitives with accessibility baked in (keyboard navigation, ARIA attributes, focus management). Tailwind responsive classes for mobile. Semantic HTML in server components. Colour contrast checked against WCAG AA ratios. | shadcn/ui (Radix), Tailwind CSS, semantic HTML | axe-core automated audit on all portal pages (integrated into Playwright E2E suite); manual keyboard navigation test; screen reader test (VoiceOver) |
| NF-12 | Browser support (latest 2 versions of Chrome, Firefox, Safari, Edge; mobile Safari, mobile Chrome) | Next.js and shadcn/ui target modern browsers. Tailwind CSS uses standard CSS features. No polyfills needed for latest 2 versions. `browserslist` config in `package.json`. | Next.js, Tailwind CSS, `browserslist` | Playwright cross-browser test suite (Chromium, Firefox, WebKit). Manual spot-check on iOS Safari and Android Chrome. |
| NF-13 | Daily backups with 30-day retention, PITR | Supabase Pro plan includes daily automated backups and point-in-time recovery (PITR). Backup retention configurable (30 days). | Supabase managed backups + PITR | Verify backup schedule in Supabase dashboard; test restoration from backup to a temporary project; confirm 30-day retention setting |
| NF-14 | UK data residency | Supabase project created in London region (eu-west-2). All data — database, documents, backups — resides in the UK. Vercel edge functions run globally but contain no persistent personal data (stateless). | Supabase (London eu-west-2), Vercel (stateless app tier) | Verify Supabase project region in dashboard settings; confirm no personal data cached at Vercel edge |
| NF-15 | Zero-downtime deployments, staging environment | Vercel provides zero-downtime deployments via immutable deployment URLs and instant rollback. Staging environment auto-deploys from `main` branch. Production promoted from staging or deployed from release tags. | Vercel deployment platform | Verify no downtime during deployment (monitor uptime check during deploy); confirm staging auto-deploy from main; test rollback via Vercel dashboard |
| NF-16 | Data minimisation (names masked by default) | Implemented via NM-01 through NM-05 (Section 4.14). Names excluded from SQL queries in masked contexts — not just hidden in UI. Name-reveal actions audit-logged. | Query-layer enforcement (`lib/db/queries/`), AuditLog, `GET /api/applications/names` | E2E test: verify queue page network response contains no name fields. Test: toggling names triggers audit log entry. Review all Prisma queries in masked-context routes. |

---

## 6. Data Design

### 6.1 Design Principles

**Two-layer enforcement at the database level (DG-2):** Applicant-entered data and assessor-entered data live in separate tables. The assessment engine's input type references only assessor-layer tables. There is no view, join, or query path that feeds applicant-declared financial figures into the calculation.

**Hybrid storage for applicant data:** The application form has ~100 fields across 10 sections with complex conditional logic. Core identifiable fields (child name, parent names, school, address) are stored as structured columns for search, pre-population, and name masking. Section-level detail (income table rows, asset breakdowns, circumstances checklist) is stored as JSONB — flexible, evolvable, and only read for display purposes.

**Assessment data is fully normalised:** Every field the calculation reads is a typed column. No JSON parsing in the calculation path.

**Reference table snapshots:** When an assessment is created, current reference values (notional rent, food, utilities, fees, council tax) are copied onto the assessment record. The assessor can override them. The reference configuration tables provide defaults for new assessments — they are not joined at calculation time. This means historical assessments are self-contained: changing a reference table value does not retroactively alter past calculations.

### 6.2 Entity-Relationship Diagram

```
                            ┌──────────────┐
                            │    Round     │
                            │──────────────│
                            │ id           │
                            │ academic_year│
                            │ open_date    │
                            │ close_date   │
                            │ status       │
                            └──────┬───────┘
                                   │ 1
                                   │
                                   │ *
┌──────────────┐           ┌───────┴───────┐           ┌──────────────────┐
│   Profile    │ 1      *  │  Application  │ *      1  │  BursaryAccount  │
│──────────────│──────────►│───────────────│◄──────────│──────────────────│
│ id (=auth)   │           │ id            │           │ id               │
│ role         │           │ reference     │           │ reference        │
│ first_name   │           │ round_id    ──┘           │ school           │
│ last_name    │           │ bursary_      │           │ child_name       │
│ email        │           │  account_id ──────────────┘ entry_year       │
│ phone        │           │ lead_         │           │ benchmark_fees   │
│              │           │  applicant_id │           │ lead_applicant_id│
│              │           │ school        │           │ status           │
│              │           │ status        │           └─────────┬────────┘
│              │           │ child_name    │                     │
│              │           │ submitted_at  │                     │ *
│              │           └───┬───┬───┬───┘           ┌────────┴────────┐
│              │               │   │   │               │  SiblingLink    │
└──────────────┘               │   │   │               │─────────────────│
                               │   │   │               │ family_group_id │
           ┌───────────────────┘   │   └──────────┐    │ bursary_acct_id │
           │                       │              │    │ priority_order  │
           │ *                     │ *            │ *  └─────────────────┘
  ┌────────┴──────────┐   ┌───────┴────────┐ ┌───┴──────────┐
  │ ApplicationSection│   │   Document     │ │  Assessment  │
  │───────────────────│   │────────────────│ │──────────────│
  │ id                │   │ id             │ │ id           │──────────────┐
  │ application_id    │   │ application_id │ │ application_ │              │
  │ section           │   │ slot           │ │  id          │              │
  │ data (JSONB)      │   │ filename       │ │ assessor_id  │              │
  │ is_complete       │   │ storage_path   │ │ family_type  │              │
  └───────────────────┘   │ verified       │ │ [income,     │              │
                          └────────────────┘ │  assets,     │              │
          ┌──────────────────────┐            │  calc fields]│              │
          │  APPLICANT LAYER     │            │ status       │              │
          │  (document           │            │ outcome      │              │
          │   collection)        │            └──┬───┬───┬───┘              │
          └──────────────────────┘               │   │   │                  │
                                                 │   │   │                  │
          ┌──────────────────────┐    ┌──────────┘   │   └──────────┐      │
          │  ASSESSOR LAYER      │    │ *            │ *            │ *    │
          │  (calculation        │ ┌──┴───────────┐ ┌┴────────────┐┌┴─────┴──────┐
          │   input)             │ │ Assessment   │ │ Assessment  ││Recommendation│
          └──────────────────────┘ │ Earner       │ │ Checklist   ││──────────────│
                                   │──────────────│ │─────────────││ id           │
                                   │ id           │ │ id          ││ assessment_id│
                                   │ assessment_id│ │ assessment_ ││ family_      │
                                   │ earner_label │ │  id         ││  synopsis    │
                                   │ employment_  │ │ tab         ││ bursary_award│
                                   │  status      │ │ notes       ││ payable_fees │
                                   │ net_pay      │ └─────────────┘│ reason_codes │
                                   │ benefits_    │                │ red_flags    │
                                   │  included    │                └──────────────┘
                                   │ total_income │
                                   └──────────────┘

  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ REFERENCE CONFIG │  │ SYSTEM           │  │ AUDIT            │
  │──────────────────│  │──────────────────│  │──────────────────│
  │ FamilyTypeConfig │  │ Invitation       │  │ AuditLog         │
  │ SchoolFees       │  │ EmailTemplate    │  │ (immutable)      │
  │ CouncilTaxDefault│  │                  │  │                  │
  │ ReasonCode       │  │                  │  │                  │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 6.3 Key Entities

#### 6.3.1 Profile

Extends Supabase Auth's `auth.users` table with application-specific fields. The `id` is the same UUID as the Supabase Auth user.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, = auth.users.id | Supabase Auth manages the account; this table adds profile data |
| `role` | ENUM | NOT NULL | `applicant`, `assessor`, `viewer` |
| `first_name` | TEXT | | Masked in assessment contexts (NM-01–NM-05) |
| `last_name` | TEXT | | Masked in assessment contexts |
| `email` | TEXT | NOT NULL, UNIQUE | From auth.users, denormalised for query convenience |
| `phone` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**RLS policies:**
- Applicants: can read/update their own profile only
- Assessors: can read all profiles
- Viewers: can read all profiles

#### 6.3.2 Round

An assessment cycle for one academic year.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `academic_year` | TEXT | NOT NULL, UNIQUE | e.g., "2026/27" |
| `open_date` | DATE | NOT NULL | Applications accepted from this date |
| `close_date` | DATE | NOT NULL | Application deadline |
| `decision_date` | DATE | | Target date for funding decisions |
| `status` | ENUM | NOT NULL, DEFAULT 'DRAFT' | `DRAFT`, `OPEN`, `CLOSED` |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.3 BursaryAccount

A persistent account per child, spanning multiple assessment years. Created when a child first qualifies for a bursary.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `reference` | TEXT | NOT NULL, UNIQUE | Format: `WS-xxx` or `TS-xxx`. Persists across years. |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `child_name` | TEXT | NOT NULL | Display purposes and pre-population |
| `child_dob` | DATE | | |
| `entry_year` | INT | NOT NULL | Original year group at entry (6, 7, 9, 12, or other) |
| `first_assessment_year` | TEXT | NOT NULL | Academic year of first assessment, e.g., "2026/27" |
| `benchmark_payable_fees` | DECIMAL(10,2) | | Payable fees from first year's assessment (floor) |
| `lead_applicant_id` | UUID | FK → Profile | |
| `status` | ENUM | NOT NULL, DEFAULT 'ACTIVE' | `ACTIVE`, `CLOSED` |
| `closed_at` | TIMESTAMPTZ | | When the child left school or bursary ended |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Index:** `(lead_applicant_id)` — for looking up a family's accounts.

#### 6.3.4 Application

One application per child per round. This is the central entity linking applicant data, documents, and assessments.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `reference` | TEXT | NOT NULL, UNIQUE | Format during assessment: `YY/YY_School_Child_Seq` |
| `round_id` | UUID | FK → Round, NOT NULL | |
| `bursary_account_id` | UUID | FK → BursaryAccount, NULLABLE | NULL for first-time applications until outcome is decided |
| `lead_applicant_id` | UUID | FK → Profile, NOT NULL | |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `child_name` | TEXT | NOT NULL | Applicant-entered; used for display and queue search |
| `child_dob` | DATE | | |
| `entry_year` | INT | | Year 6/7/9/12/Other |
| `is_reassessment` | BOOLEAN | NOT NULL, DEFAULT false | |
| `is_internal` | BOOLEAN | NOT NULL, DEFAULT false | Internal bursary request (ad-hoc, outside round) |
| `status` | ENUM | NOT NULL, DEFAULT 'PRE_SUBMISSION' | See status enum below |
| `submitted_at` | TIMESTAMPTZ | | NULL until applicant submits |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Application status enum:** `PRE_SUBMISSION`, `SUBMITTED`, `NOT_STARTED`, `PAUSED`, `COMPLETED`, `QUALIFIES`, `DOES_NOT_QUALIFY`

**Indexes:** `(round_id, status)`, `(lead_applicant_id)`, `(bursary_account_id)`

**Unique constraint:** `(round_id, lead_applicant_id, child_name)` — one application per child per round.

#### 6.3.5 ApplicationSection

Stores applicant-entered form data per section as JSONB. Each section's data structure is defined by the form specification in APPLICATION.md.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL | |
| `section` | ENUM | NOT NULL | See section enum below |
| `data` | JSONB | NOT NULL, DEFAULT '{}' | Section-specific field values |
| `is_complete` | BOOLEAN | NOT NULL, DEFAULT false | All required fields present and valid |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Section enum:** `CHILD_DETAILS`, `FAMILY_ID`, `PARENT_DETAILS`, `DEPENDENT_CHILDREN`, `DEPENDENT_ELDERLY`, `OTHER_INFO`, `PARENTS_INCOME`, `ASSETS_LIABILITIES`, `ADDITIONAL_INFO`, `DECLARATION`

**Unique constraint:** `(application_id, section)` — one row per section per application.

**Why JSONB?** The form has ~100 fields with deep conditional logic. Normalising every field into columns would create a rigid schema that's painful to evolve. The assessor never queries these fields for calculation — they look at the uploaded documents instead. JSONB gives us:
- Flexibility to adjust form fields without migrations
- Simple save/load per section (one row per section)
- Ability to add validation at the application level via JSON Schema
- Pre-population for re-assessments: copy the JSON and let the applicant edit

#### 6.3.6 Document

Metadata for uploaded files. The file itself lives in Supabase Storage.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL | |
| `slot` | TEXT | NOT NULL | Named upload slot, e.g., `BIRTH_CERTIFICATE`, `P60_PARENT_1`, `BANK_STMT_PARENT_1_1` |
| `filename` | TEXT | NOT NULL | Original filename |
| `mime_type` | TEXT | NOT NULL | `application/pdf`, `image/jpeg`, `image/png` |
| `file_size` | INT | NOT NULL | Bytes |
| `storage_path` | TEXT | NOT NULL | Path in Supabase Storage bucket |
| `is_verified` | BOOLEAN | NOT NULL, DEFAULT false | Assessor marks as verified (green tick) |
| `uploaded_by` | UUID | FK → Profile, NOT NULL | Applicant or assessor (for email-received docs) |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL | |

**Storage path convention:** `documents/{application_id}/{slot}/{uuid}_{filename}`

**Index:** `(application_id, slot)` — for listing documents per application and checking slot completeness.

#### 6.3.7 Assessment (Assessor Layer)

The core assessor workspace. Stores all assessor-entered financial data and calculation results. This is the **only** table the calculation engine reads.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `application_id` | UUID | FK → Application, NOT NULL, UNIQUE | One assessment per application |
| `assessor_id` | UUID | FK → Profile, NOT NULL | |
| **Reference value snapshots** | | | |
| `family_type_category` | INT | | 1–6 |
| `notional_rent` | DECIMAL(10,2) | | Snapshotted from config, overridable |
| `utility_costs` | DECIMAL(10,2) | | |
| `food_costs` | DECIMAL(10,2) | | |
| `annual_fees` | DECIMAL(10,2) | | |
| `council_tax` | DECIMAL(10,2) | | Default: Band D Croydon |
| `schooling_years_remaining` | INT | | Auto-calculated from entry year, overridable |
| **Calculation results** | | | |
| `total_household_net_income` | DECIMAL(10,2) | | Stage 1 output |
| `net_assets_yearly_valuation` | DECIMAL(10,2) | | Stage 2 output |
| `hndi_after_ns` | DECIMAL(10,2) | | Stage 3 output |
| `required_bursary` | DECIMAL(10,2) | | Stage 4 output |
| **Payable fees** | | | |
| `gross_fees` | DECIMAL(10,2) | | |
| `scholarship_pct` | DECIMAL(5,2) | DEFAULT 0 | |
| `bursary_award` | DECIMAL(10,2) | | = required_bursary (may differ if adjusted) |
| `net_yearly_fees` | DECIMAL(10,2) | | |
| `vat_rate` | DECIMAL(5,2) | DEFAULT 20.00 | |
| `yearly_payable_fees` | DECIMAL(10,2) | | |
| `monthly_payable_fees` | DECIMAL(10,2) | | |
| **Manual adjustment** | | | |
| `manual_adjustment` | DECIMAL(10,2) | DEFAULT 0 | Positive or negative |
| `manual_adjustment_reason` | TEXT | | Required if adjustment ≠ 0 |
| **Property** | | | |
| `property_category` | INT | | 1–12 |
| `property_exceeds_threshold` | BOOLEAN | DEFAULT false | Advisory flag (> £750K) |
| **Red flags** | | | |
| `dishonesty_flag` | BOOLEAN | DEFAULT false | |
| `credit_risk_flag` | BOOLEAN | DEFAULT false | |
| **Status** | | | |
| `status` | ENUM | NOT NULL, DEFAULT 'NOT_STARTED' | `NOT_STARTED`, `PAUSED`, `COMPLETED` |
| `outcome` | ENUM | | `QUALIFIES`, `DOES_NOT_QUALIFY`. NULL until completed. |
| `completed_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.8 AssessmentEarner

Assessor-entered income breakdown per earner. Typically two rows per assessment (Parent 1, Parent 2), or one for sole parents.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL | |
| `earner_label` | ENUM | NOT NULL | `PARENT_1`, `PARENT_2` |
| `employment_status` | ENUM | NOT NULL | `PAYE`, `BENEFITS`, `SELF_EMPLOYED_DIRECTOR`, `SELF_EMPLOYED_SOLE`, `OLD_AGE_PENSION`, `PAST_PENSION`, `UNEMPLOYED` |
| `net_pay` | DECIMAL(10,2) | DEFAULT 0 | PAYE net salary |
| `net_dividends` | DECIMAL(10,2) | DEFAULT 0 | Self-employed director |
| `net_self_employed_profit` | DECIMAL(10,2) | DEFAULT 0 | Sole trader / partner |
| `pension_amount` | DECIMAL(10,2) | DEFAULT 0 | Old age or past employment |
| `benefits_included` | DECIMAL(10,2) | DEFAULT 0 | DLA, ESA, PIP, Carer's (parent) |
| `benefits_included_detail` | JSONB | DEFAULT '{}' | Breakdown of included benefits |
| `benefits_excluded` | DECIMAL(10,2) | DEFAULT 0 | Child disability benefits |
| `benefits_excluded_detail` | JSONB | DEFAULT '{}' | Breakdown of excluded benefits |
| `total_income` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Sum of applicable fields |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(assessment_id, earner_label)` — one row per earner per assessment.

#### 6.3.9 AssessmentProperty

Property and savings data entered by the assessor for Stage 2 calculations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL, UNIQUE | One row per assessment |
| `is_mortgage_free` | BOOLEAN | DEFAULT false | If true, notional rent is added back |
| `additional_property_count` | INT | DEFAULT 0 | Properties beyond primary residence |
| `additional_property_income` | DECIMAL(10,2) | DEFAULT 0 | Yearly income from additional properties |
| `cash_savings` | DECIMAL(10,2) | DEFAULT 0 | |
| `isas_peps_shares` | DECIMAL(10,2) | DEFAULT 0 | |
| `school_age_children_count` | INT | NOT NULL, DEFAULT 1 | Divisor for savings calculation |
| `derived_savings_annual_total` | DECIMAL(10,2) | DEFAULT 0 | Calculated: (cash + ISAs) / children / years |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.10 AssessmentChecklist

Qualitative context tabs. Free-text notes that inform the recommendation but do not feed into the calculation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL | |
| `tab` | ENUM | NOT NULL | `BURSARY_DETAILS`, `LIVING_CONDITIONS`, `DEBT`, `OTHER_FEES`, `STAFF`, `FINANCIAL_PROFILE` |
| `notes` | TEXT | DEFAULT '' | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(assessment_id, tab)`

#### 6.3.11 Recommendation

The structured output per assessment, stored for longitudinal history.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `assessment_id` | UUID | FK → Assessment, NOT NULL, UNIQUE | |
| `bursary_account_id` | UUID | FK → BursaryAccount | Set when outcome is QUALIFIES |
| `round_id` | UUID | FK → Round, NOT NULL | |
| `family_synopsis` | TEXT | | Single/married, children, employment roles |
| `accommodation_status` | TEXT | | Rent / mortgage / mortgage-free |
| `income_category` | TEXT | | Category label, not precise figure |
| `property_category` | INT | | 1–12 (same as assessment) |
| `bursary_award` | DECIMAL(10,2) | | Nominal £ |
| `yearly_payable_fees` | DECIMAL(10,2) | | |
| `monthly_payable_fees` | DECIMAL(10,2) | | |
| `dishonesty_flag` | BOOLEAN | DEFAULT false | |
| `credit_risk_flag` | BOOLEAN | DEFAULT false | |
| `summary` | TEXT | | Free-text recommendation narrative |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.12 ReasonCode & RecommendationReasonCode

Configurable year-on-year change codes. Junction table links selected codes to a recommendation.

**ReasonCode:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `code` | INT | NOT NULL, UNIQUE | Display code (1, 2, ... 35) |
| `label` | TEXT | NOT NULL | e.g., "Salary increase" |
| `is_deprecated` | BOOLEAN | DEFAULT false | Hidden from new assessments, visible on historical records |
| `sort_order` | INT | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**RecommendationReasonCode:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `recommendation_id` | UUID | FK → Recommendation, NOT NULL | |
| `reason_code_id` | UUID | FK → ReasonCode, NOT NULL | |

**PK:** `(recommendation_id, reason_code_id)`

#### 6.3.13 SiblingLink

Links bursary accounts as siblings. The priority order determines income absorption sequence.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `family_group_id` | UUID | NOT NULL | Groups all siblings in a family |
| `bursary_account_id` | UUID | FK → BursaryAccount, NOT NULL | |
| `priority_order` | INT | NOT NULL | 1 = primary (absorbs income first), 2 = second child, etc. |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(family_group_id, bursary_account_id)`, `(family_group_id, priority_order)`

This design allows querying "all siblings in a family" by `family_group_id`, and determining the deduction chain by `priority_order`.

#### 6.3.14 Reference Configuration Tables

These store the current default values for new assessments. They are **not** joined at calculation time — values are snapshotted onto the Assessment record.

**FamilyTypeConfig:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `category` | INT | NOT NULL | 1–6 |
| `description` | TEXT | NOT NULL | e.g., "Parents with 2 children" |
| `notional_rent` | DECIMAL(10,2) | NOT NULL | |
| `utility_costs` | DECIMAL(10,2) | NOT NULL | |
| `food_costs` | DECIMAL(10,2) | NOT NULL | |
| `effective_from` | DATE | NOT NULL | When these values took effect |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Unique constraint:** `(category, effective_from)` — allows storing historical configs.

**SchoolFees:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `school` | ENUM | NOT NULL | `TRINITY`, `WHITGIFT` |
| `annual_fees` | DECIMAL(10,2) | NOT NULL | Pre-VAT |
| `effective_from` | DATE | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**CouncilTaxDefault:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `amount` | DECIMAL(10,2) | NOT NULL | Band D Croydon |
| `description` | TEXT | DEFAULT 'Band D Croydon' | |
| `effective_from` | DATE | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.15 Invitation

Tracks invitations sent by assessors.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `email` | TEXT | NOT NULL | |
| `applicant_name` | TEXT | | Optional — assessor may provide |
| `child_name` | TEXT | | |
| `school` | ENUM | | `TRINITY`, `WHITGIFT` |
| `round_id` | UUID | FK → Round | |
| `bursary_account_id` | UUID | FK → BursaryAccount | For re-assessment invitations |
| `auth_user_id` | UUID | | Supabase Auth user ID once invitation is accepted |
| `status` | ENUM | NOT NULL, DEFAULT 'PENDING' | `PENDING`, `ACCEPTED`, `EXPIRED` |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `accepted_at` | TIMESTAMPTZ | | |
| `created_by` | UUID | FK → Profile, NOT NULL | Assessor who sent it |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.16 EmailTemplate

Configurable email templates with merge fields.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `type` | ENUM | NOT NULL, UNIQUE | `INVITATION`, `CONFIRMATION`, `MISSING_DOCS`, `OUTCOME_QUALIFIES`, `OUTCOME_DNQ`, `REASSESSMENT`, `REMINDER` |
| `subject` | TEXT | NOT NULL | Supports merge tags: `{{applicant_name}}`, `{{child_name}}`, etc. |
| `body` | TEXT | NOT NULL | Supports merge tags |
| `merge_fields` | JSONB | NOT NULL | List of available merge tags for this template |
| `updated_by` | UUID | FK → Profile | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 6.3.17 AuditLog

Immutable append-only log for GDPR accountability and operational traceability.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → Profile | NULL for system actions |
| `action` | TEXT | NOT NULL | e.g., `NAME_REVEAL`, `ASSESSMENT_SAVED`, `APPLICATION_SUBMITTED`, `DATA_DELETED` |
| `entity_type` | TEXT | NOT NULL | e.g., `Application`, `Assessment`, `Profile` |
| `entity_id` | UUID | | The affected record |
| `context` | TEXT | | e.g., `application_queue`, `assessment_form` |
| `metadata` | JSONB | DEFAULT '{}' | Additional context (old/new values for changes, IP address) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**This table has no UPDATE or DELETE operations.** Rows are only ever inserted. RLS policy: assessors can read; no role can update or delete.

**Index:** `(entity_type, entity_id)` — for viewing audit history per record. `(user_id, created_at)` — for reviewing a user's activity.

### 6.4 Data Migration Strategy

Data migration from Symplectic Grant Tracker is the **highest-risk dependency** (PRD D-1). The strategy accounts for Grant Tracker's uncertain export capabilities.

#### 6.4.1 What Must Be Migrated

| Data | Priority | Volume | Notes |
|------|----------|--------|-------|
| Active bursary accounts | Must Have | ~100–200 | Reference numbers, school, child details, entry year, benchmark payable fees |
| Historical assessments | Must Have | 1–2 years per account | Assessor-entered figures, calculation results, recommendations |
| Sibling linkages | Must Have | ~20–40 families | Which accounts are linked and in what order |
| Uploaded documents | Must Have | ~2000–4000 files | PDFs and images from current and recent applications |
| Applicant accounts | Must Have | ~100–200 | Email, name — needed for re-assessment invitations |
| Reason codes per assessment | Should Have | | Year-on-year change codes |
| Historical rounds | Should Have | 2–3 years | For longitudinal reporting |

#### 6.4.2 Migration Approach

1. **Investigation phase** (first priority): Determine Grant Tracker's export capabilities — REST API v7.0, database export, CSV export, or manual extraction.
2. **ETL scripts**: TypeScript scripts that read from the export format and write to the new Prisma schema. Run as a one-time migration job.
3. **Document migration**: Download all documents from Grant Tracker, re-upload to Supabase Storage with the new path convention.
4. **Verification**: Spot-check 20% of migrated accounts. Compare key figures (payable fees, bursary award, benchmark) against Grant Tracker.
5. **Parallel run**: If timeline allows, run both systems in parallel for one round to verify the new system produces correct results.

#### 6.4.3 Migration Timeline

Migration must complete before Grant Tracker's sunset (31 Dec 2026), with margin for verification. Per the Phase 4 timeline (Section 8.1), migration runs during Weeks 10–12+ of the project, with feature-complete code available from Week 9.

### 6.5 Retention & Deletion

GDPR compliance is enforced at the database level.

| Scenario | Retention | Implementation |
|----------|-----------|---------------|
| **Active bursary** | Indefinite while active | No automated action. Data persists as long as `BursaryAccount.status = ACTIVE`. |
| **Bursary ended** (child left school) | 7 years from closure | A `retention_expires_at` column on BursaryAccount, set to `closed_at + 7 years`. A scheduled job flags expired accounts for deletion review. |
| **Rejected application** (Does Not Qualify) | 4 weeks from outcome | `retention_expires_at` set to `completed_at + 28 days`. Auto-flagged for deletion after appeal window. |
| **Right-to-deletion request** | Immediate | Assessor triggers deletion via admin console. All personal data, documents, and assessment records are permanently deleted. An anonymised audit log entry records that a deletion occurred (date, admin user, anonymised reference — not the deleted data). |

**Deletion cascade:** When an applicant's data is deleted:
1. All `ApplicationSection` rows → deleted
2. All `Document` rows → deleted, files removed from Supabase Storage
3. All `Assessment`, `AssessmentEarner`, `AssessmentProperty`, `AssessmentChecklist` rows → deleted
4. All `Recommendation`, `RecommendationReasonCode` rows → deleted
5. `Application` row → deleted
6. `BursaryAccount` row → deleted (if no other applications reference it)
7. `Profile` row → personal fields nulled, `role` set to `DELETED`
8. Supabase Auth user → deleted via admin API
9. `AuditLog` entry created: `action: DATA_DELETED`, `entity_type: Profile`, no personal data in the log

---

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

## 8. Implementation Strategy

### 8.1 Development Phases

The project is structured in four phases, building from foundation to feature-complete. Each phase produces deployable, testable output. Timelines are expressed in weeks from project start (Week 0) so they can be anchored to any actual start date.

**Development approach:** The bulk of implementation work will be performed using AI-assisted development tools (code generation, pair programming, test generation). This significantly compresses the timeline compared to traditional engineering effort — particularly for boilerplate-heavy work (form rendering, CRUD operations, data tables, API routes) and for generating test suites. The estimates below reflect this AI-assisted pace. Human effort focuses on architecture decisions, business logic validation, UX refinement, and stakeholder coordination.

#### Phase 1: Foundation (Weeks 1–2)

**Goal:** Project scaffolding, data model, authentication, and core layouts deployed to staging.

| Deliverable | Detail |
|-------------|--------|
| Project setup | Next.js app, Tailwind, shadcn/ui, Prisma, Supabase project (London region), Vercel project, GitHub repo |
| Prisma schema | All entities from Section 6 defined. Initial migration run against Supabase. |
| Supabase Auth | Configuration: email/password provider, custom claims for roles, MFA enabled for assessor role. |
| Edge middleware | Auth check + role-based route protection (`(portal)`, `(admin)`, `(auth)` route groups). |
| Auth pages | Login, registration (invitation-based), password reset, MFA verification. |
| Layout shells | Portal layout (progress sidebar, mobile stepper) and Admin layout (sidebar nav, header). |
| Seed data | Reference tables seeded (family type configs, school fees, council tax, reason codes). Test users for each role. |
| CI/CD | GitHub Actions pipeline with lint, type-check, test, deploy to Vercel preview/staging. |

**Exit criteria:** A user can log in as applicant or assessor and see the correct layout shell. Prisma schema is deployed and seeded.

#### Phase 2: Core Application (Weeks 3–6)

**Goal:** The full end-to-end assessment workflow works: applicant submits, assessor reviews, assesses, and produces a recommendation.

| Deliverable | Detail |
|-------------|--------|
| **Applicant portal — form engine** | Section schemas for all 10 form sections. `SectionForm` component renders fields from schema, handles conditional logic. Save/resume per section (JSONB). Progress tracking. |
| **Applicant portal — document upload** | `FileUpload` component. `/api/documents` endpoint. Supabase Storage bucket configured (encrypted, private). |
| **Applicant portal — validation & submit** | Validation summary page. Declaration section. Submit action (locks application, sets status). |
| **Admin — application queue** | Filterable, sortable table with name masking (NM-01). Pagination. |
| **Admin — application detail** | Tab 1 (Applicant Data): read-only section display + inline document viewer. |
| **Assessment engine** | All pure functions implemented (`calculator.ts`, stage 1–4, `payable-fees.ts`). Validated against spreadsheet test cases. |
| **Admin — assessment form** | Split-screen layout (document viewer + data entry). Live client-side calculation. Save server action. |
| **Admin — round management** | Create/edit/close rounds. |
| **Invitation management** | Invitation form (single + batch for re-assessments). Supabase Auth `inviteUserByEmail()` integration. |
| **Email service** | Resend integration. All 7 email templates (configurable in admin). Send from assessment workflow (missing docs, outcome). |
| **Status management** | Full status lifecycle (PRE_SUBMISSION → SUBMITTED → NOT_STARTED → PAUSED → COMPLETED → QUALIFIES / DNQ). Status change logging. |
| **Document verification** | Assessor can mark each document slot as verified. Completeness summary. |
| **Recommendation form** | Structured recommendation (Tab 3). Family synopsis, categories, reason codes (multi-select), red flags. |
| **Sibling linking** | Search + link interface. Sequential income absorption. Payable fees deduction for child 2+. |
| **Re-assessment flow** | Pre-population from previous year. ID section hidden. Year-on-year comparison (side-by-side). |

**Exit criteria:** Full assessment lifecycle works for new applications, re-assessments, and sibling applications. Emails are sent at all workflow touchpoints. An end-to-end test passes: create round → invite applicant → applicant registers, fills form, uploads documents, submits → assessor sees application in queue → opens split-screen, enters figures, sees live calculation → saves assessment → completes recommendation → exports.

#### Phase 3: Output, Reporting & Polish (Weeks 7–9)

**Goal:** Exports, reports, audit trail, and UI refinement.

| Deliverable | Detail |
|-------------|--------|
| **Recommendation export** | XLSX export for schools (ExcelJS). Per-round, per-school. |
| **Field-level data export** | Generic CSV/XLSX export for filtered application/assessment data. |
| **Canned reports** | All 7 reports from Section 7.6.1 with charts (Recharts) and export buttons. |
| **Ad-hoc report builder** | Filter/group/visualise interface. |
| **PDF generation** | Recommendation PDF and application summary PDF (@react-pdf/renderer). Should Have — deprioritise if behind schedule. |
| **Audit trail** | Audit log writes throughout the codebase. Per-application history tab. Global audit view. |
| **Dashboard** | Admin dashboard with round summary tiles. |
| **Email template editor** | Admin UI for editing email template subject/body. Merge field preview. |
| **Reference table editor** | Full settings UI for all reference tables. |
| **Applicant status view** | Portal status page (Draft / Submitted / Under Review / Outcome Available). |
| **UI polish** | Mobile responsiveness testing, accessibility pass (WCAG 2.1 AA), loading states, error handling, empty states. |

**Exit criteria:** All Must Have PRD requirements are implemented. All Should Have reporting features are implemented. The system is feature-complete for launch.

#### Phase 4: Migration, UAT & Launch (Weeks 10–12+)

**Goal:** Data migration from Grant Tracker, user acceptance testing, and production launch.

| Deliverable | Detail |
|-------------|--------|
| **Grant Tracker investigation** | Determine export capabilities (API, CSV, database). Note: this task should be started in Phase 1 and run in parallel — it has no code dependency and is the highest-risk item. |
| **Migration scripts** | TypeScript ETL scripts: extract from Grant Tracker, transform to new schema, load via Prisma. |
| **Document migration** | Download all documents from Grant Tracker, re-upload to Supabase Storage. |
| **Migration verification** | Spot-check 20% of accounts. Compare payable fees and bursary awards against Grant Tracker. |
| **UAT with assessor** | End-to-end testing of all workflows with the Foundation's assessor using real (anonymised) test data. |
| **Calculation verification** | Side-by-side comparison of 10+ historical cases between the new engine and the existing spreadsheet model. |
| **Bug fixes** | Address issues found during UAT. |
| **Production deployment** | DNS, SSL, production Supabase + Vercel configuration, monitoring setup. |
| **Go-live** | Switch over from Grant Tracker. Assessor begins using the new system. |

**Exit criteria:** All launch criteria from PRD Section 6.1 are met. The assessor has signed off on UAT.

#### Phase Summary

```
Week  1    2    3    4    5    6    7    8    9    10   11   12+
      │    │    │    │    │    │    │    │    │    │    │    │
      ├─ Phase 1 ─┤                                        │
      │ Foundation │                                        │
      │            ├────────── Phase 2 ──────────┤          │
      │            │ Core Application             │          │
      │            │                              ├─ Phase 3┤
      │            │                              │ Output  │
      │            │                              │ Reports │
      │            │                              │ Polish  ├─ Phase 4 ──►
      │            │                              │         │ Migration  │
      │            │                              │         │ UAT        │
      │            │                              │         │ Launch     │
      │                                                                  │
      ├── Grant Tracker investigation (parallel) ────────────────────────┤
      │                                                                  │
      │                                    Feature-complete ──► Week 9   │
      │                                    System live ──────► Week 12+  │
```

**Total estimated timeline:** ~12 weeks to system live. Grant Tracker investigation runs in parallel from Week 1 as it has no code dependency and is the highest-risk item. Feature-complete by Week 9 allows 3+ weeks for migration, UAT, and buffer.

### 8.2 Testing Strategy

#### 8.2.1 Testing Pyramid

| Layer | Tool | Scope | Coverage Target |
|-------|------|-------|----------------|
| **Unit tests** | Vitest | Assessment engine (pure functions), utility functions, form validation schemas | 100% of calculation logic; high coverage of business rules |
| **Integration tests** | Vitest + Prisma (test DB) | Server actions, API routes, database queries, email sending (mocked) | All CRUD operations, status transitions, role-based access |
| **Component tests** | Vitest + Testing Library | UI components in isolation — form rendering, conditional logic, data display | Key interactive components (SectionForm, AssessmentForm, DataTable) |
| **End-to-end tests** | Playwright | Full user workflows through the browser | Critical paths (see below) |
| **Accessibility tests** | axe-core + Playwright | WCAG 2.1 AA compliance | All portal pages, key admin pages |

#### 8.2.2 Assessment Engine Test Cases

The assessment engine is the highest-risk component. It must produce **identical results** to the existing spreadsheet model.

| Test Category | Approach |
|---------------|----------|
| **Known historical cases** | The Foundation assessor provides 10+ anonymised historical assessments with known correct outcomes. Each becomes a unit test: input values → expected output values to the penny. |
| **Boundary cases** | Zero income (full bursary), very high income (no bursary), single parent, two parents, each employment status, mortgage-free, additional properties, large savings, zero savings. |
| **Sibling deductions** | Two siblings, three siblings, cross-school siblings, sibling succession (child 1 leaves). |
| **Payable fees formula** | Scholarship + bursary + VAT combinations. 0% scholarship. 100% scholarship. Manual adjustment positive and negative. |
| **Reference value overrides** | Override notional rent, override years remaining, override council tax. Verify the override propagates correctly through all stages. |

Every stage function is tested independently (`calculateHouseholdIncome`, `calculateNetAssets`, etc.) and the orchestrator `calculateAssessment` is tested end-to-end.

#### 8.2.3 Critical E2E Paths

| # | Path | Steps |
|---|------|-------|
| 1 | **New application** | Assessor creates invitation → applicant registers → fills all sections → uploads documents → submits → assessor opens queue → opens assessment → enters figures → saves → completes → exports recommendation |
| 2 | **Re-assessment** | Assessor opens new round → triggers re-assessment invitations → applicant logs in → sees pre-populated data → completes financial sections → submits → assessor assesses with year-on-year comparison → selects reason codes |
| 3 | **Sibling application** | Assessor links two applications → verifies Child 1's payable fees appear as deduction in Child 2's calculation |
| 4 | **Missing documents** | Assessor pauses application → sends missing docs email → assessor attaches doc on behalf of applicant → resumes assessment |
| 5 | **Data deletion** | Assessor processes deletion → all personal data, documents, and assessments removed → audit log entry exists → applicant can no longer log in |

#### 8.2.4 Continuous Integration

Tests run on every pull request via GitHub Actions:

```
PR opened / updated
    │
    ├── Lint (ESLint) ──────────────────┐
    ├── Type check (tsc --noEmit) ──────┤
    ├── Unit tests (Vitest) ────────────┤──► All must pass to merge
    ├── Integration tests (Vitest) ─────┤
    └── Build (next build) ─────────────┘

Merge to main
    │
    ├── All above ──────────────────────┐
    ├── E2E tests (Playwright) ─────────┤──► Deploy to staging
    └── Accessibility audit (axe) ──────┘

Manual trigger (pre-release)
    │
    └── Full E2E suite against staging ──► Deploy to production
```

### 8.3 Data Migration Plan

This section expands on the migration strategy outlined in Section 6.4 with operational detail.

#### 8.3.1 Investigation (Parallel from Week 1)

| Task | Detail |
|------|--------|
| Assess Grant Tracker API | Test REST API v7.0 endpoints for reading applications, assessments, documents. Document available endpoints, pagination, rate limits. |
| Assess export options | Check for CSV/XLSX bulk export, database backup download, or admin data dump feature. |
| Map source to target | Create a field-by-field mapping from Grant Tracker's data model to the new Prisma schema. Identify gaps and transformation rules. |
| Document inventory | Count total documents per application. Determine download mechanism (API, bulk download, manual). |

If the Grant Tracker API is insufficient, escalate to Digital Science for a database export or work with the Foundation to extract data manually (this is the risk mitigation for the highest-risk dependency).

#### 8.3.2 ETL Implementation (Phase 4, Weeks 10–11)

Migration scripts live in `scripts/migration/`:

```
scripts/migration/
├── extract/
│   ├── grant-tracker-api.ts    # API client for Grant Tracker
│   └── grant-tracker-csv.ts    # CSV parser (fallback if API is limited)
├── transform/
│   ├── accounts.ts             # Map GT accounts → BursaryAccount
│   ├── applications.ts         # Map GT applications → Application + sections
│   ├── assessments.ts          # Map GT assessments → Assessment + earners
│   ├── documents.ts            # Map GT document metadata → Document
│   └── siblings.ts             # Map GT sibling links → SiblingLink
├── load/
│   ├── database.ts             # Prisma bulk inserts
│   └── storage.ts              # Upload documents to Supabase Storage
├── verify/
│   ├── spot-check.ts           # Compare random 20% of accounts against source
│   └── calculation-check.ts    # Re-run calculation on migrated data, compare results
└── run-migration.ts            # Orchestrator: extract → transform → load → verify
```

#### 8.3.3 Execution (Phase 4, Weeks 11–12)

| Step | Detail |
|------|--------|
| 1. Dry run | Run full migration against staging environment. Log all warnings and errors. |
| 2. Verification | Run `spot-check.ts` (random 20% of accounts). Run `calculation-check.ts` (all migrated assessments). Flag mismatches. |
| 3. Fix and re-run | Address data quality issues found in dry run. Re-run migration. |
| 4. Production migration | Run against production environment during a maintenance window. |
| 5. Final verification | Assessor manually verifies 10 accounts in the production system against Grant Tracker. |

#### 8.3.4 Rollback

If critical issues are found post-migration:
- The Supabase database can be restored from a point-in-time backup taken immediately before the migration
- Documents in Supabase Storage are not affected by database rollback (they must be cleaned up separately if needed)
- Grant Tracker remains available as the fallback system until 31 Dec 2026

---

## 9. Deployment & Release Strategy

### 9.1 Environments

| Environment | Purpose | Platform | Database | URL |
|-------------|---------|----------|----------|-----|
| **Local** | Development | `next dev` on developer machine | Supabase local (Docker via `supabase start`) or dev project | `localhost:3000` |
| **Preview** | PR review and feature testing | Vercel preview deployment (automatic per PR) | Supabase development project | `*.vercel.app` (auto-generated) |
| **Staging** | Pre-production testing, UAT, migration dry runs | Vercel staging deployment (auto-deploy from `main`) | Supabase staging project (London) | `staging.bursary.jwf.org.uk` (example) |
| **Production** | Live system | Vercel production deployment (manual promote from staging or deploy from release tag) | Supabase production project (London) | `bursary.jwf.org.uk` (example) |

**Supabase project separation:** Each environment has its own Supabase project with its own database, auth, and storage. This ensures:
- Development and testing never touch production data
- Schema migrations can be tested on staging before production
- Secrets and API keys are environment-specific

**Environment variables:** Managed via Vercel's environment variable system. Each environment has its own set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never exposed to client)
- `DATABASE_URL` (Prisma connection string via Supavisor pooler)
- `DIRECT_URL` (Prisma direct connection for migrations)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### 9.2 CI/CD Pipeline

```
Developer pushes branch
         │
         ▼
┌─────────────────────────────────────────────┐
│           GitHub Actions Workflow            │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Lint   │  │   Type   │  │   Unit    │  │
│  │ (ESLint)│  │  Check   │  │  Tests    │  │
│  │         │  │  (tsc)   │  │ (Vitest)  │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│       └─────────────┴──────────────┘         │
│                     │ all pass               │
│                     ▼                        │
│            ┌────────────────┐                │
│            │  Integration   │                │
│            │  Tests         │                │
│            │  (Vitest)      │                │
│            └───────┬────────┘                │
│                    │ pass                    │
│                    ▼                        │
│            ┌────────────────┐                │
│            │  Build         │                │
│            │  (next build)  │                │
│            └───────┬────────┘                │
└────────────────────┼────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    PR branch                main branch
         │                       │
         ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│  Vercel Preview  │   │  Vercel Staging  │
│  Deployment      │   │  Deployment      │
│  (auto)          │   │  (auto)          │
└──────────────────┘   └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  E2E Tests       │
                       │  (Playwright     │
                       │   vs staging)    │
                       └────────┬─────────┘
                                │ pass
                                ▼
                       ┌──────────────────┐
                       │  Manual approval │
                       │  to promote to   │
                       │  production      │
                       └────────┬─────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Vercel          │
                       │  Production      │
                       │  Deployment      │
                       └──────────────────┘
```

**Database migrations:** Prisma migrations are applied as a separate step — not automatically on deploy:

1. Developer creates migration locally: `npx prisma migrate dev --name description`
2. Migration file committed to repo (`prisma/migrations/`)
3. On merge to `main`: a GitHub Actions step runs `npx prisma migrate deploy` against the staging database
4. Before production promote: migration is run against production database (manually triggered or via a deploy script)

This prevents accidental schema changes on production and allows migration verification on staging first.

**Zero-downtime deployments:** Vercel's deployment model is inherently zero-downtime — a new deployment is built and verified, then traffic is atomically switched to the new version. For database migrations that alter schema, backwards-compatible migration practices are used:
- Add new columns as nullable (or with defaults), deploy code that uses them, then backfill
- Never rename or drop columns in the same deployment that removes code using them
- Use a two-phase approach: deploy code that handles both old and new schema → run migration → deploy code that removes old schema handling

### 9.3 Monitoring & Alerting

| Concern | Tool | Detail |
|---------|------|--------|
| **Application errors** | Vercel + Sentry (or similar) | Unhandled exceptions in server components, server actions, and API routes are captured with stack traces, user context, and request metadata. Alerts on error rate spikes. |
| **Performance** | Vercel Analytics | Core Web Vitals (LCP, FID, CLS) for the applicant portal. Server function duration for API routes. |
| **Uptime** | Vercel / external monitor (e.g. Checkly, UptimeRobot) | HTTP checks on the portal login page and admin dashboard. Alert if response time > 5s or status ≠ 200. Target: 99.5% uptime (NF-04). |
| **Database** | Supabase Dashboard | Connection pool utilisation, query performance (pg_stat_statements), storage usage, replication lag. Alerts on high connection count or slow queries. |
| **Auth** | Supabase Auth logs | Failed login attempts, account lockouts, MFA failures. Alerts on unusual patterns (brute force attempts). |
| **Email** | Resend Dashboard + webhooks | Delivery rate, bounce rate, complaint rate. Resend webhook notifications for bounces/complaints are received at `/api/webhooks/resend` and logged. |
| **Storage** | Supabase Dashboard | Bucket size, upload/download metrics. |

**Alerting channels:** Email to the development team. For critical production issues (site down, database unreachable), an escalation to the Foundation's IT contact.

### 9.4 Backup & Recovery

| Concern | Strategy | Detail |
|---------|----------|--------|
| **Database backups** | Supabase automatic daily backups | Included with Supabase Pro plan. Configured for 30-day retention (NF-13). Point-in-time recovery (PITR) available for Pro plan — restores to any point within the retention window. |
| **Database backup testing** | Monthly | Restore a backup to a temporary Supabase project to verify integrity. |
| **Document storage** | Supabase Storage (S3-backed) | S3 provides 99.999999999% (11 nines) durability. No additional backup needed for the files themselves. |
| **Application code** | Git (GitHub) | Full history of all code, migrations, and configuration. Any version can be redeployed to Vercel. |
| **Secrets** | Vercel environment variables + Supabase project settings | Not stored in code. If Vercel settings are lost, secrets can be regenerated from Supabase dashboard. |
| **Disaster recovery target** | RTO: 4 hours, RPO: 24 hours | **RTO (Recovery Time Objective):** The system can be restored from backup and redeployed within 4 hours. **RPO (Recovery Point Objective):** Maximum data loss is 24 hours (daily backup interval). With PITR enabled, RPO improves to minutes. |
| **Disaster recovery procedure** | Documented runbook | 1. Restore database from latest backup (or PITR). 2. Verify Supabase Storage is intact (S3 durability). 3. Redeploy the latest passing build from GitHub via Vercel. 4. Verify auth, database connectivity, and storage access. 5. Run smoke tests (login, load an application, load an assessment). |

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-02-22 | — | Initial scaffold — Sections 1 & 2 complete, remaining sections outlined pending technology decisions |
| 0.2 | 2026-02-22 | — | Section 2.3 finalised with all technology decisions. Section 3 complete: system architecture, project structure, rendering strategy, component diagram, request flows (invitation, document upload, assessment, export), security architecture (auth, RBAC, data minimisation, document access, encryption), assessment engine design |
| 0.3 | 2026-02-22 | — | Section 6 complete: data design principles, ER diagram, 17 entity definitions with columns/types/constraints/RLS notes, data migration strategy, GDPR retention and deletion implementation |
| 0.4 | 2026-02-22 | — | Section 7 complete: 7 module specifications (Applicant Portal, Admin Console, Assessment Engine, Document Management, Email Service, Reporting & Export, Audit & Logging) with component details, function signatures, wireframes, and integration patterns |
| 0.5 | 2026-02-22 | — | Sections 8 & 9 complete. Section 8: four development phases (~12 weeks, AI-assisted timeline), testing strategy (pyramid, assessment engine test cases, E2E paths, CI), data migration plan (investigation, ETL, execution, rollback). Section 9: four environments (local/preview/staging/production), CI/CD pipeline with Prisma migration strategy, monitoring & alerting, backup & recovery (RTO 4h, RPO 24h) |
| 0.9 | 2026-02-22 | — | Sections 4 & 5 complete. Section 4: functional requirements traceability matrix — all 104 PRD requirements (AP through NM) mapped to implementing routes, components, server logic, data entities, and TDD modules. Section 5: non-functional requirements mapping — all 16 NFRs (NF-01 through NF-16) mapped to technical implementation, responsible technology, and verification method |
| 1.0 | 2026-02-22 | — | Final review pass. Fixed: Section 3.1.2 assessment engine directory tree aligned with Section 3.5 (added stage files and __tests__); Section 3.4.2 "two layers" → "three layers"; ER diagram SiblingLink columns aligned with entity definition 6.3.13; Section 8.3 "Phase 5" references corrected to Phase 4 timeline; Section 9.4 backup retention corrected to 30 days per NF-13; Section 4.15 requirement count corrected (104 total); Section 1.3 relative links simplified. All sections complete. |
