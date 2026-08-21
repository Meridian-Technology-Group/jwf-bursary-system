-- CreateEnum
CREATE TYPE "NotionalCostType" AS ENUM ('RENT', 'COUNCIL_TAX', 'ESSENTIALS', 'CAR', 'PUBLIC_TRANSPORT', 'JWF_ALLOWANCE', 'NOTIONAL_SAVINGS', 'SAVINGS_CUSHION');

-- CreateTable
CREATE TABLE "notional_cost_configs" (
    "id" UUID NOT NULL,
    "category" INTEGER NOT NULL,
    "cost_type" "NotionalCostType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notional_cost_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_category_metas" (
    "id" UUID NOT NULL,
    "category" INTEGER NOT NULL,
    "family_members" INTEGER NOT NULL,
    "school_age_children" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_category_metas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affordability_bands" (
    "id" UUID NOT NULL,
    "band_floor" DECIMAL(10,2) NOT NULL,
    "band_ceiling" DECIMAL(10,2) NOT NULL,
    "base_pct" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affordability_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_category_bands" (
    "id" UUID NOT NULL,
    "band_floor" DECIMAL(10,2),
    "band_ceiling" DECIMAL(10,2),
    "category" INTEGER NOT NULL,
    "fees_benchmark_pct" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_category_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_equity_bands" (
    "id" UUID NOT NULL,
    "band_floor" DECIMAL(12,2),
    "band_ceiling" DECIMAL(12,2),
    "category" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_equity_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_equity_bands" (
    "id" UUID NOT NULL,
    "band_floor" DECIMAL(12,2),
    "band_ceiling" DECIMAL(12,2),
    "label" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_equity_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_ratio_bands" (
    "id" UUID NOT NULL,
    "ratio_floor" DECIMAL(7,4),
    "ratio_ceiling" DECIMAL(7,4),
    "min_repayment_months" INTEGER,
    "status_label" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_ratio_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lifestyle_squeeze_bands" (
    "id" UUID NOT NULL,
    "ratio_floor" DECIMAL(6,2),
    "ratio_ceiling" DECIMAL(6,2),
    "status_label" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifestyle_squeeze_bands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notional_cost_configs_category_cost_type_effective_from_key" ON "notional_cost_configs"("category", "cost_type", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "family_category_metas_category_effective_from_key" ON "family_category_metas"("category", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "affordability_bands_band_floor_effective_from_key" ON "affordability_bands"("band_floor", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "income_category_bands_band_ceiling_effective_from_key" ON "income_category_bands"("band_ceiling", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "property_equity_bands_band_ceiling_effective_from_key" ON "property_equity_bands"("band_ceiling", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "financial_equity_bands_band_ceiling_effective_from_key" ON "financial_equity_bands"("band_ceiling", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "debt_ratio_bands_ratio_ceiling_effective_from_key" ON "debt_ratio_bands"("ratio_ceiling", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "lifestyle_squeeze_bands_ratio_ceiling_effective_from_key" ON "lifestyle_squeeze_bands"("ratio_ceiling", "effective_from");

