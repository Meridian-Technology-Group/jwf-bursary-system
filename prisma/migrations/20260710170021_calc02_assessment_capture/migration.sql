-- CreateEnum
CREATE TYPE "RentAddBackType" AS ENUM ('NONE', 'FULL_MORTGAGE_FREE', 'FULL_RENT_FREE', 'PARTIAL_LOWER_RENT');

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "actual_remaining_di" DECIMAL(10,2),
ADD COLUMN     "affordability_adjusted_di" DECIMAL(10,2),
ADD COLUMN     "behind_on_fees" BOOLEAN,
ADD COLUMN     "calculation_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "council_tax_support" BOOLEAN,
ADD COLUMN     "debt_over_ndi_ratio" DECIMAL(10,4),
ADD COLUMN     "debt_status_label" TEXT,
ADD COLUMN     "derived_yearly_debt_repayments" DECIMAL(10,2),
ADD COLUMN     "fee_insurance_annual" DECIMAL(10,2),
ADD COLUMN     "financial_equity_label" TEXT,
ADD COLUMN     "income_category" INTEGER,
ADD COLUMN     "lifestyle_squeeze_label" TEXT,
ADD COLUMN     "lifestyle_squeeze_ratio" DECIMAL(10,4),
ADD COLUMN     "multi_property_rent_add_back" BOOLEAN,
ADD COLUMN     "ndi_after_notional_spend" DECIMAL(10,2),
ADD COLUMN     "notional_car" DECIMAL(10,2),
ADD COLUMN     "notional_essentials" DECIMAL(10,2),
ADD COLUMN     "notional_jwf_allowance" DECIMAL(10,2),
ADD COLUMN     "notional_public_transport" DECIMAL(10,2),
ADD COLUMN     "notional_savings_benchmark" DECIMAL(10,2),
ADD COLUMN     "property_category_derived" INTEGER,
ADD COLUMN     "property_equity_category" INTEGER,
ADD COLUMN     "recommended_payable_fees" DECIMAL(10,2),
ADD COLUMN     "rent_add_back_type" "RentAddBackType",
ADD COLUMN     "savings_test_number" DECIMAL(10,2),
ADD COLUMN     "theoretical_benchmark_di" DECIMAL(10,2),
ADD COLUMN     "total_notional_spend" DECIMAL(10,2),
ADD COLUMN     "uses_car" BOOLEAN,
ADD COLUMN     "uses_public_transport" BOOLEAN,
ADD COLUMN     "yearly_debt_exposure" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "assessment_earners" ADD COLUMN     "income_detail" JSONB;

-- AlterTable
ALTER TABLE "assessment_properties" ADD COLUMN     "debts" JSONB,
ADD COLUMN     "property_assets" JSONB;

-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "bursary_spend_before_vat" DECIMAL(10,2),
ADD COLUMN     "confirmed_payable_fees" DECIMAL(10,2),
ADD COLUMN     "gap_amount" DECIMAL(10,2),
ADD COLUMN     "last_payable_fees" DECIMAL(10,2),
ADD COLUMN     "recommended_payable_fees" DECIMAL(10,2),
ADD COLUMN     "scholarship_value_incl_vat" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "gap_reasons" (
    "id" UUID NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "is_deprecated" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gap_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_gap_reasons" (
    "recommendation_id" UUID NOT NULL,
    "gap_reason_id" UUID NOT NULL,

    CONSTRAINT "recommendation_gap_reasons_pkey" PRIMARY KEY ("recommendation_id","gap_reason_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gap_reasons_code_key" ON "gap_reasons"("code");

-- AddForeignKey
ALTER TABLE "recommendation_gap_reasons" ADD CONSTRAINT "recommendation_gap_reasons_gap_reason_id_fkey" FOREIGN KEY ("gap_reason_id") REFERENCES "gap_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_gap_reasons" ADD CONSTRAINT "recommendation_gap_reasons_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

