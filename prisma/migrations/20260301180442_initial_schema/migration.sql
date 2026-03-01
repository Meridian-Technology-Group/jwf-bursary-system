-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APPLICANT', 'ASSESSOR', 'VIEWER', 'DELETED');

-- CreateEnum
CREATE TYPE "School" AS ENUM ('TRINITY', 'WHITGIFT');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PRE_SUBMISSION', 'SUBMITTED', 'NOT_STARTED', 'PAUSED', 'COMPLETED', 'QUALIFIES', 'DOES_NOT_QUALIFY');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('NOT_STARTED', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AssessmentOutcome" AS ENUM ('QUALIFIES', 'DOES_NOT_QUALIFY');

-- CreateEnum
CREATE TYPE "EarnerLabel" AS ENUM ('PARENT_1', 'PARENT_2');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PAYE', 'BENEFITS', 'SELF_EMPLOYED_DIRECTOR', 'SELF_EMPLOYED_SOLE', 'OLD_AGE_PENSION', 'PAST_PENSION', 'UNEMPLOYED');

-- CreateEnum
CREATE TYPE "ChecklistTab" AS ENUM ('BURSARY_DETAILS', 'LIVING_CONDITIONS', 'DEBT', 'OTHER_FEES', 'STAFF', 'FINANCIAL_PROFILE');

-- CreateEnum
CREATE TYPE "ApplicationSectionType" AS ENUM ('CHILD_DETAILS', 'FAMILY_ID', 'PARENT_DETAILS', 'DEPENDENT_CHILDREN', 'DEPENDENT_ELDERLY', 'OTHER_INFO', 'PARENTS_INCOME', 'ASSETS_LIABILITIES', 'ADDITIONAL_INFO', 'DECLARATION');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('INVITATION', 'CONFIRMATION', 'MISSING_DOCS', 'OUTCOME_QUALIFIES', 'OUTCOME_DNQ', 'REASSESSMENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "BursaryAccountStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'APPLICANT',
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "open_date" DATE NOT NULL,
    "close_date" DATE NOT NULL,
    "decision_date" DATE,
    "status" "RoundStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bursary_accounts" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "school" "School" NOT NULL,
    "child_name" TEXT NOT NULL,
    "child_dob" DATE,
    "entry_year" INTEGER NOT NULL,
    "first_assessment_year" TEXT NOT NULL,
    "benchmark_payable_fees" DECIMAL(10,2),
    "lead_applicant_id" UUID NOT NULL,
    "status" "BursaryAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bursary_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "round_id" UUID NOT NULL,
    "bursary_account_id" UUID,
    "lead_applicant_id" UUID NOT NULL,
    "school" "School" NOT NULL,
    "child_name" TEXT NOT NULL,
    "child_dob" DATE,
    "entry_year" INTEGER,
    "is_reassessment" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PRE_SUBMISSION',
    "submitted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_sections" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "section" "ApplicationSectionType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "application_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "slot" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "assessor_id" UUID NOT NULL,
    "family_type_category" INTEGER,
    "notional_rent" DECIMAL(10,2),
    "utility_costs" DECIMAL(10,2),
    "food_costs" DECIMAL(10,2),
    "annual_fees" DECIMAL(10,2),
    "council_tax" DECIMAL(10,2),
    "schooling_years_remaining" INTEGER,
    "total_household_net_income" DECIMAL(10,2),
    "net_assets_yearly_valuation" DECIMAL(10,2),
    "hndi_after_ns" DECIMAL(10,2),
    "required_bursary" DECIMAL(10,2),
    "gross_fees" DECIMAL(10,2),
    "scholarship_pct" DECIMAL(5,2) DEFAULT 0,
    "bursary_award" DECIMAL(10,2),
    "net_yearly_fees" DECIMAL(10,2),
    "vat_rate" DECIMAL(5,2) DEFAULT 20.00,
    "yearly_payable_fees" DECIMAL(10,2),
    "monthly_payable_fees" DECIMAL(10,2),
    "manual_adjustment" DECIMAL(10,2) DEFAULT 0,
    "manual_adjustment_reason" TEXT,
    "property_category" INTEGER,
    "property_exceeds_threshold" BOOLEAN NOT NULL DEFAULT false,
    "dishonesty_flag" BOOLEAN NOT NULL DEFAULT false,
    "credit_risk_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "outcome" "AssessmentOutcome",
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_earners" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "earner_label" "EarnerLabel" NOT NULL,
    "employment_status" "EmploymentStatus" NOT NULL,
    "net_pay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_dividends" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_self_employed_profit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pension_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "benefits_included" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "benefits_included_detail" JSONB NOT NULL DEFAULT '{}',
    "benefits_excluded" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "benefits_excluded_detail" JSONB NOT NULL DEFAULT '{}',
    "total_income" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assessment_earners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_properties" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "is_mortgage_free" BOOLEAN NOT NULL DEFAULT false,
    "additional_property_count" INTEGER NOT NULL DEFAULT 0,
    "additional_property_income" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cash_savings" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isas_peps_shares" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "school_age_children_count" INTEGER NOT NULL DEFAULT 1,
    "derived_savings_annual_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assessment_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_checklists" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "tab" "ChecklistTab" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assessment_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "bursary_account_id" UUID,
    "round_id" UUID NOT NULL,
    "family_synopsis" TEXT,
    "accommodation_status" TEXT,
    "income_category" TEXT,
    "property_category" INTEGER,
    "bursary_award" DECIMAL(10,2),
    "yearly_payable_fees" DECIMAL(10,2),
    "monthly_payable_fees" DECIMAL(10,2),
    "dishonesty_flag" BOOLEAN NOT NULL DEFAULT false,
    "credit_risk_flag" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reason_codes" (
    "id" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reason_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_reason_codes" (
    "recommendation_id" UUID NOT NULL,
    "reason_code_id" UUID NOT NULL,

    CONSTRAINT "recommendation_reason_codes_pkey" PRIMARY KEY ("recommendation_id","reason_code_id")
);

