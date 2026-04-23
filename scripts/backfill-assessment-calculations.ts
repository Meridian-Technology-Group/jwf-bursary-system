/**
 * Backfill computed assessment values (stage results + payable fees) for
 * Assessment rows that were saved before the save flow persisted them.
 *
 * Until recently, assessment-form.tsx only sent raw inputs to saveAssessment;
 * the derived values (bursaryAward, yearlyPayableFees, monthlyPayableFees,
 * totalHouseholdNetIncome, …) stayed null in the DB. That shows up as "—" in
 * the recommendation's "Assessment Fee Summary".
 *
 * This script rebuilds the AssessmentInput from each row's stored inputs,
 * runs the same pure-TS calculator used on the client, and writes the results
 * back. It's idempotent and safe to re-run.
 *
 * Usage:
 *   npm run backfill:assessments -- [--dry-run] [--all] [--id <assessmentId>]
 *
 *   --dry-run       Print what would change; write nothing.
 *   --all           Re-persist every assessment, not only those missing values.
 *   --id <uuid>     Restrict to a single assessment (by assessment.id).
 *
 * Defaults to processing only rows where yearlyPayableFees IS NULL and
 * annualFees > 0 (the gate used by the live calculator).
 */

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
import { calculateAssessment } from "../src/lib/assessment/calculator";
import type { AssessmentInput } from "../src/lib/assessment/types";

const prisma = new PrismaClient({ log: ["warn", "error"] });

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ALL = args.includes("--all");
const idFlagIndex = args.indexOf("--id");
const ONLY_ID = idFlagIndex >= 0 ? args[idFlagIndex + 1] : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function fmt(v: number | null): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(v);
}

/**
 * Resolve the siblingPayableFees array for an application, matching the
 * runtime logic in assessment/page.tsx: older siblings only (lower
 * priorityOrder than this child), each sibling's most-recent
 * yearlyPayableFees.
 */
