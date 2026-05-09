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