-- CreateTable
CREATE TABLE "sibling_links" (
    "id" UUID NOT NULL,
    "family_group_id" UUID NOT NULL,
    "bursary_account_id" UUID NOT NULL,
    "priority_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sibling_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_type_configs" (
    "id" UUID NOT NULL,
    "category" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notional_rent" DECIMAL(10,2) NOT NULL,
    "utility_costs" DECIMAL(10,2) NOT NULL,
    "food_costs" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_fees" (
    "id" UUID NOT NULL,
    "school" "School" NOT NULL,
    "annual_fees" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "council_tax_defaults" (
    "id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL DEFAULT 'Band D Croydon',
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "council_tax_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "applicant_name" TEXT,
    "child_name" TEXT,
    "school" "School",
    "round_id" UUID,
    "bursary_account_id" UUID,
    "auth_user_id" UUID,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "merge_fields" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "context" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_academic_year_key" ON "rounds"("academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "bursary_accounts_reference_key" ON "bursary_accounts"("reference");

-- CreateIndex
CREATE INDEX "bursary_accounts_lead_applicant_id_idx" ON "bursary_accounts"("lead_applicant_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_reference_key" ON "applications"("reference");

-- CreateIndex
CREATE INDEX "applications_round_id_status_idx" ON "applications"("round_id", "status");

-- CreateIndex
CREATE INDEX "applications_lead_applicant_id_idx" ON "applications"("lead_applicant_id");

-- CreateIndex
CREATE INDEX "applications_bursary_account_id_idx" ON "applications"("bursary_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_round_id_lead_applicant_id_child_name_key" ON "applications"("round_id", "lead_applicant_id", "child_name");

-- CreateIndex
CREATE UNIQUE INDEX "application_sections_application_id_section_key" ON "application_sections"("application_id", "section");

-- CreateIndex
CREATE INDEX "documents_application_id_slot_idx" ON "documents"("application_id", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "assessments_application_id_key" ON "assessments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_earners_assessment_id_earner_label_key" ON "assessment_earners"("assessment_id", "earner_label");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_properties_assessment_id_key" ON "assessment_properties"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_checklists_assessment_id_tab_key" ON "assessment_checklists"("assessment_id", "tab");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_assessment_id_key" ON "recommendations"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "reason_codes_code_key" ON "reason_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sibling_links_family_group_id_bursary_account_id_key" ON "sibling_links"("family_group_id", "bursary_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sibling_links_family_group_id_priority_order_key" ON "sibling_links"("family_group_id", "priority_order");

-- CreateIndex
CREATE UNIQUE INDEX "family_type_configs_category_effective_from_key" ON "family_type_configs"("category", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "school_fees_school_effective_from_key" ON "school_fees"("school", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_type_key" ON "email_templates"("type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "bursary_accounts" ADD CONSTRAINT "bursary_accounts_lead_applicant_id_fkey" FOREIGN KEY ("lead_applicant_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_lead_applicant_id_fkey" FOREIGN KEY ("lead_applicant_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_sections" ADD CONSTRAINT "application_sections_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessor_id_fkey" FOREIGN KEY ("assessor_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_earners" ADD CONSTRAINT "assessment_earners_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_properties" ADD CONSTRAINT "assessment_properties_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_checklists" ADD CONSTRAINT "assessment_checklists_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_reason_codes" ADD CONSTRAINT "recommendation_reason_codes_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_reason_codes" ADD CONSTRAINT "recommendation_reason_codes_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sibling_links" ADD CONSTRAINT "sibling_links_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_bursary_account_id_fkey" FOREIGN KEY ("bursary_account_id") REFERENCES "bursary_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