async function resolveSiblingPayableFees(
  bursaryAccountId: string | null
): Promise<number[]> {
  if (!bursaryAccountId) return [];

  const ownLink = await prisma.siblingLink.findFirst({
    where: { bursaryAccountId },
    select: { familyGroupId: true, priorityOrder: true },
  });
  if (!ownLink) return [];

  const siblingLinks = await prisma.siblingLink.findMany({
    where: {
      familyGroupId: ownLink.familyGroupId,
      bursaryAccountId: { not: bursaryAccountId },
      priorityOrder: { lt: ownLink.priorityOrder },
    },
    select: {
      bursaryAccount: {
        select: {
          applications: {
            where: { assessment: { yearlyPayableFees: { not: null } } },
            orderBy: { submittedAt: "desc" },
            take: 1,
            select: { assessment: { select: { yearlyPayableFees: true } } },
          },
        },
      },
    },
  });

  const fees: number[] = [];
  for (const link of siblingLinks) {
    const latestApp = link.bursaryAccount.applications[0];
    const raw = latestApp?.assessment?.yearlyPayableFees;
    if (raw != null) fees.push(Number(raw));
  }
  return fees;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface SkipRecord {
  id: string;
  reference: string;
  reason: string;
}

async function main() {
  console.log(
    `🔎 Backfill assessment calculations${DRY_RUN ? " (dry run)" : ""}${
      ALL ? " — all rows" : ""
    }${ONLY_ID ? ` — id=${ONLY_ID}` : ""}`
  );

  const assessments = await prisma.assessment.findMany({
    where: {
      ...(ONLY_ID ? { id: ONLY_ID } : {}),
      ...(ALL || ONLY_ID ? {} : { yearlyPayableFees: null }),
    },
    include: {
      earners: true,
      property: true,
      application: {
        select: {
          reference: true,
          bursaryAccountId: true,
        },
      },
    },
  });

  // Process in sibling-priority order so that when a later sibling reads
  // `siblingPayableFees`, all earlier siblings have already been updated
  // in this run. Without this, a cascading recompute can give different
  // results depending on traversal order.
  const accountIds = assessments
    .map((a) => a.application.bursaryAccountId)
    .filter((id): id is string => id != null);

  const priorityByAccount = new Map<string, number>();
  if (accountIds.length > 0) {
    const links = await prisma.siblingLink.findMany({
      where: { bursaryAccountId: { in: accountIds } },
      select: { bursaryAccountId: true, priorityOrder: true },
    });
    for (const link of links) {
      if (!priorityByAccount.has(link.bursaryAccountId)) {
        priorityByAccount.set(link.bursaryAccountId, link.priorityOrder);
      }
    }
  }

  const priorityOf = (bursaryAccountId: string | null): number | null =>
    bursaryAccountId ? priorityByAccount.get(bursaryAccountId) ?? null : null;

  assessments.sort((x, y) => {
    const px = priorityOf(x.application.bursaryAccountId);
    const py = priorityOf(y.application.bursaryAccountId);
    // Accounts with no sibling link have no upstream dependency; process first.
    if (px == null && py == null) {
      return x.createdAt.getTime() - y.createdAt.getTime();
    }
    if (px == null) return -1;
    if (py == null) return 1;
    return px - py;
  });

  console.log(`   Found ${assessments.length} assessment(s) to consider.\n`);

  let updated = 0;
  let unchanged = 0;
  const skipped: SkipRecord[] = [];

  for (const a of assessments) {
    const ref = a.application.reference;

    // Gating — same as the client-side CalculationDisplay
    if (a.annualFees == null || Number(a.annualFees) <= 0) {
      skipped.push({ id: a.id, reference: ref, reason: "annualFees missing or 0" });
      continue;
    }
    if (!a.property) {
      skipped.push({ id: a.id, reference: ref, reason: "no property row" });
      continue;
    }
    if (a.earners.length === 0) {
      skipped.push({ id: a.id, reference: ref, reason: "no earners" });
      continue;
    }

    const siblingPayableFees = await resolveSiblingPayableFees(
      a.application.bursaryAccountId
    );

    const input: AssessmentInput = {
      earners: a.earners.map((e) => ({
        earnerLabel: e.earnerLabel,
        employmentStatus: e.employmentStatus,
        netPay: toNum(e.netPay),
        netDividends: toNum(e.netDividends),
        netSelfEmployedProfit: toNum(e.netSelfEmployedProfit),
        pensionAmount: toNum(e.pensionAmount),
        benefitsIncluded: toNum(e.benefitsIncluded),
        benefitsExcluded: toNum(e.benefitsExcluded),
      })),
      familyTypeCategory: a.familyTypeCategory ?? 0,
      notionalRent: toNum(a.notionalRent),
      utilityCosts: toNum(a.utilityCosts),
      foodCosts: toNum(a.foodCosts),
      annualFees: toNum(a.annualFees),
      councilTax: toNum(a.councilTax),
      schoolingYearsRemaining: a.schoolingYearsRemaining ?? 0,
      isMortgageFree: a.property.isMortgageFree,
      additionalPropertyIncome: toNum(a.property.additionalPropertyIncome),
      cashSavings: toNum(a.property.cashSavings),
      isasPepsShares: toNum(a.property.isasPepsShares),
      schoolAgeChildrenCount: a.property.schoolAgeChildrenCount,
      scholarshipPct: toNum(a.scholarshipPct),
      vatRate: toNum(a.vatRate, 20),
      manualAdjustment: toNum(a.manualAdjustment),
      siblingPayableFees,
    };

    let output;
    try {
      output = calculateAssessment(input);
    } catch (err) {
      skipped.push({
        id: a.id,
        reference: ref,
        reason: `calculator threw: ${(err as Error).message}`,
      });
      continue;
    }

    const next = {
      totalHouseholdNetIncome: output.stages.stage1_totalHouseholdNetIncome,
      netAssetsYearlyValuation: output.stages.stage2_netAssetsYearlyValuation,
      hndiAfterNs: output.stages.stage3_hndiAfterNS,
      requiredBursary: output.stages.stage4_requiredBursary,
      grossFees: output.payableFees.grossFees,
      bursaryAward: output.payableFees.bursaryAward,
      netYearlyFees: output.payableFees.netYearlyFees,
      yearlyPayableFees: output.payableFees.adjustedYearlyPayableFees,
      monthlyPayableFees: output.payableFees.adjustedMonthlyPayableFees,
    };

    // Detect whether anything actually changes (2dp tolerance)
    const before = {
      yearlyPayableFees: a.yearlyPayableFees == null ? null : Number(a.yearlyPayableFees),
      monthlyPayableFees: a.monthlyPayableFees == null ? null : Number(a.monthlyPayableFees),
      bursaryAward: a.bursaryAward == null ? null : Number(a.bursaryAward),
    };

    const changed =
      before.yearlyPayableFees == null ||
      before.monthlyPayableFees == null ||
      before.bursaryAward == null ||
      Math.abs(before.yearlyPayableFees - next.yearlyPayableFees) > 0.005 ||
      Math.abs(before.monthlyPayableFees - next.monthlyPayableFees) > 0.005 ||
      Math.abs(before.bursaryAward - next.bursaryAward) > 0.005;

    if (!changed) {
      unchanged++;
      continue;
    }

    console.log(
      `  ${ref.padEnd(18)} ${fmt(before.bursaryAward)} → ${fmt(
        next.bursaryAward
      )}  |  yearly ${fmt(before.yearlyPayableFees)} → ${fmt(
        next.yearlyPayableFees
      )}  |  monthly ${fmt(before.monthlyPayableFees)} → ${fmt(
        next.monthlyPayableFees
      )}`
    );

    if (!DRY_RUN) {
      await prisma.assessment.update({
        where: { id: a.id },
        data: next,
      });
    }
    updated++;
  }

  console.log("\n─── Summary ─────────────────────────────────");
  console.log(`  ${updated} updated${DRY_RUN ? " (dry run — no writes)" : ""}`);
  console.log(`  ${unchanged} unchanged`);
  console.log(`  ${skipped.length} skipped`);
  if (skipped.length > 0) {
    for (const s of skipped) {
      console.log(`    - ${s.reference} (${s.id}): ${s.reason}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
